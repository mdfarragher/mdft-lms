import { Handlers } from "$fresh/server.ts";
import { getDirectusClient } from "../../utils/directus.ts";
import { readItems } from "@directus/sdk";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";
import { marked } from "../../utils/marked.ts";
import { log } from "../../utils/logger.ts";

const logger = log.getLogger("routes/tech");

const eta = new Eta({ views: join(Deno.cwd(), "templates") });

export const handler: Handlers = {
  async GET(req, ctx) {
    const slug = ctx.params.slug;
    const token = ctx.state.token as string;
    const client = getDirectusClient(token);

    try {
      const technologies = (await client.request(
        readItems("technologies", {
          filter: {
            slug: {
              _eq: slug,
            },
          } as any,
          limit: 1,
          fields: ["id", "title", "slug", "content", "content_summary", "info_url"],
        }),
      )) as any[];

      if (!technologies || technologies.length === 0) {
        return ctx.renderNotFound();
      }

      const technology = technologies[0];

      // Fetch courses associated with this technology
      const courses = (await client.request(
        readItems("courses", {
          filter: {
            technologies: {
              technologies_id: {
                _eq: technology.id,
              },
            },
          } as any,
          fields: ["id", "title", "slug"],
        }),
      )) as any[];

      if (technology.content_summary) {
        technology.content_summary = await marked.parse(technology.content_summary);
      }
      if (technology.content) {
        technology.content = await marked.parse(technology.content);
      }

      const html = eta.render("technology_detail.eta", {
        technology,
        courses,
        title: technology.title,
        isAuthenticated: !!token,
      });

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (e: any) {
      logger.error(`Fetch Technology Error: ${e}`);
      return new Response(`Error fetching technology: ${e.message}`, {
        status: 500,
      });
    }
  },
};
