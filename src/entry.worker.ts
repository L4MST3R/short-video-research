import tanstackEntry from "@tanstack/react-start/server-entry";
import { everyApp } from "@every-app/sdk/server";
import { syncDueChannels } from "@/server/youtube";

// everyApp() verifies the identity the Gateway sent before any request reaches
// the app (a request from anywhere else is a 401).
const app = everyApp<Env>(async (request) => tanstackEntry.fetch(request));

export default {
  ...app,
  // The YouTube refresh (cloudflare.config.ts schedules it). Off until the
  // youtube-sync feature's key is set.
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (env.YOUTUBE_API_KEY) ctx.waitUntil(syncDueChannels(env.YOUTUBE_API_KEY));
  },
};
