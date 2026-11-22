# Short Video Research

Track short-form creators by niche, see which of their videos beat their usual views, and turn what worked into hooks and scripts of your own.

Inspired by https://sandcastles.ai

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Group tracked YouTube, TikTok and Instagram channels into one workspace per niche, with YouTube shorts synced automatically and any video added by hand.
- Rank a workspace's videos by outlier score (views over the channel's median), filtered by platform, posting date and minimum score.
- Keep a video's transcript and save an AI breakdown of its hook, format, structure, angle and why it worked.
- Write hooks from a shared template library, by hand or generated with AI.
- Draft scripts from an idea or a source video in a chosen storytelling framework, with AI or by hand.
- Collect videos, hooks and scripts into projects with notes.

Left out: accounts and sign-in, which your Gateway handles; a ready-made database of other creators' videos and curated collections; automatic TikTok and Instagram syncing; plans and credits; personal channel analytics; the AI assistant connector and API; niche trend reports.

## Setup

```sh
pnpm install
pnpm dev          # local app behind a local Gateway
pnpm test         # unit tests
pnpm run deploy   # deploy to your Cloudflare account behind your Gateway
```

Both settings are optional; everything else works without them. Set them with `pnpm everyapp configure short-video-research`:

- **AI writing**: an OpenRouter key on the Gateway (`everyapp provider add openrouter`). Powers breakdowns, generated hooks and script drafts.
- **YouTube sync**: `YOUTUBE_API_KEY`, a Google Cloud API key with the YouTube Data API v3 enabled. Brings in each tracked YouTube channel's recent shorts when it's added and every six hours.

The release checks (`checks/`) run against a packaged release with the oss.new runtime. Real AI and YouTube calls aren't part of them.

## Limitations

- TikTok and Instagram videos and their numbers are entered by hand.
- YouTube sync reads a channel's 50 most recent uploads and keeps those three minutes or shorter. It uses YouTube API quota from your key.
- Transcripts are pasted in; the app doesn't fetch them.
- Workspaces, videos, hooks, scripts and projects are private to each member; only the hook template library is shared.
