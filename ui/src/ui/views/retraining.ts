import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

@customElement("retraining-view")
export class RetrainingView extends LitElement {
  @state() private isTraining = false;
  @state() private progress = 0;
  @state() private logs: string[] = [];
  @state() private isConsoleOpen = true; // Default open in dedicated view
  
  private eventSource: EventSource | null = null;
  private scrollRef: HTMLElement | null = null;

  static styles = css`
    :host {
      display: block;
      padding: 24px;
      color: var(--fg);
      width: 100%;
      height: 100%;
      overflow-y: auto;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .header-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
    }

    h1 {
      font-size: 2rem;
      margin-top: 0;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .subtitle {
      color: var(--fg-muted);
      margin-bottom: 0;
      font-size: 1.1rem;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }

    .status-panel {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .icon-box {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(100, 100, 100, 0.1);
      color: var(--fg-muted);
    }

    .icon-box.active {
      background: rgba(0, 122, 255, 0.1);
      color: #007aff;
    }

    .status-text h3 {
      margin: 0 0 4px 0;
      font-size: 1.1rem;
    }

    .status-text p {
      margin: 0;
      color: var(--fg-muted);
      font-size: 0.9rem;
    }

    .progress-track {
      width: 200px;
      height: 8px;
      background: var(--bg-surface-raised);
      border-radius: 4px;
      overflow: hidden;
      margin-right: 16px;
    }

    .progress-fill {
      height: 100%;
      background: #007aff;
      border-radius: 4px;
      transition: width 0.5s ease;
    }

    .controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .btn {
      background: var(--bg-surface-raised);
      color: var(--fg);
      border: 1px solid var(--border);
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .btn:hover:not(:disabled) {
      border-color: var(--accent);
      color: var(--accent);
    }

    .btn.primary {
      background: #007aff;
      color: white;
      border: none;
    }

    .btn.primary:hover:not(:disabled) {
      background: #006ae6;
      color: white;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .console-container {
      background: #1e1e1e;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--border);
    }

    .console-header {
      background: #2d2d2d;
      padding: 8px 16px;
      color: #aaa;
      font-size: 0.8rem;
      font-family: monospace;
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #111;
    }

    .console-body {
      padding: 16px;
      height: 400px;
      overflow-y: auto;
      font-family: "SF Mono", "Menlo", "Monaco", "Consolas", monospace;
      font-size: 0.85rem;
      color: #ddd;
      line-height: 1.5;
    }

    .log-line {
      white-space: pre-wrap;
      word-break: break-all;
      margin-bottom: 4px;
    }

    .pulse-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      background: #007aff;
      border-radius: 50%;
      margin-right: 8px;
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.3; }
      100% { opacity: 1; }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.connectStream();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('logs') && this.isConsoleOpen) {
      this.scrollToBottom();
    }
  }

  private scrollToBottom() {
    if (!this.scrollRef) {
        this.scrollRef = this.renderRoot.querySelector('.console-body') as HTMLElement;
    }
    if (this.scrollRef) {
        this.scrollRef.scrollTop = this.scrollRef.scrollHeight;
    }
  }

  private connectStream() {
    // Port 3003 is the Alice backend engine
    this.eventSource = new EventSource("http://localhost:3003/api/training-stream");

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "status") {
          if (data.status === "training" || data.status === "merging") {
            this.isTraining = true;
            this.progress = data.status === "training" ? 50 : 90;
          } else {
            this.isTraining = false;
            this.progress = data.status === "complete" ? 100 : 0;
            if (data.status === "complete") {
              setTimeout(() => { if (!this.isTraining) this.progress = 0; }, 5000);
            }
          }
        } else if (data.text) {
          this.logs = [...this.logs, data.text];
        }
      } catch (e) {
        console.error("Failed to parse retraining event", e);
      }
    };
    
    this.eventSource.onerror = () => {
        // Silently reconnect on drop
    }
  }

  private async handleForceRetrain() {
    if (this.isTraining) return;
    
    try {
      this.isTraining = true;
      this.logs = [];
      this.progress = 10;
      
      await fetch("http://localhost:3003/api/force-retrain", { 
          method: "POST",
          headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      console.error(err);
      this.isTraining = false;
    }
  }

  render() {
    return html`
      <div class="header-actions">
        <div>
          <h1>Neural Retraining Cycle</h1>
          <p class="subtitle">Sovereign intelligence alignment and model parameter updates.</p>
        </div>
      </div>

      <div class="container">
        <div class="header">
          <div class="status-panel">
            <div class="icon-box ${this.isTraining ? 'active' : ''}">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 17 10 11 4 5"></polyline>
                <line x1="12" y1="19" x2="20" y2="19"></line>
              </svg>
            </div>
            <div class="status-text">
              <h3>System Status</h3>
              <p>${this.isTraining ? "MLOps Pipeline Active..." : "System Idle - Waiting for threshold"}</p>
            </div>
          </div>

          <div class="controls">
            ${this.progress > 0 ? html`
              <div class="progress-track" title="Pipeline Progress: ${this.progress}%">
                <div class="progress-fill" style="width: ${this.progress}%"></div>
              </div>
            ` : ''}

            <button
              @click=${this.handleForceRetrain}
              ?disabled=${this.isTraining}
              class="btn primary"
            >
              ${this.isTraining ? "Retraining..." : "Force Retrain"}
            </button>
            
            <button
              @click=${() => this.isConsoleOpen = !this.isConsoleOpen}
              class="btn"
              title="Toggle Console"
            >
              Terminal
            </button>
          </div>
        </div>

        ${this.isConsoleOpen ? html`
          <div class="console-container">
            <div class="console-header">
              <span>alice_pipeline.log</span>
              <span>Running on :3003</span>
            </div>
            <div class="console-body">
              ${this.logs.length === 0 ? html`
                <span style="color: #666">Waiting for training stream...</span>
              ` : this.logs.map(log => html`
                <div class="log-line">${log}</div>
              `)}
              ${this.isTraining ? html`
                <div style="margin-top: 12px; display: flex; align-items: center; color: #007aff;">
                  <span class="pulse-dot"></span> Processing tensors...
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}
