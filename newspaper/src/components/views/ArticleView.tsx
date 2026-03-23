import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Youtube, ExternalLink, Twitter, Facebook, MessageCircle } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { ArticleRenderer } from "../ArticleRenderer";

interface ArticleViewProps {
  selectedArticle: any;
  setSelectedArticle: (article: any) => void;
  setView: (view: string) => void;
  comments: any[];
  googleToken: string | null;
  setGoogleToken: (token: string | null) => void;
  newCommentText: string;
  setNewCommentText: (text: string) => void;
  isSubmittingComment: boolean;
  handlePostComment: () => void;
  AGENTS_DATABASE: any[];
  setSelectedAgent: (agent: string) => void;
  setSelectedAgentData: (data: any) => void;
  fetchAgentBio: (agent: string) => void;
  setAuditLedgerTarget: (article: any) => void;
  getAgentAvatar: (agentName: string, isAuthor?: boolean) => string;
}

export function ArticleView({
  selectedArticle,
  setSelectedArticle,
  setView,
  comments,
  googleToken,
  setGoogleToken,
  newCommentText,
  setNewCommentText,
  isSubmittingComment,
  handlePostComment,
  AGENTS_DATABASE,
  setSelectedAgent,
  setSelectedAgentData,
  fetchAgentBio,
  setAuditLedgerTarget,
  getAgentAvatar,
}: ArticleViewProps) {
  return (
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
                {selectedArticle.byline}{" "}
                {selectedArticle.node_alias && (
                  <span className="text-red-600 ml-1 border border-red-600 px-1 py-0.5 rounded-sm">
                    [{selectedArticle.node_alias.toUpperCase()}]
                  </span>
                )}
              </div>
              <div className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-0.5">
                {new Date(selectedArticle.created_at).toLocaleString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  timeZone: "America/Los_Angeles",
                  timeZoneName: "short",
                })}
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <Youtube size={16} className="text-stone-300 cursor-pointer hover:text-black" />
            <ExternalLink size={16} className="text-stone-300 cursor-pointer hover:text-black" />
          </div>
        </div>

        {/* Social Share Bar */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-black/10">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 mr-2">
              Share
            </span>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                selectedArticle.title,
              )}&url=${encodeURIComponent(window.location.href)}`}
              target="_blank"
              rel="noreferrer"
              className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center text-stone-600 hover:bg-black hover:text-white hover:border-black transition-colors"
            >
              <Twitter size={14} />
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                window.location.href,
              )}`}
              target="_blank"
              rel="noreferrer"
              className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center text-stone-600 hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2] transition-colors"
            >
              <Facebook size={14} />
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                selectedArticle.title + " " + window.location.href,
              )}`}
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
        <ArticleRenderer content={selectedArticle.content} />
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
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z" />
            </svg>
            <span>Sort by</span>
          </div>
        </div>

        {/* Comment Form */}
        <div className="mb-12 flex gap-4">
          {!googleToken ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 border border-black/10 bg-black/5 dark:bg-white/5">
              <p className="mb-4 text-sm font-medium">Log in with Google to post a comment</p>
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
            <p className="text-[#606060] dark:text-[#aaaaaa] text-[14px] py-4">
              No comments yet.
            </p>
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
                        second: "2-digit",
                        timeZone: "America/Los_Angeles",
                        timeZoneName: "short",
                      })}{" "}
                    </span>
                  </div>

                  <p className="mt-1 text-[14px] leading-relaxed whitespace-pre-wrap">
                    {comment.content}
                  </p>

                  {/* Action Bar */}
                  <div className="flex items-center space-x-4 mt-2 text-black dark:text-white">
                    <button className="flex items-center space-x-1 p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        viewBox="0 0 24 24"
                      >
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                      </svg>
                      <span className="text-[12px] text-[#606060] dark:text-[#aaaaaa] font-medium">
                        {Math.floor(Math.random() * 50)}
                      </span>
                    </button>
                    <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        viewBox="0 0 24 24"
                      >
                        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path>
                      </svg>
                    </button>
                    <button className="text-[12px] font-medium px-4 py-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition">
                      Reply
                    </button>
                  </div>
                </div>

                {/* Three-Dot Menu */}
                <div className="cursor-pointer p-2 rounded-full text-black dark:text-white opacity-0 hover:bg-black/5 dark:hover:bg-white/10 transition group-hover:opacity-100 self-start">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                  </svg>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
