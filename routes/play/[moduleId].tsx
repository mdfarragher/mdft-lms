import { Handlers, PageProps } from "$fresh/server.ts";
import { getDirectusClient } from "../../utils/directus.ts";
import { readItem } from "@directus/sdk";

// Interfaces for different lesson types
interface BaseLesson {
  id: string;
  title: string;
  slug?: string;
}

// Junction table interface (Many-to-Any)
// In a Many-to-Any setup, the parent item (Module) has a field (e.g., 'lessons')
// which is a list of junction objects.
// Each junction object has:
// - id: unique ID of the junction row
// - collection: the name of the related collection (e.g., 'video_lessons')
// - item: the ID of the related item OR the expanded object itself if queried with 'item.*'
interface ModuleLessonJunction {
  id: string;
  collection: string;
  item: string | BaseLesson;
}

interface Module {
  id: string;
  title: string;
  // This field name 'lessons' must match the field name in Directus on the 'modules' collection.
  // If it's a Many-to-Any field, it will return an array of junctions.
  lessons: ModuleLessonJunction[];
}

interface Data {
  module: Module | null;
  error?: string;
}

export const handler: Handlers<Data> = {
  async GET(req, ctx) {
    const moduleId = ctx.params.moduleId;
    const token = ctx.state.token as string;
    const client = getDirectusClient(token);

    try {
      // Fetch module by ID.
      // We need to carefully construct the fields query for Many-to-Any.
      // 'lessons' is the field on 'modules'.
      // 'lessons.item' is the link to the actual lesson (video/text/lab).
      // 'lessons.collection' tells us which type it is.
      // We use a wildcard on 'item' (lessons.item.*) to fetch fields from the related collection.
      const module = (await client.request(
        readItem("modules", moduleId, {
          fields: [
            "id",
            "title",
            "lessons.id",
            "lessons.collection",
            // Directus REST API allows polymorphic expansion like this:
            // fetch any field from the related item regardless of collection type
            "lessons.item.id",
            "lessons.item.title",
            "lessons.item.slug",
          ],
        }),
      )) as Module;

      return ctx.render({ module });
    } catch (e: any) {
      console.error("Fetch Module Error:", e);
      return ctx.render({
        module: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
};

export default function ModulePlay({ data }: PageProps<Data>) {
  if (data.error) {
    return (
      <div class="p-4 text-red-500">
        <h1>Error fetching module</h1>
        <p>{data.error}</p>
        <a href="/courses" class="underline">
          Back to Courses
        </a>
      </div>
    );
  }

  if (!data.module) {
    return <div>Module not found</div>;
  }

  const { module } = data;

  // Directus usually returns M2A items in the order defined by the sort field in the junction table.
  // We filter out any where 'item' failed to resolve (is null or string ID only).
  const lessons = (module.lessons || []).filter(
    (j) => j.item && typeof j.item === "object",
  );

  return (
    <div class="p-4 max-w-4xl mx-auto">
      <div class="mb-6">
        <a
          href="/courses"
          class="text-blue-600 hover:underline flex items-center gap-2"
        >
          &larr; Back to Courses
        </a>
      </div>

      <div class="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
        <div class="p-8">
          <h1 class="text-3xl font-bold text-gray-900 mb-4">{module.title}</h1>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-lg overflow-hidden">
        <div class="p-6 border-b">
          <h2 class="text-2xl font-bold text-gray-900">Lessons</h2>
        </div>
        <div class="p-6">
          {lessons.length > 0 ? (
            <div class="space-y-4">
              {lessons.map((junction) => {
                const lesson = junction.item as BaseLesson;
                // Clean up collection name for display (e.g. "video_lessons" -> "VIDEO")
                const typeLabel = junction.collection
                  .replace("_lessons", "")
                  .toUpperCase();

                return (
                  <div
                    key={junction.id}
                    class="border rounded p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50 transition-colors gap-4"
                  >
                    <div>
                      <div class="flex items-center gap-3 mb-1">
                        <h3 class="text-lg font-semibold text-gray-900">
                          <a
                            href={`/play/${module.id}/${lesson.id}`}
                            class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                          >
                            {lesson.title}
                          </a>
                        </h3>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p class="text-gray-500 italic">No lessons found in this module.</p>
          )}
        </div>
      </div>
    </div>
  );
}
