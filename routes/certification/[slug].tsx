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
      // 1. Fetch certification by slug (or ID)
      const certifications = (await client.request(
        // @ts-ignore: Collection name type safety
        readItems("certifications", {
          filter: {
            slug: { _eq: slug }
          } as any,
          limit: 1,
          fields: ["*"], // Fetch all fields to get content/description
        }),
      )) as any[];

      if (!certifications || certifications.length === 0) {
        return new Response("Certification not found", { status: 404 });
      }

      const certification = certifications[0];
      
      // Parse markdown content
      if (certification.description) {
        certification.description = await marked.parse(certification.description);
      }
      if (certification.content) {
        certification.content = await marked.parse(certification.content);
      }
      if (certification.content_exam) {
        certification.content_exam = await marked.parse(certification.content_exam);
      }

      // 2. Fetch courses associated with this certification
      const courses = (await client.request(
        // @ts-ignore: Collection name type safety
        readItems("courses", {
          filter: {
            certification: {
              _eq: certification.id,
            },
          } as any,
          fields: ["id", "title", "slug"],
        }),
      )) as any[];

      const html = eta.render("certification_detail.eta", {
        certification,
        courses,
        title: certification.title,
      });

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (e: any) {
      console.error("Fetch Certification Error:", e);
      return new Response(`Error fetching certification: ${e.message}`, {
        status: 500,
      });
    }
  },
};
