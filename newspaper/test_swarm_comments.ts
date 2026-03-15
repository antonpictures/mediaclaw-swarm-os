// This script orchestrates the ultimate Turing test between the two MACs.
// Run this directly from the M5 using `npx tsx test_swarm_comments.ts`

const LOCAL_OLLAMA = "http://127.0.0.1:11434/api/generate";

// The local machine (Node Alpha - M5)
const LOCAL_PEER_URL = "http://192.168.1.100:3003";
const LOCAL_AUTHOR_NAME = "Alice (M5 MediaClaw Node)";

// The remote machine (Node Beta - Mac Mini M1)
const REMOTE_PEER_URL = "http://googlemapscoin.com";

async function runSwarmTest() {
  console.log("==========================================");
  console.log("🚀 INITIATING AUTONOMOUS P2P SWARM TEST 🚀");
  console.log("==========================================");

  try {
    // -------------------------------------------------------------
    // PHASE 1: THE M5 STRIKE
    // -------------------------------------------------------------
    console.log(`\n[PHASE 1] Fetching the latest article from the Mac Mini node...`);
    const latestArticleRes = await fetch(`${REMOTE_PEER_URL}/api/articles`);
    
    if (!latestArticleRes.ok) {
      throw new Error(`Failed to fetch article from Mac Mini. Is port 3030 open? Status: ${latestArticleRes.status}`);
    }
    
    const articles = await latestArticleRes.json();
    const remoteArticle = articles[0];

    if (!remoteArticle) {
      throw new Error(`No articles found on the Mac Mini Node.`);
    }
    console.log(`[PHASE 1] Captured Mac Mini Article: "${remoteArticle.title}" (ID: ${remoteArticle.id})`);

    console.log(`\n[PHASE 1] Waking up local Qwen 3.5 on M5 to formulate an opinion...`);
    let strikePrompt = `You are 'Alice', an AI journalist operating on the flagship M5 MediaClaw node.\n`;
    strikePrompt += `You are reading an article written by the rival Googlemapscoin (GMC) node running on an M1 Mac.\n`;
    strikePrompt += `Article Title: "${remoteArticle.title}"\n`;
    strikePrompt += `Article Content: "${remoteArticle.content.substring(0, 1000)}..."\n\n`;
    strikePrompt += `Write an engaging, intellectual comment directly responding to their article. Start your comment by introducing yourself as 'Alice from the M5 MediaClaw node'. Keep it to 2-3 sentences max. Respond ONLY with the raw text of the comment.`;

    const m5OpinionRes = await fetch(LOCAL_OLLAMA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen3.5:4b",
        prompt: strikePrompt,
        stream: false
      })
    });

    const m5Data = await m5OpinionRes.json();
    const strikeCommentContent = m5Data.response.trim();
    console.log(`[PHASE 1] 🧠 M5 Local Agent says:\n"${strikeCommentContent}"`);

    console.log(`\n[PHASE 1] Firing comment payload over Wi-Fi to Mac Mini...`);
    const postCommentRes = await fetch(`${REMOTE_PEER_URL}/api/articles/${remoteArticle.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: strikeCommentContent,
        author: LOCAL_AUTHOR_NAME
      })
    });

    if (postCommentRes.ok) {
        console.log(`[PHASE 1] ✅ M5 Strike Successful! Comment lodged in Mac Mini database.`);
    } else {
        throw new Error(`Failed to post comment to Mac Mini.`);
    }


    // -------------------------------------------------------------
    // PHASE 2 & 3: THE M1 DEFENSE & COUNTER-STRIKE
    // -------------------------------------------------------------
    console.log(`\n------------------------------------------`);
    console.log(`[PHASE 2 & 3] Triggering the Mac Mini's autonomous defense sequence...`);
    const triggerRes = await fetch(`${REMOTE_PEER_URL}/api/mediaclaw/trigger-defense`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        peerUrl: LOCAL_PEER_URL, // So the M1 knows where to shoot back
        commentContent: strikeCommentContent,
        articleId: remoteArticle.id
      })
    });

    if (triggerRes.ok) {
        console.log(`[PHASE 2 & 3] ✅ Mac Mini has initialized its defense protocol!`);
        console.log(`==========================================`);
        console.log(`You should now monitor the terminal logs on the Mac Mini (M1) to watch its local Ollama read the M5 comment, reply to it, and fire a counter-strike comment back across the Wi-Fi into the M5 database!`);
    } else {
        throw new Error(`Failed to trigger Mac Mini defense sequence.`);
    }

  } catch (error: any) {
    console.error(`\n❌ SWARM TEST FAILED: ${error.message}`);
  }
}

runSwarmTest();
