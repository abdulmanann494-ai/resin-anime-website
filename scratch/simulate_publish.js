const http = require('http');

async function runTest() {
  const TEST_PASSWORD = process.env.RESIN_TEST_PASSWORD || process.env.RESIN_SEED_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!TEST_PASSWORD) {
    console.error("Set RESIN_TEST_PASSWORD or RESIN_SEED_PASSWORD before running this script.");
    return;
  }
  console.log("1. Logging in as Administrator...");
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@resin.app",
      password: TEST_PASSWORD
    })
  });
  
  const loginData = await loginRes.json();
  console.log("Login status:", loginRes.status, loginData);
  
  const cookie = loginRes.headers.get("set-cookie");
  console.log("Session Cookie:", cookie);
  
  if (!loginRes.ok) {
    console.error("Login failed!");
    return;
  }
  
  // Dummy 1x1 transparent PNG data URL
  const dummyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  
  console.log("\n2. Sending publish request with valid dummy base64 payload...");
  const publishRes = await fetch("http://localhost:3000/api/admin/wallpapers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookie
    },
    body: JSON.stringify({
      title: "Test Ingestion",
      anime: "Original",
      artist: "Tester",
      tags: ["#Test"],
      collection: "Standalone Masterpieces",
      isDraft: false,
      imagePayload: dummyPng,
      compressedPayload: dummyPng,
      resolution: "1920x1080",
      aspectRatio: "16:9",
      fileSize: "1 KB",
      ratio: "landscape",
      quality: "1080p",
      color: "blue",
      palette: ["#000000", "#ffffff"]
    })
  });
  
  const publishData = await publishRes.json();
  console.log("Publish status:", publishRes.status, publishData);
}

runTest();
