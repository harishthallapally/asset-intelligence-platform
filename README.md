# Asset Intelligence Platform — Operations Dashboard

Phase 1 POC dashboard for battery-swap station operations. It reads live
scoring from the platform API and presents the operations-intelligence loop:

```
Telemetry → Anomaly Detection → Health Score → Predictive Risk
          → AI Explanation → Recommended Field Action → Dashboard
```

It answers the five questions from the requirements document: what is
happening, what is abnormal, what is likely to happen, why the AI thinks so,
and what the field team should do.

---

## Tech stack

The `frontend/` app is what's deployed; `backend/` is a reference implementation
only (see below).

| Layer | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) — App Router, React Server Components, Turbopack for both `dev` and `build` |
| UI library | [React 19](https://react.dev) |
| Language | TypeScript 5, strict mode |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| Charts | [Recharts](https://recharts.org) — trend lines, donuts, telemetry charts (the network map itself is a hand-drawn inline SVG, not a charting library) |
| Icons | [lucide-react](https://lucide.dev) |
| Lint | ESLint 9 with `eslint-config-next` |
| Hosting | [Vercel](https://vercel.com) (see *Deploying to Vercel* below) |

No state-management library, no CSS-in-JS, no ORM/database — screens are
server components that read the platform API directly (see below) and hand
already-shaped view models to a thin client-side layer for interactivity
(tables, the copilot widget, demo controls).

---

## Quick start

**Requirements:** Node.js 20.9+ (tested on 22.17) and npm.

```bash
cd frontend
cp .env.example .env.local     # then set API_BASE_URL
npm install
npm run dev
```

Open **http://localhost:3000**.

Without `API_BASE_URL` the app still runs, but falls back to a bundled sample
dataset and shows a "Showing sample data" warning at the top of the dashboard.

### Commands

Run these from `frontend/`.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload on port 3000 |
| `npm run build` | Production build (type-checks every route) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check only |

If a stale dev server is holding the port, stop it **before** deleting `.next`
— removing the build directory from under a running server corrupts its cache.

### Before pushing

Three commands, run from `frontend/`. `npm run build` is the one that matters —
it type-checks every route, so it catches what the other two miss:

```bash
npx tsc --noEmit    # types
npm run lint        # lint
npm run build       # 14 routes, full type-check
```

All three are expected to pass with no output beyond the build's route table.

---

## Screens

| Route | Screen | Data |
|---|---|---|
| `/` | **Command Center** — KPI cards with per-asset risk lists, top risk assets across all types, health distribution, AI risk summary, critical alerts, health trend, failure scenarios | Live |
| `/batteries` · `/batteries/[id]` | Battery register and **Battery 360** — health dimensions, detected signals, AI insight, recommended checks | Live |
| `/stations` · `/stations/[id]` | Station register and per-station chargers | Live |
| `/chargers` | Charger register with fault and last-seen state | Live |
| `/settings` | Scoring reference and demo data controls | Live |
| `/alerts` | Alert feed | Sample |
| `/ai-predictions` | Predictive risk register | Sample |
| `/live-monitoring` | Rolling telemetry stream | Sample |
| `/map-view` | Network map | Sample |

Plus the **AI Operations Copilot** — the robot icon at the bottom-right of
every screen.

The four "Sample" screens are waiting on API capabilities, not on work here:
per-battery telemetry (`/batteries/{id}/telemetry` returns 404), station
coordinates, and a decision on whether the risk register should be scoped to
docks or batteries.

---

## Deploying to Vercel

The Next.js app lives in `frontend/`, not at the repository root — this is the
one setting that catches people out.

**1. Import the repo** at [vercel.com/new](https://vercel.com/new).

**2. Set the Root Directory to `frontend`.** Vercel then detects Next.js and
fills in the build command itself. Skip this and the build fails with
"No Next.js version detected".

**3. Add the environment variable** — Project → Settings → Environment
Variables:

| Name | Value | Environments |
|---|---|---|
| `API_BASE_URL` | your platform API base URL | Production, Preview, Development |

It is deliberately **not** prefixed with `NEXT_PUBLIC_`, so the address stays
server-side and never ships to the browser.

**4. Deploy.** Every push to the connected branch redeploys automatically.

### After deploying

- Confirm the **"Showing sample data"** warning is absent. If it appears, the
  environment variable is missing or the API is unreachable — the dashboard
  will not silently pass simulated figures off as real.
- The upstream API cold-starts and can take 10–20s on its first request.
  Responses are cached 30s and served stale-while-revalidate, so only the first
  visit after an idle period is slow.

### From the CLI instead

```bash
cd frontend
npx vercel        # first run links the project and asks for the root directory
npx vercel --prod
```

---

## Architecture

```
frontend/src/
├── app/                  one directory per screen
├── components/           layout shell, shared UI, dashboard panels, charts
└── lib/
    ├── api/              the API boundary — types, client, normalisers
    ├── copilot/          POC-08 tool layer and intent router
    └── mock/             synthetic dataset used only as a fallback
```

### How the frontend connects to the backend

The dashboard holds no database and does no scoring of its own — it is a
thin, read-mostly client of the hosted platform API. The connection is a
single environment variable and one call chain, always in this direction:

```
Screen (Server Component)
  → lib/api/resources.ts   (per-screen loader — what data this page needs)
    → lib/api/client.ts    (typed fetch, one function per endpoint)
      → lib/api/endpoints.ts (builds the URL + query string)
        → API_BASE_URL + path, over HTTPS, plain JSON
      ← lib/api/types.ts   (wire types — snake_case, matches the response exactly)
    ← lib/api/normalise.ts (wire types → the camelCase view model the screen renders)
```

- **`API_BASE_URL`** (set in `frontend/.env.local`, or as a Vercel env var) is
  the only address configured anywhere. It is deliberately **not** prefixed
  `NEXT_PUBLIC_`, so it is read only on the server (`process.env` inside a
  Server Component / API route) and never shipped to the browser — the
  client never talks to the platform API directly.
- Screens never call `fetch` themselves; every request goes through
  `lib/api/client.ts`, which adds a timeout, tags the response for caching,
  and turns a failed/unreachable call into a typed `ApiUnavailableError`
  rather than an unhandled exception.
- Responses are cached for 30 seconds via Next's `fetch` cache (`revalidate:
  30`, tagged `platform-data`) — a dashboard load that touches five slow
  endpoints still stays fast. Demo-control mutations call `revalidateTag`
  immediately after, so you always see the result of your own write instead
  of a stale cached read.
- If `API_BASE_URL` is unset, or the platform API is unreachable, screens
  fall back to the local synthetic dataset in `lib/mock/` and show a
  **"Showing sample data"** banner — the dashboard never silently passes
  fabricated numbers off as live ones.
- The **AI Copilot** doesn't fetch from the browser either: the widget posts
  to this app's own `app/api/copilot/route.ts`, a Next.js API route that
  calls the platform's `/copilot/ask` server-side — same reasoning, the
  platform's address (and any future credential) stays off the client.

### The API layer

| File | Role |
|---|---|
| `api/endpoints.ts` | Every API path in one place; nothing else builds URLs |
| `api/client.ts` | Fetch wrapper — timeouts, tagged caching, error typing |
| `api/types.ts` | Wire types, matching the service's snake_case exactly |
| `api/normalise.ts` | Wire types → the view models screens consume |
| `api/resources.ts` | Per-screen loaders |
| `api/scenarios.ts` | Rolls raw failure signals into the four spec scenarios |

### Health vs. risk

The two are scored separately, and conflating them is the easiest mistake to
make here:

- **Health** is current condition. A worn pack scores low but may be stable —
  that needs replacement planning, not a callout.
- **Risk** is an active trend. A pack can be classified healthy and still carry
  high predictive risk because its behaviour is diverging.

Risk is always presented as **Predictive Risk / Early Warning**, never as a
confirmed failure prediction.

### AI Operations Copilot (POC-08)

Spec section 12.1 requires that the language layer never calculates risk:

```
User → Copilot → Tool/API layer → Operational data → ML/Rules
     → Structured result → language layer → Explanation
```

| File | Role |
|---|---|
| `lib/copilot/apiTools.ts` | The tools. Each queries already-scored data; none re-derives risk. |
| `lib/copilot/router.ts` | Chooses which tool answers, and resolves asset identifiers. |
| `lib/copilot/serverAsk.ts` | Calls the platform's own `/copilot/ask` for prose when an LLM key is configured there. |
| `app/api/copilot/route.ts` | Server route, so the browser never sees the API URL. |

Every figure the copilot states comes from the same scoring the dashboard
reads, so the chat and the screens cannot disagree. Unknown assets and
off-topic questions are refused rather than answered.

---

## Documents

| File | What it is |
|---|---|
| `AI Asset Intelligence Platform — Phase 1 Requirements.docx` | The source requirements. Section 6 defines the four failure scenarios the dashboard groups by; section 12.1 defines the copilot architecture. |
| `SUN Mobility - Phase 1 Pitch Deck.docx` | Ten-slide walkthrough of Phase 1. Every figure in it is read from the live API or taken from the requirements — no projected business metrics. |

---

## The `backend/` directory

A FastAPI service written before the scope narrowed to a dashboard against the
hosted platform. **The dashboard does not use it and you do not need it.** It
is kept as a reference implementation of the same engines.

---

## Out of scope for Phase 1

Real operator-system integration, live IoT streaming, mobile apps, automated
engineer assignment, route and spare-parts optimization, remaining-useful-life
prediction, and production HA infrastructure. Engineer assignment is
deliberately stubbed — creating a field action records the issue, priority, SLA
and checklist for handover.
