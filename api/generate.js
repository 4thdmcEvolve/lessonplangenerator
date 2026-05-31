// Universal Vercel serverless proxy — password-protected + rate-limited
// © 2025 4THDMC | EVOLVE LLC. All Rights Reserved.
//
// SETUP IN VERCEL (Settings → Environment Variables):
//   ANTHROPIC_API_KEY   = your rotated Anthropic API key
//   TOOLKIT_PASSWORD    = ToolkitEvolve2026 (for paid toolkit tools)

const rateLimitStore = new Map();
const MAX_REQUESTS_PER_WINDOW = 40;
const WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(key) {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, resetAt: record.resetAt };
  }
  record.count += 1;
  return { allowed: true };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method not allowed" } });
  }

  const provided = req.headers["x-toolkit-password"] || (req.body && req.body.toolkitPassword);
  const expected = process.env.TOOLKIT_PASSWORD;

  if (!expected) {
    return res.status(500).json({
      error: { message: "Server configuration error: TOOLKIT_PASSWORD not set" }
    });
  }
  if (!provided || provided !== expected) {
    return res.status(401).json({
      error: { message: "Invalid or missing access password.", code: "AUTH_REQUIRED" }
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: { message: "Server configuration error: ANTHROPIC_API_KEY not set" }
    });
  }

  const limit = checkRateLimit(provided);
  if (!limit.allowed) {
    const minutes = Math.ceil((limit.resetAt - Date.now()) / 60000);
    return res.status(429).json({
      error: { message: `Rate limit reached. Try again in about ${minutes} minute(s).` }
    });
  }

  const { toolkitPassword, ...anthropicBody } = req.body || {};

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(anthropicBody),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({
      error: { message: "Proxy error: " + error.message }
    });
  }
}
