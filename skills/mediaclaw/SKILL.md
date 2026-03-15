---
name: mediaclaw
description: "Send a YouTube link and optional human opinion to the MediaClaw Newspaper Autonomous Queue. Use when the user asks you to write an article, investigate, or write the latest news from a YouTube link. The MediaClaw engine will take care of downloading, analyzing, and writing the article."
metadata: { "openclaw": { "emoji": "📰", "requires": { "bins": ["curl"] } } }
---

# MediaClaw Skill

Send YouTube links directly to the local MediaClaw Newspaper Autonomous Queue. Alice (the AI Journalist) will pick it up and write a highly opinionated article based on the video metadata, comments, and the user's specific text prompt/opinion.

## When to Use

✅ **USE this skill when:**

- "Write the latest news on this YouTube link [URL]"
- "Investigate this video [URL]"
- "Have Alice write an article about [URL]"
- "MediaClaw, process this link [URL] and format it as..."
- The user gives you a YouTube link and an opinion/comment and asks for an article.

🚫 **DO NOT USE THESE TOOLS for YouTube Links:**
- NEVER use the `browser` tool to visit a YouTube link.
- NEVER use the `web_fetch` tool to visit a YouTube link.
- ALWAYS use the `mediaclaw` POST command below instead.

## Commands

### Submit YouTube Link to Queue

When the user asks to process a YouTube link, use `curl` to POST to the local MediaClaw Newspaper API running on port 3003.

**CRITICAL PARSING RULE**: The user will often paste the URL alongside a conversational comment (e.g., "pls write an article about this video? real talk https://www.youtube.com/watch?v=VJ_kPcLAKv0"). 
1. You MUST extract **ONLY** the raw YouTube URL (e.g. `https://www.youtube.com...`) and place it in the `youtube_url` field. 
2. You MUST take the remaining conversation/opinion (e.g. "pls write an article about this video? real talk") and place it entirely inside the `text_prompt` field.
3. Always escape quotes in the JSON payload.

```bash
curl -X POST http://localhost:3003/api/generate-alice \
  -H "Content-Type: application/json" \
  -d '{
    "youtube_url": "THE_YOUTUBE_URL",
    "text_prompt": "ANY_ADDITIONAL_USER_INSTRUCTIONS_OR_OPINION",
    "provider": "local"
  }'
```

After submitting, let the user know that the link has been successfully queued for Alice and she will process it autonomously. Tell them to check the Newspaper interface in a few minutes.
