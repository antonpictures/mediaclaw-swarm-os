import { Terminal, Play, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";

export function TrainingWidget() {
  const [isTraining, setIsTraining] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const eventSource = new EventSource("/api/training-stream");

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "status") {
        if (data.status === "training" || data.status === "merging") {
          setIsTraining(true);
          setProgress(data.status === "training" ? 50 : 90);
        } else {
          setIsTraining(false);
          setProgress(data.status === "complete" ? 100 : 0);
          if (data.status === "complete") {
            setTimeout(() => setProgress(0), 5000);
          }
        }
      } else if (data.text) {
        setLogs((prev) => [...prev, data.text]);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current && isConsoleOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isConsoleOpen]);

  const handleForceRetrain = async () => {
    if (isTraining) return;
    try {
      setIsTraining(true);
      setLogs([]);
      setProgress(10);
      setIsConsoleOpen(true);
      await fetch("/api/force-retrain", { method: "POST" });
    } catch (err) {
      console.error(err);
      setIsTraining(false);
    }
  };

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-white/20 bg-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-all duration-300 dark:border-white/10 dark:bg-black/40">
      {/* Widget Header & Controls */}
      <div className="flex items-center justify-between p-5">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${isTraining ? "bg-blue-500/10 text-blue-500" : "bg-gray-500/10 text-gray-500"}`}
          >
            {isTraining ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Terminal className="h-5 w-5" />
            )}
          </div>
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              Neural Retraining Cycle
            </h3>
            <p className="text-[13px] text-gray-500 dark:text-gray-400">
              {isTraining ? "MLOps Pipeline Active..." : "System Idle - Waiting for threshold"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Native macOS style progress bar */}
          <div className="hidden w-48 sm:block">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200/50 dark:bg-gray-800/50">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-700 ease-in-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <button
            onClick={handleForceRetrain}
            disabled={isTraining}
            className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-full bg-blue-500 px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:bg-blue-600 disabled:opacity-50"
          >
            {isTraining ? "Retraining..." : "Force Retrain"}
            {!isTraining && <Play className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={() => setIsConsoleOpen(!isConsoleOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200/50 dark:hover:bg-gray-800/50"
          >
            {isConsoleOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable Console Window */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${isConsoleOpen ? "grid-rows-[1fr] border-t border-gray-200/50 dark:border-gray-800/50" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden bg-[#1E1E1E] dark:bg-black/60">
          <div
            ref={scrollRef}
            className="h-[250px] overflow-y-auto p-4 font-mono text-[11px] leading-relaxed text-gray-300 antialiased"
          >
            {logs.length === 0 ? (
              <span className="text-gray-500">Waiting for training stream...</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="whitespace-pre-wrap">
                  {log}
                </div>
              ))
            )}
            {isTraining && (
              <div className="mt-2 flex items-center gap-2 text-blue-400">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400"></span>
                Processing...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
