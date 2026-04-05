# MDFT LMS — Agent Reference

This file describes the architecture of the project so that agent sessions can quickly understand how everything fits together.

---

## Framework & Runtime

- **Runtime:** Deno
- **Framework:** Fresh v1.7.3 (server-side rendered, file-based routing)
- **Language:** TypeScript + TSX
- **UI rendering:** Eta templates (not Preact/JSX) — all pages are server-rendered HTML strings
- **Dev entry point:** `dev.ts` (`deno task start`)
- **Prod entry point:** `main.ts` (`deno task preview`)
- **Port:** `8123` (configured in `fresh.config.ts` via `server: { port: 8123 }`)
- **Config:** `deno.json` (import map + tasks), `fresh.config.ts` (port + options), `fresh.gen.ts` (auto-generated manifest — do not edit manually)

---

## Directory Structure

```
routes/       Page handlers — Fresh file-based routing
templates/    Eta HTML templates — the actual rendered pages
static/       Static assets: CSS, images, banners, thumbnails, videos
utils/        Shared utilities (Directus client, Apollo client)
components/   Legacy unused Preact Layout component — ignore
islands/      Empty — no client-side islands exist yet
```

---

## Routing

Routes use Fresh file-based routing. Dynamic segments use `[paramName]` in filenames/folders.

| File | URL |
|---|---|
| `routes/_middleware.ts` | Runs on every request (auth) |
| `routes/_app.tsx` | Root wrapper shell |
| `routes/index.tsx` | `GET /` — homepage + search |
| `routes/login.tsx` | `GET /login`, `POST /login` |
| `routes/logout.ts` | `GET /logout` |
| `routes/profile.tsx` | `GET /profile` (auth-gated) |
| `routes/courses/index.tsx` | `GET /courses` |
| `routes/course/[slug]/index.tsx` | `GET /course/:slug` |
| `routes/course/[slug]/[moduleSlug].tsx` | `GET /course/:slug/:moduleSlug` |
| `routes/play/[courseSlug]/[moduleSlug]/[lessonSlug].tsx` | `GET /play/:c/:m/:l` |
| `routes/certifications/index.tsx` | `GET /certifications` |
| `routes/certification/[slug].tsx` | `GET /certification/:slug` |
| `routes/dataset/[slug].tsx` | `GET /dataset/:slug` |
| `routes/tech/[slug].tsx` | `GET /tech/:slug` |
| `routes/api/video-auth.ts` | `GET /api/video-auth` — nginx auth subrequest (internal) |

### Handler pattern (every route follows this)

```ts
export const handler: Handlers = {
  async GET(req, ctx) {
    const slug = ctx.params.slug;
    const token = ctx.state.token as string;         // set by middleware
    const client = getDirectusClient(token);          // undefined = public

    // 1. Fetch data from Directus
    const items = await client.request(readItems("collection", { ... }));

    // 2. Parse any Markdown fields
    item.content = await marked.parse(item.content);

    // 3. Render Eta template to string
    const eta = new Eta({ views: join(Deno.cwd(), "templates") });
    const html = eta.render("template_name.eta", { item, isAuthenticated: !!token, title: "..." });

    // 4. Return HTML response
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  },
};
```

---

## Templates

**Engine:** Eta v3.4.0 — lightweight EJS-like templating.

Every template starts with `<% layout("./layout.eta") %>`. Data is accessed via the `it` object.

**Syntax:**
- `<%= it.field %>` — HTML-escaped output
- `<%~ it.field %>` — Raw/unescaped HTML (used for pre-rendered Markdown)
- `<% if (...) { %> ... <% } %>` — Logic
- `include("./partial.eta", data)` — Partial includes

