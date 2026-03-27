import { Handlers } from "$fresh/server.ts";
import { getCookies } from "$std/http/cookie.ts";
import { getDirectusClient } from "../../utils/directus.ts";
import { readMe, readItem } from "@directus/sdk";

// UUID validation helper
function isValidUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export const handler: Handlers = {
  async GET(req) {
    // 1. Read the video lesson ID from the header nginx forwards
    const videoId = req.headers.get("x-video-id");
    if (!videoId || !isValidUUID(videoId)) {
      return new Response(null, { status: 400 });
    }

    try {
      // 2. Fetch the lesson using a public client — no token needed yet.
      //    This lets us check is_preview before requiring authentication.
      const publicClient = getDirectusClient();
      // @ts-ignore: Directus SDK typing
      const lesson = await publicClient.request(readItem("video_lessons", videoId, {
        fields: ["id", "video_url", "is_preview"],
      })) as { id: string; video_url: string; is_preview: boolean } | null;

      if (!lesson || !lesson.video_url) {
        return new Response(null, { status: 404 });
      }

      // 3. If the lesson is not a free preview, validate the auth_token cookie.
      if (!lesson.is_preview) {
        const cookies = getCookies(req.headers);
        const token = cookies.auth_token;
        if (!token) {
          return new Response(null, { status: 401 });
        }

        // Validate the token against Directus (same pattern as _middleware.ts)
        const client = getDirectusClient(token);
        await client.request(readMe());
      }

      // 4. Derive filename from video_url (e.g. "foo.mp4" or "/video/foo.mp4" → "foo.mp4")
      const filename = lesson.video_url.split("/").pop() ?? lesson.video_url;

      // 5. Return the filename in response headers for nginx to consume.
      //    nginx aliases /var/videos/$video_path, so X-Video-Path is the filename.
      //    X-Video-Filename is used by nginx as the download name.
      return new Response(null, {
        status: 200,
        headers: {
          "X-Video-Path": filename,
          "X-Video-Filename": filename,
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return new Response(null, { status: 401 });
    }
  },
};
