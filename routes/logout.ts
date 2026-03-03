import { Handlers } from "$fresh/server.ts";
import { deleteCookie } from "$std/http/cookie.ts";

export const handler: Handlers = {
  GET(req) {
    const headers = new Headers();
    deleteCookie(headers, "auth_token", { path: "/" });
    headers.set("Location", "/login");
    return new Response(null, {
      status: 303,
      headers,
    });
  },
};
