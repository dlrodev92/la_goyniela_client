# Project snapshot

La Goyniela is a mobile-first football quiniela app for peñas. Each peña opens a **porra** per jornada: members vote on a ticket, the admin turns the votes into one official boleto. The client is a Next.js 16 App Router app (React 19, Tailwind 4, Zod) talking to the real backend through server-side gateways. The UI redesign (dark green sports look, paper-ticket boleto, shell with bottom navigation) is done.

## Implemented

- **Auth:** email/password login and register, Google and X sign-in (server-side OAuth 2.0 + PKCE, provider tokens never reach the browser), HttpOnly session cookie (24 h), protected routes.
- **Groups:** `/groups`, `/groups/new`, `/groups/join`, `/groups/[groupId]` (members, roles, join code ticket, leave, creator delete, admin `show_picks` toggle, promote/demote/remove).
- **Jornadas:** `/jornadas` (list) and `/jornadas/[jornadaId]` (read-only information: matches with crests, schedule, editorial comments, bote, escrutinio from Losilla). It lists the user's porras for that jornada and, for admins of a peña without porra on an active jornada, "Crear porra en {peña}". Old `/results` routes redirect here.
- **Porra (member):** `/groups/[gid]/porras/[pid]` (header, my boleto status, participation, jornada info, sticky action bar), `/quiniela` (quick entry to the open porra), and the member boleto at `/groups/[gid]/porras/[pid]/boleto` as an intercepting-route sheet (bottom sheet with minimize on mobile, side panel on desktop; direct URL renders a full page), per-match info drawer, draft kept in sessionStorage until saved.
- **Porra (admin), Lot 3:**
  - Create at `/groups/[gid]/porras/nueva` (admin only, members go to `/forbidden`): active jornada, budget (euro input and chips 3/6/12/24 €), list of formats that fit, `POST` without a price (the backend resolves it); 409 links to the existing porra. Entry points: group page card and jornada page.
  - "Ajustes de la porra" card: change budget and format while open (`PATCH`), disabled once the final boleto exists.
  - "Boleto de la peña" card: "Calcular propuesta" shows the `Boleto` in `proposal` mode (chosen signs, 1/X/2 share bars, Simple/Doble/Triple tag, pleno proposal with per-team counts, "N de M han votado" and who is missing).
  - `/groups/[gid]/porras/[pid]/editar` (admin only, full page): `edit` mode prefilled from the existing final boleto or the proposal, live counters "Dobles x/D · Triples y/T", columns and cost, confirm blocked with Spanish reasons when it does not match the format or exceeds the budget (`PUT boleto`).
  - `/groups/[gid]/porras/[pid]/final`: `final` mode for every member with the "Boleto de la peña" stamp, columns, cost, who and when. Linked from the porra, the group page and a dashboard card.
- **Profile:** avatar upload/remove (type, size and magic-byte checks). No endpoints exist for display name, password or account deletion.

## Architecture

`server action/query -> application use case -> gateway -> HTTP/Zod adapter`, per feature under `src/features/*` (`auth`, `groups`, `jornadas`, `matchdays`, `porras`, `profile`, `results`). Components never own API URLs or decode payloads. `lib/http/json-client.ts` maps statuses to `ServiceError` codes and never shows backend `detail` text. `withSession` redirects to `/login` on 401. Money is always a decimal string handled with scaled integers (`moneyUnits`, `costFor`), never floats.

