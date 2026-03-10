import { Handlers } from "$fresh/server.ts";
import { getDirectusClient } from "../../utils/directus.ts";
import { readItems } from "@directus/sdk";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";

const eta = new Eta({ views: join(Deno.cwd(), "templates") });

interface Certification {
  id: string;
  title: string;
  slug: string;
  code: string;
}

export const handler: Handlers = {
  async GET(req, ctx) {
    const token = ctx.state.token as string;
    const client = getDirectusClient(token);

    try {
      // Fetch all certifications
      const certifications = (await client.request(
        // @ts-ignore: Collection name type safety
        readItems("certifications", {
          fields: ["id", "title", "slug", "code"],
        }),
      )) as Certification[];

      const html = eta.render("certifications.eta", {
        certifications,
        title: "All Certifications",
        isAuthenticated: !!token,
      });

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (e: any) {
      console.error("Fetch Certifications Error:", e);
      return new Response(`Error fetching certifications: ${e.message}`, {
        status: 500,
      });
    }
  },
};
