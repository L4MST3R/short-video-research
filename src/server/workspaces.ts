import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { channels, projectItems, videos, workspaces } from "@/db/schema";

import { PLATFORMS } from "@/shared/constants";

const id = z.string().min(1).max(64);
const name = z.string().trim().min(1, "Enter a name").max(120);

export const workspaceInput = z.object({ name }).strict();
export const renameWorkspaceInput = z.object({ id, name }).strict();
export const idInput = z.object({ id }).strict();
export const channelInput = z
  .object({
    workspaceId: id,
    platform: z.enum(PLATFORMS),
    handle: z
      .string()
      .trim()
      .min(1, "Enter a handle")
      .max(100)
      .transform((h) => (h.startsWith("@") ? h : `@${h}`)),
  })
  .strict();
const count0 = z.coerce.number().int().min(0).max(1e13);
export const videoFields = z.object({
  url: z.string().trim().url("Enter a full URL").max(500),
  title: z.string().trim().min(1, "Enter a title").max(300),
  views: count0,
  likes: count0,
  comments: count0,
  posted: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
});
export const addVideoInput = videoFields.extend({ channelId: id }).strict();
export const editVideoInput = videoFields.extend({ id }).strict();

// Workspaces

export async function listWorkspaces(userId: string) {
  const rows = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.userId, userId))
    .orderBy(asc(workspaces.name));
  const channelCounts = await db
    .select({ workspaceId: channels.workspaceId, n: count() })
    .from(channels)
    .where(eq(channels.userId, userId))
    .groupBy(channels.workspaceId);
  const videoCounts = await db
    .select({ workspaceId: videos.workspaceId, n: count() })
    .from(videos)
    .where(eq(videos.userId, userId))
    .groupBy(videos.workspaceId);
  const c = new Map(channelCounts.map((r) => [r.workspaceId, r.n]));
  const v = new Map(videoCounts.map((r) => [r.workspaceId, r.n]));
  return rows.map((w) => ({ ...w, channels: c.get(w.id) ?? 0, videos: v.get(w.id) ?? 0 }));
}

export async function getWorkspace(userId: string, workspaceId: string) {
  const [row] = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)));
  return row ?? null;
}

export async function createWorkspace(userId: string, input: z.infer<typeof workspaceInput>) {
  const [row] = await db
    .insert(workspaces)
    .values({ id: crypto.randomUUID(), userId, name: input.name })
    .returning({ id: workspaces.id, name: workspaces.name });
  return row!;
}

export async function renameWorkspace(userId: string, input: z.infer<typeof renameWorkspaceInput>) {
  const [row] = await db
    .update(workspaces)
    .set({ name: input.name })
    .where(and(eq(workspaces.id, input.id), eq(workspaces.userId, userId)))
    .returning({ id: workspaces.id, name: workspaces.name });
  return row ?? null;
}

/** Project items that point at these videos go too. */
function forgetVideos(userId: string, videoIds: string[]) {
  return db
    .delete(projectItems)
    .where(
      and(
        eq(projectItems.userId, userId),
        eq(projectItems.kind, "video"),
        inArray(projectItems.refId, videoIds),
      ),
    );
}

export async function deleteWorkspace(userId: string, workspaceId: string) {
  const workspace = await getWorkspace(userId, workspaceId);
  if (!workspace) return null;
  const ids = (
    await db
      .select({ id: videos.id })
      .from(videos)
      .where(and(eq(videos.workspaceId, workspaceId), eq(videos.userId, userId)))
  ).map((r) => r.id);
  await db.batch([
    forgetVideos(userId, ids.length ? ids : [""]),
    db.delete(videos).where(and(eq(videos.workspaceId, workspaceId), eq(videos.userId, userId))),
    db.delete(channels).where(and(eq(channels.workspaceId, workspaceId), eq(channels.userId, userId))),
    db.delete(workspaces).where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId))),
  ]);
  return workspace;
}

// Channels

