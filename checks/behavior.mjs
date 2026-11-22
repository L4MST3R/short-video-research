// Behavior: every retained feature's main path, through the packaged release.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { addChannel, addVideo, createWorkspace, daysAgo, fakeGatewayWorker, pickOption, setAi, open, reload } from "./lib.mjs";

const runtime = await startRuntime({
  bindings: { EVERY_APP_GATEWAY: { type: "worker", worker: "fake-gateway" } },
  workers: [fakeGatewayWorker],
});
try {
  const context = await runtime.context("owner");
  const page = await context.newPage();

  // Request level: member pages answer, the app has no JSON of another member's.
  for (const path of ["/", "/hooks", "/scripts", "/projects"]) {
    const response = await runtime.fetch(path, { role: "owner" });
    expect(response.status, path).toBe(200);
  }

  // F001: workspaces.
  await open(page, "/");
  await expect(page.getByRole("heading", { level: 1, name: "Workspaces" })).toBeVisible();
  await expect(page.getByText("No workspaces yet")).toBeVisible();
  await runtime.assertBackLink(page);
  await createWorkspace(page, "Scratch niche");
  await open(page, "/");
  const scratch = page.getByTestId("workspace-row").filter({ hasText: "Scratch niche" });
  await scratch.getByRole("button", { name: "Rename Scratch niche" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Scratch niche 2");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("workspace-row").filter({ hasText: "Scratch niche 2" })).toBeVisible();
  await page.getByRole("button", { name: "Delete Scratch niche 2" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("workspace-row")).toHaveCount(0);

  const workspaceId = await createWorkspace(page, "Home workouts");
  await expect(page.getByText("No channels yet")).toBeVisible();
  await addChannel(page, "TikTok", "@mara.moves");
  await addChannel(page, "YouTube", "@liftlab");
  await addChannel(page, "Instagram", "@strongathome");
  await addChannel(page, "TikTok", "@temp.channel");
  await expect(page.getByTestId("youtube-off")).toBeVisible();
  await expect(page.getByTestId("channel-row").filter({ hasText: "@liftlab" })).toContainText("Not synced");
  await page.getByRole("button", { name: "Remove @temp.channel" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
  await expect(page.getByTestId("channel-row")).toHaveCount(3);

  // Manual videos on the TikTok channel.
  await page.getByTestId("channel-row").filter({ hasText: "@mara.moves" }).getByRole("link", { name: "@mara.moves" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "@mara.moves" })).toBeVisible();
  await expect(page.getByText("No videos yet")).toBeVisible();
  const tiktokId = new URL(page.url()).pathname.split("/").pop();
  await addVideo(page, { url: "https://www.tiktok.com/@mara.moves/video/1001", title: "Desk stretch you can do on calls", views: 12000, likes: 800, comments: 40, posted: daysAgo(5) });
  await addVideo(page, { url: "https://www.tiktok.com/@mara.moves/video/1002", title: "Why I quit 5am workouts", views: 96000, likes: 7100, comments: 530, posted: daysAgo(12) });
  await addVideo(page, { url: "https://www.tiktok.com/@mara.moves/video/1003", title: "Three-move kettlebell finisher", views: 15000, likes: 900, comments: 61, posted: daysAgo(40) });
  await addVideo(page, { url: "https://www.tiktok.com/@mara.moves/video/1004", title: "Mobility test", views: 500, posted: daysAgo(2) });
  await page.getByRole("button", { name: "Edit Mobility test" }).click();
  await page.getByRole("dialog").getByLabel("Title").fill("Hip mobility check");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("video-row").filter({ hasText: "Hip mobility check" })).toBeVisible();
  await page.getByRole("button", { name: "Delete Hip mobility check" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("video-row")).toHaveCount(3);

  // Seed a longer history for the Instagram channel straight into the database.
  const db = await runtime.database();
  const channel = await db.prepare("select id, user_id from channels where handle = ?").bind("@strongathome").first();
  const titles = ["10-minute living room HIIT", "Push-up progression for beginners", "Resistance band back day", "My weekly home training split", "Single dumbbell leg day", "Core work without crunches", "How I built a garage gym for under $300", "Pull-up bar mistakes", "Stair workout for your lunch break", "Wall sit challenge, day 30", "Slow tempo squats explained", "Rest days I actually take", "Five minute mobility flow", "Couch-to-plank in four weeks", "Grip strength with a towel", "Doorway chest stretch", "Jump rope intervals", "Glute bridge variations", "Backpack rows", "Chair dips done right", "Sunday stretch routine", "Morning walk vs evening walk", "Shoulder taps for stability", "Bear crawl finisher"];
  // Median 5000 (ten below, five at 5000), so the two big ones score 12.0 and 8.0.
  const usual = [2800, 3900, 4400, 4700, 5000, 5000, 5200, 5900, 6800, 7400, 3300, 4100, 4900, 5000, 5000, 5500, 6200, 2600, 3600, 4600, 5000, 5800];
  const inserts = [];
  for (let i = 0; i < 24; i++) {
    const views = i === 3 ? 60000 : i === 8 ? 40000 : usual.shift();
    inserts.push(db.prepare("insert into videos (id, user_id, channel_id, workspace_id, url, title, views, likes, comments, posted_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), channel.user_id, channel.id, workspaceId, `https://www.instagram.com/reel/seed${i}/`, titles[i], views, 100, 10, new Date(Date.now() - (10 + i * 7) * 86400000).toISOString()));
  }
  await db.batch(inserts);

  // F002: the outlier feed.
  await open(page, `/workspaces/${workspaceId}`);
  await page.getByTestId("open-feed").click();
  await expect(page.getByRole("heading", { level: 1, name: "Outlier feed" })).toBeVisible();
  await expect(page.getByTestId("feed-page")).toHaveText("Page 1 of 2");
  await expect(page.getByTestId("feed-row")).toHaveCount(20);
  // Sorted by score: 60000/5000 = 12.0, 40000/5000 = 8.0, 96000/15000 = 6.4.
  await expect(page.getByTestId("feed-row").nth(0).getByTestId("score")).toHaveText("12.0×");
  await expect(page.getByTestId("feed-row").nth(1).getByTestId("score")).toHaveText("8.0×");
  await expect(page.getByTestId("feed-row").nth(2)).toContainText("Why I quit 5am workouts");
  await expect(page.getByTestId("feed-row").nth(2).getByTestId("score")).toHaveText("6.4×");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByTestId("feed-page")).toHaveText("Page 2 of 2");
  await expect(page.getByTestId("feed-row")).toHaveCount(7);

  await pickOption(page, page.getByTestId("feed-platform"), "TikTok");
  await expect(page.getByTestId("feed-row")).toHaveCount(3);
  await pickOption(page, page.getByTestId("feed-window"), "Last 7 days");
  await expect(page.getByTestId("feed-row")).toHaveCount(1);
  await expect(page.getByTestId("feed-row")).toContainText("Desk stretch you can do on calls");
  await expect(page.getByTestId("feed-row").getByTestId("score")).toHaveText("0.8×");
  await pickOption(page, page.getByTestId("feed-window"), "Any time");
  await pickOption(page, page.getByTestId("feed-platform"), "All platforms");
  await page.getByTestId("feed-min-score").fill("3");
  await expect(page.getByTestId("feed-row")).toHaveCount(3);
  await page.getByTestId("feed-min-score").fill("");
  await pickOption(page, page.getByTestId("feed-sort"), "Views");
  await expect(page.getByTestId("feed-row").first()).toContainText("Why I quit 5am workouts");
  await pickOption(page, page.getByTestId("feed-sort"), "Newest");
  await expect(page.getByTestId("feed-row").first()).toContainText("Desk stretch you can do on calls");
  await expect(page.getByTestId("feed-row").first().getByRole("link", { name: "Open original" })).toHaveAttribute("href", "https://www.tiktok.com/@mara.moves/video/1001");
  // A channel with fewer than three videos has no score yet.
  await open(page, `/channels/${tiktokId}`);
  await page.getByRole("button", { name: "Delete Desk stretch you can do on calls" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("video-row")).toHaveCount(2);
  await open(page, `/workspaces/${workspaceId}/feed?platform=tiktok`);
  await expect(page.getByTestId("feed-row").first().getByTestId("score")).toHaveText("—");
  await open(page, `/channels/${tiktokId}`);
  await addVideo(page, { url: "https://www.tiktok.com/@mara.moves/video/1001", title: "Desk stretch you can do on calls", views: 12000, likes: 800, comments: 40, posted: daysAgo(5) });

  // F003: transcript and breakdown.
  await open(page, `/workspaces/${workspaceId}/feed?platform=tiktok&sort=views`);
  await page.getByTestId("feed-row").first().getByRole("link", { name: "Why I quit 5am workouts" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Why I quit 5am workouts" })).toBeVisible();
  const videoUrl = page.url();
  await page.getByLabel("Transcript").fill("I used to set three alarms for 5am. Here's why I stopped, and what I do now instead.");
  await page.getByRole("button", { name: "Save transcript" }).click();
  await expect(page.getByText("Transcript saved")).toBeVisible();
  await reload(page);
  await expect(page.getByLabel("Transcript")).toHaveValue(/three alarms for 5am/);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download .txt" }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.txt$/);
  await page.getByRole("button", { name: "Run breakdown" }).click();
  await expect(page.getByTestId("ai-unavailable")).toContainText("unavailable");
  await setAi(runtime, true);
  await page.getByRole("button", { name: "Run breakdown" }).click();
  await expect(page.getByTestId("breakdown")).toContainText("fold-out desk");
  for (const heading of ["Hook", "Format", "Story structure", "Angle", "Why it outperformed", "How to reuse"]) {
    await expect(page.getByTestId("breakdown").getByText(heading, { exact: true })).toBeVisible();
  }
  await reload(page);
  await expect(page.getByTestId("breakdown")).toContainText("fold-out desk");
  await page.getByRole("button", { name: "Run again" }).click();
  await expect(page.getByTestId("breakdown")).toContainText("fold-out desk");

  // F004: hook templates and hooks.
  await open(page, "/hooks");
  await expect(page.getByRole("heading", { level: 1, name: "Hooks" })).toBeVisible();
  expect(await page.getByTestId("template-row").count()).toBeGreaterThan(3);
  await page.getByTestId("add-template").click();
  await page.getByRole("dialog").getByLabel("Template").fill("I stopped [habit] for [time frame] and my [result] changed.");
  await pickOption(page, page.getByTestId("template-category"), "Case study");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  const mine = page.getByTestId("template-row").filter({ hasText: "I stopped [habit]" });
  await expect(mine).toContainText("Case study");
  await mine.getByRole("button", { name: "Edit template" }).click();
  await page.getByRole("dialog").getByLabel("Template").fill("I quit [habit] for [time frame] and my [result] changed.");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  const edited = page.getByTestId("template-row").filter({ hasText: "I quit [habit]" });
  await expect(edited).toBeVisible();

  await edited.getByRole("button", { name: "Fill in" }).click();
  const fill = page.getByRole("dialog");
  await fill.getByLabel("habit").fill("early alarms");
  await fill.getByLabel("time frame").fill("a month");
  await fill.getByLabel("result").fill("energy");
  await expect(fill.getByTestId("hook-preview")).toHaveText("I quit early alarms for a month and my energy changed.");
  await fill.getByRole("button", { name: "Save hook" }).click();
  await expect(page.getByTestId("hook-row").filter({ hasText: "I quit early alarms for a month" })).toBeVisible();

  await page.getByLabel("Topic").fill("Home workouts for busy parents");
  await page.getByTestId("template-row").nth(0).getByRole("checkbox").click();
  await page.getByTestId("template-row").nth(1).getByRole("checkbox").click();
  await page.getByTestId("generate-hooks").click();
  await expect(page.getByTestId("generated-hook")).toHaveCount(3);
  await page.getByTestId("generated-hook").filter({ hasText: "Stop stretching before you lift" }).getByRole("button", { name: "Save" }).click();
  const saved = page.getByTestId("hook-row").filter({ hasText: "Stop stretching before you lift" });
  await expect(saved).toBeVisible();
  await saved.getByRole("button", { name: "Edit hook" }).click();
  await page.getByRole("dialog").getByLabel("Hook").fill("Stop stretching before you lift. Do these two moves instead.");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("hook-row").filter({ hasText: "Do these two moves instead" })).toBeVisible();
  await page.getByTestId("hook-row").filter({ hasText: "I quit early alarms" }).getByRole("button", { name: "Delete hook" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("hook-row")).toHaveCount(1);
  await edited.getByRole("button", { name: "Delete template" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("template-row").filter({ hasText: "I quit [habit]" })).toHaveCount(0);

  // F005: scripts, started from the video.
  await open(page, videoUrl);
  await page.getByRole("link", { name: "Write a script" }).click();
  const create = page.getByRole("dialog");
  await create.getByLabel("Title").fill("Quit 5am workouts");
  await create.getByLabel("Idea").fill("Why evening training beats dragging yourself out of bed");
  await pickOption(page, page.getByTestId("script-framework"), "Story");
  await expect(page.getByTestId("script-source")).toContainText("Why I quit 5am workouts");
  await Promise.all([page.waitForURL(/\/scripts\/[^/]+$/), create.getByRole("button", { name: "Create" }).click()]);
  await expect(page.getByRole("heading", { level: 1, name: "Quit 5am workouts" })).toBeVisible();
  await page.getByTestId("draft-script").click();
  await expect(page.getByLabel("Hook")).toHaveValue("You don't need a gym to get strong at home.");
  await expect(page.getByLabel("Call to action")).toHaveValue("Follow for tomorrow's routine.");
  await page.getByTestId("expand-script").click();
  await expect(page.getByLabel("Body")).toHaveValue(/Add one rep a week/);
  await page.getByLabel("Title").fill("Evening training beats 5am");
  await page.getByLabel("Call to action").fill("Comment EVENING and I'll send the plan.");
  await page.getByTestId("save-script").click();
  await expect(page.getByText("Script saved")).toBeVisible();
  await reload(page);
  await expect(page.getByRole("heading", { level: 1, name: "Evening training beats 5am" })).toBeVisible();
  await expect(page.getByLabel("Call to action")).toHaveValue("Comment EVENING and I'll send the plan.");
  const scriptUrl = page.url();
  await open(page, "/scripts");
  await expect(page.getByTestId("script-row").filter({ hasText: "Evening training beats 5am" })).toContainText("Story");
  await page.getByTestId("new-script").click();
  await page.getByRole("dialog").getByLabel("Title").fill("Throwaway");
  await page.getByRole("dialog").getByLabel("Idea").fill("Draft to delete");
  await Promise.all([page.waitForURL(/\/scripts\/[^/]+$/), page.getByRole("dialog").getByRole("button", { name: "Create" }).click()]);
  await page.getByRole("button", { name: "Delete script" }).click();
  await Promise.all([page.waitForURL(/\/scripts$/), page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click()]);
  await expect(page.getByTestId("script-row")).toHaveCount(1);

  // F006: projects.
  await open(page, "/projects");
  await page.getByTestId("new-project").click();
  await page.getByRole("dialog").getByLabel("Name").fill("January series");
  await page.getByRole("dialog").getByRole("button", { name: "Create" }).click();
  const projectRow = page.getByTestId("project-row").filter({ hasText: "January series" });
  await expect(projectRow).toBeVisible();
  await open(page, videoUrl);
  await page.getByRole("button", { name: "Add to project" }).click();
  await pickOption(page, page.getByTestId("project-select"), "January series");
  await page.getByRole("dialog").getByLabel("Note").fill("Open the series with this one");
  await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Added to January series")).toBeVisible();
  await page.getByRole("button", { name: "Add to project" }).click();
  await pickOption(page, page.getByTestId("project-select"), "January series");
  await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("dialog")).toContainText("Already in this project");
  await page.keyboard.press("Escape");
  await open(page, scriptUrl);
  await page.getByRole("button", { name: "Add to project" }).click();
  await pickOption(page, page.getByTestId("project-select"), "January series");
  await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Added to January series")).toBeVisible();
  await open(page, "/hooks");
  await page.getByTestId("hook-row").first().getByRole("button", { name: "Add to project" }).click();
  await pickOption(page, page.getByTestId("project-select"), "January series");
  await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Added to January series")).toBeVisible();

  await open(page, "/projects");
  await page.getByTestId("project-row").filter({ hasText: "January series" }).getByRole("link", { name: "January series" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "January series" })).toBeVisible();
  const videos = page.getByTestId("project-group-video");
  await expect(videos.getByRole("link", { name: "Why I quit 5am workouts" })).toBeVisible();
  await expect(videos).toContainText("Open the series with this one");
  await expect(page.getByTestId("project-group-script").getByRole("link", { name: "Evening training beats 5am" })).toBeVisible();
  await expect(page.getByTestId("project-group-hook")).toContainText("Do these two moves instead");
  await page.getByTestId("project-group-hook").getByRole("button", { name: "Remove from project" }).click();
  await expect(page.getByTestId("project-group-hook")).toHaveCount(0);
  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("January kettlebell series");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "January kettlebell series" })).toBeVisible();
  await videos.getByRole("link", { name: "Why I quit 5am workouts" }).click();
  await expect(page).toHaveURL(videoUrl);

  // Phone-sized smoke.
  const phone = await (await runtime.context("owner", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await open(phone, "/");
  await expect(phone.getByTestId("workspace-row").filter({ hasText: "Home workouts" })).toBeVisible();
  await open(phone, `/workspaces/${workspaceId}/feed`);
  await expect(phone.getByTestId("feed-row").first()).toBeVisible();

  // End on the feed, the app's main result.
  await open(page, `/workspaces/${workspaceId}/feed`);
  await expect(page.getByTestId("feed-row").nth(2)).toContainText("Why I quit 5am workouts");
  await runtime.assertBackLink(page);
  await runtime.screenshot(page);
} finally {
  await runtime.close();
}
