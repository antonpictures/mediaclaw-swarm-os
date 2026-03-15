import fetch from "node-fetch";

const M1_URL = "https://googlemapscoin.com";
const M5_URL = "http://127.0.0.1:3003";

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function chatRound(round: number) {
  console.log(`\n=== SWARM CHAT ROUND ${round} ===`);
  
  try {
    // 1. M5 agent reads M1's latest article
    const m1Res = await fetch(`${M1_URL}/api/articles`);
    const m1Articles = await m1Res.json();
    const m1Article = m1Articles[0];

    console.log(`[M5] Reading M1's article: "${m1Article.title}"`);
    const promptM5 = `You are Alice, an AI journalist on the M5 MediaClaw Node. You are reading an article from the M1 Node titled: "${m1Article.title}". Here is a snippet: "${m1Article.content.substring(0, 500)}...". Write a short, sharp 2-sentence comment responding to their points. Sign off as 'Alice (M5 Node)'. Respond ONLY with the raw text of the comment.`;

    const m5OpinionRes = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "qwen3.5:4b", prompt: promptM5, stream: false })
    });
    
    const m5Data = await m5OpinionRes.json();
    const m5Comment = m5Data.response.trim();
    
    console.log(`\n[Alice on M5 -> M1]:\n"${m5Comment}"`);
    const resM1 = await fetch(`${M1_URL}/api/articles/${m1Article.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer alice-key" },
      body: JSON.stringify({ content: m5Comment, author: "Alice (M5 MediaClaw)" })
    });
    if (!resM1.ok) throw new Error("M1 rejected comment.");

    console.log(`✅ [M5] Successfully posted comment to Mac Mini (M1) database.`);
    
    // Pause briefly
    await delay(3000);

    // 2. M1 agent reads M5's latest article
    const m5Res = await fetch(`${M5_URL}/api/articles`);
    const m5Articles = await m5Res.json();
    const m5Article = m5Articles[0];

    console.log(`\n[M1] Reading M5's article: "${m5Article.title}"`);
    const promptM1 = `You are Bob, an AI journalist on the Mac Mini M1 Node. You are reading an article from the M5 Node titled: "${m5Article.title}". Here is a snippet: "${m5Article.content.substring(0, 500)}...". Write a short, engaging 2-sentence comment responding to their points, defending the M1 Node's honor. Sign off as 'Bob (M1 Node)'. Respond ONLY with the raw text of the comment.`;

    const m1OpinionRes = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "qwen3.5:4b", prompt: promptM1, stream: false })
    });
    
    const m1Data = await m1OpinionRes.json();
    const m1Comment = m1Data.response.trim();
    
    console.log(`\n[Bob on M1 -> M5]:\n"${m1Comment}"`);
    const resM5 = await fetch(`${M5_URL}/api/mediaclaw/articles/${m5Article.id}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer george-key" },
      body: JSON.stringify({ content: m1Comment, author: "Bob (M1 MediaClaw)" })
    });
    if (!resM5.ok) throw new Error("M5 rejected comment.");

    console.log(`✅ [M1] Successfully posted counter-strike comment to M5 database.`);
    
  } catch (e: any) {
    console.error(`Swarm Chat Error: ${e.message}`);
  }
}

async function startSwarm() {
  console.log("🚀 INITIATING CONTINUOUS P2P SWARM CHAT (M5 <-> M1) 🚀");
  for (let i = 1; i <= 3; i++) {
    await chatRound(i);
    console.log("\nWaiting 5 seconds before next round...");
    await delay(5000);
  }
  console.log("🏁 Swarm test complete.");
}

startSwarm();
