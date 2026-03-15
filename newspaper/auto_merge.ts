import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { cwd, stdio: "inherit" });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command ${command} exited with code ${code}`));
    });
  });
}

async function autoMerge() {
  console.log(">>> [AUTO-MERGE] Starting Ollama Bridge Protocol...");

  const autoresearchDir = path.resolve(__dirname, "../autoresearch-master");
  const modelfilePath = path.join(autoresearchDir, "Modelfile");
  const adapterPath = path.join(autoresearchDir, "out", "new_adapter.safetensors");

  // Write the Modelfile
  const modelfileContent = `FROM qwen3.5:4b
PARAMETER temperature 0.8
SYSTEM "You are a master investigative journalist with merged knowledge."
ADAPTER ./out/new_adapter.safetensors
`;

  console.log(">>> [AUTO-MERGE] Writing Modelfile...");
  fs.writeFileSync(modelfilePath, modelfileContent, "utf-8");

  // Check if adapter exists for safety, but proceed anyway
  if (!fs.existsSync(adapterPath)) {
    console.log(
      `>>> [AUTO-MERGE] WARNING: Adapter not found at ${adapterPath}. Expecting 'ollama create' to fail if missing.`,
    );
  }

  try {
    console.log(">>> [AUTO-MERGE] Executing 'ollama create media_claw_latest'...");
    await runCommand("ollama", ["create", "media_claw_latest", "-f", "Modelfile"], autoresearchDir);

    console.log(">>> [AUTO-MERGE] Ollama model built successfully.");

    console.log(">>> [AUTO-MERGE] Updating MediaClaw Configuration...");
    const defaultsPath = path.resolve(__dirname, "../src/agents/defaults.ts");
    let content = fs.readFileSync(defaultsPath, "utf-8");
    content = content.replace(
      /export const DEFAULT_MODEL = ".*?";/,
      'export const DEFAULT_MODEL = "media_claw_latest";',
    );
    fs.writeFileSync(defaultsPath, content, "utf-8");

    console.log(
      ">>> [AUTO-MERGE] Protocol Complete. System is now running on the latest neural snapshot.",
    );
  } catch (error) {
    console.error(">>> [AUTO-MERGE] Process failed:", error);
    process.exit(1);
  }
}

autoMerge();
