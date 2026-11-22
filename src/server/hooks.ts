import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { hooks, hookTemplates, projectItems } from "@/db/schema";
import { askJson, type AiResult } from "@/server/ai";

import { CATEGORIES, type Category } from "@/shared/constants";

const categoryIds = Object.keys(CATEGORIES) as [Category, ...Category[]];

const id = z.string().min(1).max(64);
const templateText = z.string().trim().min(1, "Write the template").max(300);
export const templateInput = z.object({ text: templateText, category: z.enum(categoryIds) }).strict();
export const editTemplateInput = templateInput.extend({ id }).strict();
const hookText = z.string().trim().min(1, "Write the hook").max(500);
export const hookInput = z
  .object({ text: hookText, topic: z.string().trim().max(200).default(""), templateId: id.nullable().default(null) })
  .strict();
export const editHookInput = z.object({ id, text: hookText }).strict();
export const generateInput = z
  .object({ topic: z.string().trim().min(1, "Enter a topic").max(200), templateIds: z.array(id).min(1, "Pick at least one template").max(10) })
  .strict();

// Templates: one library for the whole organization.

export function listTemplates() {
  return db
    .select({ id: hookTemplates.id, text: hookTemplates.text, category: hookTemplates.category })
    .from(hookTemplates)
    .orderBy(asc(hookTemplates.category), asc(hookTemplates.createdAt), asc(hookTemplates.id));
}

export async function createTemplate(userId: string, input: z.infer<typeof templateInput>) {
  const [row] = await db
    .insert(hookTemplates)
    .values({ id: crypto.randomUUID(), createdBy: userId, ...input })
    .returning({ id: hookTemplates.id });
  return row!;
}

export async function editTemplate({ id: templateId, ...input }: z.infer<typeof editTemplateInput>) {
  const [row] = await db.update(hookTemplates).set(input).where(eq(hookTemplates.id, templateId)).returning({ id: hookTemplates.id });
  return row ?? null;
}

export async function deleteTemplate(templateId: string) {
  const [row] = await db.delete(hookTemplates).where(eq(hookTemplates.id, templateId)).returning({ id: hookTemplates.id });
  return row ?? null;
}

// Hooks: private to the member who saved them.

const hookShown = { id: hooks.id, text: hooks.text, topic: hooks.topic, createdAt: hooks.createdAt };

export function listHooks(userId: string) {
  return db.select(hookShown).from(hooks).where(eq(hooks.userId, userId)).orderBy(desc(hooks.createdAt), desc(hooks.id));
}

export async function saveHook(userId: string, input: z.infer<typeof hookInput>) {
  const [row] = await db
    .insert(hooks)
    .values({ id: crypto.randomUUID(), userId, ...input })
    .returning(hookShown);
  return row!;
}

export async function editHook(userId: string, input: z.infer<typeof editHookInput>) {
  const [row] = await db
    .update(hooks)
    .set({ text: input.text })
    .where(and(eq(hooks.id, input.id), eq(hooks.userId, userId)))
    .returning(hookShown);
  return row ?? null;
}

export async function deleteHook(userId: string, hookId: string) {
  const [found] = await db.select({ id: hooks.id }).from(hooks).where(and(eq(hooks.id, hookId), eq(hooks.userId, userId)));
  if (!found) return null;
  await db.batch([
    db.delete(projectItems).where(and(eq(projectItems.userId, userId), eq(projectItems.kind, "hook"), eq(projectItems.refId, hookId))),
    db.delete(hooks).where(and(eq(hooks.id, hookId), eq(hooks.userId, userId))),
  ]);
  return found;
}

const HOOKS_PROMPT = `You write opening lines for short-form videos.
Write hooks for the topic using the given fill-in-the-blank templates: fill each template's blanks for the topic, one or two hooks per template.
Each hook is one or two short spoken sentences. Return {"hooks": [string, ...]} with three to eight hooks.`;

export async function generateHooks(input: z.infer<typeof generateInput>): Promise<AiResult<string[]>> {
  const templates = await db
    .select({ text: hookTemplates.text })
    .from(hookTemplates)
    .where(inArray(hookTemplates.id, input.templateIds));
  if (!templates.length) return { ok: false, unavailable: false, message: "Pick at least one template." };
  return askJson(
    "hooks",
    HOOKS_PROMPT,
    `Topic: ${input.topic}\nTemplates:\n${templates.map((t) => `- ${t.text}`).join("\n")}`,
    (value) => {
      const parsed = z.object({ hooks: z.array(z.string().trim().min(1).max(500)).min(1).max(12) }).safeParse(value);
      return parsed.success ? parsed.data.hooks : null;
    },
  );
}
