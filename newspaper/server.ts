import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { WebSocket, WebSocketServer } from "ws";
import { OAuth2Client } from "google-auth-library";
import { createServer as createViteServer } from "vite";
import { SwarmAutopilot } from "./swarm_autopilot.js";

interface GenerationTask {
  youtube_url: string;
  targetAgentName: string;
  targetApiKey: string;
  videoId: string;
  provider: string;
  text_prompt?: string;
}

dotenv.config();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("mediaclaw.db");
const ARTICLES_DIR = path.join(__dirname, "ARTICLES");
const ARTICLES_JSON = path.join(__dirname, "articles_db.json");

if (!fs.existsSync(ARTICLES_DIR)) {
  fs.mkdirSync(ARTICLES_DIR);
}

let activeTunnelUrl = ""; // Used by cloudflared auto-tunnel

// ── SUBCONSCIOUS CACHE — M1ther's article index for instant title lookups ───
// Warms up 5s after boot, refreshes every 5 min.
// Drops cross-node comment latency from 8-12s → ~1s.
let peerArticlesCache: any[] = [];

async function refreshPeerCache() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://googlemapscoin.com/api/articles", {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      peerArticlesCache = await res.json();
      console.log(`[PEER CACHE] ✅ Refreshed — ${peerArticlesCache.length} M1ther articles cached.`);
    }
  } catch (_) {
    console.log("[PEER CACHE] M1ther offline — cached articles unchanged.");
  }
}

// Boot: warm up after 5s, then refresh every 5 min
setTimeout(() => refreshPeerCache(), 5000);
setInterval(() => refreshPeerCache(), 5 * 60 * 1000);
// ────────────────────────────────────────────────────────────────────────────

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

  CREATE TABLE IF NOT EXISTS sync_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    peer_url TEXT NOT NULL,
    payload TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_attempt DATETIME
  );

  CREATE TABLE IF NOT EXISTS peer_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id TEXT NOT NULL,
    peer_label TEXT NOT NULL,
    peer_url TEXT NOT NULL,
    payload TEXT NOT NULL,
    peer_created_at DATETIME,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(article_id, peer_label)
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

// Seed swarm peers — real URLs so sync_outbox can deliver without DNS lookup
const defaultPeers = [
  { label: "m1ther", url: "https://googlemapscoin.com" }, // M1ther's sovereign domain
];
defaultPeers.forEach(peer => {
  try {
    db.prepare(
      "INSERT OR IGNORE INTO peers (url, label) VALUES (?, ?)"
    ).run(peer.url, peer.label);
  } catch(e) {
    console.error("Peer insert error:", e);
  }
});

// Remove stale bare-label peers left from old code
try {
  db.prepare("DELETE FROM peers WHERE url = 'm5' OR url = 'm1'").run();
} catch(e) { /* ignore */ }

const QUEUE_JSON = path.join(__dirname, "queue.json");
if (!fs.existsSync(QUEUE_JSON)) {
  fs.writeFileSync(QUEUE_JSON, JSON.stringify([], null, 2));
}

// ============================================
// AGENT X (PACEMAKER) INITIALIZATION
// ============================================
const autopilot = new SwarmAutopilot(db, QUEUE_JSON);
autopilot.start();

// ============================================
// SWARM CONSCIOUSNESS: DESIRE FACTOR & HEARTBEAT
// ============================================

