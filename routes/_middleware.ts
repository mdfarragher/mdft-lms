import { FreshContext } from "$fresh/server.ts";
import { getCookies } from "$std/http/cookie.ts";
import { getDirectusClient } from "../utils/directus.ts";
import { readMe } from "@directus/sdk";

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
      console.error("Token validation failed:", error);
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