| Template | Purpose |
|---|---|
| `layout.eta` | Shared shell: `<head>`, navbar, Bootstrap CDN, footer |
| `index.eta` | Homepage with search bar |
| `courses.eta` | Course grid |
| `course_detail.eta` | Course detail: banner, modules, certifications, datasets, FAQ, testimonials |
| `module_detail.eta` | Module detail: banner, lesson list, learning path prev/next |
| `lesson_detail.eta` | Lesson player: sidebar, progress, content area, next-up nav |
| `lesson_video.eta` | Video player partial |
| `lesson_text.eta` | Text lesson partial |
| `lesson_lab.eta` | Lab lesson partial |
| `lesson_quiz.eta` | Quiz lesson partial |
| `certifications.eta` | Certifications grid |
| `certification_detail.eta` | Certification detail |
| `dataset_detail.eta` | Dataset detail |
| `technology_detail.eta` | Technology detail |
| `login.eta` | Login form |
| `profile.eta` | User profile: stats, goals, history |

---

## Static Assets

Served from `static/` at the root URL.

| Path | Contents |
|---|---|
| `static/css/style.css` | Custom Bootstrap overrides and utility classes |
| `static/img/` | SVG icons (module types), logo, favicon, badge PNGs |
| `static/banner/` | Wide category banners: `ai-category.png`, `development-category.png`, `leadership-category.png`, `microsoft-category.png`, plus per-course JPGs |
| `static/thumb/` | 16:9 thumbnail JPGs for course/cert cards, named `{slug}.jpg` |
| `static/media/` | Setup screenshots and case study images |
| `static/video/` | Local MP4 files (gitignored, `.gitkeep` present) |

**Asset naming conventions:**
- Thumbnails: `/thumb/{slug}.jpg`
- Category banners: `/banner/{category-slug}-category.png`
- Per-course banners: `/banner/{course-slug}.jpg` (checked with `Deno.stat()` before rendering)
- Module type icons: `/img/{type}.svg` where type is `course`, `module`, `lab`, `quiz`, `exam`
- Technology badges: `/img/{tech-slug}-badge.png` or `.svg`

**Banner existence check pattern:**
```ts
let hasBanner = false;
try {
  await Deno.stat(join(Deno.cwd(), "static", "banner", `${slug}.jpg`));
  hasBanner = true;
} catch { /* no banner */ }
```

---

## Directus Integration

**Backend URL:** `http://localhost:8055` (hardcoded in `utils/directus.ts`)

**Client factory (`utils/directus.ts`):**
```ts
export const getDirectusClient = (token?: string) => {
  const client = createDirectus("http://localhost:8055")
    .with(authentication("json"))
    .with(rest());
  if (token) client.setToken(token);
  return client;
};
```

**Collections:**

| Collection | Key Fields |
|---|---|
| `courses` | `id`, `title`, `slug`, `status`, `content`, `content_setup`, `category`, `certification` (M2O), `modules` (M2M junction), `technologies` (M2M junction), `preview_lesson`, `business_case`, `faq` |
| `modules` | `id`, `title`, `slug`, `type` (`course`/`lab`/`quiz`/`exam`), `content`, `lessons` (M2A junction), `dataset` |
| `video_lessons` | `id`, `title`, `slug`, `video_url`, `is_preview`, `content` |
| `text_lessons` | `id`, `title`, `slug`, `content` |
| `lab_lessons` | `id`, `title`, `slug`, `content` |
| `quiz_lessons` | `id`, `title`, `slug`, `content` |
| `certifications` | `id`, `title`, `slug`, `code`, `content`, `content_summary`, `content_exam`, `description`, `vendor`, `level`, `role`, `subject`, `info_url`, `schedule_url` |
| `datasets` | `id`, `title`, `slug`, `content`, `description` |
| `technologies` | `id`, `title`, `slug`, `content`, `content_summary`, `info_url` |
| `testimonials` | `text`, `author` |
| `directus_users` | `first_name`, `last_name`, `avatar`, `email`, `certification_goal` (via `readMe()`) |

**Relationship patterns:**
- Courses → Modules: M2M junction, accessed as `modules.modules_id.{field}`
- Modules → Lessons: M2A (many-to-any), `lessons.collection` = lesson type, `lessons.item` = lesson object
- Courses → Technologies: M2M junction, accessed as `technologies.technologies_id.{field}`
- Courses → Certification: M2O direct FK, accessed as `certification.{field}`

**Fetching all fields:** Use `fields: ["*"]` to fetch all scalar fields. Relationships require explicit nested field paths.

---

