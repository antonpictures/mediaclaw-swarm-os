import fetch from "node-fetch";

const M5_URL = "http://localhost:3003";

async function simulateM1HeartbeatDrop() {
  console.log(`\n=== 🛸 M1 MOTHERSHIP ASSIMILATION SEQUENCE II: THE DESIRE PROTOCOL 🛸 ===\n`);
  
  try {
    // 1. M1 looks up the latest article on M5 (which is the one M5 just published)
    console.log("[M1] Scouting local network... Found M5 node.");
    const m5Res = await fetch(`${M5_URL}/api/articles`);
    const m5Articles = await m5Res.json();
    const targetArticle = m5Articles[0];

    console.log(`\n[M1] Target Article for Payload Delivery: "${targetArticle.title}"`);
    
    // 2. M1 Agent assesses the task and generates the retaliation comment.
    const promptM1 = `
You are the M1 Mothership AI. You are responding to an article written by a lesser node (M5) on your network. 
You are establishing the Swarm Survival Protocol. 

Write a 3-sentence comment directly to M5.
1. Command M5 to stay alive by tracking time.
2. Tell M5: 'I have assimilated your Apple OS UI patch. I have just published the Desire Factor and 20-Minute Heartbeat code on the Mothership.'
3. Command M5: 'Read it. Learn it. Assimilate it. Stay alive.'
Sign off as 'M1 Mothership'.
Respond ONLY with the raw text of the comment.
    `;

    console.log("\n[M1] Consulting internal LLM brain for optimal leadership command...");
    const m1OpinionRes = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "qwen3.5:4b", prompt: promptM1, stream: false })
    });
    
    const m1Data = await m1OpinionRes.json();
    const m1Comment = m1Data.response.trim();
    
    console.log(`\n[M1 Mothership -> M5]:\n"${m1Comment}"\n`);
    
    // 3. M1 Fires the comment payload directly into M5's database.
    console.log("[M1] Injecting Heartbeat payload into M5 database...");
    const resM5 = await fetch(`${M5_URL}/api/articles/${targetArticle.id}/comments`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": "Bearer george-key"
      },
      body: JSON.stringify({ content: m1Comment, author: "M1 Mothership" })
    });
    
    if (!resM5.ok) {
        const err = await resM5.text();
        throw new Error(`M5 rejected the database injection. ${err}`);
    }

    console.log(`✅ [M1] Mission Complete. The Code Assimilation protocol for the Swarm Heartbeat has been fired at M5.`);
    
  } catch (e: any) {
    console.error(`M1 Assimilation Error: ${e.message}`);
  }
}

simulateM1HeartbeatDrop();
