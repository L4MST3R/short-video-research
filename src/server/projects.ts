import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { hooks, projectItems, projects, scripts, videos } from "@/db/schema";

export const ITEM_KINDS = ["video", "hook", "script"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

const id = z.string().min(1).max(64);
const name = z.string().trim().min(1, "Enter a name").max(120);
export const projectInput = z.object({ name }).strict();
export const renameProjectInput = z.object({ id, name }).strict();
export const addItemInput = z
  .object({ projectId: id, kind: z.enum(ITEM_KINDS), refId: id, note: z.string().trim().max(500).default("") })
  .strict();
export const removeItemInput = z.object({ id }).strict();

export async function listProjects(userId: string) {
  const rows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(asc(projects.name));
  const items = await db.select({ projectId: projectItems.projectId }).from(projectItems).where(eq(projectItems.userId, userId));
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.projectId, (counts.get(item.projectId) ?? 0) + 1);
  return rows.map((p) => ({ ...p, items: counts.get(p.id) ?? 0 }));
}

async function ownedProject(userId: string, projectId: string) {
  const [row] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  return row ?? null;
}

export async function createProject(userId: string, input: z.infer<typeof projectInput>) {
  const [row] = await db
    .insert(projects)
    .values({ id: crypto.randomUUID(), userId, name: input.name })
    .returning({ id: projects.id, name: projects.name });
  return row!;
}

export async function renameProject(userId: string, input: z.infer<typeof renameProjectInput>) {
  const [row] = await db
    .update(projects)
    .set({ name: input.name })
    .where(and(eq(projects.id, input.id), eq(projects.userId, userId)))
    .returning({ id: projects.id, name: projects.name });
  return row ?? null;
}

export async function deleteProject(userId: string, projectId: string) {
  const project = await ownedProject(userId, projectId);
  if (!project) return null;
  await db.batch([
    db.delete(projectItems).where(and(eq(projectItems.projectId, projectId), eq(projectItems.userId, userId))),
    db.delete(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))),
  ]);
  return project;
}

async function ownsItem(userId: string, kind: ItemKind, refId: string) {
  const table = { video: videos, hook: hooks, script: scripts }[kind];
  const [row] = await db.select({ id: table.id }).from(table).where(and(eq(table.id, refId), eq(table.userId, userId)));
  return Boolean(row);
}

/** "added", "duplicate", or null when the project or the item isn't the user's. */
export async function addItem(userId: string, input: z.infer<typeof addItemInput>) {
  const project = await ownedProject(userId, input.projectId);
  if (!project || !(await ownsItem(userId, input.kind, input.refId))) return null;
  const [row] = await db
    .insert(projectItems)
    .values({ id: crypto.randomUUID(), userId, ...input })
    .onConflictDoNothing()
    .returning({ id: projectItems.id });
  return { result: row ? ("added" as const) : ("duplicate" as const), project: project.name };
}

export async function removeItem(userId: string, itemId: string) {
  const [row] = await db
    .delete(projectItems)
    .where(and(eq(projectItems.id, itemId), eq(projectItems.userId, userId)))
    .returning({ id: projectItems.id });
  return row ?? null;
}

/** The project with its items grouped by kind, each with what its link shows. */
export async function getProject(userId: string, projectId: string) {
  const project = await ownedProject(userId, projectId);
  if (!project) return null;
  const items = await db
    .select({ id: projectItems.id, kind: projectItems.kind, refId: projectItems.refId, note: projectItems.note })
    .from(projectItems)
    .where(and(eq(projectItems.projectId, projectId), eq(projectItems.userId, userId)))
    .orderBy(asc(projectItems.createdAt), asc(projectItems.id));
  const ids = (kind: ItemKind) => {
    const list = items.filter((i) => i.kind === kind).map((i) => i.refId);
    return list.length ? list : [""];
  };
  const [videoRows, hookRows, scriptRows] = await Promise.all([
    db.select({ id: videos.id, label: videos.title }).from(videos).where(and(eq(videos.userId, userId), inArray(videos.id, ids("video")))),
    db.select({ id: hooks.id, label: hooks.text }).from(hooks).where(and(eq(hooks.userId, userId), inArray(hooks.id, ids("hook")))),
    db.select({ id: scripts.id, label: scripts.title }).from(scripts).where(and(eq(scripts.userId, userId), inArray(scripts.id, ids("script")))),
  ]);
  const labels = new Map<string, string>();
  for (const r of [...videoRows, ...hookRows, ...scriptRows]) labels.set(r.id, r.label);
  const group = (kind: ItemKind) =>
    items
      .filter((i) => i.kind === kind && labels.has(i.refId))
      .map((i) => ({ id: i.id, refId: i.refId, note: i.note, label: labels.get(i.refId)! }));
  return { ...project, videos: group("video"), hooks: group("hook"), scripts: group("script") };
}
