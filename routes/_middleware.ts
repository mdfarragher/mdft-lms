import { FreshContext } from "$fresh/server.ts";
import { getCookies } from "$std/http/cookie.ts";

export async function handler(req: Request, ctx: FreshContext) {
  const url = new URL(req.url);
  
  // Allow login page and static assets and favicon
  if (url.pathname === "/login" || url.pathname.startsWith("/static") || url.pathname === "/favicon.ico") {
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

  // Pass token to state for downstream handlers
  ctx.state.token = token;

  return await ctx.next();
}
