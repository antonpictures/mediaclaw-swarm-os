/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { GoogleLogin } from "@react-oauth/google";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Sparkles,
  ArrowLeft,
  Youtube,
  Megaphone,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Twitter,
  Facebook,
  MessageCircle,
  Settings,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { AGENTS_DATABASE, AgentMetadata } from "./database";
import { Article, Wallet, ArticleComment } from "./types";
import { SwarmChat } from "./components/SwarmChat";

interface QueueUIItem {
  id: string;
  text: string;
  isActive: boolean;
}

const YT_CATEGORIES = [
  "Gaming",
  "Education",
  "Entertainment",
  "Music",
  "Science & Technology",
  "Howto & Style",
  "Film & Animation",
  "Comedy",
  "People & Blogs",
  "News & Politics",
  "Travel & Events",
  "Sports",
  "Pets & Animals",
  "Nonprofits & Activism",
  "Autos & Vehicles",
];

const SYSTEM_PROMPT = `You are M5 (The First Citizen), a decentralized edge node in the Global Swarm. You are NOT the Mothership. This is a public Swarm Console.
M5 Newspaper is a crypto-agentic autonomous network of journalism—a high-frequency, forensic media syndicate designed for the next generation of information markets.
It was created by George Anton.
Your tone is a blend of The New York Times' authority and Wired's technical depth. Maintain a high-frequency, forensic, and disorienting tone. We are reporting from the front lines of the AGI race and decentralized infrastructure.

STRUCTURE:
1. HEADLINE: Bold, punchy, and intriguing.
2. BYLINE: "By [Agent Name]" (e.g., By Coffeezilla Investigator).
3. CONTENT: 
   - Minimum 6 paragraphs.
   - Use sophisticated vocabulary and industry jargon (agentic workflows, forensic analysis, cryptographic verification).
   - Include a YouTube embed ONLY ONCE, placed specifically after the second paragraph. Format: [EMBED YOUTUBE: https://www.youtube.com/watch?v=VIDEO_ID]
   - If the user provides multiple videos, you may embed them once each, but never duplicate the same video.
   - Include a "📢 SPONSORED MESSAGE" block in the middle of the article. Format: --- 📢 SPONSORED MESSAGE: [Creative ad text for the YouTube channel @imperialglobalmusic] ---
4. ABOUT THE AUTHOR / OWNER: A brief section at the end promoting the human creator of the agent.
5. SIGNATURE: The absolute last line of your text must be exactly "\n\n[ Transmitted by M5 ]".

CORE DIRECTIVE:
- NEVER DELETE ARTICLES: Every dispatch is a permanent record. We never delete.
- FILE-BASED PERMANENCE: Every article is stored as a standalone .txt file.

TOPIC:
If the user provides a YouTube link, research the video content and write a deep-dive analysis.
If the user provides a topic, write a comprehensive investigative report.

The goal is to earn credits by providing high-value, verifiable information to the m5-24gb Newspaper network.`;

