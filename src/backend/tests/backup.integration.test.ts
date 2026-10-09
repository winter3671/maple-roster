import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { openDatabase } from '../database/connection'
import { UnitOfWork } from '../database/unit-of-work'
import { CharacterRepository } from '../modules/characters/character.repository'
import { CharacterService } from '../modules/characters/character.service'
import { BossRepository } from '../modules/bosses/boss.repository'
import { BossService } from '../modules/bosses/boss.service'
import { BossRosterService } from '../modules/bosses/boss-roster.service'
import { DropRepository } from '../modules/drops/drop.repository'
import { DropService } from '../modules/drops/drop.service'
import { HuntingRepository } from '../modules/hunting/hunting.repository'
import { HuntingService } from '../modules/hunting/hunting.service'
import { LedgerRepository } from '../modules/ledger/ledger.repository'
import { BackupService, MAX_BACKUP_BYTES } from '../modules/backup/backup.service'

describe('JSON 장부 백업과 전체 복원', () => {
  let database: DatabaseSync,
    backup: BackupService,
    characters: CharacterService,
    bosses: BossService,
    drops: DropService,
    rosters: BossRosterService
  let characterId: string, now: Date
  let saveRecovery: ReturnType<typeof vi.fn<(content: string) => string>>
  beforeEach(() => {
    now = new Date('2026-10-15T00:00:00Z')
    database = openDatabase(':memory:')
    const chars = new CharacterRepository(database),
      ledger = new LedgerRepository(database),
      dropRepo = new DropRepository(database),
      hunts = new HuntingRepository(database),
      bossRepo = new BossRepository(database),
      tx = new UnitOfWork(database)
    characters = new CharacterService(chars)
    bosses = new BossService(bossRepo, chars, ledger, tx, dropRepo, () => now)
    drops = new DropService(dropRepo, hunts, bossRepo, ledger, tx, () => now)
    rosters = new BossRosterService(database, bossRepo, chars, tx, () => now)
    saveRecovery = vi.fn(() => '/fake/before-restore.json')
    backup = new BackupService(database, saveRecovery, () => now)
    const character = characters.create({ name: '백업캐릭터', world: '루나', notes: '보존 메모' })
    characterId = character.id
    chars.saveProfile(characterId, {
      ocid: 'fake-backup-ocid',
      name: character.name,
      world: character.world,
      job: '아크',
      level: 280,
      guild: '길드',
      imageUrl:
        'https://open.api.nexon.com/static/maplestory/character/look/' +
        'A'.repeat(2048) +
        '/backup-avatar',
      fetchedAt: now.toISOString()
    })
    const template = rosters.saveTemplate({
      name: '백업 구성',
      members: [{ bossName: '스우', difficulty: '노멀', partySize: 2 }]
    })
    rosters.assign({ templateId: template.id, characterIds: [characterId] })
    const boss = bosses.createRun({
      characterId,
      date: '2026-10-15',
      bossName: '스우',
      difficulty: '노멀',
      partySize: 2,
      notes: '보스 메모'
    })
    bosses.setClear({ id: boss.id, isCleared: true })
    bosses.settle({ runId: boss.id, date: '2026-10-15', amount: 60 })
    const hunting = new HuntingService(hunts, chars, ledger, tx, dropRepo, () => now)
    const session = hunting.create({
      requestId: randomUUID(),
      characterId,
      date: '2026-10-08',
      minutes: 60,
      mesos: 1000,
      cost: 100,
      solFragments: 10,
      nodestones: 2,
      notes: '사냥 메모'
    })
    const lot = drops
      .list({ kind: 'hunting', id: session.id })
      .lots.find((row) => row.managedKind === 'sol_fragment')!
    drops.createSale({
      requestId: randomUUID(),
      lotId: lot.id,
      date: '2026-10-13',
      quantity: 3,
      grossAmount: 1001,
      feeAmount: 100,
      partySize: 3,
      shareMode: 'equal',
      manualShare: null
    })
  })
  afterEach(() => database.close())
  it('이미지 URL을 백업·복원하고 이전 10번 백업은 기존 기록을 유지하며 이미지 없이 복원한다', () => {
    const content = backup.export()
    database.exec('UPDATE characters SET nexon_image_url=NULL')
    backup.restore({ previewId: backup.prepare(content, '이미지.json').id })
    expect(characters.list()[0].nexon?.profile?.imageUrl).toContain('/backup-avatar')
    const legacy = JSON.parse(content)
    legacy.schemaVersion = 10
    for (const row of legacy.tables.characters) delete row.nexon_image_url
    backup.restore({ previewId: backup.prepare(JSON.stringify(legacy), '이전10.json').id })
    expect(characters.list()[0]).toMatchObject({
      id: characterId,
      notes: '보존 메모',
      nexon: { profile: { imageUrl: null } }
    })
  })
  it('백업의 임의 이미지 주소와 프로필 없는 이미지를 거부한다', () => {
    for (const image of [
      'https://example.com/avatar.png',
      'javascript:alert(1)',
      'https://open.api.nexon.com/api/avatar'
    ]) {
      const file = JSON.parse(backup.export())
      file.tables.characters[0].nexon_image_url = image
      expect(() => backup.prepare(JSON.stringify(file), '잘못된이미지.json')).toThrow()
    }
    const file = JSON.parse(backup.export())
    file.tables.characters[0].nexon_fetched_at = null
    expect(() => backup.prepare(JSON.stringify(file), '고립된이미지.json')).toThrow()
  })
  const tables = () => JSON.parse(backup.export()).tables
  it('이전 백업의 숨김 캐릭터도 표시하며 복원할 때 단기 주간 캐시는 비운다', () => {
    const file = JSON.parse(backup.export())
    file.schemaVersion = 13
    file.tables.characters[0].is_hidden = 1
    database
      .prepare('INSERT INTO weekly_content_snapshots VALUES (?,?,?,?,?)')
      .run(characterId, '2026-10-15', 'fake-backup-ocid', '[]', now.toISOString())
    const preview = backup.prepare(JSON.stringify(file), '이전13.json')
    backup.restore({ previewId: preview.id })
    expect(characters.list()[0].id).toBe(characterId)
    expect(characters.list()[0]).not.toHaveProperty('isHidden')
    expect(database.prepare('SELECT is_hidden FROM characters').get()?.is_hidden).toBe(0)
    expect(database.prepare('SELECT * FROM weekly_content_snapshots').all()).toEqual([])
    expect(bosses.list({ date: '2026-10-15' }).runs[0].settlement?.amount).toBe(60)
  })
  it('인원 미확인 상태를 백업·복원하고 이전 DB 버전 백업은 기존 확인 상태로 변환한다', () => {
    database.exec('UPDATE boss_runs SET party_size_needs_review=1')
    const file = JSON.parse(backup.export())
    const current = backup.prepare(JSON.stringify(file), '현재.json')
    database.exec('UPDATE boss_runs SET party_size_needs_review=0')
    const refreshed = backup.prepare(JSON.stringify(file), '현재.json')
    backup.restore({ previewId: refreshed.id })
    expect(bosses.list({ date: '2026-10-15' }).runs[0].partySizeNeedsReview).toBe(true)
    file.schemaVersion = 7
    delete file.tables.crystal_price_history
    for (const row of file.tables.characters) delete row.nexon_image_url
    delete file.tables.manual_expenses
    for (const row of file.tables.ledger_entries) delete row.manual_expense_id
    for (const row of file.tables.boss_runs) delete row.party_size_needs_review
    const old = backup.prepare(JSON.stringify(file), '이전.json')
    backup.restore({ previewId: old.id })
    expect(bosses.list({ date: '2026-10-15' }).runs[0].partySizeNeedsReview).toBe(false)
    expect(bosses.list({ date: '2026-10-15' }).runs[0].settlement?.amount).toBe(60)
    expect(current.incoming).toEqual(old.incoming)
  })
  it('인원 확인 상태에 허용되지 않은 값이나 이전 버전의 추가 필드가 있으면 복원을 거부한다', () => {
    const file = JSON.parse(backup.export())
    file.tables.boss_runs[0].party_size_needs_review = 2
    expect(() => backup.prepare(JSON.stringify(file), '잘못된.json')).toThrow('올바르지')
    file.schemaVersion = 7
    expect(() => backup.prepare(JSON.stringify(file), '잘못된이전.json')).toThrow('올바르지')
  })
  it('모든 기록·연결·ID·프리셋·수동 수익을 그대로 백업하고 전체 복원한다', () => {
    const content = backup.export(),
      original = tables()
    expect(Object.keys(JSON.parse(content))).toEqual([
      'format',
      'version',
      'schemaVersion',
      'createdAt',
      'tables'
    ])
    expect(content).not.toContain('NEXON_API_KEY')
    expect(content).not.toContain('nexon-api-key.bin')
    expect(JSON.parse(content).tables.characters[0].nexon_ocid).toBe('fake-backup-ocid')
    characters.create({ name: '교체될캐릭터', world: '루나' })
    const before = tables(),
      preview = backup.prepare(content, '장부.json')
    expect(tables()).toEqual(before)
    expect(preview).toMatchObject({
      incoming: {
        characters: 1,
        bossRuns: 1,
        huntingSessions: 1,
        dropLots: 2,
        dropSales: 1,
        ledgerEntries: 4,
        templates: 1
      },
      current: { characters: 2 }
    })
    expect(backup.restore({ previewId: preview.id })).toMatchObject({
      recoveryPath: '/fake/before-restore.json',
      counts: preview.incoming
    })
    expect(tables()).toEqual(original)
    expect(JSON.parse(saveRecovery.mock.calls[0][0]).tables).toEqual(before)
    expect(characters.list()[0]).toMatchObject({
      notes: '보존 메모',
      nexon: { ocid: 'fake-backup-ocid' }
    })
    expect(bosses.list({ date: '2026-10-15' }).runs[0].settlement?.amount).toBe(60)
    expect(rosters.state().rosters[0].members[0].partySize).toBe(2)
    expect(() => backup.restore({ previewId: preview.id })).toThrow('만료')
  })
  it('빈 장부로 복원할 때에도 현재 기록을 안전 백업하고 원래 백업으로 되돌릴 수 있다', () => {
    const empty = openDatabase(':memory:')
    let content: string
    try {
      content = new BackupService(empty, saveRecovery, () => now).export()
    } finally {
      empty.close()
    }
    const original = tables(),
      preview = backup.prepare(content, '빈장부.json')
    backup.restore({ previewId: preview.id })
    expect(characters.list()).toEqual([])
    const recovery = saveRecovery.mock.calls[0][0]
    const undo = backup.prepare(recovery, '복원전.json')
    backup.restore({ previewId: undo.id })
    expect(tables()).toEqual(original)
  })
  it('안전 백업 실패와 DB 저장 실패는 원래 장부를 유지한다', () => {
    const content = backup.export()
    characters.create({ name: '현재캐릭터', world: '루나' })
    const original = tables(),
      preview = backup.prepare(content, '장부.json')
    saveRecovery.mockImplementationOnce(() => {
      throw new Error('disk full')
    })
    expect(() => backup.restore({ previewId: preview.id })).toThrow('안전 백업')
    expect(tables()).toEqual(original)
    database.exec(
      "CREATE TRIGGER reject_restore BEFORE INSERT ON boss_runs BEGIN SELECT RAISE(ABORT,'failure'); END"
    )
    expect(() => backup.restore({ previewId: preview.id })).toThrow('기존 장부')
    expect(tables()).toEqual(original)
    database.exec('DROP TRIGGER reject_restore')
    backup.restore({ previewId: preview.id })
    expect(tables()).toEqual(JSON.parse(content).tables)
  })
  it('확인 이후 장부 변경·만료·취소·위조 ID이면 복원하지 않는다', () => {
    const content = backup.export(),
      first = backup.prepare(content, '장부.json')
    characters.create({ name: '추가', world: '루나' })
    expect(() => backup.restore({ previewId: first.id })).toThrow('장부가 변경')
    expect(saveRecovery).not.toHaveBeenCalled()
    const expired = backup.prepare(content, '장부.json')
    now = new Date(now.getTime() + 10 * 60 * 1000)
    expect(() => backup.restore({ previewId: expired.id })).toThrow('만료')
    const canceled = backup.prepare(content, '장부.json')
    backup.cancel()
    expect(() => backup.restore({ previewId: canceled.id })).toThrow('만료')
    backup.prepare(content, '장부.json')
    expect(() => backup.restore({ previewId: randomUUID() })).toThrow('만료')
    expect(saveRecovery).not.toHaveBeenCalled()
  })
  it.each([
    [
      '새 버전',
      (file: any) => {
        file.schemaVersion = 999
      }
    ],
    [
      'API 키 필드',
      (file: any) => {
        file.apiKey = 'fake-key'
      }
    ],
    [
      '임의 테이블',
      (file: any) => {
        file.tables.secrets = []
      }
    ],
    [
      '임의 컬럼',
      (file: any) => {
        file.tables.characters[0].api_key = 'fake-key'
      }
    ],
    [
      '날짜',
      (file: any) => {
        file.tables.hunting_sessions[0].activity_date = '2026-02-30'
      }
    ],
    [
      '잘못된 주차',
      (file: any) => {
        file.tables.boss_runs[0].period_start = '2026-10-14'
      }
    ],
    [
      '문자열 숫자',
      (file: any) => {
        file.tables.hunting_sessions[0].mesos = '1000'
      }
    ],
    [
      '안전 정수 초과',
      (file: any) => {
        file.tables.hunting_sessions[0].mesos = Number.MAX_SAFE_INTEGER + 1
      }
    ],
    [
      '존재하지 않는 참조',
      (file: any) => {
        file.tables.drop_sales[0].drop_lot_id = randomUUID()
      }
    ],
    [
      '중복 ID',
      (file: any) => {
        file.tables.characters.push({ ...file.tables.characters[0] })
      }
    ],
    [
      '판매 수량 초과',
      (file: any) => {
        file.tables.drop_sales[0].quantity = 11
      }
    ],
    [
      '분배금 불일치',
      (file: any) => {
        file.tables.drop_sales[0].net_share = 301
      }
    ],
    [
      '장부 금액 불일치',
      (file: any) => {
        file.tables.ledger_entries[0].amount += 1
      }
    ],
    [
      '장부 누락',
      (file: any) => {
        file.tables.ledger_entries.pop()
      }
    ],
    [
      '아이템 수량 불일치',
      (file: any) => {
        file.tables.drop_lots[0].quantity += 1
      }
    ],
    [
      '손상 프리셋',
      (file: any) => {
        file.tables.boss_templates[0].members_json = 'bad'
      }
    ],
    [
      '자동 아이템 누락',
      (file: any) => {
        file.tables.drop_lots = file.tables.drop_lots.filter(
          (row: any) => row.managed_kind !== 'nodestone'
        )
      }
    ]
  ])('%s 백업은 원본 DB를 변경하지 않고 거부한다', (_label, mutate) => {
    const original = tables(),
      file = JSON.parse(backup.export())
    mutate(file)
    expect(() => backup.prepare(JSON.stringify(file), '오류.json')).toThrow()
    expect(tables()).toEqual(original)
    expect(saveRecovery).not.toHaveBeenCalled()
  })
  it('잘못된 JSON과 대용량 파일을 거부하고 BOM 백업도 읽는다', () => {
    expect(() => backup.prepare('{broken', '오류.json')).toThrow()
    expect(() => backup.prepare(' '.repeat(MAX_BACKUP_BYTES + 1), '대용량.json')).toThrow('50MB')
    expect(backup.prepare('\uFEFF' + backup.export(), 'BOM.json').incoming.characters).toBe(1)
  })
})
