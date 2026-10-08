import type { LedgerEntry } from '../../shared/contracts/ledger.contract'
import { AppError } from '../../shared/errors'

// Quoting alone does not stop spreadsheet formula evaluation in user-supplied text.
function cell(value: string | number): string {
  if (typeof value === 'number' && !Number.isSafeInteger(value))
    throw new AppError('VALIDATION_ERROR', 'CSV 금액이 안전한 정수 범위를 벗어났습니다.')
  let text = String(value)
  if (typeof value === 'string' && /^(?:\s*[=+\-@]|[\t\r\n])/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
export function ledgerCsv(entries: LedgerEntry[]): string {
  const headings = [
    '날짜',
    '캐릭터',
    '서버',
    '분류',
    '구분',
    '금액(메소)',
    '순수익 변동(메소)',
    '거래 ID',
    '원본 기록 ID'
  ]
  const lines = [headings.map(cell).join(',')]
  for (const entry of entries) {
    const source =
      entry.source === 'hunting'
        ? entry.direction === 'income'
          ? '사냥 메소'
          : '사냥 비용'
        : entry.source === 'crystal'
          ? '결정석 수익'
          : '드랍 판매'
    lines.push(
      [
        entry.date,
        entry.characterName,
        entry.characterWorld,
        source,
        entry.direction === 'income' ? '수입' : '지출',
        entry.amount,
        entry.direction === 'income' ? entry.amount : -entry.amount,
        entry.id,
        entry.huntingSessionId ?? entry.crystalSettlementId ?? entry.dropSaleId ?? ''
      ]
        .map(cell)
        .join(',')
    )
  }
  const content = '\uFEFF' + lines.join('\r\n') + '\r\n'
  if (Buffer.byteLength(content, 'utf8') > 50 * 1024 * 1024)
    throw new AppError(
      'VALIDATION_ERROR',
      'CSV 파일이 50MB를 초과합니다. 조회 기간이나 캐릭터 범위를 줄여 주세요.'
    )
  return content
}
