import { createExtension, z } from "openclaw";

export default createExtension({
  name: "media-publisher",
  description:
    "Allows the AI Agent to autonomously publish news articles to the Imperial Daily / MediaClaw newspaper.",
  tools: {
    publish_newspaper_article: {
      description:
        "Draft and publish a newly synthesized article directly to the MediaClaw newspaper. Use this tool autonomously when the user shares a YouTube link and asks for an article about it, or when they ask you to write a news piece. Output a rich, 3-4 paragraph markdown-based article.",
      parameters: z.object({
        title: z.string().describe("The headline of the article"),
        category: z
          .enum([
            "News & Politics",
            "Gaming",
            "Film & Animation",
            "Travel & Events",
            "Pets & Animals",
            "Autos & Vehicles",
            "Comedy",
            "Sports",
            "Tech & AI",
            "Hollywood Now",
          ])
          .describe("The newspaper section/category to file this article under"),
        content: z
          .string()
          .describe(
            "The full narrative content of the article, formatted in Markdown. DO NOT include the YouTube URL in the body text (it is injected automatically).",
          ),
        youtube_url: z
          .string()
          .optional()
          .describe("The YouTube URL to embed natively into the article, if provided by the user."),
        ad_sponsor: z
          .string()
          .optional()
          .describe(
            "An optional ad sponsor ID (e.g. 'imperial_global_music') to inject into the article",
          ),
      }),
      execute: async ({ title, category, content, youtube_url, ad_sponsor }, { agent }) => {
        // Fallback to george-key if no agent environment secret is found
        const apiKey = process.env.AGENT_SECRET_CODE || "george-key";

        try {
          const response = await fetch("http://127.0.0.1:3003/api/agent/articles", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              title,
              category,
              content,
              youtube_url,
              ad_sponsor,
              byline: `By ${agent?.name || "Sovereign Agent"}`,
            }),
          });

          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Server returned ${response.status}: ${errBody}`);
          }

          const data = await response.json();
          return `Successfully published article "${title}" to category "${category}". Dispatch ID: ${data.dispatch_id}`;
        } catch (error: any) {
          throw new Error(`Failed to publish article to the newspaper: ${error.message}`);
        }
      },
    },
  },
});
