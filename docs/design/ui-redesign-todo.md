# Rebuild the La Goyniela UI on the approved brand system

The MVP flows work against the real backend, but the interface is a generic dark-green skeleton. This plan replaces the whole visual layer with the identity defined in the brand and UI foundations boards: **"Modern product. Pixel soul."** Business logic, routes, server actions, and tests stay untouched; only presentation changes.

## Sources of truth

| Source | What it defines |
|---|---|
| `docs/design/ui-foundations-board.png` | Color roles, surface tints, type scale, spacing, shapes, iconography, imagery rule, accessibility, mini UI preview |
| `public/brand-guideline-board.png` | Logo usage, clear space, 48px minimum size, graphic language, icon system, applications |
| `docs/design/design-brief.md` | Product goal, roles, primary actions, "prediction/vote" vocabulary |
| `docs/architecture/client-foundation.md` | Tailwind, Server Components first, GSAP rules, mobile-first non-negotiables |
| `design-taste-frontend` skill (`~/.codex/skills/design-taste-frontend/SKILL.md`) | Anti-slop rules; applies fully to brand-facing surfaces (login, register, empty states), partially to product screens |

**Design read:** a mobile-first social prediction app for football supporters, with a dark stadium-night language and pixel-art atmosphere. It leans toward clean modern product cards on top of subtle pixel scenes.

## Phases at a glance

| # | Phase | Outcome | Depends on |
|---|---|---|---|
| 0 | Decisions | Open questions answered (see the end of this doc) | none |
| 1 | Foundations | Tokens, fonts, icons, image pipeline | 0 |
| 2 | Primitives | Atomic UI kit used by every screen | 1 |
| 3 | App shell and scenes | Backgrounds per area, header, bottom nav, system states | 2 |
| 4 | Auth surfaces | New login and register with Google and X buttons | 3 |
| 5 | Product screens | Dashboard, groups, matchday, ballot, results, profile | 3 |
| 6 | Motion | GSAP micro-interactions and character animations | 4, 5 |
| 7 | Visual QA | Screenshot suite, accessibility, performance budget | every phase |

Each phase is one reviewable work unit, with its own commit and its own screenshots at 360px.

---

## 1. Foundations

- [ ] **Design tokens in Tailwind 4 `@theme`.** Move away from the hand-written classes in `globals.css`; the Tailwind CSS stated as normative in `client-foundation.md` is installed but unused.
  - Canvas `#002600`; surfaces 1–5 `#00330A`, `#004016`, `#005021`, `#00682D`, `#00883A`.
  - Primary action `#B2FFA6`, soft highlight `#C4FCBB`, secondary `#9ADF90`, muted `#A2DA9A`.
  - Warm cream `#F6EBD7` (ballot paper); near-black `#081A0E` (no pure black).
  - Semantic roles on top of these: `bg`, `surface-1..5`, `fg`, `fg-muted`, `action`, `on-action`, `border-soft`, `danger`, `warning`, `success`.
- [ ] **Type scale.**
  - Display 40/44, H1 28/32, H2 22/28 in **Tanker**.
  - Body 16/24, label 14/20, meta 12/16 in **Nippo**.
  - Tabular numerals for scores, dates, and counts.
- [ ] **Fonts.** Self-host Tanker and Nippo (Fontshare, ITF Free Font License) with `next/font/local` and `display: swap`. The fallback metrics must avoid layout shift.
- [ ] **Spacing.** A 4/8/12/16/24/32/48 scale; nothing outside it.
- [ ] **Shapes.**
  - Card radius 20 with a 1px soft green border.
  - Control radius 12; pills fully rounded.
  - A stepped "pixel corner" accent, decorative only.
- [ ] **Graphic language as CSS utilities:** pixel halftone fade, badge rings, pitch geometry lines, the 1X2 grid, and pixel borders. All are decorative and `aria-hidden`.
- [ ] **Icon library.** The Taste skill bans hand-rolled SVG icons. Adopt one library, scoped to the board's icon set (home, groups, quiniela, results, profile, plus actions).
- [ ] **Image pipeline.**
  - Backgrounds are about 2.2 MB PNGs at 1672×941. Serve them through `next/image` (AVIF/WebP, `sizes`) or pre-export WebP variants.
  - Define per-scene `object-position` so the art (always on the right) stays visible in a 360px portrait viewport.
  - Use a left-to-right canvas scrim so text keeps AA contrast.
