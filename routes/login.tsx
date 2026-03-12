import { Handlers } from "$fresh/server.ts";
import { setCookie } from "$std/http/cookie.ts";
import { getDirectusClient } from "../utils/directus.ts";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";

const eta = new Eta({ views: join(Deno.cwd(), "templates") });

export const handler: Handlers = {
  GET(_req, ctx) {
    const html = eta.render("login.eta", {
        title: "Login - MDFT LMS",
        isAuthenticated: false, // Login page is for unauthenticated users
        error: null
    });
    return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
  async POST(req, ctx) {
    const form = await req.formData();
    const email = form.get("email")?.toString();
    const password = form.get("password")?.toString();

    if (!email || !password) {
        const html = eta.render("login.eta", {
            title: "Login - MDFT LMS",
            isAuthenticated: false,
            error: "Email and password required"
        });
        return new Response(html, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
        });
    }

    try {
      // Authenticate with Directus using SDK
      const client = getDirectusClient();
      const result = await client.login(email, password);

      const token = result.access_token;
      
      if (!token) {
         throw new Error("Login failed - No token received");
      }

      // Create response with cookie
      const headers = new Headers();
      setCookie(headers, {
        name: "auth_token",
        value: token,
        path: "/",
        httpOnly: true, // Secure cookie
        maxAge: 3600, // 1 hour
      });
      
      headers.set("Location", "/");
      return new Response(null, {
        status: 303,
        headers,
      });
    } catch (e: any) {
      // Directus SDK usually returns errors with structured info, but often a basic Error object
      // Let's capture the message
      console.error("Login Error:", e);
      let errorMessage = "Login failed";
      
      // Try to parse Directus error
      if (e?.errors?.[0]?.message) {
          errorMessage = e.errors[0].message;
      } else if (e.message) {
          errorMessage = e.message;
      }

      const html = eta.render("login.eta", {
        title: "Login - MDFT LMS",
        isAuthenticated: false,
        error: errorMessage
      });

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  },
};
