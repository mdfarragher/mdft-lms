import { Handlers } from "$fresh/server.ts";
import { getDirectusClient } from "../../utils/directus.ts";
import { readItems } from "@directus/sdk";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";
import { log } from "../../utils/logger.ts";

const logger = log.getLogger("routes/technologies");

const eta = new Eta({ views: join(Deno.cwd(), "templates") });

interface Technology {
  id: string;
  title: string;
  slug: string;
}

export const handler: Handlers = {
  async GET(req, ctx) {
    const token = ctx.state.token as string;
    const client = getDirectusClient(token);

    try {
      const technologies = (await client.request(
        // @ts-ignore: Directus SDK typing
        readItems("technologies", {
          fields: ["id", "title", "slug"],
        }),
      )) as Technology[];

      const html = eta.render("technologies.eta", {
        technologies,
        title: "Technologies",
        isAuthenticated: !!token,
      });

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (e: any) {
      logger.error(`Fetch Technologies Error: ${e}`);
      return new Response(`Error fetching technologies: ${e.message}`, {
        status: 500,
      });
    }
  },
};