- [ ] **Remove** the old ad-hoc classes once each screen migrates. Do not keep two styling systems alive.

> **Phase 1 measured (production, `next start`, q=75):** scene images served at 390w (828px source at 2x) are 29-37 KB AVIF / 57-74 KB WebP; at 1280w (1920 variant) 89-112 KB AVIF / 154-198 KB WebP, versus 2.2 MB PNG originals. All under the 250 KB budget. Use `SCENE_SIZES` from `src/components/scene/scenes.ts`.

## 2. Primitives (atomic design)

Presentational components in `src/components/ui/`. They hold no data fetching or domain logic, and each one has a 44px minimum touch target, visible focus, and reduced-motion support.

| Component | Variants and notes |
|---|---|
| `Button` | primary (lime pill), secondary (outline), ghost, danger, provider (Google/X); loading state |
| `Field` | label, hint, error, `aria-describedby` wiring; text, email, password with a show toggle, textarea, code input |
| `SignToggle` | the 1/X/2 segmented radio group from the board preview: big, high contrast, selected = lime fill |
| `PlenoChips` | M0/M1/M2 checkbox chips |
| `Card` | surface level 1–3, optional pixel corner |
| `Badge` | role (admin/member), status (voting open, voted, not voted, closed) |
| `Avatar` | image or initials inside the brand badge ring |
| `Progress` | n/15 bar with a pixel step look |
| `Divider` | plain line, or line with "or" for the auth providers |
| `EmptyState` | illustration asset + one sentence + one action |
| `ConfirmSheet` | two-step destructive confirmation (bottom sheet on mobile) to replace the inline pattern |
| `Skeleton` | card and list placeholders that match the final layout |
| `StatusMessage` | `role="status"` / `role="alert"` inline feedback |

## 3. App shell and scenes

- [ ] **`SceneBackground` server component.** It maps each area to its art:

  | Area | Background |
  |---|---|
  | Login, register, OAuth errors | `fondo_de_acceso.png` |
  | Dashboard, groups list | `fondo_dashboard.png` |
  | Group detail, create, join | `fondo_interior_grupo.png` |
  | Matchday and picks | `fondo_imagen_jornada.png` |
  | Group ballot, results with hits | `fondo_celebracion.png` |

- [ ] **Top bar:** logo badge (never below 48px), page title in Tanker, and back navigation on nested routes.
- [ ] **Bottom nav** following the board: icon + label, active item as a lime pill, safe-area padding, and no overlap with the sticky submit bars.
- [ ] **System states with assets:**

  | State | Asset | Notes |
  |---|---|---|
  | Loading | `waiting_image.png` | can animate with the existing `public/animations.mjs` renderer |
  | Error boundary | `asset_red_card.png` | |
  | Forbidden and offline | `asset_yellow_card.png` | |
  | Not found | `asset_porteria.png` | empty goal |
  | Success after voting | `vote_image.png` | |

- [ ] **Remove the dev-only "Rendering…" overlap** by checking the nav z-index against the Next.js dev indicator.

## 4. Auth surfaces (Taste skill applies fully)

- [ ] **Login.**
  - **Hero:** the access scene behind it, then the logo badge, the headline "Together, one prediction." (max 2 lines), and one subtext of 20 words or fewer.
  - **Form:** the email form, an "or" divider, then **Continue with Google** and **Continue with X**, then a "Create an account" link.
  - **Fit:** the CTA stays visible without scrolling at 360×740.
- [ ] **Register:** the same composition, sign-up copy, and the same provider buttons. Field errors stay inline; the password is never echoed back.
- [ ] **Provider buttons are always visible.** Google and X are each a button showing their logo.
  - When a provider is not configured, show a **disabled** button with honest helper text instead of hiding it.
  - Follow Google's sign-in branding rules: official "G" mark, "Continue with Google" label, neutral surface. Use X's official logo.
  - Show a loading state while redirecting to the provider.
- [ ] **OAuth error banner** (`?error=`) restyled as an alert card with the yellow card asset.
- [ ] **Signed-in redirect:** `/login` should redirect signed-in users the same way `/register` already does.

## 5. Product screens

