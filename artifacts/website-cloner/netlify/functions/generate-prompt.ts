import { generateClonePrompt } from "../../src/lib/prompt-generator";
import dns from "node:dns/promises";

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
    if (total > MAX) {
      await reader.cancel();
      break;
    }
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
    let currentUrl = url;
    let response: Response | null = null;
    let hops = 0;
    const maxHops = 5;

    while (hops < maxHops) {
      response = await fetch(currentUrl.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: BROWSER_HEADERS,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Redirect with no Location header");

        try {
          currentUrl = new URL(location, currentUrl.toString());
        } catch {
          throw new Error("Invalid redirect destination");
        }

        if (!["http:", "https:"].includes(currentUrl.protocol)) {
          throw new Error("Redirect to non-HTTP protocol blocked");
        }

        const safe = await isSafeUrl(currentUrl);
        if (!safe) throw new Error("Redirect to private/internal address blocked (SSRF)");

        hops++;
      } else {
        break;
      }
    }

    if (!response) {
      throw new Error("No response received");
    }

    clearTimeout(timeout);
    return readHtmlResponse(response);
  } finally {
    clearTimeout(timeout);
  }
}

export default async (req: Request) => {
  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    const body = await req.json() as { url?: string };
    const url = body?.url;

    if (!url) {
      return new Response(JSON.stringify({ error: "Invalid request: url is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL format. Include http:// or https://" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return new Response(JSON.stringify({ error: "Only http and https URLs are supported" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // SSRF protection
    const safe = await isSafeUrl(parsedUrl);
    if (!safe) {
      return new Response(JSON.stringify({ error: "URL must point to a publicly accessible website" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const tinyfishKey = process.env.TINYFISH_API_KEY;

    let title = "";
    let description = "";
    let html = "";

    // Try TinyFish first (if configured), fall back to plain fetch
    if (tinyfishKey) {
      try {
        console.log(`[Netlify Function] Fetching via TinyFish: ${url}`);
        const result = await fetchWithTinyfish(url, tinyfishKey);
        title = result.title;
        description = result.description;
        const MAX_TF = 2 * 1024 * 1024;
        const raw = result.text || result.html;
        html = raw.length > MAX_TF ? raw.slice(0, MAX_TF) : raw;
        console.log(`[Netlify Function] TinyFish fetch OK. Content length: ${html.length}`);
      } catch (err: any) {
        console.warn(`[Netlify Function] TinyFish failed, falling back to plain fetch:`, err);
      }
    }

    if (!html) {
      try {
        console.log(`[Netlify Function] Fetching via plain HTTP: ${url}`);
        const result = await fetchPlain(parsedUrl);
        title = result.title;
        description = result.description;
        html = result.html;
        console.log(`[Netlify Function] Plain fetch OK. Content length: ${html.length}`);
      } catch (err: any) {
        console.error(`[Netlify Function] Plain fetch failed:`, err);
        const msg = err?.name === "AbortError"
          ? "Request timed out. The website took too long to respond."
          : `Could not fetch the website: ${err?.message ?? "Unknown error"}. Make sure the URL is correct and publicly accessible.`;
        
        return new Response(JSON.stringify({ error: msg }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    if (!html.trim()) {
      return new Response(JSON.stringify({ error: "Could not extract any content from the website." }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Generate clone prompt (local, no LLM required)
    const prompt = generateClonePrompt(html, url, title, description);

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Failed to generate prompt. Please try again." }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return new Response(JSON.stringify({
      prompt,
      analyzedUrl: url,
      title: title || parsedUrl.hostname,
      description: description || null,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });

  } catch (err: any) {
    console.error("[Netlify Function] Unexpected internal error:", err);
    return new Response(JSON.stringify({ error: `Internal server error: ${err.message}` }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
};
