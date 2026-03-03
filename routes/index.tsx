import { Handlers, PageProps } from "$fresh/server.ts";
import { getDirectusClient } from "../utils/directus.ts";
import { readMe } from "@directus/sdk";

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
      <h1>
        Welcome, {data.user.first_name || "User"} {data.user.last_name || ""}!
      </h1>
      <p>Email: {data.user.email}</p>
      <p>ID: {data.user.id}</p>
      <br />
      <ul>
        <li>
          <a
            href="/courses"
            class="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            View All Courses
          </a>
        </li>
        <li>
          <a
            href="/logout"
            style="color: blue; text-decoration: underline; align-self: center;"
          >
            Logout
          </a>
        </li>
      </ul>
    </div>
  );
}
