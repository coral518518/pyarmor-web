// Cloudflare Worker Script (ES Module style)
export default {
  async fetch(request, env, ctx) {
    // 1. Only allow POST requests
    if (request.method !== "POST") {
      return new Response("Method Not Allowed. Please POST Python code.", {
        status: 405,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // 2. Simple Token Authentication (Optional but Recommended)
    // To set this up, add an environment variable named API_TOKEN in your CF Worker dashboard.
    if (env.API_TOKEN) {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || authHeader !== `Bearer ${env.API_TOKEN}`) {
        return new Response("Unauthorized. Invalid API Token.", {
          status: 401,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    }

    // Retrieve incoming python code
    const bodyText = await request.text();
    if (!bodyText || bodyText.trim() === "") {
      return new Response("Bad Request. Body is empty.", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Get optional platform query parameters from the request URL
    const incomingUrl = new URL(request.url);
    const platform = incomingUrl.searchParams.get("platform");

    // Construct Koyeb Backend URL
    // Set KOYEB_BACKEND_URL in Worker environment variables, e.g., "https://myapp-xyz.koyeb.app"
    const backendBase = env.KOYEB_BACKEND_URL || "http://localhost:8000";
    const targetUrl = new URL("/obfuscate", backendBase);
    targetUrl.searchParams.set("format", "text");
    if (platform) {
      targetUrl.searchParams.set("platform", platform);
    }

    try {
      // Forward the request to Koyeb backend
      const response = await fetch(targetUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: bodyText,
      });

      // Forward response back to the client
      const responseBody = await response.text();
      return new Response(responseBody, {
        status: response.status,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Access-Control-Allow-Origin": "*", // Enable CORS if you wish to call this from frontend
        },
      });

    } catch (err) {
      return new Response(`Worker Proxy Error: ${err.message}`, {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  },
};