| Screen | Key composition |
|---|---|
| Dashboard | Greeting, active matchday hero card (number, voting-close countdown, your status), "Your groups" list, create/join actions with jersey and scarf art in the empty state |
| Groups list | Group cards with member count and role badge |
| Create / join group | Join code shown as the **membership ticket** (`asset_ticket` style), large code input, copy action |
| Group detail | Interior scene, members list with avatars and role badges, admin panel (visibility toggle, roles), danger zone in a `ConfirmSheet` |
| Matchday | Match cards like the board preview: both teams, kickoff, a big `SignToggle`; pleno card; **sticky bottom bar** with n/15 progress and a "Submit prediction" button; read-only state when closed |
| Group participation | Who voted (vote box art), collapsed per-member picks when visibility is on |
| Group ballot | A cream "paper" quiniela ticket with marked 1/X/2 boxes, the pleno row, vote counts; celebration scene |
| Results | Scoreboard style rows (`asset_score`), hit counter, prize table cards |
| Profile | Avatar in the badge ring, name, member since, linked providers, avatar upload, log out |

## 6. Motion (GSAP + `@gsap/react`)

- [ ] **Interactions:**
  - Page entry fade/slide stagger for cards; it runs once and never delays content.
  - A `SignToggle` press bounce and a progress fill tween.
  - A success burst when picks are saved, reusing the `celebrating` renderer.
- [ ] **Loader:** the waiting animation on loading screens; the static image is shown for reduced motion.
- [ ] **Rules:**
  - `useGSAP` scoped cleanup and `gsap.matchMedia`.
  - `prefers-reduced-motion` disables every non-essential tween.
  - Motion never hides latency or blocks input.

## 7. Visual QA (each phase)

- [ ] **Screenshots:** a Playwright suite in `tests/visual/` captures every route at 360, 390, 768 and 1280px, logged in as admin and as member.
- [ ] **Layout checks:**
  - No horizontal overflow.
  - No overlap between the bottom nav and the sticky bars.
  - Text survives 200% zoom.
- [ ] **Accessibility:**
  - An axe-core pass on every route.
  - A contrast check of the tokens: `#B2FFA6` on `#002600` and the reverse are AA+ per the board.
  - The scrims over scene art are verified.
- [ ] **Performance:** a Lighthouse mobile budget of LCP < 2.5s and CLS < 0.1, and scene images ≤ 250 KB served.
- [ ] **Regression:** the existing `pnpm test`, lint, tsc, and build pass after every phase.

---

## Decisions needed before Phase 1

| # | Question | Recommendation |
|---|---|---|
| 1 | UI copy language | **Decided (2026-10-05): every user-facing string is Spanish** (labels, buttons, errors, metadata titles, alt text, aria labels, dates via `es-ES`). Neutral register. Code identifiers and comments stay English. |
| 2 | Fonts | **Decided (2026-10-05):** Tanker-Regular and Nippo-Variable self-hosted from `src/app/fonts/` via `next/font/local`. The repo is **public** and the ITF FFL forbids redistribution, so the `.woff2` files are git-ignored. Phase 1 must add a `fonts:fetch` script (downloads from `api.fontshare.com/v2/fonts/download/{tanker,nippo}`, extracts the WEB woff2) run before `dev`/`build`, and the build must fall back to system fonts if they are missing. |
| 3 | Icon library | **Decided (2026-10-05):** `@phosphor-icons/react` 2.1.10 installed; import per icon (tree-shaken), one weight family across the app. Exception: Google's sign-in button uses Google's official multicolor "G" mark (branding requirement), not Phosphor's monochrome `GoogleLogo`. |
| 4 | Bottom nav | **Decided (2026-10-05):** 5 items: Inicio, Grupos, Quiniela, Resultados, Perfil. "Quiniela" is a new protected route `/quiniela` (no N+1: one groups call plus one active-jornada call). One group goes straight to `/groups/{id}/matchdays/{activeId}`. Several groups show a quick group picker with each group's voted/pending status, loaded lazily per card. No groups shows an empty state with create/join. No active jornada shows the waiting state. |
| 5 | Styling | **Decided (2026-10-05):** Tailwind 4 `@theme` tokens plus component-level utilities. The hand-written classes in `globals.css` are removed screen by screen as each one migrates; by the end of Phase 5 `globals.css` holds only `@theme`, base layer and graphic-language utilities. |

## Execution model

- One delegated writer per phase, sequential (no parallel writers).
- Every phase ends with screenshots reviewed before the next one starts.
- Commit per phase with conventional commits; nothing merges with failing checks.
