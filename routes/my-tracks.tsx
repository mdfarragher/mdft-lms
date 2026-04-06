import { Handlers } from "$fresh/server.ts";
import { Eta } from "eta";
import { join } from "$std/path/mod.ts";
import { getDirectusClient } from "../utils/directus.ts";
import { readItems } from "@directus/sdk";
import { log } from "../utils/logger.ts";

const logger = log.getLogger("routes/my-tracks");

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
    let learningGoal: any[] = [];

    try {
      const coursesResult = await client.request(
        // @ts-ignore: Directus SDK typing
        readItems("courses", {
          fields: ["id", "title", "slug"],
          limit: -1,
        })
      );

      if (Array.isArray(coursesResult)) {
        learningGoal = coursesResult.map((course: any, index: number) => {
          const progress = [15, 45, 75, 30, 90, 10][index % 6];
          return {
            id: course.id,
            title: course.title,
            slug: course.slug,
            progress,
          };
        });
      }
    } catch (error) {
      logger.error(`Error fetching courses for learning goal: ${error}`);
    }

    const html = eta.render("my-tracks.eta", {
      title: "My Tracks",
      isAuthenticated: true,
      learningGoal,
    });

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
