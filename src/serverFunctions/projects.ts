import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { memberMiddleware } from "@/serverFunctions/middleware";
import * as projects from "@/server/projects";
import { idInput } from "@/server/workspaces";

export const getProjects = createServerFn()
  .middleware([memberMiddleware])
  .handler(({ context }) => projects.listProjects(context.user.id));

export const getProjectPage = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const project = await projects.getProject(context.user.id, data.id);
    if (!project) throw notFound();
    return project;
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => projects.projectInput.parse(data))
  .handler(({ data, context }) => projects.createProject(context.user.id, data));

export const renameProject = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => projects.renameProjectInput.parse(data))
  .handler(({ data, context }) => projects.renameProject(context.user.id, data));

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(({ data, context }) => projects.deleteProject(context.user.id, data.id));

export const addToProject = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => projects.addItemInput.parse(data))
  .handler(({ data, context }) => projects.addItem(context.user.id, data));

export const removeFromProject = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => projects.removeItemInput.parse(data))
  .handler(({ data, context }) => projects.removeItem(context.user.id, data.id));
