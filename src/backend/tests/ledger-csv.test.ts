import { describe, expect, it } from 'vitest'
import { ledgerCsv } from '../domain/ledger-csv'
import type { LedgerEntry } from '../../shared/contracts/ledger.contract'

const row: LedgerEntry = {
  id: 'transaction-id',
  huntingSessionId: 'activity-id',
  crystalSettlementId: null,
  dropSaleId: null,
  source: 'hunting',
  activity: 'hunting',
  characterId: 'character-id',
  characterName: '캐릭터',
  characterWorld: '루나',
  date: '2026-10-08',
  direction: 'income',
  amount: 123456789
}
describe('거래 내역 CSV 형식', () => {
  it('BOM·CRLF와 고정 열을 포함하고 금액을 원래 정수 그대로 기록한다', () => {
    const content = ledgerCsv([
      row,
      { ...row, id: 'expense-id', direction: 'expense', amount: 1000 }
    ])
    expect(content.charCodeAt(0)).toBe(0xfeff)
    expect(content).toContain(
      '"2026-10-08","캐릭터","루나","사냥 메소","수입","123456789","123456789","transaction-id","activity-id","","","",""\r\n'
    )
    expect(content).toContain('"사냥 비용","지출","1000","-1000"')
    expect(content).not.toContain('123,456,789')
    expect(content).not.toContain("'-1000")
    expect(content).toMatch(/\r\n$/)
  })
  it('쉼표·따옴표·줄바꿈을 따옴표 안에 보존한다', () => {
    expect(ledgerCsv([{ ...row, characterName: '쉼표, "따옴표"\n두번째줄' }])).toContain(
      '"쉼표, ""따옴표""\n두번째줄"'
    )
  })
  it.each(['=1+1', '+SUM(1,2)', '-1+2', '@SUM(A1)', ' =HYPERLINK("fake")', '\t=1', '\r=1'])(
    '사용자 텍스트 %s를 수식으로 해석하지 않도록 보호한다',
    (name) => {
      expect(ledgerCsv([{ ...row, characterName: name }])).toContain(
        `"'${name.replaceAll('"', '""')}"`
      )
    }
  )
  it('결정과 드랍의 분류·원본 ID를 출력한다', () => {
    const content = ledgerCsv([
      { ...row, source: 'crystal', huntingSessionId: null, crystalSettlementId: 'crystal-id' },
      { ...row, source: 'drop', huntingSessionId: null, dropSaleId: 'sale-id' }
    ])
    expect(content).toContain('"결정 수익","수입"')
    expect(content).toContain('"transaction-id","crystal-id"')
    expect(content).toContain('"드랍 판매","수입"')
    expect(content).toContain('"transaction-id","sale-id"')
  })
  it('빈 조회는 헤더만 출력하고 큰 정수는 자릿수를 바꾸지 않는다', () => {
    expect(ledgerCsv([]).split('\r\n')).toHaveLength(2)
    expect(ledgerCsv([{ ...row, amount: Number.MAX_SAFE_INTEGER }])).toContain(
      '"9007199254740991","9007199254740991"'
    )
    expect(() => ledgerCsv([{ ...row, amount: Number.MAX_SAFE_INTEGER + 1 }])).toThrow('정수')
  })
})
