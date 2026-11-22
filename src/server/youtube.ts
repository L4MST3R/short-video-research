import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { channels, videos } from "@/db/schema";

const API = "https://www.googleapis.com/youtube/v3";
// Shorts are at most three minutes long.
const SHORT_MAX_SECONDS = 180;
// Channels synced per scheduled run, oldest sync first.
const SCHEDULED_BATCH = 40;

type Fetch = typeof fetch;

async function call<T>(path: string, params: Record<string, string>, key: string, fetcher: Fetch): Promise<T> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);
  const response = await fetcher(url, { signal: AbortSignal.timeout(15_000) });
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!response.ok) throw new Error(`YouTube answered ${response.status}${body?.error?.message ? `: ${body.error.message}` : ""}`);
  return body as T;
}

/** "PT1M5S" as 65. */
export function durationSeconds(iso: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return Number.POSITIVE_INFINITY;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return d! * 86400 + h! * 3600 + min! * 60 + s!;
}

/**
 * Fetches the channel's recent uploads, keeps the shorts and upserts them
 * by YouTube id. Records the sync time, or the error, on the channel.
 */
export async function syncYoutubeChannel(
  channel: { id: string; userId: string; workspaceId: string; handle: string; externalId: string | null },
  key: string,
  fetcher: Fetch = fetch,
): Promise<void> {
  try {
    const found = await call<{ items?: { id: string; contentDetails: { relatedPlaylists: { uploads: string } } }[] }>(
      "channels",
      channel.externalId ? { part: "contentDetails", id: channel.externalId } : { part: "contentDetails", forHandle: channel.handle },
      key,
      fetcher,
    );
    const item = found.items?.[0];
    if (!item) throw new Error(`No YouTube channel is called ${channel.handle}`);
    const uploads = await call<{ items?: { contentDetails: { videoId: string } }[] }>(
      "playlistItems",
      { part: "contentDetails", playlistId: item.contentDetails.relatedPlaylists.uploads, maxResults: "50" },
      key,
      fetcher,
    );
    const ids = (uploads.items ?? []).map((i) => i.contentDetails.videoId);
    const details = ids.length
      ? await call<{
          items?: {
            id: string;
            snippet: { title: string; publishedAt: string };
            statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
            contentDetails: { duration: string };
          }[];
        }>("videos", { part: "snippet,statistics,contentDetails", id: ids.join(",") }, key, fetcher)
      : { items: [] };
    const shorts = (details.items ?? []).filter((v) => durationSeconds(v.contentDetails.duration) <= SHORT_MAX_SECONDS);
    const writes = shorts.map((v) => {
      const stats = {
        title: v.snippet.title,
        views: Number(v.statistics.viewCount ?? 0),
        likes: Number(v.statistics.likeCount ?? 0),
        comments: Number(v.statistics.commentCount ?? 0),
        postedAt: v.snippet.publishedAt,
      };
      return db
        .insert(videos)
        .values({
          id: crypto.randomUUID(),
          userId: channel.userId,
          channelId: channel.id,
          workspaceId: channel.workspaceId,
          externalId: v.id,
          url: `https://www.youtube.com/shorts/${v.id}`,
          ...stats,
        })
        .onConflictDoUpdate({ target: [videos.channelId, videos.externalId], set: stats });
    });
    const done = db
      .update(channels)
      .set({ externalId: item.id, lastSyncedAt: new Date().toISOString(), syncError: null })
      .where(eq(channels.id, channel.id));
    await db.batch([done, ...writes]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(channels).set({ syncError: message.slice(0, 300) }).where(eq(channels.id, channel.id));
  }
}

const syncFields = {
  id: channels.id,
  userId: channels.userId,
  workspaceId: channels.workspaceId,
  handle: channels.handle,
  externalId: channels.externalId,
};

/** Syncs one of the user's YouTube channels now. */
export async function syncChannelForUser(userId: string, channelId: string, key: string) {
  const [channel] = await db
    .select(syncFields)
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.userId, userId), eq(channels.platform, "youtube")));
  if (!channel) return null;
  await syncYoutubeChannel(channel, key);
  return channel;
}

/** The scheduled refresh: the channels synced longest ago first. */
export async function syncDueChannels(key: string) {
  const due = await db
    .select(syncFields)
    .from(channels)
    .where(and(eq(channels.platform, "youtube"), isNotNull(channels.handle)))
    .orderBy(asc(channels.lastSyncedAt))
    .limit(SCHEDULED_BATCH);
  for (const channel of due) await syncYoutubeChannel(channel, key);
}
