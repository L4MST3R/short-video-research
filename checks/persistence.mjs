// Persistence: what members write survives a restart of the Workers.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { addChannel, addVideo, createWorkspace, daysAgo, open, reload } from "./lib.mjs";

const runtime = await startRuntime();
try {
  let page = await (await runtime.context("owner")).newPage();
  const workspaceId = await createWorkspace(page, "Meal prep");
  await addChannel(page, "Instagram", "@prepwithjo");
  await page.getByRole("link", { name: "@prepwithjo" }).click();
  await addVideo(page, { url: "https://www.instagram.com/reel/abc/", title: "Five lunches, one tray", views: 42000, posted: daysAgo(4) });
  await page.getByRole("link", { name: "Five lunches, one tray" }).click();
  const videoPath = new URL(page.url()).pathname;
  await page.getByLabel("Transcript").fill("Everything goes on one tray at 200 degrees.");
  await page.getByRole("button", { name: "Save transcript" }).click();
  await expect(page.getByText("Transcript saved")).toBeVisible();
  await open(page, "/projects");
  await page.getByTestId("new-project").click();
  await page.getByRole("dialog").getByLabel("Name").fill("Sunday batch series");
  await page.getByRole("dialog").getByRole("button", { name: "Create" }).click();
  await expect(page.getByTestId("project-row").filter({ hasText: "Sunday batch series" })).toBeVisible();

  await runtime.restart();

  page = await (await runtime.context("owner")).newPage();
  await open(page, "/");
  await expect(page.getByTestId("workspace-row").filter({ hasText: "Meal prep" })).toBeVisible();
  await open(page, `/workspaces/${workspaceId}/feed`);
  await expect(page.getByTestId("feed-row").filter({ hasText: "Five lunches, one tray" })).toBeVisible();
  await open(page, videoPath);
  await expect(page.getByLabel("Transcript")).toHaveValue("Everything goes on one tray at 200 degrees.");
  await open(page, "/projects");
  await expect(page.getByTestId("project-row").filter({ hasText: "Sunday batch series" })).toBeVisible();
} finally {
  await runtime.close();
}
