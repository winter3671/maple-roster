import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { CrystalPriceEntry } from '../../../shared/contracts/crystal-price.contract'
import { BUILTIN_CRYSTAL_HISTORY } from '../../../shared/crystal-prices'
import { getKstDate, readDate } from '../../../shared/dates'
import { readId, readInteger, readObject, readText } from '../../../shared/validation'
import { validateBossSelection } from '../../../shared/boss-catalog'
import { AppError } from '../../../shared/errors'

export class CrystalPriceService {
  constructor(
    private readonly db: DatabaseSync,
    private readonly now = () => new Date()
  ) {}
  custom(): CrystalPriceEntry[] {
    return this.db
      .prepare(
        'SELECT * FROM crystal_price_history ORDER BY effective_on DESC, boss_name, difficulty'
      )
      .all()
      .map((row) => ({
        id: String(row.id),
        bossName: String(row.boss_name),
        difficulty: String(row.difficulty),
        amount: Number(row.amount),
        effectiveOn: String(row.effective_on),
        checkedOn: String(row.checked_on),
        source: String(row.source),
        isCustom: true
      }))
  }
  list(): CrystalPriceEntry[] {
    return [...this.custom(), ...BUILTIN_CRYSTAL_HISTORY].sort(
      (a, b) =>
        b.effectiveOn.localeCompare(a.effectiveOn) || a.bossName.localeCompare(b.bossName, 'ko')
    )
  }
  save(value: unknown): CrystalPriceEntry[] {
    const input = readObject(value),
      bossName = readText(input.bossName, '보스', 60),
      difficulty = readText(input.difficulty, '난이도', 40)
    validateBossSelection(bossName, difficulty)
    const amount = readInteger(input.amount, '1인 결정 가격'),
      effectiveOn = readDate(input.effectiveOn),
      checkedOn = readDate(input.checkedOn),
      source = readText(input.source, '출처', 300)
    if (amount === 0) throw new AppError('VALIDATION_ERROR', '결정 가격은 1메소 이상이어야 합니다.')
    if (checkedOn > getKstDate(this.now()))
      throw new AppError('VALIDATION_ERROR', '확인일은 오늘 이후일 수 없습니다.')
    if (
      this.custom().length >= 5000 &&
      !this.db
        .prepare(
          'SELECT id FROM crystal_price_history WHERE boss_name=? AND difficulty=? AND effective_on=?'
        )
        .get(bossName, difficulty, effectiveOn)
    )
      throw new AppError('VALIDATION_ERROR', '수동 가격표는 최대 5,000개까지 저장할 수 있습니다.')
    this.db
      .prepare(
        'INSERT INTO crystal_price_history(id,boss_name,difficulty,amount,effective_on,checked_on,source) VALUES(?,?,?,?,?,?,?) ON CONFLICT(boss_name,difficulty,effective_on) DO UPDATE SET amount=excluded.amount,checked_on=excluded.checked_on,source=excluded.source'
      )
      .run(randomUUID(), bossName, difficulty, amount, effectiveOn, checkedOn, source)
    return this.list()
  }
  remove(value: unknown): CrystalPriceEntry[] {
    const id = readId(value)
    if (this.db.prepare('DELETE FROM crystal_price_history WHERE id=?').run(id).changes === 0)
      throw new AppError('VALIDATION_ERROR', '수동 가격표를 찾을 수 없습니다.')
    return this.list()
  }
}
