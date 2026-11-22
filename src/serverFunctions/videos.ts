import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { memberMiddleware } from "@/serverFunctions/middleware";
import { listProjects } from "@/server/projects";
import * as videos from "@/server/videos";
import { idInput } from "@/server/workspaces";

export const getVideoPage = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const video = await videos.getVideo(context.user.id, data.id);
    if (!video) throw notFound();
    return { video, projects: await listProjects(context.user.id) };
  });

export const saveTranscript = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => videos.transcriptInput.parse(data))
  .handler(({ data, context }) => videos.saveTranscript(context.user.id, data));

export const runBreakdown = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(({ data, context }) => videos.runBreakdown(context.user.id, data.id));
