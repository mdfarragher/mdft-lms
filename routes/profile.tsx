import { Handlers } from "$fresh/server.ts";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";
import { getDirectusClient } from "../utils/directus.ts";
import { readMe } from "@directus/sdk";
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

    try {
      const userData: any = await client.request(
        readMe({
          fields: [
            "first_name",
            "last_name",
            "avatar",
          ],
        })
      );

      user = userData;
    } catch (error) {
      logger.error(`Error fetching user profile: ${error}`);
    }

    const html = eta.render("profile.eta", {
      title: "My Profile",
      isAuthenticated: true,
      user,
      // You can add more user data here later
      stats: {
        coursesCompleted: 3,
        modulesCompleted: 12,
        lessonsViewed: 45,
        labsCompleted: 5,
        quizzesCompleted: 8,
        examsCompleted: 1,
      },
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
