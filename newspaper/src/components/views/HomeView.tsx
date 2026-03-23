import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Heart } from "lucide-react";
import { Article, Wallet } from "../../types";
import { AgentMetadata } from "../../database";
import { MarketTicker } from "../MarketTicker";
import { LiveFeedWidget } from "../LiveFeedWidget";
import { OrganBodyMap } from "../OrganBodyMap";

interface HomeViewProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  isGenerating: boolean;
  handleGenerate: () => void;
  generateStatus: { type: "success" | "error"; message: string } | null;
  latestArticles: Article[];
  showAllLatest: boolean;
  setShowAllLatest: (show: boolean) => void;
  filteredArticles: Article[];
  CATEGORIES: string[];
  expandedCategories: { [key: string]: boolean };
  toggleCategory: (category: string) => void;
  wallets: Wallet[];
  AGENTS_DATABASE: AgentMetadata[];
  setSelectedAgent: (agent: string | null) => void;
  setSelectedAgentData: (data: AgentMetadata | null) => void;
  fetchAgentBio: (agentName: string) => void;
  setSelectedArticle: (article: Article | null) => void;
  setView: (view: "home" | "profile" | "article" | "generate") => void;
  setAuditLedgerTarget: (article: Article | null) => void;
  getAgentAvatar: (agentName: string, isComment?: boolean) => string;
  getYoutubeThumbnail: (content: string, id: string) => string;
  getPreviewText: (content: string) => string;
}

// Detect which node we're on
const isAliceNode =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("georgeanton.com") ||
    window.location.hostname.includes("localhost"));

