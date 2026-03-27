import { Handlers } from "$fresh/server.ts";
import { getDirectusClient } from "../../utils/directus.ts";
import { readItems } from "@directus/sdk";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";
import { marked } from "marked";

const eta = new Eta({ views: join(Deno.cwd(), "templates") });

export const handler: Handlers = {
  async GET(req, ctx) {
    const slug = ctx.params.slug;
    const token = ctx.state.token as string;
    const client = getDirectusClient(token);

    try {
      // 1. Fetch dataset by slug
      const datasets = (await client.request(
        readItems("datasets", {
          filter: {
            slug: {
              _eq: slug,
            },
          } as any,
          limit: 1,
          fields: ["id", "title", "slug", "description", "content"],
        }),
      )) as any[];

      if (!datasets || datasets.length === 0) {
        return ctx.renderNotFound();
      }

      const dataset = datasets[0];

      if (dataset.description) {
        dataset.description = await marked.parse(dataset.description);
      }
      if (dataset.content) {
        dataset.content = await marked.parse(dataset.content);
      }

      // 2. Fetch courses that have modules using this dataset
      // We are looking for courses where:
      // courses -> modules (M2M) -> modules_id -> dataset (M2O or M2M) -> id == dataset.id
      
      const courses = (await client.request(
        readItems("courses", {
          filter: {
            modules: {
              modules_id: {
                dataset: {
                  id: {
                    _eq: dataset.id
                  }
                }
              }
            }
          } as any,
          fields: ["id", "title", "slug"],
        }),
      )) as any[];

      const html = eta.render("dataset_detail.eta", {
        dataset,
        courses,
        title: dataset.title,
        isAuthenticated: !!token,
      });

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (e: any) {
      console.error("Fetch Dataset Error:", e);
      return new Response(`Error fetching dataset: ${e.message}`, {
        status: 500,
      });
    }
  },
};
