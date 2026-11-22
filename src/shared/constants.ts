// Values the pages and the server share. Nothing here touches the database.
import { z } from "zod";

export const PLATFORMS = ["youtube", "tiktok", "instagram"] as const;

// Every field is optional, so the plain feed URL is already canonical.
export const feedSearch = z.object({
  platform: z.enum(["all", ...PLATFORMS]).optional().catch(undefined),
  window: z.enum(["7", "30", "90", "all"]).optional().catch(undefined),
  minScore: z.coerce.number().min(0).max(100000).optional().catch(undefined),
  sort: z.enum(["score", "views", "date"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
});
export type FeedSearch = z.infer<typeof feedSearch>;

export const CATEGORIES = {
  contrarian: "Contrarian",
  "case-study": "Case study",
  secret: "Secret reveal",
  comparison: "Comparison",
  question: "Question",
  list: "List",
} as const;
export type Category = keyof typeof CATEGORIES;

export const FRAMEWORKS = {
  "hook-problem-solution": { label: "Hook, problem, solution", guide: "Open with the hook, name the viewer's problem, then give the solution step by step." },
  list: { label: "List", guide: "Open with the hook, then a numbered run of short points, each one line." },
  story: { label: "Story", guide: "Open with the hook, then tell a short first-person story with a turning point and a lesson." },
  comparison: { label: "Comparison", guide: "Open with the hook, set two options side by side, compare them on a few points and pick a winner." },
} as const;
export type Framework = keyof typeof FRAMEWORKS;
