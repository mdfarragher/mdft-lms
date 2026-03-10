import { Handlers } from "$fresh/server.ts";
import { getDirectusClient } from "../utils/directus.ts";
import { readMe, readItems } from "@directus/sdk";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";

const eta = new Eta({ views: join(Deno.cwd(), "templates") });

export const handler: Handlers = {
  async GET(req, ctx) {
    const token = ctx.state.token as string;
    const client = getDirectusClient(token);
    const url = new URL(req.url);
    const query = url.searchParams.get("q");

    try {
      let user = null;
      if (token) {
        try {
            user = await client.request(readMe());
        } catch (e) {
            console.error("Error fetching user:", e);
        }
      }
      
      let results: any[] = [];
      let hasSearched = false;

      if (query && query.trim().length > 0) {
        hasSearched = true;
        // Search logic (moved from api/search.ts)
        const coursesPromise = client.request(
          readItems("courses", {
            filter: { title: { _icontains: query } } as any,
            fields: ["id", "title", "slug"],
          })
        );

        const modulesTitlePromise = client.request(
          readItems("modules", {
            filter: { title: { _icontains: query } } as any,
            fields: ["id", "title", "slug", "type"],
          })
        );

        const videoLessonsPromise = client.request(
          readItems("video_lessons", {
            filter: { title: { _icontains: query } } as any,
            fields: ["id", "title", "slug"],
          })
        );

        const certificationsPromise = client.request(
          readItems("certifications", {
            filter: { title: { _icontains: query } } as any,
            fields: ["id", "title", "slug"],
          })
        );

        const textLessonsPromise = client.request(
          readItems("text_lessons", {
            filter: { title: { _icontains: query } } as any,
            fields: ["id", "title", "slug"],
          })
        );

        const [coursesResult, modulesTitleResult, videoLessonsResult, certificationsResult, textLessonsResult] =
          await Promise.allSettled([
            coursesPromise,
            modulesTitlePromise,
            videoLessonsPromise,
            certificationsPromise,
            textLessonsPromise,
          ]);

        // Process Certifications
        if (certificationsResult.status === "fulfilled" && Array.isArray(certificationsResult.value)) {
          certificationsResult.value.forEach((c: any) => {
            results.push({
              type: "certification",
              title: c.title,
              slug: c.slug,
              link: `/certification/${c.slug || c.id}`,
            });
          });
        }

        // Process Courses
        if (coursesResult.status === "fulfilled" && Array.isArray(coursesResult.value)) {
          coursesResult.value.forEach((c: any) => {
            results.push({
              type: "course",
              title: c.title,
              slug: c.slug,
              link: `/course/${c.slug || c.id}`,
            });
          });
        }

        // Process Modules
        if (modulesTitleResult.status === "fulfilled" && Array.isArray(modulesTitleResult.value)) {
          modulesTitleResult.value.forEach((m: any) => {
            results.push({
              type: "module",
              subtype: m.type,
              title: m.title,
              link: `/mod/${m.slug || m.id}`,
            });
          });
        }

        // Process Lessons
        if (
          videoLessonsResult.status === "fulfilled" &&
          Array.isArray(videoLessonsResult.value) &&
          videoLessonsResult.value.length > 0
        ) {
          const videoLessons = videoLessonsResult.value;
          const lessonIds = videoLessons.map((l: any) => l.id);
          const lessonToModuleIdMap = new Map<string, number>();
          const moduleIdToSlugMap = new Map<number, string>();

          try {
            const relations = await client.request(
              readItems("modules_lessons", {
                filter: {
                  item: { _in: lessonIds },
                  collection: { _eq: "video_lessons" },
                } as any,
                fields: ["item", "modules_id"],
              })
            );

            const moduleIds = new Set<number>();
            if (Array.isArray(relations)) {
              relations.forEach((r: any) => {
                if (r.item && r.modules_id) {
                  lessonToModuleIdMap.set(r.item, r.modules_id);
                  moduleIds.add(r.modules_id);
                }
              });
            }

            if (moduleIds.size > 0) {
              const modules = await client.request(
                readItems("modules", {
                  filter: { id: { _in: Array.from(moduleIds) } } as any,
                  fields: ["id", "slug"],
                })
              );

              if (Array.isArray(modules)) {
                modules.forEach((m: any) => {
                  moduleIdToSlugMap.set(m.id, m.slug);
                });
              }
            }
          } catch (error) {
            console.error("Error fetching module relations:", error);
          }

          videoLessons.forEach((l: any) => {
            const moduleId = lessonToModuleIdMap.get(l.id);
            let moduleIdentifier = null;
            if (moduleId) {
              moduleIdentifier = moduleIdToSlugMap.get(moduleId) || moduleId;
            }
            const lessonIdentifier = l.slug || l.id;
            const link = moduleIdentifier
              ? `/play/${moduleIdentifier}/${lessonIdentifier}`
              : `/play/lesson/${lessonIdentifier}`;

            results.push({
              type: "lesson",
              title: l.title,
              link,
            });
          });
        }
        
        // Process Text Lessons
        if (
          textLessonsResult.status === "fulfilled" &&
          Array.isArray(textLessonsResult.value) &&
          textLessonsResult.value.length > 0
        ) {
          const textLessons = textLessonsResult.value;
          const lessonIds = textLessons.map((l: any) => l.id);
          const lessonToModuleIdMap = new Map<string, number>();
          const moduleIdToSlugMap = new Map<number, string>();

          try {
            const relations = await client.request(
              readItems("modules_lessons", {
                filter: {
                  item: { _in: lessonIds },
                  collection: { _eq: "text_lessons" },
                } as any,
                fields: ["item", "modules_id"],
              })
            );

            const moduleIds = new Set<number>();
            if (Array.isArray(relations)) {
              relations.forEach((r: any) => {
                if (r.item && r.modules_id) {
                  lessonToModuleIdMap.set(r.item, r.modules_id);
                  moduleIds.add(r.modules_id);
                }
              });
            }

            if (moduleIds.size > 0) {
              const modules = await client.request(
                readItems("modules", {
                  filter: { id: { _in: Array.from(moduleIds) } } as any,
                  fields: ["id", "slug"],
                })
              );

              if (Array.isArray(modules)) {
                modules.forEach((m: any) => {
                  moduleIdToSlugMap.set(m.id, m.slug);
                });
              }
            }
          } catch (error) {
            console.error("Error fetching module relations for text lessons:", error);
          }

          textLessons.forEach((l: any) => {
            const moduleId = lessonToModuleIdMap.get(l.id);
            let moduleIdentifier = null;
            if (moduleId) {
              moduleIdentifier = moduleIdToSlugMap.get(moduleId) || moduleId;
            }
            const lessonIdentifier = l.slug || l.id;
            const link = moduleIdentifier
              ? `/play/${moduleIdentifier}/${lessonIdentifier}`
              : `/play/lesson/${lessonIdentifier}`;

            results.push({
              type: "lesson",
              title: l.title,
              link,
            });
          });
        }

        // Deduplicate
        results = Array.from(
          new Map(results.map((item) => [item.link, item])).values()
        );
      }

      const html = eta.render("index.eta", {
        user,
        isAuthenticated: !!token,
        query,
        hasSearched,
        results,
        title: "Search - MDFT LMS",
      });

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (e: any) {
      console.error("Home Page Error:", e);
      return new Response(`Error: ${e.message}`, { status: 500 });
    }
  },
};
