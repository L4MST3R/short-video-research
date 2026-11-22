import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { isAdmin } from "@every-app/sdk/server";
import { memberMiddleware } from "@/serverFunctions/middleware";
import * as hooks from "@/server/hooks";
import { listProjects } from "@/server/projects";
import { idInput } from "@/server/workspaces";

class AdminOnlyError extends Error {
  constructor() {
    super("Only admins can change the template library.");
  }
}

function requireAdmin(user: { orgRole: string }) {
  if (!isAdmin(user)) {
    setResponseStatus(403);
    throw new AdminOnlyError();
  }
}

export const getHooksPage = createServerFn()
  .middleware([memberMiddleware])
  .handler(async ({ context }) => {
    const [templates, saved, projects] = await Promise.all([
      hooks.listTemplates(),
      hooks.listHooks(context.user.id),
      listProjects(context.user.id),
    ]);
    return { templates, saved, projects, admin: isAdmin(context.user) };
  });

export const createTemplate = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => hooks.templateInput.parse(data))
  .handler(({ data, context }) => {
    requireAdmin(context.user);
    return hooks.createTemplate(context.user.id, data);
  });

export const editTemplate = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => hooks.editTemplateInput.parse(data))
  .handler(({ data, context }) => {
    requireAdmin(context.user);
    return hooks.editTemplate(data);
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(({ data, context }) => {
    requireAdmin(context.user);
    return hooks.deleteTemplate(data.id);
  });

export const saveHook = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => hooks.hookInput.parse(data))
  .handler(({ data, context }) => hooks.saveHook(context.user.id, data));

export const editHook = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => hooks.editHookInput.parse(data))
  .handler(({ data, context }) => hooks.editHook(context.user.id, data));

export const deleteHook = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(({ data, context }) => hooks.deleteHook(context.user.id, data.id));

export const generateHooks = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => hooks.generateInput.parse(data))
  .handler(({ data }) => hooks.generateHooks(data));
