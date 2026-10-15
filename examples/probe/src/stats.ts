/** Summary of a list of intervals in ms; every field is null when the list is empty. */
export function stats(values: readonly number[]) {
  if (values.length === 0)
    return { count: 0, avg: null, min: null, max: null, median: null, p95: null };
  const sorted = values.slice().sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
  let sum = 0;
  for (const value of sorted) sum += value;
  return {
    count: sorted.length,
    avg: sum / sorted.length,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    median: at(0.5),
    p95: at(0.95),
  };
}
