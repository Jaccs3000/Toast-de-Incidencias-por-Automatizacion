/**
 * Calculates the percentage of planned minutes already spent.
 * A missing or non-positive plan has no meaningful percentage.
 */
export function getConsumedTimePercentage(plannedMinutes, spentMinutes) {
  const planned = Number(plannedMinutes);
  const spent = Number(spentMinutes);
  if (!Number.isFinite(planned) || planned <= 0 || !Number.isFinite(spent)) {
    return null;
  }

  return (Math.max(0, spent) / planned) * 100;
}
