import type { DatabaseSync } from 'node:sqlite'
import { CharacterRepository } from '../../modules/characters/character.repository'
import { CharacterService } from '../../modules/characters/character.service'

// Valid relational synthetic records only; never open a user's ledger here.
export function seedPerformanceLedger(database: DatabaseSync, count: number): string[] {
  const characters = new CharacterService(new CharacterRepository(database))
  const ids = Array.from(
    { length: 6 },
    (_, index) => characters.create({ name: `측정캐릭터${index}`, world: '루나' }).id
  )
  const hunting = database.prepare(`INSERT INTO hunting_sessions
    (id,character_id,world_snapshot,activity_date,minutes,mesos,cost,sol_fragments,nodestones,notes,created_at,updated_at)
    VALUES (?,?,'루나',?,30,?,0,10,0,'',?,?)`)
  const income = database.prepare(`INSERT INTO manual_incomes
    (id,character_id,world_snapshot,occurred_on,category,amount,notes,created_at,updated_at)
    VALUES (?,?,'루나',?,'기타',?,?,?,?)`)
  const expense = database.prepare(`INSERT INTO manual_expenses
    (id,character_id,world_snapshot,occurred_on,category,amount,notes,created_at,updated_at)
    VALUES (?,?,'루나',?,'강화',?,?,?,?)`)
  const statements = ['hunting_session_id', 'manual_income_id', 'manual_expense_id'].map((column) =>
    database.prepare(`INSERT INTO ledger_entries
      (id,${column},character_id,world_snapshot,occurred_on,direction,amount,created_at,updated_at)
      VALUES (?,?,?,'루나',?,?,?,?,?)`)
  )
  const notes = '가짜 기록의 메모 '.repeat(40)
  database.exec('BEGIN')
  try {
    for (let index = 0; index < count; index++) {
      const id = `synthetic-${String(index).padStart(7, '0')}`
      const character = ids[index % ids.length]
      const date = `2026-10-${String(1 + (index % 28)).padStart(2, '0')}`
      const timestamp = `${date}T12:00:00Z`
      const amount = 100000000 + index
      const kind = index % 3
      if (kind === 0) hunting.run(id, character, date, amount, timestamp, timestamp)
      else
        (kind === 1 ? income : expense).run(
          id,
          character,
          date,
          amount,
          notes,
          timestamp,
          timestamp
        )
      statements[kind].run(
        id,
        id,
        character,
        date,
        kind === 2 ? 'expense' : 'income',
        amount,
        timestamp,
        timestamp
      )
    }
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
  return ids
}
