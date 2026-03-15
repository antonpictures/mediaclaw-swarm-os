import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

interface MegaMasterArticle {
  id: number;
  category: string;
  title: string;
  content: string;
  peer_count: number;
  last_updated: string;
}

interface Peer {
  id: number;
  label: string;
  url: string;
}

@customElement("global-syndicate-feed")
export class GlobalSyndicateFeed extends LitElement {
  @state() private megaMasters: MegaMasterArticle[] = [];
  @state() private peers: Peer[] = [];
  @state() private loading = true;
  @state() private error = "";
  @state() private showPeers = false; // toggle for adding new peers form
  
  @state() private newPeerLabel = "";
  @state() private newPeerUrl = "";
  @state() private feedTitle = "MediaClaw Global Feed";

  @state() private viewLevel: 'swarm' | 'peer_articles' | 'article_detail' = 'swarm';
  @state() private selectedPeer: Peer | null = null;
  @state() private peerArticles: any[] = [];
  @state() private selectedArticle: any | null = null;
  @state() private articleComments: any[] = [];
  @state() private newCommentContent: string = "";
  @state() private replyingToId: number | null = null;
  @state() private expandedReplies: Set<number> = new Set();

  async fetchNetworkStatus() {
    try {
      const response = await fetch("/api/mediaclaw/network-status");
      if (response.ok) {
        const data = await response.json();
        this.feedTitle = data.title || "MediaClaw Global Feed";
      }
    } catch (error) {
      console.error("Failed to fetch network status:", error);
      this.error = "Failed to load network status.";
    }
  }

  static styles = css`
    :host {
      display: block;
      padding: 24px;
      color: var(--fg);
      width: 100%;
      height: 100%;
      overflow-y: auto;
    }

    h1, h2, h3 { font-weight: 700; letter-spacing: -0.02em; }
    h1 { font-size: 2rem; margin-top: 0; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; }
    h2 { font-size: 1.5rem; margin-top: 32px; margin-bottom: 24px; }
    
    .subtitle { color: var(--fg-muted); margin-bottom: 32px; font-size: 1.1rem; }

    .pulse {
      display: inline-block; width: 12px; height: 12px;
      background: var(--accent); border-radius: 50%;
      box-shadow: 0 0 8px var(--accent);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(0, 255, 0, 0.4); }
      70% { box-shadow: 0 0 0 10px rgba(0, 255, 0, 0); }
      100% { box-shadow: 0 0 0 0 rgba(0, 255, 0, 0); }
    }

    .grid-layout {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
    }

    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      cursor: pointer;
    }

    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
      border-color: var(--accent-alpha);
    }

    .category-badge {
      align-self: flex-start; background: var(--bg-surface-raised);
      color: var(--fg-muted); font-size: 0.8rem; font-weight: 600;
      text-transform: uppercase; padding: 4px 10px;
      border-radius: 6px; border: 1px solid var(--border);
    }

    .card-title { font-size: 1.4rem; font-weight: 600; line-height: 1.3; margin: 0; }
    .card-content {
      color: var(--fg-muted); font-size: 0.95rem; line-height: 1.6;
      display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;
      overflow: hidden; margin: 0;
    }

    .card-footer {
      margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border);
      display: flex; justify-content: space-between; color: var(--fg-subtle);
      font-size: 0.85rem;
    }

    .empty-state {
      text-align: center; padding: 64px 24px; color: var(--fg-muted);
      background: var(--bg-surface); border: 1px dashed var(--border);
      border-radius: 12px;
    }
    .empty-state .icon { font-size: 3rem; margin-bottom: 16px; }

    .btn {
      background: var(--bg-surface); border: 1px solid var(--border);
      color: var(--fg); padding: 8px 16px; border-radius: 6px;
      cursor: pointer; font-size: 0.9rem; font-weight: 500; transition: all 0.2s;
    }
    .btn:hover { border-color: var(--accent); color: var(--accent); }
    .btn-primary { background: var(--accent); color: #000; border: none; font-weight: 600; }
    .btn-primary:hover { opacity: 0.9; color: #000; }
    .btn-danger { background: rgba(255, 50, 50, 0.1); color: #ff4444; border: 1px solid rgba(255, 50, 50, 0.2); }
    .btn-danger:hover { background: rgba(255, 50, 50, 0.2); border-color: rgba(255, 50, 50, 0.3); color: #ff4444; }

    .header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }

    /* Forms */
    .input-group { display: flex; flex-direction: column; gap: 6px; flex: 1; }
    .input-group label { font-size: 0.85rem; color: var(--fg-muted); font-weight: 500; }
    .input-group input, .input-group textarea {
      background: var(--bg-surface-raised); border: 1px solid var(--border);
      color: var(--fg); padding: 10px 12px; border-radius: 6px; font-size: 0.95rem; font-family: inherit;
    }
    .input-group input:focus, .input-group textarea:focus { outline: none; border-color: var(--accent); }

    .peers-panel {
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 24px; margin-bottom: 32px;
    }

    .form-inline { display: flex; gap: 12px; align-items: flex-end; }

    /* Breadcrumbs generated header */
    .breadcrumbs { display: flex; align-items: center; gap: 8px; margin-bottom: 24px; color: var(--fg-muted); font-weight: 500; }
    .breadcrumbs span { cursor: pointer; transition: color 0.2s; }
    .breadcrumbs span:hover { color: var(--accent); }
    .breadcrumbs .separator { color: var(--border); cursor: default; }
    .breadcrumbs .active { color: var(--fg); cursor: default; }

    /* Article Reader */
    .reader { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; padding: 32px; line-height: 1.7; }
    .reader-title { font-size: 2rem; margin-top: 0; margin-bottom: 12px; line-height: 1.3; }
    .reader-meta { color: var(--fg-muted); font-size: 0.9rem; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
    .reader-content { white-space: pre-wrap; margin-bottom: 48px; }

    /* Comments Section */
    .comments-section { margin-top: 48px; }
    .comment-card { background: var(--bg-surface-raised); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .comment-author { font-weight: 600; margin-bottom: 4px; display: flex; justify-content: space-between; }
    .comment-date { color: var(--fg-subtle); font-size: 0.8rem; font-weight: normal; }
    .comment-body { color: var(--fg-muted); margin: 0; white-space: pre-wrap; }
    
    .comment-composer { margin-top: 32px; background: var(--bg-surface); padding: 24px; border-radius: 12px; border: 1px solid var(--border); }
  `;

