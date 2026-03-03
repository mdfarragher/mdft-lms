import { Handlers, PageProps } from "$fresh/server.ts";
import { setCookie } from "$std/http/cookie.ts";
import { getDirectusClient } from "../utils/directus.ts";
import { authentication } from "@directus/sdk";

interface Data {
  error?: string;
}

export const handler: Handlers<Data> = {
  async POST(req, ctx) {
    const form = await req.formData();
    const email = form.get("email")?.toString();
    const password = form.get("password")?.toString();

    if (!email || !password) {
      return ctx.render({ error: "Email and password required" });
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

      return ctx.render({ error: errorMessage });
    }
  },
};

export default function Login({ data }: PageProps<Data>) {
  return (
    <div style="padding: 2rem; max-width: 400px; margin: 0 auto;">
      <h1 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">Login</h1>
      {data?.error && <div style="color: red; margin-bottom: 1rem;">{data.error}</div>}
      <form method="POST">
        <div style="margin-bottom: 1rem;">
          <label style="display: block; margin-bottom: 0.5rem;">Email</label>
          <input type="email" name="email" style="border: 1px solid #ccc; padding: 0.5rem; width: 100%;" required />
        </div>
        <div style="margin-bottom: 1rem;">
          <label style="display: block; margin-bottom: 0.5rem;">Password</label>
          <input type="password" name="password" style="border: 1px solid #ccc; padding: 0.5rem; width: 100%;" required />
        </div>
        <button type="submit" style="background-color: blue; color: white; padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer;">Login</button>
      </form>
    </div>
  );
}
