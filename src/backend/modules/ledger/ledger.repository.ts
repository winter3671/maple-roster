import type { Expense } from '../../../shared/contracts/expense.contract'
import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { HuntingSession } from '../../../shared/contracts/hunting.contract'
import type { LedgerEntry, RecordQuery } from '../../../shared/contracts/ledger.contract'
import type { BossRun } from '../../../shared/contracts/boss.contract'
import type { DropLot, DropSale } from '../../../shared/contracts/drop.contract'

export class LedgerRepository {
  constructor(private readonly database: DatabaseSync) {}

  syncExpense(expense: Expense): void {
    this.database
      .prepare(
        `INSERT INTO ledger_entries (id, manual_expense_id, character_id, world_snapshot, occurred_on, direction, amount, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'expense', ?, ?, ?) ON CONFLICT(manual_expense_id) DO UPDATE SET character_id=excluded.character_id,
      world_snapshot=excluded.world_snapshot, occurred_on=excluded.occurred_on, amount=excluded.amount, updated_at=excluded.updated_at`
      )
      .run(
        randomUUID(),
        expense.id,
        expense.characterId,
        expense.characterWorld,
        expense.date,
        expense.amount,
        expense.createdAt,
        expense.updatedAt
      )
  }

  syncHunting(session: HuntingSession): void {
    for (const [direction, amount] of [
      ['income', session.mesos],
      ['expense', session.cost]
    ] as const) {
      if (amount === 0) {
        this.database
          .prepare('DELETE FROM ledger_entries WHERE hunting_session_id = ? AND direction = ?')
          .run(session.id, direction)
      } else {
        this.database
          .prepare(
            `INSERT INTO ledger_entries (id, hunting_session_id, character_id, world_snapshot, occurred_on, direction, amount, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(hunting_session_id, direction) DO UPDATE SET character_id = excluded.character_id, world_snapshot = excluded.world_snapshot, occurred_on = excluded.occurred_on, amount = excluded.amount, updated_at = excluded.updated_at`
          )
          .run(
            randomUUID(),
            session.id,
            session.characterId,
            session.characterWorld,
            session.date,
            direction,
            amount,
            session.createdAt,
            session.updatedAt
          )
      }
    }
  }

  list(query: RecordQuery): LedgerEntry[] {
    return this.database
      .prepare(
        `SELECT e.*, c.name AS character_name, dl.boss_run_id AS drop_boss_run_id, me.category AS expense_category, me.notes AS expense_notes
      FROM ledger_entries e JOIN characters c ON c.id = e.character_id
      LEFT JOIN manual_expenses me ON me.id = e.manual_expense_id
      LEFT JOIN drop_sales ds ON ds.id = e.drop_sale_id
      LEFT JOIN drop_lots dl ON dl.id = ds.drop_lot_id
      WHERE e.occurred_on BETWEEN ? AND ? ${query.characterId ? 'AND e.character_id = ?' : ''} ORDER BY e.occurred_on DESC, e.created_at DESC, e.id`
      )
      .all(query.from, query.to, ...(query.characterId ? [query.characterId] : []))
      .map((row) => ({
        id: String(row.id),
        manualExpenseId: row.manual_expense_id == null ? null : String(row.manual_expense_id),
        expenseCategory: row.expense_category == null ? undefined : String(row.expense_category),
        notes: row.expense_notes == null ? '' : String(row.expense_notes),
        activity:
          row.manual_expense_id != null
            ? 'expense'
            : row.crystal_settlement_id !== null || row.drop_boss_run_id != null
              ? 'boss'
              : 'hunting',
        huntingSessionId: row.hunting_session_id === null ? null : String(row.hunting_session_id),
        crystalSettlementId:
          row.crystal_settlement_id === null ? null : String(row.crystal_settlement_id),
        dropSaleId: row.drop_sale_id == null ? null : String(row.drop_sale_id),
        source:
          row.manual_expense_id != null
            ? 'manual'
            : row.drop_sale_id != null
              ? 'drop'
              : row.crystal_settlement_id === null
                ? 'hunting'
                : 'crystal',
        characterId: String(row.character_id),
        characterName: String(row.character_name),
        characterWorld: String(row.world_snapshot),
        date: String(row.occurred_on),
        direction: row.direction as 'income' | 'expense',
        amount: Number(row.amount)
      }))
  }
  syncCrystal(run: BossRun, timestamp: string): void {
    const settlement = run.settlement!
    if (settlement.amount === 0) {
      this.database
        .prepare('DELETE FROM ledger_entries WHERE crystal_settlement_id = ?')
        .run(settlement.id)
      return
    }
    this.database
      .prepare(
        `INSERT INTO ledger_entries (id, crystal_settlement_id, character_id, world_snapshot, occurred_on, direction, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'income', ?, ?, ?) ON CONFLICT(crystal_settlement_id) DO UPDATE SET occurred_on = excluded.occurred_on, amount = excluded.amount, updated_at = excluded.updated_at`
      )
      .run(
        randomUUID(),
        settlement.id,
        run.characterId,
        run.characterWorld,
        settlement.date,
        settlement.amount,
        timestamp,
        timestamp
      )
  }
  syncDrop(lot: DropLot, sale: DropSale): void {
    if (sale.netShare === 0) {
      this.database.prepare('DELETE FROM ledger_entries WHERE drop_sale_id = ?').run(sale.id)
      return
    }
    this.database
      .prepare(
        `INSERT INTO ledger_entries (id, drop_sale_id, character_id, world_snapshot, occurred_on, direction, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'income', ?, ?, ?) ON CONFLICT(drop_sale_id) DO UPDATE SET occurred_on = excluded.occurred_on, amount = excluded.amount, updated_at = excluded.updated_at`
      )
      .run(
        randomUUID(),
        sale.id,
        lot.characterId,
        lot.characterWorld,
        sale.date,
        sale.netShare,
        sale.createdAt,
        sale.updatedAt
      )
  }
}
