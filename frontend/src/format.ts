// Indian number conventions: lakh (1e5), crore (1e7), lakh crore (1e12).

const IN = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const IN1 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
const IN2 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export function money(x: number | null | undefined, cur = "₹"): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "–";
  const sign = x < 0 ? "−" : "";
  const a = Math.abs(x);
  if (a >= 1e12) return `${sign}${cur}${IN2.format(a / 1e12)} lakh cr`;
  if (a >= 1e7) return `${sign}${cur}${IN2.format(a / 1e7)} cr`;
  if (a >= 1e5) return `${sign}${cur}${IN2.format(a / 1e5)} lakh`;
  return `${sign}${cur}${IN.format(a)}`;
}

export function rupees(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "–";
  return `${x < 0 ? "−" : ""}₹${IN.format(Math.abs(x))}`;
}

export function people(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "–";
  if (x >= 1e7) return `${IN2.format(x / 1e7)} crore`;
  if (x >= 1e5) return `${IN1.format(x / 1e5)} lakh`;
  return IN.format(x);
}

export function pct(x: number | null | undefined, digits = 1): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "–";
  return `${(x * 100).toFixed(digits)}%`;
}

export function num(x: number | null | undefined, digits = 3): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "–";
  return x.toFixed(digits);
}

export function signed(text: string, x: number): string {
  return x > 0 ? `+${text}` : text;
}

export function shortMoney(x: number): string {
  const a = Math.abs(x);
  const s = x < 0 ? "−" : "";
  if (a >= 1e7) return `${s}${IN1.format(a / 1e7)}Cr`;
  if (a >= 1e5) return `${s}${IN1.format(a / 1e5)}L`;
  if (a >= 1e3) return `${s}${IN1.format(a / 1e3)}k`;
  return `${s}${IN.format(a)}`;
}

export function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
