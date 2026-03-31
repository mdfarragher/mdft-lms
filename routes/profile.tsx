import { Handlers } from "$fresh/server.ts";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";
import { getDirectusClient } from "../utils/directus.ts";
import { readMe, readItems } from "@directus/sdk";
import { marked } from "../utils/marked.ts";
import { log } from "../utils/logger.ts";

const logger = log.getLogger("routes/profile");

const eta = new Eta({ views: join(Deno.cwd(), "templates") });

export const handler: Handlers = {
  async GET(req, ctx) {
    const token = ctx.state.token as string;
    if (!token) {
      // Redirect to login if not authenticated
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
        // @ts-ignore: dynamic type
        goal.slug = user.certification_goal.slug;
        // @ts-ignore: dynamic type
        goal.scheduleUrl = user.certification_goal.schedule_url;
        
        // Handle summary
        if (user.certification_goal.content_summary) {
            // @ts-ignore: dynamic type
            const rawSummary = user.certification_goal.content_summary;
            const htmlSummary = await marked.parse(rawSummary);
            // Strip HTML to get plain text for the card if needed, or keep html if safe
            // For card description, plain text is usually safer for layout
            goal.summary = htmlSummary.replace(/<[^>]*>?/gm, '').trim();
        } else {
             goal.summary = "No summary available.";
        }
        
        goal.progress = 65; 

        // Fetch the course associated with this certification to build progress details
        try {
            // @ts-ignore: Directus SDK typing
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
                        "modules.modules_id.type",
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

                // 1. Preparation course lessons (standard modules)
                let totalLessons = 0;
                let viewedLessons = 0; // Hardcoded later based on total
                
                // 2. Quiz modules
                const quizzes: any[] = [];
                // 3. Lab modules
                const labs: any[] = [];
                // 4. Exam module
                let exam: any = null;

                // Iterate through modules to categorize and count
                modules.forEach((mod: any) => {
                    // Check if lessons are available
                    // The field requested was "modules.modules_id.lessons.id"
                    // So we expect mod.lessons to be an array of objects with ids or just ids depending on SDK
                    const lessonCount = Array.isArray(mod.lessons) ? mod.lessons.length : 0;

                    if (mod.type === 'quiz') {
                        quizzes.push({
                            title: mod.title,
                            score: 8,
                            total: 10
                        });
                    } else if (mod.type === 'lab') {
                        labs.push({
                            title: mod.title,
                            completed: Math.max(0, lessonCount - 1), // Hardcode: almost done
                            total: lessonCount
                        });
                    } else if (mod.type === 'exam') {
                        exam = {
                            title: mod.title || "Practice Exam",
                            slug: mod.slug || mod.id,
                            score: 75,
                            total: 100,
                            passed: true
                        };
                    } else {
                        // Regular learning module (video/text)
                        totalLessons += lessonCount;
                    }
                });

                // Hardcode viewed lessons for regular content
                viewedLessons = Math.floor(totalLessons * 0.45); // 45% progress
                const lessonPercentage = totalLessons > 0 ? Math.round((viewedLessons / totalLessons) * 100) : 0;

                goal.detailedProgress = {
                    lessons: {
                        viewed: viewedLessons,
                        total: totalLessons,
                        percentage: lessonPercentage
                    },
                    quizzes: quizzes,
                    labs: labs,
                    exam: exam
                };
            }
        } catch (courseError) {
            logger.error(`Error fetching course for certification goal: ${courseError}`);
        }
      }
    } catch (error) {
      logger.error(`Error fetching user profile: ${error}`);
    }

    let learningGoal: any[] = [];
    
    try {
        const coursesResult = await client.request(
            // @ts-ignore: Directus SDK typing
            readItems("courses", {
                fields: ["id", "title", "slug"],
                limit: -1
            })
        );
        
        if (Array.isArray(coursesResult)) {
            learningGoal = coursesResult.map((course: any, index: number) => {
                // Generate a deterministic but random-looking progress based on index
                const progress = [15, 45, 75, 30, 90, 10][index % 6];
                return {
                    id: course.id,
                    title: course.title,
                    slug: course.slug,
                    image: course.image,
                    progress: progress
                };
            });
        }
    } catch (error) {
        logger.error(`Error fetching courses for learning goal: ${error}`);
    }

    const html = eta.render("profile.eta", {
      title: "My Profile",
      isAuthenticated: true,
      user,
      learningGoal,
      // You can add more user data here later
      stats: {
        coursesCompleted: 3,
        modulesCompleted: 12,
        lessonsViewed: 45,
        labsCompleted: 5,
        quizzesCompleted: 8,
        examsCompleted: 1,
      },
      goal: goal,
      history: [
        {
          title: "Introduction to Azure AI",
          date: "Yesterday",
          url: "/course/azure-ai-fundamentals/module-1/lesson-1",
          duration: "10:30"
        },
        {
          title: "Computer Vision Concepts",
          date: "Last Week",
          url: "/course/azure-ai-fundamentals/module-2/lesson-3",
          duration: "15:45"
        },
        {
          title: "Natural Language Processing",
          date: "2 weeks ago",
          url: "/course/azure-ai-fundamentals/module-3/lesson-1",
          duration: "12:10"
        },
        {
          title: "Introduction to Generative AI",
          date: "3 weeks ago",
          url: "/course/azure-ai-fundamentals/module-3/lesson-2",
          duration: "18:20"
        },
        {
          title: "Building LLM Applications",
          date: "Last Month",
          url: "/course/azure-ai-fundamentals/module-3/lesson-3",
          duration: "22:15"
        },
        {
          title: "Responsible AI Principles",
          date: "Last Month",
          url: "/course/azure-ai-fundamentals/module-1/lesson-2",
          duration: "14:40"
        }
      ],
      watchLater: [
        {
          title: "Generative AI Overview",
          watchDate: "Tomorrow",
          url: "/course/azure-ai-fundamentals/module-4/lesson-1",
          duration: "20:00"
        },
        {
          title: "Azure OpenAI Service",
          watchDate: "Next Week",
          url: "/course/azure-ai-fundamentals/module-4/lesson-2",
          duration: "25:30"
        }
      ]
    });

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
