import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { memberMiddleware } from "@/serverFunctions/middleware";
import * as feed from "@/server/feed";
import * as ws from "@/server/workspaces";
import { syncChannelForUser } from "@/server/youtube";

const youtubeKey = () => env.YOUTUBE_API_KEY || null;

export const getWorkspaces = createServerFn()
  .middleware([memberMiddleware])
  .handler(({ context }) => ws.listWorkspaces(context.user.id));

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => ws.workspaceInput.parse(data))
  .handler(({ data, context }) => ws.createWorkspace(context.user.id, data));

export const renameWorkspace = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => ws.renameWorkspaceInput.parse(data))
  .handler(({ data, context }) => ws.renameWorkspace(context.user.id, data));

export const deleteWorkspace = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => ws.idInput.parse(data))
  .handler(({ data, context }) => ws.deleteWorkspace(context.user.id, data.id));

export const getWorkspacePage = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => ws.idInput.parse(data))
  .handler(async ({ data, context }) => {
    const workspace = await ws.getWorkspace(context.user.id, data.id);
    if (!workspace) throw notFound();
    const channels = await ws.listChannels(context.user.id, data.id);
    return { workspace, channels, youtubeSync: youtubeKey() !== null };
  });

export const addChannel = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => ws.channelInput.parse(data))
  .handler(async ({ data, context }) => {
    const channel = await ws.addChannel(context.user.id, data);
    if (channel === "duplicate") return { error: "This channel is already in the workspace." };
    if (!channel) return { error: "That workspace no longer exists." };
    const key = youtubeKey();
    // A YouTube channel's videos arrive on add, then on the schedule.
    if (channel.platform === "youtube" && key) await syncChannelForUser(context.user.id, channel.id, key);
    return { channel };
  });

export const removeChannel = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => ws.idInput.parse(data))
  .handler(({ data, context }) => ws.removeChannel(context.user.id, data.id));

export const syncChannel = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => ws.idInput.parse(data))
  .handler(async ({ data, context }) => {
    const key = youtubeKey();
    if (!key) return null;
    return syncChannelForUser(context.user.id, data.id, key);
  });

export const getChannelPage = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => ws.idInput.parse(data))
  .handler(async ({ data, context }) => {
    const channel = await ws.getChannel(context.user.id, data.id);
    if (!channel) throw notFound();
    const videos = await ws.listChannelVideos(context.user.id, data.id);
    return { channel, videos, youtubeSync: youtubeKey() !== null };
  });

export const addVideo = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => ws.addVideoInput.parse(data))
  .handler(({ data, context }) => ws.addVideo(context.user.id, data));

export const editVideo = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => ws.editVideoInput.parse(data))
  .handler(({ data, context }) => ws.editVideo(context.user.id, data));

export const deleteVideo = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => ws.idInput.parse(data))
  .handler(({ data, context }) => ws.deleteVideo(context.user.id, data.id));

export const getFeed = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => feed.feedInput.parse(data))
  .handler(async ({ data, context }) => {
    const workspace = await ws.getWorkspace(context.user.id, data.workspaceId);
    if (!workspace) throw notFound();
    return { workspace, feed: await feed.workspaceFeed(context.user.id, data) };
  });