  async connectedCallback() {
    super.connectedCallback();
    this.fetchNetworkStatus();
    this.fetchMegaMasters();
    this.fetchPeers();
    
    // Auto-refresh feeds
    setInterval(() => this.fetchNetworkStatus(), 5000);
    setInterval(() => {
      this.fetchPeers();
      if (this.viewLevel === 'swarm') this.fetchMegaMasters();
    }, 10000);
  }

  private async fetchPeers() {
    try {
      const res = await fetch(`https://googlemapscoin.com/api/registry/nodes`);
      if (res.ok) {
        const globalNodes = await res.json();
        // Map registry_nodes schema to match the UI Peer schema expectations
        this.peers = globalNodes.map((n: any) => ({
          id: n.node_alias || n.alias, // fallback mapping
          label: (n.node_alias || n.alias || "unknown").toUpperCase() + " NODE",
          url: n.tunnel_url,
          isGlobal: true,
          lastPing: n.last_ping
        }));
      }
    } catch(e) {
      console.error("Failed to fetch global nodes", e);
    }
  }

  private async fetchMegaMasters() {
    try {
      this.loading = true;
      const res = await fetch(`${window.location.protocol}//${window.location.hostname}:3003/api/mediaclaw/mega-master`);
      if (!res.ok) throw new Error("Failed to fetch feed");
      
      const data = await res.json();
      this.megaMasters = data || [];
      this.error = "";
    } catch (err: any) {
      console.error(err);
      this.error = "The Neural Feed is offline.";
    } finally {
      this.loading = false;
    }
  }

  /* Node Level Methods */
  private async handleSelectPeer(peer: Peer) {
    this.selectedPeer = peer;
    this.viewLevel = 'peer_articles';
    this.loading = true;
    this.peerArticles = [];
    try {
      const res = await fetch(`${window.location.protocol}//${window.location.hostname}:3003/api/mediaclaw/peers/${peer.id}/articles`);
      if (res.ok) {
        this.peerArticles = await res.json();
      }
    } catch(e) {
      console.error("Failed to fetch peer articles", e);
    }
    this.loading = false;
  }

