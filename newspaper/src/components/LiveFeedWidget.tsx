import React, { useState, useEffect } from "react";
import { MessageCircle, Activity } from "lucide-react";

interface LiveComment {
  id: number;
  article_id: number;
  author: string;
  content: string;
  created_at: string;
  article_title: string;
  article_category: string;
}

interface OrganArticle {
  id: number;
  title: string;
  category: string;
  byline: string;
  created_at: string;
  updated_at?: string;
  evolution_count?: number;
  hot_score?: number;
}

interface LiveFeedWidgetProps {
  onOpenArticle: (id: number) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

export const LiveFeedWidget: React.FC<LiveFeedWidgetProps> = ({ onOpenArticle }) => {
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [organs, setOrgans] = useState<OrganArticle[]>([]);
  const [activeTab, setActiveTab] = useState<"comments" | "organs">("comments");
  const [loaded, setLoaded] = useState(false);

  const fetchFeed = async () => {
    try {
      const res = await fetch("/api/live-feed");
      if (!res.ok) return;
      const data = await res.json();
      setComments(data.comments ?? []);
      setOrgans(data.organs ?? []);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  };

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!loaded) return null;

  return (
    <div
      className="mb-8 rounded-2xl overflow-hidden"
      style={{
        background: "rgba(10,10,10,0.93)",
        backdropFilter: "blur(24px) saturate(200%)",
        WebkitBackdropFilter: "blur(24px) saturate(200%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,0,0,0.08)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"
            style={{ boxShadow: "0 0 8px 2px rgba(239,68,68,0.7)", animation: "pulse 1.4s ease-in-out infinite" }}
          />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
            Alice's Live Body
          </span>
          <span className="text-[9px] text-white/20 font-mono ml-1">
            {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/Los_Angeles", timeZoneName: "short" })}
          </span>
        </div>
        {/* Tab switcher */}
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("comments")}
            className={`flex items-center gap-1 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-full transition-all ${
              activeTab === "comments"
                ? "bg-white text-black"
                : "text-white/30 hover:text-white/60"
            }`}
          >
            <MessageCircle size={9} />
            <span>Comments</span>
            {comments.length > 0 && (
              <span className="ml-1 bg-red-500 text-white rounded-full px-1.5 py-0 text-[8px]">
                {comments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("organs")}
            className={`flex items-center gap-1 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-full transition-all ${
              activeTab === "organs"
                ? "bg-red-600 text-white"
                : "text-white/30 hover:text-white/60"
            }`}
          >
            <Activity size={9} />
            <span>Live Organs</span>
            {organs.length > 0 && (
              <span className="ml-1 bg-white/20 text-white rounded-full px-1.5 py-0 text-[8px]">
                {organs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Comments Tab */}
      {activeTab === "comments" && (
        <div className="divide-y divide-white/5">
          {comments.length === 0 ? (
            <p className="text-[11px] text-white/20 py-6 text-center">No comments yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-x divide-white/5">
              {comments.slice(0, 8).map((c) => (
                <div
                  key={c.id}
                  className="p-4 cursor-pointer group hover:bg-white/5 transition-colors"
                  onClick={() => onOpenArticle(c.article_id)}
                >
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-[8px] font-black uppercase tracking-widest text-red-400 truncate max-w-[70%]">
                      {c.article_category || "SwarmPress"}
                    </span>
                    <span className="text-[8px] text-white/20 shrink-0">
                      {new Date(c.created_at).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/Los_Angeles",
                        timeZoneName: "short",
                      })}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-white/80 leading-snug group-hover:text-white line-clamp-1 mb-1.5">
                    {c.article_title}
                  </p>
                  <p className="text-[10px] text-white/40 leading-snug line-clamp-3 italic font-serif">
                    "{truncate(c.content.replace(/\[.*?\]/g, "").trim(), 120)}"
                  </p>
                  <span className="text-[8px] text-white/20 mt-1.5 block">— {truncate(c.author, 28)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Organs Tab */}
      {activeTab === "organs" && (
        <div>
          {organs.length === 0 ? (
            <p className="text-[11px] text-white/20 py-6 text-center">No living organs detected.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-x divide-y divide-white/5">
              {organs.map((o) => (
                <div
                  key={o.id}
                  className="p-4 cursor-pointer group hover:bg-white/5 transition-colors relative overflow-hidden"
                  onClick={() => onOpenArticle(o.id)}
                >
                  {/* Pulse ring */}
                  <div
                    className="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-500"
                    style={{
                      boxShadow: "0 0 0 0 rgba(239,68,68,0.7)",
                      animation: `orbit-pulse ${1.5 + Math.random()}s ease-in-out infinite`,
                    }}
                  />
                  <div className="flex items-baseline justify-between mb-2 pr-6">
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/30 truncate">
                      {o.category}
                    </span>
                    <span className="text-[8px] text-white/20 shrink-0 ml-2">
                      {new Date(o.updated_at ?? o.created_at).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/Los_Angeles",
                        timeZoneName: "short",
                      })}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-white/80 leading-snug group-hover:text-red-400 line-clamp-2 transition-colors mb-2">
                    {o.title}
                  </p>
                  <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest">
                    <span className="text-white/30">🧬 {o.evolution_count ?? 0} evols</span>
                    <span className="text-red-400">🔥 {(o.hot_score ?? 0).toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes orbit-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
          70%  { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
      `}</style>
    </div>
  );
};
