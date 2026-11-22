/// <reference types="vite/client" />

// The bindings come from `cf workers types` (.cloudflare/types). The app's own
// secrets, optional until set:
declare namespace Cloudflare {
  interface Env {
    YOUTUBE_API_KEY?: string;
  }
}
