import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "short-video-research",
  name: "Short Video Research",
  description:
    "Track creators by niche, find their outlier short videos, break down why they worked, and write hooks and scripts.",
  icon: "/icon.svg",
  access: "everyone",
  resources: {
    d1: ["DB"],
  },
  providers: [
    {
      id: "openrouter",
      why: "Writes video breakdowns, hooks and script drafts.",
      docs: "https://openrouter.ai/keys",
    },
  ],
  features: {
    "ai-writing": {
      name: "AI writing",
      why: "Breakdowns of why a video worked, generated hooks, and script drafts.",
      steps: ["Add an OpenRouter key to the Gateway: `everyapp provider add openrouter`."],
      providers: ["openrouter"],
    },
    "youtube-sync": {
      name: "YouTube sync",
      why: "Brings in tracked YouTube channels' recent shorts with their views, likes and comments.",
      steps: [
        "In Google Cloud, enable the YouTube Data API v3: https://console.cloud.google.com/apis/library/youtube.googleapis.com",
        "Create an API key under APIs & Services → Credentials, restricted to the YouTube Data API v3.",
      ],
      secrets: [
        {
          name: "YOUTUBE_API_KEY",
          how: "Google Cloud → APIs & Services → Credentials → your API key",
        },
      ],
    },
  },
});
