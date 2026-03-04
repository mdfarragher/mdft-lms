import { Handlers, PageProps } from "$fresh/server.ts";
import { getDirectusClient } from "../../utils/directus.ts";
import { readItems } from "@directus/sdk";

interface Module {
  id: string;
  title: string;
  slug: string;
}

interface Course {
  id: string;
  title: string;
  slug: string;
  status?: string;
  date_created?: string;
  modules?: { modules_id: Module }[]; // Assuming M2M structure: courses -> courses_modules -> modules
}

interface Data {
  course: Course | null;
  error?: string;
}

export const handler: Handlers<Data> = {
  async GET(req, ctx) {
    const slug = ctx.params.slug;
    const token = ctx.state.token as string;
    const client = getDirectusClient(token);

    try {
      // Fetch course by slug with modules
      // We assume a Many-to-Many relationship where 'modules' is the field on 'courses'
      // and 'modules_id' is the related item in the junction table.
      const courses = (await client.request(
        readItems("courses", {
          filter: {
            slug: {
              _eq: slug,
            },
          },
          limit: 1,
          fields: [
            "*",
            // Fetch related modules.
            // Note: If your relationship field is named differently (e.g., 'course_modules'),
            // or the junction field is 'item' instead of 'modules_id', this will need adjustment.
            "modules.modules_id.id",
            "modules.modules_id.title",
            "modules.modules_id.slug",
          ],
        }),
      )) as Course[];

      if (!courses || courses.length === 0) {
        return ctx.renderNotFound();
      }

      return ctx.render({ course: courses[0] });
    } catch (e: any) {
      console.error("Fetch Course Error:", e);
      return ctx.render({
        course: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
};

export default function CourseDetail({ data }: PageProps<Data>) {
  if (data.error) {
    return (
      <div class="p-4 text-red-500">
        <h1>Error fetching course</h1>
        <p>{data.error}</p>
        <a href="/courses" class="underline">
          Back to Courses
        </a>
      </div>
    );
  }

  if (!data.course) {
    return <div>Course not found</div>;
  }

  const { course } = data;

  // Flatten the M2M structure to a simple list of modules
  // If modules is undefined, default to empty array
  // If mapping produces undefined (e.g. broken relation), filter it out
  const modules =
    course.modules?.map((m) => m.modules_id).filter(Boolean) || [];

  return (
    <div class="p-4 max-w-4xl mx-auto">
      <div class="mb-6">
        <a
          href="/courses"
          class="text-blue-600 hover:underline flex items-center gap-2"
        >
          &larr; Back to All Courses
        </a>
      </div>

      <div class="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
        <div class="p-8">
          <div class="flex justify-between items-start mb-4">
            <h1 class="text-3xl font-bold text-gray-900">{course.title}</h1>
            {course.status && (
              <span
                class={`px-3 py-1 rounded-full text-sm font-medium ${
                  course.status === "published"
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {course.status}
              </span>
            )}
          </div>

          <div class="border-t pt-6 mt-6">
            <h2 class="text-xl font-semibold mb-4">Course Details</h2>

            <dl class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt class="text-sm font-medium text-gray-500">Course ID</dt>
                <dd class="mt-1 text-sm text-gray-900">{course.id}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500">Slug</dt>
                <dd class="mt-1 text-sm text-gray-900">{course.slug}</dd>
              </div>
              {course.date_created && (
                <div>
                  <dt class="text-sm font-medium text-gray-500">Created On</dt>
                  <dd class="mt-1 text-sm text-gray-900">
                    {new Date(course.date_created).toLocaleDateString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-lg overflow-hidden">
        <div class="p-6 border-b">
          <h2 class="text-2xl font-bold text-gray-900">Modules</h2>
        </div>
        <div class="p-6">
          {modules.length > 0 ? (
            <div class="space-y-4">
              {modules.map((module) => (
                <div
                  key={module.id}
                  class="border rounded p-4 hover:bg-gray-50 transition-colors"
                >
                  <h3 class="text-lg font-semibold text-blue-800">
                    <a href={`/mod/${module.slug || module.id}`} class="hover:underline">
                      {module.title}
                    </a>
                  </h3>
                </div>
              ))}
            </div>
          ) : (
            <p class="text-gray-500 italic">
              No modules found for this course.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
