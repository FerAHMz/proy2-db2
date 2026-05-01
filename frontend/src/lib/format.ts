const moneyFmt = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

const numFmt = new Intl.NumberFormat('es-GT')

export const fmtMoney = (n: number | null | undefined): string =>
  n == null ? '—' : moneyFmt.format(n)

export const fmtNum = (n: number | null | undefined): string =>
  n == null ? '—' : numFmt.format(n)

export const fmtScore = (n: number | null | undefined): string =>
  n == null ? '—' : n.toFixed(3)

export const truncate = (s: string, n: number): string =>
  s.length > n ? s.slice(0, n - 1) + '…' : s
