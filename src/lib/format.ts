export function price(n: number) {
  return n.toFixed(2);
}

export function size(n: number) {
  // Thousands separator keeps the order-book columns scannable.
  return Math.round(n).toLocaleString('en-US');
}

export function clockTime(ts: number) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
