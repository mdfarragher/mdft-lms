import { Handlers } from "$fresh/server.ts";
import { getDirectusClient } from "../../utils/directus.ts";
import { readItems } from "@directus/sdk";

export const handler: Handlers = {
  async GET(req, ctx) {
    const url = new URL(req.url);
    const query = url.searchParams.get("q");

    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = ctx.state.token as string;
    const client = getDirectusClient(token);
    const searchResults: any[] = [];

    console.log(`[Search API] Searching for: "${query}"`);

    try {
      // 1. Search Courses
      const coursesPromise = client.request(
        readItems("courses", {
          filter: {
            title: {
              _icontains: query,
            },
          } as any,
          fields: ["id", "title", "slug"],
        }),
      );

      // 2. Search Modules (by Module Title)
      const modulesTitlePromise = client.request(
        readItems("modules", {
          filter: {
            title: {
              _icontains: query,
            },
          } as any,
          fields: ["id", "title", "slug"],
        }),
      );

      // 3. Search Lesson Collections directly
      const videoLessonsPromise = client.request(
        readItems("video_lessons", {
          filter: { title: { _icontains: query } } as any,
          fields: ["id", "title"],
        }),
      );

      const textLessonsPromise = client.request(
        readItems("text_lessons", {
          filter: { title: { _icontains: query } } as any,
          fields: ["id", "title"],
        }),
      );

      const [
        coursesResult,
        modulesTitleResult,
        videoLessonsResult,
        textLessonsResult,
      ] = await Promise.allSettled([
        coursesPromise,
        modulesTitlePromise,
        videoLessonsPromise,
        textLessonsPromise,
      ]);

      // --- Process Courses ---
      if (
        coursesResult.status === "fulfilled" &&
        Array.isArray(coursesResult.value)
      ) {
        coursesResult.value.forEach((c: any) => {
          searchResults.push({
            type: "course",
            title: c.title,
            link: `/course/${c.slug || c.id}`,
          });
        });
      }

      // --- Process Modules (Title match) ---
      if (
        modulesTitleResult.status === "fulfilled" &&
        Array.isArray(modulesTitleResult.value)
      ) {
        modulesTitleResult.value.forEach((m: any) => {
          searchResults.push({
            type: "module",
            title: m.title,
            link: `/mod/${m.slug || m.id}`,
          });
        });
      }

      // --- Process Lessons directly ---
      if (
        videoLessonsResult.status === "fulfilled" &&
        Array.isArray(videoLessonsResult.value)
      ) {
        console.log(`[Search API] Found ${videoLessonsResult.value.length} video lessons matching "${query}"`);
        videoLessonsResult.value.forEach((l: any) =>
          searchResults.push({
            type: "lesson",
            title: l.title,
            link: `/play/lesson/${l.id}`,
          }),
        );
      } else if (videoLessonsResult.status === "rejected") {
        console.error("Video lessons search failed:", videoLessonsResult.reason);
      }

      if (
        textLessonsResult.status === "fulfilled" &&
        Array.isArray(textLessonsResult.value)
      ) {
        console.log(`[Search API] Found ${textLessonsResult.value.length} text lessons matching "${query}"`);
        textLessonsResult.value.forEach((l: any) =>
          searchResults.push({
            type: "lesson",
            title: l.title,
            link: `/play/lesson/${l.id}`,
          }),
        );
      } else if (textLessonsResult.status === "rejected") {
        console.error("Text lessons search failed:", textLessonsResult.reason);
      }

      // Deduplicate results based on link
      const uniqueResults = Array.from(
        new Map(searchResults.map((item) => [item.link, item])).values(),
      );

      return new Response(JSON.stringify(uniqueResults), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {

      console.error("Search API Error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to perform search" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
};