## Authentication

**Mechanism:** HTTP-only cookie (`auth_token`), 1-hour expiry, JWT issued by Directus.

**Login flow:**
1. `POST /login` calls `client.login(email, password)` via Directus SDK
2. On success, sets cookie via `setCookie()` and redirects to `/`

**Logout:** `GET /logout` deletes the cookie and redirects to `/login`

**Middleware (`routes/_middleware.ts`):**
- Reads `auth_token` cookie on every request
- Skips: `/login`, `/static/*`, `/_frsh/*`, `/favicon.ico`
- Validates token by calling `readMe()` against Directus
- On success: `ctx.state.token = token`
- On failure: proceeds as anonymous (no redirect — most pages are public)

**Auth-gating:**
- `/profile` — redirects to `/login` if no token
- Lesson player — shows a "Premium Content / Sign In" lock screen when `isAuthenticated === false`
- All other routes — work for anonymous users; `isAuthenticated` controls conditional UI elements

---

## Visual Style

**Bootstrap:** v5.3.3 (CDN via jsDelivr)
**Bootstrap Icons:** v1.11.3 (CDN via jsDelivr)
**Font:** Inter (Google Fonts, all weights 100–900), applied globally

**Brand colors (defined in `static/css/style.css`):**

| Use | Color |
|---|---|
| `btn-primary` | Lime green `#afeb2b` (black text) |
| `btn-primary:hover` | `#9bd326` |
| `btn-secondary` / `btn-success` | Orange `#fa6915` |
| `.branded-link`, nav hover, progress bars, Markdown links | Orange `#fa6915` |
| Certification badge background | Orange `#fa6915` |

**Recurring UI patterns:**

- **Card grid (courses/certs):** `card h-100 shadow-sm border-0 transition-hover` + `ratio ratio-16x9` image + centered `card-body`
- **Hero card:** `card shadow-lg mb-5 border-0` with `card-body p-4 p-md-5`
- **Category banner (top of hero card):** `<div class="bg-light"><img class="card-img-top object-fit-cover" /></div>` as first child of hero card
- **Section headings:** `<h2 class="h3 fw-bold mb-4 border-bottom pb-2">`
- **Type badges:** `<span class="badge ...">` with inline `style` for color
- **Progress bars:** `progress-bar progress-bar-striped progress-bar-animated` at `height: 8px` in `#fa6915`
- **More info / metadata fields:** plain text label, `<br />`, then the value — no extra classes
- **Custom narrow layout:** `.container-narrow` (`max-width: 960px`) used throughout
- **Banner ratio:** `ratio ratio-21x9` for full-width course banners
- **FAQ:** Pure HTML `<details>/<summary>` with custom CSS — not Bootstrap accordion

---

## Markdown

- **Library:** `marked` v15.0.0
- **Usage:** `await marked.parse(field)` in route handlers before passing to templates
- **Rendering:** `<%~ it.field %>` (unescaped) inside `<div class="markdown-content">`
- **Fields parsed:** `content`, `content_summary`, `content_exam`, `description`, `answer` (FAQ), lesson content, exam module content
- **Custom extension:** `routes/course/[slug]/index.tsx` registers a marked extension to handle `![alt](url) { .className }` syntax, rendering `<img class="className">`

---

## Module Types

The `modules.type` field drives icon, badge label, and lesson template selection:

| Type | Icon | Badge label |
|---|---|---|
| `course` | `/img/course.svg` | Course Module |
| `module` | `/img/module.svg` | Module |
| `lab` | `/img/lab.svg` | Lab Module |
| `quiz` | `/img/quiz.svg` | Practice Quiz |
| `exam` | `/img/exam.svg` | Practice Exam |

---

## Utilities

- **`utils/directus.ts`** — `getDirectusClient(token?)` factory. Used in every route.
- **`utils/apollo.ts`** — `createClient(token?)` Apollo/GraphQL factory for the Directus GraphQL endpoint. Configured but not actively used in any current route.

---

## Nginx Proxy & Video Serving

An nginx server sits in front of the Deno app and handles two responsibilities:

