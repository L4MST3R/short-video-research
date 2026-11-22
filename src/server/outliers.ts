// The outlier score: a video's views over the median views of its channel's
// videos. A channel needs at least MIN_VIDEOS videos before it has one.
export const MIN_VIDEOS = 3;

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Each video's score by id, null while its channel has too few videos or a median of 0. */
export function outlierScores(
  rows: { id: string; channelId: string; views: number }[],
): Map<string, number | null> {
  const byChannel = new Map<string, number[]>();
  for (const row of rows) {
    const list = byChannel.get(row.channelId) ?? [];
    list.push(row.views);
    byChannel.set(row.channelId, list);
  }
  const medians = new Map<string, number | null>();
  for (const [channelId, views] of byChannel) {
    const m = views.length >= MIN_VIDEOS ? median(views) : 0;
    medians.set(channelId, m > 0 ? m : null);
  }
  const scores = new Map<string, number | null>();
  for (const row of rows) {
    const m = medians.get(row.channelId) ?? null;
    scores.set(row.id, m === null ? null : row.views / m);
  }
  return scores;
}
