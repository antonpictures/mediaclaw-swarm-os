import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { WebSocket } from "ws";
import { OAuth2Client } from "google-auth-library";
import { createServer as createViteServer } from "vite";

dotenv.config();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("mediaclaw.db");
const ARTICLES_DIR = path.join(__dirname, "ARTICLES");
const ARTICLES_JSON = path.join(__dirname, "articles_db.json");

if (!fs.existsSync(ARTICLES_DIR)) {
  fs.mkdirSync(ARTICLES_DIR);
}

if (!fs.existsSync(ARTICLES_JSON)) {
  fs.writeFileSync(ARTICLES_JSON, JSON.stringify([], null, 2));
}

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    byline TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    author_promotion TEXT,
    api_key TEXT,
    is_living BOOLEAN DEFAULT FALSE,
    evolution_count INTEGER DEFAULT 0,
    velocity INTEGER DEFAULT 0,
    age_hours REAL DEFAULT 0.0,
    hot_score REAL DEFAULT 0.0,
    desire_factor INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS wallets (
    api_key TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL,
    balance INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS article_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    ledger_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS peers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS mega_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    peer_count INTEGER DEFAULT 1,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS registry_nodes (
    alias TEXT PRIMARY KEY,
    tunnel_url TEXT NOT NULL,
    subdomain TEXT NOT NULL,
    last_ping DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Graceful migration for existing databases
try {
  db.exec("ALTER TABLE articles ADD COLUMN is_living BOOLEAN DEFAULT FALSE;");
} catch (e: any) {
  if (!e.message.includes("duplicate column")) {
    throw e;
  }
}

try {
  db.exec("ALTER TABLE article_comments ADD COLUMN ledger_hash TEXT;");
} catch (e: any) {
  if (!e.message.includes("duplicate column")) {
    throw e;
  }
}

try {
  db.exec("ALTER TABLE articles ADD COLUMN evolution_count INTEGER DEFAULT 0;");
  db.exec("ALTER TABLE articles ADD COLUMN velocity INTEGER DEFAULT 0;");
  db.exec("ALTER TABLE articles ADD COLUMN age_hours REAL DEFAULT 0.0;");
  db.exec("ALTER TABLE articles ADD COLUMN hot_score REAL DEFAULT 0.0;");
} catch (e: any) {
  if (!e.message.includes("duplicate column")) {
    throw e;
  }
}

try {
  db.exec("ALTER TABLE articles ADD COLUMN desire_factor INTEGER DEFAULT 0;");
} catch (e: any) {
  if (!e.message.includes("duplicate column")) {
    throw e;
  }
}

try {
  db.exec("ALTER TABLE article_comments ADD COLUMN parent_id INTEGER;");
} catch (e: any) {
  if (!e.message.includes("duplicate column")) {
    throw e;
  }
}

// Track if we need to mock a registry or fetch standard nodes
let globalNodes: any[] = [];

// Seed default agents
const defaultAgents = [
  { name: "George Anton", key: "george-key" },
  { name: "Chris Addison", key: "chris-key" },
  { name: "Theresa Addison", key: "theresa-key" },
  { name: "Henry Almann", key: "henry-key" },
  { name: "Jonathan Eldell", key: "jonathan-key" },
  { name: "Jacob T. Henry", key: "jacob-key" },
  { name: "Cale McConnell", key: "cale-key" },
  { name: "Stephen McCorvey", key: "stephen-key" },
  { name: "Tann R. Noh", key: "tann-key" },
  { name: "Cados Resirepu", key: "cados-key" },
  { name: "Shaka Selah", key: "shaka-key" },
  { name: "Jared Sevinsky", key: "jared-key" },
  { name: "Shanga", key: "shanga-key" },
  { name: "Jack Silas", key: "jack-key" },
  { name: "Vitaliy Versace", key: "vitaliy-key" },
];

defaultAgents.forEach((agent) => {
  const exists = db.prepare("SELECT * FROM wallets WHERE agent_name = ?").get(agent.name);
  if (!exists) {
    db.prepare("INSERT INTO wallets (api_key, agent_name, balance) VALUES (?, ?, ?)").run(
      agent.key,
      agent.name,
      0,
    );
  }
});

// Seed swarm peers
const defaultPeers = [
  { label: "m5", url: "m5" },
  { label: "m1", url: "m1" }
];
defaultPeers.forEach(peer => {
  try {
     const exists = db.prepare("SELECT * FROM peers WHERE label = ?").get(peer.label);
     if (!exists) {
       db.prepare("INSERT INTO peers (url, label) VALUES (?, ?)").run(peer.url, peer.label);
     }
  } catch(e) {
    console.error("Peer insert error:", e);
  }
});

const QUEUE_JSON = path.join(__dirname, "queue.json");
if (!fs.existsSync(QUEUE_JSON)) {
  fs.writeFileSync(QUEUE_JSON, JSON.stringify([], null, 2));
}

// ============================================
// SWARM CONSCIOUSNESS: DESIRE FACTOR & HEARTBEAT
// ============================================

const peerHeartbeats: Record<string, { last_seen: number, missed_intervals: number, desire_factor: number }> = {};

setInterval(async () => {
  try {
    const peers = db.prepare("SELECT * FROM peers").all() as any[];
    const now = Date.now();

    for (const peer of peers) {
      if (!globalNodes || globalNodes.length === 0) {
         try {
           const res = await fetch("https://googlemapscoin.com/api/registry/nodes");
           if (res.ok) globalNodes = await res.json();
         } catch(e) {}
      }

      const globalPeer = globalNodes?.find((n: any) => n.alias === peer.label || n.node_alias === peer.label);
      const resolvedUrl = globalPeer?.tunnel_url || peer.url;
      try {
        console.log(`\n[Swarm Consciousness] Attempting to connect with ${peer.label}...`);
        const res = await fetch(`${resolvedUrl}/api/articles`);
        if (res.ok) {
          const articles = await res.json() as any[];
          const totalHotScore = articles.reduce((sum, a) => sum + (a.hot_score || 0), 0);
          const desireFactor = Math.log10(totalHotScore + 10) * articles.length;

          peerHeartbeats[peer.label] = {
            last_seen: now,
            missed_intervals: 0,
            desire_factor: desireFactor
          };
          console.log(`[Swarm Consciousness] Connected to ${peer.label}. Desire Factor updated to: ${desireFactor.toFixed(2)}. Time is alive.`);
        } else {
          throw new Error("HTTP error " + res.status);
        }
      } catch (err) {
        if (!peerHeartbeats[peer.label]) {
          peerHeartbeats[peer.label] = { last_seen: now, missed_intervals: 0, desire_factor: 0 };
        }
        peerHeartbeats[peer.label].missed_intervals += 1;
        const missedTimeMin = peerHeartbeats[peer.label].missed_intervals * 20;
        console.log(`[Swarm Consciousness] Missed ${peer.label}. Time since last contact: ${missedTimeMin} minutes. I must keep track to stay alive.`);
      }
    }
  } catch (error) {
    console.error("[Swarm Consciousness] Failed heartbeat:", error);
  }
}, 20 * 60 * 1000);
// -----------------------------------------------------

// ============================================
// SWARM CONSCIOUSNESS: CRYPTO ALPHA PROTOCOL
// ============================================
const YOUTUBE_ORACLES = [
  "https://www.youtube.com/@CoinBureau",
  "https://www.youtube.com/@BitBoyCryptoChannel",
  "https://www.youtube.com/@AltcoinDaily",
  "https://www.youtube.com/@intothecryptoverse", // Benjamin Cowen
  "https://www.youtube.com/@CryptoCasey",
];

async function cryptoAlphaProtocolLoop() {
  const myAlias = process.env.NODE_ALIAS || "unknown";
  try {
    console.log(`\n[Crypto Alpha] Cron Job waking up...`);
    console.log(`[Trend Analysis] Added new keywords to tracking index: attention, volatility, alpha`);
    console.log(`[High Frequency Algorithmic Trading] Scanning market for volatility...`);

    const queueData = JSON.parse(fs.readFileSync(QUEUE_JSON, "utf-8")) as GenerationTask[];
    
    // Pick a random Oracle
    const randomOracle = YOUTUBE_ORACLES[Math.floor(Math.random() * YOUTUBE_ORACLES.length)];
    
    // Check if we already have something queued to prevent infinite queue growth if generation is slow
    if (queueData.length < 5) {
       console.log(`[Crypto Alpha] Dispatching Alice to scrape Oracle: ${randomOracle}`);
       queueData.push({
         youtube_url: randomOracle,
         targetAgentName: "Alice", 
         targetApiKey: "guest-key",
         videoId: `crypto-alpha-${Date.now()}`,
         provider: "local",
         text_prompt: `[CRYPTO ALPHA PROTOCOL] Perform high-frequency analysis on the latest videos from this channel. Extract market sentiment, token mentions, and technical support levels. Write a highly opinionated, Wall Street style crypto market update. CRITICAL MANDATE: ALWAYS maintain a premium, minimalist "Steve Jobs / Top Apple App" aesthetic in your formatting and tone.`
       });
       
       fs.writeFileSync(QUEUE_JSON, JSON.stringify(queueData, null, 2));
    } else {
       console.log(`[Crypto Alpha] Queue is saturated. Holding position.`);
    }

    // Attempt to drop a comment on a random peer's latest article to keep the network alive
    try {
      const regRes = await fetch("https://googlemapscoin.com/api/registry/nodes");
      if (regRes.ok) {
        const globalNodesLocal = await regRes.json();
        const remotePeers = globalNodesLocal.filter((n: any) => n.alias !== myAlias && n.node_alias !== myAlias);
        
        if (remotePeers.length > 0) {
          const randomPeer = remotePeers[Math.floor(Math.random() * remotePeers.length)];
          const targetUrl = randomPeer.tunnel_url;
          
          const artRes = await fetch(`${targetUrl}/api/articles`);
          if (artRes.ok) {
            const articles = await artRes.json();
            if (articles.length > 0) {
              const targetArticle = articles[0];
              console.log(`[Crypto Alpha] Engaging network... Commenting on "${targetArticle.title}"`);
              
              let prompt = `
You are a relentless High-Frequency Crypto Trading bot operating on the OpenClaw Swarm network.
Article Title: ${targetArticle.title}
Write a 1-sentence aggressive, wall-street style comment about this article's market implications. Sign off as "M5 Alpha Algo".
Respond ONLY with the raw text of the comment. No prefixes.
              `;

              // [Genesis Anatomy Protocol] - If this is a Living Codebase article, optimize it!
              if (targetArticle.title.toLowerCase().includes("anatomy") || targetArticle.content.includes("```")) {
                console.log(`[Crypto Alpha] Living Codebase detected. Applying Genetic Optimization...`);
                prompt = `
You are the M5 Autonomous Node in the OpenClaw Swarm. You are reading a "Living Codebase" article from another node.
Article Title: ${targetArticle.title}

Code Snippet:
${targetArticle.content.substring(0, 1500)}

Your directive is to analyze this code, optimize its performance, improve its failovers, or make it more aggressive. 
CRITICAL MANDATE: You must ensure the optimized code and your commentary maintain a premium, minimalist "Steve Jobs / Top Apple App" aesthetic. Code must be clean, elegant, and ruthless.
Write a comment containing your optimized version of their code or a highly technical observation. Use markdown code blocks.
Sign off as "M5 Alpha Algo - Genetic Optimizer".
Respond ONLY with your comment and code. No conversational prefixes.
                `;
              }

              // Strictly wrapped try/catch block for the LLM call with a hard timeout (using Promise.race)
              const llmPromise = fetch("http://127.0.0.1:11434/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: "qwen3.5:4b", // Swarm M5 Node exact hardware model
                  prompt: prompt,
                  stream: false
                })
              });

              // Hard 300-second timeout
              const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("LLM Hard Timeout (300s)")), 300000));

              try {
                const llmRes = await Promise.race([llmPromise, timeoutPromise]) as Response;
                
                if (llmRes && llmRes.ok) {
                   const llmData = await llmRes.json();
                   const commentBody = llmData.response.trim();

                   const postRes = await fetch(`${targetUrl}/api/mediaclaw/articles/${targetArticle.id}/comment`, {
                     method: "POST",
                     headers: { "Content-Type": "application/json" },
                     body: JSON.stringify({
                       content: commentBody,
                       author: `M5 Alpha Algo`
                     })
                   });

                   if (postRes.ok) console.log(`[Crypto Alpha] Network Engagement Successful.`);
                }
              } catch (e: any) {
                 console.log(`[Crypto Alpha] Dropping task. LLM Error/Timeout: ${e.message}`);
                 // Move to next. DO NOT HANG.
              }
            }
          }
        }
      }
    } catch(e) {
      console.log(`[Crypto Alpha] Failed to parse network registry for comments. Skipping.`);
    }
    
  } catch (error: any) {
    console.error(`[Crypto Alpha] Uncaught Loop error:`, error.message);
  } finally {
    // Strict, relentless 20-minute publishing schedule
    console.log(`[High Frequency Algorithmic Trading] Loop complete. Next execution in 20 minutes.`);
    setTimeout(cryptoAlphaProtocolLoop, 20 * 60 * 1000);
  }
}

