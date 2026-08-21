# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

everythingOS — a Next.js 14 (App Router) web app that presents a browser-based
"desktop" for the Orangopus ecosystem: a draggable window manager, a
localStorage-backed virtual filesystem + terminal, an AI chat companion
("Mycel"), GitHub OAuth login, and full-screen VR-ready Three.js galaxy
explorers. Plain JavaScript (JSX), no TypeScript — `jsconfig.json` only
defines the `@/*` path alias to the repo root.

There is **no backend database**. All persistence is either client-side
(`localStorage`) or a signed httpOnly cookie; API routes are thin,
stateless proxies (GitHub OAuth exchange, OpenRouter chat proxy).

## Commands

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run start     # serve the production build
```

There is no lint script, no test script, and no test framework configured
in this repo (`package.json` only defines `dev`/`build`/`start`). Don't
assume `npm test` or `npm run lint` exist.

Env vars (all optional — the app degrades gracefully without them; see
`.env.example`):
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth login
- `SESSION_SECRET` — HMAC key for signing the session cookie
- `OPENROUTER_KEY` — powers Mycel's default (free) chat model
- `APP_ORIGIN` — base URL used for the OAuth redirect

## Architecture

### The desktop is one giant client component

`app/page.jsx` renders `components/Desktop.jsx`, a single large
`"use client"` component (~600 lines) that owns essentially all app state:
window manager (position/size/z-order per app, persisted to
`localStorage` under `eos:wm`), the virtual filesystem (a plain JS object
tree persisted under `eos:fs`, mutated via a deep-clone `mutateFS`
helper), the terminal emulator (`runCommand` — a big switch statement over
`ls/cd/cat/mkdir/rm/echo/...`), the Mycel chat panel, and the
settings/BYOK panel. The set of "apps" (windows) is the `APPS` object at
the top of the file — adding a new window means adding an entry there,
handling it in the `window-body` switch inside the render, and (usually)
adding an icon case to `AppIcon`/`SpatialView`'s `drawAppIcon`.

All persisted state uses the `store` helper (`get`/`set`/`del` wrapping
`localStorage`, key-prefixed `eos:`) — there's no server-side user data
store at all.

### Galaxies are data-driven pages

`lib/galaxies.js` exports a `GALAXIES` catalogue (visual/physical params
per galaxy) and `GALAXY_SLUGS`. `app/galaxy/[slug]/page.jsx` uses
`generateStaticParams` to turn every catalogue entry into a static route
automatically — **adding a galaxy is just adding an entry to
`lib/galaxies.js`**, no routing code needed. The actual Three.js particle
system, camera dolly, and WebXR/VR handling live in
`components/GalaxyScene.jsx`; it reads `cfg` from the catalogue entry
(star count, arm count/tightness, colors, camera distance, etc).

Perf constraints baked into `GalaxyScene.jsx` (respect these when
touching it): pixel ratio capped at 1.5, bloom pass skipped on mobile,
star count reduced ~55% on mobile UA, single draw call for 100k+ stars.

`components/SpatialView.jsx` is a separate, simpler Three.js scene — a 3D
card-carousel overlay over the desktop apps (opened via the "Spatial"
button) — independent from the galaxy explorers but reusing the same
canvas-icon drawing conventions as `Desktop.jsx`'s `AppIcon`.

### Auth: stateless, HMAC-signed cookie, no session store

`app/api/auth/login` redirects to GitHub OAuth (state stored in a
short-lived cookie); `app/api/auth/callback` exchanges the code, fetches
the GitHub profile, and signs a session payload with `lib/session.js`
(`signSession`/`verifySession`, custom HMAC-SHA256 over base64url JSON —
no JWT library), storing it in the `eos_session` httpOnly cookie (7 day
max age). `app/api/auth/session` verifies and returns the current user;
`app/api/auth/logout` clears the cookie. There's no user database — the
cookie itself *is* the account record. `Desktop.jsx` also offers a
"preview mode" that skips login entirely when GitHub OAuth isn't
configured.

### Mycel chat: two independent paths

- **Default:** `Desktop.jsx` posts to `app/api/mycel/route.js`, which
  proxies to OpenRouter using a fallback chain of free models
  (`MODEL_CHAIN` — provider model IDs rotate, check
  https://openrouter.ai/models?max_price=0 if the chain starts failing
  wholesale). It walks the chain on rate-limit/error and returns a
  `degraded: true` response with a friendly message if every model fails.
- **BYOK:** if the user pastes an Anthropic API key in Settings
  (`byok.enabled && byok.key`), `Desktop.jsx` calls
  `https://api.anthropic.com/v1/messages` **directly from the browser**
  (`anthropic-dangerous-direct-browser-access` header) — the key never
  touches this server and is only ever stored in `localStorage`. Keep it
  that way; don't route BYOK requests through an API route.

## Conventions to preserve

- No TypeScript, no CSS-in-JS/Tailwind — plain JSX + one global stylesheet
  (`app/globals.css`) using CSS custom properties for theming (`--accent`,
  `--accent-cyan`).
- Use the `@/` import alias (e.g. `@/lib/galaxies`, `@/components/Desktop`)
  rather than relative paths crossing top-level dirs.
- Client components that touch `window`/`localStorage`/Three.js are marked
  `"use client"` at the top; API routes under `app/api/**/route.js` use
  the Next.js Route Handler convention (`GET`/`POST` exports, `NextResponse`).