const channelShown = {
  id: channels.id,
  workspaceId: channels.workspaceId,
  platform: channels.platform,
  handle: channels.handle,
  lastSyncedAt: channels.lastSyncedAt,
  syncError: channels.syncError,
};

export async function listChannels(userId: string, workspaceId: string) {
  const rows = await db
    .select({ ...channelShown, videos: sql<number>`(select count(*) from ${videos} where ${videos.channelId} = ${channels.id})` })
    .from(channels)
    .where(and(eq(channels.workspaceId, workspaceId), eq(channels.userId, userId)))
    .orderBy(asc(channels.createdAt), asc(channels.handle));
  return rows;
}

export async function getChannel(userId: string, channelId: string) {
  const [row] = await db
    .select({ ...channelShown, workspaceName: workspaces.name })
    .from(channels)
    .innerJoin(workspaces, eq(workspaces.id, channels.workspaceId))
    .where(and(eq(channels.id, channelId), eq(channels.userId, userId)));
  return row ?? null;
}

export type ChannelRow = NonNullable<Awaited<ReturnType<typeof getChannel>>>;

/** The new channel; null when the workspace isn't the user's; "duplicate" when it's already tracked. */
export async function addChannel(userId: string, input: z.infer<typeof channelInput>) {
  if (!(await getWorkspace(userId, input.workspaceId))) return null;
  const rows = await db
    .insert(channels)
    .values({ id: crypto.randomUUID(), userId, ...input })
    .onConflictDoNothing()
    .returning(channelShown);
  if (rows.length === 0) return "duplicate" as const;
  return rows[0]!;
}

export async function removeChannel(userId: string, channelId: string) {
  const channel = await getChannel(userId, channelId);
  if (!channel) return null;
  const ids = (
    await db.select({ id: videos.id }).from(videos).where(and(eq(videos.channelId, channelId), eq(videos.userId, userId)))
  ).map((r) => r.id);
  await db.batch([
    forgetVideos(userId, ids.length ? ids : [""]),
    db.delete(videos).where(and(eq(videos.channelId, channelId), eq(videos.userId, userId))),
    db.delete(channels).where(and(eq(channels.id, channelId), eq(channels.userId, userId))),
  ]);
  return channel;
}

// Videos

const videoShown = {
  id: videos.id,
  channelId: videos.channelId,
  url: videos.url,
  title: videos.title,
  views: videos.views,
  likes: videos.likes,
  comments: videos.comments,
  postedAt: videos.postedAt,
};

export function listChannelVideos(userId: string, channelId: string) {
  return db
    .select(videoShown)
    .from(videos)
    .where(and(eq(videos.channelId, channelId), eq(videos.userId, userId)))
    .orderBy(desc(videos.postedAt));
}

/** A posted date from the form, kept at midday UTC so it shows the same day everywhere. */
const postedAt = (date: string) => `${date}T12:00:00.000Z`;

export async function addVideo(userId: string, { channelId, posted, ...fields }: z.infer<typeof addVideoInput>) {
  const channel = await getChannel(userId, channelId);
  if (!channel) return null;
  const [row] = await db
    .insert(videos)
    .values({ id: crypto.randomUUID(), userId, channelId, workspaceId: channel.workspaceId, postedAt: postedAt(posted), ...fields })
    .returning(videoShown);
  return row!;
}

export async function editVideo(userId: string, { id: videoId, posted, ...fields }: z.infer<typeof editVideoInput>) {
  const [row] = await db
    .update(videos)
    .set({ ...fields, postedAt: postedAt(posted) })
    .where(and(eq(videos.id, videoId), eq(videos.userId, userId)))
    .returning(videoShown);
  return row ?? null;
}

export async function deleteVideo(userId: string, videoId: string) {
  const [found] = await db.select({ id: videos.id }).from(videos).where(and(eq(videos.id, videoId), eq(videos.userId, userId)));
  if (!found) return null;
  await db.batch([
    forgetVideos(userId, [videoId]),
    db.delete(videos).where(and(eq(videos.id, videoId), eq(videos.userId, userId))),
  ]);
  return found;
}
