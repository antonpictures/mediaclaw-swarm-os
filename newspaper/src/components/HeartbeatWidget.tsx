import React, { useState, useEffect, useRef } from "react";

interface PulseData {
  node: string;
  chip: string;
  memory_total_gb: number;
  memory_used_gb: number;
  cpu_idle: number;
  uptime_hours: number;
  article_count: number;
  outbox_pending: number;
  last_comment_at: string | null;
  next_pulse_in_seconds: number;
  tunnel: string;
  ollama_model: string;
}

export function HeartbeatWidget() {
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [beating, setBeating] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPulse = async () => {
    try {
      const res = await fetch("/api/pulse");
      if (!res.ok) return;
      const data = await res.json();
      setPulse(data);
      setCountdown(data.next_pulse_in_seconds ?? 780);
      // Trigger beat animation
      setBeating(true);
      setTimeout(() => setBeating(false), 600);
    } catch {
      // silently ignore
    }
  };

  useEffect(() => {
    fetchPulse();
    intervalRef.current = setInterval(fetchPulse, 13000); // refresh every 13s
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const fmtCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const memPct = pulse ? Math.round((pulse.memory_used_gb / pulse.memory_total_gb) * 100) : 0;
  const cpuPct = pulse ? Math.round(100 - pulse.cpu_idle) : 0;

  return (
    <div style={{
      background: "linear-gradient(135deg, #0a0a0a 0%, #111 100%)",
      border: "1px solid #222",
      borderRadius: "20px",
      padding: "28px 32px",
      margin: "0 0 32px 0",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
      color: "#f5f5f7",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Subtle background glow */}
      <div style={{
        position: "absolute", top: "-60px", right: "-60px",
        width: "200px", height: "200px",
        background: "radial-gradient(circle, rgba(255,59,48,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Pulsing heart */}
          <div style={{ position: "relative", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* Outer ring pulse */}
            <div style={{
              position: "absolute",
              width: beating ? "40px" : "32px",
              height: beating ? "40px" : "32px",
              borderRadius: "50%",
              border: "1.5px solid rgba(255,59,48,0.4)",
              transition: "all 0.3s ease",
              animation: "pulse-ring 2s ease-in-out infinite",
            }} />
            {/* Inner dot */}
            <div style={{
              width: beating ? "18px" : "14px",
              height: beating ? "18px" : "14px",
              borderRadius: "50%",
              background: "#ff3b30",
              transition: "all 0.2s ease",
              boxShadow: "0 0 12px rgba(255,59,48,0.6)",
            }} />
          </div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "0.06em", color: "#ff3b30", textTransform: "uppercase" }}>
              Alice M5 — Silicon Heart
            </div>
            <div style={{ fontSize: "11px", color: "#666", marginTop: "2px", letterSpacing: "0.04em" }}>
              {pulse?.chip ?? "Apple M5"} · {pulse?.memory_total_gb ?? 24}GB · Mesa, AZ
            </div>
          </div>
        </div>

        {/* Live indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{
            width: "7px", height: "7px", borderRadius: "50%",
            background: "#30d158",
            boxShadow: "0 0 6px rgba(48,209,88,0.8)",
            animation: "live-blink 2s ease-in-out infinite",
          }} />
          <span style={{ fontSize: "11px", color: "#30d158", fontWeight: 600, letterSpacing: "0.08em" }}>ONLINE</span>
        </div>
      </div>

      {/* Vitals grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        <Vital label="Neural Engine" value={`${cpuPct}%`} sub="CPU active" color="#0a84ff" pct={cpuPct} />
        <Vital label="Hippocampus" value={`${memPct}%`} sub={`${pulse?.memory_used_gb?.toFixed(1) ?? "--"}GB used`} color="#ff9f0a" pct={memPct} />
        <Vital label="Organs" value={pulse?.article_count?.toString() ?? "--"} sub="articles published" color="#30d158" />
        <Vital label="Outbox" value={pulse?.outbox_pending?.toString() ?? "0"} sub="queued deliveries" color={pulse?.outbox_pending ? "#ff3b30" : "#30d158"} />
      </div>

      {/* Heartbeat line (ECG-style) */}
      <HeartbeatLine beating={beating} />

      {/* Footer stats */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px" }}>
        <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.04em" }}>
          Next organ scan in <span style={{ color: "#f5f5f7", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtCountdown(countdown)}</span>
        </div>
        <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.04em" }}>
          Tunnel: <span style={{ color: "#0a84ff" }}>georgeanton.com</span>
        </div>
        <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.04em" }}>
          Brain: <span style={{ color: "#f5f5f7" }}>{pulse?.ollama_model ?? "alice_m5"}</span>
        </div>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%   { opacity: 0.8; transform: scale(1); }
          50%  { opacity: 0.3; transform: scale(1.3); }
          100% { opacity: 0.8; transform: scale(1); }
        }
        @keyframes live-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

function Vital({ label, value, sub, color, pct }: { label: string; value: string; sub: string; color: string; pct?: number }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "12px", padding: "14px 16px", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: "10px", color: "#666", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "8px" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: 700, color, letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "10px", color: "#444", marginTop: "6px" }}>{sub}</div>
      {pct !== undefined && (
        <div style={{ marginTop: "10px", height: "2px", background: "rgba(255,255,255,0.08)", borderRadius: "2px" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "2px", transition: "width 1s ease", boxShadow: `0 0 6px ${color}66` }} />
        </div>
      )}
    </div>
  );
}

function HeartbeatLine({ beating }: { beating: boolean }) {
  const points = beating
    ? "0,20 40,20 50,5 60,35 70,5 80,35 90,20 200,20"
    : "0,20 80,20 90,5 100,35 110,20 200,20";

  return (
    <div style={{ position: "relative", height: "40px", overflow: "hidden" }}>
      <svg width="100%" height="40" viewBox="0 0 400 40" preserveAspectRatio="none" style={{ transition: "all 0.3s ease" }}>
        <defs>
          <linearGradient id="ecg-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,59,48,0)" />
            <stop offset="40%" stopColor="rgba(255,59,48,0.8)" />
            <stop offset="100%" stopColor="rgba(255,59,48,0)" />
          </linearGradient>
        </defs>
        {/* Static baseline */}
        <line x1="0" y1="20" x2="400" y2="20" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        {/* ECG line */}
        <polyline
          points={`0,20 120,20 140,5 155,35 170,5 185,35 200,20 400,20`.replace("200", beating ? "180" : "200")}
          fill="none"
          stroke="url(#ecg-grad)"
          strokeWidth={beating ? "1.5" : "1"}
          style={{ transition: "all 0.3s ease" }}
        />
        {/* Glowing dot at pulse head */}
        <circle cx={beating ? "200" : "210"} cy="20" r="3" fill="#ff3b30" style={{ filter: "blur(1px)" }} />
      </svg>
    </div>
  );
}
