import { Handlers } from "$fresh/server.ts";
import { getDirectusClient } from "../../../utils/directus.ts";
import { readItems } from "@directus/sdk";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";
import { marked } from "../../../utils/marked.ts";
import { log } from "../../../utils/logger.ts";

const logger = log.getLogger("routes/course");

const eta = new Eta({ views: join(Deno.cwd(), "templates") });

export const handler: Handlers = {
  async GET(req, ctx) {
    const slug = ctx.params.slug;
    const token = ctx.state.token as string;
    const client = getDirectusClient(token);

    try {
      // Fetch course by slug with modules
      // @ts-ignore: Directus SDK typing issue
      const courses = (await client.request(
        // @ts-ignore: Directus SDK typing issue
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
            "modules.modules_id.dataset.title",
            "modules.modules_id.dataset.slug",
            "modules.modules_id.dataset.description",
            "certification.id",
            "certification.title",
            "certification.slug",
            "certification.code",
            "certification.content",
            "certification.content_summary",
            "certification.content_exam",
            "preview_lesson.id",
            "preview_lesson.title",
            "preview_lesson.video_url",
            "preview_lesson.content",
            "business_case.title",
            "business_case.slug",
            "business_case.content",
            "faq.questions.faq_questions_id.title",
            "faq.questions.faq_questions_id.answer",
            "faq.questions.title",
            "faq.questions.answer",
            "technologies.technologies_id.title",
            "technologies.technologies_id.content",
            "technologies.technologies_id.content_summary",
            "technologies.technologies_id.slug",
          ] as any,
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

      // Flatten the M2M structure to a simple list of technologies
      const technologies =
        courseRaw.technologies
          ?.map((t: any) => t.technologies_id)
          .filter(Boolean) || [];

      // Parse markdown content for exam modules
      for (const module of modules) {
        if (module.type === "exam" && module.content) {
          module.content = await marked.parse(module.content);
        }
      }

      // Parse markdown content for technologies
      for (const technology of technologies) {
        if (technology.content_summary) {
          technology.content_summary = await marked.parse(
            technology.content_summary,
          );
        }
        if (technology.content) {
          technology.content = await marked.parse(technology.content);
        }
      }

      // Process datasets
      const datasetMap = new Map();

      modules.forEach((module: any) => {
        if (module.type === "lab" && module.dataset) {
          // Handle both single object and array cases for safety
          const datasets = Array.isArray(module.dataset)
            ? module.dataset
            : [module.dataset];

          datasets.forEach((ds: any) => {
            if (ds && ds.title) {
              // Create a unique key based on slug or title
              const key = ds.slug || ds.title;
              if (!datasetMap.has(key)) {
                datasetMap.set(key, {
                  title: ds.title,
                  description: ds.description,
                  slug: ds.slug,
                });
              }
            }
          });
        }
      });

      const datasets = Array.from(datasetMap.values());

      if (courseRaw.certification?.content) {
        courseRaw.certification.content = await marked.parse(
          courseRaw.certification.content,
        );
      }
      if (courseRaw.certification?.content_summary) {
        courseRaw.certification.content_summary = await marked.parse(
          courseRaw.certification.content_summary,
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

      // Assume action image always exists at /media/case/{slug}/action.jpg
      const hasBusinessCaseBanner = !!courseRaw.business_case?.slug;

      // Process FAQs
      let faqs: any[] = [];
      if (courseRaw.faq && courseRaw.faq.questions) {
        if (Array.isArray(courseRaw.faq.questions)) {
          // Check if M2M (junction object with faq_questions_id) or O2M (direct object)
          if (
            courseRaw.faq.questions.length > 0 &&
            courseRaw.faq.questions[0].faq_questions_id
          ) {
            faqs = courseRaw.faq.questions
              .map((q: any) => q.faq_questions_id)
              .filter(Boolean);
          } else {
            faqs = courseRaw.faq.questions;
          }
        }

        // Filter out any potential null/undefined entries before processing
        faqs = faqs.filter(Boolean);

        for (const faq of faqs) {
          if (faq.answer) {
            faq.answer = await marked.parse(faq.answer);
          }
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
        faqs,
        technologies,
        datasets,
        description: courseRaw.description
          ? await marked.parse(courseRaw.description)
          : null,
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
          // @ts-ignore: Directus SDK typing issue
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
        logger.error(`Error fetching testimonials: ${e}`);
        // Continue without testimonials
      }

      const html = eta.render("course_detail.eta", {
        course,
        modules,
        title: course.title,
        hasBanner,
        hasBusinessCaseBanner,
        testimonials,
        isAuthenticated: !!token,
      });

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (e: any) {
      logger.error(`Fetch Course Error: ${e}`);
      return new Response(`Error fetching course: ${e.message}`, {
        status: 500,
      });
    }
  },
};
