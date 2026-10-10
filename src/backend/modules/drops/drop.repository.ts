import { randomUUID } from 'node:crypto'
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite'
import type { DropLot, DropSale, DropSource } from '../../../shared/contracts/drop.contract'
import type { HuntingSession } from '../../../shared/contracts/hunting.contract'
import { AppError } from '../../../shared/errors'
import { sumIntegers } from '../../domain/money'
import { estimatedDropValue } from '../../domain/drop-sale'

type Row = Record<string, SQLOutputValue>
const lotSelect = `SELECT l.*, c.name AS character_name, COALESCE((SELECT SUM(quantity) FROM drop_sales s WHERE s.drop_lot_id = l.id), 0) AS sold_quantity FROM drop_lots l JOIN characters c ON c.id = l.character_id`
function sale(row: Row): DropSale {
  return {
    id: String(row.id),
    lotId: String(row.drop_lot_id),
    date: String(row.sold_on),
    quantity: Number(row.quantity),
    grossAmount: Number(row.gross_amount),
    feeAmount: Number(row.fee_amount),
    partySize: Number(row.party_size),
    shareMode: row.share_mode as 'equal' | 'manual',
    manualShare: row.manual_share === null ? null : Number(row.manual_share),
    netShare: Number(row.net_share),
    estimatedUnitPrice: Number(row.estimated_unit_price),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  }
}
export class DropRepository {
  constructor(private readonly database: DatabaseSync) {}
  private lot(row: Row): DropLot {
    const quantity = Number(row.quantity)
    const soldQuantity = Number(row.sold_quantity)
    const remaining = quantity - soldQuantity
    const estimatedUnitPrice = Number(row.estimated_unit_price)
    const source: DropSource =
      row.hunting_session_id !== null
        ? { kind: 'hunting', id: String(row.hunting_session_id) }
        : { kind: 'boss', id: String(row.boss_run_id) }
    return {
      id: String(row.id),
      source,
      itemName: String(row.item_name),
      quantity,
      estimatedUnitPrice,
      notes: String(row.notes),
      characterId: String(row.character_id),
      characterName: String(row.character_name),
      characterWorld: String(row.world_snapshot),
      acquiredDate: String(row.acquired_on),
      partySize: Number(row.party_size),
      managedKind: row.managed_kind as DropLot['managedKind'],
      soldQuantity,
      remaining,
      estimatedValue: estimatedDropValue(remaining, estimatedUnitPrice),
      saleIncome: sumIntegers(this.salesForLot(String(row.id)).map((item) => item.netShare)),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    }
  }
  lots(source: DropSource): DropLot[] {
    const column = source.kind === 'hunting' ? 'hunting_session_id' : 'boss_run_id'
    return this.database
      .prepare(`${lotSelect} WHERE l.${column} = ? ORDER BY l.created_at, l.id`)
      .all(source.id)
      .map((row) => this.lot(row))
  }
  findLot(id: string): DropLot | undefined {
    const row = this.database.prepare(`${lotSelect} WHERE l.id = ?`).get(id)
    return row ? this.lot(row) : undefined
  }
  saveLot(lot: DropLot): void {
    this.database
      .prepare(
        `INSERT INTO drop_lots (id, hunting_session_id, boss_run_id, character_id, world_snapshot, acquired_on, item_name, managed_kind, quantity, estimated_unit_price, party_size, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET quantity = excluded.quantity, estimated_unit_price = excluded.estimated_unit_price, notes = excluded.notes, updated_at = excluded.updated_at`
      )
      .run(
        lot.id,
        lot.source.kind === 'hunting' ? lot.source.id : null,
        lot.source.kind === 'boss' ? lot.source.id : null,
        lot.characterId,
        lot.characterWorld,
        lot.acquiredDate,
        lot.itemName,
        lot.managedKind,
        lot.quantity,
        lot.estimatedUnitPrice,
        lot.partySize,
        lot.notes,
        lot.createdAt,
        lot.updatedAt
      )
  }
  removeLot(id: string): void {
    this.database.prepare('DELETE FROM drop_lots WHERE id = ?').run(id)
  }
  salesForLot(id: string): DropSale[] {
    return this.database
      .prepare(
        'SELECT * FROM drop_sales WHERE drop_lot_id = ? ORDER BY sold_on DESC, created_at DESC, id'
      )
      .all(id)
      .map(sale)
  }
  findSale(id: string): DropSale | undefined {
    const row = this.database.prepare('SELECT * FROM drop_sales WHERE id = ?').get(id)
    return row ? sale(row) : undefined
  }
  saveSale(s: DropSale): void {
    this.database
      .prepare(
        `INSERT INTO drop_sales (id, drop_lot_id, sold_on, quantity, gross_amount, fee_amount, party_size, share_mode, manual_share, net_share, estimated_unit_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET sold_on = excluded.sold_on, quantity = excluded.quantity, gross_amount = excluded.gross_amount, fee_amount = excluded.fee_amount, party_size = excluded.party_size, share_mode = excluded.share_mode, manual_share = excluded.manual_share, net_share = excluded.net_share, updated_at = excluded.updated_at`
      )
      .run(
        s.id,
        s.lotId,
        s.date,
        s.quantity,
        s.grossAmount,
        s.feeAmount,
        s.partySize,
        s.shareMode,
        s.manualShare,
        s.netShare,
        s.estimatedUnitPrice,
        s.createdAt,
        s.updatedAt
      )
  }
  removeSale(id: string): void {
    this.database.prepare('DELETE FROM drop_sales WHERE id = ?').run(id)
  }
  hasLots(source: DropSource): boolean {
    const column = source.kind === 'hunting' ? 'hunting_session_id' : 'boss_run_id'
    return Boolean(
      this.database.prepare(`SELECT 1 FROM drop_lots WHERE ${column} = ? LIMIT 1`).get(source.id)
    )
  }
  hasSales(source: DropSource): boolean {
    const column = source.kind === 'hunting' ? 'hunting_session_id' : 'boss_run_id'
    return Boolean(
      this.database
        .prepare(
          `SELECT 1 FROM drop_sales s JOIN drop_lots l ON l.id = s.drop_lot_id WHERE l.${column} = ? LIMIT 1`
        )
        .get(source.id)
    )
  }
  huntingIncome(): Map<string, number> {
    const totals = new Map<string, number>()
    for (const row of this.database
      .prepare(
        'SELECT l.hunting_session_id, s.net_share FROM drop_sales s JOIN drop_lots l ON l.id = s.drop_lot_id WHERE l.hunting_session_id IS NOT NULL'
      )
      .all()) {
      const id = String(row.hunting_session_id)
      totals.set(id, sumIntegers([totals.get(id) ?? 0, Number(row.net_share)]))
    }
    return totals
  }
  huntingFragmentSales(): Map<string, { quantity: number; income: number }> {
    const totals = new Map<string, { quantity: number; income: number }>()
    for (const row of this.database
      .prepare(
        `SELECT l.hunting_session_id, s.quantity, s.net_share
         FROM drop_sales s JOIN drop_lots l ON l.id = s.drop_lot_id
         WHERE l.hunting_session_id IS NOT NULL AND l.managed_kind = 'sol_fragment'`
      )
      .all()) {
      const id = String(row.hunting_session_id)
      const current = totals.get(id)
      totals.set(id, {
        quantity: sumIntegers([current?.quantity ?? 0, Number(row.quantity)]),
        income: sumIntegers([current?.income ?? 0, Number(row.net_share)])
      })
    }
    return totals
  }
  syncHunting(session: HuntingSession): void {
    const source: DropSource = { kind: 'hunting', id: session.id }
    const existing = this.lots(source)
    for (const [kind, itemName, quantity] of [
      ['sol_fragment', '솔 에르다 조각', session.solFragments],
      ['nodestone', '코어 젬스톤', session.nodestones]
    ] as const) {
      const lot = existing.find((item) => item.managedKind === kind)
      if (lot && lot.soldQuantity > quantity)
        throw new AppError(
          'INSUFFICIENT_DROP_QUANTITY',
          '판매된 수량보다 획득 수량을 줄일 수 없습니다. 먼저 해당 판매를 수정하거나 취소해 주세요.'
        )
      if (quantity === 0) {
        if (lot) this.removeLot(lot.id)
        continue
      }
      const updated: DropLot = lot
        ? { ...lot, quantity, updatedAt: session.updatedAt }
        : {
            id: randomUUID(),
            source,
            itemName,
            quantity,
            estimatedUnitPrice: 0,
            notes: '',
            characterId: session.characterId,
            characterName: session.characterName,
            characterWorld: session.characterWorld,
            acquiredDate: session.date,
            partySize: 1,
            managedKind: kind,
            soldQuantity: 0,
            remaining: quantity,
            estimatedValue: 0,
            saleIncome: 0,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
          }
      estimatedDropValue(quantity - updated.soldQuantity, updated.estimatedUnitPrice)
      this.saveLot(updated)
    }
    this.database
      .prepare(
        'UPDATE drop_lots SET character_id = ?, world_snapshot = ?, acquired_on = ? WHERE hunting_session_id = ?'
      )
      .run(session.characterId, session.characterWorld, session.date, session.id)
    sumIntegers(this.lots(source).map((lot) => lot.estimatedValue))
  }
}
