import { Handlers, PageProps } from "$fresh/server.ts";
import { getDirectusClient } from "../../../utils/directus.ts";
import { readItems, readItem } from "@directus/sdk";

// Interfaces
interface LessonDetail {
  id: string;
  title: string;
  slug?: string;
  // Specific fields based on type
  video_url?: string;
}

interface ModuleLessonJunction {
  id: string;
  collection: string;
  item:
    | {
        id: string;
        title: string;
        slug?: string;
      }
    | string;
}

interface Module {
  id: string;
  title: string;
  slug: string;
  lessons: ModuleLessonJunction[];
}

interface Data {
  module: Module | null;
  currentLesson: LessonDetail | null;
  lessonType: string | null;
  error?: string;
}

export const handler: Handlers<Data> = {
  async GET(req, ctx) {
    const { moduleSlug, lessonSlug } = ctx.params;
    const token = ctx.state.token as string;
    const client = getDirectusClient(token);

    try {
      // 1. Fetch Module to get the list of lessons (for sidebar)
      const modules = (await client.request(
        readItems("modules", {
          filter: { slug: { _eq: moduleSlug } },
          limit: 1,
          fields: [
            "id",
            "title",
            "slug",
            "lessons.id",
            "lessons.collection",
            "lessons.item.id",
            "lessons.item.title",
            "lessons.item.slug",
          ],
        }),
      )) as Module[];

      if (!modules || modules.length === 0) {
        return ctx.renderNotFound();
      }

      const module = modules[0];

      // 2. Find the current lesson in the module list to know its collection type
      const lessonJunction = module.lessons.find((l) => {
        return typeof l.item === "object" && (l.item.slug === lessonSlug || l.item.id === lessonSlug);
      });

      if (!lessonJunction || typeof lessonJunction.item !== 'object') {
        return ctx.renderNotFound();
      }

      const collection = lessonJunction.collection;
      const lessonType = collection.replace("_lessons", "").toUpperCase();
      const lessonId = lessonJunction.item.id;

      // 3. Fetch the specific lesson details
      // We explicitly request fields likely to contain content
      const lesson = (await client.request(
        readItem(collection, lessonId, {
          fields: ["*", "video_url"],
        }),
      )) as LessonDetail;

      return ctx.render({ module, currentLesson: lesson, lessonType });
    } catch (e: any) {
      console.error("Fetch Lesson Error:", e);
      return ctx.render({
        module: null,
        currentLesson: null,
        lessonType: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
};

export default function LessonPage({ data }: PageProps<Data>) {
  if (data.error) {
    return (
      <div class="p-4 text-red-500">
        <h1>Error fetching lesson</h1>
        <p>{data.error}</p>
        <button onClick={() => history.back()} class="underline">
          Go Back
        </button>
      </div>
    );
  }

  if (!data.module || !data.currentLesson) {
    return <div>Lesson not found</div>;
  }

  const { module, currentLesson, lessonType } = data;

  // Filter valid lessons for sidebar
  const sidebarLessons = (module.lessons || []).filter(
    (j) => j.item && typeof j.item === "object",
  );

  return (
    <div class="flex flex-col md:flex-row min-h-screen bg-gray-50">
      {/* Main Content Area (Lesson Details) */}
      <div class="flex-1 p-6 md:p-8 order-2 md:order-1">
        <div class="bg-white rounded-lg shadow-lg overflow-hidden min-h-[500px]">
          <div class="p-6 border-b flex justify-between items-center">
            <div>
              <span
                class={`text-xs font-bold px-2 py-1 rounded text-white mr-2 ${
                  lessonType === "VIDEO"
                    ? "bg-red-500"
                    : lessonType === "LAB"
                      ? "bg-green-600"
                      : "bg-blue-500"
                }`}
              >
                {lessonType}
              </span>
              <h1 class="text-2xl font-bold text-gray-900 inline align-middle">
                {currentLesson.title}
              </h1>
            </div>
          </div>

          <div class="p-6">
            {/* VIDEO LESSON RENDERER */}
            {lessonType === "VIDEO" && currentLesson.video_url && (
              <div class="aspect-w-16 aspect-h-9 mb-6 bg-black rounded-lg overflow-hidden">
                {currentLesson.video_url}
              </div>
            )}
            {lessonType === "VIDEO" && !currentLesson.video_url && (
              <div class="p-4 bg-yellow-100 text-yellow-800 rounded mb-4">
                Video URL not found.
              </div>
            )}

            {/* CONTENT / INSTRUCTIONS RENDERER */}
            <div class="prose max-w-none text-gray-800"></div>
          </div>
        </div>
      </div>

      {/* Sidebar (Lesson List) */}
      <div class="w-full md:w-80 bg-white border-l border-gray-200 p-4 order-1 md:order-2 h-auto md:h-screen overflow-y-auto sticky top-0">
        <div class="mb-6">
          <h2 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
            Module
          </h2>
          <p class="font-semibold text-gray-900">{module.title}</p>
        </div>

        <h3 class="text-sm font-bold text-gray-700 mb-3">Lessons</h3>
        <div class="space-y-2">
          {sidebarLessons.map((junction) => {
            const item = junction.item as { id: string; title: string; slug?: string };
            const isActive = item.id === currentLesson.id;
            const type = junction.collection
              .replace("_lessons", "")
              .toUpperCase();

            return (
              <a
                key={junction.id}
                href={`/play/${module.slug || module.id}/${item.slug || item.id}`}
                class={`block p-3 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-50 border-blue-200 text-blue-700 border"
                    : "hover:bg-gray-50 text-gray-700 border border-transparent"
                }`}
              >
                <div class="flex items-center gap-2">
                  <span
                    class={`w-2 h-2 rounded-full ${
                      type === "VIDEO"
                        ? "bg-red-400"
                        : type === "LAB"
                          ? "bg-green-400"
                          : "bg-blue-400"
                    }`}
                  ></span>
                  <span class="truncate font-medium">{item.title}</span>
                </div>
              </a>
            );
          })}
        </div>

        <div class="mt-8 pt-4 border-t">
          <a
            href={`/mod/${module.slug || module.id}`}
            class="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1"
          >
            &larr; Back to Module Overview
          </a>
        </div>
      </div>
    </div>
  );
}

