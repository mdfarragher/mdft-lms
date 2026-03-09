import { Handlers } from "$fresh/server.ts";
import { getDirectusClient } from "../../utils/directus.ts";
import { readItems } from "@directus/sdk";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";
import { marked } from "marked";

// Define custom extension for images with classes
const imageWithClassExtension = {
  name: "imageWithClass",
  level: "inline" as const,
  start(src: string) {
    return src.match(/!\[/)?.index;
  },
  tokenizer(src: string, _tokens: any) {
    const rule = /^!\[(.*?)\]\((.*?)\)\s*\{\s*\.([a-zA-Z0-9_-]+)\s*\}/;
    const match = rule.exec(src);
    if (match) {
      return {
        type: "imageWithClass",
        raw: match[0],
        text: match[1],
        href: match[2],
        className: match[3],
        tokens: [],
      };
    }
  },
  renderer(token: any) {
    return `<img src="${token.href}" alt="${token.text}" class="${token.className}">`;
  },
};

marked.use({ extensions: [imageWithClassExtension] });

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
            "modules.modules_id.type",
            "modules.modules_id.content",
            "modules.modules_id.lessons.id",
            "certification.id",
            "certification.title",
            "certification.slug",
            "certification.code",
            "certification.content",
            "certification.content_exam",
            "preview_lesson.title",
            "preview_lesson.video_url",
            "preview_lesson.content",
            "business_case.title",
            "business_case.slug",
            "business_case.content",
          ],
        }),
      )) as any[];

      if (!courses || courses.length === 0) {
        return ctx.renderNotFound();
      }

      const courseRaw = courses[0];

      // Check for banner image
      let hasBanner = false;
      try {
        await Deno.stat(
          join(Deno.cwd(), "static", "banner", `${courseRaw.slug}.jpg`),
        );
        hasBanner = true;
      } catch {
        // Banner not found
      }

      // Flatten the M2M structure to a simple list of modules
      const modules =
        courseRaw.modules?.map((m: any) => m.modules_id).filter(Boolean) || [];

      // Parse markdown content for exam modules
      for (const module of modules) {
        if (module.type === "exam" && module.content) {
          module.content = await marked.parse(module.content);
        }
      }

      if (courseRaw.certification?.content) {
        courseRaw.certification.content = await marked.parse(
          courseRaw.certification.content,
        );
      }
      if (courseRaw.certification?.content_exam) {
        courseRaw.certification.content_exam = await marked.parse(
          courseRaw.certification.content_exam,
        );
      }

      if (courseRaw.preview_lesson?.content) {
        courseRaw.preview_lesson.content = await marked.parse(
          courseRaw.preview_lesson.content,
        );
      }

      if (courseRaw.business_case?.content) {
        courseRaw.business_case.content = await marked.parse(
          courseRaw.business_case.content,
        );
      }

      // Check for business case banner
      let hasBusinessCaseBanner = false;
      if (courseRaw.business_case?.slug) {
        try {
          await Deno.stat(
            join(
              Deno.cwd(),
              "static",
              "banner",
              `${courseRaw.business_case.slug}.jpg`,
            ),
          );
          hasBusinessCaseBanner = true;
        } catch {
          // Banner not found
        }
      }

      const course = {
        id: courseRaw.id,
        title: courseRaw.title,
        slug: courseRaw.slug,
        status: courseRaw.status,
        date_created: courseRaw.date_created,
        certification: courseRaw.certification,
        preview_lesson: courseRaw.preview_lesson,
        business_case: courseRaw.business_case,
        content: courseRaw.content
          ? await marked.parse(courseRaw.content)
          : null,
        content_setup: courseRaw.content_setup
          ? await marked.parse(courseRaw.content_setup)
          : null,
      };

      // Fetch testimonials
      let testimonials: any[] = [];
      try {
        const allTestimonials = (await client.request(
          readItems("testimonials", {
            limit: 10,
            fields: ["text", "author"],
          }),
        )) as any[];

        if (allTestimonials && allTestimonials.length > 0) {
          testimonials = allTestimonials
            .sort(() => 0.5 - Math.random())
            .slice(0, 2);
        }
      } catch (e) {
        console.error("Error fetching testimonials:", e);
        // Continue without testimonials
      }

      const html = eta.render("course_detail.eta", {
        course,
        modules,
        title: course.title,
        hasBanner,
        hasBusinessCaseBanner,
        testimonials,
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
