import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

export interface Article {
  id: number;
  filename?: string;
  title: string;
  category: string;
  created_at: string;
  content: string;
  byline: string;
}

@customElement("newspaper-list")
export class NewspaperList extends LitElement {
  @state() private _articles: Article[] = [];
  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _selectedArticle: Article | null = null;
  @state() private _aiPrompt: string = "";
  @state() private _isAiThinking = false;

  static styles = css`
    :host {
      display: block;
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 1.5rem;
      max-width: 900px;
    }

    .article-item {
      border-bottom: 1px solid var(--border);
      padding: 1.5rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      text-decoration: none;
      color: inherit;
      border-radius: 8px;
      transition: background-color 0.15s ease;
      cursor: pointer;
    }
    
    .article-item:hover {
      background-color: rgba(150, 150, 150, 0.1);
    }
    
    .article-item:active {
      background-color: rgba(150, 150, 150, 0.15);
    }
    
    .article-item:last-child {
      border-bottom: none;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .title {
      font-size: 1.125rem;
      font-weight: 500;
      color: var(--text);
      margin: 0;
      line-height: 1.4;
      flex: 1;
      padding-right: 1rem;
    }

    .credits {
      border: 1px solid var(--border);
      color: var(--muted);
      font-size: 0.65rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
      text-align: center;
      line-height: 1.2;
    }

    .credits span {
      display: block;
      font-size: 0.55rem;
      opacity: 0.8;
    }

    .meta-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.75rem;
      color: var(--muted);
      margin-top: 0.25rem;
    }

    .category {
      background: transparent;
      color: var(--accent);
      border: 1px solid var(--border);
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 0.65rem;
    }

    .preview {
      font-size: 0.875rem;
      color: var(--muted);
      line-height: 1.5;
      margin-top: 0.5rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 0.8;
    }
    
    .loading, .error {
      padding: 2rem;
      text-align: center;
      color: var(--muted);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.fetchArticles();
  }

  private async fetchArticles() {
    this._loading = true;
    try {
      const res = await fetch(`${window.location.protocol}//${window.location.hostname}:3003/api/articles`);
      if (!res.ok) throw new Error("Failed to fetch articles");
      const data = await res.json();
      this._articles = Array.isArray(data) ? data : [];
      // Sort newest first
      this._articles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (err: any) {
      console.error(err);
      this._error = err.message || "Unknown error";
    } finally {
      this._loading = false;
    }
  }

  private getPreviewText(content: string) {
    if (!content) return "";
    let text = content
      .replace(/\[EMBED YOUTUBE:[^\]]*\]\s*/g, "")
      .replace(/---\s*📢 SPONSORED MESSAGE:[^\-]+---\s*/g, "")
      .trim();
    return text.split("\n\n")[0];
  }

  private formatDate(dateStr: string) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  private async saveArticle() {
    if (!this._selectedArticle) return;
    try {
      const res = await fetch(`${window.location.protocol}//${window.location.hostname}:3003/api/articles/${this._selectedArticle.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer george-key" },
        body: JSON.stringify({
          title: this._selectedArticle.title,
          content: this._selectedArticle.content
        })
      });
      if (!res.ok) throw new Error("Failed to save");
      // Refresh the list list to show updated content preview
      this.fetchArticles();
      this._selectedArticle = null;
    } catch (e) {
      console.error(e);
      alert("Failed to save article.");
    }
  }

  private async editWithOllama() {
    if (!this._selectedArticle || !this._aiPrompt.trim()) return;
    
    this._isAiThinking = true;
    const promptContext = `You are a highly skilled AI editor working on an article.\n\nHere is the current article:\nTITLE: ${this._selectedArticle.title}\nCONTENT:\n${this._selectedArticle.content}\n\nUSER INSTRUCTION: ${this._aiPrompt}\n\nRewrite the CONTENT based on the user instruction. Respond ONLY with the raw, rewritten text. Do not include pleasantries.`;
    
    try {
      const res = await fetch("http://127.0.0.1:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "qwen3.5:4b", // Keeping consistent with backend swarm behavior
          prompt: promptContext,
          stream: false
        })
      });
      
      const data = await res.json();
      const newContent = data.response.trim();
      
      this._selectedArticle = { ...this._selectedArticle, content: newContent };
      this._aiPrompt = ""; // clear input
    } catch(e) {
      console.error(e);
      alert("AI Rewrite failed. Is Ollama running?");
    } finally {
      this._isAiThinking = false;
    }
  }

  render() {
    if (this._loading) {
      return html`<div class="loading">Loading database...</div>`;
    }
    
    if (this._error) {
      return html`<div class="error">Error loading articles: ${this._error}</div>`;
    }

    if (this._selectedArticle) {
      return html`
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <button 
            @click=${() => this._selectedArticle = null}
            style="align-self: flex-start; padding: 6px 12px; background: transparent; border: 1px solid var(--border); color: var(--text); border-radius: 4px; cursor: pointer;"
          >← Back</button>
          
          <input 
            type="text" 
            .value=${this._selectedArticle.title}
            @input=${(e: any) => this._selectedArticle = { ...this._selectedArticle!, title: e.target.value }}
            style="font-size: 1.5rem; font-weight: bold; background: transparent; border: 1px solid var(--border); color: var(--text); padding: 8px; border-radius: 4px; width: 100%;"
          />
          
          <textarea 
            .value=${this._selectedArticle.content}
            @input=${(e: any) => this._selectedArticle = { ...this._selectedArticle!, content: e.target.value }}
            style="min-height: 400px; font-family: inherit; font-size: 1rem; padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--border); color: var(--text); border-radius: 8px; width: 100%; resize: vertical; line-height: 1.6;"
          ></textarea>

          <div style="display: flex; gap: 0.5rem; background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; border: 1px solid var(--border);">
            <img src="/ollama-icon.png" alt="Ollama" style="width: 24px; height: 24px; opacity: 0.8; margin-top: 4px;" onerror="this.style.display='none'" />
            <input 
              type="text" 
              placeholder="Tell AI how to rewrite this article (e.g., 'Make it funnier')"
              .value=${this._aiPrompt}
              @input=${(e: any) => this._aiPrompt = e.target.value}
              @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.editWithOllama()}
              style="flex: 1; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: 4px;"
            />
            <button 
              @click=${this.editWithOllama}
              ?disabled=${this._isAiThinking}
              style="padding: 8px 16px; background: var(--accent); color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; opacity: ${this._isAiThinking ? 0.5 : 1};"
            >${this._isAiThinking ? "AI Thinking..." : "Edit with AI"}</button>
          </div>

          <button 
            @click=${this.saveArticle}
            style="align-self: flex-end; padding: 12px 24px; background: var(--accent); color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 1.1rem; cursor: pointer; margin-top: 1rem;"
          >Save Changes</button>
        </div>
      `;
    }

    if (this._articles.length === 0) {
      return html`<div class="loading">No news found in the database.</div>`;
    }

    return html`
      <div>
        ${this._articles.map(article => html`
          <a 
            class="article-item"
            @click=${(e: Event) => {
              e.preventDefault();
              this._selectedArticle = article;
            }}
            href="javascript:void(0)"
          >
            <div class="header-row">
              <h3 class="title">${article.title}</h3>
              <div class="credits">
                0.0
                <span>CREDITS</span>
              </div>
            </div>
            <div class="meta-row">
              <span class="category">${article.category}</span>
              <span>By ${article.byline}</span>
              <span>•</span>
              <span>${this.formatDate(article.created_at)}</span>
            </div>
            <p class="preview">${this.getPreviewText(article.content)}</p>
          </a>
        `)}
      </div>
    `;
  }
}
