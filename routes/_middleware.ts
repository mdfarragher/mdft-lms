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

  if (!token) {
    // Redirect to login
    return new Response("", {
      status: 303,
      headers: { Location: "/login" },
    });
  }

  // Validate token by making a lightweight request to Directus
  try {
    const client = getDirectusClient(token);
    await client.request(readMe());
  } catch (error) {
    console.error("Token validation failed:", error);
    // Redirect to login if token is invalid/expired
    return new Response("", {
      status: 303,
      headers: {
        Location: "/login",
        "Set-Cookie": "auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT", // Clear the invalid cookie
      },
    });
  }

  // Pass token to state for downstream handlers
  ctx.state.token = token;

  return await ctx.next();
}
