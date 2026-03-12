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
          fields: [
            "id",
            "title",
            "slug",
            "modules.modules_id.id",
            "modules.modules_id.title",
            "modules.modules_id.slug",
            "modules.modules_id.type",
            "modules.modules_id.content",
          ],
        }),
      )) as any[];

      // Find the first exam module among the courses
      let examModule = null;
      let examCourseSlug = null;

      if (courses && courses.length > 0) {
        for (const course of courses) {
          if (course.modules && Array.isArray(course.modules)) {
            // Access the actual module object from the junction
            const modules = course.modules.map((m: any) => m.modules_id).filter((m: any) => m != null);
            const exam = modules.find((m: any) => m.type === 'exam');
            if (exam) {
              examModule = exam;
              examCourseSlug = course.slug;
              
              // Parse markdown content for the exam
              if (examModule.content) {
                examModule.content = await marked.parse(examModule.content);
              }
              break; // Stop after finding the first exam
            }
          }
        }
      }

      const html = eta.render("certification_detail.eta", {
        certification,
        courses,
        examModule,
        examCourseSlug,
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
