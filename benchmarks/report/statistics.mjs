export function summarize(values) {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    Array.from(values).some((value) => !Number.isFinite(value))
  ) {
    throw new TypeError('Expected a nonempty array of finite numbers');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    median: sorted.length % 2 ? sorted[middle] : sorted[middle - 1] / 2 + sorted[middle] / 2,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    min: sorted[0],
    max: sorted.at(-1),
  };
}
