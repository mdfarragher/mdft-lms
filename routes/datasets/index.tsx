import { Handlers } from "$fresh/server.ts";
import { getDirectusClient } from "../../utils/directus.ts";
import { readItems } from "@directus/sdk";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";
import { log } from "../../utils/logger.ts";

const logger = log.getLogger("routes/datasets");

const eta = new Eta({ views: join(Deno.cwd(), "templates") });

interface Dataset {
  id: string;
  title: string;
  slug: string;
  description: string;
}

export const handler: Handlers = {
  async GET(req, ctx) {
    const token = ctx.state.token as string;
    const client = getDirectusClient(token);

    try {
      const datasets = (await client.request(
        // @ts-ignore: Directus SDK typing
        readItems("datasets", {
          fields: ["id", "title", "slug", "description"],
        }),
      )) as Dataset[];

      const html = eta.render("datasets.eta", {
        datasets,
        title: "Datasets",
        isAuthenticated: !!token,
      });

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (e: any) {
      logger.error(`Fetch Datasets Error: ${e}`);
      return new Response(`Error fetching datasets: ${e.message}`, {
        status: 500,
      });
    }
  },
};
