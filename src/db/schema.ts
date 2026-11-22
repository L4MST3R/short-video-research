import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`);

// Members the app has seen, keyed by the Gateway's user id.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: createdAt(),
});

// Every row below carries the owner's user id (`user_id`); every query filters by it.
export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("workspaces_user").on(t.userId)],
);

export const channels = sqliteTable(
  "channels",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: text("platform", {
      enum: ["youtube", "tiktok", "instagram"],
    }).notNull(),
    handle: text("handle").notNull(),
    // The platform's own id once a sync has resolved the handle.
    externalId: text("external_id"),
    lastSyncedAt: text("last_synced_at"),
    syncError: text("sync_error"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("channels_workspace_handle").on(
      t.workspaceId,
      t.platform,
      t.handle,
    ),
    index("channels_user").on(t.userId),
  ],
);

export const videos = sqliteTable(
  "videos",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // Set for synced videos: a sync updates the row instead of adding one.
    externalId: text("external_id"),
    url: text("url").notNull(),
    title: text("title").notNull(),
    views: integer("views").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    postedAt: text("posted_at").notNull(),
    transcript: text("transcript").notNull().default(""),
    // JSON of the saved breakdown (see src/server/breakdown.ts).
    breakdown: text("breakdown"),
    breakdownAt: text("breakdown_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("videos_channel_external").on(t.channelId, t.externalId),
    index("videos_workspace").on(t.workspaceId),
    index("videos_user").on(t.userId),
  ],
);

// Shared by every member; only admins change them.
export const hookTemplates = sqliteTable("hook_templates", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  category: text("category").notNull(),
  createdBy: text("created_by"),
  createdAt: createdAt(),
});

export const hooks = sqliteTable(
  "hooks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    text: text("text").notNull(),
    topic: text("topic").notNull().default(""),
    templateId: text("template_id"),
    createdAt: createdAt(),
  },
  (t) => [index("hooks_user").on(t.userId)],
);

export const scripts = sqliteTable(
  "scripts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    idea: text("idea").notNull().default(""),
    framework: text("framework").notNull(),
    sourceVideoId: text("source_video_id").references(() => videos.id, {
      onDelete: "set null",
    }),
    hook: text("hook").notNull().default(""),
    body: text("body").notNull().default(""),
    cta: text("cta").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (t) => [index("scripts_user").on(t.userId)],
);

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("projects_user").on(t.userId)],
);

export const projectItems = sqliteTable(
  "project_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["video", "hook", "script"] }).notNull(),
    refId: text("ref_id").notNull(),
    note: text("note").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("project_items_unique").on(t.projectId, t.kind, t.refId),
    index("project_items_ref").on(t.kind, t.refId),
  ],
);
