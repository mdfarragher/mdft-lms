import { Handlers } from "$fresh/server.ts";
import { getDirectusClient } from "../../../utils/directus.ts";
import { readItems, readItem } from "@directus/sdk";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";
import { marked } from "marked";

const eta = new Eta({ views: join(Deno.cwd(), "templates") });

// Interfaces
interface LessonDetail {
  id: string;
  title: string;
  slug?: string;
  // Specific fields based on type
  video_url?: string;
  content?: string;
}

interface ModuleLessonJunction {
  id: string;
  collection: string;
  item:
    | {
        id: string;
        title: string;
        slug?: string;
      }
    | string;
  sort?: number;
}

interface Module {
  id: string;
  title: string;
  slug: string;
  lessons: ModuleLessonJunction[];
}

export const handler: Handlers = {
  async GET(req, ctx) {
    const { moduleSlug, lessonSlug } = ctx.params;
    const token = ctx.state.token as string | undefined;
    const isAuthenticated = !!token;
    // We use a generic client if no token is present, but usually getDirectusClient handles the null token case gracefully by returning a public client
    const client = getDirectusClient(token);

    try {
      // 1. Fetch Module to get the list of lessons (for sidebar)
      const modules = (await client.request(
        readItems("modules", {
          filter: { slug: { _eq: moduleSlug } },
          limit: 1,
          fields: [
            "id",
            "title",
            "slug",
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

      // 2. Find the current lesson in the module list to know its collection type
      const lessonJunction = module.lessons.find((l) => {
        return (
          typeof l.item === "object" &&
          (l.item.slug === lessonSlug || l.item.id === lessonSlug)
        );
      });

      if (!lessonJunction || typeof lessonJunction.item !== "object") {
        return ctx.renderNotFound();
      }

      const collection = lessonJunction.collection;
      const lessonType = collection.replace("_lessons", "").toUpperCase();
      const lessonId = lessonJunction.item.id;

      // 3. Fetch the specific lesson details
      // We explicitly request fields likely to contain content
      const fields = ["*"];
      if (collection === "video_lessons") {
        fields.push("video_url");
      } else if (collection === "text_lessons") {
        fields.push("content");
      }

      const lesson = (await client.request(
        readItem(collection, lessonId, {
          fields: fields,
        }),
      )) as LessonDetail;

      if (lesson.content) {
        lesson.content = await marked.parse(lesson.content);
      }

      // 4. Prepare data for template
      const sortedJunctions = (module.lessons || [])
        .filter((j) => j.item && typeof j.item === "object")
        .sort((a, b) => (a.sort || 0) - (b.sort || 0));

      const sidebarLessons = sortedJunctions.map((j) => {
        const item = j.item as { id: string; title: string; slug?: string };
        const type = j.collection.replace("_lessons", "").toUpperCase();
        const isActive = item.id === lessonId;
        
        return {
          id: item.id,
          title: item.title,
          link: `/play/${module.slug || module.id}/${item.slug || item.id}`,
          type,
          isActive
        };
      });

      const currentIndex = sidebarLessons.findIndex((l) => l.isActive);
      const prevLesson = currentIndex > 0 ? sidebarLessons[currentIndex - 1] : null;
      const nextLesson = currentIndex < sidebarLessons.length - 1 ? sidebarLessons[currentIndex + 1] : null;

      const html = eta.render("lesson_detail.eta", {
        isAuthenticated,
        module: {
          id: module.id,
          title: module.title,
          slug: module.slug,
        },
        currentLesson: lesson,
        lessonType,
        lessons: sidebarLessons,
        prevLesson,
        nextLesson,
        title: `${lesson.title} - ${module.title}`,
      });

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (e: any) {
      console.error("Fetch Lesson Error:", e);
      return new Response(`Error fetching lesson: ${e.message}`, {
        status: 500,
      });
    }
  },
};

