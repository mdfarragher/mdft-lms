# MDFT LMS
MDFT LMS is a learning management system for hosting my online course lessons, labs and practice exams. The site is an Apollo front end that interacts with a Directus backend.

## Project Analysis

This project is a **Deno Fresh** web application that serves as a frontend for a Learning Management System (LMS). It is designed to interact with a **Directus** backend (Headless CMS).

### Key Architecture
*   **Runtime:** Deno
*   **Framework:** Fresh (Server-Side Rendering)
*   **Language:** TypeScript
*   **Backend:** Directus (expected at `http://localhost:8055`)

### Core Functionality
1.  **Authentication:**
    *   **Login:** The `/login` route (`routes/login.tsx`) accepts email/password and authenticates against the Directus API (`/auth/login`).
    *   **Session:** Upon success, it stores the JWT access token in an `auth_token` HTTP-only cookie.
    *   **Middleware:** The `routes/_middleware.ts` file protects routes by checking for this cookie. If missing, it redirects users to `/login`.

2.  **Data Fetching:**
    *   **GraphQL:** The app uses **Apollo Client** (`@apollo/client`) to fetch data from the Directus GraphQL endpoint.
    *   **Configuration:** The client is set up in `utils/apollo.ts` to attach the Bearer token from the session to every request.
    *   **Example Usage:** The home page (`routes/index.tsx`) uses this client to fetch and display the current user's profile information (`users_me` query).

### Project Structure
*   `routes/`: Contains the page handlers and middleware.
    *   `index.tsx`: The main protected dashboard/profile page.
    *   `login.tsx`: The authentication page.
    *   `_middleware.ts`: Handles session validation.
*   `utils/`:
    *   `apollo.ts`: Configures the Apollo Client instance.
*   `islands/`: Currently empty, indicating the app is primarily server-rendered with little to no client-side interactivity (hydration) at this stage.
*   `deno.json`: Manages dependencies (Deno standard library, Fresh, Preact, Apollo Client) and tasks (`start`, `build`, `preview`).
