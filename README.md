# La Goyniela client

Mobile-first Next.js application with real email/password login and a protected route skeleton. Groups, matchdays, results, registration, and profile editing are explicitly not connected.

## Run locally

1. Run `pnpm install`.
2. Copy `.env.example` to `.env.local` and set the backend `API_BASE_URL`.
3. Run `pnpm dev` and open `/login` with an existing backend account.

Production requires HTTPS in the browser so the Secure session cookie works. Remote production API URLs must also use HTTPS; localhost HTTP is allowed for local backend development.

## Verify

```sh
pnpm lint
pnpm exec tsc --noEmit
pnpm test:auth
pnpm build
node --test public/animations.test.mjs
```

Auth tests use a fake transport, not a demo login or a live backend. Real backend login, expiry, logout, keyboard navigation, and mobile-browser validation still need an integration pass.

## Boundaries

- Server action → login use case → `AuthGateway` → HTTP/Zod adapter.
- API numeric IDs and snake_case fields map to string IDs and camelCase application models.
- Tokens stay server-side, in a HttpOnly, SameSite=Lax cookie (Secure in production), with a maximum 24-hour lifetime. There is no refresh flow.
- Every protected page validates `/auth/me`; the shared layout is an additional guard, not the sole security boundary. Authentication rejection returns to login; service failure reaches retry UI.
- Logging out deletes the browser session cookie. The documented API has no revocation endpoint, so this does not revoke a previously copied token.
- Server Components own this initial flow. TanStack Query and GSAP are available but deliberately unused until caching or purposeful motion is needed.

## Interim contract

[API.md](docs/architecture/API.md) is the current **interim authentication wire reference**. `contracts/openapi.yaml` still has no operations, so no generated SDK or OpenAPI coverage is claimed. This scoped implementation uses the documented JSON login body and `{detail}` failures, normalized into safe messages; it does not silently impose the future problem-details format on the backend.

See [client foundation](docs/architecture/client-foundation.md) for the long-term contract direction.

## UI status

The established dark-green palette is retained. Existing logo/pixel artwork is used sparingly. Tanker and Nippo font files are not supplied; system fallbacks are intentional. The installed taste skill informed brand-facing login hierarchy only, not dashboard/product behavior. No extra design system or motion library was added.
