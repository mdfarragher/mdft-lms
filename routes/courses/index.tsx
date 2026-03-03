import { Handlers, PageProps } from "$fresh/server.ts";
import { getDirectusClient } from "../../utils/directus.ts";
import { readItems } from "@directus/sdk";

interface Course {
  id: string;
  title: string;
  slug: string;
}

interface Data {
  courses: Course[];
  error?: string;
}

export const handler: Handlers<Data> = {
  async GET(req, ctx) {
    const token = ctx.state.token as string;
    const client = getDirectusClient(token);

    try {
      // Fetch all courses
      // We explicitly request fields to ensure we get what we expect
      const courses = (await client.request(
        readItems("courses", {
          fields: ["id", "title", "slug"],
        }),
      )) as Course[];

      return ctx.render({ courses });
    } catch (e: any) {
      console.error("Fetch Courses Error:", e);

      // DEBUG: If the specific field fetch fails, try to fetch one item with wildcard
      // to see what fields actually exist.
      try {
        console.log(
          "DEBUG: Attempting to fetch raw course item to inspect fields...",
        );
        const rawItems = await client.request(
          readItems("courses", { limit: 1 }),
        );
        if (rawItems && rawItems.length > 0) {
          console.log("DEBUG: Found course fields:", Object.keys(rawItems[0]));
        } else {
          console.log("DEBUG: No courses found to inspect.");
        }
      } catch (debugError) {
        console.error("DEBUG: Failed to inspect course fields:", debugError);
      }

      return ctx.render({
        courses: [],
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
};

export default function Courses({ data }: PageProps<Data>) {
  if (data.error) {
    return (
      <div class="p-4 text-red-500">
        <h1>Error fetching courses</h1>
        <p>{data.error}</p>
      </div>
    );
  }

  return (
    <div class="p-4 max-w-4xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">All Courses</h1>
        <a href="/" class="text-blue-600 hover:underline">
          Back to Dashboard
        </a>
      </div>

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.courses.map((course) => (
          <div
            key={course.id}
            class="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <h2 class="text-xl font-semibold mb-2">{course.title}</h2>
            <a
              href={`/course/${course.slug || course.id}`}
              class="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              View Course
            </a>
          </div>
        ))}
      </div>

      {data.courses.length === 0 && (
        <p class="text-gray-500 italic">No courses found.</p>
      )}
    </div>
  );
}