Porra logic lives in `features/porras/domain/logic.ts` (pure, tested): signs/draft helpers, `columnsFor` (2^D·3^T), `isValidFormat` (never (0,0)), `formatOptions` (the API's columns and cost, sorted, (0,0) dropped), `pricePerColumn`, `sharesOf`, `draftFromPropuesta` (prefers the API `pleno`), `proposePleno` (fallback only), `editCheck` (live remaining dobles/triples, format columns and cost). The `Boleto` component has four modes: `vote`, `proposal`, `edit`, `final`.

## Product rules in the client

- Minimum format: 2 columns (1 doble or 1 triple, 1,50 €). (0,0) is never offered, selected or sent (create, PATCH, formats list, editor); the client has no "sencilla" concept. Columns = 2^D·3^T and cost = columns × price, taken from the API (`columns`, `cost_eur`, format `coste_eur`).
- Price: 0,75 € per column in 2026/27, resolved by the backend from `recaudacion_bote_live.coste_apuesta_eur`; the client never sends it and shows `precio_apuesta_eur` of the porra / the formats values. 0,75 only remains as a last-resort display fallback. Reducidas and "tipo de jugada" are future work.
- The 422 "minimum format is 2 columns" (string or Pydantic array, create and PATCH) shows "El formato mínimo es de 2 columnas (1 doble o 1 triple).". The boleto PUT 422s ("expected N dobles/triples/simples…", "exceeds the budget") show specific Spanish copy.
- A boleto saved before the min-2-columns migration (e.g. 14 simples on a porra now (1,0)) still renders; `/final` notes the column mismatch and the editor lists what is missing so the admin can fix it.
- The admin decides the final boleto; the proposal is computed on demand (`POST propuesta`) and never saved. The pleno proposal is the API's top-level `pleno`; the client tally (most voted value per team, ties to fewer goals) is only a fallback for an older API without it.

## Phase-driven rules (jornada phase, not porra status)

- Every matchday carries the backend's `effective_phase` and `now` (`effectivePhase`, `serverNow`). An unknown phase parses as null; the domain then derives it exactly like the backend (`phaseOf`: draft = en_preparacion, past = escrutinio_disponible, active: sale not open yet = lista_abre_pronto, before the deadline = in_window, otherwise fuera_de_ventana, and a null `voting_closes_at` means closed). The derivation uses the server `now`, never the client clock.
- Allowed phases (helpers in `matchdays/domain/matchdays.ts`): `canVote` and `canCreatePorra` = in_window; `canEditPorra` (PATCH) = in_window and lista_abre_pronto; `canSetBoleto` (PUT) = lista_abre_pronto, in_window, fuera_de_ventana and escrutinio_pendiente. They gate the boleto form, the action bar, porra creation, "Ajustes de la porra" and the "Cambiar el boleto" / "Ajustar y confirmar" links and the `/editar` page.
- Porra state comes from `porraLifecycle({ phase, hasBoleto, status })` (`porras/domain/lifecycle.ts`): Votación abierta, La venta abre pronto, Votación cerrada · falta el boleto, Boleto confirmado, Finalizada, En preparación. `status === "closed"` stays an override to Finalizada. `porraSchema.status` accepts any string (unknown is not a failure). `/quiniela` lists only voting-open porras; admins also get "Pendiente de boleto".
- 409 bodies are parsed, not mapped by status: a string detail is a porra rule ("porra already exists" = `porra-exists`, "porra is closed" = `porra-closed`); a dict `{code, sale_opens_at, ...}` becomes `jornada-in-preparation`, `sale-not-opened` (with the opening date in Madrid time), `voting-window-closed`, `escrutinio-pending` or `escrutinio-disponible` (`lib/http/window-conflict.ts`). The boleto PUT has its own "La jornada ya ha terminado: el boleto ya no se puede cambiar." copy.
- Several active jornadas can overlap: the dashboard card and "Boleto de tu peña" iterate all of them, and `/quiniela` and the dashboard make one `GET /groups/{g}/porras` per peña (no `jornada_id`) instead of groups x jornadas calls.

## Backend notes (backend is the source of truth)

- `GET porra-formats` prices formats with the jornada's resolved price (no price parameter) and no longer lists (0,0); the first option is (1,0) = 2 columns. The client shows them as returned.
- Once a final boleto exists, `PATCH` of the format answers 422 "does not match the persisted boleto" and there is no way to delete the boleto, so the format is locked for good. The client disables the change and says so.
- Minimum format is enforced by the backend: `PorraCreateIn` and PATCH answer 422 for (0,0) and the DB has `ck_porra_min_columns` (migration `f4e5d6c7b8a9`).
- `propuesta` position 15 returns per-team counts; the proposed pleno is the top-level `pleno`.
- A non-member gets 403 "not a member of this group" on group-scoped routes (not 404); `loadGroup` sends them to `/forbidden` ("No perteneces a esta peña"). Non-admins also get 403 on admin endpoints; the client hides admin UI and still handles both.
- Backend gaps the client depends on (nothing to fix client-side): there is no porra-close endpoint and no boleto `DELETE`. `porra.status` is therefore always "open" and is no longer used to decide anything (see below).
- API drift history for auth, groups, results and profile: see `docs/architecture/API.md` and `docs/contracts/api-contract-policy.md`.

## Verification and next work

`pnpm lint` (one old warning in `public/animations-preview.mjs`), `pnpm exec tsc --noEmit`, `pnpm test` and `pnpm build` pass. The member and admin porra flows were exercised in a real browser at 360 and 1280 px against the local backend.

**Next:** tipo de jugada / reducidas, a way to unlock the format after the boleto exists (backend), Losilla percentages and a pleno result from the backend, an unlimited-column boleto (`activeColumns`).
