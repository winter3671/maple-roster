import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../database/connection'
import { UnitOfWork } from '../database/unit-of-work'
import { DropRepository } from '../modules/drops/drop.repository'
import { DropService } from '../modules/drops/drop.service'
import { HuntingRepository } from '../modules/hunting/hunting.repository'
import { HuntingService } from '../modules/hunting/hunting.service'
import { BossRepository } from '../modules/bosses/boss.repository'
import { BossService } from '../modules/bosses/boss.service'
import { CharacterRepository } from '../modules/characters/character.repository'
import { CharacterService } from '../modules/characters/character.service'
import { LedgerRepository } from '../modules/ledger/ledger.repository'
import { LedgerService } from '../modules/ledger/ledger.service'
import type { DropLot, DropSaleInput } from '../../shared/contracts/drop.contract'
import type { HuntingSession } from '../../shared/contracts/hunting.contract'
import { groupLedgerIncome } from '../../shared/ledger-income'
import charactersSql from '../database/migrations/001_characters.sql?raw'
import huntingSql from '../database/migrations/002_hunting_ledger.sql?raw'
import bossesSql from '../database/migrations/003_bosses.sql?raw'

describe('획득 묶음과 드랍 부분 판매', () => {
  let directory: string,
    database: DatabaseSync,
    drops: DropService,
    hunting: HuntingService,
    bosses: BossService,
    ledger: LedgerService
  let characterId: string, session: HuntingSession, lot: DropLot
  const clock = () => new Date('2026-10-15T00:00:00Z')
  const month = { from: '2026-10-01', to: '2026-10-15' }
  it('사냥 판매완료·금액 수정·미판매 전환은 장부와 수익에 한 번만 반영한다', () => {
    const input = {
      lotId: lot.id,
      sold: true,
      date: '2026-10-15',
      grossAmount: 20000,
      requestId: randomUUID()
    }
    const first = drops.setHuntingSale(input)!
    expect(first.quantity).toBe(lot.quantity)
    expect(first.netShare).toBe(20000)
    expect(drops.setHuntingSale(input)!.id).toBe(first.id)
    expect(drops.list(lot.source).sales).toHaveLength(1)
    expect(drops.setHuntingSale({ ...input, grossAmount: 30000 })!.netShare).toBe(30000)
    expect(hunting.list(month).sessions.find((row) => row.id === session.id)?.saleIncome).toBe(
      30000
    )
    expect(ledger.list(month).entries.filter((row) => row.dropSaleId)).toHaveLength(1)
    drops.setHuntingSale({ ...input, sold: false })
    expect(drops.list(lot.source).sales).toHaveLength(0)
    expect(drops.list(lot.source).lots.find((row) => row.id === lot.id)?.remaining).toBe(
      lot.quantity
    )
    expect(hunting.list(month).sessions.find((row) => row.id === session.id)?.saleIncome).toBe(0)
    expect(ledger.list(month).entries.filter((row) => row.dropSaleId)).toHaveLength(0)
  })
  it('기존 부분 판매를 전체 판매로 정리하고 실패하면 기존 장부를 유지한다', () => {
    sale({ quantity: 2, grossAmount: 200 })
    sale({ quantity: 3, grossAmount: 300 })
    const original = drops.list(lot.source)
    const input = {
      lotId: lot.id,
      sold: true,
      date: '2026-10-01',
      grossAmount: 1000,
      requestId: randomUUID()
    }
    expect(() => drops.setHuntingSale(input)).toThrow()
    expect(drops.list(lot.source)).toEqual(original)
    const result = drops.setHuntingSale({ ...input, date: '2026-10-15' })!
    expect(result.quantity).toBe(lot.quantity)
    expect(drops.list(lot.source).sales).toHaveLength(1)
    expect(ledger.list(month).entries.filter((row) => row.dropSaleId)).toHaveLength(1)
    expect(hunting.list(month).sessions.find((row) => row.id === session.id)?.saleIncome).toBe(1000)
  })
  it('보스에는 간편 판매 상태를 적용하지 않는다', () => {
    const run = bosses.createRun({
      characterId,
      date: '2026-10-08',
      bossName: '스우',
      difficulty: '노멀',
      partySize: 1
    })
    bosses.setClear({ id: run.id, isCleared: true })
    const bossLot = drops.createLot({
      source: { kind: 'boss', id: run.id },
      requestId: randomUUID(),
      itemName: '장비',
      quantity: 1,
      estimatedUnitPrice: 0,
      notes: ''
    })
    expect(() => drops.setHuntingSale({ lotId: bossLot.id, sold: false })).toThrow('사냥 드랍')
    expect(() => drops.setHuntingSale({ lotId: lot.id, sold: 'true' })).toThrow('판매 상태')
  })
  it('결정석·보스 드랍은 보스 수익, 획득 메소·사냥 드랍은 사냥 수익으로 묶고 지출은 제외한다', () => {
    const huntingSale = sale()
    const run = bosses.createRun({
      characterId,
      date: '2026-10-08',
      bossName: '스우',
      difficulty: '노멀',
      partySize: 1
    })
    const cleared = bosses.setClear({ id: run.id, isCleared: true })
    const bossLot = drops.createLot({
      requestId: randomUUID(),
      source: { kind: 'boss', id: run.id },
      itemName: '보스 드랍',
      quantity: 1,
      estimatedUnitPrice: 0,
      notes: ''
    })
    const bossSale = drops.createSale({
      requestId: randomUUID(),
      lotId: bossLot.id,
      date: '2026-10-15',
      quantity: 1,
      grossAmount: 500,
      feeAmount: 0,
      partySize: 1,
      shareMode: 'equal',
      manualShare: null
    })
    const list = ledger.list(month)
    expect(list.entries.find((entry) => entry.dropSaleId === bossSale.id)?.activity).toBe('boss')
    expect(list.entries.find((entry) => entry.dropSaleId === huntingSale.id)?.activity).toBe(
      'hunting'
    )
    const groups = groupLedgerIncome(list.entries)
    expect(groups).toEqual([
      { activity: 'boss', amount: cleared.settlement!.amount + 500, count: 2 },
      { activity: 'hunting', amount: 1000 + huntingSale.netShare, count: 2 }
    ])
    expect(groups.reduce((sum, group) => sum + group.amount, 0)).toBe(list.summary.income)
    expect(list.summary.expense).toBe(100)
    expect(
      groupLedgerIncome(ledger.list({ from: '2026-10-13', to: '2026-10-13' }).entries)
    ).toEqual([
      { activity: 'boss', amount: 0, count: 0 },
      { activity: 'hunting', amount: huntingSale.netShare, count: 1 }
    ])
    drops.cancelSale(bossSale.id)
    expect(groupLedgerIncome(ledger.list(month).entries)[0]).toEqual({
      activity: 'boss',
      amount: cleared.settlement!.amount,
      count: 1
    })
  })
  function bossBatch(cleared = true) {
    const run = bosses.createRun({
      characterId,
      date: '2026-10-08',
      bossName: '스우',
      difficulty: '익스트림',
      partySize: 2
    })
    if (cleared) bosses.setClear({ id: run.id, isCleared: true })
    return {
      source: { kind: 'boss' as const, id: run.id },
      items: ['루즈 컨트롤 머신 마크', '컴플리트 언더컨트롤'].map((itemName) => ({
        requestId: randomUUID(),
        itemName,
        quantity: 2,
        estimatedUnitPrice: 1000,
        notes: '실제 획득'
      }))
    }
  }
  it('보스 드랍 여러 종류를 수량과 함께 저장하고 판매 후에만 분배 수익을 반영한다', () => {
    const batch = bossBatch(),
      income = ledger.list(month).summary.income
    const lots = drops.createBossLots(batch)
    expect(lots).toHaveLength(2)
    expect(lots.every((row) => row.partySize === 2 && row.quantity === 2)).toBe(true)
    expect(drops.list(batch.source)).toMatchObject({
      boss: { name: '스우', difficulty: '익스트림' },
      summary: { remainingQuantity: 4, estimatedValue: 4000, saleIncome: 0 }
    })
    expect(ledger.list(month).summary.income).toBe(income)
    const sold = drops.createSale({
      requestId: randomUUID(),
      lotId: lots[0].id,
      date: '2026-10-15',
      quantity: 1,
      grossAmount: 1000,
      feeAmount: 100,
      partySize: lots[0].partySize,
      shareMode: 'equal',
      manualShare: null
    })
    expect(sold.netShare).toBe(450)
    expect(ledger.list(month).summary.income).toBe(income + 450)
    expect(drops.list(batch.source).summary.remainingQuantity).toBe(3)
  })
  it('같은 보스 드랍 저장 재시도는 중복을 만들지 않으며 변경된 재시도는 충돌한다', () => {
    const batch = bossBatch()
    const first = drops.createBossLots(batch)
    expect(drops.createBossLots(batch)).toEqual(first)
    expect(() =>
      drops.createBossLots({
        ...batch,
        items: [batch.items[0], { ...batch.items[1], quantity: 3 }]
      })
    ).toThrow('내용이 변경')
    expect(drops.list(batch.source).lots).toHaveLength(2)
  })
  it('뒤쪽 아이템 저장이 실패하면 앞쪽 아이템도 롤백하며 재시도는 모두 저장한다', () => {
    const batch = bossBatch()
    database.exec(
      "CREATE TRIGGER fail_second_drop BEFORE INSERT ON drop_lots WHEN NEW.item_name = '컴플리트 언더컨트롤' BEGIN SELECT RAISE(ABORT, 'forced failure'); END;"
    )
    expect(() => drops.createBossLots(batch)).toThrow('forced failure')
    expect(drops.list(batch.source).lots).toHaveLength(0)
    database.exec('DROP TRIGGER fail_second_drop')
    expect(drops.createBossLots(batch)).toHaveLength(2)
  })
  it('보스 드랍 중복 이름·요청 ID·빈 목록·초과 목록·잘못된 수량을 저장 전에 거부한다', () => {
    const batch = bossBatch()
    const invalid = [
      [],
      Array.from({ length: 21 }, () => batch.items[0]),
      [batch.items[0], { ...batch.items[1], itemName: ` ${batch.items[0].itemName} ` }],
      [batch.items[0], { ...batch.items[1], requestId: batch.items[0].requestId }],
      [batch.items[0], { ...batch.items[1], quantity: 0 }]
    ]
    for (const items of invalid) expect(() => drops.createBossLots({ ...batch, items })).toThrow()
    expect(drops.list(batch.source).lots).toHaveLength(0)
  })
  it('보스 클리어 전과 사냥 출처에는 보스 드랍 일괄 등록을 허용하지 않는다', () => {
    const batch = bossBatch(false)
    expect(() => drops.createBossLots(batch)).toThrow('클리어 체크')
    expect(() => drops.createBossLots({ ...batch, source: lot.source })).toThrow('보스 드랍만')
    expect(drops.list(batch.source).lots).toHaveLength(0)
  })
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'maple-drop-test-'))
    database = openDatabase(join(directory, 'data.sqlite'))
    const chars = new CharacterRepository(database),
      ledgerRepo = new LedgerRepository(database),
      dropRepo = new DropRepository(database)
    const huntRepo = new HuntingRepository(database),
      bossRepo = new BossRepository(database),
      tx = new UnitOfWork(database)
    characterId = new CharacterService(chars).create({ name: '검증캐릭터', world: '루나' }).id
    hunting = new HuntingService(huntRepo, chars, ledgerRepo, tx, dropRepo, clock)
    bosses = new BossService(bossRepo, chars, ledgerRepo, tx, dropRepo, clock)
    drops = new DropService(dropRepo, huntRepo, bossRepo, ledgerRepo, tx, clock)
    ledger = new LedgerService(ledgerRepo)
    session = hunting.create({
      requestId: randomUUID(),
      characterId,
      date: '2026-10-08',
      minutes: 60,
      mesos: 1000,
      cost: 100,
      solFragments: 10,
      nodestones: 2,
      notes: ''
    })
    lot = drops
      .list({ kind: 'hunting', id: session.id })
      .lots.find((row) => row.managedKind === 'sol_fragment')!
  })
  afterEach(() => {
    database.close()
    const target = resolve(directory)
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('maple-drop-test-'))
      throw new Error('Unsafe cleanup')
    rmSync(target, { recursive: true, force: true })
  })
  function sale(overrides: Partial<DropSaleInput> = {}) {
    return drops.createSale({
      requestId: randomUUID(),
      lotId: lot.id,
      date: '2026-10-13',
      quantity: 3,
      grossAmount: 1001,
      feeAmount: 100,
      partySize: 3,
      shareMode: 'equal',
      manualShare: null,
      ...overrides
    })
  }
  const stock = () => drops.list(lot.source).lots.find((row) => row.id === lot.id)!
  it('사냥 조각·젬스톤을 자동 생성하고 예상 단가만 재고 가치에 반영한다', () => {
    expect(drops.list(lot.source).lots).toHaveLength(2)
    drops.updateLot({ ...lot, estimatedUnitPrice: 200 })
    expect(stock().estimatedValue).toBe(2000)
    expect(ledger.list(month).summary.income).toBe(1000)
    expect(() => drops.createLot({ ...lot, requestId: randomUUID() })).toThrow('자동 생성')
  })
  it('부분 판매 수량과 수수료 차감·균등 분배·사냥 시간당 수익을 함께 반영한다', () => {
    const result = sale()
    expect(result.netShare).toBe(300)
    expect(stock().remaining).toBe(7)
    expect(ledger.list(month).entries.find((row) => row.source === 'drop')?.amount).toBe(300)
    expect(hunting.list(month).sessions[0]).toMatchObject({
      saleIncome: 300,
      net: 1200,
      hourlyNet: 1200
    })
  })
  it('사냥 날짜의 활동 수익과 실제 판매일 장부를 구분한다', () => {
    sale()
    expect(hunting.list({ from: '2026-10-08', to: '2026-10-08' }).summary.income).toBe(1300)
    expect(ledger.list({ from: '2026-10-08', to: '2026-10-08' }).summary.income).toBe(1000)
    expect(ledger.list({ from: '2026-10-13', to: '2026-10-13' }).summary.income).toBe(300)
  })
  it('시간 미기록 회차의 판매는 실제 수익에 포함하고 시간당 계산에서 제외한다', () => {
    hunting.update({ ...session, minutes: 0 })
    sale()
    expect(hunting.list(month)).toMatchObject({
      summary: { income: 1300, net: 1200, minutes: 0, hourlyNet: null }
    })
    expect(hunting.list(month).sessions[0].hourlyNet).toBeNull()
  })
  it('캐릭터 월드 변경 후 판매도 획득 당시 월드를 보존한다', () => {
    new CharacterService(new CharacterRepository(database)).update({
      id: characterId,
      name: '검증캐릭터',
      world: '스카니아',
      notes: ''
    })
    hunting.update({ ...session, notes: '월드 이동 후 수정' })
    sale()
    expect(stock().characterWorld).toBe('루나')
    expect(ledger.list(month).entries.find((row) => row.source === 'drop')?.characterWorld).toBe(
      '루나'
    )
  })
  it('직접 입력한 내 몫과 0메소 판매를 처리하며 초과 분배금을 거부한다', () => {
    expect(sale({ shareMode: 'manual', manualShare: 800 }).netShare).toBe(800)
    const free = sale({ quantity: 1, grossAmount: 0, feeAmount: 0 })
    expect(stock().remaining).toBe(6)
    expect(ledger.list(month).entries.some((row) => row.dropSaleId === free.id)).toBe(false)
    expect(() => sale({ shareMode: 'manual', manualShare: 902 })).toThrow('분배금')
    expect(() => sale({ feeAmount: 1002 })).toThrow('수수료')
  })
  it('여러 번 판매한 합계 수량을 검증하고 실패한 판매를 남기지 않는다', () => {
    sale({ quantity: 6 })
    sale({ quantity: 4 })
    expect(stock().remaining).toBe(0)
    expect(() => sale({ quantity: 1 })).toThrow('미판매 수량')
    expect(drops.list(lot.source).sales).toHaveLength(2)
  })
  it('같은 요청 ID 재전송은 중복 수입을 만들지 않고 내용 충돌을 거부한다', () => {
    const created = sale()
    expect(drops.createSale({ ...created, requestId: created.id }).id).toBe(created.id)
    expect(() => drops.createSale({ ...created, quantity: 2, requestId: created.id })).toThrow(
      '변경'
    )
    expect(drops.list(lot.source).sales).toHaveLength(1)
  })
  it('판매 수정은 자기 수량을 다시 사용할 수 있고 거래 ID와 예상 단가 스냅샷을 유지한다', () => {
    drops.updateLot({ ...lot, estimatedUnitPrice: 200 })
    const created = sale({ quantity: 10 })
    const entry = ledger.list(month).entries.find((row) => row.dropSaleId === created.id)!
    const entryCreatedAt = database
      .prepare('SELECT created_at FROM ledger_entries WHERE id = ?')
      .get(entry.id)!.created_at
    drops.updateLot({ ...lot, estimatedUnitPrice: 300 })
    const edited = drops.updateSale({ ...created, quantity: 8, grossAmount: 2000 })
    expect(edited.estimatedUnitPrice).toBe(200)
    expect(stock().remaining).toBe(2)
    expect(ledger.list(month).entries.find((row) => row.dropSaleId === created.id)).toMatchObject({
      id: entry.id,
      amount: 633
    })
    expect(
      database.prepare('SELECT created_at FROM ledger_entries WHERE id = ?').get(entry.id)!
        .created_at
    ).toBe(entryCreatedAt)
    expect(() => drops.updateSale({ ...edited, quantity: 11 })).toThrow('미판매 수량')
  })
  it('판매 취소는 재고를 복구하고 연결 수입만 지운다', () => {
    const created = sale()
    drops.cancelSale(created.id)
    expect(stock().remaining).toBe(10)
    expect(hunting.list(month).sessions[0].net).toBe(900)
    expect(ledger.list(month).entries).toHaveLength(2)
  })
  it('판매된 획득 수량 감소·활동 삭제·활동 날짜 이동을 막고 전체 변경을 롤백한다', () => {
    sale()
    expect(() => hunting.update({ ...session, solFragments: 2, mesos: 999 })).toThrow('판매된 수량')
    expect(hunting.list(month).sessions[0].mesos).toBe(1000)
    expect(() => hunting.update({ ...session, date: '2026-10-09' })).toThrow('판매를 취소')
    expect(() => hunting.remove(session.id)).toThrow('판매를 모두 취소')
    expect(() => drops.removeLot(lot.id)).toThrow('판매를 모두 취소')
  })
  it('사냥 수량 변경으로 미판매 재고를 동기화하고 0수량 묶음을 삭제한다', () => {
    const created = sale()
    hunting.update({ ...session, solFragments: 5 })
    expect(stock().remaining).toBe(2)
    drops.cancelSale(created.id)
    hunting.update({ ...session, solFragments: 0 })
    expect(drops.list(lot.source).lots.some((row) => row.id === lot.id)).toBe(false)
  })
  it('일반 획득 묶음은 중복 요청을 방지하고 미판매 상태에서 삭제할 수 있다', () => {
    const input = {
      source: lot.source,
      requestId: randomUUID(),
      itemName: '추가 아이템',
      quantity: 2,
      estimatedUnitPrice: 50,
      notes: ''
    }
    const custom = drops.createLot(input)
    expect(drops.createLot(input).id).toBe(custom.id)
    expect(() => drops.createLot({ ...input, quantity: 3 })).toThrow('변경')
    drops.removeLot(custom.id)
    expect(drops.list(lot.source).lots).toHaveLength(2)
  })
  it.each([
    { quantity: 0 },
    { quantity: 1.5 },
    { partySize: 0 },
    { partySize: 7 },
    { date: '2026-10-16' },
    { date: '2026-10-07' },
    { grossAmount: -1 }
  ])('판매 검증 실패는 재고와 수입을 변경하지 않는다: %j', (overrides) => {
    expect(() => sale(overrides)).toThrow()
    expect(stock().remaining).toBe(10)
    expect(ledger.list(month).summary.income).toBe(1000)
  })
  it.each(['INSERT', 'UPDATE', 'DELETE'])(
    '장부 %s 실패 시 판매와 재고를 함께 되돌린다',
    (operation) => {
      const created = operation === 'INSERT' ? undefined : sale()
      database.exec(
        `CREATE TRIGGER fail_ledger BEFORE ${operation} ON ledger_entries BEGIN SELECT RAISE(ABORT, 'forced failure'); END`
      )
      expect(() =>
        operation === 'INSERT'
          ? sale()
          : operation === 'UPDATE'
            ? drops.updateSale({ ...created!, grossAmount: 2000 })
            : drops.cancelSale(created!.id)
      ).toThrow('forced failure')
      expect(stock().remaining).toBe(created ? 7 : 10)
      expect(ledger.list(month).summary.income).toBe(created ? 1300 : 1000)
    }
  )
  it('보스 클리어 후 획득한 드랍은 파티 스냅샷을 사용하며 클리어 취소·삭제를 보호한다', () => {
    bosses.createPreset({
      characterId,
      bossName: '스우',
      difficulty: '하드',
      partySize: 3,
      crystalPrice: 100
    })
    const run = bosses.generate({ date: '2026-10-08' }).runs[0]
    const input = {
      source: { kind: 'boss' as const, id: run.id },
      requestId: randomUUID(),
      itemName: '보스 아이템',
      quantity: 2,
      estimatedUnitPrice: 500,
      notes: ''
    }
    expect(() => drops.createLot(input)).toThrow('클리어')
    bosses.setClear({ id: run.id, isCleared: true })
    const custom = drops.createLot(input)
    expect(custom.partySize).toBe(3)
    expect(() => bosses.updateRun({ ...run, bossName: '데미안' })).toThrow('드랍 묶음')
    expect(bosses.list({ date: '2026-10-08' }).runs[0].bossName).toBe('스우')
    const created = sale({ lotId: custom.id, quantity: 1 })
    expect(() => bosses.setClear({ id: run.id, isCleared: false })).toThrow()
    expect(() => bosses.removeRun(run.id)).toThrow('판매를 모두 취소')
    drops.cancelSale(created.id)
    drops.removeLot(custom.id)
    bosses.setClear({ id: run.id, isCleared: false })
    bosses.removeRun(run.id)
  })
  it('취소 후 재고 평가액의 정수 범위 초과도 판매 취소 전체를 되돌린다', () => {
    const created = sale({ quantity: 10 })
    drops.updateLot({ ...lot, estimatedUnitPrice: Number.MAX_SAFE_INTEGER })
    expect(() => drops.cancelSale(created.id)).toThrow()
    expect(stock().remaining).toBe(0)
    expect(ledger.list(month).summary.income).toBe(1300)
  })
  it('판매 금액이 시간당 정수 범위를 초과하면 판매와 장부를 롤백한다', () => {
    hunting.update({ ...session, minutes: 1 })
    expect(() =>
      sale({ grossAmount: Number.MAX_SAFE_INTEGER, feeAmount: 0, partySize: 1 })
    ).toThrow()
    expect(stock().remaining).toBe(10)
  })
  it('3번 버전 DB의 기존 사냥·결정석 거래와 ID를 보존하고 재고를 한 번 생성한다', () => {
    const path = join(directory, 'legacy.sqlite'),
      old = new DatabaseSync(path)
    old.exec('PRAGMA foreign_keys = ON')
    old.exec(charactersSql)
    old.exec(huntingSql)
    old.exec(bossesSql)
    old.exec(
      "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL) STRICT; INSERT INTO schema_migrations VALUES(1,'characters','x'),(2,'hunting','x'),(3,'bosses','x')"
    )
    const chars = new CharacterService(new CharacterRepository(old)),
      char = chars.create({ name: '이전캐릭터', world: '루나' })
    const record = { ...session, id: randomUUID(), characterId: char.id }
    new HuntingRepository(old).insert(record)
    const repo = new LedgerRepository(old)
    repo.syncHunting(record)
    const bossRepo = new BossRepository(old)
    const preset = {
      id: randomUUID(),
      characterId: char.id,
      characterName: char.name,
      characterWorld: char.world,
      bossKey: '스우',
      bossName: '스우',
      difficulty: '노멀',
      partySize: 1,
      crystalPrice: 100,
      createdAt: clock().toISOString(),
      updatedAt: clock().toISOString()
    }
    // Use legacy SQL directly so fixtures do not depend on newer service tables.
    old
      .prepare(
        'INSERT INTO boss_runs(id, character_id, world_snapshot, boss_key, boss_name, difficulty, party_size, crystal_price, period_start, is_cleared, notes, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)'
      )
      .run(
        preset.id,
        char.id,
        char.world,
        '스우',
        '스우',
        '노멀',
        1,
        100,
        '2026-10-08',
        1,
        '',
        preset.createdAt,
        preset.updatedAt
      )
    bossRepo.settle(
      { runId: preset.id, date: '2026-10-13', amount: 100 },
      randomUUID(),
      preset.createdAt
    )
    repo.syncCrystal(bossRepo.find(preset.id)!, preset.createdAt)
    const entries = old.prepare('SELECT * FROM ledger_entries ORDER BY id').all()
    old.close()
    const upgraded = openDatabase(path)
    try {
      expect(
        upgraded
          .prepare('SELECT * FROM ledger_entries ORDER BY id')
          .all()
          .map(({ drop_sale_id: _drop, manual_expense_id: _expense, ...row }) => row)
      ).toEqual(entries)
      expect(
        new DropRepository(upgraded)
          .lots({ kind: 'hunting', id: record.id })
          .map((row) => row.quantity)
          .sort()
      ).toEqual([10, 2])
      expect(upgraded.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      upgraded.close()
    }
    const reopened = openDatabase(path)
    try {
      expect(reopened.prepare('SELECT * FROM drop_lots').all()).toHaveLength(2)
    } finally {
      reopened.close()
    }
  })
})
