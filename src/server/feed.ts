import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { channels, videos } from "@/db/schema";
import { outlierScores } from "@/server/outliers";
import { feedSearch } from "@/shared/constants";

export const PAGE_SIZE = 20;

export const feedInput = feedSearch.extend({ workspaceId: z.string().min(1).max(64) }).transform((input) => ({
  workspaceId: input.workspaceId,
  platform: input.platform ?? "all",
  window: input.window ?? "all",
  minScore: input.minScore,
  sort: input.sort ?? "score",
  page: input.page ?? 1,
}));

/** One page of the workspace's videos with their outlier scores, filtered and sorted. */
export async function workspaceFeed(userId: string, input: z.output<typeof feedInput>, now = Date.now()) {
  const rows = await db
    .select({
      id: videos.id,
      channelId: videos.channelId,
      url: videos.url,
      title: videos.title,
      views: videos.views,
      likes: videos.likes,
      comments: videos.comments,
      postedAt: videos.postedAt,
      handle: channels.handle,
      platform: channels.platform,
    })
    .from(videos)
    .innerJoin(channels, eq(channels.id, videos.channelId))
    .where(and(eq(videos.workspaceId, input.workspaceId), eq(videos.userId, userId)));
  const scores = outlierScores(rows);
  const since = input.window === "all" ? null : now - Number(input.window) * 86_400_000;
  const items = rows
    .map((row) => ({ ...row, score: scores.get(row.id) ?? null }))
    .filter((row) => input.platform === "all" || row.platform === input.platform)
    .filter((row) => since === null || Date.parse(row.postedAt) >= since)
    .filter((row) => input.minScore === undefined || (row.score !== null && row.score >= input.minScore));
  const by = {
    score: (a: (typeof items)[number], b: (typeof items)[number]) => (b.score ?? -1) - (a.score ?? -1) || b.views - a.views,
    views: (a: (typeof items)[number], b: (typeof items)[number]) => b.views - a.views,
    date: (a: (typeof items)[number], b: (typeof items)[number]) => b.postedAt.localeCompare(a.postedAt),
  }[input.sort];
  items.sort(by);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = Math.min(input.page, pages);
  return {
    total: items.length,
    totalInWorkspace: rows.length,
    page,
    pages,
    items: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  };
}
