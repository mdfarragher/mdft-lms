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
          readItems("courses" as any, {
            filter: { title: { _icontains: query } } as any,
            fields: ["id", "title", "slug"],
          })
        );

        const modulesTitlePromise = client.request(
          readItems("modules" as any, {
            filter: { title: { _icontains: query } } as any,
            fields: ["id", "title", "slug", "type"],
          })
        );

        const videoLessonsPromise = client.request(
          readItems("video_lessons" as any, {
            filter: { title: { _icontains: query } } as any,
            fields: ["id", "title", "slug"],
          })
        );

        const certificationsPromise = client.request(
          readItems("certifications" as any, {
            filter: { title: { _icontains: query } } as any,
            fields: ["id", "title", "slug"],
          })
        );

        const textLessonsPromise = client.request(
          readItems("text_lessons" as any, {
            filter: { title: { _icontains: query } } as any,
            fields: ["id", "title", "slug"],
          })
        );

        const technologiesPromise = client.request(
          readItems("technologies" as any, {
            filter: { title: { _icontains: query } } as any,
            fields: ["id", "title", "slug"],
          })
        );

        const datasetsPromise = client.request(
          readItems("datasets" as any, {
            filter: { title: { _icontains: query } } as any,
            fields: ["id", "title", "slug"],
          })
        );

        const [coursesResult, modulesTitleResult, videoLessonsResult, certificationsResult, textLessonsResult, technologiesResult, datasetsResult] =
          await Promise.allSettled([
            coursesPromise,
            modulesTitlePromise,
            videoLessonsPromise,
            certificationsPromise,
            textLessonsPromise,
            technologiesPromise,
            datasetsPromise,
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
          const modules = modulesTitleResult.value;
          const moduleIds = modules.map((m: any) => m.id);
          const moduleIdToCourseSlugMap = new Map<number, string>();

          if (moduleIds.length > 0) {
            try {
              // Fetch courses related to these modules
              // We use the junction table directly if possible, or filter courses
              // Assuming courses_modules junction table based on naming conventions
              // But let's try a safer filter on courses
              const courses = await client.request(
                // @ts-ignore: Directus SDK typing issue
                readItems("courses" as any, {
                  // Filter courses that contain any of the found modules
                  filter: {
                    modules: {
                      modules_id: {
                        id: { _in: moduleIds }
                      }
                    }
                  } as any,
                  // We need the course slug and the module IDs associated with it
                  // We only care about the modules we found
                  fields: ["slug", "modules.modules_id.id"],
                })
              );

              if (Array.isArray(courses)) {
                courses.forEach((c: any) => {
                  if (c.slug && Array.isArray(c.modules)) {
                    c.modules.forEach((junction: any) => {
                      if (junction.modules_id && junction.modules_id.id) {
                         const modId = junction.modules_id.id;
                         moduleIdToCourseSlugMap.set(modId, c.slug);
                      }
                    });
                  }
                });
              }
            } catch (error) {
              console.error("Error fetching course relations for modules:", error);
            }
          }

          modules.forEach((m: any) => {
            const courseSlug = moduleIdToCourseSlugMap.get(m.id);
            // Only show module if we can link it properly
            if (courseSlug) {
              results.push({
                type: "module",
                subtype: m.type,
                title: m.title,
                link: `/course/${courseSlug}/${m.slug || m.id}`,
              });
            }
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
          const moduleIdToCourseSlugMap = new Map<number, string>();

            try {
              // Updated logic to fetch module lesson relationships using Scoped Filters for M2A
              
              // 1. Fetch modules containing these lessons
              const modules = await client.request(
                readItems("modules" as any, {
                  filter: {
                    lessons: {
                      "item:video_lessons": {
                        id: { _in: lessonIds }
                      }
                    }
                  } as any,
                  fields: [
                    "id", 
                    "slug", 
                    "lessons.item", 
                    "lessons.collection"
                  ]
                })
              );
              
              const foundModuleIds = new Set<number>();
  
              if (Array.isArray(modules)) {
                modules.forEach((m: any) => {
                   if (m.lessons && Array.isArray(m.lessons)) {
                     m.lessons.forEach((l: any) => {
                       // Check if this lesson is one of the video lessons we found
                       if (l.collection === 'video_lessons' && l.item) {
                         const itemId = (typeof l.item === 'object' && l.item !== null) ? l.item.id : l.item;
                         
                         // Store mapping if it's one of our searched lessons
                         if (lessonIds.includes(itemId)) {
                             if (!lessonToModuleIdMap.has(itemId)) {
                                lessonToModuleIdMap.set(itemId, m.id);
                                moduleIdToSlugMap.set(m.id, m.slug);
                                foundModuleIds.add(m.id);
                             }
                         }
                       }
                     });
                   }
                });
              }

              // 2. Fetch courses containing these modules (separate query to avoid deep nesting issues)
              if (foundModuleIds.size > 0) {
                  const courses = await client.request(
                    readItems("courses" as any, {
                      filter: {
                        modules: {
                          modules_id: {
                            id: { _in: Array.from(foundModuleIds) }
                          }
                        }
                      } as any,
                      fields: ["slug", "modules.modules_id.id"]
                    })
                  );

                  if (Array.isArray(courses)) {
                    courses.forEach((c: any) => {
                      if (c.slug && Array.isArray(c.modules)) {
                        c.modules.forEach((junction: any) => {
                          if (junction.modules_id && junction.modules_id.id) {
                             const modId = junction.modules_id.id;
                             if (foundModuleIds.has(modId)) {
                                moduleIdToCourseSlugMap.set(modId, c.slug);
                             }
                          }
                        });
                      }
                    });
                  }
              }

            } catch (error) {
              console.error("Error fetching module relations for video lessons:", error);
            }


          videoLessons.forEach((l: any) => {
            const moduleId = lessonToModuleIdMap.get(l.id);
            let moduleIdentifier: string | number | null = null;
            let courseIdentifier: string | null = null;
            
            if (moduleId) {
              moduleIdentifier = moduleIdToSlugMap.get(moduleId) || moduleId;
              courseIdentifier = moduleIdToCourseSlugMap.get(moduleId) || null;
            }
            
            const lessonIdentifier = l.slug || l.id;
            // Ensure we have all parts of the path
            const link = (moduleIdentifier && courseIdentifier)
              ? `/play/${courseIdentifier}/${moduleIdentifier}/${lessonIdentifier}`
              : `#`;

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
          const moduleIdToCourseSlugMap = new Map<number, string>();

          try {
             // 1. Fetch modules containing these text lessons
             const modules = await client.request(
              readItems("modules" as any, {
                filter: {
                  lessons: {
                    "item:text_lessons": {
                      id: { _in: lessonIds }
                    }
                  }
                } as any,
                fields: [
                  "id", 
                  "slug", 
                  "lessons.item", 
                  "lessons.collection"
                ]
              })
            );

            const foundModuleIds = new Set<number>();

            if (Array.isArray(modules)) {
              modules.forEach((m: any) => {
                 if (m.lessons && Array.isArray(m.lessons)) {
                   m.lessons.forEach((l: any) => {
                     if (l.collection === 'text_lessons' && l.item) {
                       const itemId = (typeof l.item === 'object' && l.item !== null) ? l.item.id : l.item;
                       
                       if (lessonIds.includes(itemId)) {
                           if (!lessonToModuleIdMap.has(itemId)) {
                              lessonToModuleIdMap.set(itemId, m.id);
                              moduleIdToSlugMap.set(m.id, m.slug);
                              foundModuleIds.add(m.id);
                           }
                       }
                     }
                   });
                 }
              });
            }

            // 2. Fetch courses containing these modules
            if (foundModuleIds.size > 0) {
              const courses = await client.request(
                readItems("courses" as any, {
                  filter: {
                    modules: {
                      modules_id: {
                        id: { _in: Array.from(foundModuleIds) }
                      }
                    }
                  } as any,
                  fields: ["slug", "modules.modules_id.id"]
                })
              );

              if (Array.isArray(courses)) {
                courses.forEach((c: any) => {
                  if (c.slug && Array.isArray(c.modules)) {
                    c.modules.forEach((junction: any) => {
                      if (junction.modules_id && junction.modules_id.id) {
                         const modId = junction.modules_id.id;
                         if (foundModuleIds.has(modId)) {
                            moduleIdToCourseSlugMap.set(modId, c.slug);
                         }
                      }
                    });
                  }
                });
              }
            }

          } catch (error) {
            console.error("Error fetching module relations for text lessons:", error);
          }

          textLessons.forEach((l: any) => {
            const moduleId = lessonToModuleIdMap.get(l.id);
            let moduleIdentifier: string | number | null = null;
            let courseIdentifier: string | null = null;
            
            if (moduleId) {
              moduleIdentifier = moduleIdToSlugMap.get(moduleId) || moduleId;
              courseIdentifier = moduleIdToCourseSlugMap.get(moduleId) || null;
            }
            
            const lessonIdentifier = l.slug || l.id;
            const link = (moduleIdentifier && courseIdentifier)
              ? `/play/${courseIdentifier}/${moduleIdentifier}/${lessonIdentifier}`
              : `#`;
            
            results.push({
              type: "lesson",
              title: l.title,
              link,
            });
          });
        }

        // Process Technologies
        if (technologiesResult.status === "fulfilled" && Array.isArray(technologiesResult.value)) {
          technologiesResult.value.forEach((t: any) => {
            results.push({
              type: "technology",
              title: t.title,
              slug: t.slug,
              link: `/tech/${t.slug || t.id}`,
            });
          });
        }

        // Process Datasets
        if (datasetsResult.status === "fulfilled" && Array.isArray(datasetsResult.value)) {
          datasetsResult.value.forEach((d: any) => {
            results.push({
              type: "dataset",
              title: d.title,
              slug: d.slug,
              link: `/dataset/${d.slug || d.id}`,
            });
          });
        }

        // Deduplicate
        results = Array.from(
          new Map(results.map((item) => [item.link, item])).values()
        );

        // Sort alphabetically by title
        results.sort((a, b) => a.title.localeCompare(b.title));
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
