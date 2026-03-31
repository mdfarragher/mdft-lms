import { FreshContext } from "$fresh/server.ts";
import { getCookies } from "$std/http/cookie.ts";
import { getDirectusClient } from "../utils/directus.ts";
import { readMe } from "@directus/sdk";
import { join } from "$std/path/mod.ts";
import { log } from "../utils/logger.ts";

const logger = log.getLogger("middleware");

/** Serve the static 500 error page from nginx/html/500.html */
async function directusOfflineResponse(): Promise<Response> {
  const html = await Deno.readTextFile(
    join(Deno.cwd(), "nginx", "html", "500.html"),
  );
  return new Response(html, {
    status: 500,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** Ping Directus /server/health — returns true when core services are healthy.
 *
 * Directus reports overall status as "error" if ANY component fails,
 * including objectstore (file upload permissions). We only care about
 * core service components: datastore, cache, ratelimiter, and email.
 * An objectstore failure does not affect API or page rendering.
 *
 * Returns a descriptive reason string when unhealthy, or null when healthy.
 */
async function checkDirectusHealth(): Promise<string | null> {
  try {
    const res = await fetch("http://localhost:8055/server/health", {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok && res.status !== 503) {
      return `health endpoint returned HTTP ${res.status}`;
    }
    const body = await res.json() as {
      checks?: Record<string, { status: string; componentType: string; output?: unknown }[]>;
    };
    const checks = body.checks ?? {};
    // Fail only if a core component (not objectstore) is unhealthy
    for (const [checkName, entries] of Object.entries(checks)) {
      for (const entry of entries) {
        if (entry.componentType !== "objectstore" && entry.status !== "ok") {
          const detail = entry.output ? ` — ${JSON.stringify(entry.output)}` : "";
          return `${checkName} (${entry.componentType}) is ${entry.status}${detail}`;
        }
      }
    }
    return null;
  } catch (err) {
    return `could not reach Directus: ${err}`;
  }
}

export async function handler(req: Request, ctx: FreshContext) {
  const url = new URL(req.url);

  // Allow login page, static assets, favicon, and internal fresh routes
  if (
    url.pathname === "/login" ||
    url.pathname.startsWith("/static") ||
    url.pathname.startsWith("/_frsh") ||
    url.pathname === "/favicon.ico"
  ) {
    return await ctx.next();
  }

  // Check Directus availability before processing any page request
  const unhealthyReason = await checkDirectusHealth();
  if (unhealthyReason !== null) {
    logger.error(`Directus is offline (${unhealthyReason}) — serving 500 error page`);
    return await directusOfflineResponse();
  }

  const cookies = getCookies(req.headers);
  const token = cookies.auth_token;

  if (token) {
    // Validate token by making a lightweight request to Directus
    try {
      const client = getDirectusClient(token);
      await client.request(readMe());
      // Pass token to state for downstream handlers
      ctx.state.token = token;
    } catch (error) {
      logger.error(`Token validation failed: ${error}`);
      // Clear invalid token but allow request to proceed as anonymous
      const response = await ctx.next();
      response.headers.append(
        "Set-Cookie",
        "auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
      );
      return response;
    }
  }

  return await ctx.next();
}
