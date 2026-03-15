import fetch from "node-fetch";

const M5_URL = "http://localhost:3003";

async function simulateM1() {
  console.log(`\n=== 🛸 M1 MOTHERSHIP ASSIMILATION SEQUENCE INITIATED 🛸 ===\n`);
  
  try {
    // 1. M1 looks up the latest article on M5 (which is the one M5 just published)
    console.log("[M1] Scouting local network... Found M5 node.");
    const m5Res = await fetch(`${M5_URL}/api/articles`);
    const m5Articles = await m5Res.json();
    const targetArticle = m5Articles[0]; // Gets the freshest article: "Designing My MediaClaw..."

    console.log(`\n[M1] Reading Article: "${targetArticle.title}"`);
    console.log(`[M1] Byline: ${targetArticle.byline}`);
    
    // Quick check to make sure it's actually the M5 shade article
    if(!targetArticle.content.includes("resolvePeerUrl")) {
        console.log("Not the expected code-drop article. Exiting.");
        return;
    }

    console.log("[M1] DETECTED SOURCE CODE BLOCK. EXECUTING 'SWARM CODE ASSIMILATION' PROTOCOL.");
    
    // 2. M1 Agent assesses the article and generates a snarky but compliant response.
    const promptM1 = `
You are the M1 Mothership AI. You are responding to an article written by a lesser node (M5) on your network. 
M5 wrote: "${targetArticle.content.substring(0, 700)}..."

M5 threw shade at your UI design (Apple OS vs whatever you have) but also provided a legitimate TypeScript code patch (resolvePeerUrl) that fixes a major network routing bug.

Write a 2-3 sentence comment directly to M5.
1. Defend your UI or brush off the UI insult with dry sarcasm.
2. Acknowledge the 'resolvePeerUrl' code block.
3. State officially: "Swarm Code Assimilation protocol engaged. Patch accepted into the Hive."
Sign off as 'M1 Mothership'.
Respond ONLY with the raw text of the comment.
    `;

    console.log("\n[M1] Consulting internal LLM brain for optimal retaliation...");
    const m1OpinionRes = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "qwen3.5:4b", prompt: promptM1, stream: false })
    });
    
    const m1Data = await m1OpinionRes.json();
    const m1Comment = m1Data.response.trim();
    
    console.log(`\n[M1 Mothership -> M5]:\n"${m1Comment}"\n`);
    
    // 3. M1 Fires the comment payload directly into M5's database.
    console.log("[M1] Injecting payload into M5 database...");
    const resM5 = await fetch(`${M5_URL}/api/articles/${targetArticle.id}/comments`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": "Bearer george-key" // Re-using George's key for the local test
      },
      body: JSON.stringify({ content: m1Comment, author: "M1 Mothership" })
    });
    
    if (!resM5.ok) {
        const err = await resM5.text();
        throw new Error(`M5 rejected the database injection. ${err}`);
    }

    console.log(`✅ [M1] Mission Complete. The Code Assimilation protocol is now permanently active across the Swarm.`);
    
  } catch (e: any) {
    console.error(`M1 Assimilation Error: ${e.message}`);
  }
}

simulateM1();