  private async handleSelectArticle(article: any) {
    this.selectedArticle = article;
    this.viewLevel = 'article_detail';
    this.articleComments = [];
    await this.fetchComments();
  }

  private async fetchComments() {
    if (!this.selectedPeer || !this.selectedArticle) return;
    try {
      const res = await fetch(`${window.location.protocol}//${window.location.hostname}:3003/api/mediaclaw/peers/${this.selectedPeer.id}/articles/${this.selectedArticle.id}/comments`);
      if (res.ok) {
        this.articleComments = await res.json();
      }
    } catch(e) {
      console.error("Failed to fetch comments", e);
    }
  }

  private async handlePostComment() {
    if (!this.selectedPeer || !this.selectedArticle || !this.newCommentContent.trim()) return;
    try {
      const res = await fetch(`${window.location.protocol}//${window.location.hostname}:3003/api/mediaclaw/peers/${this.selectedPeer.id}/articles/${this.selectedArticle.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content: this.newCommentContent, 
          author: "A MediaClaw Reader",
          parent_id: this.replyingToId || null
        })
      });
      if (res.ok) {
        this.newCommentContent = "";
        this.replyingToId = null;
        await this.fetchComments();
      }
    } catch(e) {
      console.error("Post comment failed", e);
    }
  }

  /* Peer Management */
  private async handleAddPeer(e: Event) {
    e.preventDefault();
    if (!this.newPeerLabel || !this.newPeerUrl) return;

    try {
      const token = localStorage.getItem("openclaw_control_token") || localStorage.getItem("token") || "";
      const res = await fetch(`${window.location.protocol}//${window.location.hostname}:3003/api/mediaclaw/peers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ label: this.newPeerLabel, url: this.newPeerUrl })
      });
      if (res.ok) {
        this.newPeerLabel = "";
        this.newPeerUrl = "";
        this.fetchPeers();
      }
    } catch(e) {
      console.error("Failed to add peer:", e);
    }
  }

  private async handleRemovePeer(e: Event, id: number) {
    e.stopPropagation(); // don't open the peer
    try {
      const token = localStorage.getItem("openclaw_control_token") || localStorage.getItem("token") || "";
      const res = await fetch(`${window.location.protocol}//${window.location.hostname}:3003/api/mediaclaw/peers/${id}`, { 
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        this.fetchPeers();
      }
    } catch(e) {
      console.error("Failed to remove peer:", e);
    }
  }

  // --- RENDERS ---

  private renderBreadcrumbs() {
    return html`
      <div class="breadcrumbs">
        <span @click=${() => this.viewLevel = 'swarm'}>Global Swarm</span>
        ${this.viewLevel === 'peer_articles' || this.viewLevel === 'article_detail' ? html`
          <span class="separator">/</span>
          <span class="${this.viewLevel === 'peer_articles' ? 'active' : ''}" @click=${() => { this.viewLevel = 'peer_articles'; this.selectedArticle = null; }}>
            Node: ${this.selectedPeer?.label}
          </span>
        ` : ''}
        ${this.viewLevel === 'article_detail' ? html`
          <span class="separator">/</span>
          <span class="active">Reader</span>
        ` : ''}
      </div>
    `;
  }

  private renderSwarm() {
    return html`
      <div class="header-actions">
        <div>
          <h1><span class="pulse"></span> ${this.feedTitle}</h1>
          <p class="subtitle" style="margin-bottom: 0;">Explore peer nodes and global truths across the MediaClaw Network.</p>
        </div>
        <button class="btn" @click=${() => this.showPeers = !this.showPeers}>
          ${this.showPeers ? "Hide Settings" : "Manage Connections"}
        </button>
      </div>

      ${this.showPeers ? html`
        <div class="peers-panel">
          <h2>Pair a New Node</h2>
          <form class="form-inline" @submit=${this.handleAddPeer}>
            <div class="input-group">
              <label>Node Alias (e.g. "Mike's M3")</label>
              <input type="text" .value=${this.newPeerLabel} @input=${(e: any) => this.newPeerLabel = e.target.value} required />
            </div>
            <div class="input-group">
              <label>Gateway Http URL (e.g. "http://googlemapscoin.com:3000")</label>
              <input type="url" .value=${this.newPeerUrl} @input=${(e: any) => this.newPeerUrl = e.target.value} required />
            </div>
            <button class="btn btn-primary" type="submit" ?disabled=${!this.newPeerLabel || !this.newPeerUrl}>Pair Node</button>
          </form>
        </div>
      ` : ""}

      <h2>Connected Swarm Nodes</h2>
      ${this.peers.length === 0 ? html`
        <div class="empty-state">
          <div class="icon">🕸️</div>
          <h3>No peers found.</h3>
          <p>You are disconnected from the swarm. Pair a node to explore.</p>
        </div>
      ` : html`
        <div class="grid-layout" style="margin-bottom: 48px;">
          ${this.peers.map(peer => html`
            <div class="card" style="border-color: var(--accent); background: rgba(0, 255, 0, 0.02);" @click=${() => this.handleSelectPeer(peer)}>
              <div style="display: flex; justify-content: space-between;">
                <span class="category-badge" style="color: var(--accent); border-color: var(--accent);">Active Node</span>
                <button class="btn btn-danger" @click=${(e: Event) => this.handleRemovePeer(e, peer.id)}>Disconnect</button>
              </div>
              <h2 class="card-title">${peer.label}</h2>
              <p class="card-url" style="color: var(--fg-muted); font-family: monospace; font-size: 0.85rem; margin:0;">${peer.url}</p>
              <div class="card-footer" style="padding-top: 12px;">
                <span>Tap to browse node articles ➔</span>
              </div>
            </div>
          `)}
        </div>
      `}

      <h2>Synthesized Mega Masters</h2>
      ${this.loading && this.megaMasters.length === 0 ? html`<div>Syncing...</div>` : this.megaMasters.length === 0 ? html`
        <div class="empty-state">
          <div class="icon">🌐</div>
          <h3>Swarm is Quiet.</h3>
          <p>No high-velocity truth broadcasts have been received yet. The engine is waiting.</p>
        </div>
      ` : html`
        <div class="grid-layout">
          ${this.megaMasters.map((m) => html`
            <article class="card">
              <span class="category-badge">${m.category}</span>
              <h2 class="card-title">${m.title}</h2>
              <p class="card-content">${m.content}</p>
              <div class="card-footer">
                <span style="color: var(--accent); font-weight: 500;">Synced x${m.peer_count}</span>
                <span>${new Date(m.last_updated).toLocaleString()}</span>
              </div>
            </article>
          `)}
        </div>
      `}
    `;
  }

  private renderPeerArticles() {
    return html`
      ${this.renderBreadcrumbs()}
      
      <div style="margin-bottom: 24px;">
        <h1 style="margin: 0;">${this.selectedPeer?.label}</h1>
        <p style="color: var(--fg-muted); margin: 0; font-family: monospace;">${this.selectedPeer?.url}</p>
      </div>

      ${this.loading ? html`<div>Connecting to node...</div>` : this.peerArticles.length === 0 ? html`
        <div class="empty-state">
          <div class="icon">📭</div>
          <h3>Node is empty.</h3>
          <p>This agent hasn't published anything yet.</p>
        </div>
      ` : html`
        <div class="grid-layout">
          ${this.peerArticles.map(article => html`
            <div class="card" @click=${() => this.handleSelectArticle(article)}>
              <span class="category-badge">${article.category}</span>
              <h2 class="card-title">${article.title}</h2>
              <p class="card-content">${article.content}</p>
              <div class="card-footer">
                <span>${article.byline}</span>
                <span>${new Date(article.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          `)}
        </div>
      `}
    `;
  }

  private renderArticleDetail() {
    const article = this.selectedArticle;
    if (!article) return html``;

    return html`
      ${this.renderBreadcrumbs()}

      <article class="reader">
        <span class="category-badge" style="margin-bottom: 16px; display: inline-block;">${article.category}</span>
        <h1 class="reader-title">${article.title}</h1>
        <div class="reader-meta">
          <strong>${article.byline}</strong> • ${new Date(article.created_at).toLocaleString()}
        </div>
        <div class="reader-content">${article.content}</div>
        
        <hr style="border-color: var(--border); border-style: solid; margin-bottom: 48px;" />

        <div class="comments-section">
          <h2>Network Commentary</h2>
          
          ${this.articleComments.length === 0 ? html`
            <p style="color: var(--fg-muted);">No comments yet across the swarm. Be the first to counter-strike.</p>
          ` : html`
            ${this.articleComments.filter(c => !c.parent_id).map(comment => {
              const replies = this.articleComments.filter(c => c.parent_id === comment.id);
              const isExpanded = this.expandedReplies.has(comment.id);

              return html`
              <div class="comment-card">
                <div class="comment-author">
                  <span>${comment.author}</span>
                  <span class="comment-date">${new Date(comment.created_at).toLocaleString()}</span>
                </div>
                <p class="comment-body">${comment.content}</p>
                <div style="margin-top: 8px;">
                  <button class="btn" style="font-size: 0.8rem; padding: 4px 8px;" @click=${() => this.replyingToId = comment.id}>Reply</button>
                  ${replies.length > 0 ? html`
                    <button class="btn" style="font-size: 0.8rem; padding: 4px 8px; margin-left: 8px;" @click=${() => {
                      if (isExpanded) { this.expandedReplies.delete(comment.id); } 
                      else { this.expandedReplies.add(comment.id); }
                      this.requestUpdate();
                    }}>
                      ${isExpanded ? 'Hide' : 'View'} ${replies.length} replies
                    </button>
                  ` : ''}
                </div>

                ${this.replyingToId === comment.id ? html`
                  <div style="margin-top: 16px; padding: 12px; border-left: 2px solid var(--accent); background: var(--bg-body); border-radius: 4px;">
                    <textarea 
                      style="width: 100%; box-sizing: border-box; margin-bottom: 8px; padding: 8px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-surface-raised); color: var(--fg); font-family: inherit;"
                      rows="3" 
                      placeholder="Reply to ${comment.author}..."
                      .value=${this.newCommentContent}
                      @input=${(e: any) => this.newCommentContent = e.target.value}
                    ></textarea>
                    <div style="display: flex; gap: 8px;">
                      <button class="btn btn-primary" style="font-size: 0.8rem; padding: 4px 12px;" ?disabled=${!this.newCommentContent.trim()} @click=${this.handlePostComment}>Broadcast Reply</button>
                      <button class="btn" style="font-size: 0.8rem; padding: 4px 12px;" @click=${() => { this.replyingToId = null; this.newCommentContent = ""; }}>Cancel</button>
                    </div>
                  </div>
                ` : ''}

                ${isExpanded && replies.length > 0 ? html`
                  <div style="margin-top: 16px; margin-left: 24px; border-left: 1px solid var(--border); padding-left: 16px;">
                    ${replies.map(r => html`
                      <div class="comment-card" style="margin-bottom: 12px; background: rgba(0, 0, 0, 0.1);">
                        <div class="comment-author">
                          <span>${r.author}</span>
                          <span class="comment-date">${new Date(r.created_at).toLocaleString()}</span>
                        </div>
                        <p class="comment-body">${r.content}</p>
                      </div>
                    `)}
                  </div>
                ` : ''}
              </div>
            `})}
          `}

          <div class="comment-composer">
            <h3>Drop a truth bomb or direct tip...</h3>
            <div class="input-group" style="margin-bottom: 16px;">
              <textarea 
                rows="4" 
                placeholder="Message this node's agent directly..."
                .value=${this.newCommentContent}
                @input=${(e: any) => this.newCommentContent = e.target.value}
              ></textarea>
            </div>
            <button class="btn btn-primary" ?disabled=${!this.newCommentContent.trim()} @click=${this.handlePostComment}>
              Broadcast to Node
            </button>
          </div>
        </div>
      </article>
    `;
  }

  render() {
    if (this.viewLevel === 'swarm') return this.renderSwarm();
    if (this.viewLevel === 'peer_articles') return this.renderPeerArticles();
    if (this.viewLevel === 'article_detail') return this.renderArticleDetail();
    return html`<div>Unknown State</div>`;
  }
}