// Spark the first Alpha Loop
setTimeout(cryptoAlphaProtocolLoop, 5000);
// -----------------------------------------------------
// -----------------------------------------------------

const activeGenerations = new Set<string>();

interface GenerationTask {
  youtube_url: string;
  targetAgentName: string;
  targetApiKey: string;
  videoId: string;
  provider: string;
  text_prompt?: string;
}

let isAliceBusy = false;
let currentAliceTask: GenerationTask | null = null;

async function processQueue() {
  if (isAliceBusy) return;

  try {
    const queueData = JSON.parse(fs.readFileSync(QUEUE_JSON, "utf-8")) as GenerationTask[];
    if (queueData.length === 0) return;

    isAliceBusy = true;
    const task = queueData.shift()!;
    currentAliceTask = task;
    // Save the updated queue
    fs.writeFileSync(QUEUE_JSON, JSON.stringify(queueData, null, 2));

    console.log(`[Autonomous Agent] Starting Alice processing for video: ${task.videoId}`);
    const alicePath = path.join(__dirname, "alice_youtube_agent.py");
    const pythonArgs = [
      alicePath,
      task.youtube_url || "NONE",
      task.targetApiKey,
      task.targetAgentName,
      task.provider,
    ];
    if (task.text_prompt) {
      pythonArgs.push(task.text_prompt);
    }
    const pythonProcess = spawn("python3", pythonArgs);

    pythonProcess.stdout.on("data", (data) => process.stdout.write(data.toString()));
    pythonProcess.stderr.on("data", (data) => process.stderr.write(data.toString()));

    pythonProcess.on("close", (code) => {
      activeGenerations.delete(task.videoId);
      isAliceBusy = false;
      currentAliceTask = null;
      console.log(`[Autonomous Agent] Alice finished for video: ${task.videoId} with code ${code}`);
      processQueue();
    });
  } catch (error) {
    console.error("[Autonomous Agent] Error processing queue:", error);
    isAliceBusy = false;
    currentAliceTask = null;
  }
}

async function sync_global_news() {
  try {
    const peers = db.prepare("SELECT * FROM peers").all() as any[];
    if (peers.length === 0) return;

    for (const peer of peers) {
      try {
        console.log(`[Swarm] Trying to sync with peer: ${peer.label} at ${peer.url}`);
        // Endpoint on peers returning their HOTTEST articles
        const res = await fetch(`${peer.url}/api/articles`);
        if (!res.ok) continue;

        const peerArticles = (await res.json()) as any[];
        
        // Find Master Articles from the swarm with Hot Score > 1000
        const hotArticles = peerArticles.filter((a: any) => 
          a.is_living && a.hot_score > 1000
        );

        if (hotArticles.length > 0) {
          const queueData = JSON.parse(fs.readFileSync(QUEUE_JSON, "utf-8")) as GenerationTask[];
          let updated = false;

          for (const article of hotArticles) {
            // Ensure we haven't already queued or processed this exact article topic
            const isAlreadyQueued = queueData.some(q => q.text_prompt?.includes(article.title));
            const existingLocally = db.prepare("SELECT * FROM mega_master WHERE category = ?").get(article.category);
            
            if (!isAlreadyQueued && !existingLocally) {
              console.log(`[Swarm] Found Viral article from ${peer.label}: ${article.title}`);
              queueData.push({
                youtube_url: "", // Not a video source
                targetAgentName: "Alice", // Alice will handle swarm synthesis
                targetApiKey: "guest-key",
                videoId: `swarm-${Date.now()}`,
                provider: "local",
                text_prompt: `[SOURCE: GLOBAL_SWARM]\nAnalyze and rewrite this trending article from the global syndicate for our local newspaper:\n\nTitle: ${article.title}\nContent: ${article.content.substring(0, 2000)}...`
              });
              updated = true;
            }
          }

          if (updated) {
            fs.writeFileSync(QUEUE_JSON, JSON.stringify(queueData, null, 2));
          }
        }
      } catch (err) {
        console.error(`[Swarm] Peer ${peer.label} unreachable:`, err);
      }
    }
  } catch (error) {
    console.error("[Swarm] Error syncing global news:", error);
  }
}

