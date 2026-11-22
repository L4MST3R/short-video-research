// Authorization: who may open and change what.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { addChannel, addVideo, captureServerCall, createWorkspace, daysAgo, pickOption, open, reload } from "./lib.mjs";

const runtime = await startRuntime();
try {
  // Anonymous and outsiders are refused everywhere; members of the organization get in.
  await runtime.assertPrivateAccess(["/", "/hooks", "/scripts", "/projects"]);

  // The owner builds private objects.
  const owner = await (await runtime.context("owner")).newPage();
  const workspaceId = await createWorkspace(owner, "Private niche Alpha");
  await addChannel(owner, "TikTok", "@alpha.creator");
  await owner.getByRole("link", { name: "@alpha.creator" }).click();
  const channelId = new URL(owner.url()).pathname.split("/").pop();
  await addVideo(owner, { url: "https://www.tiktok.com/@alpha.creator/video/1", title: "Alpha secret video", views: 1000, posted: daysAgo(3) });
  await owner.getByRole("link", { name: "Alpha secret video" }).click();
  const videoPath = new URL(owner.url()).pathname;
  await owner.getByLabel("Transcript").fill("ALPHA-TRANSCRIPT-TEXT");
  const saveTranscript = await captureServerCall(owner, () => owner.getByRole("button", { name: "Save transcript" }).click());
  await expect(owner.getByText("Transcript saved")).toBeVisible();

  await open(owner, "/scripts");
  await owner.getByTestId("new-script").click();
  await owner.getByRole("dialog").getByLabel("Title").fill("Alpha private script");
  await owner.getByRole("dialog").getByLabel("Idea").fill("ALPHA-IDEA");
  await Promise.all([owner.waitForURL(/\/scripts\/[^/]+$/), owner.getByRole("dialog").getByRole("button", { name: "Create" }).click()]);
  const scriptPath = new URL(owner.url()).pathname;

  await open(owner, "/projects");
  await owner.getByTestId("new-project").click();
  await owner.getByRole("dialog").getByLabel("Name").fill("Alpha project");
  await owner.getByRole("dialog").getByRole("button", { name: "Create" }).click();
  await owner.getByRole("link", { name: "Alpha project" }).click();
  const projectPath = new URL(owner.url()).pathname;

  // Another member can't read any of it, by page or by list.
  for (const path of [`/workspaces/${workspaceId}`, `/workspaces/${workspaceId}/feed`, `/channels/${channelId}`, videoPath, scriptPath, projectPath]) {
    const response = await runtime.fetch(path, { role: "member" });
    const html = await response.text();
    expect(response.status, path).toBe(404);
    for (const secret of ["Private niche Alpha", "@alpha.creator", "Alpha secret video", "ALPHA-TRANSCRIPT-TEXT", "Alpha private script", "ALPHA-IDEA", "Alpha project"]) {
      expect(html.includes(secret), `${path} leaks ${secret}`).toBe(false);
    }
  }
  for (const path of ["/", "/scripts", "/projects", "/hooks"]) {
    const html = await (await runtime.fetch(path, { role: "member" })).text();
    for (const secret of ["Private niche Alpha", "Alpha private script", "Alpha project"]) expect(html.includes(secret), `${path} leaks ${secret}`).toBe(false);
  }
  const member = await (await runtime.context("member")).newPage();
  await open(member, "/");
  await expect(member.getByText("No workspaces yet")).toBeVisible();
  await open(member, videoPath);
  await expect(member.getByTestId("not-found")).toBeVisible();

  // Nor change it: the owner's own request, replayed as the member, changes nothing.
  const replay = await runtime.fetch(saveTranscript.path, { role: "member", method: "POST", headers: saveTranscript.headers, body: saveTranscript.body.replace("ALPHA-TRANSCRIPT-TEXT", "CHANGED-BY-MEMBER") });
  expect(replay.status).not.toBe(500);
  const db = await runtime.database();
  const row = await db.prepare("select transcript from videos where title = ?").bind("Alpha secret video").first();
  expect(row.transcript).toBe("ALPHA-TRANSCRIPT-TEXT");
  // The same request as the owner does work, so the replay itself is sound.
  const ownReplay = await runtime.fetch(saveTranscript.path, { role: "owner", method: "POST", headers: saveTranscript.headers, body: saveTranscript.body.replace("ALPHA-TRANSCRIPT-TEXT", "ALPHA-TRANSCRIPT-V2") });
  expect(ownReplay.status).toBe(200);
  const row2 = await db.prepare("select transcript from videos where title = ?").bind("Alpha secret video").first();
  expect(row2.transcript).toBe("ALPHA-TRANSCRIPT-V2");

  // A member can't add to a project of someone else's, nor put someone else's item in their own.
  await open(member, "/projects");
  await member.getByTestId("new-project").click();
  await member.getByRole("dialog").getByLabel("Name").fill("Beta project");
  await member.getByRole("dialog").getByRole("button", { name: "Create" }).click();
  await expect(member.getByTestId("project-row")).toHaveCount(1);
  await open(owner, videoPath);
  await owner.getByRole("button", { name: "Add to project" }).click();
  await pickOption(owner, owner.getByTestId("project-select"), "Alpha project");
  const addItem = await captureServerCall(owner, () => owner.getByRole("dialog").getByRole("button", { name: "Add" }).click());
  await expect(owner.getByText("Added to Alpha project")).toBeVisible();
  const before = (await db.prepare("select count(*) as n from project_items").first()).n;
  const betaId = (await db.prepare("select id from projects where name = ?").bind("Beta project").first()).id;
  const alphaId = (await db.prepare("select id from projects where name = ?").bind("Alpha project").first()).id;
  await runtime.fetch(addItem.path, { role: "member", method: "POST", headers: addItem.headers, body: addItem.body.replaceAll(alphaId, betaId) });
  await runtime.fetch(addItem.path, { role: "member", method: "POST", headers: addItem.headers, body: addItem.body });
  expect((await db.prepare("select count(*) as n from project_items").first()).n).toBe(before);

  // Hook templates: everyone reads them, only admins change them.
  await open(member, "/hooks");
  expect(await member.getByTestId("template-row").count()).toBeGreaterThan(0);
  await expect(member.getByTestId("add-template")).toHaveCount(0);
  await expect(member.getByRole("button", { name: "Edit template" })).toHaveCount(0);
  await expect(member.getByRole("button", { name: "Delete template" })).toHaveCount(0);
  await open(owner, "/hooks");
  await owner.getByTestId("add-template").click();
  await owner.getByRole("dialog").getByLabel("Template").fill("Admin only [thing] template");
  const addTemplate = await captureServerCall(owner, () => owner.getByRole("dialog").getByRole("button", { name: "Save" }).click());
  await expect(owner.getByTestId("template-row").filter({ hasText: "Admin only [thing] template" })).toBeVisible();
  const templates = (await db.prepare("select count(*) as n from hook_templates").first()).n;
  const refused = await runtime.fetch(addTemplate.path, { role: "member", method: "POST", headers: addTemplate.headers, body: addTemplate.body.replace("Admin only", "Member made") });
  expect(refused.status).not.toBe(200);
  expect((await db.prepare("select count(*) as n from hook_templates").first()).n).toBe(templates);
  await owner.getByTestId("template-row").filter({ hasText: "Admin only [thing] template" }).getByRole("button", { name: "Delete template" }).click();
  const deleteTemplate = await captureServerCall(owner, () => owner.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click());
  // Recreate it and replay the delete as the member: refused, the row stays.
  await owner.getByTestId("add-template").click();
  await owner.getByRole("dialog").getByLabel("Template").fill("Admin only [thing] template");
  await owner.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(owner.getByTestId("template-row").filter({ hasText: "Admin only [thing] template" })).toBeVisible();
  const recreatedId = (await db.prepare("select id from hook_templates where text = ?").bind("Admin only [thing] template").first()).id;
  const oldId = /"([0-9a-f-]{36})"/.exec(deleteTemplate.body)?.[1];
  expect(oldId).toBeTruthy();
  const refusedDelete = await runtime.fetch(deleteTemplate.path, { role: "member", method: "POST", headers: deleteTemplate.headers, body: deleteTemplate.body.replace(oldId, recreatedId) });
  expect(refusedDelete.status).not.toBe(200);
  expect(await db.prepare("select id from hook_templates where id = ?").bind(recreatedId).first()).toBeTruthy();

  // The app has no sign-in of its own.
  for (const path of ["/login", "/signin", "/sign-in", "/signup", "/register", "/auth/login", "/logout"]) {
    const response = await runtime.fetch(path, { role: "owner" });
    expect(response.status, path).toBe(404);
  }
  await open(owner, "/");
  await expect(owner.locator('input[type="password"]')).toHaveCount(0);
  expect(await (await runtime.fetch("/", { role: "owner" })).headers.get("set-cookie")).toBeNull();
  // No route is public.
  for (const path of [`/workspaces/${workspaceId}`, videoPath, "/hooks"]) {
    expect([401, 403]).toContain((await runtime.fetch(path)).status);
  }
} finally {
  await runtime.close();
}
