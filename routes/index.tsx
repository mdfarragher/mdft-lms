import { Handlers, PageProps } from "$fresh/server.ts";
import { getDirectusClient } from "../utils/directus.ts";
import { readMe } from "@directus/sdk";
import Search from "../islands/Search.tsx";

interface Data {
  user: any;
  error?: string;
}

export const handler: Handlers<Data> = {
  async GET(req, ctx) {
    const token = ctx.state.token as string;

    // Create authenticated client using SDK
    const client = getDirectusClient(token);

    try {
      // Fetch user profile using SDK helper
      // This automatically uses the /users/me endpoint
      const user = await client.request(readMe());

      return ctx.render({ user });
    } catch (e: any) {
      console.error("Directus SDK Error:", e);
      let errorMessage = e instanceof Error ? e.message : String(e);

      // Try to parse Directus error structure if available
      if (e?.errors?.[0]?.message) {
        errorMessage = e.errors[0].message;
      }

      return ctx.render({ user: null, error: errorMessage });
    }
  },
};

export default function Home({ data }: PageProps<Data>) {
  if (data.error) {
    return (
      <div style="padding: 2rem; color: red;">
        <h1>Error</h1>
        <p>{data.error}</p>
        <p>
          Ensure Directus is running at http://localhost:8055 and the schema is
          correct.
        </p>
        <a href="/logout">Logout</a>
      </div>
    );
  }

  if (!data.user) {
    return <div>Loading...</div>;
  }

  return (
    <div style="padding: 2rem;">
      <div class="text-center mb-12 mt-8">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">
          Search
        </h1>
        <p class="text-lg text-gray-600">
          Welcome back, {data.user.first_name || "User"} {data.user.last_name || ""}!
        </p>
      </div>

      <Search />

      <div class="mt-12 text-center">
        <h2 class="text-xl font-semibold mb-4">Quick Links</h2>
        <ul class="flex justify-center gap-4">
          <li>
            <a
              href="/courses"
              class="inline-block bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 transition-colors"
            >
              View All Courses
            </a>
          </li>
          <li>
            <a
              href="/logout"
              class="inline-block text-gray-500 px-4 py-2 hover:text-gray-700 underline transition-colors"
            >
              Logout
            </a>
          </li>
        </ul>
      </div>

      <div class="mt-8 text-xs text-gray-400 text-center">
        <p>Email: {data.user.email}</p>
        <p>ID: {data.user.id}</p>
      </div>
    </div>
  );
}
