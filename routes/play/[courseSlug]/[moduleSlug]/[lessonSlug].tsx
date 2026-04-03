import { Handlers } from "$fresh/server.ts";
import { getDirectusClient } from "../../../../utils/directus.ts";
import { readItems, readItem } from "@directus/sdk";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";
import { marked } from "../../../../utils/marked.ts";
import { log } from "../../../../utils/logger.ts";

const logger = log.getLogger("routes/play");

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
            "modules.modules_id.lessons.item.id",
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
      const fields = collection === "quiz_questions"
        ? ["*", "answers.id", "answers.content", "answers.explanation", "answers.is_correct"]
        : ["*"];

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

      if (collection === "quiz_questions" && Array.isArray((lesson as any).answers)) {
        for (const answer of (lesson as any).answers) {
          if (answer.content) {
            answer.content = await marked.parse(answer.content);
          }
          if (answer.explanation) {
            answer.explanation = await marked.parseInline(answer.explanation);
          }
        }
        // Shuffle answers (Fisher-Yates)
        const answers = (lesson as any).answers;
        for (let i = answers.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [answers[i], answers[j]] = [answers[j], answers[i]];
        }
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

      // Calculate progress as position within the entire course (not just this module)
      let progress = 0;
      if (courses && courses.length > 0) {
        const courseModulesList = (courses[0].modules || [])
          .map((m: any) => m.modules_id)
          .filter((m: any) => m);
        const currentModuleIdx = courseModulesList.findIndex(
          (m: any) => m.slug === moduleSlug || m.id === module.id
        );
        const totalCourseLessons = courseModulesList.reduce(
          (sum: number, m: any) => sum + (m.lessons?.length ?? 0), 0
        );
        const lessonsBeforeThisModule = currentModuleIdx > 0
          ? courseModulesList.slice(0, currentModuleIdx).reduce(
              (sum: number, m: any) => sum + (m.lessons?.length ?? 0), 0
            )
          : 0;
        progress = totalCourseLessons > 0
          ? Math.round(((lessonsBeforeThisModule + currentIndex + 1) / totalCourseLessons) * 100)
          : 0;
      }

      let prevLesson = currentIndex > 0 ? sidebarLessons[currentIndex - 1] : null;
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
                        }

                        // If we are at the last lesson, go to the next module detail page
                        if (!nextLesson) {
                            nextLesson = {
                                id: nextModuleRef.id,
                                title: `Next Module: ${nextModuleRef.title}`,
                                link: `/course/${courseSlug}/${nm.slug}`,
                                type: 'NEXT_MODULE',
                                isActive: false
                            };
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

               // If at the first lesson of any module, always show the Overview button
               if (!prevLesson) {
                   prevLesson = {
                       id: module.id,
                       title: module.title,
                       link: `/course/${courseSlug}/${moduleSlug}`,
                       type: 'PREV_MODULE',
                       isActive: false
                   };
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
      logger.error(`Fetch Lesson Error: ${e}`);
      return new Response(`Error fetching lesson: ${e.message}`, {
        status: 500,
      });
    }
  },
};

