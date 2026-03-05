import { Handlers } from "$fresh/server.ts";
import { getDirectusClient } from "../../utils/directus.ts";
import { readItems } from "@directus/sdk";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";

const eta = new Eta({ views: join(Deno.cwd(), "templates") });

interface BaseLesson {
  id: string;
  title: string;
  slug?: string;
}

interface ModuleLessonJunction {
  id: string;
  collection: string;
  item: string | BaseLesson;
  sort?: number;
}

interface Module {
  id: string;
  title: string;
  slug: string;
  content?: string;
  lessons: ModuleLessonJunction[];
}

export const handler: Handlers = {
  async GET(req, ctx) {
    const slug = ctx.params.slug;
    const token = ctx.state.token as string;
    const client = getDirectusClient(token);

    try {
      const modules = (await client.request(
        readItems("modules", {
          filter: { slug: { _eq: slug } },
          limit: 1,
          fields: [
            "id",
            "title",
            "slug",
            "content",
            "lessons.id",
            "lessons.collection",
            "lessons.sort",
            "lessons.item.id",
            "lessons.item.title",
            "lessons.item.slug",
          ],
        }),
      )) as unknown as Module[];

      if (!modules || modules.length === 0) {
        return ctx.renderNotFound();
      }

      const module = modules[0];

      // Process lessons for the template
      const lessons = (module.lessons || [])
        .filter((j) => j.item && typeof j.item === "object")
        .sort((a, b) => (a.sort || 0) - (b.sort || 0))
        .map((j) => {
          const item = j.item as BaseLesson;
          const typeLabel = j.collection
            .replace("_lessons", "")
            .toUpperCase();
          
          return {
            ...item,
            typeLabel,
            link: `/play/${module.slug || module.id}/${item.slug || item.id}`
          };
        });

      const html = eta.render("module_detail.eta", {
        module: {
          title: module.title,
          content: module.content,
        },
        lessons,
        title: module.title, // For the layout
      });

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (e: any) {
      console.error("Fetch Module Error:", e);
      return new Response(`Error fetching module: ${e.message}`, {
        status: 500,
      });
    }
  },
};

