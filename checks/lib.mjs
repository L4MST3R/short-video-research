// Shared helpers for the release checks. Selectors come from the app's markup.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

export const DAY = 24 * 60 * 60 * 1000;
export const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

/** A stand-in Gateway: refuses capability calls like an unconfigured Gateway, and answers
 * OpenRouter chat calls with fixed JSON once switched on through /__ai/on. */
export const FAKE_GATEWAY = `let aiOn = false;
const refuse = (code) => Response.json({ error: "Service Unavailable", code, message: "Not configured in this check." }, { status: 503, headers: { "x-everyapp-error": code } });
const answers = {
  breakdown: { hook: "Opens on the payoff: a fold-out desk that turns into a squat rack.", format: "Talking head with quick cutaways", structure: "Problem, failed fix, reveal, proof", angle: "Small flat, no gym", whyItWorked: "The first second shows something viewers have never seen.", howToReuse: "Lead with the strangest object in your setup, then explain it." },
  hooks: { hooks: ["Stop stretching before you lift. Do this instead.", "I tried desk workouts for 30 days and here is what changed.", "The 2-minute routine physios don't post online."] },
  draft: { hook: "You don't need a gym to get strong at home.", body: "Grab one kettlebell. Swing, goblet squat and press, eight reps each, five rounds.", cta: "Follow for tomorrow's routine." },
  expand: { hook: "You don't need a gym, or even a spare room, to get strong at home.", body: "Grab one kettlebell. Swing for power, goblet squat for legs and press for shoulders. Eight reps each, five rounds, rest a minute between rounds. Add one rep a week.", cta: "Follow for tomorrow's routine and save this for your next session." },
};
export default { async fetch(request) {
  const url = new URL(request.url);
  if (url.pathname === "/__ai/on") { aiOn = true; return new Response("on"); }
  if (url.pathname === "/__ai/off") { aiOn = false; return new Response("off"); }
  if (url.pathname.endsWith("/chat/completions")) {
    if (!aiOn) return refuse("ai_provider_not_configured");
    const body = await request.text();
    const task = /TASK: (\\w+)/.exec(body)?.[1] ?? "breakdown";
    return Response.json({ id: "x", object: "chat.completion", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(answers[task] ?? answers.breakdown) } }] });
  }
  return refuse("integration_not_configured");
} };`;

export const fakeGatewayWorker = {
  config: { name: "fake-gateway", compatibilityDate: "2026-06-01", manifest: { mainModule: "gateway.mjs", modules: { "gateway.mjs": { type: "esm", contents: FAKE_GATEWAY } } } },
};

export async function setAi(runtime, on) {
  const worker = await runtime.mf.getWorker("fake-gateway");
  await worker.fetch(`http://fake/__ai/${on ? "on" : "off"}`);
}

/** Creates a workspace from the home page and opens it; returns its id. */
export async function createWorkspace(page, name) {
  await open(page, "/");
  await page.getByTestId("new-workspace").click();
  await page.getByLabel("Name").fill(name);
  await Promise.all([page.waitForURL(/\/workspaces\/[^/]+$/), page.getByRole("button", { name: "Create" }).click()]);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return new URL(page.url()).pathname.split("/").pop();
}

/** Adds a channel on the open workspace page. */
export async function addChannel(page, platform, handle) {
  await page.getByTestId("add-channel").click();
  await pickOption(page, page.getByTestId("channel-platform"), platform);
  await page.getByLabel("Handle").fill(handle);
  await page.getByRole("button", { name: "Add channel", exact: true }).last().click();
  await expect(page.getByTestId("channel-row").filter({ hasText: handle })).toBeVisible();
}

/** Picks an option of one of the app's select menus. */
export async function pickOption(page, trigger, label) {
  await trigger.click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

/** Adds a video by hand on the open channel page. */
export async function addVideo(page, v) {
  await page.getByTestId("add-video").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("URL").fill(v.url);
  await dialog.getByLabel("Title").fill(v.title);
  await dialog.getByLabel("Views").fill(String(v.views));
  await dialog.getByLabel("Likes").fill(String(v.likes ?? 0));
  await dialog.getByLabel("Comments").fill(String(v.comments ?? 0));
  await dialog.getByLabel("Posted").fill(v.posted);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("video-row").filter({ hasText: v.title })).toBeVisible();
}

/** Captures the next server-function POST the page makes while `action` runs. */
export async function captureServerCall(page, action) {
  const [request] = await Promise.all([
    page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/_serverFn/")),
    action(),
  ]);
  const headers = { ...(await request.allHeaders()) };
  for (const name of ["host", "cookie", "content-length", "connection", "origin", "referer"]) delete headers[name];
  return { path: new URL(request.url()).pathname + new URL(request.url()).search, body: request.postData(), headers };
}

/** Opens a path and waits until React has hydrated it, so clicks reach their handlers. */
export async function open(page, path) {
  await page.goto(path);
  await page.locator("body[data-hydrated]").waitFor();
}

export async function reload(page) {
  await page.reload();
  await page.locator("body[data-hydrated]").waitFor();
}
