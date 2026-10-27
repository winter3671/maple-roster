import { createHash, randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { AppError } from '../../../shared/errors'
import { getKstDate, readDate } from '../../../shared/dates'
import { readId, readInteger, readObject } from '../../../shared/validation'
import { potentialCost } from '../../../shared/potential-cost'
import type {
  EnhancementApplied,
  EnhancementPreview
} from '../../../shared/contracts/enhancement.contract'
import type { NexonClient } from '../../integrations/nexon/nexon.client'
import type { CharacterRepository } from '../characters/character.repository'
import type { ExpenseService } from './expense.service'
import { UnitOfWork } from '../../database/unit-of-work'
import { sumIntegers } from '../../domain/money'

type Preview = {
  view: EnhancementPreview
  fingerprint: string
  hashes: Map<string, string[]>
  connections: Map<string, string>
}
export class EnhancementService {
  private pending?: Preview
  private running = false
  constructor(
    private readonly db: DatabaseSync,
    private readonly client: Pick<NexonClient, 'list' | 'potentialHistory'>,
    private readonly characters: CharacterRepository,
    private readonly expenses: ExpenseService,
    private readonly getContext: () => { fingerprint: string; label: string },
    private readonly now = () => new Date()
  ) {}
  private contextMatches(fingerprint: string) {
    if (this.getContext().fingerprint !== fingerprint)
      throw new AppError('REQUEST_CONFLICT', 'API 계정이 변경되었습니다. 다시 조회해 주세요.')
  }
  async preview(value: unknown): Promise<EnhancementPreview> {
    if (this.running) throw new AppError('REQUEST_CONFLICT', '강화 이력을 조회 중입니다.')
    const date = readDate(readObject(value).date)
    const earliest = new Date(this.now())
    earliest.setUTCFullYear(earliest.getUTCFullYear() - 2)
    if (date > getKstDate(this.now()) || date < getKstDate(earliest))
      throw new AppError(
        'VALIDATION_ERROR',
        '강화 이력은 오늘부터 최근 2년 이내의 날짜를 선택해 주세요.'
      )
    this.running = true
    this.pending = undefined
    try {
      const context = this.getContext()
      const account = await this.client.list()
      this.contextMatches(context.fingerprint)
      const characters = this.characters
        .list()
        .filter((row) => row.nexon && account.some((item) => item.ocid === row.nexon!.ocid))
      if (!characters.length)
        throw new AppError(
          'VALIDATION_ERROR',
          '현재 API 계정에 연결된 캐릭터를 먼저 등록해 주세요.'
        )
      const groups = new Map<string, EnhancementPreview['rows'][number]>()
      const hashes = new Map<string, string[]>(),
        seen = new Set<string>(),
        cursors = new Set<string>()
      const imported = this.db.prepare('SELECT 1 FROM enhancement_imports WHERE id=?')
      let cursor: string | undefined,
        alreadyImported = 0,
        excluded = 0
      for (let page = 0; page < 20; page++) {
        const response = await this.client.potentialHistory(date, cursor)
        this.contextMatches(context.fingerprint)
        for (const record of response.records) {
          if (record.date !== date)
            throw new AppError(
              'API_RESPONSE_INVALID',
              '요청 날짜와 다른 강화 이력이 포함되어 있습니다. 다시 조회해 주세요.'
            )
          const hash = createHash('sha256').update(record.id).digest('hex')
          if (seen.has(hash)) continue
          seen.add(hash)
          const matching = characters.filter(
            (row) => row.name.normalize('NFC') === record.characterName.normalize('NFC')
          )
          if (!matching.length) {
            excluded++
            continue
          }
          if (imported.get(hash)) {
            alreadyImported++
            continue
          }
          if (!['잠재능력', '에디셔널 잠재능력'].includes(record.kind)) {
            excluded++
            continue
          }
          const key = JSON.stringify([record.characterName, record.kind])
          let row = groups.get(key)
          if (!row) {
            row = {
              id: randomUUID(),
              characterName: record.characterName,
              characterId: matching.length === 1 ? matching[0].id : null,
              kind: record.kind,
              count: 0,
              amount: 0,
              items: [],
              warning: null
            }
            groups.set(key, row)
            hashes.set(row.id, [])
          }
          hashes.get(row.id)!.push(hash)
          row.count++
          if (!row.items.includes(record.itemName) && row.items.length < 8)
            row.items.push(record.itemName)
          const cost = potentialCost(record)
          row.amount = cost === null || row.amount === null ? null : sumIntegers([row.amount, cost])
          row.warning =
            [
              row.amount === null
                ? '비용을 계산할 수 없는 이력이 있습니다. 실제 지출 총액을 직접 입력해 주세요.'
                : '',
              !row.characterId
                ? '같은 이름의 캐릭터가 여러 월드에 있어 이력을 구분할 수 없습니다. 해당 날짜에 한 캐릭터에서만 강화한 경우에만 선택하세요. 여러 월드에서 강화했다면 수동으로 나누어 기록해 주세요.'
                : ''
            ]
              .filter(Boolean)
              .join(' ') || null
        }
        if (!response.nextCursor) break
        if (page === 19 || cursors.has(response.nextCursor))
          throw new AppError(
            'API_RESPONSE_INVALID',
            '이력이 너무 많거나 페이지 조회가 반복됩니다. 저장하지 않았습니다. 다시 조회해 주세요.'
          )
        cursors.add(response.nextCursor)
        cursor = response.nextCursor
      }
      const view: EnhancementPreview = {
        id: randomUUID(),
        date,
        expiresAt: new Date(this.now().getTime() + 15 * 60000).toISOString(),
        accountLabel: context.label,
        characters: characters.map(({ id, name, world }) => ({ id, name, world })),
        rows: [...groups.values()],
        alreadyImported,
        excluded
      }
      this.pending = {
        view,
        fingerprint: context.fingerprint,
        hashes,
        connections: new Map(characters.map((row) => [row.id, row.nexon!.ocid]))
      }
      return view
    } finally {
      this.running = false
    }
  }
  apply(value: unknown): EnhancementApplied {
    const raw = readObject(value),
      id = readId(raw.previewId),
      preview = this.pending
    if (!preview || preview.view.id !== id || preview.view.expiresAt <= this.now().toISOString())
      throw new AppError(
        'REQUEST_CONFLICT',
        '조회 결과가 만료되었거나 변경되었습니다. 다시 조회해 주세요.'
      )
    this.contextMatches(preview.fingerprint)
    if (raw.confirmed !== true)
      throw new AppError(
        'VALIDATION_ERROR',
        '기존 수동 지출과 중복 여부 및 실제 비용을 확인해 주세요.'
      )
    if (!Array.isArray(raw.rows) || !raw.rows.length || raw.rows.length > preview.view.rows.length)
      throw new AppError('VALIDATION_ERROR', '반영할 강화 지출을 선택해 주세요.')
    const selected = raw.rows.map((value) => {
      const input = readObject(value),
        row = preview.view.rows.find((row) => row.id === readId(input.id))
      const characterId = readId(input.characterId),
        amount = readInteger(input.amount, '강화 지출 금액')
      const character = this.characters.find(characterId)
      if (
        !row ||
        !character?.nexon ||
        preview.connections.get(characterId) !== character.nexon.ocid ||
        !preview.view.characters.some(
          (c) => c.id === characterId && c.name === character.name && c.world === character.world
        )
      )
        throw new AppError(
          'REQUEST_CONFLICT',
          '캐릭터 연결 정보가 변경되었습니다. 다시 조회해 주세요.'
        )
      if (character.name.normalize('NFC') !== row.characterName.normalize('NFC') || amount === 0)
        throw new AppError(
          'VALIDATION_ERROR',
          '해당 이름의 캐릭터와 실제 지출 금액을 확인해 주세요.'
        )
      return { row, characterId, amount }
    })
    if (new Set(selected.map(({ row }) => row.id)).size !== selected.length)
      throw new AppError('VALIDATION_ERROR', '같은 항목을 중복 반영할 수 없습니다.')
    const total = sumIntegers(selected.map((item) => item.amount))
    const result = new UnitOfWork(this.db).run(() => {
      let records = 0
      const imported = this.db.prepare('SELECT 1 FROM enhancement_imports WHERE id=?')
      const link = this.db.prepare('INSERT INTO enhancement_imports (id, expense_id) VALUES (?, ?)')
      for (const { row, characterId, amount } of selected) {
        const hashes = preview.hashes.get(row.id)!
        if (hashes.some((hash) => imported.get(hash)))
          throw new AppError('REQUEST_CONFLICT', '이미 반영한 이력이 있습니다. 다시 조회해 주세요.')
        const expense = this.expenses.createInTransaction({
          requestId: randomUUID(),
          characterId,
          date: preview.view.date,
          category: '강화',
          amount,
          notes: `API 강화 가져오기 · ${row.kind} ${row.count}회 · 사용자 확인 금액`
        })
        for (const hash of hashes) link.run(hash, expense.id)
        records += hashes.length
      }
      return { expenses: selected.length, records, amount: total }
    })
    this.pending = undefined
    return result
  }
}
