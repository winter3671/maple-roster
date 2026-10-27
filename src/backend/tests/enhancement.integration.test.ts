import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../database/connection'
import { UnitOfWork } from '../database/unit-of-work'
import { CharacterRepository } from '../modules/characters/character.repository'
import { CharacterService } from '../modules/characters/character.service'
import { LedgerRepository } from '../modules/ledger/ledger.repository'
import { ExpenseService } from '../modules/ledger/expense.service'
import { EnhancementService } from '../modules/ledger/enhancement.service'
import { BackupService } from '../modules/backup/backup.service'
import { NexonClient } from '../integrations/nexon/nexon.client'
import { potentialCost } from '../../shared/potential-cost'
import type {
  PotentialRecord,
  EnhancementPreview
} from '../../shared/contracts/enhancement.contract'

const now = () => new Date('2026-10-27T05:00:00Z')
const record = (overrides: Partial<PotentialRecord> = {}): PotentialRecord => ({
  id: 'history-secret-id',
  characterName: '강화캐릭터',
  date: '2026-10-27',
  kind: '잠재능력',
  itemName: '아케인셰이드 모자',
  itemLevel: 200,
  beforeGrade: '레어',
  ...overrides
})
describe('강화 지출 이력 가져오기', () => {
  let db: DatabaseSync,
    chars: CharacterRepository,
    expenses: ExpenseService,
    service: EnhancementService,
    characterId: string,
    fingerprint: string
  const client = { list: vi.fn(), potentialHistory: vi.fn() }
  beforeEach(() => {
    db = openDatabase(':memory:')
    chars = new CharacterRepository(db)
    characterId = new CharacterService(chars).create({ name: '강화캐릭터', world: '레드' }).id
    db.prepare('UPDATE characters SET nexon_ocid=? WHERE id=?').run('fake-ocid', characterId)
    expenses = new ExpenseService(db, chars, new LedgerRepository(db), new UnitOfWork(db), now)
    fingerprint = 'account-a'
    client.list
      .mockReset()
      .mockResolvedValue([{ ocid: 'fake-ocid', name: '강화캐릭터', world: '레드' }])
    client.potentialHistory.mockReset().mockResolvedValue({ records: [record()], nextCursor: null })
    service = new EnhancementService(
      db,
      client,
      chars,
      expenses,
      () => ({ fingerprint, label: '본계정' }),
      now
    )
  })
  afterEach(() => db.close())
  const preview = () => service.preview({ date: '2026-10-27' })
  const apply = (p: EnhancementPreview, amount = p.rows[0].amount!) =>
    service.apply({
      previewId: p.id,
      confirmed: true,
      rows: p.rows.map((row) => ({ id: row.id, characterId, amount }))
    })
  it('조회는 지출을 만들지 않고 기존 등급 기준 합계로 묶어 사용자 확인 후 반영한다', async () => {
    client.potentialHistory.mockResolvedValue({
      records: [record(), record({ id: 'second', beforeGrade: '유니크' })],
      nextCursor: null
    })
    const p = await preview()
    expect(p.rows[0]).toMatchObject({ count: 2, amount: 42750000, characterId })
    expect(db.prepare('SELECT * FROM manual_expenses').all()).toHaveLength(0)
    expect(JSON.stringify(p)).not.toContain('history-secret-id')
    expect(apply(p, 40000000)).toEqual({ expenses: 1, records: 2, amount: 40000000 })
    expect(db.prepare('SELECT amount FROM ledger_entries').get()!.amount).toBe(40000000)
    expect(db.prepare('SELECT * FROM enhancement_imports').all()).toHaveLength(2)
    expect(() => apply(p)).toThrow('만료')
    const again = await preview()
    expect(again.rows).toEqual([])
    expect(again.alreadyImported).toBe(2)
  })
  it('커서 페이지를 모두 읽고 페이지 사이 중복을 제외하며 추가 이력만 다음 지출로 반영한다', async () => {
    client.potentialHistory
      .mockResolvedValueOnce({ records: [record()], nextCursor: 'cursor-next' })
      .mockResolvedValueOnce({ records: [record(), record({ id: 'next' })], nextCursor: null })
    const p = await preview()
    expect(client.potentialHistory).toHaveBeenNthCalledWith(2, '2026-10-27', 'cursor-next')
    expect(p.rows[0].count).toBe(2)
    apply(p)
    client.potentialHistory.mockResolvedValue({
      records: [record(), record({ id: 'next' }), record({ id: 'new' })],
      nextCursor: null
    })
    const later = await preview()
    expect(later.rows[0].count).toBe(1)
    apply(later)
    expect(db.prepare('SELECT SUM(amount) AS total FROM ledger_entries').get()!.total).toBe(
      13500000
    )
  })
  it('다른 계정·등록하지 않은 이름과 무료 큐브 유형은 제외하고 금액 불명은 직접 확인한다', async () => {
    client.potentialHistory.mockResolvedValue({
      records: [
        record({ itemLevel: null }),
        record({ id: 'other', characterName: '미등록' }),
        record({ id: 'cube', kind: '블랙 큐브' })
      ],
      nextCursor: null
    })
    const p = await preview()
    expect(p.excluded).toBe(2)
    expect(p.rows[0].amount).toBeNull()
    expect(() => service.apply({ previewId: p.id, confirmed: false, rows: [] })).toThrow('중복')
    expect(apply(p, 1234567).amount).toBe(1234567)
  })
  it('동명이인 월드는 자동 선택하지 않으며 현재 API 계정에 속한 캐릭터만 허용한다', async () => {
    const id = new CharacterService(chars).create({ name: '강화캐릭터', world: '루나' }).id
    db.prepare('UPDATE characters SET nexon_ocid=? WHERE id=?').run('another-ocid', id)
    client.list.mockResolvedValue([{ ocid: 'fake-ocid' }, { ocid: 'another-ocid' }])
    expect((await preview()).rows[0].characterId).toBeNull()
    client.list.mockResolvedValue([{ ocid: 'other-account' }])
    await expect(preview()).rejects.toThrow('먼저 등록')
  })
  it('연결·계정 변경과 오래된 미리보기는 반영하지 않는다', async () => {
    let p = await preview()
    fingerprint = 'account-b'
    expect(() => apply(p)).toThrow('계정이 변경')
    fingerprint = 'account-a'
    p = await preview()
    db.prepare('UPDATE characters SET nexon_ocid=? WHERE id=?').run('changed-ocid', characterId)
    expect(() => apply(p)).toThrow('연결 정보')
    expect(db.prepare('SELECT * FROM manual_expenses').all()).toHaveLength(0)
  })
  it('반복 커서·페이지 오류·미래 날짜는 부분 저장 없이 차단한다', async () => {
    await expect(service.preview({ date: '2026-10-28' })).rejects.toThrow('최근 2년')
    client.potentialHistory.mockResolvedValue({ records: [record()], nextCursor: 'repeat' })
    await expect(preview()).rejects.toThrow('반복')
    expect(db.prepare('SELECT * FROM manual_expenses').all()).toHaveLength(0)
    client.potentialHistory.mockRejectedValue(new Error('offline'))
    await expect(preview()).rejects.toThrow('offline')
  })
  it('중복 선택·금액 위조·미등록 캐릭터를 거부하고 저장 실패 시 지출·연결을 전부 롤백한다', async () => {
    const p = await preview(),
      row = { id: p.rows[0].id, characterId, amount: 1 }
    expect(() => service.apply({ previewId: p.id, confirmed: true, rows: [row, row] })).toThrow()
    expect(() => apply(p, -1)).toThrow()
    expect(() =>
      service.apply({
        previewId: p.id,
        confirmed: true,
        rows: [{ ...row, id: crypto.randomUUID() }]
      })
    ).toThrow()
    db.exec(
      "CREATE TRIGGER fail_import BEFORE INSERT ON enhancement_imports BEGIN SELECT RAISE(ABORT,'fail import'); END"
    )
    expect(() => apply(p)).toThrow('fail import')
    expect(db.prepare('SELECT * FROM manual_expenses').all()).toHaveLength(0)
    expect(db.prepare('SELECT * FROM ledger_entries').all()).toHaveLength(0)
    db.exec('DROP TRIGGER fail_import')
    expect(apply(p).records).toBe(1)
  })
  it('지출 수정·삭제·백업 복원 후 재조회해도 원본 이력을 중복 반영하지 않는다', async () => {
    apply(await preview())
    const row = db.prepare('SELECT * FROM manual_expenses').get()!
    expenses.update({
      id: row.id,
      characterId,
      date: '2026-10-27',
      category: '강화',
      amount: 123,
      notes: '수정'
    })
    expect((await preview()).alreadyImported).toBe(1)
    expenses.remove(row.id)
    expect(db.prepare('SELECT expense_id FROM enhancement_imports').get()!.expense_id).toBeNull()
    const backup = new BackupService(db, () => 'recovery.json', now),
      content = backup.export()
    backup.restore({ previewId: backup.prepare(content, '강화.json').id })
    expect((await preview()).alreadyImported).toBe(1)
    const legacy = JSON.parse(content)
    legacy.schemaVersion = 17
    delete legacy.tables.enhancement_imports
    backup.restore({ previewId: backup.prepare(JSON.stringify(legacy), '이전.json').id })
    expect((await preview()).rows).toHaveLength(1)
  })
  it('두 종류 일괄 반영 중 두 번째 지출 저장이 실패해도 첫 지출과 원본 연결이 남지 않는다', async () => {
    client.potentialHistory.mockResolvedValue({
      records: [record(), record({ id: 'additional', kind: '에디셔널 잠재능력' })],
      nextCursor: null
    })
    const p = await preview()
    const original = expenses.createInTransaction.bind(expenses)
    const save = vi
      .spyOn(expenses, 'createInTransaction')
      .mockImplementationOnce(original)
      .mockImplementationOnce(() => {
        throw new Error('second expense failed')
      })
    expect(() => apply(p)).toThrow('second expense failed')
    expect(db.prepare('SELECT * FROM manual_expenses').all()).toHaveLength(0)
    expect(db.prepare('SELECT * FROM ledger_entries').all()).toHaveLength(0)
    expect(db.prepare('SELECT * FROM enhancement_imports').all()).toHaveLength(0)
    save.mockRestore()
    expect(apply(p).expenses).toBe(2)
  })
  it('15분이 지난 미리보기로는 장부를 변경하지 않는다', async () => {
    let current = now()
    const expiring = new EnhancementService(
      db,
      client,
      chars,
      expenses,
      () => ({ fingerprint, label: '본계정' }),
      () => current
    )
    const p = await expiring.preview({ date: '2026-10-27' })
    current = new Date(current.getTime() + 15 * 60000)
    expect(() =>
      expiring.apply({
        previewId: p.id,
        confirmed: true,
        rows: [{ id: p.rows[0].id, characterId, amount: 1 }]
      })
    ).toThrow('만료')
    expect(db.prepare('SELECT * FROM ledger_entries').all()).toHaveLength(0)
  })
})
describe('공식 메소 잠재능력 기본 비용표', () => {
  it.each([
    [159, 4000000],
    [160, 4250000],
    [199, 4250000],
    [200, 4500000],
    [249, 4500000],
    [250, 5000000],
    [300, 5000000]
  ])('레어 %i레벨 기본 비용은 %i', (itemLevel, amount) =>
    expect(potentialCost(record({ itemLevel }))).toBe(amount)
  )
  it('일반·에디셔널을 나누고 미지원 레벨·등급·기간은 비용 불명으로 남긴다', () => {
    expect(potentialCost(record({ kind: '에디셔널 잠재능력', beforeGrade: '레전드리' }))).toBe(
      88000000
    )
    expect(potentialCost(record({ beforeGrade: '레전더리', itemLevel: 250 }))).toBe(50000000)
    for (const patch of [
      { itemLevel: 0 },
      { itemLevel: 301 },
      { itemLevel: 1.5 },
      { beforeGrade: null },
      { date: '2024-01-24' },
      { kind: '에디셔널 잠재능력', date: '2024-06-19' }
    ])
      expect(potentialCost(record(patch))).toBeNull()
  })
})
describe('잠재능력 이력 API 파싱', () => {
  it('건수가 0인 null 이력은 빈 목록으로 처리한다', async () => {
    const client = new NexonClient(
      () => 'fake-key',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ count: 0, potential_history: null, next_cursor: null }))
        ),
      0
    )
    expect(await client.potentialHistory('2026-10-27')).toEqual({ records: [], nextCursor: null })
  })
  it('커서만으로 다음 페이지를 요청하고 실제 사용 전 등급·한국 날짜를 읽는다', async () => {
    const transport = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          potential_history: [
            {
              id: 'raw-id',
              character_name: '강화캐릭터',
              date_create: '2026-10-26T16:00:00Z',
              potential_type: '잠재능력',
              target_item: '장비',
              item_level: 200,
              potential_option_grade: '에픽',
              before_potential_option: [{ grade: '레어' }]
            }
          ],
          next_cursor: ''
        })
      )
    )
    const client = new NexonClient(() => 'fake-key', transport, 0)
    const result = await client.potentialHistory('2026-10-27', 'next-cursor')
    expect(result.records[0]).toMatchObject({ date: '2026-10-27', beforeGrade: '레어' })
    const url = new URL(transport.mock.calls[0][0])
    expect(url.searchParams.has('date')).toBe(false)
    expect(url.searchParams.get('cursor')).toBe('next-cursor')
    expect(potentialCost(result.records[0])).toBe(4500000)
  })
})
