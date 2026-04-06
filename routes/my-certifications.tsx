import { Handlers } from "$fresh/server.ts";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";
import { getDirectusClient } from "../utils/directus.ts";
import { readMe, readItems } from "@directus/sdk";
import { marked } from "../utils/marked.ts";
import { log } from "../utils/logger.ts";

const logger = log.getLogger("routes/my-certifications");

const eta = new Eta({ views: join(Deno.cwd(), "templates") });

export const handler: Handlers = {
  async GET(req, ctx) {
    const token = ctx.state.token as string;
    if (!token) {
      return new Response("", {
        status: 302,
        headers: { Location: "/login" },
      });
    }

    const client = getDirectusClient(token);
    let user;
    let goal: any = {
      title: "No Goal Set",
      progress: 0,
      summary: "Select a certification to start tracking your progress."
    };

    try {
      const userData: any = await client.request(
        readMe({
          fields: [
            "first_name",
            "last_name",
            "avatar",
            "certification_goal.id",
            "certification_goal.title",
            "certification_goal.slug",
            "certification_goal.content_summary",
            "certification_goal.schedule_url"
          ],
        })
      );

      user = userData;

      if (user?.certification_goal) {
        goal.title = user.certification_goal.title;
        goal.slug = user.certification_goal.slug;
        goal.scheduleUrl = user.certification_goal.schedule_url;

        if (user.certification_goal.content_summary) {
          const rawSummary = user.certification_goal.content_summary;
          const htmlSummary = await marked.parse(rawSummary);
          goal.summary = htmlSummary.replace(/<[^>]*>?/gm, '').trim();
        } else {
          goal.summary = "No summary available.";
        }

        goal.progress = 65;

        try {
          const courses = await client.request(
            // @ts-ignore: Directus SDK typing
            readItems("courses", {
              filter: {
                certification: {
                  _eq: user.certification_goal.id
                }
              } as any,
              limit: 1,
              fields: [
                "id",
                "title",
                "slug",
                "modules.modules_id.id",
                "modules.modules_id.title",
                "modules.modules_id.type",
                "modules.modules_id.slug",
                "modules.modules_id.lessons.id"
              ]
            })
          );

          if (Array.isArray(courses) && courses.length > 0) {
            const course = courses[0];
            goal.courseSlug = course.slug;
            goal.courseTitle = course.title;

            // @ts-ignore: Directus SDK typing
            const courseModules = course.modules;
            const modules = courseModules?.map((m: any) => m.modules_id).filter(Boolean) || [];

            let totalLessons = 0;
            let viewedLessons = 0;
            const quizzes: any[] = [];
            const labs: any[] = [];
            let exam: any = null;

            modules.forEach((mod: any) => {
              const lessonCount = Array.isArray(mod.lessons) ? mod.lessons.length : 0;

              if (mod.type === 'quiz') {
                quizzes.push({ title: mod.title, score: 8, total: 10 });
              } else if (mod.type === 'lab') {
                labs.push({ title: mod.title, completed: Math.max(0, lessonCount - 1), total: lessonCount });
              } else if (mod.type === 'exam') {
                exam = { title: mod.title || "Practice Exam", slug: mod.slug || mod.id, score: 75, total: 100, passed: true };
              } else {
                totalLessons += lessonCount;
              }
            });

            viewedLessons = Math.floor(totalLessons * 0.45);
            const lessonPercentage = totalLessons > 0 ? Math.round((viewedLessons / totalLessons) * 100) : 0;

            goal.detailedProgress = {
              lessons: { viewed: viewedLessons, total: totalLessons, percentage: lessonPercentage },
              quizzes,
              labs,
              exam
            };
          }
        } catch (courseError) {
          logger.error(`Error fetching course for certification goal: ${courseError}`);
        }
      }
    } catch (error) {
      logger.error(`Error fetching user profile: ${error}`);
    }

    const html = eta.render("my-certifications.eta", {
      title: "My Certifications",
      isAuthenticated: true,
      user,
      goal,
    });

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
