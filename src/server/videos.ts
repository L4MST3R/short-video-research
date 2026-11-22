import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { channels, videos, workspaces } from "@/db/schema";
import { askJson, type AiResult } from "@/server/ai";
import { outlierScores } from "@/server/outliers";

export const transcriptInput = z
  .object({ id: z.string().min(1).max(64), transcript: z.string().max(100_000) })
  .strict();

export const breakdownSchema = z.object({
  hook: z.string(),
  format: z.string(),
  structure: z.string(),
  angle: z.string(),
  whyItWorked: z.string(),
  howToReuse: z.string(),
});
export type Breakdown = z.infer<typeof breakdownSchema>;

function readBreakdown(json: string | null): Breakdown | null {
  if (!json) return null;
  try {
    const parsed = breakdownSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The video with its transcript, breakdown and score, or null when it isn't the user's. */
export async function getVideo(userId: string, videoId: string) {
  const [row] = await db
    .select({
      id: videos.id,
      channelId: videos.channelId,
      workspaceId: videos.workspaceId,
      url: videos.url,
      title: videos.title,
      views: videos.views,
      likes: videos.likes,
      comments: videos.comments,
      postedAt: videos.postedAt,
      transcript: videos.transcript,
      breakdown: videos.breakdown,
      breakdownAt: videos.breakdownAt,
      handle: channels.handle,
      platform: channels.platform,
      workspaceName: workspaces.name,
    })
    .from(videos)
    .innerJoin(channels, eq(channels.id, videos.channelId))
    .innerJoin(workspaces, eq(workspaces.id, videos.workspaceId))
    .where(and(eq(videos.id, videoId), eq(videos.userId, userId)));
  if (!row) return null;
  const siblings = await db
    .select({ id: videos.id, channelId: videos.channelId, views: videos.views })
    .from(videos)
    .where(and(eq(videos.channelId, row.channelId), eq(videos.userId, userId)));
  return {
    ...row,
    breakdown: readBreakdown(row.breakdown),
    score: outlierScores(siblings).get(row.id) ?? null,
  };
}

export type VideoDetail = NonNullable<Awaited<ReturnType<typeof getVideo>>>;

export async function saveTranscript(userId: string, input: z.infer<typeof transcriptInput>) {
  const [row] = await db
    .update(videos)
    .set({ transcript: input.transcript })
    .where(and(eq(videos.id, input.id), eq(videos.userId, userId)))
    .returning({ id: videos.id, transcript: videos.transcript });
  return row ?? null;
}

/** All of the user's videos, for picking a script's source. */
export function listVideoChoices(userId: string) {
  return db
    .select({ id: videos.id, title: videos.title, handle: channels.handle })
    .from(videos)
    .innerJoin(channels, eq(channels.id, videos.channelId))
    .where(eq(videos.userId, userId))
    .orderBy(videos.title);
}

const BREAKDOWN_PROMPT = `You study short-form videos that got far more views than the creator usually gets.
Given a video's title, numbers and transcript, explain it with these keys, each one to three sentences:
"hook" (what the first seconds say or show), "format" (how it is filmed and edited),
"structure" (the order of the story beats), "angle" (the take on the topic),
"whyItWorked" (why it beat the creator's usual views), "howToReuse" (how another creator can use the same idea).`;

/** Runs a breakdown and saves it on the video, replacing any earlier one. */
export async function runBreakdown(userId: string, videoId: string): Promise<AiResult<Breakdown> | null> {
  const video = await getVideo(userId, videoId);
  if (!video) return null;
  const input = [
    `Title: ${video.title}`,
    `Platform: ${video.platform}, creator ${video.handle}`,
    `Views: ${video.views}, likes: ${video.likes}, comments: ${video.comments}`,
    video.score === null ? "" : `Views are ${video.score.toFixed(1)} times the creator's median.`,
    `Transcript:\n${video.transcript || "(none)"}`,
  ].join("\n");
  const result = await askJson("breakdown", BREAKDOWN_PROMPT, input, (value) => {
    const parsed = breakdownSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  });
  if (result.ok) {
    await db
      .update(videos)
      .set({ breakdown: JSON.stringify(result.value), breakdownAt: new Date().toISOString() })
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId)));
  }
  return result;
}