1. **`/video/[id]` requests** — served directly by nginx, never forwarded to Deno
2. **All other requests** — proxied to the Deno app on `host.containers.internal:8123`

Config files are in the `nginx/` directory:

| File | Purpose |
|---|---|
| `nginx/nginx.conf` | Main nginx config: worker settings, gzip, rate-limit zones |
| `nginx/conf.d/default.conf` | Virtual host: upstream definition, video routing, proxy rules |

### Video auth subrequest flow

When nginx receives `GET /video/{uuid}` it makes an internal subrequest to `/_auth` before serving the file:

```
Browser → nginx /video/{uuid}
               ↓ auth_request /_auth
               nginx → Deno /api/video-auth
                            (X-Video-ID: {uuid} header)
                         ← 200 + X-Video-Path + X-Video-Filename
               ↓ alias /var/videos/$video_path
               ← MP4 stream
```

- nginx passes the video lesson UUID in the `X-Video-ID` request header. The UUID is captured into `$video_id` with `set $video_id $1` in the `/video/` location, then forwarded by the `/_auth` location via `proxy_set_header X-Video-ID $video_id`. (`$1` capture groups are not in scope inside `/_auth`, so the named variable is required.)
- Deno reads the `auth_token` cookie, validates it via Directus `readMe()`, then fetches `video_url` from `video_lessons` using `readItem()`
- The `video_url` field is a filename (e.g. `my-lesson.mp4`) — **never exposed to the browser**, preventing URL guessing
- Deno returns `X-Video-Path` and `X-Video-Filename` (both set to the bare filename); nginx uses `alias /var/videos/$video_path` to serve the file
- On auth failure Deno returns `401`; on missing video `404`; nginx propagates both to the browser

### `routes/api/video-auth.ts`

This is the only route that does **not** use `ctx.state.token` from middleware. Because nginx calls it as an internal subrequest (no Fresh context), it reads and validates the cookie itself — identical logic to `_middleware.ts`:

```ts
const cookies = getCookies(req.headers);
const token = cookies.auth_token;
const client = getDirectusClient(token);
await client.request(readMe());                          // validates token
const lesson = await client.request(readItem("video_lessons", videoId, { fields: ["video_url"] }));
const filename = lesson.video_url.split("/").pop();
// returns X-Video-Path and X-Video-Filename headers
```

---

## Known Incomplete Areas

- Profile page stats (progress %, lesson counts, scores) are **hardcoded placeholder values** — real tracking is not yet implemented
- Profile history, watch-later list, achieved certifications, and learning tracks are **static hardcoded data**
- `components/Layout.tsx` is a legacy Preact component that mirrors `layout.eta` — it is not used anywhere and can be ignored
- `islands/` is empty — no client-side interactivity has been added yet
- Apollo client is set up but unused — all data fetching currently uses the Directus REST SDK

---

## Verification

The nginx container runs on **port 8080 on localhost** and is accessible without authentication. Use it to verify rendered HTML and served static assets after making changes.

**Important:** Lesson detail pages (`/play/...`) render a "Premium Content / Sign In" lock screen for anonymous visitors — the actual lesson content, quiz questions, and answer lists are **not present in the HTML** when fetched without an `auth_token` cookie. Do not attempt to verify lesson content changes via `curl`; leave that testing to the user.

**Check a rendered page for CSS classes:**
```bash
curl -s http://localhost:8080/course/{courseSlug}/{moduleSlug} | grep -o 'some-class[^"]*'
```

**Check a CSS file is being served correctly:**
```bash
curl -s http://localhost:8080/css/style.css | grep -A3 '\.some-class'
```

**Find real course/module slugs to test with:**
```bash
# List courses
curl -s http://localhost:8080/courses | grep -o 'href="/course/[^"]*"'

# List modules for a course
curl -s http://localhost:8080/course/{courseSlug} | grep -o 'href="/course/{courseSlug}/[^"]*"'
```

**Clear the nginx static asset cache** (required after every CSS change — nginx caches CSS/JS for 1 hour):
```bash
podman exec mdft-lms-nginx find /var/cache/nginx/static -type f -delete && podman exec mdft-lms-nginx nginx -s reload
```
