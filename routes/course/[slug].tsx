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
      // Fetch course by slug with modules
      const courses = (await client.request(
        readItems("courses", {
          filter: {
            slug: {
              _eq: slug,
            },
          } as any,
          limit: 1,
          fields: [
            "*",
            "modules.modules_id.id",
            "modules.modules_id.title",
            "modules.modules_id.slug",
            "certification.id",
            "certification.title",
            "certification.slug",
            "certification.code",
          ],
        }),
      )) as any[];

      if (!courses || courses.length === 0) {
        return ctx.renderNotFound();
      }

      const courseRaw = courses[0];

      // Flatten the M2M structure to a simple list of modules
      const modules =
        courseRaw.modules?.map((m: any) => m.modules_id).filter(Boolean) || [];

      const course = {
        id: courseRaw.id,
        title: courseRaw.title,
        slug: courseRaw.slug,
        status: courseRaw.status,
        date_created: courseRaw.date_created,
        certification: courseRaw.certification,
        description: courseRaw.description ? await marked.parse(courseRaw.description) : null,
        content: courseRaw.content ? await marked.parse(courseRaw.content) : null,
      };

      const html = eta.render("course_detail.eta", {
        course,
        modules,
        title: course.title,
      });

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (e: any) {
      console.error("Fetch Course Error:", e);
      return new Response(`Error fetching course: ${e.message}`, {
        status: 500,
      });
    }
  },
};