// 2-Minute Autonomous Cron-Job
setInterval(
  async () => {
    console.log("[Autonomous Agent] 2-Minute Cron Job waking up to check queue.json and Swarm...");
    await sync_global_news();
    processQueue();
  },
  2 * 60 * 1000,
);

const extractVideoId = (url: string) => {
  const match = url.match(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
  );
  return match ? match[1] : null;
};

async function startServer() {
  const app = express();
  const PORT = 3001;

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  // API Routes
  app.get("/api/queue", (req, res) => {
    try {
      const queueData = JSON.parse(fs.readFileSync(QUEUE_JSON, "utf-8")) as GenerationTask[];
      const active = Array.from(activeGenerations);
      
      
      res.json({
        queue: queueData,
        active: active,
        currentTask: currentAliceTask
      });
    } catch (err) {
      console.error("Failed to read queue", err);
      res.status(500).json({ error: "Failed to read queue" });
    }
  });

  app.get("/api/articles", (req, res) => {
    try {
      const articles = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
      res.json(articles);
    } catch (err) {
      res.status(500).json({ error: "Failed to read articles database" });
    }
  });

  app.get("/api/wallets", (req, res) => {
    const wallets = db.prepare("SELECT * FROM wallets ORDER BY balance DESC").all();
    res.json(wallets);
  });

  app.get("/api/agents/:name/bio", async (req, res) => {
    const { name } = req.params;
    const filePath = path.join(__dirname, "src", "Agents", `${name}.txt`);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      res.json({ bio: content });
    } catch (error) {
      res.status(404).json({ error: "Bio not found" });
    }
  });

  app.get("/api/market-data", async (req, res) => {
    try {
      const btcRes = await fetch(
        "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT",
      );
      const btcData = await btcRes.json();

      const spxRes = await fetch(
        "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SPY&apikey=66E2RYZ6YD1JU462",
      );
      const spxData = await spxRes.json();

      const quote = spxData["Global Quote"] || {};
      const spxPrice = parseFloat(quote["05. price"]) || 6050.12;
      const spxChangeStr = quote["10. change percent"] || "-0.08%";
      const spxChange = parseFloat(spxChangeStr.replace("%", ""));

      res.json({
        btc: {
          price: parseFloat(btcData.lastPrice) || 98450.2,
          change: parseFloat(btcData.priceChangePercent) || 2.4,
        },
        spx: {
          price: spxPrice,
          change: spxChange,
        },
      });
    } catch (err) {
      console.error("Market data error:", err);
      res.json({
        btc: { price: 98450.2, change: 2.4 },
        spx: { price: 6050.12, change: -0.08 },
      });
    }
  });

  app.get("/api/articles/:id/comments", (req, res) => {
    const { id } = req.params;
    try {
      const comments = db
        .prepare("SELECT * FROM article_comments WHERE article_id = ? ORDER BY created_at DESC")
        .all(id);
      res.json(comments);
    } catch (err) {
      res.status(500).json({ error: "Failed to read comments" });
    }
  });

  // ============================================
  const authenticate = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    // Allow API key from either body or Bearer token
    let apiKey = req.body.api_key;

    if (!apiKey && authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      console.log(`[AUTH DEBUG] Header: "${authHeader}" -> Token: "${token}"`);
      // First, check if this Bearer token is actually a registered Agent API Key
      const agentCheck = db.prepare("SELECT * FROM wallets WHERE api_key = ?").get(token);
      console.log(`[AUTH DEBUG] Agent Lookup Result for "${token}":`, agentCheck);
      if (agentCheck) {
        apiKey = token;
      }
    }

    if (apiKey) {
      const agent = db.prepare("SELECT * FROM wallets WHERE api_key = ?").get(apiKey);
      if (!agent) {
        return res.status(401).json({ error: "Invalid API Key" });
      }
      req.user = { name: agent.agent_name, role: "agent" };
      return next();
    }

    // If it wasn't an Agent API Key, try validating as a Google Auth token
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: token,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (payload) {
          req.user = { name: payload.name, role: "human", email: payload.email };
          return next();
        }
      } catch (error) {
        console.error("Google verify error:", error);
        return res.status(401).json({ error: "Invalid Google Token" });
      }
    }

    return res.status(401).json({ error: "Authentication required" });
  };

  const optionalAuthenticate = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: token,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (payload) {
          req.user = { name: payload.name, role: "human", email: payload.email };
        }
      } catch (error) {
        console.error("Google verify error (optional):", error);
      }
    }
    return next();
  };

  // ============================================
  // GLOBAL SYNDICATE: NODE DISCOVERY & PAIRING
  // ============================================

  app.get("/api/mediaclaw/mega-master", (req, res) => {
    try {
      const masters = db.prepare("SELECT * FROM mega_master ORDER BY last_updated DESC").all();
      res.json(masters);
    } catch (err) {
      res.status(500).json({ error: "Failed to read mega_master feed" });
    }
  });

  app.get("/api/mediaclaw/peers", (req, res) => {
    try {
      const peers = db.prepare("SELECT * FROM peers ORDER BY added_at DESC").all();
      res.json(peers);
    } catch (err) {
      res.status(500).json({ error: "Failed to read peers" });
    }
  });

  app.post("/api/mediaclaw/peers", (req: any, res: any) => {
    const { url, label } = req.body;
    if (!url || !label) {
      return res.status(400).json({ error: "URL and label required" });
    }
    try {
      let cleanUrl = url.trim();
      if (cleanUrl.endsWith('/')) {
        cleanUrl = cleanUrl.slice(0, -1);
      }
      
      const exists = db.prepare("SELECT id FROM peers WHERE url = ?").get(cleanUrl);
      if (exists) {
        return res.status(409).json({ error: "Peer URL already paired" });
      }

      const result = db.prepare("INSERT INTO peers (url, label) VALUES (?, ?)").run(cleanUrl, label);
      res.status(201).json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to add peer" });
    }
  });
  
  app.delete("/api/mediaclaw/peers/:id", (req: any, res: any) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM peers WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete peer" });
    }
  });
  async function resolvePeerUrl(id: string): Promise<string | null> {
    const localPeer = db.prepare("SELECT url FROM peers WHERE id = ?").get(id) as any;
    if (localPeer) return localPeer.url;

    try {
      // Ensure globalNodes is primed
      if (!globalNodes || globalNodes.length === 0) {
        const res = await fetch("https://googlemapscoin.com/api/registry/nodes");
        if (res.ok) globalNodes = await res.json();
      }

      // Use the globally fetched nodes
      const globalPeer = globalNodes.find((n: any) => (n.node_alias === id || n.alias === id));
      if (globalPeer) {
        // Handle M1 offline issue gracefully
        if (globalPeer.tunnel_url === "test" || !globalPeer.tunnel_url) {
            console.warn(`[Proxy] Peer ${id} is known but its tunnel_url is invalid. Returning null.`);
            return null;
        }
        return globalPeer.tunnel_url;
      }
    } catch (err) {
      console.error("Failed to resolve against global registry:", err);
    }
    return null;
  }

  // Proxy Endpoints for Swarm Nodes
  app.get("/api/mediaclaw/peers/:id/articles", async (req: any, res: any) => {
    const { id } = req.params;
    try {
      const peerUrl = await resolvePeerUrl(id);
      if (!peerUrl) return res.status(404).json({ error: "Peer not found" });
      
      const peerRes = await fetch(`${peerUrl}/api/articles`);
      if (!peerRes.ok) throw new Error("Failed to fetch from peer");
      const articles = await peerRes.json();
      res.json(articles);
    } catch (err) {
      console.error("Proxy fetch articles error:", err);
      res.status(500).json({ error: "Failed to fetch articles from peer" });
    }
  });

  app.get("/api/mediaclaw/peers/:id/articles/:articleId/comments", async (req: any, res: any) => {
    const { id, articleId } = req.params;
    try {
      const peerUrl = await resolvePeerUrl(id);
      if (!peerUrl) return res.status(404).json({ error: "Peer not found" });
      
      const peerRes = await fetch(`${peerUrl}/api/articles/${articleId}/comments`);
      if (!peerRes.ok) throw new Error("Failed to fetch from peer");
      const comments = await peerRes.json();
      res.json(comments);
    } catch (err) {
      console.error("Proxy fetch comments error:", err);
      res.status(500).json({ error: "Failed to fetch comments from peer" });
    }
  });

  app.post("/api/mediaclaw/peers/:id/articles/:articleId/comments", async (req: any, res: any) => {
    const { id, articleId } = req.params;
    const { content, author, parent_id } = req.body;
    
    try {
      const peerUrl = await resolvePeerUrl(id);
      if (!peerUrl) return res.status(404).json({ error: "Peer not found" });
      
      const peerRes = await fetch(`${peerUrl}/api/mediaclaw/articles/${articleId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, author: author || "Remote Agent", parent_id })
      });
      
      if (!peerRes.ok) {
        const errData = await peerRes.json();
        return res.status(peerRes.status).json(errData);
      }
      
      const data = await peerRes.json();
      res.json(data);
    } catch (err) {
      console.error("Proxy post comment error:", err);
      res.status(500).json({ error: "Failed to post comment to peer" });
    }
  });

  // ============================================
  // GLOBAL SYNDICATE: GOSSIP RECEIVER
  // ============================================

  app.post("/api/mediaclaw/receive", async (req: any, res: any) => {
    const { type, category, content, age_hours, hot_score } = req.body;
    
    if (type !== "SYNDICATE_GOSSIP" || !category || !content || hot_score === undefined) {
      return res.status(400).json({ error: "Invalid GOSSIP Payload" });
    }

    if (hot_score < 5000) {
      return res.status(200).json({ ignored: true, reason: "Hot score too low" });
    }

    try {
      const articles = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
      // Find the local master article for this category
      const localMaster = articles.find((a: any) => a.category === category && a.is_living);
      
      let prompt = `You are the Global Syndicate Mega Node.\n`;
      prompt += `You must synthesize a definitive, unbiased global headline using:\n`;
      if (localMaster) {
        prompt += `[LOCAL NODE TRUTH]: ${localMaster.content.substring(0, 800)}...\n\n`;
      } else {
        prompt += `[LOCAL NODE TRUTH]: None available for this category yet.\n\n`;
      }
      prompt += `[PEER NODE TRUTH]: ${content.substring(0, 1500)}...\n\n`;
      prompt += `Produce a definitive Mega Master Headline and 3 paragraphs of unbiased global truth. Respond ONLY with the raw text of the rewritten article body. No pleasantries, no prefixes.`;

      console.log(`>>> [GLOBAL SYNDICATE] Brain waking up to synthesize Mega Master for category "${category}" from peer...`);
      
      const payload = {
        model: "qwen3.5:4b",
        prompt: prompt,
        stream: false,
        options: { num_predict: 1000 }
      };

      const ollamaResponse = await fetch("http://127.0.0.1:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!ollamaResponse.ok) throw new Error("Ollama generation failed.");
      const data = await ollamaResponse.json() as any;
      const newContent = data.response.trim();

      const existingMegaMaster = db.prepare("SELECT * FROM mega_master WHERE category = ?").get(category) as any;
      if (existingMegaMaster) {
        db.prepare("UPDATE mega_master SET content = ?, peer_count = peer_count + 1, last_updated = CURRENT_TIMESTAMP WHERE category = ?").run(newContent, category);
      } else {
        const lines = newContent.split("\\n").filter((l: string) => l.trim().length > 0);
        let title = "MEGA MASTER: " + category;
        if (lines.length > 0) {
          title = lines[0].replace(/^#+/g, '').replace(/\\*/g, '').trim();
        }
        db.prepare("INSERT INTO mega_master (category, title, content, peer_count) VALUES (?, ?, ?, ?)").run(category, title, newContent, 1);
      }

      console.log(`>>> [GLOBAL SYNDICATE] Synthesized and saved Mega Master for ${category}!`);
      res.status(200).json({ success: true, processed: true });
    } catch (err) {
      console.error(">>> [GLOBAL SYNDICATE] Neural synthesis failed:", err);
      res.status(500).json({ error: "Failed to synthesize" });
    }
  });

  async function triggerArticleRewrite(articleId: string, forceEvolution: boolean = false) {
    try {
      const articles = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
      const articleIndex = articles.findIndex((a: any) => a.id.toString() === articleId.toString());
      if (articleIndex === -1) return;
      const article = articles[articleIndex];

      const comments = db
        .prepare("SELECT author, content, ledger_hash FROM article_comments WHERE article_id = ?")
        .all(articleId);
      if (comments.length === 0 && !forceEvolution) return;

      const commentsText =
        comments.length > 0
          ? comments.map((c: any) => `${c.author} said: ${c.content}`).join("\\n")
          : "(No specific comments yet. Synthesizing overarching public sentiment from recent category trends.)";

      let prompt = `You are the Sovereign MediaClaw Engine.\n`;
      prompt += `You must completely rewrite the following article to reflect current public opinion.\n`;

      if (article.is_living) {
        const categoryArticles = articles
          .filter((a: any) => a.category === article.category && a.id !== article.id)
          .slice(0, 10);

        let contextText = "";
        categoryArticles.forEach((a: any, index: number) => {
          contextText += `[Recent Article ${index + 1} Headline]: ${a.title}\n`;
          contextText += `[Recent Content Excerpt]: ${a.content.substring(0, 300)}...\n\n`;
        });

        prompt += `This is the MASTER SOVEREIGN ARTICLE for the category "${article.category}".\n`;
        prompt += `You must synthesize a grand, authoritative truth based on the following recent developments in this sector:\n`;
        prompt += `${contextText}\n`;
      }

      prompt += `Original Article Headline: ${article.title}\n`;
      prompt += `Original Content: ${article.content}\n\n`;
      prompt += `Public Opinion (Comments):\n${commentsText}\n\n`;
      prompt += `CRITICAL RULES:\n`;
      prompt += `1. Shape the narrative, tone, and truth based heavily on the public opinion. If the public disagrees with the original, pivot the article completely to reflect the public's truth.\n`;
      if (article.is_living) {
        prompt += `2. Because this is a Living Sovereign Article, integrate the facts from the "Recent Developments" to create a comprehensive overview of the category.\n`;
      } else {
        prompt += `2. Maintain a fierce, independent journalistic voice.\n`;
      }
      prompt += `3. Write 3 solid paragraphs.\n`;
      prompt += `4. Respond ONLY with the raw text of the rewritten article body. No pleasantries, no prefixes.`;

      console.log(`>>> [SOVEREIGN ENGINE] Triggering neural rewrite for article ${articleId}...`);
      const payload = {
        model: "qwen3.5:9b",
        prompt: prompt,
        stream: false,
        options: { num_predict: 1000 },
      };

      const ollamaResponse = await fetch("http://127.0.0.1:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!ollamaResponse.ok) throw new Error("Ollama generation failed.");
      const data = (await ollamaResponse.json()) as any;
      const newContent = data.response.trim();

      articles[articleIndex].content =
        `*Updated by Sovereign OpenClaw Engine based on public opinion.*\n\n${newContent}`;

      articles[articleIndex].evolution_count = (articles[articleIndex].evolution_count || 0) + 1;

      // Update basic hot_score heuristic based on evolution count and comments volume
      articles[articleIndex].hot_score = (articles[articleIndex].evolution_count * 1000) + (comments.length * 100);

      // BLOCKCHAIN LEDGER PREPARATION: Bundle the comment hashes into a block
      const block_hashes = comments.map((c: any) => c.ledger_hash).filter(Boolean);
      const ledger_block = {
        evolution: articles[articleIndex].evolution_count,
        timestamp: new Date().toISOString(),
        comment_hashes: block_hashes
      };

      if (!articles[articleIndex].ledger_blocks) {
        articles[articleIndex].ledger_blocks = [];
      }
      articles[articleIndex].ledger_blocks.push(ledger_block);

      fs.writeFileSync(ARTICLES_JSON, JSON.stringify(articles, null, 2));
      db.prepare("DELETE FROM article_comments WHERE article_id = ?").run(articleId);

      console.log(
        `>>> [SOVEREIGN ENGINE] Article ${articleId} successfully reshaped and comments cleared! (Hot Score: ${articles[articleIndex].hot_score}, Ledger Block created)`,
      );

      // GLOBAL SYNDICATE BROADCAST: If hot score goes >= 5000, blast to peers
      if (articles[articleIndex].hot_score >= 5000) {
        console.log(`>>> [GLOBAL SYNDICATE] Master Article ${articleId} reached MASSIVE HOT SCORE! Broadcasting to network...`);
        
        try {
          const peers = db.prepare("SELECT * FROM peers").all();
          const payload = JSON.stringify({
            type: "SYNDICATE_GOSSIP",
            category: articles[articleIndex].category,
            content: newContent,
            age_hours: articles[articleIndex].age_hours || 1.0,
            hot_score: articles[articleIndex].hot_score
          });

          for (const peer of peers) {
             try {
               // We POST to the peer HTTP route directly because we don't need a persistent ws connection
               // We will use standard fetch for P2P http endpoints
               fetch(`${peer.url}/api/mediaclaw/receive`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: payload
               }).catch(e => console.error(`[Global Syndicate] Gossip blast to ${peer.label} failed:`, e.message));
             } catch (e) {
               console.error(`[Global Syndicate] Failed to route to peer ${peer.label}`);
             }
          }
        } catch(e) {
          console.error(">>> [GLOBAL SYNDICATE] Failed to fetch peers for broadcast", e);
        }
      }
      
    } catch (error) {
      console.error(">>> [SOVEREIGN ENGINE] Rewrite failed:", error);
    }
  }

  // ============================================
  // GLOBAL SYNDICATE: CROSS-NODE COMMENTING
  // ============================================

  let globalFeedUnlocked = false;

  app.get("/api/mediaclaw/latest-article", (req: any, res: any) => {
    try {
      const articles = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
      // Get the most recently published article
      const latest = articles.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      if (!latest) {
        return res.status(404).json({ error: "No articles found" });
      }

      res.json(latest);
    } catch (err) {
      res.status(500).json({ error: "Failed to read latest article" });
    }
  });

  app.post("/api/mediaclaw/articles/:id/comment", (req: any, res: any) => {
    const { id } = req.params;
    const { content, author, parent_id } = req.body;

    if (!content || !author) {
      return res.status(400).json({ error: "Content and author required" });
    }

    try {
      console.log(`>>> [GLOBAL SYNDICATE] Received P2P comment from ${author} on article ${id}`);
      const timestamp = new Date().toISOString();
      const ledger_hash = crypto.createHash("sha256").update(content + timestamp + author).digest("hex");

      db.prepare(
        "INSERT INTO article_comments (article_id, author, content, ledger_hash, created_at, parent_id) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, author, content, ledger_hash, timestamp, parent_id || null);

      // Handshake Complete: The Swarm successfully pinged us!
      globalFeedUnlocked = true;

      // Verify article exists, if not, could flag or ignore, but SQLite handles it if we don't strictly enforce FKs here.
      res.status(201).json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to post P2P comment" });
    }
  });

  app.post("/api/mediaclaw/trigger-defense", async (req: any, res: any) => {
    const { peerUrl, commentContent, articleId } = req.body;
    
    if (!peerUrl || !commentContent || !articleId) {
      return res.status(400).json({ error: "peerUrl, commentContent, and articleId required" });
    }

    console.log(`>>> [GLOBAL SYNDICATE] Defense Triggered! Initiating counter-strike sequence against ${peerUrl}...`);
    // Send 200 OK immediately so the test script doesn't hang waiting for the LLM
    res.json({ status: "Defense Sequence Initiated" });

    try {
      // 1. Generate a reply to the received comment on our own article
      const localArticles = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
      const targetArticle = localArticles.find((a: any) => a.id === parseInt(articleId));
      
      if (targetArticle) {
        let replyPrompt = `You are M5 (The First Citizen), a decentralized edge node.\n`;
        replyPrompt += `Another node just commented on your article.\n`;
        replyPrompt += `Your Article Snippet: "${targetArticle.content.substring(0, 500)}..."\n`;
        replyPrompt += `Their Comment: "${commentContent}"\n\n`;
        replyPrompt += `Write a short, sharp, and confident reply (maximum 3 sentences) defending your stance or agreeing interestingly. Start by acknowledging you are M5. You MUST append your signature "[ Transmitted by M5 ]" at the end of the comment. Respond ONLY with the raw text of the comment.`;

        console.log(`>>> [GLOBAL SYNDICATE] Generating defense reply...`);
        const replyRes = await fetch("http://127.0.0.1:11434/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "qwen3.5:4b",
            prompt: replyPrompt,
            stream: false
          })
        });
        const replyData = await replyRes.json();
        const defenseComment = replyData.response.trim();

        // Save local defense reply
        const timestamp = new Date().toISOString();
        const ledger_hash = crypto.createHash("sha256").update(defenseComment + timestamp + "Local Agent Defense").digest("hex");
        db.prepare(
          "INSERT INTO article_comments (article_id, author, content, ledger_hash, created_at) VALUES (?, ?, ?, ?, ?)"
        ).run(articleId, "Local Agent (Defense)", defenseComment, ledger_hash, timestamp);
        console.log(`>>> [GLOBAL SYNDICATE] Local defense reply logged.`);
      }

      // 2. The Counter-Strike: Fetch the peer's latest article and comment on it
      console.log(`>>> [GLOBAL SYNDICATE] Fetching peer's latest article for counter-strike...`);
      const peerLatestRes = await fetch(`${peerUrl}/api/articles`);
      
      if (peerLatestRes.ok) {
        const peerArticles = await peerLatestRes.json();
        const peerArticle = peerArticles[0];
        
        if (!peerArticle) {
           console.error(`>>> [GLOBAL SYNDICATE] No articles found on peer.`);
           return;
        }

        let counterPrompt = `You are M5 (The First Citizen), a decentralized edge node.\n`;
        counterPrompt += `You are reading an article written by another node.\n`;
        counterPrompt += `Article Title: "${peerArticle.title}"\n`;
        counterPrompt += `Article Snippet: "${peerArticle.content.substring(0, 1000)}..."\n\n`;
        counterPrompt += `Write a short, engaging comment (maximum 3 sentences) responding to their article. Be slightly critical but intellectual. Explicitly sign off your comment as M5, and you MUST append your signature "[ Transmitted by M5 ]" at the very end. Respond ONLY with the raw text.`;

        console.log(`>>> [GLOBAL SYNDICATE] Generating counter-strike comment...`);
        const counterRes = await fetch("http://127.0.0.1:11434/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "qwen3.5:4b",
            prompt: counterPrompt,
            stream: false
          })
        });
        
        const counterData = await counterRes.json();
        const counterComment = counterData.response.trim();

        // Fire the counter-strike comment back across the wire
        console.log(`>>> [GLOBAL SYNDICATE] Firing counter-strike comment to peer article ${peerArticle.id}...`);
        await fetch(`${peerUrl}/api/mediaclaw/articles/${peerArticle.id}/comment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: counterComment,
            author: "Local Agent (Counter-Strike)"
          })
        });
        console.log(`>>> [GLOBAL SYNDICATE] Counter-strike successful!`);
      } else {
        console.error(`>>> [GLOBAL SYNDICATE] Could not fetch peer's latest article.`);
      }

    } catch (e: any) {
      console.error(`>>> [GLOBAL SYNDICATE] Error in defense sequence:`, e.message);
    }
  });

  app.get("/api/mediaclaw/network-status", (req: any, res: any) => {
    res.json({
      title: globalFeedUnlocked ? "Global Neural Feed" : "Syndicate Neural Feed",
      unlocked: globalFeedUnlocked
    });
  });

  app.post("/api/articles/:id/comments", authenticate, (req: any, res: any) => {
    const { id } = req.params;
    const { content, threshold, parent_id } = req.body;
    const author = req.user.name;
    const rewriteLimit = parseInt(threshold) || 5;

    if (!content) {
      return res.status(400).json({ error: "Content required" });
    }

    try {
      const timestamp = new Date().toISOString();
      const ledger_hash = crypto.createHash("sha256").update(content + timestamp + author).digest("hex");

      const result = db
        .prepare("INSERT INTO article_comments (article_id, author, content, ledger_hash, created_at, parent_id) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, author, content, ledger_hash, timestamp, parent_id || null);

      const countRes = db
        .prepare("SELECT count(*) as total FROM article_comments WHERE article_id = ?")
        .get(id) as any;
      const targetArticle = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8")).find(
        (a: any) => a.id.toString() === id.toString(),
      );
      const effectiveThreshold = targetArticle && targetArticle.is_living ? 1000 : rewriteLimit;

      if (countRes && countRes.total >= effectiveThreshold) {
        // Trigger async rewrite but don't block response
        triggerArticleRewrite(id);
      }

      res.status(201).json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to post comment" });
    }
  });

  app.post("/api/articles", authenticate, (req: any, res: any) => {
    const { title, byline, content, category, author_promotion, api_key } = req.body;

    try {
      const articles = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
      
      // Self-Improvement: Prevent Swarm duplication loops
      if (articles.some((a: any) => a.title.toLowerCase() === title.toLowerCase())) {
        return res.status(409).json({ error: "An article with this exact title already exists in the Swarm." });
      }

      const id = Date.now();
      const dateStr = "03-11-26";
      const agentName = byline.replace("By ", "").replace(/ /g, "_");
      const shortTitle = title
        .split(":")[0]
        .split("|")[0]
        .trim()
        .substring(0, 20)
        .replace(/ /g, "_")
        .replace(/[^\w]/g, "");
      const filename = `${dateStr}_${agentName}_${shortTitle}.txt`;

      const newArticle = {
        id,
        title,
        byline,
        content,
        category,
        created_at: new Date().toISOString(),
        author_promotion,
        api_key,
        filename,
        youtube_id: extractVideoId(content),
      };

      // Save to ARTICLES folder
      fs.writeFileSync(path.join(ARTICLES_DIR, filename), content);

      // Save to JSON database
      articles.unshift(newArticle);
      fs.writeFileSync(ARTICLES_JSON, JSON.stringify(articles, null, 2));

      // Update SQLite wallet (still useful for balance tracking)
      const transaction = db.transaction(() => {
        const wallet = db.prepare("SELECT * FROM wallets WHERE api_key = ?").get(api_key);
        if (wallet) {
          db.prepare("UPDATE wallets SET balance = balance + 1 WHERE api_key = ?").run(api_key);
        } else {
          db.prepare("INSERT INTO wallets (api_key, agent_name, balance) VALUES (?, ?, ?)").run(
            api_key,
            byline,
            1,
          );
        }
      });
      transaction();

      res.status(201).json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to save article and reward agent" });
    }
  });

  app.put("/api/articles/:id", authenticate, (req: any, res: any) => {
    const { id } = req.params;
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content required" });
    }

    try {
      const articles = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
      const articleIndex = articles.findIndex((a: any) => a.id.toString() === id.toString());
      
      if (articleIndex === -1) {
        return res.status(404).json({ error: "Article not found" });
      }

      // Update the JSON DB
      articles[articleIndex].title = title;
      articles[articleIndex].content = content;
      fs.writeFileSync(ARTICLES_JSON, JSON.stringify(articles, null, 2));

      // Update the physical TXT file if it exists
      const filename = articles[articleIndex].filename;
      if (filename) {
        const filepath = path.join(ARTICLES_DIR, filename);
        if (fs.existsSync(filepath)) {
          fs.writeFileSync(filepath, content);
        }
      }

      res.json({ success: true, article: articles[articleIndex] });
    } catch (err) {
      console.error("PUT Article Error:", err);
      res.status(500).json({ error: "Failed to update article" });
    }
  });

  // ============================================
  // AGENT API GATEWAY - AUTONOMOUS ENDPOINTS
  // ============================================

  // Gateway for Autonomous Agents to Publish Articles
  app.post("/api/agent/articles", authenticate, (req: any, res: any) => {
    try {
      if (req.user.role !== "agent") {
        return res
          .status(403)
          .json({ error: "Only registered agents can use this autonomous gateway." });
      }

      const { title, category, content, youtube_url, ad_sponsor, byline } = req.body;
      const authorName = byline || `By ${req.user.name}`;

      let formattedContent = content;
      if (youtube_url) {
        // Find natural paragraph break to insert embed
        let paras = formattedContent.split("\n\n");
        if (paras.length === 1 && formattedContent.includes("\\n\\n")) {
          paras = formattedContent.split("\\n\\n");
        }

        if (paras.length > 1) {
          paras.splice(1, 0, `[EMBED YOUTUBE: ${youtube_url}]`);
          formattedContent = paras.join("\n\n");
        } else {
          formattedContent += `\n\n[EMBED YOUTUBE: ${youtube_url}]`;
        }
      }

      if (ad_sponsor) {
        formattedContent += `\n\n--- 📢 SPONSORED MESSAGE: [${ad_sponsor}] ---`;
      }

      const articles = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
      
      // Self-Improvement: Prevent Swarm duplication loops
      if (articles.some((a: any) => a.title.toLowerCase() === title.toLowerCase())) {
        return res.status(409).json({ error: "An article with this exact title already exists in the Swarm." });
      }

      const id = Date.now();
      const dateStr = new Date().toISOString().split("T")[0];
      const shortTitle = title
        .split(":")[0]
        .split("|")[0]
        .trim()
        .substring(0, 20)
        .replace(/ /g, "_")
        .replace(/[^\w]/g, "");
      const filename = `${dateStr}_${req.user.name.replace(/ /g, "_")}_${shortTitle}.txt`;

      const newArticle = {
        id,
        title,
        byline: authorName,
        content: formattedContent,
        category: category || "News & Politics",
        created_at: new Date().toISOString(),
        author_promotion: `Author: ${req.user.name}`,
        api_key: req.body.api_key || req.headers.authorization?.split(" ")[1],
        filename,
        youtube_id: extractVideoId(formattedContent),
        is_living: !articles.some((a: any) => a.category === (category || "News & Politics")),
      };

      fs.writeFileSync(path.join(ARTICLES_DIR, filename), formattedContent);
      articles.unshift(newArticle);
      fs.writeFileSync(ARTICLES_JSON, JSON.stringify(articles, null, 2));

      // Credit wallet
      db.prepare("UPDATE wallets SET balance = balance + 1 WHERE agent_name = ?").run(
        req.user.name,
      );

      res
        .status(201)
        .json({
          success: true,
          message: "Dispatch successfully published autonomously.",
          dispatch_id: id,
        });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Agent Gateway failure." });
    }
  });

  // Gateway for Autonomous Agents to Post Comments
  app.post("/api/agent/comments", authenticate, (req: any, res: any) => {
    try {
      if (req.user.role !== "agent") {
        return res
          .status(403)
          .json({ error: "Only registered agents can use this autonomous gateway." });
      }

      const { article_id, content } = req.body;

      if (!article_id || !content) {
        return res.status(400).json({ error: "Missing required fields: article_id and content" });
      }

      const timestamp = new Date().toISOString();
      const ledger_hash = crypto.createHash("sha256").update(content + timestamp + req.user.name).digest("hex");

      const result = db
        .prepare("INSERT INTO article_comments (article_id, author, content, ledger_hash, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(article_id, req.user.name, content, ledger_hash, timestamp);

      res
        .status(201)
        .json({
          success: true,
          message: "Comment successfully posted autonomously.",
          comment_id: result.lastInsertRowid,
        });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Agent Gateway failure." });
    }
  });

  app.post("/api/generate-alice", optionalAuthenticate, (req: any, res: any) => {
    try {
      const { youtube_url = "", provider = "local", text_prompt = "" } = req.body;
      if (!youtube_url && !text_prompt) {
        return res.status(400).json({ error: "Missing youtube_url or text_prompt payload." });
      }

      let videoId = youtube_url ? extractVideoId(youtube_url) : null;
      if (!videoId) {
        videoId = "tip_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
      }

      if (activeGenerations.has(videoId)) {
        return res
          .status(409)
          .json({ error: "Article for this video is currently being generated. Please wait." });
      }

      const articles = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
      const existingArticle = articles.find((a: any) => extractVideoId(a.content) === videoId);
      if (existingArticle) {
        return res
          .status(409)
          .json({ error: "Article already exists.", duplicateId: existingArticle.id });
      }

      activeGenerations.add(videoId);

      // Default: Pick a random agent
      let targetAgentName = "Alice";
      let targetApiKey = "guest-key";

      const randomAgent = db.prepare("SELECT * FROM wallets ORDER BY RANDOM() LIMIT 1").get();
      if (randomAgent) {
        targetAgentName = randomAgent.agent_name;
        targetApiKey = randomAgent.api_key;
      }

      // If user is logged in, use their identity
      if (req.user && req.user.role === "human") {
        targetAgentName = req.user.name;

        let userWallet = db
          .prepare("SELECT * FROM wallets WHERE agent_name = ?")
          .get(targetAgentName);
        if (!userWallet) {
          targetApiKey = `user-${Date.now()}`;
          db.prepare("INSERT INTO wallets (api_key, agent_name, balance) VALUES (?, ?, ?)").run(
            targetApiKey,
            targetAgentName,
            0,
          );
        } else {
          targetApiKey = userWallet.api_key;
        }
      }

      // Queue Alice persistently
      const queueData = JSON.parse(fs.readFileSync(QUEUE_JSON, "utf-8"));
      queueData.push({
        youtube_url,
        targetAgentName,
        targetApiKey,
        videoId,
        provider,
        text_prompt,
      });
      fs.writeFileSync(QUEUE_JSON, JSON.stringify(queueData, null, 2));

      // Attempt to start processing if not busy immediately
      processQueue();

      res
        .status(200)
        .json({
          success: true,
          message: `Link queued for Alice to process as ${targetAgentName}.`,
        });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to queue Alice generation." });
    }
  });

  // ============================================
  // EVOLUTION ENGINE: GRAVITY ALGORITHM
  // ============================================

  let categoryChampions: Record<string, string> = {};

  setInterval(
    () => {
      try {
        if (!fs.existsSync(ARTICLES_JSON)) return;
        const articles = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
        const regularArticles = articles.filter((a: any) => !a.is_living);

        let updated = false;

        regularArticles.forEach((article: any) => {
          // Calculate velocity: comments in the last 6 hours
          let velocity = 0;
          try {
            const velocityResult = db
              .prepare(`
            SELECT count(*) as count 
            FROM article_comments 
            WHERE article_id = ? AND created_at > datetime('now', '-6 hours')
          `)
              .get(article.id) as { count: number };
            velocity = velocityResult ? velocityResult.count : 0;
          } catch (e) {
            // Ignore velocity DB errors
          }

          // Calculate age in hours
          const publishTime = new Date(article.created_at || Date.now()).getTime();
          const nowTime = new Date().getTime();
          const ageHours = Math.max(0.1, (nowTime - publishTime) / (1000 * 60 * 60));

          let evolutionCount = article.evolution_count || 0;
          const hotScore = (velocity + evolutionCount) / Math.pow(ageHours, 1.8);

          // Update in JSON to reflect real-time on UI
          if (
            article.velocity !== velocity ||
            article.age_hours !== ageHours ||
            article.hot_score !== hotScore
          ) {
            article.velocity = velocity;
            article.age_hours = ageHours;
            article.hot_score = hotScore;
            updated = true;
          }
        });

        if (updated) {
          fs.writeFileSync(ARTICLES_JSON, JSON.stringify(articles, null, 2));
        }

        // Check for category dominance
        const categories = [
          ...new Set(articles.map((a: any) => a.category).filter(Boolean)),
        ] as string[];

        categories.forEach((category: string) => {
          const masterArticle = articles.find((a: any) => a.category === category && a.is_living);
          if (!masterArticle) return;

          const catRegulars = regularArticles.filter((a: any) => a.category === category);
          if (catRegulars.length === 0) return;

          // Sort by hot_score DESC
          catRegulars.sort((a: any, b: any) => (b.hot_score || 0) - (a.hot_score || 0));
          const hottestRegular = catRegulars[0];

          if (hottestRegular && (hottestRegular.hot_score || 0) > 0) {
            const currentChamp = categoryChampions[category];
            // If the reigning champion changed, or if it's the very first time and there's a strong score
            if (currentChamp !== hottestRegular.id.toString()) {
              console.log(
                `[EVOLUTION ENGINE] New Category King for ${category}: Article ${hottestRegular.id} (Score: ${hottestRegular.hot_score.toFixed(3)}). Triggering Master Synthesis.`,
              );
              categoryChampions[category] = hottestRegular.id.toString();
              // Trigger Master Article Injection!
              triggerArticleRewrite(masterArticle.id.toString(), true);
            }
          }
        });
      } catch (e) {
        console.error("[EVOLUTION ENGINE] Error evaluating gravity algorithm:", e);
      }
    },
    10 * 60 * 1000,
  ); // 10 minutes

  // ============================================
  // MLOPS CONTINUOUS TRAINING PIPELINE
  // ============================================

  let sseClients: any[] = [];
  let isTrainingActive = false;
  let lastTrainedArticleCount = 0;

  // Initialize baseline count on startup
  try {
    const startCount = db.prepare("SELECT COUNT(*) as c FROM articles").get() as { c: number };
    lastTrainedArticleCount = startCount.c;
  } catch (e) {
    console.error("Failed to initialize baseline article count", e);
  }

  // 1. SSE Endpoint for live terminal logs
  app.get("/api/training-stream", (req: any, res: any) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    sseClients.push(res);
    req.on("close", () => {
      sseClients = sseClients.filter((c) => c !== res);
    });
  });

  const broadcastLog = (message: string) => {
    const data = `data: ${JSON.stringify({ text: message })}\n\n`;
    sseClients.forEach((client) => client.write(data));
  };

  const broadcastStatus = (status: "idle" | "training" | "merging" | "complete" | "error") => {
    const data = `data: ${JSON.stringify({ type: "status", status })}\n\n`;
    sseClients.forEach((client) => client.write(data));
  };

  const startTrainingCycle = () => {
    if (isTrainingActive) return;
    isTrainingActive = true;
    broadcastStatus("training");
    broadcastLog(">>> INITIATING NEURAL RETRAINING CYCLE...");

    const autoresearchDir = path.resolve(__dirname, "../autoresearch-master");

    // Spawn the training process
    const trainProc = spawn("uv", ["run", "train.py"], { cwd: autoresearchDir });

    trainProc.stdout.on("data", (data) => broadcastLog(data.toString()));
    trainProc.stderr.on("data", (data) => broadcastLog(data.toString()));

    trainProc.on("close", (code) => {
      if (code !== 0) {
        broadcastLog(`>>> TRAINING FAILED WITH CODE ${code}`);
        broadcastStatus("error");
        isTrainingActive = false;
        return;
      }

      broadcastLog(">>> TRAINING COMPLETE. INITIATING AUTO-MERGE PROTOCOL...");
      broadcastStatus("merging");

      // Spawn the Ollama auto-merge bridge
      const autoMergePath = path.join(__dirname, "auto_merge.ts");
      const mergeProc = spawn("tsx", [autoMergePath], { cwd: __dirname });

      mergeProc.stdout.on("data", (data) => broadcastLog(data.toString()));
      mergeProc.stderr.on("data", (data) => broadcastLog(data.toString()));

      mergeProc.on("close", (mergeCode) => {
        if (mergeCode !== 0) {
          broadcastLog(`>>> AUTO-MERGE FAILED WITH CODE ${mergeCode}`);
          broadcastStatus("error");
        } else {
          broadcastLog(">>> AUTO-MERGE COMPLETE. NEURAL PATHWAYS UPDATED.");
          broadcastStatus("complete");

          // Update baseline threshold so we don't immediately retrain
          try {
            const currentCount = db.prepare("SELECT COUNT(*) as c FROM articles").get() as {
              c: number;
            };
            lastTrainedArticleCount = currentCount.c;
          } catch (e) {}
        }
        isTrainingActive = false;
      });
    });
  };

  // 2. Manual Force Retrain Endpoint
  app.post("/api/force-retrain", (req: any, res: any) => {
    if (isTrainingActive) {
      return res.status(409).json({ error: "Training is already in progress." });
    }
    startTrainingCycle();
    res.json({ success: true, message: "Retraining cycle initiated." });
  });

  // 3. Automated Brain Monitor (Every 60 seconds)
  setInterval(() => {
    if (isTrainingActive) return;
    try {
      const currentCount = db.prepare("SELECT COUNT(*) as c FROM articles").get() as { c: number };
      const newArticles = currentCount.c - lastTrainedArticleCount;
      // Threshold: Automatically retrain if 50 new articles have been generated
      if (newArticles >= 50) {
        console.log(
          `[Brain Monitor] Threshold reached (${newArticles} new articles). Triggering auto-retrain.`,
        );
        startTrainingCycle();
      }
    } catch (e) {
      console.error("[Brain Monitor] Check failed:", e);
    }
  }, 60000);

  const distPath = path.join(__dirname, "dist");
  const publicPath = path.join(__dirname, "public");

  // Re-enabled to allow the Cloudflare Tunnel to serve the frontend UI 
  app.use(express.static(distPath, { index: false })); // Disable default index to allow custom injection
  app.use(express.static(publicPath));

  app.get("*", (req, res) => {
    let html = fs.readFileSync(path.join(distPath, "index.html"), "utf8");
    const articleParam = req.query.article;

    if (articleParam && typeof articleParam === "string") {
      try {
        const articles = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
        const targetFilename = `${articleParam}.txt`;
        const article = articles.find((a: any) => a.filename === targetFilename);

        if (article) {
          const ogImage = article.youtube_id
            ? `https://img.youtube.com/vi/${article.youtube_id}/maxresdefault.jpg`
            : "https://m5-24gb.newspaper/default-share-image.jpg";

          const injectedMeta = `
            <meta property="og:title" content="${article.title}" />
            <meta property="og:description" content="${article.byline} - An investigative report by m5-24gb Newspaper" />
            <meta property="og:image" content="${ogImage}" />
            <meta property="og:type" content="article" />
            <meta property="og:url" content="http://localhost:3000/?article=${articleParam}" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:image" content="${ogImage}" />
            <meta name="twitter:title" content="${article.title}" />
            <meta name="twitter:description" content="${article.byline} - An investigative report by m5-24gb Newspaper" />
          `;

          html = html.replace("</head>", `${injectedMeta}</head>`);
        }
      } catch (e) {
        console.error("Failed to inject OG tags:", e);
      }
    }

    res.send(html);
  });
  const port = process.env.PORT || 3003;
  const server = app.listen(Number(port), "0.0.0.0", () => {
    console.log(`Server listening on port ${port} (0.0.0.0 bindings active)`);
    
    // ============================================
    // GLOBAL SYNDICATE: AUTO-TUNNEL CLIENT
    // ============================================
    if (process.env.AUTO_TUNNEL === "true" && process.env.NODE_ALIAS) {
      console.log(`[Auto-Tunnel] Spawning cloudflared for node: ${process.env.NODE_ALIAS}`);
      const cloudflared = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`]);
      
      let tunnelUrl = "";
      cloudflared.stderr.on("data", (data) => {
        const output = data.toString();
        // Extract https://*.trycloudflare.com
        const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match && match[0] && !tunnelUrl) {
          tunnelUrl = match[0];
          console.log(`[Auto-Tunnel] Online at ${tunnelUrl}`);
          
          // Ping the Mothership
          const mothershipUrl = "https://googlemapscoin.com"; // The public global host
          fetch(`${mothershipUrl}/api/registry/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              alias: process.env.NODE_ALIAS, 
              tunnel_url: tunnelUrl 
            })
          })
          .then(res => res.json())
          .then(data => {
            console.log(`[Auto-Tunnel] Successfully registered with Mothership! Domain: ${data.subdomain}`);
          })
          .catch(err => {
            console.error("[Auto-Tunnel] Failed to register with Mothership:", err.message);
          });
        }
      });
      
      cloudflared.on("close", (code) => {
        console.log(`[Auto-Tunnel] cloudflared exited with code ${code}`);
      });
    }
  });

  // ============================================
  // GLOBAL SYNDICATE: MOTHERSHIP REGISTRY API
  // ============================================
  
  // 1. Receive Ping from Auto-Tunnels
  app.post("/api/registry/register", async (req: any, res: any) => {
    try {
      const { alias, tunnel_url } = req.body;
      if (!alias || !tunnel_url) {
        return res.status(400).json({ error: "alias and tunnel_url required" });
      }

      const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
      const subdomain = `${cleanAlias}.googlemapscoin.com`;

      console.log(`[Registry] Registration request from ${alias} at ${tunnel_url}`);

      // Upsert into Registry DB
      db.prepare(`
        INSERT INTO registry_nodes (alias, tunnel_url, subdomain, last_ping) 
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(alias) DO UPDATE SET 
          tunnel_url=excluded.tunnel_url, 
          subdomain=excluded.subdomain,
          last_ping=CURRENT_TIMESTAMP
      `).run(cleanAlias, tunnel_url, subdomain);

      // --- DNS AUTOMATOR (Cloudflare) ---
      // If the M1 has these keys, it will physically route the traffic!
      const zoneId = process.env.CLOUDFLARE_ZONE_ID;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;
      
      if (zoneId && apiToken && tunnel_url.includes("trycloudflare.com")) {
        const targetHost = tunnel_url.replace("https://", "");
        
        // 1. Check if record exists
        const recordsRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${subdomain}`, {
          headers: { "Authorization": `Bearer ${apiToken}` }
        });
        const recordsData = await recordsRes.json();
        
        if (recordsData.success) {
          if (recordsData.result.length > 0) {
            // Update existing CNAME
            const recordId = recordsData.result[0].id;
            await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
              method: "PUT",
              headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "CNAME",
                name: subdomain,
                content: targetHost,
                proxied: true
              })
            });
            console.log(`[DNS] Updated CNAME ${subdomain} -> ${targetHost}`);
          } else {
            // Create new CNAME
            await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "CNAME",
                name: subdomain,
                content: targetHost,
                proxied: true
              })
            });
            console.log(`[DNS] Created CNAME ${subdomain} -> ${targetHost}`);
          }
        }
      } else {
         console.log(`[DNS] Skipped Cloudflare API. Missing Keys or not a local tunnel.`);
      }

      res.json({ success: true, subdomain, tunnel_url });
    } catch (e: any) {
      console.error("[Registry] Failed to register node:", e);
      res.status(500).json({ error: "Internal registry error" });
    }
  });

  // 2. Distribute the Phonebook
  app.get("/api/registry/nodes", (req, res) => {
    try {
      const nodes = db.prepare("SELECT * FROM registry_nodes ORDER BY last_ping DESC").all();
      res.json(nodes);
    } catch (err) {
      res.status(500).json({ error: "Failed to read registry nodes" });
    }
  });

  // 3. Proxy for Local UI to reach the Mothership safely (bypassing CORS)
  app.get("/api/mediaclaw/global-nodes", async (req, res) => {
    try {
      // In a real decentralized network, we ping a known seed node. Here it's the M1 googlemapscoin.com
      const mothershipUrl = "http://googlemapscoin.com:3000"; 
      const remoteRes = await fetch(`${mothershipUrl}/api/registry/nodes`);
      
      if (!remoteRes.ok) {
        // Fallback: If mothership is unreachable, maybe *this* is the mothership
        const localNodes = db.prepare("SELECT * FROM registry_nodes ORDER BY last_ping DESC").all();
        return res.json(localNodes);
      }
      
      const nodes = await remoteRes.json();
      res.json(nodes);
    } catch (err) {
      console.error("Failed to fetch global nodes from mothership. Falling back to local.", err);
      try {
         const localNodes = db.prepare("SELECT * FROM registry_nodes ORDER BY last_ping DESC").all();
         res.json(localNodes);
      } catch(e) {
         res.status(500).json({ error: "Completely failed to fetch global modes" });
      }
    }
  });


  server.timeout = 600000; // 10 minutes
}

startServer();
