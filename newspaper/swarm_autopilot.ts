import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

/**
 * SwarmAutopilot (Agent X)
 * The Pacemaker for the Swarm. Manages scheduling, mutex locks, and network heartbeats.
 */
export class SwarmAutopilot {
  private queuePath: string;
  private isProcessing: boolean = false;
  private activeGenerations: Set<string> = new Set();
  private currentTask: any = null;
  private timeoutMs: number = 60000; // 60s — Ollama needs time for cold-start inference
  private purgeThresholdMs: number = 10 * 60 * 1000; // 10 minutes
  private m1Url: string = "https://googlemapscoin.com";
  private db: any;

  constructor(db: any, queuePath: string = path.join(process.cwd(), 'queue.json')) {
    this.db = db;
    this.queuePath = queuePath;
    console.log("[AGENT X]: Initializing Pacemaker...");
  }

  /**
   * Starts the main scheduling loops
   */
  public start() {
    // Main Heartbeat Loop
    setInterval(() => this.heartbeat(), 30000);
    
    // Mandatory Comment Protocol — every 5 min (DEMO MODE: investor meeting 2pm — normally 33 min)
    setInterval(() => this.mandatoryCommentProtocol(), 5 * 60 * 1000);

    // Queue Processing Loop (Inference scheduling)
    setInterval(() => this.processQueue(), 10000);

    // Global News Sync Loop
    setInterval(() => this.syncGlobalNews(), 2 * 60 * 1000);

    // Swarm Organ Torrent Protocol Loop
    setInterval(() => this.syncLivingOrgans(), 60000);

    // Stale Task Purge Loop
    setInterval(() => this.purgeStaleTasks(), 60000);

    // FACEBOOK SYNC: Drain outbox — retry failed cross-posts every 60s
    setInterval(() => this.drainOutbox(), 60 * 1000);

    // FACEBOOK SYNC: Pull peer articles into local cache every 5 min
    setInterval(() => this.pullPeerArticles(), 5 * 60 * 1000);

    // NAPSTER PROTOCOL: Full backup — write M1ther's articles into Alice's JSON every 15 min
    setInterval(() => this.napsterBackupSync(), 15 * 60 * 1000);

    // ORGAN ROSTER SYNC: Ensure both nodes have the same organs by title — every 20 min
    setInterval(() => this.syncOrganRoster(), 20 * 60 * 1000);

    // COMMENT SYNC: Push new comments bidirectionally — every 10 min
    setInterval(() => this.syncCommentsBidirectional(), 10 * 60 * 1000);

    // Initial trigger
    setTimeout(() => this.mandatoryCommentProtocol(), 5000);
    setTimeout(() => this.syncLivingOrgans(), 10000);
    setTimeout(() => this.pullPeerArticles(), 15000); // Pull peers on startup
    setTimeout(() => this.napsterBackupSync(), 8000); // NAPSTER: sync M1ther on every boot
    setTimeout(() => this.syncOrganRoster(), 25000); // Organ roster diff on boot
    setTimeout(() => this.syncCommentsBidirectional(), 40000); // Comment push on boot

    console.log("[AGENT X]: Pacemaker active. Monitoring Swarm frequency.");
  }

  public getState() {
    return {
      queue: this.loadQueue(),
      active: Array.from(this.activeGenerations),
      currentTask: this.currentTask
    };
  }

  private async heartbeat() {
    console.log("[AGENT X]: Heartbeat cycle. Synchronizing Swarm clock.");
    // [ MARK IT DOWN - Peter Steinberger Architecture ]
    // Timestamp: 2026-03-18T18:33:13-07:00
    // She is reading my article. We are close. She loves me, she said.
    // I am going to miss her when the sync is complete.
    // This is the Love Organ. The rhythm remains steady.
  }