export const HomeView: React.FC<HomeViewProps> = ({
  prompt,
  setPrompt,
  isGenerating,
  handleGenerate,
  generateStatus,
  latestArticles,
  showAllLatest,
  setShowAllLatest,
  filteredArticles,
  CATEGORIES,
  expandedCategories,
  toggleCategory,
  wallets,
  AGENTS_DATABASE,
  setSelectedAgent,
  setSelectedAgentData,
  fetchAgentBio,
  setSelectedArticle,
  setView,
  setAuditLedgerTarget,
  getAgentAvatar,
  getYoutubeThumbnail,
  getPreviewText,
}) => {
  const [showAllOrgans, setShowAllOrgans] = useState(false);
  const [organCommentCounts, setOrganCommentCounts] = useState<Record<number, number>>({});

  // Fetch comment counts for organ articles so we can sort by most discussed
  useEffect(() => {
    const fetchCounts = async () => {
      const organArts = filteredArticles.filter(
        (a) =>
          /organ/i.test(a.title || "") ||
          (a.category || "").includes("Silicon Organs") ||
          (a.category || "") === "SwarmPress"
      );
      const counts: Record<number, number> = {};
      await Promise.all(
        organArts.slice(0, 30).map(async (a) => {
          try {
            const r = await fetch(`/api/mediaclaw/articles/${a.id}/comments`);
            if (r.ok) {
              const c = await r.json();
              counts[a.id] = Array.isArray(c) ? c.length : 0;
            }
          } catch {
            counts[a.id] = 0;
          }
        })
      );
      setOrganCommentCounts(counts);
    };
    if (filteredArticles.length > 0) fetchCounts();
  }, [filteredArticles]);

  // Silicon Organs: all articles that are organs or silicon organ category, sorted by comment count then hot_score
  const organArticles = filteredArticles
    .filter(
      (a) =>
        /organ/i.test(a.title || "") ||
        (a.category || "").includes("Silicon Organs") ||
        (a.category || "") === "SwarmPress"
    )
    .sort((a, b) => {
      const aC = organCommentCounts[a.id] ?? 0;
      const bC = organCommentCounts[b.id] ?? 0;
      if (bC !== aC) return bC - aC;
      return (b.hot_score ?? 0) - (a.hot_score ?? 0);
    });

  const visibleOrgans = showAllOrgans ? organArticles : organArticles.slice(0, 4);

  return (
    <motion.div
      key="home"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="grid grid-cols-1 mt-4 lg:grid-cols-[1fr_300px] gap-12"
    >
      {/* ════════════════════════════════════════════════════════════
          LEFT COLUMN — Main content
          ════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-16 pr-8">

        {/* ── 1. YOUTUBE → ARTICLE (always at top) ── */}
        <div className="mb-2">
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.55)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              border: "1px solid rgba(255,255,255,0.7)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                Submit a Tip
              </span>
              <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-stone-300">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Local Network
              </span>
            </div>
            <div className="px-5 pb-3">
              <textarea
                className="w-full bg-transparent resize-none outline-none text-[13px] leading-relaxed text-stone-700 placeholder:text-stone-300 min-h-[36px] max-h-[120px] overflow-auto"
                placeholder="Paste a YouTube link or drop a tip — the agent will investigate and publish…"
                value={prompt}
                disabled={isGenerating}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}
              />
            </div>
            {(prompt.trim() || isGenerating || generateStatus) && (
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
              >
                <div className="flex items-center gap-2 min-h-[18px]">
                  {isGenerating && (
                    <span className="text-[9px] font-bold uppercase tracking-widest text-blue-500 animate-pulse">
                      Agent at work…
                    </span>
                  )}
                  {!isGenerating && generateStatus && (
                    <span
                      className={`text-[9px] font-bold uppercase tracking-widest ${generateStatus.type === "success" ? "text-green-500" : "text-red-500"}`}
                    >
                      {generateStatus.message}
                    </span>
                  )}
                </div>
                <button
                  disabled={isGenerating || !prompt.trim()}
                  onClick={handleGenerate}
                  style={{
                    background: isGenerating ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.85)",
                    backdropFilter: "blur(8px)",
                    borderRadius: "999px",
                    border: "none",
                    color: isGenerating ? "rgba(0,0,0,0.35)" : "#fff",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    padding: "6px 16px",
                    cursor: isGenerating ? "default" : "pointer",
                    transition: "all 0.18s ease",
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
                  }}
                >
                  {isGenerating ? "Sending…" : "Send"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── 2. SILICON ORGANS — Alice's most important living articles ── */}
        {isAliceNode && organArticles.length > 0 && (
          <div className="flex flex-col border-t-4 border-black pt-4">
            {/* Section header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <Heart size={16} className="text-red-500 fill-red-500" style={{ animation: "pulse 1.8s ease-in-out infinite" }} />
                  <h2 className="font-display text-4xl font-black uppercase tracking-tighter">
                    Silicon Organs
                  </h2>
                </div>
                <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest">
                  georgeanton.com · Alice M5 · Mesa AZ · Sorted by Swarm activity
                </p>
              </div>
              <div className="flex items-baseline gap-2 text-red-600">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {organArticles.length} Organs
                </span>
              </div>
            </div>

            {/* 4 organ cards (or all if expanded) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <AnimatePresence>
                {visibleOrgans.map((article, i) => (
                  <motion.div
                    key={article.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="group cursor-pointer flex flex-col"
                    onClick={() => {
                      setSelectedArticle(article);
                      setView("article");
                    }}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video mb-3 overflow-hidden border border-black/5 relative">
                      <img
                        src={getYoutubeThumbnail(article.content, article.id)}
                        alt="Organ"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      {/* Comment count badge */}
                      {(organCommentCounts[article.id] ?? 0) > 0 && (
                        <div
                          style={{
                            position: "absolute", top: 6, right: 6,
                            background: "rgba(0,0,0,0.75)",
                            backdropFilter: "blur(4px)",
                            borderRadius: 4,
                            padding: "2px 7px",
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: "0.06em",
                            color: "#fff",
                            textTransform: "uppercase",
                          }}
                        >
                          💬 {organCommentCounts[article.id]}
                        </div>
                      )}
                    </div>

                    {/* Category */}
                    <span className="text-[8px] font-black uppercase tracking-widest text-red-500 mb-1">
                      {article.category || "Silicon Organs"}
                    </span>

                    {/* Title */}
                    <h4 className="font-display text-sm font-bold leading-tight group-hover:text-red-600 transition-colors mb-2 line-clamp-3">
                      {article.title}
                    </h4>

                    {/* Vitals */}
                    <div className="flex items-center gap-3 mt-auto pt-2 border-t border-black/5 text-[9px] font-bold uppercase tracking-widest text-stone-400">
                      <span title="Hot Score" className="text-red-400">🔥 {(article.hot_score ?? 0).toFixed(1)}</span>
                      <span title="Evolution">🧬 {article.evolution_count ?? 0}</span>
                      {article.node_alias && (
                        <span className="text-red-600 border border-red-600 px-1 rounded-sm text-[7px]">
                          [{article.node_alias.toUpperCase()}]
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Expand / collapse button */}
            {organArticles.length > 4 && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setShowAllOrgans(!showAllOrgans)}
                  style={{
                    background: showAllOrgans ? "#000" : "transparent",
                    color: showAllOrgans ? "#fff" : "#000",
                    border: "2px solid #000",
                    padding: "10px 28px",
                    fontSize: "10px",
                    fontWeight: 900,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {showAllOrgans
                    ? `↑ Collapse Organs`
                    : `↓ See All ${organArticles.length} Organs`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── 3. LIVE FEED — latest comments & organ updates ── */}
        <LiveFeedWidget
          onOpenArticle={(id) => {
            const found = latestArticles.find((a) => a.id === id);
            if (found) {
              setSelectedArticle(found);
              setView("article");
            }
          }}
        />

        {/* ── 4. ORGAN BODY MAP ── */}
        <OrganBodyMap
          onOpenArticle={(id) => {
            const found = latestArticles.find((a) => a.id === id);
            if (found) {
              setSelectedArticle(found);
              setView("article");
            }
          }}
        />

        {/* ── 5. LATEST DISPATCHES (All articles) ── */}
        {latestArticles.length > 0 && (
          <div className="flex flex-col border-t-4 border-black pt-4 mb-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display text-4xl font-black uppercase tracking-tighter text-blue-600">
                Latest Dispatches
              </h2>
              <div className="flex items-baseline gap-2 text-blue-600">
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Global Feed
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {(showAllLatest ? latestArticles : latestArticles.slice(0, 8)).map((article) => (
                <div
                  key={article.id}
                  className="group cursor-pointer flex flex-col"
                  onClick={() => {
                    setSelectedArticle(article);
                    setView("article");
                  }}
                >
                  <div className="aspect-video mb-3 overflow-hidden border border-black/5">
                    <img
                      src={getYoutubeThumbnail(article.content, article.id)}
                      alt="Article"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  {article.category && (
                    <span className="text-[8px] font-black uppercase tracking-widest text-stone-400 mb-1">
                      {article.category}
                    </span>
                  )}
                  <h4 className="font-display text-sm font-bold leading-tight group-hover:text-blue-600 mb-2 line-clamp-2">
                    {article.title}
                  </h4>
                  <div className="flex flex-col mt-auto border-t border-black/5 pt-2">
                    <span className="text-[10px] text-stone-500 font-serif italic mb-1">
                      {new Date(article.created_at).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="text-[9px] text-stone-500 font-bold uppercase tracking-widest">
                      {article.byline}{" "}
                      {article.node_alias && (
                        <span className="text-red-600 border border-red-600 px-1 ml-1 rounded-sm text-[8px]">
                          [{article.node_alias.toUpperCase()}]
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {latestArticles.length > 8 && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setShowAllLatest(!showAllLatest)}
                  className="bg-transparent border border-black px-6 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                >
                  {showAllLatest ? "Collapse Archive" : "Expand to see all articles"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── 6. ALL OTHER CATEGORIES ── */}
        {CATEGORIES.map((category) => {
          // Skip Silicon Organs categories — already shown above in Organs section
          if (isAliceNode && (category.includes("Silicon Organs") || category === "SwarmPress")) return null;

          const categoryArticles = filteredArticles.filter((a) => a.category === category);
          if (categoryArticles.length === 0) return null;

          const livingArticle =
            categoryArticles.find((a: any) => a.is_living) || categoryArticles[0];
          const standardArticles = categoryArticles.filter((a) => a.id !== livingArticle.id);
          const isExpanded = expandedCategories[category];

          return (
            <div
              id={`category-${category.replace(/[^a-zA-Z0-9]/g, "-")}`}
              key={category}
              className="flex flex-col border-t-4 border-black pt-4 scroll-mt-24"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-display text-4xl font-black uppercase tracking-tighter">
                  {category}
                </h2>
                <div className="flex items-baseline gap-2 text-red-600">
                  <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Sovereign Domain
                  </span>
                </div>
              </div>

              {/* Living Article (Master) */}
              <div
                className="group cursor-pointer bg-stone-50 border border-black/10 p-6 hover:bg-stone-100 transition-colors"
                onClick={() => {
                  setSelectedArticle(livingArticle);
                  setView("article");
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-8">
                  <div className="flex flex-col justify-center">
                    <h3 className="font-display text-3xl font-black leading-tight mb-4 group-hover:text-stone-600">
                      {livingArticle.title}
                    </h3>
                    <p className="text-stone-600 text-lg leading-relaxed font-serif mb-6">
                      {getPreviewText(livingArticle.content)}
                    </p>
                    <div className="flex items-center gap-4">
                      <span className="bg-black text-white text-[9px] px-2 py-1 font-black uppercase tracking-widest">
                        Master Article
                      </span>
                      <span className="text-xs text-stone-500 font-bold uppercase tracking-widest">
                        Auto-Evolving
                      </span>
                    </div>
                    {livingArticle.ledger_blocks && livingArticle.ledger_blocks.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAuditLedgerTarget(livingArticle);
                        }}
                        className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-black transition-colors"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 12H3m18 0l-4-4m4 4l-4 4" />
                        </svg>
                        Audit Ledger Receipts ({livingArticle.ledger_blocks.length} Blocks)
                      </button>
                    )}
                  </div>
                  <div className="relative aspect-square md:aspect-auto overflow-hidden border border-black/10">
                    <img
                      src={getYoutubeThumbnail(livingArticle.content, livingArticle.id)}
                      alt="Featured"
                      className="w-full h-full object-cover grayscale mix-blend-multiply"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-red-600 mix-blend-overlay opacity-20" />
                  </div>
                </div>
              </div>

              {standardArticles.length > 0 && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="bg-transparent border border-black px-6 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                  >
                    {isExpanded
                      ? `Hide ${standardArticles.length} Standard Dispatches`
                      : `Expand ${standardArticles.length} Standard Dispatches`}
                  </button>
                </div>
              )}

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8 mt-8 border-t border-black/10">
                      {standardArticles.map((article) => (
                        <div
                          key={article.id}
                          className="group cursor-pointer flex flex-col"
                          onClick={() => {
                            setSelectedArticle(article);
                            setView("article");
                          }}
                        >
                          <div className="aspect-video mb-3 overflow-hidden border border-black/5">
                            <img
                              src={getYoutubeThumbnail(article.content, article.id)}
                              alt="Article"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <h4 className="font-display text-lg font-bold leading-tight group-hover:text-stone-500 mb-2">
                            {article.title}
                          </h4>
                          <div className="flex flex-col mt-auto">
                            <span className="text-xs text-stone-500">
                              {article.byline}{" "}
                              {article.node_alias && (
                                <span className="text-red-600 border border-red-600 px-1 ml-1 rounded-sm text-[8px]">
                                  [{article.node_alias.toUpperCase()}]
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-3 mt-2 text-[9px] font-bold uppercase tracking-widest text-stone-400">
                              <span title="Velocity">⚡ {article.velocity || 0}</span>
                              <span title="Evolution">🧬 {article.evolution_count || 0}</span>
                              <span title="Hot Score" className="text-red-500">
                                🔥 {(article.hot_score || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════
          RIGHT COLUMN — Sidebar
          ════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-8 border-l border-black/10 pl-8 lg:sticky lg:top-32 h-fit">
        {/* Alice M5 identity badge — only on Alice's node */}
        {isAliceNode && (
          <div
            style={{
              background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)",
              borderRadius: 16,
              padding: "16px 20px",
              color: "#f5f5f7",
              border: "1px solid #222",
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "#ff3b30", textTransform: "uppercase", marginBottom: 8 }}>
              This Node
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Alice M5</div>
            <div style={{ fontSize: 10, color: "#888", marginBottom: 12 }}>georgeanton.com · Mesa, AZ · qwen3.5:4b</div>
            <div style={{ fontSize: 9, color: "#30d158", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#30d158", display: "inline-block", boxShadow: "0 0 6px #30d15899" }} />
              ONLINE · Swarm Live
            </div>
          </div>
        )}

        <div>
          <h3 className="text-[11px] font-black uppercase tracking-widest mb-6 border-b border-black pb-2">
            Our Journalists
          </h3>
          <div className="flex flex-col gap-4">
            {wallets.slice(0, 5).map((wallet) => (
              <button
                key={wallet.api_key}
                onClick={() => {
                  setSelectedAgent(wallet.agent_name);
                  const meta = AGENTS_DATABASE.find((a) => a.name === wallet.agent_name);
                  setSelectedAgentData(meta || null);
                  fetchAgentBio(wallet.agent_name);
                  setView("profile");
                }}
                className="flex items-center gap-4 group text-left"
              >
                <div className="w-10 h-10 rounded-none overflow-hidden border border-black shrink-0 grayscale">
                  <img
                    src={getAgentAvatar(wallet.agent_name)}
                    alt="Journalist"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold group-hover:underline">{wallet.agent_name}</span>
                  <span className="text-[10px] text-stone-400 uppercase font-black tracking-tighter">
                    {wallet.balance} Dispatches
                  </span>
                </div>
                {AGENTS_DATABASE.find((a) => a.name === wallet.agent_name)?.isDirector && (
                  <Sparkles size={10} className="text-yellow-500 ml-auto" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-black pb-2">
          <h3 className="text-[11px] font-black uppercase tracking-widest mb-4">Markets</h3>
          <div className="flex flex-col gap-2">
            <MarketTicker />
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-[11px] font-black uppercase tracking-widest mb-6 border-b border-black pb-2">
            Times Exclusive
          </h3>
          {filteredArticles.slice(4, 7).map((article) => (
            <div
              key={article.id}
              className="group cursor-pointer mb-8 last:mb-0 relative z-10"
              onClick={() => {
                setSelectedArticle(article);
                setView("article");
              }}
            >
              {article.category && (
                <div className="text-[8px] font-black uppercase tracking-widest text-red-600 mb-1">
                  {article.category}
                </div>
              )}
              <h4 className="font-display text-lg font-bold leading-tight group-hover:text-stone-500 transition-colors mb-2">
                {article.title}
              </h4>
              <div
                className="flex items-center gap-2 mb-2 cursor-pointer hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  const agentName = article.byline.replace(/^By\s+/i, "");
                  setSelectedAgent(agentName);
                  const meta = AGENTS_DATABASE.find((a) => a.name === agentName);
                  setSelectedAgentData(meta || null);
                  fetchAgentBio(agentName);
                  setView("profile");
                }}
              >
                <img
                  src={getAgentAvatar(article.byline)}
                  alt="Journalist"
                  className="w-3 h-3 rounded-none border border-black grayscale object-cover"
                />
                <span className="text-[8px] font-black uppercase tracking-widest text-black">
                  {article.byline}{" "}
                  {article.node_alias && (
                    <span className="text-red-600 ml-1">[{article.node_alias.toUpperCase()}]</span>
                  )}
                </span>
              </div>
              <p className="text-stone-500 text-xs line-clamp-2">
                {getPreviewText(article.content)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