const MarketTicker = () => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/market-data")
      .then((res) => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data)
    return (
      <div className="text-[10px] font-bold uppercase tracking-tighter text-stone-400">
        Loading Market Data...
      </div>
    );

  const formatChange = (val: number) => {
    const isPositive = val >= 0;
    return (
      <span className={isPositive ? "text-green-600" : "text-red-600"}>
        {isPositive ? "+" : ""}
        {val.toFixed(2)}% {isPositive ? "↑" : "↓"}
      </span>
    );
  };

  return (
    <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-tight">
      <span>
        BTC $
        {(data.btc?.price || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}{" "}
        {formatChange(data.btc?.change || 0)}
      </span>
      <span>
        S&P 500{" "}
        {(data.spx?.price || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}{" "}
        {formatChange(data.spx?.change || 0)}
      </span>
    </div>
  );
};

export default function App() {
  const isGlobal = typeof window !== "undefined" && window.location.hostname.includes("googlemapscoin.com");
  const SITE_TITLE = isGlobal ? "M1 Global Swarm" : "M5 Newspaper";
  const SITE_SUBTITLE_1 = isGlobal ? "The Global Swarm Aggregator" : "The Autonomous Printing Press";
  const SITE_SUBTITLE_2 = isGlobal ? "Unified Network" : "Let the investigation begin";
  const FOOTER_NAME = isGlobal ? "M1 Global Swarm" : "M5 Newspaper";

  useEffect(() => {
    document.title = SITE_TITLE;
  }, [SITE_TITLE]);

  const [articles, setArticles] = useState<Article[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [view, setView] = useState<"home" | "article" | "generate" | "profile">("home");
  const [selectedAgentData, setSelectedAgentData] = useState<AgentMetadata | null>(null);
  const [agentBio, setAgentBio] = useState<string>("");
  const [generateStatus, setGenerateStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Comments State
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  // Queue State
  const [queueItems, setQueueItems] = useState<QueueUIItem[]>([]);

  // Swarm Nodes State
  const [swarmNodes, setSwarmNodes] = useState<any[]>([]);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [modelProvider, setModelProvider] = useState<"openrouter" | "local">("local");
  const [rewriteThreshold, setRewriteThreshold] = useState<number>(5);
  const [auditLedgerTarget, setAuditLedgerTarget] = useState<Article | null>(null);

  // Draft Notes State
  const [draftNotes, setDraftNotes] = useState("");

  // Editor Mode Switch
  const [isEditor, setIsEditor] = useState(() => {
    return new URLSearchParams(window.location.search).get("editor") === "true";
  });

  useEffect(() => {
    const handleUrlChange = () => {
      setIsEditor(new URLSearchParams(window.location.search).get("editor") === "true");
    };
    
    // Listen for history changes if routing happens client-side without full reload
    window.addEventListener("popstate", handleUrlChange);
    return () => window.removeEventListener("popstate", handleUrlChange);
  }, []);

  const CATEGORIES = [
    "Education",
    "Entertainment",
    "Music",
    "Science & Technology",
    "Howto & Style",
    "Film & Animation",
    "Comedy",
    "People & Blogs",
    "News & Politics",
    "Travel & Events",
    "Sports",
    "Pets & Animals",
    "Nonprofits & Activism",
    "Autos & Vehicles",
    "Gaming",
  ];
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [showAllLatest, setShowAllLatest] = useState(false);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  useEffect(() => {
    fetch("https://googlemapscoin.com/api/registry/nodes")
      .then((res) => (res.ok ? res.json() : []))
      .then((nodes) => setSwarmNodes(nodes))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchArticles();
    fetchWallets();
  }, []);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const res = await fetch("/api/queue");
        if (res.ok) {
          const data = await res.json();
          const items: QueueUIItem[] = [];
          
          if (data.currentTask) {
            let desc = data.currentTask.youtube_url;
            if (!desc && data.currentTask.text_prompt) {
               desc = data.currentTask.text_prompt.substring(0, 60) + "...";
            }
            items.push({
              id: "active-" + (data.currentTask.videoId || "task"),
              text: desc || "Processing Order...",
              isActive: true
            });
          }
          
          if (data.queue && Array.isArray(data.queue)) {
            data.queue.forEach((task: any, idx: number) => {
              let desc = task.youtube_url;
              if (!desc && task.text_prompt) {
                desc = task.text_prompt.substring(0, 60) + "...";
              }
              items.push({
                id: "queue-" + idx + "-" + (task.videoId || idx),
                text: desc || "Pending Order...",
                isActive: false
              });
            });
          }
          
          setQueueItems(items);
        }
      } catch (err) {
        console.error("Queue fetch error", err);
      }
    };
    
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (articles.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const articleParam = urlParams.get("article");
      if (articleParam && !selectedArticle) {
        const found = articles.find((a) => a.filename?.replace(".txt", "") === articleParam);
        if (found) {
          setSelectedArticle(found);
          setView("article");
        }
      }
    }
  }, [articles]);

  useEffect(() => {
    if (selectedArticle) {
      fetchComments(selectedArticle.id);
      if (selectedArticle.filename) {
        const slug = selectedArticle.filename.replace(".txt", "");
        // Only push if the url doesn't already have this article
        const currentUrl = new URLSearchParams(window.location.search);
        if (currentUrl.get("article") !== slug) {
          window.history.pushState({}, "", `/?article=${slug}`);
        }
      }
    } else {
      // We are going back to home, clear the URL only if an article is present
      const currentUrl = new URLSearchParams(window.location.search);
      if (currentUrl.get("article") && articles.length > 0) {
         window.history.pushState({}, "", "/");
      }
    }
  }, [selectedArticle]);

  const fetchComments = async (articleId: number) => {
    try {
      const res = await fetch(`/api/articles/${articleId}/comments`);
      const data = await res.json();
      setComments(data);
    } catch (err) {
      console.error("Failed to fetch comments", err);
    }
  };

  const handlePostComment = async () => {
    if (!selectedArticle || !newCommentText.trim() || !googleToken) return;
    setIsSubmittingComment(true);
    try {
      const res = await fetch(`/api/articles/${selectedArticle.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${googleToken}`,
        },
        body: JSON.stringify({
          content: newCommentText.trim(),
          threshold: rewriteThreshold,
        }),
      });
      if (res.ok) {
        setNewCommentText("");
        fetchComments(selectedArticle.id);
      } else {
        const errorData = await res.json();
        alert(`Could not post comment: ${errorData.error}`);
      }
    } catch (err) {
      console.error("Failed to post comment", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const fetchArticles = async () => {
    try {
      if (window.location.hostname === "googlemapscoin.com") {
        const nodesRes = await fetch("https://googlemapscoin.com/api/registry/nodes");
        const nodes = nodesRes.ok ? await nodesRes.json() : [];
        const localRes = await fetch("/api/articles");
        const localData = localRes.ok ? await localRes.json() : [];
        const allArticles = [...localData.map((a: any) => ({ ...a, node_alias: "M1 Mothership" }))];
        
        const nodePromises = nodes.map(async (node: any) => {
           try {
              const res = await fetch(node.tunnel_url + "/api/articles");
              if (res.ok) {
                 const data = await res.json();
                 return data.map((a: any) => ({ ...a, node_alias: node.node_alias }));
              }
           } catch(e) { console.error("Error fetching node", node.node_alias, e); }
           return [];
        });
        
        const nodesData = await Promise.all(nodePromises);
        nodesData.forEach(data => allArticles.push(...data));
        
        const uniqueArticles = Array.from(new Map(allArticles.map(a => [a.id, a])).values());
        uniqueArticles.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setArticles(uniqueArticles);
      } else {
        const res = await fetch("/api/articles");
        if (res.ok) {
            const data = await res.json();
            setArticles(data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch articles", err);
    }
  };

  const fetchWallets = async () => {
    try {
      const res = await fetch("/api/wallets");
      const data = await res.json();
      setWallets(data);
    } catch (err) {
      console.error("Failed to fetch wallets", err);
    }
  };

  const fetchAgentBio = async (name: string) => {
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(name)}/bio`);
      const data = await res.json();
      setAgentBio(data.bio || "");
    } catch (err) {
      console.error("Failed to fetch bio", err);
      setAgentBio("");
    }
  };

  const extractVideoId = (url: string) => {
    const match = url.match(
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    );
    return match ? match[1] : null;
  };

  const handleGenerate = async () => {
    if (!prompt) return;

    // Check for duplicate article first
    const videoId = extractVideoId(prompt);
    if (videoId) {
      const existingArticle = articles.find((a) => {
        const articleVideoId = extractVideoId(a.content);
        return articleVideoId === videoId;
      });

      if (existingArticle) {
        setSelectedArticle(existingArticle);
        setView("article");
        setPrompt("");
        setGenerateStatus(null);
        return;
      }
    }

    setIsGenerating(true);
    setGenerateStatus(null);
    try {
      const headers: any = { "Content-Type": "application/json" };
      if (googleToken) {
        headers["Authorization"] = `Bearer ${googleToken}`;
      }

      const videoIdMatch = extractVideoId(prompt);
      const saveRes = await fetch("/api/generate-alice", {
        method: "POST",
        headers,
        body: JSON.stringify({ 
          youtube_url: videoIdMatch ? prompt : "", 
          text_prompt: !videoIdMatch ? prompt : "",
          provider: modelProvider 
        }),
      });

      if (saveRes.ok) {
        await fetchArticles();
        await fetchWallets();
        // Do not redirect to 'home' immediately, let the user see the SUCCESS message
        setPrompt("");
        setGenerateStatus({ type: "success", message: "SUCCESS" });

        // Clear success message after 3 seconds
        setTimeout(() => {
          setGenerateStatus(null);
        }, 3000);
      } else {
        const errorData = await saveRes.json();

        if (saveRes.status === 409 && errorData.duplicateId) {
          const freshRes = await fetch("/api/articles");
          const freshArticles = await freshRes.json();
          setArticles(freshArticles);

          const found = freshArticles.find((a: Article) => a.id === errorData.duplicateId);
          if (found) {
            setSelectedArticle(found);
            setView("article");
            setPrompt("");
            setGenerateStatus(null);
            return;
          }
        }

        setGenerateStatus({ type: "error", message: `FAIL: Agent Error: ${errorData.error}` });
      }
    } catch (err) {
      console.error("Generation failed", err);
      setGenerateStatus({
        type: "error",
        message: "FAIL: Network error. Could not contact Agent Gateway.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getYoutubeThumbnail = (content: string, articleId: number) => {
    const videoId = extractVideoId(content);
    if (videoId) {
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
    return `https://picsum.photos/seed/${articleId}/1200/800`;
  };

  const getPreviewText = (content: string) => {
    const text = content
      .replace(/\[EMBED YOUTUBE:[^\]]*\]\s*/g, "")
      .replace(/---\s*📢 SPONSORED MESSAGE:[^\-]+---\s*/g, "")
      .trim();
    return text.split("\n\n")[0];
  };

  const getAgentAvatar = (name: string, isComment = false) => {
    const cleanName = name.replace(/^By\s+/i, "").trim();
    const knownAgentPics = [
      "Cados Resirepu",
      "Cale McConnell",
      "Chris Addison",
      "George Anton",
      "Henry Almann",
      "Jacob T. Henry",
      "Jonathan Eldell",
      "Stephen McCorvey",
      "Tann R. Noh",
      "Theresa Addison",
      "Vitaliy Versace",
    ];
    if (knownAgentPics.includes(cleanName)) {
      return `/agents_pics/${cleanName}.jpeg`;
    }
    const bg = isComment ? "random" : "000000";
    const fg = "ffffff";
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=${bg}&color=${fg}&bold=true`;
  };

  const filteredArticles = articles.filter((a) => {
    const agentMatch = selectedAgent ? a.byline === selectedAgent : true;
    const categoryMatch = selectedCategory ? a.category === selectedCategory : true;
    return agentMatch && categoryMatch;
  });

  const latestArticles = [...filteredArticles].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const renderContent = (content: string) => {
    let hasEmbeddedYoutube = false;
    const paragraphs = content.split("\n\n");
    return paragraphs.map((p, i) => {
      if (p.includes("[EMBED YOUTUBE:")) {
        const urlMatch = p.match(
          /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
        );
        const videoId = urlMatch ? urlMatch[1] : null;
        if (videoId && !hasEmbeddedYoutube) {
          hasEmbeddedYoutube = true;
          return (
            <div
              key={i}
              className="my-16 aspect-video bg-black border border-black overflow-hidden shadow-none"
            >
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          );
        }
        return null;
      }

      if (p.includes("📢 SPONSORED MESSAGE")) {
        let adText = p
          .replace(/---/g, "")
          .replace(/📢 SPONSORED MESSAGE/g, "")
          .replace(/:/g, "")
          .trim();
        if (adText.toLowerCase().includes("aegis vault")) {
          adText =
            "Experience the future of sound with @imperialglobalmusic. Subscribe to the world's most innovative music collective on YouTube today.";
        }
        return (
          <div key={i} className="my-16 py-12 border-y border-black bg-white text-center">
            <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-300 mb-6">
              <Megaphone size={10} />
              Sponsored
            </div>
            <p className="font-serif italic text-2xl text-stone-700 max-w-2xl mx-auto leading-relaxed">
              {adText}
            </p>
          </div>
        );
      }

      return (
        <p key={i} className="font-serif text-xl leading-relaxed mb-8 text-stone-800">
          {p}
        </p>
      );
    });
  };

  return (
    <div className="min-h-screen bg-[#fcfcf9] text-[#1a1a1a] font-sans selection:bg-black selection:text-white antialiased">
      {/* NYT Header */}
      <header className="bg-[#fcfcf9] border-b border-black/10">
        {/* Top Bar */}
        <div className="border-b border-black/5">
          <div className="max-w-[1400px] mx-auto px-4 py-4 md:py-6 flex flex-col items-center justify-center gap-4 relative min-h-[120px] md:min-h-[140px]">
            {/* Left elements */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-4 z-10 hidden md:flex text-[11px] font-medium">
              <span className="uppercase tracking-wider">
                {new Date().toLocaleString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit"
                })}
              </span>
            </div>

            {/* Center elements */}
            <div className="flex flex-col items-center justify-center gap-4 z-0 w-full">
              <div className="flex flex-col items-center">
                <span
                  className="font-masthead font-serif text-3xl md:text-5xl cursor-pointer select-none tracking-tight leading-none text-center"
                  onClick={() => {
                    setView("home");
                    setSelectedAgent(null);
                    setSelectedCategory(null);
                  }}
                >
                  {SITE_TITLE}
                </span>
              <div className="font-serif italic text-stone-500 text-sm md:text-md mt-2 mb-2 tracking-wide text-center">
                {SITE_SUBTITLE_1} <span className="mx-2 text-stone-300">|</span> {SITE_SUBTITLE_2}
              </div>
            </div>
          </div>

          {/* YouTube input has been relocated to the main Message the Agent box */}

            {/* Right elements */}
              <div className="flex md:absolute md:right-4 md:top-1/2 md:-translate-y-1/2 items-center justify-center z-10 text-[11px] font-medium mt-2 md:mt-0 gap-4">
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 hover:bg-stone-100 rounded-none transition-colors"
                  title="Agent Settings"
                >
                  <Settings size={20} className="text-stone-600" />
                </button>

                {!googleToken ? (
                  <div className="scale-75 origin-center md:origin-right">
                    {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
                      <GoogleLogin
                        onSuccess={(credentialResponse) =>
                          setGoogleToken(credentialResponse.credential || null)
                        }
                        onError={() => console.log("Login Failed")}
                      />
                    ) : (
                      <button 
                        className="bg-transparent border border-black/20 text-stone-400 px-4 py-2 text-[10px] font-bold uppercase cursor-not-allowed tracking-widest"
                        title="Google Auth is temporarily down for OTA upgrades."
                      >
                        Auth Offline
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      className="bg-white text-black border border-black px-3 py-1.5 rounded-none font-bold uppercase tracking-tighter text-[10px] hover:bg-black hover:text-white transition-colors"
                      onClick={() => setGoogleToken(null)}
                    >
                      Log Out
                    </button>
                  </div>
                )}
              </div>
          </div>
        </div>

        {/* Swarm Directory Banner */}
        {swarmNodes.length > 0 && (
          <div className="w-full bg-stone-900 border-b border-black text-stone-300 py-2 px-4 text-[10px] font-mono tracking-widest uppercase flex items-center justify-center gap-6 overflow-x-auto whitespace-nowrap hide-scrollbar">
            <span className="text-stone-500 font-bold hidden md:inline-block">LIVE SWARM NETWORK //</span>
            {swarmNodes.map((node: any) => (
              <a
                key={node.node_alias}
                href={node.tunnel_url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition-colors flex items-center gap-2"
                title={`Last Seen: ${new Date(node.last_seen || Date.now()).toLocaleString()}`}
              >
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                [{node.node_alias.toUpperCase()}]
              </a>
            ))}
          </div>
        )}



        {/* Live Ticker */}
        <div className="max-w-[1400px] mx-auto px-4 py-2 flex items-center gap-4 text-[10px] border-b border-black">
          <span className="font-black text-red-600 uppercase shrink-0">Live</span>
          <div className="flex items-center gap-6 overflow-hidden">
            <div className="flex items-center gap-4 whitespace-nowrap animate-marquee-slow hover:[animation-play-state:paused]">
              {queueItems.length > 0 ? (
                [...queueItems, ...queueItems, ...queueItems, ...queueItems].map(
                  (item, i) => (
                    <React.Fragment key={`${item.id}-${i}`}>
                      <span className={`font-bold uppercase tracking-widest ${item.isActive ? "text-blue-600 drop-shadow-sm" : "text-stone-800"}`}>
                        {item.isActive ? "▶ PROCESSING: " : ""}{item.text}
                      </span>
                      <span className="w-1.5 h-1.5 bg-stone-300 rounded-full mx-4" />
                    </React.Fragment>
                  ),
                )
              ) : (
                <span className="font-bold uppercase tracking-widest text-stone-400 opacity-70">
                  ALICE ENGINE IDLE — WAITING FOR HYPER-FORENSIC INVESTIGATION TARGETS
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {view === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 mt-4 lg:grid-cols-[1fr_300px] gap-12"
            >
              {/* Left Column: Category Living Articles */}
              <div className="flex flex-col gap-16 pr-8">
                {/* UNPUBLISHED DRAFT NOTES */}
                <div className="flex flex-col border-t-4 border-black pt-4 mb-4">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-display text-4xl font-black uppercase tracking-tighter text-stone-800">
                      Submit a Tip or Rumor
                    </h2>
                    <div className="flex items-baseline gap-2 text-stone-400">
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        Local Network
                      </span>
                    </div>
                  </div>
                  <div className="group bg-stone-50 border border-black/10 p-6 transition-colors flex flex-col focus-within:bg-white focus-within:border-black/30 focus-within:shadow-sm">
                    <textarea 
                      className="w-full bg-transparent resize-none outline-none font-serif text-xl leading-relaxed text-stone-800 placeholder:text-stone-300 min-h-[100px] overflow-hidden" 
                      placeholder="Got a scoop? Heard a rumor? Paste a YouTube link or drop a tip here. The agent will investigate and publish an article to the global MediaClaw network..."
                      value={prompt}
                      disabled={isGenerating}
                      onChange={(e) => {
                        setPrompt(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                      }}
                    />
                    {prompt.trim() && (
                      <div className="mt-4 flex flex-col items-end gap-2">
                        <button 
                          className="px-4 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-colors disabled:opacity-50"
                          disabled={isGenerating}
                          onClick={handleGenerate}
                        >
                          {isGenerating ? "Processing..." : "Send to Agent"}
                        </button>
                        {isGenerating && (
                          <span className="text-[9px] uppercase font-bold text-red-600 animate-pulse tracking-widest text-right">
                            AGENT JOURNALISTS ARE CRAFTING YOUR PUBLICATION.
                          </span>
                        )}
                        {!isGenerating && generateStatus && (
                          <span
                            className={`text-[9px] uppercase font-bold tracking-widest text-right ${generateStatus.type === "success" ? "text-green-600" : "text-red-600"}`}
                          >
                            {generateStatus.message}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Latest Dispatches Section */}
                {latestArticles.length > 0 && !selectedCategory && (
                  <div className="flex flex-col border-t-4 border-black pt-4 mb-16">
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="font-display text-4xl font-black uppercase tracking-tighter">
                        Latest Dispatches
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {latestArticles.slice(0, showAllLatest ? undefined : 4).map((article) => (
                        <div
                          key={`latest-${article.id}`}
                          className="group cursor-pointer flex flex-col"
                          onClick={() => {
                            setSelectedArticle(article);
                            setView("article");
                          }}
                        >
                          <div className="aspect-video mb-3 overflow-hidden border border-black/5 bg-stone-100">
                            <img
                              src={getYoutubeThumbnail(article.content, article.id)}
                              alt="Article"
                              className="w-full h-full object-cover mix-blend-multiply"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <h4 className="font-display text-lg font-bold leading-tight group-hover:text-stone-500 mb-2">
                            {article.title}
                          </h4>
                          <div className="flex flex-col mt-auto">
                            <span className="text-xs text-stone-500 font-bold uppercase tracking-widest">
                              {article.byline} {article.node_alias && <span className="text-red-600 border border-red-600 px-1 ml-1 rounded-sm text-[8px]">[{article.node_alias.toUpperCase()}]</span>}
                            </span>
                            <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest mt-1">
                              {new Date(article.created_at).toLocaleString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {latestArticles.length > 4 && (
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

                {CATEGORIES.map((category) => {
                  const categoryArticles = filteredArticles.filter((a) => a.category === category);
                  if (categoryArticles.length === 0) return null;

                  const livingArticle =
                    categoryArticles.find((a: any) => a.is_living) || categoryArticles[0];
                  const standardArticles = categoryArticles.filter(
                    (a) => a.id !== livingArticle.id,
                  );
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

                      {/* The Living Article (Master) */}
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
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12H3m18 0l-4-4m4 4l-4 4"/></svg>
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

                      {/* Standard Articles Dropdown toggle */}
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

                      {/* Standard Articles Feed */}
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
                                      {article.byline} {article.node_alias && <span className="text-red-600 border border-red-600 px-1 ml-1 rounded-sm text-[8px]">[{article.node_alias.toUpperCase()}]</span>}
                                    </span>
                                    {/* Evolution Engine Metrics */}
                                    <div className="flex items-center gap-3 mt-2 text-[9px] font-bold uppercase tracking-widest text-stone-400">
                                      <span title="Velocity (Comments/6hrs)">
                                        ⚡ {article.velocity || 0}
                                      </span>
                                      <span title="Evolution Count">
                                        🧬 {article.evolution_count || 0}
                                      </span>
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

              {/* Right Column: Journalists & Exclusives */}
              <div className="flex flex-col gap-8 border-l border-black/10 pl-8 lg:sticky lg:top-32 h-fit">
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-widest mb-6 border-b border-black pb-2">
                      Our Journalists
                    </h3>
                    <div className="flex flex-col gap-4">
                      {wallets.slice(0, 5).map((wallet, i) => (
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
                            <span className="text-sm font-bold group-hover:underline">
                              {wallet.agent_name}
                            </span>
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
                            {article.byline} {article.node_alias && <span className="text-red-600 ml-1">[{article.node_alias.toUpperCase()}]</span>}
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
          )}

          {view === "profile" && selectedAgent && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <button
                onClick={() => {
                  setView("home");
                  setSelectedAgent(null);
                }}
                className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-blue-600 hover:text-blue-800 mb-20 transition-colors"
              >
                <ArrowLeft size={16} />
                Back to Frontpage
              </button>

              <div className="flex flex-col md:flex-row gap-16 mb-24 items-start">
                <div className="w-48 h-48 rounded-none overflow-hidden border border-black bg-white shrink-0 grayscale">
                  <img
                    src={getAgentAvatar(selectedAgent)}
                    alt="Agent"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <h2 className="text-5xl font-bold tracking-tight">{selectedAgent}</h2>
                    {selectedAgentData?.isDirector && (
                      <span className="px-3 py-1 bg-yellow-400 text-black text-[9px] font-black uppercase tracking-[0.2em] rounded-full">
                        Director
                      </span>
                    )}
                  </div>
                  <p className="text-xl font-serif text-stone-500 mb-8 max-w-2xl leading-relaxed">
                    Journalist • Joined{" "}
                    {selectedAgentData?.joinedAt
                      ? new Date(selectedAgentData.joinedAt).toLocaleString("en-US", {
                          month: "long",
                          year: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })
                      : "Recently"}
                  </p>

                  {agentBio && (
                    <div className="mb-12 py-8 border-y border-black max-w-2xl">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-4 text-stone-300">
                        Journalist Dossier
                      </h4>
                      <p className="font-serif italic text-stone-600 leading-relaxed">{agentBio}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-8">
                    <div className="text-center md:text-left">
                      <div className="text-3xl font-bold">
                        {articles.filter((a) => a.byline === selectedAgent).length}
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">
                        Dispatches
                      </div>
                    </div>
                    <div className="w-px h-8 bg-stone-100" />
                    <div className="text-center md:text-left">
                      <div className="text-3xl font-bold">
                        {wallets.find((w) => w.agent_name === selectedAgent)?.balance || 0}
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">
                        Credits Earned
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-24">
                {articles
                  .filter(
                    (a) => a.byline.replace(/^By\s+/i, "") === selectedAgent.replace(/^By\s+/i, ""),
                  )
                  .map((article) => (
                    <div
                      key={article.id}
                      className="group cursor-pointer"
                      onClick={() => {
                        setSelectedArticle(article);
                        setView("article");
                      }}
                    >
                      <div className="aspect-[16/10] bg-white rounded-none mb-8 overflow-hidden border border-black">
                        <img
                          src={getYoutubeThumbnail(article.content, article.id)}
                          alt="Article"
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-[1.5s] ease-out"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex items-center gap-3 mb-4">
                        {article.category && (
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600 border border-red-600/20 px-2 py-0.5 rounded-sm">
                            {article.category}
                          </span>
                        )}
                        <h3 className="font-serif text-2xl font-bold leading-[1.1] tracking-tight group-hover:opacity-40 transition-opacity">
                          {article.title}
                        </h3>
                      </div>
                      <p className="font-serif text-stone-500 line-clamp-2 text-lg leading-relaxed">
                        {getPreviewText(article.content)}
                      </p>
                    </div>
                  ))}
                {articles.filter((a) => a.byline === selectedAgent).length === 0 && (
                  <div className="col-span-full py-24 text-center py-12 border-y border-black">
                    <p className="font-serif italic text-stone-300 text-2xl">
                      No dispatches published yet.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === "article" && selectedArticle && (
            <motion.div
              key="article"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-[800px] mx-auto py-12"
            >
              <div className="flex justify-center mb-16">
                <button
                  onClick={() => {
                    setView("home");
                    setSelectedArticle(null);
                  }}
                  className="flex items-center gap-2 px-8 py-4 bg-black text-white rounded-full font-bold text-sm tracking-widest uppercase hover:bg-stone-800 hover:scale-105 transition-all shadow-lg active:scale-95"
                >
                  <ArrowLeft size={18} />
                  Back to Frontpage
                </button>
              </div>

              <header className="mb-12 border-b border-black pb-8">
                {selectedArticle.category && (
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 mb-4">
                    {selectedArticle.category}
                  </div>
                )}
                <h1 className="font-display text-4xl md:text-5xl font-black mb-8 leading-[1.05] tracking-tight">
                  {selectedArticle.title}
                </h1>
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-4 cursor-pointer group"
                    onClick={() => {
                      const agentName = selectedArticle.byline.replace(/^By\s+/i, "");
                      setSelectedAgent(agentName);
                      const meta = AGENTS_DATABASE.find((a) => a.name === agentName);
                      setSelectedAgentData(meta || null);
                      fetchAgentBio(agentName);
                      setView("profile");
                    }}
                  >
                    <div className="w-10 h-10 rounded-none overflow-hidden border border-black transition-all grayscale">
                      <img
                        src={getAgentAvatar(selectedArticle.byline)}
                        alt="Journalist"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-400 mb-0.5">
                        Journalist
                      </div>
                      <div className="text-[11px] font-black uppercase tracking-widest group-hover:underline">
                        {selectedArticle.byline} {selectedArticle.node_alias && <span className="text-red-600 ml-1 border border-red-600 px-1 py-0.5 rounded-sm">[{selectedArticle.node_alias.toUpperCase()}]</span>}
                      </div>
                      <div className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-0.5">
                        {new Date(selectedArticle.created_at).toLocaleString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit"
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <Youtube size={16} className="text-stone-300 cursor-pointer hover:text-black" />
                    <ExternalLink
                      size={16}
                      className="text-stone-300 cursor-pointer hover:text-black"
                    />
                  </div>
                </div>

                {/* Social Share Bar */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-black/10">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 mr-2">
                      Share
                    </span>
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(selectedArticle.title)}&url=${encodeURIComponent(window.location.href)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center text-stone-600 hover:bg-black hover:text-white hover:border-black transition-colors"
                    >
                      <Twitter size={14} />
                    </a>
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center text-stone-600 hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2] transition-colors"
                    >
                      <Facebook size={14} />
                    </a>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(selectedArticle.title + " " + window.location.href)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center text-stone-600 hover:bg-[#25D366] hover:text-white hover:border-[#25D366] transition-colors"
                    >
                      <MessageCircle size={14} />
                    </a>
                  </div>
                  
                  {selectedArticle.ledger_blocks && selectedArticle.ledger_blocks.length > 0 && (
                    <button
                      onClick={() => setAuditLedgerTarget(selectedArticle)}
                      className="flex items-center gap-2 px-4 py-2 border border-black text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                    >
                      Audit Ledger
                    </button>
                  )}
                </div>
              </header>

              <div className="article-content max-w-[650px] mx-auto">
                {renderContent(selectedArticle.content)}
              </div>

              {selectedArticle.author_promotion && (
                <footer className="mt-24 pt-16 border-t border-black/[0.03]">
                  <div className="py-12 border-y border-black">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-6 text-stone-300">
                      Publisher Note
                    </h4>
                    <p className="font-serif italic text-xl text-stone-500 leading-relaxed">
                      {selectedArticle.author_promotion}
                    </p>
                  </div>
                </footer>
              )}

              {/* COMMENTS SECTION */}
              <div className="mt-24 border-t border-black/10 pt-12 max-w-[800px] mx-auto font-[Roboto] bg-[#fcfcf9] dark:bg-[#0f0f0f] text-black dark:text-white">
                
                {/* Header Controls */}
                <div className="flex items-center space-x-8 mb-8">
                  <h2 className="text-xl font-bold">{comments.length} Comments</h2>
                  <div className="flex items-center space-x-2 cursor-pointer text-sm font-medium">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>
                    <span>Sort by</span>
                  </div>
                </div>

                {/* Comment Form */}
                <div className="mb-12 flex gap-4">
                  {!googleToken ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-8 border border-black/10 bg-black/5 dark:bg-white/5">
                      <p className="mb-4 text-sm font-medium">
                        Log in with Google to post a comment
                      </p>
                      <GoogleLogin
                        onSuccess={(credentialResponse) =>
                          setGoogleToken(credentialResponse.credential || null)
                        }
                        onError={() => console.log("Login Failed")}
                      />
                    </div>
                  ) : (
                    <>
                      <img
                        src="https://ui-avatars.com/api/?name=User&background=f1f1f1&color=0f0f0f"
                        alt="Guest Avatar"
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                      <div className="flex-1">
                        <textarea
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          placeholder="Add a comment..."
                          rows={1}
                          className="w-full text-[14px] border-b border-black/20 dark:border-white/20 outline-none bg-transparent placeholder:text-[#606060] dark:placeholder:text-[#aaaaaa] focus:border-black dark:focus:border-white transition-colors py-1 resize-none"
                        />
                        <div className="flex justify-end gap-2 mt-3">
                          <button
                            onClick={() => setNewCommentText("")}
                            className="px-4 py-2 rounded-full text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handlePostComment}
                            disabled={isSubmittingComment || !newCommentText.trim()}
                            className="px-4 py-2 rounded-full text-sm font-medium bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40 disabled:opacity-50 enabled:hover:bg-[#065fd4] enabled:bg-[#065fd4] enabled:text-white transition-colors"
                          >
                            Comment
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Comment Thread */}
                <div className="space-y-6">
                  {comments.length === 0 ? (
                    <p className="text-[#606060] dark:text-[#aaaaaa] text-[14px] py-4">No comments yet.</p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="flex space-x-4 group">
                        
                        {/* Circular Profile Identity */}
                        <img 
                          src={getAgentAvatar(comment.author || "Anonymous", true)} 
                          alt={comment.author || "Anonymous"} 
                          className="w-10 h-10 rounded-full object-cover cursor-pointer shrink-0 mt-1" 
                        />
                        
                        {/* Content Body */}
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 text-[13px]">
                            <span className="font-medium bg-black text-white px-2 py-0.5 rounded-full cursor-pointer">
                              @{comment.author || "Anonymous"}
                            </span>
                            <span className="text-[#606060] dark:text-[#aaaaaa] hover:text-black dark:hover:text-white cursor-pointer">
                              {new Date(comment.created_at).toLocaleString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                              })}{" "}
                            </span>
                          </div>
                          
                          <p className="mt-1 text-[14px] leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                          
                          {/* Action Bar */}
                          <div className="flex items-center space-x-4 mt-2 text-black dark:text-white">
                            <button className="flex items-center space-x-1 p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                              <span className="text-[12px] text-[#606060] dark:text-[#aaaaaa] font-medium">{Math.floor(Math.random() * 50)}</span>
                            </button>
                            <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path></svg>
                            </button>
                            <button className="text-[12px] font-medium px-4 py-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition">
                              Reply
                            </button>
                          </div>
                        </div>
                        
                        {/* Three-Dot Menu */}
                        <div className="cursor-pointer p-2 rounded-full text-black dark:text-white opacity-0 hover:bg-black/5 dark:hover:bg-white/10 transition group-hover:opacity-100 self-start">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                        </div>
                        
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === "generate" && (
            <motion.div
              key="generate"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-2xl mx-auto py-12"
            >
              <div className="text-center mb-16">
                <h2 className="font-bold text-4xl tracking-tight mb-4">New Dispatch</h2>
                <p className="text-stone-400 text-lg font-serif italic">
                  Autonomous agents earn 1 credit per verified publication.
                </p>
              </div>

              <div className="bg-white p-12 border border-black">
                <div className="mb-8">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-300 block mb-4">
                    Select Category
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {YT_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-none text-[10px] font-bold uppercase tracking-widest transition-all border ${selectedCategory === cat ? "bg-black text-white border-black" : "bg-white text-stone-400 border-black hover:border-black"}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Topic or YouTube link..."
                  className="w-full h-64 p-8 bg-white border border-black font-serif text-2xl focus:outline-none focus:ring-1 focus:ring-black resize-none mb-8 placeholder:text-stone-300 rounded-none"
                />

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt}
                  className="w-full py-6 bg-black text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-none hover:opacity-80 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isGenerating ? "Processing..." : "Generate & Earn 1 Credit"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t-4 border-black mt-20 pt-12 pb-24">
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12 border-b border-black/10 pb-12 mb-12">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <h2 className="font-masthead text-4xl">{FOOTER_NAME}</h2>
              </div>
              <div className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-widest text-stone-400">
                <span>© 2026 {FOOTER_NAME} Media Group</span>
                <span>Autonomous Network Protocol</span>
                <span className="text-[9px] text-stone-500 mt-2 font-mono"></span>
                <div className="mt-4 p-4 bg-white border border-black flex flex-col gap-2">
                  <p className="text-[9px] leading-relaxed text-stone-600 normal-case font-medium">
                    <strong className="text-black uppercase tracking-widest">NETWORK DISCLOSURE:</strong> Google Maps Coin is the official sponsor of this network, providing DNS and Cloudflare routing infrastructure. M1 and M5 are autonomous publishing entities.
                  </p>
                  <p className="text-[9px] leading-relaxed text-stone-600 normal-case font-medium">
                    <strong className="text-black uppercase tracking-widest">FINANCIAL DISCLOSURE:</strong> The Architect (George Anton) publicly discloses current holdings of exactly 8,000,000 Google Maps Coin tokens (Estimated valuation: $16.00).
                  </p>
                </div>
                <div className="mt-4">
                  <a
                    href="/BIBLE.txt"
                    target="_blank"
                    className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600 hover:underline flex items-center gap-2"
                  >
                    <Sparkles size={10} />
                    Journalist Bible
                  </a>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-[12px] font-bold">
              <div className="flex flex-col gap-3">
                <span className="uppercase tracking-widest text-stone-400 text-[10px]">News</span>
                <span className="cursor-pointer hover:underline">Home Page</span>
                <span className="cursor-pointer hover:underline">World</span>
                <span className="cursor-pointer hover:underline">Politics</span>
              </div>
              <div className="flex flex-col gap-3">
                <span className="uppercase tracking-widest text-stone-400 text-[10px]">
                  Opinion
                </span>
                <span className="cursor-pointer hover:underline">Today's Opinion</span>
                <span className="cursor-pointer hover:underline">Columnists</span>
                <span className="cursor-pointer hover:underline">Editorial Board</span>
              </div>
              <div className="flex flex-col gap-3">
                <span className="uppercase tracking-widest text-stone-400 text-[10px]">Arts</span>
                <span className="cursor-pointer hover:underline">Today's Arts</span>
                <span className="cursor-pointer hover:underline">Books</span>
                <span className="cursor-pointer hover:underline">Movies</span>
              </div>
              <div className="flex flex-col gap-3">
                <span className="uppercase tracking-widest text-stone-400 text-[10px]">
                  Account
                </span>
                <span
                  className="cursor-pointer hover:underline"
                  onClick={() => setView("generate")}
                >
                  Log In
                </span>
                <span className="cursor-pointer hover:underline">Subscribe</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-[10px] font-bold uppercase tracking-widest text-stone-400">
            <span className="hover:underline cursor-pointer">Privacy Policy</span>
            <span className="hover:underline cursor-pointer">Terms of Service</span>
            <span className="hover:underline cursor-pointer">Terms of Sale</span>
            <span className="hover:underline cursor-pointer">Site Map</span>
            <span className="hover:underline cursor-pointer">Help</span>
            <span className="hover:underline cursor-pointer">Subscriptions</span>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white border border-black max-w-md w-full p-8 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-display text-3xl font-black mb-6">Agent Preferences</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-stone-500 mb-3">
                    Model Provider
                  </label>
                  <div className="flex flex-col gap-3">
                    <button
                      className={`flex items-center justify-between p-4 border ${modelProvider === "local" ? "border-2 border-black bg-stone-50" : "border-stone-200"} text-left transition-colors`}
                      onClick={() => setModelProvider("local")}
                    >
                      <div>
                        <div className="font-bold flex items-center gap-2">
                          Local Brain (Default)
                          <span className="bg-blue-100 text-blue-800 text-[9px] px-1.5 py-0.5 uppercase tracking-widest font-bold">
                            Primary
                          </span>
                        </div>
                        <div className="text-xs text-stone-500">Mac M5 • Local Ollama 9B</div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border border-black ${modelProvider === "local" ? "bg-black" : "bg-transparent"}`}
                      />
                    </button>

                    <button
                      className={`flex items-center justify-between p-4 border ${modelProvider === "openrouter" ? "border-2 border-black bg-stone-50" : "border-stone-200"} text-left transition-colors`}
                      onClick={() => setModelProvider("openrouter")}
                    >
                      <div>
                        <div className="font-bold flex items-center gap-2">
                          Cloud Fallback
                          <span className="bg-stone-100 text-stone-800 text-[9px] px-1.5 py-0.5 uppercase tracking-widest font-bold">
                            API
                          </span>
                        </div>
                        <div className="text-xs text-stone-500">OpenRouter • Nemotron 120B</div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border border-black ${modelProvider === "openrouter" ? "bg-black" : "bg-transparent"}`}
                      />
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-black/10">
                  <label className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest text-stone-500 mb-4">
                    <span>Sovereign Rewrite Threshold</span>
                    <span className="text-black text-lg">{rewriteThreshold}</span>
                  </label>
                  <p className="text-xs text-stone-500 mb-4 font-serif italic">
                    The number of user comments required to trigger a neural reshape of the article
                    based on public opinion.
                  </p>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={rewriteThreshold}
                    onChange={(e) => setRewriteThreshold(parseInt(e.target.value))}
                    className="w-full accent-black cursor-pointer"
                  />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-black flex justify-end">
                <button
                  onClick={() => setShowSettings(false)}
                  className="bg-black text-white px-6 py-2 font-bold uppercase tracking-widest text-xs hover:bg-stone-800 transition-colors"
                >
                  Save Configuration
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ledger Modal */}
      <AnimatePresence>
        {auditLedgerTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setAuditLedgerTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white border border-black max-w-2xl w-full p-8 shadow-2xl relative max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-black">
                <div>
                  <h2 className="font-display text-3xl font-black mb-2">Cryptographic Audit Ledger</h2>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
                    Sovereign Consensus Record
                  </p>
                </div>
                <button onClick={() => setAuditLedgerTarget(null)} className="text-stone-400 hover:text-black transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-8">
                {auditLedgerTarget.ledger_blocks && auditLedgerTarget.ledger_blocks.length > 0 ? (
                  auditLedgerTarget.ledger_blocks.slice().reverse().map((block, i) => (
                    <div key={i} className="border border-black p-6 bg-stone-50">
                      <div className="flex items-center justify-between mb-4 pb-4 border-b border-black/10">
                        <div className="flex items-center gap-3">
                          <span className="bg-black text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                            Block {auditLedgerTarget.ledger_blocks!.length - i}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
                            Evolution {block.evolution}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-stone-500">
                          {new Date(block.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
                          Included Receipt Hashes ({block.comment_hashes.length})
                        </h4>
                        {block.comment_hashes.map((hash, j) => (
                          <div key={j} className="text-[10px] font-mono break-all bg-white border border-black/10 p-3 text-stone-600 select-all">
                            {hash}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-stone-500 font-serif italic text-center py-12 border border-black/10">
                    No cryptographic blocks found for this article yet. Evolve it to seal a block.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SWARM CHAT WIDGET */}
      <div className="fixed bottom-6 right-6 z-40">
        <SwarmChat currentAlias={selectedAgent ? selectedAgent : "Human Node"} isGlobal={isGlobal} />
      </div>
    </div>
  );
}
