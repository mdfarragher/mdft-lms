import { Handlers } from "$fresh/server.ts";
import { getDirectusClient } from "../../../../utils/directus.ts";
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
  courses?: any[];
  type?: string;
}

export const handler: Handlers = {
  async GET(req, ctx) {
    const { courseSlug, moduleSlug, lessonSlug } = ctx.params;
    const token = ctx.state.token as string | undefined;
    const isAuthenticated = !!token;
    // We use a generic client if no token is present, but usually getDirectusClient handles the null token case gracefully by returning a public client
    const client = getDirectusClient(token);

    try {
      // 1. Fetch Module to get the list of lessons (for sidebar)
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
            "courses.courses_id.slug",
            "lessons.id",
            "lessons.collection",
            "lessons.sort",
            "lessons.item.id",
            "lessons.item.title",
            "lessons.item.slug",
          ],
        }),
      );

      // 2. Fetch Course to determine next module and learning path
       // @ts-ignore: Directus SDK typing issue
       const coursePromise = client.request(
        // @ts-ignore: Directus SDK typing issue
        readItems("courses", {
          filter: { slug: { _eq: courseSlug } },
          limit: 1,
          fields: [
            "id",
            "title",
            "slug",
            "category.slug",
            "modules.modules_id.id",
            "modules.modules_id.slug",
            "modules.modules_id.title",
            "modules.modules_id.type",
          ],
        })
      );

      const [modules, courses] = (await Promise.all([
        modulePromise,
        coursePromise
      ])) as unknown as [Module[], any[]];

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
      const fields = ["*"];

      // @ts-ignore: Directus SDK typing issue
      const lesson = (await client.request(
        // @ts-ignore: Directus SDK typing issue
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
          link: `/play/${courseSlug}/${module.slug || module.id}/${item.slug || item.id}`,
          type,
          isActive
        };
      });

      const currentIndex = sidebarLessons.findIndex((l) => l.isActive);
      
      // Calculate progress percentage based on current lesson index (1-based for display logic)
      const progress = sidebarLessons.length > 0 
        ? Math.round(((currentIndex + 1) / sidebarLessons.length) * 100) 
        : 0;

      const prevLesson = currentIndex > 0 ? sidebarLessons[currentIndex - 1] : null;
      let nextLesson = currentIndex < sidebarLessons.length - 1 ? sidebarLessons[currentIndex + 1] : null;

      // Determine prev/next module links for sidebar and next button
      let nextModuleLink = null;
      let prevModuleLink = null;
      let prevModuleRef = null;
      let nextModuleRef = null;
      let course = null;

      if (courses && courses.length > 0) {
        course = courses[0];
        if (course.modules) {
           const courseModules = course.modules.map((m: any) => m.modules_id).filter((m: any) => m);
           const currentModuleIndex = courseModules.findIndex((m: any) => m.slug === moduleSlug || m.id === module.id);
           
           if (currentModuleIndex !== -1) {
               // Next Module Logic
               if (currentModuleIndex < courseModules.length - 1) {
                   nextModuleRef = courseModules[currentModuleIndex + 1];
                   
                   // Fetch next module lessons to find the first one
                   // @ts-ignore: Directus SDK typing issue
                   const nextModules = (await client.request(
                       // @ts-ignore: Directus SDK typing issue
                       readItems("modules", {
                           filter: { id: { _eq: nextModuleRef.id } },
                           limit: 1,
                           fields: [
                               "slug",
                               "lessons.collection",
                               "lessons.sort",
                               "lessons.item.id",
                               "lessons.item.slug",
                               "lessons.item.title"
                           ]
                       })
                   )) as unknown as Module[];

                   if (nextModules && nextModules.length > 0) {
                       const nm = nextModules[0];
                       const nmSortedJunctions = (nm.lessons || [])
                           .filter((j) => j.item && typeof j.item === "object")
                           .sort((a, b) => (a.sort || 0) - (b.sort || 0));
                       
                       if (nmSortedJunctions.length > 0) {
                           const firstLesson = nmSortedJunctions[0].item as { id: string; slug?: string; title: string };
                           nextModuleLink = {
                               title: nextModuleRef.title,
                               link: `/play/${courseSlug}/${nm.slug}/${firstLesson.slug || firstLesson.id}`,
                           };
                           
                           // If we are at the last lesson, this becomes the primary "Next" action
                           if (!nextLesson) {
                               nextLesson = {
                                   id: firstLesson.id,
                                   title: `Next Module: ${firstLesson.title}`,
                                   link: nextModuleLink.link,
                                   type: 'NEXT_MODULE', 
                                   isActive: false
                               };
                           }
                       }
                   }
               }

               // Previous Module Logic
               if (currentModuleIndex > 0) {
                   prevModuleRef = courseModules[currentModuleIndex - 1];
                   
                   // Fetch prev module lessons to find the first one
                   // @ts-ignore: Directus SDK typing issue
                   const prevModules = (await client.request(
                       // @ts-ignore: Directus SDK typing issue
                       readItems("modules", {
                           filter: { id: { _eq: prevModuleRef.id } },
                           limit: 1,
                           fields: [
                               "slug",
                               "lessons.collection",
                               "lessons.sort",
                               "lessons.item.id",
                               "lessons.item.slug",
                               "lessons.item.title"
                           ]
                       })
                   )) as unknown as Module[];

                   if (prevModules && prevModules.length > 0) {
                       const pm = prevModules[0];
                       const pmSortedJunctions = (pm.lessons || [])
                           .filter((j) => j.item && typeof j.item === "object")
                           .sort((a, b) => (a.sort || 0) - (b.sort || 0));
                       
                       if (pmSortedJunctions.length > 0) {
                           const firstLesson = pmSortedJunctions[0].item as { id: string; slug?: string; title: string };
                           prevModuleLink = {
                               title: prevModuleRef.title,
                               link: `/play/${courseSlug}/${pm.slug}/${firstLesson.slug || firstLesson.id}`,
                           };
                       }
                   }
               }
           }
        }
      }

      const html = eta.render("lesson_detail.eta", {
        isAuthenticated,
        module: {
          id: module.id,
          title: module.title,
          slug: module.slug,
          type: module.type, // Added for Learning Path
        },
        courseSlug,
        currentLesson: lesson,
        lessonType,
        lessons: sidebarLessons,
        prevLesson,
        nextLesson,
        course, // Added for Learning Path
        prevModule: prevModuleRef, // Added for Learning Path
        nextModule: nextModuleRef, // Added for Learning Path
        prevModuleLink, // Added for Sidebar
        nextModuleLink, // Added for Sidebar
        title: `${lesson.title} - ${module.title}`,
        progress, // Added for Lesson Detail Progress Bar
        currentIndex: currentIndex + 1, // Added for Lesson Detail Progress Bar (1-based)
        totalLessons: sidebarLessons.length, // Added for Lesson Detail Progress Bar
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

