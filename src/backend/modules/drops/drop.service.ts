import {
  parseDropLot,
  parseDropSale,
  parseDropSource,
  positiveQuantity,
  type DropList,
  type DropLot,
  type DropSale,
  type DropSource
} from '../../../shared/contracts/drop.contract'
import { readId, readInteger, readObject, readText } from '../../../shared/validation'
import { getKstDate } from '../../../shared/dates'
import { AppError } from '../../../shared/errors'
import { UnitOfWork } from '../../database/unit-of-work'
import { dropShare, estimatedDropValue } from '../../domain/drop-sale'
import { sumIntegers, hourlyProfit } from '../../domain/money'
import { HuntingRepository } from '../hunting/hunting.repository'
import { BossRepository } from '../bosses/boss.repository'
import { LedgerRepository } from '../ledger/ledger.repository'
import { DropRepository } from './drop.repository'

export class DropService {
  constructor(
    private readonly repository: DropRepository,
    private readonly hunting: HuntingRepository,
    private readonly bosses: BossRepository,
    private readonly ledger: LedgerRepository,
    private readonly transaction: UnitOfWork,
    private readonly now = () => new Date()
  ) {}
  list(value: unknown): DropList {
    const source = parseDropSource(value)
    this.parent(source)
    const lots = this.repository.lots(source)
    return {
      lots,
      sales: lots.flatMap((lot) => this.repository.salesForLot(lot.id)),
      summary: {
        remainingQuantity: sumIntegers(lots.map((lot) => lot.remaining)),
        estimatedValue: sumIntegers(lots.map((lot) => lot.estimatedValue)),
        saleIncome: sumIntegers(lots.map((lot) => lot.saleIncome))
      }
    }
  }
  createLot(value: unknown): DropLot {
    const raw = readObject(value)
    const input = parseDropLot(raw)
    const id = readId(raw.requestId)
    return this.transaction.run(() => {
      const existing = this.repository.findLot(id)
      if (existing) {
        if (
          existing.source.kind === input.source.kind &&
          existing.source.id === input.source.id &&
          existing.itemName === input.itemName &&
          existing.quantity === input.quantity &&
          existing.estimatedUnitPrice === input.estimatedUnitPrice &&
          existing.notes === input.notes
        )
          return existing
        throw new AppError(
          'REQUEST_CONFLICT',
          '같은 획득 요청의 내용이 변경되었습니다. 다시 확인해 주세요.'
        )
      }
      const parent = this.parent(input.source)
      if (
        input.source.kind === 'hunting' &&
        ['솔 에르다 조각', '코어 젬스톤'].includes(input.itemName)
      )
        throw new AppError(
          'VALIDATION_ERROR',
          '조각·젬스톤 수량은 사냥 회차에서 입력하고 자동 생성된 묶음을 사용해 주세요.'
        )
      if (input.source.kind === 'boss' && !this.bosses.find(input.source.id)!.isCleared)
        throw new AppError('VALIDATION_ERROR', '보스 클리어 체크 후 드랍을 추가해 주세요.')
      const timestamp = this.now().toISOString()
      const lot: DropLot = {
        ...input,
        ...parent,
        id,
        managedKind: null,
        soldQuantity: 0,
        remaining: input.quantity,
        estimatedValue: estimatedDropValue(input.quantity, input.estimatedUnitPrice),
        saleIncome: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      }
      this.repository.saveLot(lot)
      this.list(lot.source)
      return lot
    })
  }
  updateLot(value: unknown): DropLot {
    const raw = readObject(value)
    const id = readId(raw.id)
    return this.transaction.run(() => {
      const current = this.findLot(id)
      const quantity = positiveQuantity(raw.quantity)
      if (current.managedKind && quantity !== current.quantity)
        throw new AppError(
          'VALIDATION_ERROR',
          '조각·젬스톤의 획득 수량은 사냥 회차에서 수정해 주세요.'
        )
      if (quantity < current.soldQuantity)
        throw new AppError(
          'INSUFFICIENT_DROP_QUANTITY',
          '판매된 수량보다 획득 수량을 줄일 수 없습니다.'
        )
      const estimatedUnitPrice = readInteger(raw.estimatedUnitPrice, '예상 단가')
      const lot = {
        ...current,
        quantity,
        estimatedUnitPrice,
        notes: readText(raw.notes ?? '', '메모', 500, false, true),
        updatedAt: this.now().toISOString()
      }
      estimatedDropValue(quantity - current.soldQuantity, estimatedUnitPrice)
      this.repository.saveLot(lot)
      this.list(lot.source)
      return this.findLot(id)
    })
  }
  removeLot(value: unknown): null {
    const id = readId(value)
    return this.transaction.run(() => {
      const lot = this.findLot(id)
      if (this.repository.salesForLot(id).length)
        throw new AppError('DROP_IN_USE', '판매를 모두 취소한 뒤 획득 묶음을 삭제해 주세요.')
      if (lot.managedKind)
        throw new AppError(
          'VALIDATION_ERROR',
          '조각·젬스톤은 사냥 회차의 획득 수량을 0으로 수정해 주세요.'
        )
      this.repository.removeLot(id)
      return null
    })
  }
  createSale(value: unknown): DropSale {
    const raw = readObject(value)
    const input = parseDropSale(raw, getKstDate(this.now()))
    const id = readId(raw.requestId)
    return this.transaction.run(() => {
      const existing = this.repository.findSale(id)
      if (existing) {
        if (
          Object.entries(input).every(
            ([key, field]) => existing[key as keyof typeof input] === field
          )
        )
          return existing
        throw new AppError(
          'REQUEST_CONFLICT',
          '같은 판매 요청의 내용이 변경되었습니다. 다시 확인해 주세요.'
        )
      }
      return this.saveSale(input, id)
    })
  }
  updateSale(value: unknown): DropSale {
    const raw = readObject(value)
    const input = parseDropSale(raw, getKstDate(this.now()))
    const id = readId(raw.id)
    return this.transaction.run(() => {
      const current = this.findSale(id)
      if (input.lotId !== current.lotId)
        throw new AppError('VALIDATION_ERROR', '판매의 획득 묶음은 바꿀 수 없습니다.')
      return this.saveSale(input, id, current)
    })
  }
  cancelSale(value: unknown): null {
    const id = readId(value)
    return this.transaction.run(() => {
      const sale = this.findSale(id)
      const source = this.findLot(sale.lotId).source
      this.repository.removeSale(id)
      this.list(source)
      if (source.kind === 'hunting') {
        const session = this.hunting.find(source.id)!
        const income = this.repository.huntingIncome().get(session.id) ?? 0
        hourlyProfit(sumIntegers([session.mesos, income, -session.cost]), session.minutes)
      }
      return null
    })
  }
  private saveSale(
    input: ReturnType<typeof parseDropSale>,
    id: string,
    current?: DropSale
  ): DropSale {
    const lot = this.findLot(input.lotId)
    if (input.date < lot.acquiredDate)
      throw new AppError('VALIDATION_ERROR', '판매일은 획득일보다 빠를 수 없습니다.')
    if (input.quantity > lot.remaining + (current?.quantity ?? 0))
      throw new AppError('INSUFFICIENT_DROP_QUANTITY', '미판매 수량을 초과해 판매할 수 없습니다.')
    const timestamp = this.now().toISOString()
    const sale: DropSale = {
      ...input,
      id,
      netShare: dropShare(input),
      estimatedUnitPrice: current?.estimatedUnitPrice ?? lot.estimatedUnitPrice,
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp
    }
    this.repository.saveSale(sale)
    this.ledger.syncDrop(lot, sale)
    // Guard aggregate bounds before committing, including hunting hourly calculations.
    this.list(lot.source)
    if (lot.source.kind === 'hunting') {
      const session = this.hunting.find(lot.source.id)!
      const income = this.repository.huntingIncome().get(session.id) ?? 0
      const net = sumIntegers([session.mesos, income, -session.cost])
      hourlyProfit(net, session.minutes)
    }
    return sale
  }
  private parent(source: DropSource) {
    const record =
      source.kind === 'hunting' ? this.hunting.find(source.id) : this.bosses.find(source.id)
    if (!record) throw new AppError('DROP_NOT_FOUND', '드랍의 원본 활동을 찾을 수 없습니다.')
    return {
      characterId: record.characterId,
      characterName: record.characterName,
      characterWorld: record.characterWorld,
      acquiredDate: 'date' in record ? record.date : record.week,
      partySize: 'partySize' in record ? record.partySize : 1
    }
  }
  private findLot(id: string): DropLot {
    const lot = this.repository.findLot(id)
    if (!lot)
      throw new AppError('DROP_NOT_FOUND', '획득 묶음을 찾을 수 없습니다. 새로고침해 주세요.')
    return lot
  }
  private findSale(id: string): DropSale {
    const sale = this.repository.findSale(id)
    if (!sale)
      throw new AppError('DROP_NOT_FOUND', '판매 기록을 찾을 수 없습니다. 새로고침해 주세요.')
    return sale
  }
}
