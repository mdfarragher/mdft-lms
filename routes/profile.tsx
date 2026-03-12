import { Handlers } from "$fresh/server.ts";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";

const eta = new Eta({ views: join(Deno.cwd(), "templates") });

export const handler: Handlers = {
  GET(req, ctx) {
    const token = ctx.state.token as string;
    if (!token) {
      // Redirect to login if not authenticated
      return new Response("", {
        status: 302,
        headers: { Location: "/login" },
      });
    }

    const html = eta.render("profile.eta", {
      title: "My Profile",
      isAuthenticated: true,
      // You can add more user data here later
      stats: {
        coursesCompleted: 3,
        modulesCompleted: 12,
        lessonsViewed: 45,
        labsCompleted: 5,
        quizzesCompleted: 8,
        examsCompleted: 1,
      },
      goal: {
        title: "Azure AI Fundamentals",
        progress: 65,
      },
    });

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
