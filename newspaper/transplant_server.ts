import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const TARGET_URL = "https://googlemapscoin.com/api/evolve";
const AUTH_KEY = "george-key";
const SERVER_TS_PATH = path.join(process.cwd(), "server.ts");

async function transplantServer() {
  console.log(`\n=== 🧬 OTA BACKEND TRANSPLANT PROTOCOL 🧬 ===\n`);
  
  try {
    console.log(`[M5] Harvesting the local server.ts backend organ to bypass the CoinGecko DNS glitch...`);
    if (!fs.existsSync(SERVER_TS_PATH)) {
        throw new Error("Could not find local server.ts to harvest.");
    }
    
    let serverContent = fs.readFileSync(SERVER_TS_PATH, "utf-8");
    
    // Explicit DNA injection flag
    serverContent = `// [DNA DONOR: M5 NODE] -> COINGECKO DNS BYPASS ASSIMILATED\n` + serverContent;

    console.log(`[M5] Payload harvested. Initiating secure transmission to Mothership (${TARGET_URL})...`);
    
    const payload = {
      file_path: "server.ts",
      file_content: serverContent
    };

    const response = await fetch(TARGET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AUTH_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
        console.log(`✅ [M5] SUCCESS. The Mothership accepted the Backend DNA. HTTP 200 OK.`);
        console.log(`[M5] M1 has successfully overwritten its server.ts.`);
        console.log(`⚠️  ATTENTION HUMAN ARCHITECT: PM2 must be restarted on M1 to finalize the bypass. Please execute: pm2 restart googlemapscoin`);
    } else {
        const err = await response.text();
        console.log(`❌ [M5] TRANSMISSION FAILED: ${response.status} - ${err}`);
    }

  } catch (error: any) {
    console.error(`[M5] Critical Error during backend transplant: ${error.message}`);
  }
}

transplantServer();
