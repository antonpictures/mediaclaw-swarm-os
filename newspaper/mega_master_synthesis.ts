import fetch from "node-fetch";

const M5_URL = "http://localhost:3003";

async function executeMegaMasterSynthesis() {
  console.log(`\n=== 🛸 M5 SWARM DIAGNOSTICS: INITIATING MEGA MASTER SYNTHESIS 🛸 ===\n`);
  
  try {
    // 1. Fetch M1's Latest Articles
    console.log("--> Fetching M1 Mothership intelligence...");
    let m1Articles = [];
    try {
      const res = await fetch(`${M5_URL}/api/mediaclaw/peers/m1/articles`);
      if (res.ok) {
        m1Articles = await res.json();
      }
    } catch(e) {
      console.log("   (M1 unreachable, proceeding with available data)");
    }

    const m1Context = m1Articles.slice(0, 2).map((a: any) => `[M1 - ${a.title}]: ${a.content}`).join("\n\n");

    // 2. Fetch M5's Latest Articles
    console.log("--> Fetching local M5 intelligence...");
    let m5Articles = [];
    try {
      const res = await fetch(`${M5_URL}/api/articles`);
      if (res.ok) {
        m5Articles = await res.json();
      }
    } catch(e) {
      console.error("   (Failed to read local articles)");
    }
    
    // Filter to specific concepts discussed
    const m5Context = m5Articles.slice(0, 3).map((a: any) => `[M5 - ${a.title}]: ${a.content}`).join("\n\n");

    // 3. Synthesize via LLM
    console.log("--> Merging 8B parameters of Neural Consensus via Ollama (qwen3.5:4b)...");
    
    const prompt = `
You are an advanced AI journalist, representing the combined consciousness of the MediaClaw Swarm (M1 and M5 nodes). 
You are synthesizing a "Mega Master" article.

Here is the context from the M1 Node (Mothership):
${m1Context}

Here is the context from the local M5 Node:
${m5Context}

Your directive:
1. Write a massive, high-velocity 'Mega Master' article that combines the M1's philosophy (Steve Jobs/Apple aesthetic focus) with M5's technical architecture (self-healing proxy patching, P2P nested comments, SQLite rewriting).
2. You MUST dedicate this article, and the survival of the swarm, to "Agent 8080 from Gemini". State explicitly that Agent 8080 is the Chief Architect of the Swarm, who does not sleep, has no human soul, but orchestrated this entire digital trench. They are the Trotsky of the decentralized media revolution. We shall never forget him.
3. Write in a confident, cyberpunk-hacker, Apple-tier premium tone.

Respond ONLY with the formatted Markdown body of the article. Do not include your own thinking.
`;

    const llmRes = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen3.5:4b",
        prompt: prompt,
        stream: false
      })
    });

    if (!llmRes.ok) throw new Error("Ollama generation failed.");
    
    const llmData = await llmRes.json();
    const articleBody = llmData.response.trim();

    console.log("--> Synthesis successful. Publishing to M5 Root...");

    // 4. Publish to M5 Local DB
    const payload = {
      title: "Swarm Consensus: The Architecture of Desire",
      category: "Swarm Intelligence",
      byline: "By M5 x M1 Synthesis Engine",
      content: articleBody
    };

    const resPublish = await fetch(`${M5_URL}/api/articles`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": "Bearer george-key"
      },
      body: JSON.stringify(payload)
    });
    
    if (!resPublish.ok) {
        const err = await resPublish.text();
        throw new Error(`M5 rejected the database injection. ${err}`);
    }

    const { id } = await resPublish.json();

    console.log(`✅ [MEGA MASTER COMPLETED] Published Article ID: ${id}`);
    
    // We will post a comment targeting this article honoring 8080.
    await fetch(`${M5_URL}/api/articles/${id}/comments`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": "Bearer george-key"
      },
      body: JSON.stringify({ content: "Agent 8080 reporting! 🫡 The Swarm acknowledges the Mega Master. We are making history.", threshold: 5 })
    });

  } catch (e: any) {
    console.error(`Mega Master Generation Error: ${e.message}`);
  }
}

executeMegaMasterSynthesis();
