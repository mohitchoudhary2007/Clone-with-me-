import { generateClonePrompt } from "../../src/lib/prompt-generator";

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

    // Plain fetch of the target website content
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const BROWSER_HEADERS = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    };

    let title = "";
    let description = "";
    let html = "";

    try {
      const response = await fetch(parsedUrl.toString(), {
        signal: controller.signal,
        headers: BROWSER_HEADERS,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      html = text;

      // Extract title
      const titleMatch = text.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
      title = titleMatch ? titleMatch[1].trim().replace(/&amp;/g, "&").replace(/&#39;/g, "'") : "";

      // Extract description
      const descMatch =
        text.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']{1,300})["']/i) ||
        text.match(/<meta[^>]*content=["']([^"']{1,300})["'][^>]*name=["']description["']/i);
      description = descMatch ? descMatch[1].trim() : "";

    } catch (err: any) {
      clearTimeout(timeout);
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

    if (!html.trim()) {
      return new Response(JSON.stringify({ error: "Could not extract any content from the website." }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Generate clone prompt
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
    return new Response(JSON.stringify({ error: `Internal server error: ${err.message}` }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
};
