# La Goyniela — Frontend Implementation Spec

> Para el dev que arma el cliente Next.js. Asume que ya leyó [`docs/API.md`](./API.md) (reference de endpoints) y [`docs/CLIENT.md`](./CLIENT.md) (guía de integración, auth flow, gotchas). Este doc agrega: **qué construir, en qué orden, qué errores manejar**.

**Versión API**: 0.8.x (sprint superadmin-panel aplicado — ver [§6](#6-cambios-de-contrato-recientes)).

---

## 1. Stack & setup

### 1.1 Stack (asumido)

- **Next.js 14+** (App Router) + TypeScript
- **TanStack Query** para server state + cache (form de picks, dashboard)
- **Zustand** o **React Context** para auth state en memoria
- **React Hook Form** + **Zod** para forms (login, picks)
- **CSS modules** o Tailwind (lo que prefieras)

### 1.2 Env vars del frontend

```bash
# .env.local (Next.js)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000  # dev
# NEXT_PUBLIC_API_BASE_URL=https://api.la-goyniela.example  # prod
```

### 1.3 Auth state — patrón mínimo

```typescript
// lib/auth.ts
"use client";
import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext<{
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}>(/* ... */);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch("/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setUser(u); else logout(); })
      .finally(() => setLoading(false));
  }, [token]);

  async function login(email: string, password: string) {
    const r = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) throw new Error("credenciales inválidas");
    const { access_token, user } = await r.json();
    setToken(access_token);
    setUser(user);
    localStorage.setItem("token", access_token);
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  return <AuthContext.Provider value={{ token, user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
```

### 1.4 Fetch wrapper centralizado

```typescript
// lib/api.ts
export async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const res = await fetch(`${baseUrl}${path}`, {
    ...opts,
    headers: {
      ...(opts.body && !(opts.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
    body: opts.body && !(opts.body instanceof FormData) && typeof opts.body !== "string"
      ? JSON.stringify(opts.body)
      : opts.body,
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("sesión expirada");
  }
  if (res.status === 204) return null as T;
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    const err = new Error(typeof body.detail === "string" ? body.detail : res.statusText);
    (err as any).status = res.status;
    (err as any).body = body;
    throw err;
  }
  return res.json();
}
```

---

## 2. Features en orden de implementación

Cada feature lista: **endpoints**, **UI states**, **errores a manejar**, **notas de UX**.

### F1. Auth (registro + login + me) — 30 min

| Endpoint | Uso |
|---|---|
| `POST /auth/register` | `/register` form |
| `POST /auth/login` | `/login` form |
| `GET /auth/me` | Al cargar la app si hay token |
| `POST /auth/google` | "Login con Google" button (id_token) |
| `POST /auth/x` | "Login con X" button (access_token) |

**UI**:
- `/login` y `/register` separados (o un toggle en la misma pantalla)
- Persistir token en `localStorage`
- Auto-logout en 401 (el wrapper ya lo hace)
- "Member since" en `/me` — el campo `created_at` ya está en la respuesta

**Errores**:
- 401: "credenciales inválidas" (NO "Authentication failed" — el backend ya no expone el detalle)
- 409 register: "ese email ya está registrado" (sin mostrar el email)

### F2. Grupos (lista + crear + unirse + detalle) — 1h

| Endpoint | Uso |
|---|---|
| `GET /groups` | Dashboard del user |
| `POST /groups` | "Crear peña" form |
| `POST /groups/join` | "Unirse con código" form |
| `GET /groups/{id}` | Detalle (members + role del caller) |
| `POST /groups/{id}/leave` | Botón "Salir del grupo" |
| `PATCH /groups/{id}` | Admin toggle `show_picks` |
| `POST /groups/{id}/members/{uid}/{promote,demote}` | Admin promover/degradar |
| `DELETE /groups/{id}/members/{uid}` | Admin quitar miembro |

**UI**:
- Dashboard: lista de cards con `{name, role, member_count, show_picks}`
- Botón "Crear peña" → modal/form → al éxito redirigir a `/groups/{id}` con el `join_code` prominente (botón "Copiar" + "Compartir por WhatsApp")
- "Unirse" → input de 6 chars, validación local (alfanumérico)
- Detalle del grupo: lista de miembros con roles + botones de admin (si role=admin)

**Errores (códigos, no texto!)** — importantes después del fix #5:

```typescript
const r = await api("/groups/join", { method: "POST", body: { join_code } });
// r.status === 400 con body.detail.code === "group_full" → "grupo lleno"
// r.status === 409 con body.detail.code === "already_member" → "ya sos miembro"
// r.status === 404 → "código inválido"
```

El cliente lee `body.detail.code`, NO el texto.

### F3. Picks (la feature principal) — 3-4h

| Endpoint | Uso |
|---|---|
| `GET /jornadas?status=active` | Encontrar la jornada activa |
| `GET /jornadas/{id}` | Ver los 15 partidos con `posicion`, `local_team_id`, `visitante_team_id` |
| `GET /api/v1/teams?competition_id=X` | Catálogo de equipos (cachear localmente, son ~423) |
| `GET /groups/{gid}/porras?jornada_id=N` | Ver si la peña ya tiene porra para esta jornada |
| `POST /groups/{gid}/porras` | Admin crea la porra (jornada + budget + formato) |
| `GET /groups/{gid}/porras/porra-formats?jornada_id=&budget_eur=` | Admin ve formatos que caben antes de crear |
| `GET /groups/{gid}/porras/{pid}/picks` | Ver quién votó (respeta `show_picks`) |
| `GET /groups/{gid}/porras/{pid}/picks/me` | Mis picks actuales |
| `POST /groups/{gid}/porras/{pid}/picks` | Submit mis 15 picks (free-form) |
| `POST /groups/{gid}/porras/{pid}/propuesta` | Admin ve la propuesta de la media |
| `PUT /groups/{gid}/porras/{pid}/boleto` | Admin guarda el boleto final |
| `GET /groups/{gid}/porras/{pid}/boleto` | Ver el boleto final guardado |

**Flujo completo**:

```typescript
// 1. Identificar la jornada activa
const activeJornadas = await api("/jornadas?status=active");
if (activeJornadas.length === 0) {
  // No hay jornada activa → mostrar "esperá la próxima"
}

// 2. Cargar mis picks actuales (puedo no tener)
const myPicks = await api(`/groups/${gid}/jornadas/${jid}/picks/me`).catch(() => null);

// 3. Ver si la votación está cerrada (CRÍTICO — deshabilitar form si pasó)
const now = new Date();
const closed = activeJornadas[0].voting_closes_at
  ? new Date(activeJornadas[0].voting_closes_at) <= now
  : false;
// El backend también rechaza con 403, pero cliente-side = mejor UX

// 4. Renderizar form con 15 inputs (ver §3)

// 5. Submit (idempotente — UPSERT)
await api(`/groups/${gid}/jornadas/${jid}/picks`, {
  method: "POST",
  body: { picks: [/* 15 items */] },
});
```

### F4. Consenso (admin) — 1h

| Endpoint | Uso |
|---|---|
| `POST /groups/{gid}/porras/{pid}/propuesta` | Botón "Generar propuesta de la media" (admin) |
| `PUT /groups/{gid}/porras/{pid}/boleto` | Botón "Guardar boleto final" (admin, después de editar) |

**UI**:

```typescript
async function generateConsensus() {
  try {
    const consensus = await api(`/groups/${gid}/jornadas/${jid}/consensus`, {
      method: "POST",
    });
    // Mostrar el reporte con:
    // - Para cada partido: local, visitante, vote_counts, consensus
    // - El boleto marcado (los signos a jugar)
  } catch (err) {
    if (err.status === 403) {
      // No sos admin
      return;
    }
    if (err.status === 409) {
      // body.detail.missing_voters: [{user_id, display_name}]
      // "Falta que voten: Bob, Carol"
      return;
    }
    throw err;
  }
}
```

### F5. Profile + uploads — 1h

| Endpoint | Uso |
|---|---|
| `GET /me` (no existe — usa `/auth/me`) | Ver perfil |
| `POST /users/me/avatar` | Subir avatar (multipart) |
| `DELETE /users/me/avatar` | Quitar avatar |

**Upload multipart** (importante):

```typescript
async function uploadAvatar(file: File) {
  const form = new FormData();
  form.append("file", file);
  // NO setear Content-Type manualmente — el browser lo hace
  const r = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/users/me/avatar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    body: form,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    if (r.status === 413) throw new Error("imagen demasiado grande (máx 5MB)");
    if (r.status === 415) throw new Error("solo se aceptan PNG, JPG, WebP");
    throw new Error(err.detail || "error subiendo avatar");
  }
  return r.json();
}
```

**Validación cliente** antes de subir:
- `file.size <= 5 * 1024 * 1024`
- `["image/png", "image/jpeg", "image/webp"].includes(file.type)`
- Preview con `URL.createObjectURL(file)` antes de subir

### F6. Equipos (catalog) — 30 min

| Endpoint | Uso |
|---|---|
| `GET /api/v1/teams` | Lista con filtros |
| `GET /api/v1/teams/{team_id}` | Detalle con `logo_url` |

**Patrón**:
- Cachear la lista completa (423 entries) en `localStorage` al primer load
- Refresh cada 24h o al primer load de la sesión
- Mostrar logos directo como `<img src={team.logo_url}>` (ya son URLs absolutas de R2)

---

## 3. El form de picks — la parte tricky

15 inputs, partidos 1-14 son `1/X/2` (free-form — 1, 2, o 3 signos), partido 15 es `{local, visitante}` con cada uno ∈ `{"0","1","2","M"}` (el viejo `pleno_signs: {M0, M1, M2}` está removido en MVP-05). Ver [`docs/CLIENT.md`](./CLIENT.md) §6.2 para el detalle completo del UI.

**Validación cliente antes de submit** (el backend valida server-side también):

```typescript
type PickPartido = { partido_orden: number; signs: ("1"|"X"|"2")[] };  // 1-3 elementos
type PickPleno = { partido_orden: 15; pleno: { local: "0"|"1"|"2"|"M"; visitante: "0"|"1"|"2"|"M" } };
type Pick = PickPartido | PickPleno;

const PLENO_VALUES = new Set(["0", "1", "2", "M"]);

function validatePicks(picks: Pick[]): string | null {
  if (picks.length !== 15) return "necesitás 15 picks";
  for (let i = 0; i < 14; i++) {
    if (picks[i].partido_orden !== i + 1) return `partido ${i+1} fuera de orden`;
    if (!Array.isArray((picks[i] as any).signs)) return `partido ${i+1}: debe tener signs (lista)`;
    const signs = (picks[i] as PickPartido).signs;
    if (signs.length < 1 || signs.length > 3) return `partido ${i+1}: signs debe tener 1-3 elementos`;
    for (const s of signs) if (!["1","X","2"].includes(s)) return `partido ${i+1}: signo ${s} inválido`;
    const set = new Set(signs);
    if (set.size !== signs.length) return `partido ${i+1}: signos duplicados`;
  }
  const pleno = picks[14];
  if (pleno.partido_orden !== 15) return "el último debe ser partido 15";
  if (!("pleno" in pleno)) return "partido 15 requiere pleno";
  if (!PLENO_VALUES.has(pleno.pleno.local)) return `partido 15: local ${pleno.pleno.local} inválido`;
  if (!PLENO_VALUES.has(pleno.pleno.visitante)) return `partido 15: visitante ${pleno.pleno.visitante} inválido`;
  return null;  // OK
}
```

**Reglas de UI**:
- 14 inputs multi-select (1/X/2) para partidos 1-14 — el miembro puede elegir 1, 2, o 3 signos (free-form). Chips: 1, X, 2 con toggle (max 3 seleccionados).
- Partido 15: dos selectores (local + visitante) con valores `{"0","1","2","M"}` cada uno.
- Disabled si `porra.status === "closed"` o la jornada no está `active`
- Disabled si `myPicks !== null && yaVotó` (o permitir editar — depende del UX)
- Botón "Guardar" — submit idempotente

---

## 4. Manejo de errores — el catálogo completo

Después de los 8 contract fixes, este es el catálogo actualizado:

| Status | Cuándo | Qué hacer en UI |
|---|---|---|
| `400` | Validación falla (full group, body malformed) | Mostrar `body.detail.message` o mensaje contextual |
| `401` | Token ausente/expirado | Auto-logout (ya en el wrapper) |
| `403` | No autorizado (no admin, no miembro, jornada cerrada, /votes fuera de plazo) | Mostrar `body.detail` |
| `404` | Recurso no existe | "No encontrado" |
| `409` | Conflicto: email duplicado, ya sos miembro, faltan voters en consensus | Mostrar `body.detail.code` (no texto) cuando esté disponible, sino `body.detail` |
| `413` | Upload > 5MB | "imagen demasiado grande" |
| `415` | Tipo de archivo no soportado | "solo PNG, JPG, WebP" |
| `422` | Pydantic validation (picks mal armados, variantes inválidas) | Mostrar `body.detail` |
| `500` | Error interno | "Algo salió mal, reintentá" + reportar |
| `502` | Upstream no disponible (X API caída) | "Servicio X no disponible" |

---

## 5. Orden de implementación recomendado

1. **F1 Auth** — base para todo lo demás (1h)
2. **F2 Grupos** — lista, crear, unirse (1h)
3. **F6 Equipos** — catalog en cache (30min, lo necesitan otras features)
4. **F3 Picks** — la feature principal (3-4h)
5. **F4 Consenso** — admin only (1h)
6. **F5 Profile + uploads** — final (1h)

**Total estimado**: 7-9 horas de dev + tests.

---

## 6. Cambios de contrato recientes

Estos 8 fixes + 1 sprint grande pueden afectar la integración si venías de una versión vieja. **El sprint superadmin-panel (oct 2026) es el cambio más grande desde MVP-05.**

### Breaking changes (cliente debe absorber)

1. **MVP-05**: los picks ya NO son per-jornada, son per-**porra**:
   ```ts
   // ❌ Viejo (MVP-04): POST /groups/{g}/jornadas/{j}/picks → 404 (no existe más)
   // ✅ Nuevo (MVP-05): el admin primero crea la porra, luego POST /groups/{g}/porras/{pid}/picks
   const porra = await api(`/groups/${gid}/porras`, {
     method: 'POST',
     body: { jornada_id: jid, budget_eur: 5.00, dobles: 1, triples: 1 },
   });
   await api(`/groups/${gid}/porras/${porra.id}/picks`, { method: 'POST', body: { picks: [...] }});
   ```

2. **Shape del error en `/groups/join`**:
   ```ts
   // ❌ Viejo: 409 con detail: "ya sos miembro" o "grupo lleno" (texto)
   // ✅ Nuevo: shape `{"detail": {"code": "group_full", "message": "..."}}`
   //    o `{"detail": {"code": "already_member", "message": "..."}}`
   // Lee body.detail.code, NO el texto
   ```

### Cambios que no rompen pero deberías usar

3. **`UserOut` incluye `created_at` e `is_active`** — usalos para "Member since" en el perfil.
4. **`POST /picks` valida `jornada.status == "active"`** — si la jornada no está active, devuelve 403.
5. **`POST /picks` valida variantes del pleno** (M0/M1/M2 con sets cerrados). 422 si una variante no es válida.
6. **Admin no puede promoverse/degradarse/removerse a sí mismo** — 400 con mensaje. Mostrar "no podés, usa `/leave`".
7. **`/auth/register` 409 no expone el email** en detail. Mostrar "ese email ya está registrado" sin mostrar el email.
8. **`/auth/x` 502 si X está caído** vs 401 si credenciales inválidas. Distinguir en UI ("servicio X no disponible" vs "credenciales inválidas").

### Sprint superadmin-panel (oct 2026) — el cambio grande

Este sprint cambia tres cosas: el **modelo de estados de jornada**, el **rol de admin**, y suma un **panel de superadmin** con rate limit y soft delete. Lo que tenés que actualizar en el cliente:

#### 6.1 `JornadaStatus` se reduce de 4 a 3 valores

```ts
// ❌ Viejo: 4 estados derivados (draft / active / closed / completed)
// ✅ Nuevo: 3 estados manuales (draft / active / past)
//
//   draft  — recién ingestada, no la ve el cliente todavía
//   active — el superadmin la abrió, el cliente puede votar
//   past   — el superadmin la cerró, queda como histórico
//
// El campo `status` ahora es LO QUE EL SUPERADMIN DICE (no derivado).
// `effective_phase` se sigue calculando (sigue teniendo 6 valores:
//   en_preparacion, lista_abre_pronto, in_window, fuera_de_ventana,
//   escrutinio_pendiente, escrutinio_disponible).
//   Para `past`, el default es `escrutinio_disponible`; el endpoint
//   /jornadas/{id} lo overridea con escrutinio_pendiente si la fila
//   de escrutinio todavía no se persistió.

type JornadaStatus = "draft" | "active" | "past";
```

#### 6.2 Nuevo rol `is_superadmin` (distinto del admin de grupo)

- `User.is_superadmin: boolean` — true SOLO para vos (dlro92trader@gmail.com). Para promover a otros, lo hacés vos desde el panel.
- El admin de grupo (`GroupMember.role === "admin"`) sigue existiendo para moderar tu propia peña. Es **distinto** del superadmin del sistema.
- El cliente Next.js NO necesita hacer nada con esto salvo ocultar la UI de superadmin a usuarios sin el flag.

#### 6.3 Panel de superadmin — endpoints nuevos

Todos bajo `/api/v1/admin/...` y rate-limited a **30 req/min por usuario** (429 con header `Retry-After: 60` cuando se pasa). Requieren `Authorization: Bearer <token>` de un usuario con `is_superadmin=true`.

```
# Users
GET    /api/v1/admin/users                      # listar (query: ?only_superadmins=true)
PATCH  /api/v1/admin/users/{id}                 # toggle is_superadmin / is_active
                                              # (400 si intentás degradar al último superadmin)

# Teams — edición completa (CRUD + soft delete + restore)
GET    /api/v1/admin/teams                      # query: ?include_deleted=true
POST   /api/v1/admin/teams                      # crear
GET    /api/v1/admin/teams/{id}
PATCH  /api/v1/admin/teams/{id}                 # editar todo: name, gender, country, logo_url, competition_id
DELETE /api/v1/admin/teams/{id}                 # soft-delete (409 si hay FK referenciándola)
POST   /api/v1/admin/teams/{id}/restore         # revivir soft-deleted

# Jornadas — lifecycle manual
GET    /api/v1/admin/jornadas                   # todas (incluye past + soft-deleted)
GET    /api/v1/admin/jornadas/{id}
PATCH  /api/v1/admin/jornadas/{id}              # status, sale_opens_at, voting_closes_at
POST   /api/v1/admin/jornadas/{id}/open         # draft → active (body: { sale_opens_at: ISO })
POST   /api/v1/admin/jornadas/{id}/close        # active → past
POST   /api/v1/admin/jornadas/{id}/reopen       # past → active
DELETE /api/v1/admin/jornadas/{id}              # soft-delete
POST   /api/v1/admin/jornadas/{id}/restore

# Composicion — para corregir lo que el scraper no trae bien
GET    /api/v1/admin/jornadas/{id}/composicion  # los 15
PATCH  /api/v1/admin/jornadas/{id}/composicion/{pos}  # { local_team_id, visitante_team_id, kickoff_at, competicion_raw }

# Ingest manual (fallback del cron)
POST   /api/v1/admin/ingest/quiniwin             # triggerea el mismo ingest que el cron
                                                # body opcional: { temporada, jornada_range_start, jornada_range_end, forward_cap, fetch_timeout_sec, run_losilla }
                                                # útil si el cron falla o querés bootstrap de temporada nueva
                                                # por defecto corre también Losilla live para las nuevas jornadas
```

> **Nota sobre el cron**: el cron diario 09:00 (`ingest_today_quiniwin_job`) ahora también encadena Losilla para las jornadas que acabá de insertar. O sea, **el cron y el endpoint manual hacen lo mismo** — no necesitás tocar el botón si el cron corrió bien. El botón es fallback para cuando el cron falla.

#### 6.4 Soft delete — `deleted_at` en team y jornada

```ts
// ❌ Viejo: GET /teams y GET /jornadas devolvían TODOS los registros
// ✅ Nuevo: filtran `deleted_at IS NULL` automáticamente
//    Para ver los soft-deleted: ?include_deleted=true (solo en /admin/teams)
//
// El panel del superadmin NUNCA muestra soft-deleted al cliente.
// Pero el admin los ve en /admin/teams?include_deleted=true (para revivir).
```

```ts
// Pydantic shape en responses:
type Team = {
  // ... campos existentes ...
  deleted_at: string | null;  // null = activo; ISO 8601 = soft-deleted
};

type Jornada = {
  // ... campos existentes ...
  deleted_at: string | null;
};
```

#### 6.5 Auto-transición `active → past` eliminada

Antes: el scheduler movía jornadas a `past` automáticamente cuando el escrutinio se publicaba.
Ahora: **vos la movés a mano** desde el panel. No hay cron que cambie el status de una jornada. Si te olvidás, queda en `active` para siempre. (Esto es a propósito: el control es tuyo.)

#### 6.6 Multi-jornada activa por grupo (esto YA funcionaba, ahora es explícito)

Un grupo puede crear porras para J5 y J6 al mismo tiempo si ambas están en `active`. No hay tope. El form de picks debería mostrar todas las porras activas del grupo con un selector ("¿Qué jornada querés votar?").

#### 6.7 Rate limit — 429 con `Retry-After`

```ts
// Si te pasás de 300 req/min en endpoints /api/v1/admin/...:
const r = await fetch("/api/v1/admin/teams", { headers: { Authorization: ... } });
if (r.status === 429) {
  const retryAfter = Number(r.headers.get("Retry-After")); // 60 segundos
  // Mostrarle al admin: "Demasiadas requests. Reintentá en {retryAfter}s"
  // No hacer retry inmediato — esperar.
}
```

> **Nota interna**: el rate limit hoy se keyea por IP (no por user_id) porque el middleware corre antes de la auth dependency. Si en el futuro hace falta per-user real, hay que mover el middleware. Para 1 instancia de la API es suficiente.

#### 6.8 TypeScript types sugeridos (copiar en `types/api.ts`)

```ts
// types/api.ts — agregar al final

export type JornadaStatus = "draft" | "active" | "past";

export interface AdminTeam {
  id: number;
  entity_id: string;
  canonical_name: string;
  short_name: string | null;
  gender: "men" | "women" | null;
  gender_known: boolean;
  country: string | null;
  logo_url: string | null;
  competition_id: string;
  deleted_at: string | null;
}

export interface AdminJornada {
  id: number;
  temporada: number;
  temporada_str: string;
  numero: number;
  status: JornadaStatus;
  sale_opens_at: string | null;
  voting_closes_at: string | null;
  kickoff_first_match_at: string | null;
  kickoff_last_match_at: string | null;
  escrutinio_expected_at: string | null;
  fetched_at: string;
  deleted_at: string | null;
}

export interface AdminUser {
  id: number;
  email: string;
  display_name: string;
  is_active: boolean;
  is_superadmin: boolean;
  created_at: string;
}

export interface AdminComposicion {
  posicion: number;
  local_team_id: number;
  visitante_team_id: number;
  local_raw: string;
  visitante_raw: string;
  kickoff_at: string | null;
  competicion_raw: string | null;
}

// Patches
export interface TeamPatchIn {
  canonical_name?: string;
  short_name?: string | null;
  gender?: "men" | "women" | null;
  gender_known?: boolean;
  country?: string | null;
  logo_url?: string | null;
  competition_id?: string;
}

export interface JornadaPatchIn {
  status?: JornadaStatus;
  sale_opens_at?: string | null;
  voting_closes_at?: string | null;
}

export interface ComposicionPatchIn {
  local_team_id?: number;
  visitante_team_id?: number;
  kickoff_at?: string | null;
  competicion_raw?: string | null;
}
```

#### 6.9 Checklist de integración para el cliente

- [ ] Reemplazar `"closed" | "completed"` en el switch de status → `"past"`
- [ ] Ocultar botones de superadmin si `currentUser.is_superadmin !== true`
- [ ] En el form de picks: si el grupo tiene múltiples porras activas, agregar selector "¿Qué jornada?"
- [ ] Manejar `429 Retry-After` con un toast/loading state (no reintentar ciegamente)
- [ ] Si mostrás el detalle de una `Jornada.deleted_at !== null` en algún lado cacheado, refrescar al volver
- [ ] (opcional) UI admin que llame a los endpoints de §6.3 — el dev frontend lo hace aparte

#### 6.10 Chained ingest — qué entra en cada "ingest"

Para que el dev del cliente entienda cuándo aparece cada dato en la API:

| Dato | Cuándo aparece |
|---|---|
| Jornada (status=draft) + 15 composicion (equipos + partidos) | Inmediatamente después del Quiniwin ingest (cron 09:00 o botón manual) |
| 15 comentarios editoriales (partidos 1–14) | Inmediatamente después del Losilla live ingest (encadenado al Quiniwin) |
| Comentario sintético del partido 15 | Idem (generado desde porc_15L/V) |
| Estimaciones 1X2 (partidos 1–14) + Pleno al 15 splits | Idem (encadenado al Quiniwin) |
| Escrutinio oficial (acertantes, premios, bote) | **Solo después** de que la jornada cierra. Lo trae el cron de las 23:00 (`losilla_poll_recent_closed_job`), o el semanal del lunes, o vos lo forzás a mano |

Implicancia para el cliente: la primera vez que ves `jornadas/{id}` para una jornada recién ingestada, el `escrutinio` viene como `null` (o no aparece el bloque). Eso es correcto — esperá a que cierre.

#### 6.11 Response shape del endpoint de ingest manual

Cuando el superadmin clickea "Ingest" en el panel, el backend devuelve el mismo shape que el cron loguea en `fetch_session.source_stats`:

```ts
interface IngestResponse {
  quiniwin: {
    status: "ok" | "partial" | "noop";
    temporada: number;                       // ej. 2026
    max_known_jornada: number | null;        // el J más alto que ya conocíamos antes del run
    jornadas: Array<{
      status: "ok" | "error";
      jornada: number;                       // 1..42
      jornadas_inserted: number;             // 0 = ya existía; 1 = recién creada
      jornadas_existing: number;
      composicion_inserted: number;          // 0 o 15
      composicion_existing: number;
      stubs_created: number;                 // teams nuevos en team_identity_map
    }>;
    ok_count: number;
    fail_count: number;
  };
  losilla_per_jornada: Record<number, {     // keyed por jornada_numero
    status: "ok" | "error";
    escrutinio_inserted: boolean;            // false si la jornada aún no cerró
    escrutinio_existed: boolean;
    comentarios_inserted: number;            // 0 o 15
    comentarios_updated: number;
    comentarios_existing: number;
    network_failures: string[];
    error?: string;                          // presente si status="error"
  }>;
}
```

#### 6.12 UI del panel superadmin (referencia)

El dev frontend que arme la UI del superadmin necesita renderizar como mínimo:

- **Lista de jornadas** (`GET /api/v1/admin/jornadas`) con badge de status (`draft` / `active` / `past`) + acciones:
  - `Open` (draft → active, pide `sale_opens_at`)
  - `Close` (active → past)
  - `Reopen` (past → active)
  - `Soft delete` / `Restore`
- **Botón "Ingest Quiniwin"** → llama `POST /api/v1/admin/ingest/quiniwin` → muestra el response completo de §6.11 (Quiniwin + Losilla chained).
- **Lista de teams** (`GET /api/v1/admin/teams?include_deleted=...`) con botones:
  - Edit (PATCH)
  - Soft delete (DELETE — falla con 409 si hay FK)
  - Restore (POST /restore)
- **Editor de composicion** (`GET /api/v1/admin/jornadas/{id}/composicion`) con PATCH por partido para corregir `local_team_id`, `visitante_team_id`, `kickoff_at`, `competicion_raw`. **Después de PATCH, el backend recalcula `kickoff_last_match_at` / `voting_closes_at` / `escrutinio_expected_at` automáticamente** — el cliente no necesita.
- **Lista de users** (`GET /api/v1/admin/users`) para promover/degradar `is_superadmin` (con guard: no podés degradar al último superadmin).
- **Banner de rate limit**: si ves 429, mostrar "Demasiadas requests, reintentá en 60s" (parseá `Retry-After` del header).

#### 6.13 Sprint intuicion + PDF (oct 2026) — modo personal

Este sprint agrega un **4to modo de porra** (`intuicion`), un **budget advisor** que sugiere (columnas, fijos) según el presupuesto, y un **endpoint para descargar el boleto como PDF**. Es el modo "personal" — la peña pone los fijos que conoce y varía el resto.

##### 6.13.1 Nuevo campo `modo` en la porra

```ts
type PorraModo = "multiple" | "sencilla" | "reducida" | "intuicion";

// Para todos los modos (PorraCreateIn, PorraPatchIn, PorraOut):
interface PorraModoFields {
  modo: PorraModo;                 // default: "multiple" (backwards-compat)
  fijos?: number | null;           // solo intuicion: 0..13
  columnas?: number | null;        // solo intuicion: 2..12
}

// Para el modo "intuicion":
//   fijos + variables = 14
//   columnas × precio_apuesta_eur ≤ budget_eur
//   variables = 14 - fijos
```

Ejemplo: una porra con `modo: "intuicion", fijos: 10, columnas: 6, budget_eur: 5.00, precio_apuesta_eur: 0.75` significa: "6 columnas, 10 fijos, 4 variables, coste 4.50€".

##### 6.13.2 Budget advisor — `GET /porras/intuicion-options?budget=X`

Endpoint nuevo que devuelve las opciones `(columnas, fijos)` que entran en un presupuesto.

**Request**:
```
GET /api/v1/groups/{g}/porras/intuicion-options?budget_eur=5.00
```

**Response** (200):
```json
{
  "budget_eur": "5.00",
  "options": [
    { "columnas": 6, "fijos": 10, "variables": 4, "cost_eur": "4.50" },
    { "columnas": 5, "fijos": 11, "variables": 3, "cost_eur": "3.75" },
    { "columnas": 4, "fijos": 11, "variables": 3, "cost_eur": "3.00" },
    { "columnas": 3, "fijos": 12, "variables": 2, "cost_eur": "2.25" },
    { "columnas": 2, "fijos": 13, "variables": 1, "cost_eur": "1.50" }
  ]
}
```

- **Auth**: cualquier miembro del grupo (no requiere admin)
- **Orden**: `columnas` DESC (más cobertura primero)
- **`variables = 14 - fijos`** siempre (fijos + variables = 14)
- **Tabla de 11 opciones** (de 2/13 a 12/7); solo se devuelven las que caben en el budget

**Tabla completa** (lo que devuelve el advisor cuando hay budget):
| Columnas | Fijos | Variables | Coste @ 0.75€ |
|---|---|---|---|
| 2 | 13 | 1 | 1.50€ |
| 3 | 12 | 2 | 2.25€ |
| 4 | 11 | 3 | 3.00€ |
| 5 | 11 | 3 | 3.75€ |
| 6 | 10 | 4 | 4.50€ |
| 7 | 10 | 4 | 5.25€ |
| 8 | 9 | 5 | 6.00€ |
| 9 | 9 | 5 | 6.75€ |
| 10 | 8 | 6 | 7.50€ |
| 11 | 8 | 6 | 8.25€ |
| 12 | 7 | 7 | 9.00€ |

##### 6.13.3 Creación de porra con modo intuicion

**Request**:
```http
POST /api/v1/groups/{g}/porras
{
  "jornada_id": 1,
  "budget_eur": "5.00",
  "modo": "intuicion",
  "fijos": 10,
  "columnas": 6,
  "precio_apuesta_eur": "0.75"
}
```

**Validaciones** (422 con mensaje si falla):
- `modo: "intuicion"` requiere `fijos` y `columnas` (ambos obligatorios)
- `0 ≤ fijos ≤ 13`, `2 ≤ columnas ≤ 12`
- `columnas × precio_apuesta_eur ≤ budget_eur` (con precio 0.75€ por default si no se manda)
- Para los otros modos (`sencilla`, `multiple`, `reducida`) — sin cambios, siguen funcionando con sus reglas actuales

**Response**: `PorraOut` con los nuevos campos `modo`, `fijos`, `columnas` poblados.

##### 6.13.4 PATCH porra con modo intuicion

Igual que antes, pero ahora se puede cambiar `modo`, `fijos` y/o `columnas` (con las mismas validaciones que POST). Si ya hay boleto guardado, hay que borrarlo antes (`DELETE /boleto`) para poder cambiar el modo — el backend devuelve 422 con mensaje si intentás cambiar el formato con un boleto existente.

##### 6.13.5 PDF del boleto — `GET /porras/{p}/boleto.pdf`

Endpoint nuevo que devuelve el boleto final como **PDF descargable** (no JSON). Ideal para el botón "Calcular apuesta" del flujo de admin.

**Request**:
```
GET /api/v1/groups/{g}/porras/{p}/boleto.pdf
```

**Response** (200, `Content-Type: application/pdf`):
```
Content-Disposition: attachment; filename="boleto_j11_g1_p42.pdf"

%PDF-1.3
... (1 página A4)
```

Layout del PDF (1 página, Helvetica):
```
LA QUINIELA - Boleto oficial
Grupo: <name>   Jornada: 11   Temporada: 26/27
─────────────────────────────────────────
Partido    Enfrentamiento              Signo(s)
1          Real Madrid vs Barcelona        1
2          Atletico vs Sevilla             X
...
14         Valencia vs Villarreal          2
Pleno al 15:  0 - 0
─────────────────────────────────────────
Coste: 1.50 EUR   Columnas: 2   Precio/columna: 0.75 EUR
Generado: 2026-10-08 18:33 UTC   Porra ID: 42
```

- **Auth**: cualquier miembro del grupo (no requiere admin)
- **Errores**:
  - `404` si no hay boleto guardado todavía
  - `403` si el caller no es miembro del grupo
  - `200` con `application/pdf` cuando hay boleto

**Uso típico** en el cliente:
```ts
// Después de PUT /boleto exitoso:
const r = await fetch(`/api/v1/groups/${gid}/porras/${pid}/boleto.pdf`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!r.ok) {
  if (r.status === 404) toast.error("Guardá el boleto antes de descargarlo");
  return;
}
const blob = await r.blob();
const url = URL.createObjectURL(blob);
window.open(url, "_blank");  // o disparar download con <a download>
```

**Nota sobre acentos**: el PDF usa Helvetica (Latin-1) por default — acentos en nombres de equipo (`Atlético`) se renderizan como `?`. Si el cliente necesita acentos correctos, hay que registrar una fuente TTF (ej. DejaVu Sans) — fuera del alcance de este sprint.

##### 6.13.6 TypeScript types sugeridos

```ts
// types/api.ts — agregar al final

export type PorraModo = "multiple" | "sencilla" | "reducida" | "intuicion";

export interface IntuicionOptionOut {
  columnas: number;        // 2..12
  fijos: number;           // 0..13
  variables: number;       // 1..14 (= 14 - fijos)
  cost_eur: string;        // Decimal as string
}

export interface IntuicionOptionsOut {
  budget_eur: string;
  options: IntuicionOptionOut[];
}

export interface PorraCreateInIntuicion extends PorraCreateInBase {
  modo: "intuicion";
  fijos: number;           // obligatorio
  columnas: number;        // obligatorio
  // dobles/triples NO se mandan
}

export interface PorraCreateInMultiple extends PorraCreateInBase {
  modo?: "multiple";       // default
  dobles: number;
  triples: number;
}

// Discriminated union para el body de POST /porras
export type PorraCreateIn = PorraCreateInMultiple | PorraCreateInIntuicion;
```

##### 6.13.7 Flujo UI sugerido para el botón "Calcular apuesta"

```
┌─ Porra J11 — Modo intuicion ─────────────────┐
│  Presupuesto: [  5.00 €   ▼]                  │
│  ┌─ Opciones del budget advisor ─────────┐   │
│  │ ○ 6 columnas · 10 fijos · 4.50€       │   │
│  │ ● 5 columnas · 11 fijos · 3.75€ ←     │   │
│  │ ○ 4 columnas · 11 fijos · 3.00€       │   │
│  │ ○ 3 columnas · 12 fijos · 2.25€       │   │
│  │ ○ 2 columnas · 13 fijos · 1.50€       │   │
│  └────────────────────────────────────────┘   │
│                                                │
│  [ Generar boleto ]                            │
│  → POST /porras { modo: "intuicion", ... }    │
│                                                │
│  ─ Tras generar ─                              │
│  [ Ver propuesta ] [ Rellenar columnas ]       │
│                                                │
│  ─ Tras confirmar (PUT /boleto) ─              │
│  [ Descargar PDF ]  → GET /boleto.pdf          │
└────────────────────────────────────────────────┘
```

##### 6.13.8 Checklist de integración

- [ ] Agregar `modo`, `fijos`, `columnas` a tu form de creación de porra
- [ ] Si `modo === "intuicion"`, mostrar el budget advisor (`GET /intuicion-options?budget=X`) y dejar al admin elegir una opción
- [ ] Mostrar `variables` calculado (14 - fijos) en la UI para que el peña entienda cuántos partidos varía
- [ ] Agregar botón "Descargar PDF" en la pantalla del boleto confirmado (usa el endpoint `boleto.pdf`)
- [ ] NO asumir que `boleto.pdf` devuelve JSON — manejar el `Blob` con `URL.createObjectURL`

---

## 7. Variables de entorno del backend que afectan al cliente

| Variable | Efecto en el cliente |
|---|---|
| `STORAGE_PUBLIC_BASE_URL` (S3/R2) | URLs de logos. Ya vienen absolutas desde la API. |
| `STORAGE_BACKEND` | No afecta al cliente (es interno del server). |
| `STORAGE_LOCAL_PATH` | Solo en dev — el server sirve archivos vía `/static/uploads/`. |

---

## 8. Test checklist pre-merge

Antes de mergear el cliente:

- [ ] Auth flow: register, login, logout, "Member since" en `/me`
- [ ] `/groups` lista con cards correctas (nombre, role, member_count)
- [ ] `/groups/:gid` muestra members + role del caller + botones admin si corresponde
- [ ] `/groups/join` con código inválido → 404 con texto "código inválido"
- [ ] `/groups/join` ya miembro → 409 + código `already_member`
- [ ] `/groups/join` grupo lleno → 400 + código `group_full`
- [ ] Toggle `show_picks` (admin) refleja inmediatamente en la lista de picks
- [ ] Picks form: 14 inputs + 1 pleno multi-sign
- [ ] Submit picks → 200, idempotente (segundo submit no duplica)
- [ ] Submit picks con variante inválida → 422
- [ ] Submit picks en jornada `draft` o `completed` → 403
- [ ] Submit picks con `voting_closes_at` pasado → 403
- [ ] Mostrar "quién votó" respeta `show_picks` (solo nombres si false, picks si true)
- [ ] Consensus: solo admin puede disparar
- [ ] Consensus: 409 muestra `missing_voters` correctamente
- [ ] Consensus: muestra el reporte completo cuando 200
- [ ] Upload avatar: validación cliente (size + type), preview, error messages claros
- [ ] Polling cada 30s en `/groups/:gid` para "live" del estado de votación
- [ ] No mostrar `competicion_raw` (siempre es `null`)
- [ ] Consensus siempre devuelve 3 keys M0/M1/M2 en `pleno`, aunque vacías
- [ ] NO setear `Content-Type` en uploads (browser lo hace)

---

## 9. Recursos

- [`docs/API.md`](./API.md) — reference de cada endpoint con curl + JSON shape
- [`docs/CLIENT.md`](./CLIENT.md) — auth flow, fetch wrapper, gotchas, multipart, polling
- [`docs/HANDOFF-NEXT-SESSION.md`](./HANDOFF-NEXT-SESSION.md) — los 8 contract fixes (referencia histórica)
- `http://localhost:8000/docs` — Swagger UI interactivo
- `http://localhost:8000/openapi.json` — para generar SDKs con `openapi-generator`