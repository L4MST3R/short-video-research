import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { memberMiddleware } from "@/serverFunctions/middleware";
import { listProjects } from "@/server/projects";
import * as scripts from "@/server/scripts";
import { listVideoChoices } from "@/server/videos";
import { idInput } from "@/server/workspaces";

export const getScriptsPage = createServerFn()
  .middleware([memberMiddleware])
  .handler(async ({ context }) => {
    const [list, videos] = await Promise.all([scripts.listScripts(context.user.id), listVideoChoices(context.user.id)]);
    return { scripts: list, videos };
  });

export const getScriptPage = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const script = await scripts.getScript(context.user.id, data.id);
    if (!script) throw notFound();
    return { script, projects: await listProjects(context.user.id) };
  });

export const createScript = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => scripts.createScriptInput.parse(data))
  .handler(({ data, context }) => scripts.createScript(context.user.id, data));

export const updateScript = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => scripts.updateScriptInput.parse(data))
  .handler(({ data, context }) => scripts.updateScript(context.user.id, data));

export const deleteScript = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(({ data, context }) => scripts.deleteScript(context.user.id, data.id));

export const draftScript = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => scripts.draftInput.parse(data))
  .handler(({ data, context }) => scripts.draftScript(context.user.id, data));
