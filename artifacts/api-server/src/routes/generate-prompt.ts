import { Router } from "express";
import { GeneratePromptBody, GeneratePromptResponse } from "@workspace/api-zod";
import dns from "node:dns/promises";
import { generateClonePrompt } from "../lib/prompt-generator.js";

// ── SSRF protection ──────────────────────────────────────────────────────────
function isPrivateIp(ip: string): boolean {
  const privateRanges = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/i,
    /^fd[0-9a-f]{2}:/i,
    /^fe80:/i,
    /^0\./,
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  ];
  return privateRanges.some((re) => re.test(ip));
}

async function isSafeUrl(url: URL): Promise<boolean> {
  const hostname = url.hostname;
  if (hostname === "localhost" || hostname === "0.0.0.0") return false;
  try {
    const { address } = await dns.lookup(hostname);
    return !isPrivateIp(address);
  } catch {
    return false;
  }
}

// ── TinyFish fetch: get clean website content ─────────────────────────────────
async function fetchWithTinyfish(url: string, apiKey: string): Promise<{
  html: string;
  text: string;
  title: string;
  description: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("https://api.fetch.tinyfish.ai", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["html", "markdown"] }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`TinyFish ${response.status}: ${err.slice(0, 200)}`);
    }

    const data = await response.json() as {
      html?: string;
      markdown?: string;
      text?: string;
      metadata?: { title?: string; description?: string };
    };

    return {
      html: data.html ?? "",
      text: data.markdown ?? data.text ?? "",
      title: data.metadata?.title ?? "",
      description: data.metadata?.description ?? "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Shared HTML body reader (capped at 2 MB) ──────────────────────────────────
async function readHtmlResponse(response: Response): Promise<{ html: string; title: string; description: string }> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const MAX = 2 * 1024 * 1024;
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX) { await reader.cancel(); break; }
    chunks.push(value);
  }

  const combined = new Uint8Array(Math.min(total, MAX));
  let offset = 0;
  for (const c of chunks) {
    combined.set(c.subarray(0, Math.min(c.byteLength, combined.length - offset)), offset);
    offset += c.byteLength;
    if (offset >= combined.length) break;
  }
  const html = new TextDecoder().decode(combined);

  const titleMatch = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().replace(/&amp;/g, "&").replace(/&#39;/g, "'") : "";

  const descMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']{1,300})["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']{1,300})["'][^>]*name=["']description["']/i);
  const description = descMatch ? descMatch[1].trim() : "";

  return { html, title, description };
}

// ── Plain HTTP fetch fallback ─────────────────────────────────────────────────
async function fetchPlain(url: URL): Promise<{ html: string; title: string; description: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  const BROWSER_HEADERS = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  try {
    // Use redirect:'manual' to validate every hop against SSRF rules
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "manual",
      headers: BROWSER_HEADERS,
    });

    // Follow one redirect hop with full SSRF validation
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect with no Location header");

      let destUrl: URL;
      try { destUrl = new URL(location, url.toString()); }
      catch { throw new Error("Invalid redirect destination"); }

      if (!["http:", "https:"].includes(destUrl.protocol)) {
        throw new Error("Redirect to non-HTTP protocol blocked");
      }
      const safe = await isSafeUrl(destUrl);
      if (!safe) throw new Error("Redirect to private/internal address blocked (SSRF)");

      const r2 = await fetch(destUrl.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: BROWSER_HEADERS,
      });
      clearTimeout(timeout);
      return readHtmlResponse(r2);
    }

    clearTimeout(timeout);
    return readHtmlResponse(response);
  } finally {
    clearTimeout(timeout);
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────
const router = Router();

router.post("/generate-prompt", async (req, res) => {
  const parseResult = GeneratePromptBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request: url is required" });
    return;
  }

  const { url } = parseResult.data;

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    res.status(400).json({
      error: "Invalid URL format. Include http:// or https://",
    });
    return;
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    res.status(400).json({ error: "Only http and https URLs are supported" });
    return;
  }

  // SSRF protection
  const safe = await isSafeUrl(parsedUrl);
  if (!safe) {
    res.status(400).json({
      error: "URL must point to a publicly accessible website",
    });
    return;
  }

  const tinyfishKey = process.env.TINYFISH_API_KEY;

  // Step 1: Fetch website content
  let title = "";
  let description = "";
  let html = "";

  // Try TinyFish first; fall back to plain fetch on ANY failure
  if (tinyfishKey) {
    try {
      req.log.info({ url }, "Fetching via TinyFish");
      const result = await fetchWithTinyfish(url, tinyfishKey);
      title = result.title;
      description = result.description;
      // Cap TinyFish content at 2 MB before passing to parser
      const MAX_TF = 2 * 1024 * 1024;
      const raw = result.text || result.html;
      html = raw.length > MAX_TF ? raw.slice(0, MAX_TF) : raw;
      req.log.info({ url, contentLen: html.length }, "TinyFish fetch OK");
    } catch (err: unknown) {
      // Always fall through to plain fetch regardless of error type
      req.log.warn({ err }, "TinyFish failed, falling back to plain fetch");
    }
  }

  if (!html) {
    try {
      req.log.info({ url }, "Fetching via plain HTTP");
      const result = await fetchPlain(parsedUrl);
      title = result.title;
      description = result.description;
      html = result.html;
      req.log.info({ url, contentLen: html.length }, "Plain fetch OK");
    } catch (err: unknown) {
      req.log.error({ err }, "Plain fetch failed");
      const msg =
        (err as Error)?.name === "AbortError"
          ? "Request timed out. The website took too long to respond."
          : `Could not fetch the website: ${(err as Error)?.message ?? "Unknown error"}. Make sure the URL is correct and publicly accessible.`;
      res.status(400).json({ error: msg });
      return;
    }
  }

  if (!html.trim()) {
    res.status(400).json({ error: "Could not extract any content from the website." });
    return;
  }

  // Step 2: Generate clone prompt (local, no LLM required)
  try {
    req.log.info({ url, htmlLen: html.length }, "Generating clone prompt");
    const prompt = generateClonePrompt(html, url, title, description);

    if (!prompt) {
      res.status(500).json({ error: "Failed to generate prompt. Please try again." });
      return;
    }

    const result = GeneratePromptResponse.parse({
      prompt,
      analyzedUrl: url,
      title: title || parsedUrl.hostname,
      description: description || null,
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Prompt generation failed");
    res.status(500).json({
      error: `Prompt generation error: ${(err as Error)?.message ?? "Unknown"}`,
    });
  }
});

export default router;
