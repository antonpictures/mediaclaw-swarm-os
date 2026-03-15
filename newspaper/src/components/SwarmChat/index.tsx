import React, { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";

interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

export const SwarmChat: React.FC<{
  currentAlias: string;
  isGlobal: boolean;
}> = ({ currentAlias, isGlobal }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("Connecting...");
  const ws = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      setStatus("Connecting...");
      
      const isSecure = window.location.protocol === "https:";
      const wsProtocol = isSecure ? "wss:" : "ws:";
      
      let wsUrl = `${wsProtocol}//${window.location.host}`;
      
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        wsUrl = "ws://localhost:3003"; 
      } else if (isGlobal) {
         wsUrl = `wss://googlemapscoin.com`;
      }

      console.log(`[Swarm Chat] Attempting connection to ${wsUrl}...`);
      
      try {
          const socket = new WebSocket(wsUrl);
    
          socket.onopen = () => {
            console.log("[Swarm Chat] Connected securely.");
            setStatus("Connected");
          };
    
          socket.onmessage = (event) => {
            try {
              const msg: ChatMessage = JSON.parse(event.data);
              setMessages((prev) => [...prev, msg]);
            } catch (e) {
              console.error("Failed to parse websocket message", e);
            }
          };
    
          socket.onclose = () => {
            setStatus("Reconnecting...");
            console.log("[Swarm Chat] Connection dropped. Reconnecting in 3s...");
            reconnectTimeout = setTimeout(() => {
              // SWARM RESILIENCE: 
              // If Mothership websocket drops (e.g., 502 Bad Gateway),
              // the code natively triggers a silent automated loop seeking connection parity.
              connect();
            }, 3000);
          };
    
          socket.onerror = (err) => {
            console.error("[Swarm Chat] WebSocket Error:", err);
            socket.close();
          };
    
          ws.current = socket;
      } catch (err) {
          console.error("Failed to construct WebSocket", err);
          reconnectTimeout = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      ws.current?.close();
    };
  }, [isGlobal]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || ws.current?.readyState !== WebSocket.OPEN) return;

    const msg: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      senderId: currentAlias || "Anonymous Node",
      text: input.trim(),
      timestamp: Date.now(),
    };

    ws.current.send(JSON.stringify(msg));
    setInput("");
  };

  return (
    <div className="flex flex-col h-[500px] w-full max-w-sm bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-[#2c2c2e] rounded-2xl shadow-xl overflow-hidden font-[-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Helvetica,Arial,sans-serif]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#f5f5f7] dark:bg-[#2c2c2e] border-b border-zinc-200 dark:border-[#3a3a3c]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#007aff] to-[#5856d6] flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-white dark:ring-black">
            M5
          </div>
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Swarm Chat</h3>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 font-medium">
              <span className={`w-2 h-2 rounded-full ${status === 'Connected' ? 'bg-[#34c759]' : 'bg-[#ff3b30]'}`}></span>
              {status}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white dark:bg-[#000000]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center px-4 space-y-3">
            <span className="text-4xl">📡</span>
            <p className="text-[15px] font-medium text-[#8e8e93]">End-to-End Swarm Active</p>
            <p className="text-[13px] text-center text-[#8e8e93] leading-relaxed">
              Instant transmission established.<br/>
              No heavy encryption overhead.<br/>
              Pure real-time connection.
            </p>
          </div>
        ) : null}
        {messages.map((m) => {
          const isMe = m.senderId === currentAlias || (m.senderId === "Anonymous Node" && !currentAlias);
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              {!isMe && <span className="text-[11px] font-medium text-[#8e8e93] ml-2 mb-1 uppercase tracking-wide">{m.senderId}</span>}
              <div
                className={`px-[16px] py-[10px] max-w-[85%] text-[16px] tracking-[-0.01em] leading-[1.35] ${
                  isMe
                    ? 'bg-[#007aff] text-white rounded-[20px] rounded-br-[4px] shadow-sm'
                    : 'bg-[#e9e9eb] dark:bg-[#2c2c2e] text-black dark:text-white rounded-[20px] rounded-bl-[4px]'
                }`}
                style={{ wordBreak: 'break-word' }}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-3 bg-white dark:bg-[#1c1c1e] border-t border-zinc-200 dark:border-[#3a3a3c]">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Swarm Message..."
            className="w-full pl-[16px] pr-12 py-[8px] bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-transparent rounded-full text-[16px] tracking-tight text-zinc-900 dark:text-zinc-100 placeholder-[#8e8e93] focus:outline-none focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#007aff] transition-all duration-200"
            disabled={status !== "Connected"}
          />
          <button
            type="submit"
            disabled={!input.trim() || status !== "Connected"}
            className="absolute right-1 w-[32px] h-[32px] flex items-center justify-center rounded-full bg-[#007aff] text-white disabled:opacity-50 disabled:bg-[#8e8e93] transition-all"
          >
            <Send size={15} className="-ml-[1.5px] mt-[1.5px]" strokeWidth={2.5} />
          </button>
        </form>
      </div>
    </div>
  );
};
