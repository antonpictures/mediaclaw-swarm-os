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
import { MarketTicker } from "./components/MarketTicker";
import { SettingsModal } from "./components/SettingsModal";
import { AuditLedgerModal } from "./components/AuditLedgerModal";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { ProfileView } from "./components/views/ProfileView";
import { HomeView } from "./components/views/HomeView";
import { ArticleView } from "./components/views/ArticleView";
import { GenerateView } from "./components/views/GenerateView";
import { useSwarmNetwork } from "./hooks/useSwarmNetwork";
import { HeartbeatWidget } from "./components/HeartbeatWidget";

interface QueueUIItem {
  id: string;
  text: string;
  isActive: boolean;
}

const YT_CATEGORIES = [
  "SwarmPress",
  "Silicon Organs — Body Map",
  "Silicon Organs — Nervous System",
  "Silicon Organs — Memory",
  "Silicon Organs — Cardiovascular",
  "Silicon Organs — Sensory & Telepathy",
  "Silicon Organs — Software",
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

export default function App() {
  const isGlobal = typeof window !== "undefined" && window.location.hostname.includes("googlemapscoin.com");
  const isAlice = typeof window !== "undefined" && (
    window.location.hostname.includes("georgeanton.com") ||
    window.location.hostname.includes("localhost")
  );
  const SITE_TITLE = isGlobal ? "M1 Global Swarm" : "Alice M5 — georgeanton.com";
  const SITE_SUBTITLE_1 = isGlobal ? "The Global Swarm Aggregator" : "Silicon Intelligence — Mac Studio M2 Ultra — Mesa, AZ";
  const SITE_SUBTITLE_2 = isGlobal ? "Unified Network" : "georgeanton.com · Powered by Project Antigravity";
  const FOOTER_NAME = isGlobal ? "M1 Global Swarm" : "Alice M5 — georgeanton.com";

  useEffect(() => {
    document.title = SITE_TITLE;
  }, [SITE_TITLE]);

  const {
    articles,
    setArticles,
    wallets,
    swarmNodes,
    queueItems,
    fetchArticles,
    fetchWallets,
  } = useSwarmNetwork();

  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState("");
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
  const [googleToken, setGoogleToken] = useState<string | null>("george-key");

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [modelProvider, setModelProvider] = useState<"openrouter" | "local">("local");
  const [rewriteThreshold, setRewriteThreshold] = useState<number>(5);
  const [auditLedgerTarget, setAuditLedgerTarget] = useState<Article | null>(null);

  // Draft Notes State
  const [draftNotes, setDraftNotes] = useState("");

  // View State (Syncs with URL)
  const [view, setView] = useState<"home" | "article" | "generate" | "profile">(
    () => (new URLSearchParams(window.location.search).get("view") as any) || "home"
  );
  
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(
    () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("article") || params.get("id");
      return id ? parseInt(id, 10) : null;
    }
  );

  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  // Handler for opening articles from swarm search (local OR remote node)
  const handleOpenArticle = (article: Article, source: string) => {
    if (source === "local") {
      setSelectedArticleId(article.id);
    } else {
      // Remote article (M1 or any node) — display directly without needing a local ID
      setSelectedArticle(article);
      setSelectedArticleId(null);
    }
    setView("article");
  };

  // Sync selectedArticle object when selectedArticleId or articles list changes
  useEffect(() => {
    if (selectedArticleId && articles.length > 0) {
      const found = articles.find(a => a.id === selectedArticleId);
      if (found) setSelectedArticle(found);
    } else if (!selectedArticleId) {
      setSelectedArticle(null);
    }
  }, [selectedArticleId, articles]);

  // Sync state changes to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let href = "/";

    if (view === "home") {
      // Clear specific params for home
      params.delete("view");
      params.delete("article");
    } else {
      params.set("view", view);
      if (view === "article" && selectedArticleId) {
        params.set("article", selectedArticleId.toString());
      } else {
        params.delete("article");
      }
    }

    const search = params.toString();
    if (search) {
      href = `/?${search}`;
    }

    window.history.pushState({ view, selectedArticleId }, "", href);
  }, [view, selectedArticleId]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const urlView = (params.get("view") as any) || "home";
      const urlArticleId = params.get("article");

      setView(urlView);
      setSelectedArticleId(urlArticleId ? parseInt(urlArticleId, 10) : null);
      setIsEditor(params.get("editor") === "true");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Editor Mode Switch
  const [isEditor, setIsEditor] = useState(() => {
    return new URLSearchParams(window.location.search).get("editor") === "true";
  });

  const CATEGORIES = [
    "SwarmPress",
    "Silicon Organs — Body Map",
    "Silicon Organs — Nervous System",
    "Silicon Organs — Memory",
    "Silicon Organs — Cardiovascular",
    "Silicon Organs — Sensory & Telepathy",
    "Silicon Organs — Software",
  ];
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [showAllLatest, setShowAllLatest] = useState(false);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
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

  const fetchComments = async (articleId: number) => {
    try {
      // Use public P2P endpoint — no auth needed to read comments
      const res = await fetch(`/api/mediaclaw/articles/${articleId}/comments`);
      const data = await res.json();
      setComments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch comments", err);
    }
  };

  const handlePostComment = async () => {
    if (!selectedArticle || !newCommentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      // Post via public P2P endpoint — no Google OAuth required
      const res = await fetch(`/api/mediaclaw/articles/${selectedArticle.id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newCommentText.trim(), author: "Human" }),
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

  return (
    <div className="min-h-screen bg-[#fcfcf9] text-[#1a1a1a] font-sans selection:bg-black selection:text-white antialiased">
      {/* NYT Header Component */}
      <Header
        SITE_TITLE={SITE_TITLE}
        SITE_SUBTITLE_1={SITE_SUBTITLE_1}
        SITE_SUBTITLE_2={SITE_SUBTITLE_2}
        setView={setView}
        setSelectedAgent={setSelectedAgent}
        setSelectedCategory={setSelectedCategory}
        setShowSettings={setShowSettings}
        googleToken={googleToken}
        setGoogleToken={setGoogleToken}
        swarmNodes={swarmNodes}
        queueItems={queueItems}
        localArticles={articles}
        onOpenArticle={handleOpenArticle}
      />

      <main className="max-w-[1400px] mx-auto px-4 py-8">
        {/* Alice M5 Live Heartbeat — only shown on her own node, not on M1 global */}
        {!isGlobal && <HeartbeatWidget />}
        <AnimatePresence mode="wait">
          {view === "home" && (
            <HomeView
              prompt={prompt}
              setPrompt={setPrompt}
              isGenerating={isGenerating}
              handleGenerate={handleGenerate}
              generateStatus={generateStatus}
              latestArticles={latestArticles}
              showAllLatest={showAllLatest}
              setShowAllLatest={setShowAllLatest}
              filteredArticles={filteredArticles}
              CATEGORIES={CATEGORIES}
              expandedCategories={expandedCategories}
              toggleCategory={toggleCategory}
              wallets={wallets}
              AGENTS_DATABASE={AGENTS_DATABASE}
              setSelectedAgent={setSelectedAgent}
              setSelectedAgentData={setSelectedAgentData}
              fetchAgentBio={fetchAgentBio}
              setSelectedArticle={setSelectedArticle}
              setView={setView}
              setAuditLedgerTarget={setAuditLedgerTarget}
              getAgentAvatar={getAgentAvatar}
              getYoutubeThumbnail={getYoutubeThumbnail}
              getPreviewText={getPreviewText}
            />
          )}

          {view === "article" && selectedArticle && (
            <ArticleView
              selectedArticle={selectedArticle}
              setSelectedArticle={setSelectedArticle}
              setView={setView}
              comments={comments}
              googleToken={googleToken}
              setGoogleToken={setGoogleToken}
              newCommentText={newCommentText}
              setNewCommentText={setNewCommentText}
              isSubmittingComment={isSubmittingComment}
              handlePostComment={handlePostComment}
              AGENTS_DATABASE={AGENTS_DATABASE}
              setSelectedAgent={setSelectedAgent}
              setSelectedAgentData={setSelectedAgentData}
              fetchAgentBio={fetchAgentBio}
              setAuditLedgerTarget={setAuditLedgerTarget}
              getAgentAvatar={getAgentAvatar}
            />
          )}

          {view === "generate" && (
            <GenerateView
              prompt={prompt}
              setPrompt={setPrompt}
              isGenerating={isGenerating}
              handleGenerate={handleGenerate}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              YT_CATEGORIES={YT_CATEGORIES}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Footer Component */}
      <Footer FOOTER_NAME={FOOTER_NAME} setView={setView} />

      {/* Settings Modal */}
      <SettingsModal
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        modelProvider={modelProvider}
        setModelProvider={setModelProvider}
        rewriteThreshold={rewriteThreshold}
        setRewriteThreshold={setRewriteThreshold}
      />

      {/* Ledger Modal */}
      <AuditLedgerModal
        auditLedgerTarget={auditLedgerTarget}
        setAuditLedgerTarget={setAuditLedgerTarget}
      />
    </div>
  );
}