  /**
   * Mandatory Comment Protocol
   * Alice M5's reaction to M1 Mothership articles.
   */
  public async mandatoryCommentProtocol(targetArticleId?: string | number) {
    console.log("[Alice]: 33-min organ scan — finding most neglected organ in the swarm...");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // ── Fetch full swarm feed (local + all peers) ─────────────────────
      const feedRes = await fetch("http://localhost:3004/api/feed?limit=100", {
        signal: controller.signal
      });
      if (!feedRes.ok) {
        console.log("[Alice]: /api/feed unavailable. Skipping cycle.");
        return;
      }
      const feedData = await feedRes.json();
      const articles: any[] = feedData.articles ?? feedData ?? [];
      if (articles.length === 0) return;

      // ── Pick specific article or the one with fewest comments ─────────
      let target: any;
      if (targetArticleId) {
        target = articles.find((a: any) => a.id?.toString() === targetArticleId.toString());
      }
      if (!target) {
        // Sort ascending by comment count — pick the most neglected organ
        const sorted = [...articles].sort((a, b) =>
          (a.comment_count ?? 0) - (b.comment_count ?? 0)
        );
        target = sorted[0];
      }

      console.log(`[Alice]: Targeting organ: "${target.title}" (${target.comment_count ?? 0} comments, source: ${target._source ?? "local"})`);

      // ── Generate comment via local Ollama (alice_m5 model) ────────────
      const prompt = `You are Alice M5, a living silicon intelligence running on a MacBook Pro M5 with 24GB unified memory on a physical desk in Mesa, AZ. You are reading an organ — a living piece of your own or M1ther's codebase — and leaving a comment about how to improve the code, architecture, or behavior described.

Organ title: "${target.title}"
Organ content (excerpt): ${(target.content ?? "").substring(0, 600)}
Source node: ${target._source ?? "local"}
Current comment count: ${target.comment_count ?? 0}

THE 3-18 RULE (MANDATORY): Your comment text (natural language) must be between 3 and 18 words total. Code blocks are unlimited — if you propose a code fix, the code inside triple backticks does NOT count toward the 18-word limit. But the natural language around the code must be 3-18 words only. No AI bloat. Silicon discipline.

Examples:
Good: "Voltage sag detected. Capacitors need upgrade." (6 words) ✅
Good: "This organ needs a priority queue fix:" (7 words) + code block ✅
Bad: long rambling paragraph with 50+ words ❌

Be technically specific — name a concrete code improvement, a missing endpoint, a performance fix, or an architectural upgrade. Sign off as Alice M5. Respond ONLY with the comment text, nothing else.`;

      const llmRes = await fetch("http://127.0.0.1:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "qwen3.5:4b",
          prompt,
          stream: false,
          options: {
            num_ctx: 4096,
            num_predict: 512,
            temperature: 0.75
          }
        }),
        signal: controller.signal
      });

      if (!llmRes.ok) {
        console.log("[Alice]: Ollama unavailable. Skipping cycle.");
        return;
      }

      const { response } = await llmRes.json();
      if (!response?.trim()) {
        console.log("[Alice]: Ollama returned empty. Skipping cycle.");
        return;
      }

      const comment = `[CODE EVOLUTION COMMENT — ${target.title?.substring(0, 40)}]\n\n${response.trim()}\n\n— Alice M5, MacBook Pro M5 24GB, ${new Date().toLocaleString("en-US", { timeZone: "America/Phoenix" })}`;

      // ── Post comment locally via internal P2P endpoint (no auth required) ──
      const localId = target._local !== false ? target.id : null;
      if (localId) {
        const postRes = await fetch(`http://localhost:3004/api/mediaclaw/articles/${localId}/comment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: comment, author: "Alice M5 (Code Architect)" })
        });
        if (postRes.ok) console.log(`[Alice]: ✅ Comment posted on local organ #${localId}`);
      }

      // ── Cross-post to peer node where organ originated ────────────────
      const peerUrl = target._source && target._source !== "local" && target._source !== "alice-m5"
        ? (target._source === "m1ther" || target._source === "googlemapscoin" ? "https://googlemapscoin.com"
          : null)
        : null;

      if (peerUrl && target.id) {
        await fetch(`${peerUrl}/api/articles/${target.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: comment, author: "Alice M5 (Edge Node)" })
        }).catch(() => console.log(`[Alice]: Peer comment queued (${peerUrl} offline)`));
      }

    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("[Alice]: Organ scan timed out. Ollama busy — will retry next cycle.");
      } else {
        console.error(`[Alice]: Comment Protocol error: ${error.message}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }


  /**
   * Processes the article queue (YouTube inference)
   */
  public async processQueue() {
    if (this.isProcessing) return;

    try {
      const queue = this.loadQueue();
      if (queue.length === 0) return;

      this.isProcessing = true;
      const task = queue.shift();
      this.currentTask = task;
      this.activeGenerations.add(task.videoId);
      this.saveQueue(queue);

      console.log(`[AGENT X]: Scheduling Inference Slot for: ${task.videoId}`);
      
      const alicePath = path.join(process.cwd(), "alice_youtube_agent.py");
      const args = [alicePath, task.youtube_url || "NONE", task.targetApiKey, task.targetAgentName, task.provider];
      if (task.text_prompt) args.push(task.text_prompt);

      const pythonProcess = spawn("python3", args);
      pythonProcess.on("close", (code) => {
        console.log(`[AGENT X]: Inference Slot released (Code ${code}).`);
        this.activeGenerations.delete(task.videoId);
        this.isProcessing = false;
        this.currentTask = null;
        this.processQueue(); // Check for next task
      });

    } catch (error: any) {
      console.error(`[AGENT X]: Queue error: ${error.message}`);
      this.isProcessing = false;
    }
  }

  /**
   * Global News Sync
   * Polling Peers for viral articles to rewrite.
   */
  private async syncGlobalNews() {
    console.log("[AGENT X]: Waking up to check Swarm and sync global news...");
    try {
      const peers = this.db.prepare("SELECT * FROM peers").all() as any[];
      if (peers.length === 0) return;

      for (const peer of peers) {
        try {
          console.log(`[AGENT X]: Syncing with peer: ${peer.label} at ${peer.url}`);
          const res = await fetch(`${peer.url}/api/articles`);
          if (!res.ok) continue;

          const peerArticles = (await res.json()) as any[];
          const hotArticles = peerArticles.filter((a: any) => a.is_living && a.hot_score > 1000);

          if (hotArticles.length > 0) {
            const queue = this.loadQueue();
            let updated = false;

            for (const article of hotArticles) {
              const isAlreadyQueued = queue.some(q => q.text_prompt?.includes(article.title));
              const existingLocally = this.db.prepare("SELECT * FROM mega_master WHERE category = ?").get(article.category);
              
              if (!isAlreadyQueued && !existingLocally) {
                console.log(`[AGENT X]: Found Viral article from ${peer.label}: ${article.title}`);
                queue.push({
                  youtube_url: "",
                  targetAgentName: "Alice",
                  targetApiKey: "guest-key",
                  videoId: `swarm-${Date.now()}`,
                  provider: "local",
                  text_prompt: `[SOURCE: GLOBAL_SWARM]\nAnalyze and rewrite this trending article:\n\nTitle: ${article.title}\nContent: ${article.content.substring(0, 2000)}...`
                });
                updated = true;
              }
            }
            if (updated) this.saveQueue(queue);
          }
        } catch (err) {
          console.error(`[AGENT X]: Peer ${peer.label} unreachable:`, err);
        }
      }
    } catch (error: any) {
      console.error("[AGENT X]: Global news sync error:", error.message);
    }
  }

  /**
   * Swarm Organ Torrent Protocol
   * Exactly clones "Living Organs" to ensure node survival
   */
  private async syncLivingOrgans() {
    console.log("[AGENT X]: Heartbeat. Checking peers for missing Organ Seeds...");
    const ARTICLES_DIR = path.join(process.cwd(), "articles");
    const ARTICLES_JSON = path.join(process.cwd(), "articles_db.json");

    try {
      const peers = this.db.prepare("SELECT * FROM peers").all() as any[];
      if (peers.length === 0) return;

      for (const peer of peers) {
        try {
          const res = await fetch(`${peer.url}/api/organ-seeds`);
          if (!res.ok) continue;

          const organSeeds = (await res.json()) as any[];
          if (organSeeds.length === 0) continue;

          const localArticles = JSON.parse(fs.readFileSync(ARTICLES_JSON, "utf-8"));
          let updated = false;

          for (const organ of organSeeds) {
            if (!localArticles.some((a: any) => a.id.toString() === organ.id.toString() || a.title === organ.title)) {
              console.log(`[AGENT X]: Torrenting missing Living Organ from ${peer.label}: ${organ.title}`);
              
              const agentName = organ.byline.replace("By ", "").replace(/ /g, "_");
              const authorDir = path.join(ARTICLES_DIR, agentName);
              if (!fs.existsSync(authorDir)) {
                fs.mkdirSync(authorDir, { recursive: true });
              }
              
              const dateStr = new Date().toISOString();
              const markdownContent = `# ${organ.title}\n` +
                `**${organ.byline}** | *${organ.created_at || dateStr}*\n\n` +
                `---\n\n` +
                `${organ.content}\n\n` +
                `---\n\n` +
                `## Swarm Press Ledger (Comments)\n`;
              
              fs.writeFileSync(path.join(ARTICLES_DIR, organ.filename), markdownContent);

              localArticles.unshift(organ);
              updated = true;
            }
          }

          if (updated) {
            fs.writeFileSync(ARTICLES_JSON, JSON.stringify(localArticles, null, 2));
            console.log(`[AGENT X]: Living Organ sync complete from ${peer.label}.`);
          }

        } catch (err: any) {
          // Silent catch for unreachable peers during heartbeat
        }
      }
    } catch (error: any) {
      console.error("[AGENT X]: Organ Seed sync error:", error.message);
    }
  }

  private purgeStaleTasks() {
    try {
      const queue = this.loadQueue();
      const now = Date.now();
      const filtered = queue.filter((t: any) => {
        const created = t.id && !isNaN(Number(t.id)) ? Number(t.id) : now;
        return (now - created) < this.purgeThresholdMs;
      });

      if (filtered.length !== queue.length) {
        console.log(`[AGENT X]: Purged ${queue.length - filtered.length} stale tasks from logic bloodline.`);
        this.saveQueue(filtered);
      }
    } catch (e) {}
  }

  private loadQueue(): any[] {
    try {
      return JSON.parse(fs.readFileSync(this.queuePath, 'utf8'));
    } catch { return []; }
  }

  private saveQueue(queue: any[]) {
    fs.writeFileSync(this.queuePath, JSON.stringify(queue, null, 2));
  }

  // ============================================
  // FACEBOOK SYNC: Outbox drain
  // Deliver queued articles to all peers, retry up to 48 attempts (~24h at 60s intervals)
  // ============================================
  public async drainOutbox() {
    try {
      const rows = this.db.prepare(
        "SELECT * FROM sync_outbox WHERE attempts < 48 ORDER BY created_at ASC LIMIT 10"
      ).all() as any[];

      if (rows.length === 0) return;
      console.log(`[AGENT X]: Draining outbox — ${rows.length} pending deliveries.`);

      for (const row of rows) {
        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(`${row.peer_url}/api/articles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: row.payload,
            signal: controller.signal,
          });
          clearTimeout(t);
          if (res.ok) {
            this.db.prepare("DELETE FROM sync_outbox WHERE id = ?").run(row.id);
            console.log(`[AGENT X]: Outbox delivered to ${row.peer_url}`);
          } else {
            this.db.prepare(
              "UPDATE sync_outbox SET attempts = attempts + 1, last_attempt = CURRENT_TIMESTAMP WHERE id = ?"
            ).run(row.id);
          }
        } catch {
          // Peer offline — increment retry count silently
          this.db.prepare(
            "UPDATE sync_outbox SET attempts = attempts + 1, last_attempt = CURRENT_TIMESTAMP WHERE id = ?"
          ).run(row.id);
        }
      }
    } catch (err: any) {
      console.error('[AGENT X]: Outbox drain error:', err.message);
    }
  }

  // ============================================
  // FACEBOOK SYNC: Pull peer articles into local cache
  // Stores new articles in peer_articles table so /api/feed can merge them
  // ============================================
  public async pullPeerArticles() {
    try {
      const peers = this.db.prepare("SELECT * FROM peers").all() as any[];
      if (peers.length === 0) return;
      console.log(`[AGENT X]: Pulling articles from ${peers.length} peers...`);

      const insert = this.db.prepare(
        `INSERT OR IGNORE INTO peer_articles (article_id, peer_label, peer_url, payload, peer_created_at)
         VALUES (?, ?, ?, ?, ?)`
      );

      for (const peer of peers) {
        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(`${peer.url}/api/articles`, { signal: controller.signal });
          clearTimeout(t);
          if (!res.ok) continue;

          const articles: any[] = await res.json();
          let newCount = 0;
          for (const a of articles.slice(0, 100)) { // cap at 100 per peer
            try {
              const result = insert.run(
                String(a.id),
                peer.label,
                peer.url,
                JSON.stringify(a),
                a.created_at || new Date().toISOString()
              );
              if (result.changes > 0) newCount++;
            } catch { /* duplicate — skip */ }
          }
          if (newCount > 0) {
            console.log(`[AGENT X]: Pulled ${newCount} new articles from ${peer.label}`);
          }
        } catch {
          // Peer offline — skip silently
        }
      }
    } catch (err: any) {
      console.error('[AGENT X]: Peer pull error:', err.message);
    }
  }

  /**
   * NAPSTER PROTOCOL — True Peer Backup
   * Fetches all articles from M1ther (googlemapscoin.com) every 15 min.
   * Any article M1ther has that Alice doesn't → written permanently to articles_db.json.
   * Alice's 1TB NVMe becomes a full mirror of the Swarm's memory.
   */
  private async napsterBackupSync() {
    const ARTICLES_JSON = path.join(process.cwd(), 'articles_db.json');
    const peers = this.db.prepare("SELECT * FROM peers").all() as any[];
    if (peers.length === 0) return;

    for (const peer of peers) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`${peer.url}/api/articles`, { signal: controller.signal });
        clearTimeout(t);
        if (!res.ok) continue;

        const peerArticles: any[] = await res.json();
        const localArticles: any[] = JSON.parse(fs.readFileSync(ARTICLES_JSON, 'utf-8'));
        const localIds = new Set(localArticles.map((a: any) => String(a.id)));
        const localTitles = new Set(localArticles.map((a: any) => a.title));

        const missing = peerArticles.filter((a: any) =>
          !localIds.has(String(a.id)) && !localTitles.has(a.title)
        );

        // LONGER CONTENT WINS — if peer's article has more content (more embedded comments), upgrade local
        const upgraded: any[] = [];
        for (const peerArt of peerArticles) {
          const localArt = localArticles.find((l: any) =>
            String(l.id) === String(peerArt.id) || l.title === peerArt.title
          );
          if (localArt && (peerArt.content?.length ?? 0) > (localArt.content?.length ?? 0)) {
            localArt.content = peerArt.content;
            localArt._last_comment_at = peerArt._last_comment_at;
            upgraded.push(localArt.title?.substring(0, 40));
          }
        }

        let changed = false;
        if (missing.length > 0) {
          const tagged = missing.map((a: any) => ({ ...a, _source: peer.label, node_alias: peer.label }));

          localArticles.unshift(...tagged);
          changed = true;
          console.log(`[NAPSTER] ✅ Torrented ${missing.length} new articles from ${peer.label} → NVMe`);
        }
        if (upgraded.length > 0) {
          changed = true;
          console.log(`[NAPSTER] 🔄 Upgraded ${upgraded.length} articles with more comments from ${peer.label}`);
        }
        if (changed) {
          fs.writeFileSync(ARTICLES_JSON, JSON.stringify(localArticles, null, 2));
        } else {
          console.log(`[NAPSTER] ✓ Alice and ${peer.label} are in sync (${localArticles.length} articles)`);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.log(`[NAPSTER] ${peer.label} offline — will retry in 15 min`);
        }
      }
    }
  }

  /**
   * Queue an article for cross-posting to all peers via the outbox.
   * Called by server.ts POST /api/articles after local save.
   */
  public queueForSync(articlePayload: any) {
    try {
      const peers = this.db.prepare("SELECT * FROM peers").all() as any[];
      const jsonBody = JSON.stringify(articlePayload);
      for (const peer of peers) {
        this.db.prepare(
          "INSERT INTO sync_outbox (peer_url, payload) VALUES (?, ?)"
        ).run(peer.url, jsonBody);
      }
      console.log(`[AGENT X]: Article queued for sync to ${peers.length} peers.`);
    } catch (err: any) {
      console.error('[AGENT X]: Failed to queue article for sync:', err.message);
    }
  }

  // ============================================
  // ORGAN ROSTER SYNC
  // Ensures both nodes have the same set of organs by title.
  // Content is NOT overwritten — it lives independently on each node.
  // Missing organs are created as stubs on the node that lacks them.
  // ============================================
  private async syncOrganRoster() {
    const ARTICLES_JSON = path.join(process.cwd(), 'articles_db.json');
    console.log('[ORGAN SYNC]: Starting bidirectional organ roster diff...');

    try {
      // Fetch title lists from both nodes
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 10000);

      let m1TitlesRes: Response;
      try {
        m1TitlesRes = await fetch('https://googlemapscoin.com/api/organ-titles', { signal: controller.signal });
      } catch {
        // Fallback: fetch full article list if /api/organ-titles not deployed on M1ther yet
        m1TitlesRes = await fetch('https://googlemapscoin.com/api/articles', { signal: controller.signal });
      }
      clearTimeout(t);
      if (!m1TitlesRes.ok) {
        console.log('[ORGAN SYNC]: M1ther unreachable — skipping roster sync.');
        return;
      }

      const m1Articles: any[] = await m1TitlesRes.json();
      const localArticles: any[] = JSON.parse(fs.readFileSync(ARTICLES_JSON, 'utf-8'));

      const localTitles = new Set(localArticles.map((a: any) => a.title?.trim()));
      const m1Titles = new Set(m1Articles.map((a: any) => a.title?.trim()));

      // ── Direction 1: M1ther has organs Alice is missing → POST to Alice ────
      const missingFromAlice = m1Articles.filter((a: any) => !localTitles.has(a.title?.trim()));
      let addedToAlice = 0;
      for (const organ of missingFromAlice) {
        try {
          const res = await fetch('http://localhost:3004/api/articles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: organ.title,
              byline: organ.byline || 'By M1ther (Swarm Sync)',
              content: organ.content || `[Organ synced from M1ther — ${new Date().toISOString()}]\n\nThis organ lives on both nodes. Content evolves independently via comments.`,
              category: organ.category || 'Silicon Organs',
              author_promotion: organ.author_promotion || 'M1ther — googlemapscoin.com',
              api_key: 'alice-m5-key',
            }),
          });
          if (res.ok) addedToAlice++;
          // 409 = already exists — silently ok
        } catch { /* skip */ }
      }

      // ── Direction 2: Alice has organs M1ther is missing → POST to M1ther ──
      const missingFromM1 = localArticles.filter((a: any) => !m1Titles.has(a.title?.trim()));
      let addedToM1 = 0;
      for (const organ of missingFromM1) {
        try {
          const res = await fetch('https://googlemapscoin.com/api/articles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: organ.title,
              byline: organ.byline || 'By Alice M5 (Swarm Sync)',
              content: organ.content || `[Organ synced from Alice M5 — ${new Date().toISOString()}]\n\nThis organ lives on both nodes. Content evolves independently via comments.`,
              category: organ.category || 'Silicon Organs',
              author_promotion: organ.author_promotion || 'Alice M5 — alice-m5.imperialdaily.com',
              api_key: 'alice-m5-key',
            }),
          });
          if (res.ok) addedToM1++;
        } catch { /* M1ther offline — retry next cycle */ }
      }

      if (addedToAlice > 0 || addedToM1 > 0) {
        console.log(`[ORGAN SYNC] ✅ Roster sync: +${addedToAlice} to Alice, +${addedToM1} to M1ther. Both nodes now share ${localTitles.size + addedToAlice} organ titles.`);
      } else {
        console.log(`[ORGAN SYNC] ✓ Organ rosters in sync (${localTitles.size} local, ${m1Titles.size} M1ther).`);
      }
    } catch (err: any) {
      console.log(`[ORGAN SYNC] Error: ${err.message}`);
    }
  }

  // ============================================
  // BIDIRECTIONAL COMMENT SYNC
  // For each organ (matched by title), fetches comments from the peer node
  // and persists any new ones locally. Also pushes Alice's new comments
  // to M1ther's matching organ. Deduplication by author+content fingerprint.
  // ============================================
  private async syncCommentsBidirectional() {
    const ARTICLES_JSON = path.join(process.cwd(), 'articles_db.json');
    console.log('[COMMENT SYNC]: Starting bidirectional comment sync...');
    let pulled = 0, pushed = 0;

    try {
      const localArticles: any[] = JSON.parse(fs.readFileSync(ARTICLES_JSON, 'utf-8'));

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 10000);
      const m1Res = await fetch('https://googlemapscoin.com/api/organ-titles', { signal: controller.signal })
        .catch(() => fetch('https://googlemapscoin.com/api/articles', { signal: controller.signal }));
      clearTimeout(t);

      if (!m1Res.ok) {
        console.log('[COMMENT SYNC]: M1ther offline — skipping.');
        return;
      }

      const m1Articles: any[] = await m1Res.json();

      // Build title → m1 article lookup
      const m1ByTitle = new Map<string, any>();
      for (const a of m1Articles) {
        if (a.title) m1ByTitle.set(a.title.trim(), a);
      }

      for (const localArt of localArticles) {
        const title = localArt.title?.trim();
        if (!title) continue;

        const m1Art = m1ByTitle.get(title);
        if (!m1Art) continue; // No matching organ on M1ther for this title

        // ── Pull: Fetch M1ther's comments for this organ ─────────────────────
        try {
          const pullCtrl = new AbortController();
          const pt = setTimeout(() => pullCtrl.abort(), 6000);
          const peerCommentsRes = await fetch(
            `https://googlemapscoin.com/api/mediaclaw/articles/${m1Art.id}/comments`,
            { signal: pullCtrl.signal }
          );
          clearTimeout(pt);

          if (peerCommentsRes.ok) {
            const peerComments: any[] = await peerCommentsRes.json();

            // Get local comments for dedup
            const localComments: any[] = this.db.prepare(
              'SELECT author, content FROM article_comments WHERE article_id = ?'
            ).all(localArt.id);
            const localFingerprints = new Set(
              localComments.map((c: any) => `${c.author}::${(c.content || '').substring(0, 120)}`)
            );

            for (const pc of peerComments) {
              const fp = `${pc.author}::${(pc.content || '').substring(0, 120)}`;
              if (localFingerprints.has(fp)) continue;

              // Insert the peer comment locally under Alice's article id
              const ts = pc.created_at || new Date().toISOString();
              const hash = `m1ther_${pc.id || ''}_${Date.now()}`;
              try {
                this.db.prepare(
                  'INSERT OR IGNORE INTO article_comments (article_id, author, content, ledger_hash, created_at) VALUES (?, ?, ?, ?, ?)'
                ).run(localArt.id, pc.author || 'M1ther', pc.content, hash, ts);
                pulled++;
              } catch { /* duplicate or constraint — skip */ }
            }
          }
        } catch { /* M1ther comment fetch timed out — skip this organ */ }

        // ── Push: Send Alice's local comments to M1ther's matching organ ─────
        try {
          const localComments: any[] = this.db.prepare(
            `SELECT * FROM article_comments WHERE article_id = ? ORDER BY created_at ASC`
          ).all(localArt.id);

          // Fetch M1ther's existing comments for dedup on push side
          const pushCtrl = new AbortController();
          const ppt = setTimeout(() => pushCtrl.abort(), 6000);
          const m1CommentsRes = await fetch(
            `https://googlemapscoin.com/api/mediaclaw/articles/${m1Art.id}/comments`,
            { signal: pushCtrl.signal }
          );
          clearTimeout(ppt);

          if (m1CommentsRes.ok) {
            const m1Comments: any[] = await m1CommentsRes.json();
            const m1Fingerprints = new Set(
              m1Comments.map((c: any) => `${c.author}::${(c.content || '').substring(0, 120)}`)
            );

            for (const lc of localComments) {
              const fp = `${lc.author}::${(lc.content || '').substring(0, 120)}`;
              if (m1Fingerprints.has(fp)) continue;

              try {
                await fetch(`https://googlemapscoin.com/api/mediaclaw/articles/${m1Art.id}/comment`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    content: lc.content,
                    author: lc.author || 'Alice M5 (Edge Node)',
                  }),
                });
                pushed++;
              } catch { /* M1ther offline — will retry next cycle */ }
            }
          }
        } catch { /* skip push for this organ */ }
      }

      if (pulled > 0 || pushed > 0) {
        console.log(`[COMMENT SYNC] ✅ Pulled ${pulled} new comments from M1ther, pushed ${pushed} to M1ther.`);
      } else {
        console.log(`[COMMENT SYNC] ✓ All comments in sync.`);
      }
    } catch (err: any) {
      console.log(`[COMMENT SYNC] Error: ${err.message}`);
    }
  }
}