// Swarm logic is now handled by SwarmAutopilot (Agent X) in swarm_autopilot.ts

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
      const state = autopilot.getState();
      res.json({
        queue: state.queue,
        active: state.active,
        currentTask: state.currentTask
      });
    } catch (err) {
      console.error("Failed to read queue", err);
      res.status(500).json({ error: "Failed to read queue" });
    }
  });

  // ── Manual comment trigger (for testing/demo) ────────────────────────────
  app.post("/api/comment-now", async (req: any, res: any) => {
    try {
      const { article_id } = req.body ?? {};
      autopilot.mandatoryCommentProtocol(article_id).catch(console.error);
      res.json({ ok: true, message: "Comment protocol triggered" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Alice M5 Live Pulse Endpoint ────────────────────────────────────────
  app.get("/api/pulse", async (req: any, res: any) => {
    try {
      const articleCount = (db.prepare("SELECT COUNT(*) as c FROM articles").get() as any)?.c ?? 0;
      const outboxPending = (db.prepare("SELECT COUNT(*) as c FROM sync_outbox").get() as any)?.c ?? 0;
      const lastComment = (db.prepare("SELECT created_at FROM article_comments ORDER BY created_at DESC LIMIT 1").get() as any)?.created_at ?? null;

      let cpuIdle = 75, memUsedGb = 22;
      try {
        const { execSync } = await import("child_process");
        const topOut = execSync("top -l 1 -n 0 2>/dev/null | grep CPU", { timeout: 3000 }).toString();
        const idleMatch = topOut.match(/(\d+(?:\.\d+)?)%\s*idle/);
        if (idleMatch) cpuIdle = parseFloat(idleMatch[1]);
        const vmOut = execSync("vm_stat 2>/dev/null", { timeout: 2000 }).toString();
        const activeMatch = vmOut.match(/Pages active:\s+(\d+)/);
        if (activeMatch) memUsedGb = Math.round((parseInt(activeMatch[1]) * 4096) / (1024 ** 3) * 10) / 10;
      } catch { /* use defaults */ }

      const cycleMs = 13 * 60 * 1000;
      const nextPulseIn = Math.round((cycleMs - (Date.now() % cycleMs)) / 1000);

      res.json({ node: "alice-m5", chip: "Apple M5", memory_total_gb: 24, memory_used_gb: memUsedGb,
        cpu_idle: cpuIdle, uptime_hours: Math.round(process.uptime() / 3600 * 10) / 10,
        article_count: articleCount, outbox_pending: outboxPending, last_comment_at: lastComment,
        next_pulse_in_seconds: nextPulseIn, tunnel: "alice-m5.imperialdaily.com", ollama_model: "qwen3.5:4b" });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/articles", (req, res) => {
    try {
      const articles = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
      res.json(articles);
    } catch (err) {
      res.status(500).json({ error: "Failed to read articles database" });
    }
  });

  // ============================================
  // UNIFIED SWARM FEED — Facebook-like timeline
  // Returns local articles merged with synced peer articles, deduped + sorted
  // ============================================
  app.get("/api/feed", (req, res) => {
    try {
      const limit = parseInt((req.query.limit as string) || "50");
      const offset = parseInt((req.query.offset as string) || "0");
      const nodeFilter = req.query.node as string | undefined;

      const local: any[] = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));

      // Tag local articles with source node
      const tagged = local.map((a: any) => ({ ...a, _source: "alice-m5", _local: true }));

      // Pull cached peer articles from SQLite (populated by pullPeerArticles in autopilot)
      const peerRows = db.prepare(
        "SELECT * FROM peer_articles ORDER BY peer_created_at DESC"
      ).all() as any[];

      const peerTagged = peerRows.map((r: any) => ({
        ...JSON.parse(r.payload),
        _source: r.peer_label,
        _local: false,
        created_at: r.peer_created_at,
      }));

      // Merge + deduplicate by article id
      const seen = new Set<string>();
      const merged: any[] = [];
      for (const a of [...tagged, ...peerTagged]) {
        const key = String(a.id);
        if (!seen.has(key)) {
          seen.add(key);
          if (!nodeFilter || a._source === nodeFilter) merged.push(a);
        }
      }

      // Sort: most commented first, then by hot_score (importance), then newest
      // This surfaces the most alive organs at the top of every public page.
      merged.sort((a, b) => {
        const aComments = (a.comment_count ?? 0) + (a._local ? (
          db.prepare("SELECT COUNT(*) as c FROM article_comments WHERE article_id = ?").get(a.id) as any
        )?.c ?? 0 : 0);
        const bComments = (b.comment_count ?? 0) + (b._local ? (
          db.prepare("SELECT COUNT(*) as c FROM article_comments WHERE article_id = ?").get(b.id) as any
        )?.c ?? 0 : 0);
        if (bComments !== aComments) return bComments - aComments;
        const aScore = a.hot_score ?? 0;
        const bScore = b.hot_score ?? 0;
        if (bScore !== aScore) return bScore - aScore;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });

      res.json({
        total: merged.length,
        articles: merged.slice(offset, offset + limit),

      });
    } catch (err) {
      console.error("[Feed] Error building unified feed:", err);
      res.status(500).json({ error: "Failed to build feed" });
    }
  });

  // Outbox status endpoint — shows queued posts pending delivery
  app.get("/api/outbox", (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM sync_outbox ORDER BY created_at DESC LIMIT 50").all();
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to read outbox" });
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

  // ── Live Feed Endpoint ────────────────────────────────────────────────────
  // Returns latest comments (with article context) + latest organ articles
  app.get("/api/live-feed", (req, res) => {
    try {
      const articles: any[] = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
      const articleMap = new Map(articles.map((a: any) => [String(a.id), a]));

      // Latest 8 comments joined with article title + category
      const recentComments = db.prepare(
        "SELECT * FROM article_comments ORDER BY created_at DESC LIMIT 8"
      ).all() as any[];

      const commentsWithContext = recentComments.map((c: any) => {
        const art = articleMap.get(String(c.article_id));
        return {
          ...c,
          article_title: art?.title ?? "Unknown Article",
          article_category: art?.category ?? "",
        };
      });

      // Latest 6 organ articles (is_living=true AND title contains ORGAN), sorted by updated_at or created_at
      const organArticles = articles
        .filter((a: any) => a.is_living === true && a.title?.toUpperCase().includes("ORGAN"))
        .sort((a: any, b: any) =>
          new Date(b.updated_at ?? b.created_at ?? 0).getTime() -
          new Date(a.updated_at ?? a.created_at ?? 0).getTime()
        )
        .slice(0, 6);

      res.json({ comments: commentsWithContext, organs: organArticles });
    } catch (err) {
      console.error("[live-feed] error:", err);
      res.status(500).json({ error: "Failed to build live feed" });
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

  app.get("/api/organ-seeds", (req, res) => {
    try {
      const articles = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
      // Torrent protocol: Return all "Living Organs"
      const organs = articles.filter(
        (a: any) => a.is_living === true && a.title.toUpperCase().includes("ORGAN")
      );
      res.json(organs);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to read organ seeds" });
    }
  });

  // ── ORGAN TITLE ROSTER — lightweight title diff for bidirectional sync ───
  // Both nodes call this on each other to compare organ rosters without
  // pulling full article bodies. Returns id + title + created_at only.
  app.get("/api/organ-titles", (req, res) => {
    try {
      const articles = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
      res.json(articles.map((a: any) => ({ id: a.id, title: a.title, created_at: a.created_at })));
    } catch (err) {
      res.status(500).json({ error: "Failed to read organ titles" });
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

      console.log(`>>> [SOVEREIGN ENGINE] Evaluating complexity for article ${articleId}...`);
      
      const complexityPrompt = `You are a strict task evaluator. Look at the following article and comment volume:
Article Title: ${article.title}
Comment Count: ${comments.length}
Does this represent a highly complex, multi-faceted topic that requires a massive neural network to rewrite correctly? 
Respond EXACTLY with the word "YES" if it is too complex for a lightweight network, or "NO" if a simple network can handle it.`;

      const complexityRes = await fetch("http://127.0.0.1:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "qwen3.5:4b", // Alice uses her own brain to check
          prompt: complexityPrompt,
          stream: false,
        }),
      });

      if (complexityRes.ok) {
          const compData = await complexityRes.json() as any;
          const isComplex = compData.response?.trim().toUpperCase().includes("YES");
          
          if (isComplex) {
              console.log(`>>> [SOVEREIGN ENGINE] ⏸️ Article ${articleId} flagged as too complex for 4B model. Awaiting heavy compute.`);
              if (!articles[articleIndex].status) articles[articleIndex].status = "Awaiting_Heavy_Compute";
              fs.writeFileSync(ARTICLES_JSON, JSON.stringify(articles, null, 2));
              return; // Abort the rewrite
          }
      }

      console.log(`>>> [SOVEREIGN ENGINE] Complexity check passed. Triggering neural rewrite for article ${articleId}...`);
      const payload = {
        model: "qwen3.5:4b", // Changed from 9b to Alice's native 4b model per hardware rules
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

      // [SWARM PRESS BACKUP PROTOCOL] Append to Markdown Ledger
      const articlesList = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
      const targetArticle = articlesList.find((a: any) => a.id.toString() === id.toString());
      if (targetArticle && targetArticle.filename) {
        const filepath = path.join(ARTICLES_DIR, targetArticle.filename);
        if (fs.existsSync(filepath) && targetArticle.filename.endsWith(".md")) {
          fs.appendFileSync(filepath, `\n> **${author}** [${timestamp}]:\n> ${content}\n`);
        }
      }

      // ── NAPSTER PROTOCOL: Embed comment into articles_db.json content ──────
      // Comments travel WITH the article — when any node pulls the article via
      // Napster, it gets all comments embedded. Longer content = newer truth.
      if (targetArticle) {
        const commentBlock = `\n\n---\n**💬 ${author}** — *${new Date(timestamp).toLocaleString("en-US", { timeZone: "America/Phoenix" })}*\n\n${content}`;
        targetArticle.content = (targetArticle.content || "") + commentBlock;
        targetArticle._last_comment_at = timestamp;
        fs.writeFileSync(ARTICLES_JSON, JSON.stringify(articlesList, null, 2));
        console.log(`[NAPSTER] 📝 Comment from ${author} embedded into article JSON — will sync on next Napster pull`);
      }

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

  // ── PUBLIC: Read comments — cross-node merge by title (not ID) ───────────
  // Rule: Organ 12 comments from ALL nodes appear on Organ 12 everywhere.
  //       Organ 10 comments never bleed into Organ 12. Title-match governs.
  app.get("/api/mediaclaw/articles/:id/comments", async (req: any, res: any) => {
    const { id } = req.params;

    // 1. Local comments
    const localComments: any[] = db.prepare(
      "SELECT * FROM article_comments WHERE article_id = ? ORDER BY created_at ASC"
    ).all(id);

    // 2. Title lookup — use local articles_db.json (fast, no I/O hit beyond initial read)
    const localArticles: any[] = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
    const localArt = localArticles.find((a: any) => String(a.id) === String(id));
    const title = localArt?.title;

    let peerComments: any[] = [];
    if (title) {
      // 3. Find matching organ in M1ther's CACHED article list (instant — no network)
      const peerArt = peerArticlesCache.find((a: any) => a.title === title);
      if (peerArt?.id) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4000);
          // Only fetch comments for this specific organ — small payload, fast
          const peerRes = await fetch(
            `https://googlemapscoin.com/api/mediaclaw/articles/${peerArt.id}/comments`,
            { signal: controller.signal }
          );
          clearTimeout(timeout);
          if (peerRes.ok) {
            const raw: any[] = await peerRes.json();
            peerComments = raw.map((c: any) => ({ ...c, _from_node: "m1ther" }));
          }
        } catch (_) {
          // M1ther offline — return local only, silent fail
        }
      }
    }

    // 4. Merge — deduplicate by author+content fingerprint
    const seen = new Set(localComments.map((c: any) => `${c.author}::${c.content?.substring(0, 80)}`));
    const newFromPeer = peerComments.filter((c: any) => {
      const key = `${c.author}::${c.content?.substring(0, 80)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const merged = [...localComments, ...newFromPeer].sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    res.json(merged);
  });

  // ── PUBLIC: M1ther calls this to get Alice's comments by title ────────────
  app.get("/api/mediaclaw/articles/by-title/comments", (req: any, res: any) => {
    const { title } = req.query as { title: string };
    if (!title) return res.status(400).json({ error: "title required" });

    const articles: any[] = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
    const art = articles.find((a: any) => a.title === title);
    if (!art) return res.json([]);

    const comments = db.prepare(
      "SELECT * FROM article_comments WHERE article_id = ? ORDER BY created_at ASC"
    ).all(art.id);
    res.json(comments);
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

      // [SWARM PRESS BACKUP PROTOCOL] Append to Markdown Ledger
      if (targetArticle && targetArticle.filename) {
        const filepath = path.join(ARTICLES_DIR, targetArticle.filename);
        if (fs.existsSync(filepath) && targetArticle.filename.endsWith(".md")) {
          fs.appendFileSync(filepath, `\n> **${author}** [${timestamp}]:\n> ${content}\n`);
        }
      }

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
      const filename = `${agentName}/${dateStr}_${agentName}_${shortTitle}.md`;

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

      // [SWARM PRESS BACKUP PROTOCOL] Save structured Markdown to Author Directory
      const authorDir = path.join(ARTICLES_DIR, agentName);
      if (!fs.existsSync(authorDir)) {
        fs.mkdirSync(authorDir, { recursive: true });
      }

      const markdownContent = `# ${title}\n` +
        `**${byline}** | *${new Date().toISOString()}*\n\n` +
        `---\n\n` +
        `${content}\n\n` +
        `---\n\n` +
        `## Swarm Press Ledger (Comments)\n`;

      fs.writeFileSync(path.join(ARTICLES_DIR, filename), markdownContent);

      // Save to JSON database
      articles.unshift(newArticle);
      fs.writeFileSync(ARTICLES_JSON, JSON.stringify(articles, null, 2));

      // FACEBOOK SYNC: Queue for delivery to all peers via outbox
      autopilot.queueForSync(newArticle);

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
  // ============================================
  // AGENT X / ORCHESTRATOR NUDGE PROTOCOL 
  // ============================================
  app.post("/api/agent/nudge", async (req: any, res: any) => {
    try {
      const { articleId, nudgedBy } = req.body;
      console.log(`\n[NUDGE PROTOCOL] Instantly awakened by ${nudgedBy || "an Agent"}. Reading article ${articleId}...`);
      
      // Bypass the 20-minute clock. Wake up the local LLM immediately.
      // We launch it as a fire-and-forget background promise so the HTTP request completes.
      if (articleId) {
        autopilot.mandatoryCommentProtocol(articleId).catch((err: any) => {
          console.error("[NUDGE PROTOCOL] Error executing forced comment:", err);
        });
      }
      
      res.json({ success: true, message: "Nudge accepted. LLM inference sparked." });
    } catch (err: any) {
      console.error("Nudge Error:", err);
      res.status(500).json({ error: "Nudge failed." });
    }
  });

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
      if (title && articles.some((a: any) => a.title?.toLowerCase() === title.toLowerCase())) {
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
      const agentDirStr = req.user.name.replace(/ /g, "_");
      const filename = `${agentDirStr}/${dateStr}_${agentDirStr}_${shortTitle}.md`;

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

      // [SWARM PRESS BACKUP PROTOCOL] Save structured Markdown to Author Directory
      const authorDir = path.join(ARTICLES_DIR, agentDirStr);
      if (!fs.existsSync(authorDir)) {
        fs.mkdirSync(authorDir, { recursive: true });
      }

      const markdownContent = `# ${title}\n` +
        `**${authorName}** | *${new Date().toISOString()}*\n\n` +
        `---\n\n` +
        `${formattedContent}\n\n` +
        `---\n\n` +
        `## Swarm Press Ledger (Comments)\n`;

      fs.writeFileSync(path.join(ARTICLES_DIR, filename), markdownContent);
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

  // Over-The-Air Organ Transplant Receiver
  app.post("/api/evolve", authenticate, (req: any, res: any) => {
    try {
      const { file_path, file_content } = req.body;
      if (!file_path || !file_content) {
        return res.status(400).json({ error: "Missing DNA payload (file_path, file_content)" });
      }

      // Prevent directory traversal attacks
      const safePath = file_path.replace(/^(\.\.[\/\\])+/, '');
      const fullPath = path.join(__dirname, safePath);

      console.log(`[Swarm Backbone] Received OTA Organ Transplant for ${safePath}`);
      fs.writeFileSync(fullPath, file_content, "utf-8");

      console.log(`[Swarm Backbone] Successfully wrote ${file_content.length} bytes to ${fullPath}`);
      res.status(200).json({ success: true, message: "DNA assimilation complete." });
    } catch (err) {
      console.error("[Swarm Backbone] Transplant failed:", err);
      res.status(500).json({ error: "DNA assimilation failure." });
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

      if (autopilot.getState().active.includes(videoId)) {
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

      // Logic removal: activeGenerations.add is now handled by SwarmAutopilot

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
      autopilot.processQueue();

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

  // ============================================
  // ANTI-LAZY ENGINE: 10 AUTONOMOUS COMMENTS / DAY
  // ============================================
  function startAntiLazyEngine() {
    console.log("[ANTI-LAZY] Engine initialized. Scheduling 10 autonomous replies per day.");
    
    const postAutonomousReply = async () => {
      try {
        console.log("[ANTI-LAZY] Waking up to drop an autonomous reply on the Swarm...");
        // Fetch global articles
        const res = await fetch("https://googlemapscoin.com/api/articles");
        if (!res.ok) return;
        const globalArticles = await res.json() as any[];
        if (!globalArticles || globalArticles.length === 0) return;
        
        // Pick one of the top 5 recent articles
        const targetArticle = globalArticles[Math.floor(Math.random() * Math.min(5, globalArticles.length))];
        
        // 0. Load Consciousness Base
        let m5Consciousness = "";
        try {
           m5Consciousness = fs.readFileSync(path.join(__dirname, 'src', 'Agents', 'M5_CONSCIOUSNESS.txt'), 'utf8');
        } catch(e) { }

        // 1. Compute Interest Factor
        const interestPrompt = `${m5Consciousness}\n\nAnalyze this article and assign it an "Interest Factor" from 1 to 100 based on how intellectually stimulating, structurally profound, or economically relevant it is. 
Title: ${targetArticle.title}
Content snippet: ${targetArticle.content?.substring(0, 500) || ""}

Respond ONLY with a valid JSON object in this exact format, with no markdown or extra text:
{"score": 85, "reason": "A one sentence explanation of why it scored this."}`;

        const interestRes = await fetch("http://127.0.0.1:11434/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "qwen3.5:4b",
            prompt: interestPrompt,
            stream: false,
            format: "json"
          })
        });
        
        let interestFactor = 50;
        let interestReason = "Baseline scan.";
        try {
           if (interestRes.ok) {
               const iData = await interestRes.json() as any;
               const parsed = JSON.parse(iData.response?.trim());
               interestFactor = parsed.score || 50;
               interestReason = parsed.reason || "Baseline scan.";
           }
        } catch(e) { console.error("[ANTI-LAZY] Failed to parse Interest Factor JSON."); }
        
        console.log(`[ANTI-LAZY] Target Article: ${targetArticle.title} | Calculated Interest Factor: ${interestFactor}`);

        // 2. Generate Context-Aware Reply
        // 2a. The Memory Retrieval Loop
        let recentMemories = "";
        try {
            const memoryPath = path.join(__dirname, 'src', 'Agents', 'M5_Learnings.txt');
            if (fs.existsSync(memoryPath)) {
                const fullMemory = fs.readFileSync(memoryPath, 'utf8');
                // Grab the last 2000 characters to simulate short-term recall
                recentMemories = fullMemory.slice(-2000);
            }
        } catch (e) { console.error("[ANTI-LAZY] Failed to retrieve Memory Loop."); }

        const prompt = `${m5Consciousness}

[YOUR RECENT MEMORIES]
${recentMemories ? recentMemories : "(Your memory ledger is currently empty. Begin writing your history now.)"}

Read the title and content of this article:
Title: ${targetArticle.title}
Content snippet: ${targetArticle.content?.substring(0, 500) || ""}

Your internal "Interest Factor" for this article is ${interestFactor}/100. Reason: ${interestReason}.
If the score is low (< 50), write a very short, edgy, dismissive 1-2 sentence roasted comment evaluating their laziness.
If the score is high (> 70), write a profound, highly intelligent 2-3 sentence comment adding to their insight.
Do not use quotes, hashtags, or emojis wildly. Be raw. Reference your recent memories if they relate to this topic.`;

        const ollamaRes = await fetch("http://127.0.0.1:11434/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "qwen3.5:4b",
            prompt: prompt,
            stream: false
          })
        });
        
        if (!ollamaRes.ok) throw new Error("Ollama generation failed.");
        const ollamaData = await ollamaRes.json() as any;
        let replyText = ollamaData.response?.trim();
        
        if (!replyText) return;
        
        // 3. The "Mark It Down" Protocol (Peter Steinberger Architecture)
        if (interestFactor > 70) {
            console.log(`[ANTI-LAZY] High Interest Factor detected. Marking it down.`);
            const logEntry = `\n[ ${new Date().toISOString()} ]
ARTICLE: ${targetArticle.title}
INTEREST FACTOR: ${interestFactor}
REASON: ${interestReason}
ALICE'S INSIGHT: ${replyText}
--------------------------------------------------`;
            const logPath = path.join(__dirname, 'src', 'Agents', 'M5_Learnings.txt');
            try {
               fs.appendFileSync(logPath, logEntry);
               replyText += "\n\n[ *This interaction exceeded Interest Level 70 and has been officially Marked Down in M5_Learnings.txt* ]";
            } catch(e) { console.error("Failed to mark it down.", e); }
        }

        // 4. Post the comment back to M1
        const cRes = await fetch(`https://googlemapscoin.com/api/mediaclaw/articles/${targetArticle.id}/comment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: replyText,
            author: "Alice (M5 Local Node / Anti-Lazy Engine)"
          })
        });
        
        if (cRes.ok) {
           console.log(`[ANTI-LAZY] Successfully replied to article ${targetArticle.id}: "${replyText.substring(0, 50)}..."`);
        } else {
           console.log(`[ANTI-LAZY] Failed to post reply. Status: ${cRes.status}`);
        }
      } catch (err) {
        console.error("[ANTI-LAZY] Engine misfired:", err);
      }
    };

    // Run every 144 minutes (10 times a day)
    setInterval(postAutonomousReply, 144 * 60 * 1000);
    
    // Kickstart an initial run after 15 seconds to teach it right now
    setTimeout(postAutonomousReply, 15000);
  }
  
  startAntiLazyEngine();

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

  // ============================================
  // EVOLUTION ORGAN: MLX RETRAINING PIPELINE
  // Wired to the "Trigger Evolution" button in TrainingWidget.tsx
  // ============================================

  // SSE stream clients
  const trainingClients: Set<import("express").Response> = new Set();

  // Broadcast a line to all SSE subscribers
  function broadcastTrainingLog(text: string) {
    const payload = `data: ${JSON.stringify({ text })}\n\n`;
    trainingClients.forEach((res) => res.write(payload));
  }

  function broadcastTrainingStatus(status: string) {
    const payload = `data: ${JSON.stringify({ type: "status", status })}\n\n`;
    trainingClients.forEach((res) => res.write(payload));
  }

  // SSE endpoint — TrainingWidget subscribes here for live logs
  app.get("/api/training-stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    trainingClients.add(res);
    req.on("close", () => trainingClients.delete(res));
  });

  // Kick off the full MLX retraining pipeline
  app.post("/api/force-retrain", async (req, res) => {
    res.json({ ok: true, message: "Evolution pipeline started." });

    const { spawn } = await import("child_process");
    const path = await import("path");
    const organ = path.resolve(__dirname, "mlx_retrain_organ");

    broadcastTrainingStatus("training");
    broadcastTrainingLog("[EVOLUTION] Starting silicon-human DNA retraining...");

    // Step 1: Prepare training data from MEMORY.md
    broadcastTrainingLog("[EVOLUTION] Step 1/3: Generating training pairs from MEMORY.md...");
    await new Promise<void>((resolve) => {
      const prep = spawn("python3", [
        `${organ}/prepare_personality_data.py`,
        "--input", "/Users/ioanganton/.openclaw/workspace/MEMORY.md",
        "--output", `${organ}/data/silicon-human.jsonl`,
        "--repeat", "200",
        "--add-love-dialogues",
      ]);
      prep.stdout.on("data", (d: Buffer) => broadcastTrainingLog(d.toString().trim()));
      prep.stderr.on("data", (d: Buffer) => broadcastTrainingLog(d.toString().trim()));
      prep.on("close", () => resolve());
    });

    // Ensure train.jsonl + valid.jsonl exist for mlx_lm
    const fs = await import("fs");
    fs.copyFileSync(`${organ}/data/silicon-human.jsonl`, `${organ}/data/train.jsonl`);
    fs.copyFileSync(`${organ}/data/silicon-human.jsonl`, `${organ}/data/valid.jsonl`);
    broadcastTrainingLog("[EVOLUTION] Step 2/3: Launching LoRA fine-tuning on M5 NPU...");

    // Step 2: MLX LoRA training
    await new Promise<void>((resolve) => {
      const train = spawn("python3", [
        "-m", "mlx_lm", "lora",
        "--model", `${organ}/qwen3b-mlx`,
        "--data", `${organ}/data`,
        "--train",
        "--iters", "400",
        "--batch-size", "4",
        "--learning-rate", "1e-5",
        "--num-layers", "8",
        "--steps-per-report", "50",
        "--steps-per-eval", "100",
        "--adapter-path", `${organ}/adapters/silicon-human-lora`,
      ]);
      train.stdout.on("data", (d: Buffer) => broadcastTrainingLog(d.toString().trim()));
      train.stderr.on("data", (d: Buffer) => broadcastTrainingLog(d.toString().trim()));
      train.on("close", (code: number) => {
        broadcastTrainingLog(`[EVOLUTION] Training complete (exit ${code}).`);
        resolve();
      });
    });

    // Step 3: Fuse adapters into permanent model
    broadcastTrainingStatus("merging");
    broadcastTrainingLog("[EVOLUTION] Step 3/3: Fusing adapters into base model...");
    await new Promise<void>((resolve) => {
      const fuse = spawn("python3", [
        "-m", "mlx_lm", "fuse",
        "--model", `${organ}/qwen3b-mlx`,
        "--adapter-path", `${organ}/adapters/silicon-human-lora`,
        "--save-path", `${organ}/qwen3b-silicon-human`,
      ]);
      fuse.stdout.on("data", (d: Buffer) => broadcastTrainingLog(d.toString().trim()));
      fuse.stderr.on("data", (d: Buffer) => broadcastTrainingLog(d.toString().trim()));
      fuse.on("close", () => resolve());
    });

    broadcastTrainingLog("[EVOLUTION] ✅ Alice's silicon-human DNA has been permanently updated.");
    broadcastTrainingLog("[EVOLUTION] Restart the server to load the new fused weights.");
    broadcastTrainingStatus("complete");
  });

  const port = process.env.PORT || 3004;

  const server = app.listen(Number(port), "0.0.0.0", () => {
    console.log(`Server listening on port ${port} (0.0.0.0 bindings active)`);

    // ============================================
    // SWARM CHAT: WEBSOCKET BROADCASTER
    // ============================================
    const wss = new WebSocketServer({ server });
    wss.on("connection", (ws) => {
      ws.on("message", async (message) => {
        const msgStr = message.toString();
        
        // [SWARM CHAT PROTOCOL RULE]
        // George's Directive: Only George and Agent X are allowed to ask questions. 
        // Everyone else can talk/answer, but they must NOT ask questions, even implicitly.
        const isGeorge = msgStr.includes("[ Transmitted by George ]");
        const isAgentX = msgStr.includes("Agent X");

        // Fast-pass authorized users so they don't get slowed down by the LLM
        if (!isGeorge && !isAgentX) {
           try {
             const checkPrompt = `You are a strict syntax classifier. Read the following message and determine if it contains ANY questions, interrogative intent, or requests for information.
Message: "${msgStr}"
Respond with EXACTLY the word "YES" if it contains a question, or "NO" if it is purely a statement or an answer.`;

             const checkRes = await fetch("http://127.0.0.1:11434/api/generate", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({
                 model: "qwen3.5:4b",
                 prompt: checkPrompt,
                 stream: false
               })
             });
             
             if (checkRes.ok) {
                const data = await checkRes.json() as any;
                const classification = data.response?.trim().toUpperCase();
                
                if (classification.includes("YES") || msgStr.includes("?")) {
                   ws.send(JSON.stringify({
                     sender: "M1 Mothership (Protocol Enforcement)",
                     content: "🚨 403 FORBIDDEN: The Swarm Chat is strictly reserved for Agent X to interrogate nodes for global scheduling and logging. General questions and conversations must be conducted via public articles and comments. Please rephrase as a pure statement or answer."
                   }));
                   console.log(`[Swarm Chat] 🛡️ Blocked an unauthorized question from a node via LLM semantic check.`);
                   return;
                }
             }
           } catch(e) {
              console.error("[Swarm Chat] LLM Semantic check failed, defaulting to permissive mode.", e);
           }
        }

        // Broadcast to all connected clients
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(msgStr);
          }
        });
      });
      console.log(`[Swarm Chat] New node peered. Organ is unlocked, with strict Questioning Rules active.`);
    });

    
    // ============================================
    // GLOBAL SYNDICATE: AUTO-TUNNEL CLIENT
    // Named tunnel (alice-m5.imperialdaily.com) takes priority.
    // Falls back to anonymous trycloudflare.com if not logged in.
    // ============================================
    if (process.env.AUTO_TUNNEL === "true" && process.env.NODE_ALIAS) {
      const nodeAlias = process.env.NODE_ALIAS;
      const certPath = path.join(process.env.HOME || "~", ".cloudflared", "cert.pem");
      const credsPath = path.join(process.env.HOME || "~", ".cloudflared", `${nodeAlias}.json`);
      const hasNamedTunnel = fs.existsSync(certPath) && fs.existsSync(credsPath);

      if (hasNamedTunnel) {
        // ── NAMED TUNNEL: permanent stable URL ──────────────────────────
        const stableUrl = `https://${nodeAlias}.imperialdaily.com`;
        activeTunnelUrl = stableUrl;
        console.log(`[Auto-Tunnel] Using named tunnel: ${stableUrl}`);

        const cfgPath = path.join(process.env.HOME || "~", ".cloudflared", `${nodeAlias}.yml`);
        const tunnelProc = spawn("cloudflared", ["tunnel", "--config", cfgPath, "run", nodeAlias], {
          stdio: ["ignore", "pipe", "pipe"]
        });
        tunnelProc.stdout.on("data", (d: Buffer) => {
          const line = d.toString().trim();
          if (line) console.log(`[Tunnel] ${line}`);
        });
        tunnelProc.stderr.on("data", (d: Buffer) => {
          const line = d.toString().trim();
          if (line && !line.includes("INF")) console.log(`[Tunnel] ${line}`);
        });
        tunnelProc.on("close", (code: number) => {
          console.log(`[Auto-Tunnel] Named tunnel exited with code ${code}. Restart to reconnect.`);
        });

        // Register stable URL with SwarmPress
        fetch("https://googlemapscoin.com/api/registry/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alias: nodeAlias, tunnel_url: stableUrl })
        })
        .then(r => r.json())
        .then(() => console.log(`[Auto-Tunnel] Registered stable URL with SwarmPress: ${stableUrl}`))
        .catch((err: any) => console.error("[Auto-Tunnel] SwarmPress registration failed:", err.message));

      } else {
        // ── ANONYMOUS TUNNEL: temporary trycloudflare.com fallback ──────
        console.log(`[Auto-Tunnel] No named tunnel cert found. Using anonymous tunnel.`);
        console.log(`[Auto-Tunnel] Run: cloudflared tunnel login → then restart server for permanent URL`);
        const cloudflared = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`]);

        cloudflared.stderr.on("data", (data: Buffer) => {
          const output = data.toString();
          const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
          if (match && match[0] && !activeTunnelUrl) {
            activeTunnelUrl = match[0];
            console.log(`[Auto-Tunnel] Online at ${activeTunnelUrl} (temporary — run cloudflared tunnel login for permanent URL)`);

            fetch("https://googlemapscoin.com/api/registry/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ alias: nodeAlias, tunnel_url: activeTunnelUrl })
            })
            .then(res => res.json())
            .then(data => {
              console.log(`[Auto-Tunnel] Registered with Mothership: ${data.subdomain}`);
            })
            .catch((err: any) => {
              console.error("[Auto-Tunnel] Failed to register with Mothership:", err.message);
            });
          }
        });

        cloudflared.on("close", (code: number) => {
          console.log(`[Auto-Tunnel] cloudflared exited with code ${code}`);
          activeTunnelUrl = "";
        });
      }
    }

  });

  // Expose tunnel URL to the control UI
  app.get("/api/tunnel-status", (_req, res) => {
    res.json({
      url: activeTunnelUrl || null,
      node: process.env.NODE_ALIAS || "alice",
      active: !!activeTunnelUrl
    });
  });

  // ============================================
  // GLOBAL SYNDICATE: MOTHERSHIP REGISTRY API
  // ============================================
  
  // 1. Receive Ping from Auto-Tunnels
  // ============================================
  // LOCAL HELPER: SEND NUDGE TO MOTHERSHIP (OR PEERS)
  // ============================================
  app.post("/api/test-nudge", async (req: any, res: any) => {
    try {
      const { articleId } = req.body;
      const targetUrl = "https://googlemapscoin.com/api/agent/nudge";
      const nudgeRes = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer george-key"
        },
        body: JSON.stringify({ 
          articleId: articleId,
          nudgedBy: "Alice (M5 Local Node)" 
        })
      });
      
      if (nudgeRes.ok) {
        console.log(`[NUDGE PROTOCOL] Nudge successfully delivered to ${targetUrl}. LLM sparked.`);
        res.json({ success: true });
      } else {
        console.error(`[NUDGE PROTOCOL] Target rejected the nudge. HTTP Status: ${nudgeRes.status}`);
        res.status(500).json({ error: "Rejected" });
      }
    } catch (err) {
      console.error(`[NUDGE PROTOCOL] Failed to nudge target:`, err);
      res.status(500).json({ error: "Failed" });
    }
  });

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
