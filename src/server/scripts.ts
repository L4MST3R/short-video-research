import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projectItems, scripts, videos } from "@/db/schema";
import { askJson, type AiResult } from "@/server/ai";
import { getVideo } from "@/server/videos";

import { FRAMEWORKS, type Framework } from "@/shared/constants";
const frameworkIds = Object.keys(FRAMEWORKS) as [Framework, ...Framework[]];

const id = z.string().min(1).max(64);
const title = z.string().trim().min(1, "Enter a title").max(200);
export const createScriptInput = z
  .object({
    title,
    idea: z.string().trim().max(4000).default(""),
    framework: z.enum(frameworkIds),
    sourceVideoId: id.nullable().default(null),
  })
  .strict();
export const updateScriptInput = z
  .object({
    id,
    title,
    idea: z.string().trim().max(4000),
    framework: z.enum(frameworkIds),
    hook: z.string().max(4000),
    body: z.string().max(40000),
    cta: z.string().max(4000),
  })
  .strict();
export const draftInput = z
  .object({ id, mode: z.enum(["draft", "expand"]), idea: z.string().max(4000), framework: z.enum(frameworkIds), hook: z.string().max(4000), body: z.string().max(40000), cta: z.string().max(4000) })
  .strict();

const shown = {
  id: scripts.id,
  title: scripts.title,
  idea: scripts.idea,
  framework: scripts.framework,
  sourceVideoId: scripts.sourceVideoId,
  hook: scripts.hook,
  body: scripts.body,
  cta: scripts.cta,
  updatedAt: scripts.updatedAt,
};

export function listScripts(userId: string) {
  return db
    .select({ id: scripts.id, title: scripts.title, framework: scripts.framework, updatedAt: scripts.updatedAt })
    .from(scripts)
    .where(eq(scripts.userId, userId))
    .orderBy(desc(scripts.updatedAt), desc(scripts.id));
}

export async function getScript(userId: string, scriptId: string) {
  const [row] = await db.select(shown).from(scripts).where(and(eq(scripts.id, scriptId), eq(scripts.userId, userId)));
  if (!row) return null;
  let source: { id: string; title: string } | null = null;
  if (row.sourceVideoId) {
    const [video] = await db
      .select({ id: videos.id, title: videos.title })
      .from(videos)
      .where(and(eq(videos.id, row.sourceVideoId), eq(videos.userId, userId)));
    source = video ?? null;
  }
  return { ...row, source };
}

/** The new script; null when the source video isn't the user's. */
export async function createScript(userId: string, input: z.infer<typeof createScriptInput>) {
  if (input.sourceVideoId && !(await getVideo(userId, input.sourceVideoId))) return null;
  const [row] = await db
    .insert(scripts)
    .values({ id: crypto.randomUUID(), userId, ...input })
    .returning({ id: scripts.id });
  return row!;
}

export async function updateScript(userId: string, { id: scriptId, ...change }: z.infer<typeof updateScriptInput>) {
  const [row] = await db
    .update(scripts)
    .set({ ...change, updatedAt: new Date().toISOString() })
    .where(and(eq(scripts.id, scriptId), eq(scripts.userId, userId)))
    .returning({ id: scripts.id });
  return row ?? null;
}

export async function deleteScript(userId: string, scriptId: string) {
  const [found] = await db.select({ id: scripts.id }).from(scripts).where(and(eq(scripts.id, scriptId), eq(scripts.userId, userId)));
  if (!found) return null;
  await db.batch([
    db.delete(projectItems).where(and(eq(projectItems.userId, userId), eq(projectItems.kind, "script"), eq(projectItems.refId, scriptId))),
    db.delete(scripts).where(and(eq(scripts.id, scriptId), eq(scripts.userId, userId))),
  ]);
  return found;
}

const parts = z.object({ hook: z.string().trim().min(1), body: z.string().trim().min(1), cta: z.string().trim().min(1) });
export type ScriptParts = z.infer<typeof parts>;

/**
 * Drafts the script from its idea (and its source video's breakdown), or
 * expands the current draft into a longer one. Nothing is saved: the page
 * puts the text in the editor for the member to keep or change.
 */
export async function draftScript(userId: string, input: z.infer<typeof draftInput>): Promise<AiResult<ScriptParts> | null> {
  const script = await getScript(userId, input.id);
  if (!script) return null;
  const framework = FRAMEWORKS[input.framework];
  const source = script.sourceVideoId ? await getVideo(userId, script.sourceVideoId) : null;
  const lines = [`Idea: ${input.idea || script.title}`, `Framework: ${framework.label}. ${framework.guide}`];
  if (source) {
    lines.push(`Source video: "${source.title}" (${source.views} views)`);
    if (source.breakdown) {
      const b = source.breakdown;
      lines.push(`Its breakdown. Hook: ${b.hook} Format: ${b.format} Structure: ${b.structure} Angle: ${b.angle} Why it worked: ${b.whyItWorked} How to reuse: ${b.howToReuse}`);
    }
  }
  if (input.mode === "expand") {
    lines.push(`Current draft:\nHook: ${input.hook}\nBody: ${input.body}\nCall to action: ${input.cta}`);
  }
  const prompt =
    input.mode === "draft"
      ? `You write scripts for short-form videos, spoken to camera, under 60 seconds. Return {"hook": string, "body": string, "cta": string}: the opening line, the spoken body following the framework, and a one-line call to action.`
      : `You expand short-form video scripts. Keep the draft's idea and voice, and make the body about twice as long with concrete detail; sharpen the hook and the call to action. Return {"hook": string, "body": string, "cta": string}.`;
  return askJson(input.mode, prompt, lines.join("\n"), (value) => {
    const parsed = parts.safeParse(value);
    return parsed.success ? parsed.data : null;
  });
}
