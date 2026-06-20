const moneyFmt = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const numFmt = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

const pctFmt = new Intl.NumberFormat("es-MX", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export function money(value: number): string {
  return moneyFmt.format(value);
}

export function num(value: number): string {
  return numFmt.format(value);
}

export function pct(value: number): string {
  return pctFmt.format(value);
}
