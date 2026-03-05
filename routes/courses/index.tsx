import { Handlers } from "$fresh/server.ts";
import { getDirectusClient } from "../../utils/directus.ts";
import { readItems } from "@directus/sdk";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";

const eta = new Eta({ views: join(Deno.cwd(), "templates") });

interface Course {
  id: string;
  title: string;
  slug: string;
}

export const handler: Handlers = {
  async GET(req, ctx) {
    const token = ctx.state.token as string;
    const client = getDirectusClient(token);

    try {
      // Fetch all courses
      const courses = (await client.request(
        readItems("courses", {
          fields: ["id", "title", "slug"],
        }),
      )) as Course[];

      const html = eta.render("courses.eta", {
        courses,
        title: "All Courses",
      });

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (e: any) {
      console.error("Fetch Courses Error:", e);
      return new Response(`Error fetching courses: ${e.message}`, {
        status: 500,
      });
    }
  },
};

