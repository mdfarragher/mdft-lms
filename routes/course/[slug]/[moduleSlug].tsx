import { Handlers } from "$fresh/server.ts";
import { getDirectusClient } from "../../../utils/directus.ts";
import { readItems } from "@directus/sdk";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";
import { marked } from "marked";

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
  type?: string;
  content?: string;
  lessons: ModuleLessonJunction[];
  certifications?: any[];
}

export const handler: Handlers = {
  async GET(req, ctx) {
    const courseSlug = ctx.params.slug;
    const moduleSlug = ctx.params.moduleSlug;
    const token = ctx.state.token as string;
    const client = getDirectusClient(token);

    try {
      // @ts-ignore: Directus SDK typing issue
      const modulePromise = client.request(
        // @ts-ignore: Directus SDK typing issue
        readItems("modules", {
          filter: { slug: { _eq: moduleSlug } },
          limit: 1,
          fields: [
            "id",
            "title",
            "slug",
            "type",
            "content",
            "lessons.id",
            "lessons.collection",
            "lessons.sort",
            "lessons.item.id",
            "lessons.item.title",
            "lessons.item.slug",
            "certifications.certifications_id.id",
            "certifications.certifications_id.title",
            "certifications.certifications_id.slug",
            "certifications.certifications_id.code",
          ],
        }),
      );

      // @ts-ignore: Directus SDK typing issue
      const coursePromise = client.request(
        // @ts-ignore: Directus SDK typing issue
        readItems("courses", {
          filter: { slug: { _eq: courseSlug } },
          limit: 1,
          fields: [
            "title",
            "slug",
            "category",
            "category.slug",
            "certification.title",
            "certification.slug",
            "modules.modules_id.slug",
            "modules.modules_id.title",
          ],
        }),
      );

      const [modules, courses] = (await Promise.all([
        modulePromise,
        coursePromise,
      ])) as unknown as [Module[], any[]];

      if (!modules || modules.length === 0) {
        return ctx.renderNotFound();
      }

      const module = modules[0];
      const course = courses && courses.length > 0 ? courses[0] : null;

      // Calculate prev/next
      let prevModule = null;
      let nextModule = null;

      if (course && course.modules) {
        const courseModules = course.modules
          .map((m: any) => m.modules_id)
          .filter((m: any) => m);
        const currentIndex = courseModules.findIndex(
          (m: any) => m.slug === moduleSlug,
        );

        if (currentIndex !== -1) {
          if (currentIndex > 0) {
            prevModule = courseModules[currentIndex - 1];
          }
          if (currentIndex < courseModules.length - 1) {
            nextModule = courseModules[currentIndex + 1];
          }
        }
      }

      if (module.content) {
        module.content = await marked.parse(module.content);
      }

      // Process certifications
      // @ts-ignore: Complex M2M structure
      const certifications = (module.certifications || [])
        .map((c: any) => c.certifications_id)
        .filter((c: any) => c);

      // Process lessons for the template
      const lessons = (module.lessons || [])
        .filter((j) => j.item && typeof j.item === "object")
        .sort((a, b) => (a.sort || 0) - (b.sort || 0))
        .map((j) => {
          const item = j.item as BaseLesson;
          const typeLabel = j.collection.replace("_lessons", "").toUpperCase();

          return {
            ...item,
            typeLabel,
            link: `/play/${module.slug || module.id}/${item.slug || item.id}`,
          };
        });

      const html = eta.render("module_detail.eta", {
        module: {
          title: module.title,
          content: module.content,
          type: module.type,
        },
        lessons,
        certifications,
        title: module.title, // For the layout
        isAuthenticated: !!token,
        course: course
          ? {
              title: course.title,
              slug: course.slug,
              category: course.category,
              certification: course.certification,
            }
          : null,
        prevModule,
        nextModule,
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
