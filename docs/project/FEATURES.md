# La Goyniela — Feature Specification

> Documento de referencia para el dev que implementa el cliente. Cubre **qué hace cada feature, qué endpoints usa, qué validaciones aplica, qué permisos requiere, y cómo debe comportarse la UI en cada estado**. Asume que ya leyó [`API.md`](./API.md) (reference de endpoints) y [`CLIENT.md`](./CLIENT.md) (patrones de integración).

---

## 1. Overview

**La Goyniela** es una app de peña de La Quiniela (sorteo español). Un grupo de amigos quiere hacer una jugada grupal cada jornada, así que:

1. Se registran
2. Crean o se unen a un grupo (peña) con un código de 6 caracteres
3. Ven la próxima jornada activa con los 15 partidos
4. Cada uno vota sus 15 pronósticos (incluyendo el pleno al 15 multi-sign)
6. El admin genera el boleto consensuado cuando todos hayan votado
7. (Futuro) Scoring automático cuando se cierra la jornada y hay escrutinio

**Multi-tenancy**: cada grupo es un tenant aislado. Los picks son siempre por (grupo, jornada). No hay grupos "públicos" en MVP.

**Roles**: `creator` (admin implícito, inmutable) > `admin` (promoted) > `member` (default).

---

## 2. Conceptos

| Concepto | Definición |
|---|---|
| **Jornada** | Una semana de La Quiniela. Tiene 15 partidos. Estados: `draft` (Quiniwin publicó) → `active` (votación abierta) → `closed` (escrutinio oficial) → `completed` (scoring calculado). |
| **Composición** | Cada uno de los 15 partidos de una jornada. Tiene `local_team` y `visitante_team`. |
| **Pick** | Pronóstico de un user sobre un partido. `sign ∈ {1, X, 2}` para 1-14; `pleno_signs` (dict M0/M1/M2 → variants) para el 15. |
| **Pleno al 15** | Partido 15, multi-sign. M0 = "0-0", M1 = "1 gol total", M2 = "2+ goles". Cada M-column tiene variants permitidas. |
| **Consenso** | Boleto que juega el grupo. Se computa de los votos: para 1-14 el/los más votados; para el 15, unión de variants por M-columna. |
| **`show_picks`** | Toggle del grupo (admin decide). Si `false`: solo se ve quién votó. Si `true`: se ven los picks completos de todos. |
| **`voting_closes_at`** | Timestamp del cierre de votación. Server-side enforce: POST /picks después → 403. |

---

## 3. Features

### 3.1 Auth (registro, login, OAuth, /me)

#### Endpoints

| Método | Ruta | Auth | Body | Devuelve |
|---|---|---|---|---|
| `POST` | `/auth/register` | público | `{email, password, display_name}` | 201 `{access_token, user}` |
| `POST` | `/auth/login` | público | `{email, password}` | 200 `{access_token, user}` |
| `POST` | `/auth/google` | público | `{id_token}` | 200/201 `{access_token, user}` |
| `POST` | `/auth/x` | público | `{access_token}` | 200/201 `{access_token, user}` |
| `GET` | `/auth/me` | Bearer | — | 200 `user` |

#### Validaciones

- **register**: email válido + único, password ≥ 8 chars, display_name ≥ 1 char
- **register 409**: email duplicado. **El `detail` NO incluye el email** (post-fix #7).
- **login 401**: credenciales inválidas. Detail genérico.
- **google 401**: id_token inválido/expirado. Detail: `"google authentication failed"`. Log interno con stack.
- **google 5xx**: error upstream con Google. Detail: `"google authentication failed"`.
- **x 401**: access_token inválido (credenciales malas). Detail: `"invalid x credentials"`.
- **x 502** (post-fix #8): X API caída o inalcanzable. Detail: `"x service unavailable"`. **Distinto de 401**: el cliente debe mostrar "X no disponible" vs "credenciales inválidas".

#### Token lifecycle

- JWT HS256, expira **24h** (1440 min). No hay refresh tokens en MVP.
- Persistir en `localStorage` con key `token`.
- En cada page load: si hay token → `/auth/me` para hidratar sesión. Si 401 → logout.
- En 401 durante cualquier request → logout forzado.

#### UI/UX

- `/login` y `/register` separados. Register pide password 2 veces.
- Display "Member since YYYY-MM-DD" en perfil (`UserOut.created_at`).
- Después de register/login → redirigir a `/` (dashboard con grupos).
- Logout → confirmar modal ("¿Salir?") + limpiar localStorage.

#### OAuth (Google / X)

- Botón "Continuar con Google" abre Google Sign-In SDK → toma `id_token` → `POST /auth/google`.
- Botón "Continuar con X" abre OAuth flow de X → toma `access_token` → `POST /auth/x`.
- **NO hay flujo OAuth server-side** en MVP — el cliente maneja el OAuth flow y solo manda el token.

---

### 3.2 Profile + avatar (F2)

#### Endpoints

| Método | Ruta | Auth | Body | Devuelve |
|---|---|---|---|---|
| `GET` | `/auth/me` | Bearer | — | 200 `user` |
| `POST` | `/users/me/avatar` | Bearer | `multipart/form-data: file` | 200 `{user_id, avatar_url}` |
| `DELETE` | `/users/me/avatar` | Bearer | — | 204 |

#### Avatar upload

- Validación cliente (pre-submit):
  - `file.size <= 5 MB`
  - `file.type ∈ {image/png, image/jpeg, image/webp}`
  - Preview con `URL.createObjectURL(file)`
- **NO setear `Content-Type`** en el request — el browser lo hace con el boundary
- Validación server-side: max 5MB, magic bytes del archivo (no solo content-type header)
- Errores:
  - `413`: "imagen demasiado grande (máx 5 MB)"
  - `415`: "solo se aceptan PNG, JPG, WebP"
  - `400`: magic bytes no matchean content-type (archivo "falseado")
  - `200`: `{user_id, avatar_url}` (URL absoluta de R2)

#### Avatar display

- `UserOut.avatar_url: str | None` — URL absoluta o `null`.
- Si `null` → mostrar placeholder (icon genérico, iniciales del display_name, o default).
- Si URL → `<img src={user.avatar_url}>` directamente.

---

### 3.3 Grupos (F3) — la entidad multi-tenant

#### Endpoints

| Método | Ruta | Auth | Body | Devuelve |
|---|---|---|---|---|
| `POST` | `/groups` | Bearer | `{name, description?}` | 201 `group` (incluye `join_code`) |
| `GET` | `/groups` | Bearer | — | 200 `[{id, name, member_count, role, show_picks}]` |
| `POST` | `/groups/join` | Bearer | `{join_code}` | 200 `{id, name, role}` |
| `GET` | `/groups/{id}` | Miembro | — | 200 `group_detail` (con members + role del caller) |
| `POST` | `/groups/{id}/leave` | Miembro (no creator) | — | 204 |
| `DELETE` | `/groups/{id}` | Creator | — | 204 |
| `PATCH` | `/groups/{id}` | Admin | `{show_picks}` | 200 `group` |
| `POST` | `/groups/{id}/members/{uid}/promote` | Admin | — | 204 |
| `POST` | `/groups/{id}/members/{uid}/demote` | Admin | — | 204 |
| `DELETE` | `/groups/{id}/members/{uid}` | Admin | — | 204 |

#### Validaciones

- `name`: 2-30 chars, requerido
- `description`: max 500 chars, opcional
- `max_members`: default 50, no editable en MVP
- `join_code`: 6 chars alfanuméricos sin ambigüedad (sin `0/O/1/I/l`). **Case-sensitive**.

#### Errores (post-fixes #4 y #5)

```typescript
// POST /groups/join
r.status === 400 && r.body.detail.code === "group_full"      // grupo lleno
r.status === 409 && r.body.detail.code === "already_member"  // ya sos miembro
r.status === 404                                                    // código no existe

// POST /groups/{id}/leave (NO si sos creator)
r.status === 400 && r.body.detail === "creator cannot leave"  // creator intenta salirse

// POST /groups/{id}/members/{uid}/{promote,demote} (NO si target == caller)
r.status === 400                                                       // "cannot promote yourself" / "cannot demote yourself"

// DELETE /groups/{id}/members/{uid} (NO si target == caller)
r.status === 400                                                       // "cannot remove yourself"

// POST /groups/{id}/members/{uid}/demote (NO si target es creator)
r.status === 400                                                       // "cannot demote creator"
```

#### Roles

| Rol | Puede |
|---|---|
| **creator** (implícito) | Todo del admin + DELETE /groups + NO puede ser kickeado/demoteado/expulsado |
| **admin** | promote/demote/remove members, PATCH show_picks, POST consensus, dejar grupo |
| **member** | Ver, votar, dejar grupo |

#### UI/UX

- **Crear grupo**: modal con `name` + opcional `description`. Al éxito → redirigir a `/groups/{id}` y **mostrar el `join_code` prominentemente** (botón "Copiar" + "Compartir por WhatsApp").
- **Unirse**: input de 6 chars + botón. Validación local: uppercase + alfanumérico.
- **Detalle del grupo**:
  - Lista de miembros con `role` visible
  - Si `role === "admin"`: botones adicionales (toggle show_picks, promover/degradar/expulsar)
  - Si soy creator: indicador visual + botón "Eliminar grupo" (con confirm)
  - Si role === "admin" (no creator): NO mostrar el toggle de "Eliminar grupo"
- **Salir**: confirmar modal ("¿Salir de [nombre]? Vas a perder acceso a los picks de este grupo")
- **Eliminar grupo** (creator): confirmar modal doble ("Esta acción no se puede deshacer")

---

### 3.4 Teams catalog (F4) — solo para browse

#### Endpoints

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/api/v1/teams` | público | 200 `{items: [...], total, limit, offset}` |
| `GET` | `/api/v1/teams/{team_id}` | público | 200 `TeamOut` |

#### Filtros

- `?competition_id=laliga-ea-sports` (también `liga-f`, `uefa-champions-league`, etc.)
- `?gender=men|women`
- `?country=ESP` (3-letter ISO)
- `?q=substring` (busca en `canonical_name`)
- `?limit=N&offset=N` (default 50, max 200)

#### Caching strategy (cliente)

- Fetch la lista completa **una vez al primer load de la sesión** (423 entries, ~80KB).
- Cache en localStorage con TTL 24h.
- Refresh solo al primer load de sesión (no polling).
- El display de logos en picks/consensus viene del embed de `/jornadas/{id}` y `/picks`, NO de este endpoint.

---

### 3.5 Jornadas (F5) — el corazón de la app

#### Endpoints

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/jornadas` | público | 200 `[{jornada_summary}, ...]` |
| `GET` | `/jornadas?status=active` | público | 200 `[{jornada_summary con status=active}]` |
| `GET` | `/jornadas/{id}` | público | 200 `jornada_detail` (con 15 partidos + team embebido) |

#### Estados

| Estado | Significado | UI |
|---|---|---|
| `draft` | Quiniwin publicó pero sin voting_closes_at | "próximamente" |
| `active` | Votación abierta | Mostrar form de picks |
| `closed` | Escrutinio oficial disponible | "cerrada, sin consenso" |
| `completed` | Scoring calculado (futuro) | "cerrada, scoring hecho" |

#### Lógica del cliente

```typescript
// 1. Buscar jornada activa para el grupo del user
const activeJornadas = await api(`/jornadas?status=active`);
const jornada = activeJornadas[0];

// 2. Si no hay → mostrar "no hay jornada activa, esperá la próxima"
// 3. Si hay → cargar `/jornadas/{id}` para tener los 15 partidos con team embebido

// 4. Verificar si la votación está cerrada
const closed = jornada.voting_closes_at
  ? new Date(jornada.voting_closes_at) <= new Date()
  : false;
// → si closed: deshabilitar form, mostrar "votación cerrada"
// → si !closed y status === 'active': habilitar form

// 5. Ver si el user ya votó
const myPicks = await api(`/groups/${gid}/jornadas/${jornada.id}/picks/me`).catch(() => null);

// 6. Render: form editable si no closed y no voted
```

---

### 3.6 Picks (F6) — la feature principal

#### Endpoints

| Método | Ruta | Auth | Body | Devuelve |
|---|---|---|---|---|
| `POST` | `/groups/{gid}/jornadas/{jid}/picks` | Miembro | `{picks: [15 items]}` | 200 `{saved, picks}` |
| `GET` | `/groups/{gid}/jornadas/{jid}/picks` | Miembro | — | 200 `GroupPicksOut` |
| `GET` | `/groups/{gid}/jornadas/{jid}/picks/me` | Miembro | — | 200 `[PickOut, ...]` |

⚠️ **Ruta importante** (post-fix #1): el endpoint de submit es `/groups/{gid}/jornadas/{jid}/**picks**` (con sufijo `/picks`), NO `/groups/{gid}/jornadas/{jid}` (que ahora retorna 405 o 404).

#### Shape de un pick

**Para partidos 1-14** (single sign):
```json
{
  "partido_orden": 1,
  "sign": "1"  // o "X" o "2"
}
```

**Para partido 15 (pleno, multi-sign)**:
```json
{
  "partido_orden": 15,
  "pleno_signs": {
    "M0": ["0-0"],
    "M1": ["0-1", "1-0"],
    "M2": []
  }
}
```

#### Variantes válidas del pleno (validación server-side post-fix #3)

| M-column | Variantes permitidas |
|---|---|
| `M0` | `["0-0"]` (solo esta) |
| `M1` | `["0-1", "0-2", "1-0", "1-1", "1-2"]` |
| `M2` | `["2-0", "2-1", "2-2", "3-0", "3-1", "3-2", "M"]` |

Reglas: exactamente 3 keys (M0, M1, M2). Cada valor es lista de strings. **Al menos una variante** entre todas las columns (no aceptar pleno 100% vacío).

#### Errores (post-fixes #2 y #3)

```typescript
// 403: jornada no active o voting cerrado
if (r.status === 403) {
  // detail puede ser:
  // - "jornada not active (status=draft)"
  // - "voting closed at 2026-10-12T..."
}

// 422: validación de shape falló
if (r.status === 422) {
  // detail: Pydantic validation error
  // Para variantes inválidas: detail menciona "string_pattern_mismatches_..." o similar
}
```

#### Submit es idempotente

- Segundo submit del mismo par (gid, jid) → sobreescribe (no duplica filas).
- **Siempre mandá los 15 picks juntos** (no soporta "upsert de 1 solo pick").

#### GET /picks — privacidad (show_picks)

- Si `show_picks = false`: `members[i].picks = null` para todos.
- Si `show_picks = true`: `members[i].picks = [PickOut, ...]` con todos los picks del miembro.

Shape:
```json
{
  "show_picks": false,
  "members": [
    {
      "user_id": 1,
      "display_name": "Alice",
      "voted": true,
      "voted_at": "2026-10-04T10:00:00Z",
      "picks": null  // null cuando voted=false O show_picks=false
    },
    ...
  ]
}
```

#### UI del form de picks (post-fix #3)

**Layout recomendado**:
- 14 inputs de radio (1/X/2) para partidos 1-14
- Para el 15, 3 columnas (M0/M1/M2) con checkboxes por variante

**Validación cliente antes de submit** (pre-fix #3 ya estaba, post-fix #2 nuevos):
1. `len(picks) === 15` (server también)
3. Para 1-14: `sign ∈ {1, X, 2}`, sin `pleno_signs`
4. Para 15: tiene `pleno_signs`, sin `sign`
5. Cada partido_orden en 1..15, sin duplicados ni gaps
6. Pleno: cada variante ∈ variants válidos (M0/M1/M2 según columna)
7. Pleno: al menos 1 variante total (no M0=[], M1=[], M2=[])

**Validación server-side** (rechaza si el cliente miente sobre la jornada):
- Si `jornada.status != "active"` → 403
- Si `now >= voting_closes_at` → 403
- Si las variantes del pleno son inválidas → 422

**Estados del form**:
| Estado UI | Cuándo | Qué mostrar |
|---|---|---|
| `loading` | fetch `/picks/me` en curso | spinner |
| `not_voted, !closed` | no hay picks propios, votación abierta | form editable (vacío) |
| `not_voted, closed` | no hay picks, votación cerrada | form disabled con mensaje "votación cerrada" |
| `voted, !closed` | ya votó, votación abierta | form pre-rellenado con sus picks, editable (puede cambiar antes del cierre) |
| `voted, closed` | ya votó, votación cerrada | form disabled, mostrar sus picks en read-only |
| `not_active_jornada` | jornada en `draft`/`closed`/`completed` | "la jornada no está activa" |

**Botón "Guardar"**:
- Si el form está vacío (sin tocar) → disabled
- Click → loading → success → mostrar "Exitosamente, tus picks están guardados" (puede ser un toast)
- Si 422 → mostrar el primer error de validación (highlight del input problemático)
- Si 403 → "La votación se cerró / la jornada ya no está activa"

---

### 3.7 Consensus (F7) — solo admin

#### Endpoint

| Método | Ruta | Auth | Body | Devuelve |
|---|---|---|---|---|
| `POST` | `/groups/{gid}/jornadas/{jid}/consensus` | **Admin** | — | 200 `ConsensusOut` |

⚠️ **Importante**: el consensus se COMPUTA en cada request, no se persiste (decisión del usuario). No hay `GET /consensus`. Cada vez que el admin lo pide, se recalcula.

#### Errores (post-fix "no guardado")

```typescript
// 403: no sos admin
if (r.status === 403) {
  return;  // mostrar "solo admins pueden generar el consenso"
}

// 409: faltan voters
if (r.status === 409) {
  // body.detail.missing_voters: [{user_id, display_name}, ...]
  // mostrar "Falta que voten: Bob, Carol"
}

// 200: reporte completo (ver shape abajo)
```

#### Shape de la response (200)

```json
{
  "jornada_id": 1,
  "jornada_numero": 8,
  "temporada": 2026,
  "total_members": 5,
  "voted_members": 5,
  "all_voted": true,
  "partidos": [
    {
      "partido_orden": 1,
      "local": "Athletic Club",
      "visitante": "Sevilla",
      "vote_counts": {"1": 3, "X": 1, "2": 1},
      "consensus": {"signs": ["1"]}  // multi-marca si hay empate
    },
    {
      "partido_orden": 15,
      "local": "Real Madrid",
      "visitante": "Barcelona",
      "vote_counts": {
        "M0": {"0-0": 2, "0-1": 1},
        "M1": {"1-0": 1, "1-1": 2},
        "M2": {}
      },
      "consensus": {
        "pleno": {
          "M0": ["0-0", "0-1"],
          "M1": ["1-0", "1-1"],
          "M2": []   // siempre presente, aunque vacía
        }
      }
    }
  ]
}
```

#### Algoritmo

**Partidos 1-14**: signo(s) más votados. Empate → multi-marca todos los empatados (array con varios signos).

**Partido 15 (pleno)**: por cada columna M0/M1/M2, **unión de las variantes votadas por todos los miembros**. Si nadie votó una columna, queda `[]` (pero la key siempre está presente en el response).

#### UI del consensus card

- Si `all_voted === false` → mostrar modal con `missing_voters` y botón "Recordar" (TODO futuro: webhook a notificación)
- Si `all_voted === true` → mostrar el boleto consensuado renderizado
  - 14 inputs pre-rellenados con los signos del consensus (pueden ser múltiples si hay empate)
  - Pleno: 3 columnas con las variants del union

**Botón "Generar boleto consensuado"** (solo visible para admins):
- Click → POST
- Loading state (puede tardar ~1-2s)
- Si 200 → mostrar el reporte
- Si 409 → mostrar modal con `missing_voters`

---

### 3.8 Image uploads (F8)

#### Endpoints

| Método | Ruta | Auth | Body | Devuelve |
|---|---|---|---|---|
| `POST` | `/admin/teams/{team_id}/logo` | Admin | `multipart/form-data: file` | 200 `{team_id, logo_url, size}` |
| `DELETE` | `/admin/teams/{team_id}/logo` | Admin | — | 204 |
| `POST` | `/users/me/avatar` | Bearer (self) | `multipart/form-data: file` | 200 `{user_id, avatar_url}` |
| `DELETE` | `/users/me/avatar` | Bearer (self) | — | 204 |

#### Validación (server)

- Max 5MB
- Magic bytes check (PNG: `\x89PNG\r\n\x1a\n`, JPEG: `\xff\xd8\xff`, WebP: `RIFF...WEBP`)
- 5xx: si falla la subida a R2 (problema de storage, no del cliente)

#### Validación cliente (pre-submit)

- `file.size <= 5 * 1024 * 1024`
- `file.type ∈ {image/png, image/jpeg, image/webp}`
- Preview con `URL.createObjectURL(file)` antes de subir
- Si todo OK → upload

#### Patrón de upload (frontend)

```typescript
const form = new FormData();
form.append("file", file);
const r = await fetch(`${baseUrl}/admin/teams/${teamId}/logo`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  // NO Content-Type — el browser lo setea con boundary
  body: form,
});
```

#### Display

- `logo_url` y `avatar_url` vienen **absolutas** del backend (ya sea R2 public dev URL o custom domain en prod).
- `<img src={logo_url}>` directo. Sin proxy, sin transformations.
- Si `null` → placeholder.

---

## 4. Catálogo consolidado de errores

| Status | Cuándo | Mensaje user-friendly (es-ES) |
|---|---|---|
| `400` | `/groups/join` con grupo lleno | "Este grupo está lleno" |
| `400` | `/groups/{id}/leave` siendo creator | "El creador no puede salir del grupo. Elimínalo si querés." |
| `400` | `/groups/{id}/members/{uid}/{promote,demote}` con target = caller | "No podés promoverte/d degradarte a vos mismo. Pedile a otro admin." |
| `400` | `/groups/{id}/members/{uid}` con target = caller | "No podés expulsarte a vos mismo. Usá 'Salir del grupo'." |
| `400` | `/groups/{id}/members/{uid}/demote` con target = creator | "El creador no puede ser degradado" |
| `400` | Validación Pydantic falló (ej. 15 picks en POST /picks → 422, no 400) | (raro) |
| `401` | Token ausente/expirado/inválido | "Tu sesión expiró. Volvé a iniciar sesión." |
| `401` | `/auth/login` con credenciales malas | — "Email o contraseña incorrectos" |
| `401` | `/auth/x` con access_token inválido | — "Credenciales de X inválidas" |
| `403` | POST /picks en jornada `draft` | — "La jornada no está activa" |
| `403` | POST /picks con `voting_closes_at` pasado | — "El plazo de votación cerró el [fecha]" |
| `403` | `GET /groups/{id}` no siendo miembro | — "No sos miembro de este grupo" |
| `403` | `POST /consensus` no siendo admin | — "Solo los admins pueden generar el consenso" |
| `404` | `/groups/join` con código inválido | "Código de invitación inválido" |
| `404` | `GET /jornadas/{id}` no existente | "Jornada no encontrada" |
| `409` | `POST /auth/register` email duplicado | — "Ese email ya está registrado" |
| `409` | `POST /groups/join` ya miembro | "Ya sos miembro de este grupo" |
| `409` | `POST /groups/{id}/consensus` faltan voters | "Falta que voten: [lista de nombres]" |
| `413` | Upload > 5MB | "La imagen es demasiado grande (máx 5 MB)" |
| `415` | Upload tipo no soportado | "Solo se aceptan imágenes PNG, JPG o WebP" |
| `422` | POST /picks con variantes del pleno inválidas o shape incorrecto | (Pydantic detail, mostrar el primer error) |
| `502` | `/auth/x` con X API caída | — "X (Twitter) no está disponible, reintentá más tarde" |
| `5xx` | Error interno | "Algo salió mal. Reintentá." |

---

## 5. Matriz de permisos

| Endpoint | Público | Miembro | Admin | Creator |
|---|---|---|---|---|
| `POST /auth/{register,login,google,x}` | ✅ | — | — | — |
| `GET /auth/me` | — | ✅ (Bearer) | ✅ | ✅ |
| `GET /api/v1/teams` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/v1/teams/{id}` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/v1/competitions` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/v1/competitions/{id}` | ✅ | ✅ | ✅ | ✅ |
| `GET /jornadas` | ✅ | ✅ | ✅ | ✅ |
| `GET /jornadas/{id}` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/v1/losilla/*` | ✅ | ✅ | ✅ | ✅ |
| `GET /health`, `/health/db` | ✅ | ✅ | ✅ | ✅ |
| `GET /groups` | — | ✅ | ✅ | ✅ |
| `POST /groups` | — | ✅ | ✅ | ✅ |
| `POST /groups/join` | — | ✅ (Bearer) | ✅ | ✅ |
| `GET /groups/{id}` | — | ✅ | ✅ | ✅ |
| `POST /groups/{id}/leave` | — | ✅ (no creator) | ✅ | ❌ |
| `DELETE /groups/{id}` | — | ❌ | ❌ | ✅ |
| `PATCH /groups/{id}` | — | ❌ | ✅ (solo `show_picks`) | ✅ |
| `POST /groups/{id}/members/{uid}/promote` | — | ❌ | ✅ (no self) | ✅ |
| `POST /groups/{id}/members/{uid}/demote` | — | ❌ | ✅ (no self, no creator) | ✅ |
| `DELETE /groups/{id}/members/{uid}` | — | ❌ | ✅ (no self) | ✅ |
| `POST /groups/{gid}/jornadas/{jid}/picks` | — | ✅ (no closed) | ✅ | ✅ |
| `GET /groups/{gid}/jornadas/{jid}/picks` | — | ✅ | ✅ | ✅ |
| `GET /groups/{gid}/jornadas/{jid}/picks/me` | — | ✅ | ✅ | ✅ |
| `POST /groups/{gid}/jornadas/{jid}/consensus` | — | ❌ | ✅ | ✅ |
| `POST /admin/teams/{id}/logo` | — | ❌ | ✅ | ✅ |
| `DELETE /admin/teams/{id}/logo` | — | ❌ | ✅ | ✅ |
| `POST /users/me/avatar` | — | ✅ (Bearer, self) | ✅ | ✅ |
| `DELETE /users/me/avatar` | — | ✅ (Bearer, self) | ✅ | ✅ |

---

## 6. UI/UX guidelines

### 6.1 Layout general

- **Mobile-first**: app debe funcionar bien en mobile (375px ancho mínimo).
- **Loading states**: cada fetch async tiene un skeleton o shimmer. NUNCA un spinner sin contexto.
- **Empty states**: cada lista tiene un empty state con icono + mensaje + CTA. Ej: "No hay grupos todavía. ¡Creá el primero!"

### 6.2 Form de picks

- 14 inputs de radio en grid responsive (4 columnas desktop, 2 mobile)
- Pleno: 3 columnas (M0/M1/M2), cada variant como checkbox
- Botón "Guardar" sticky en el bottom de la pantalla (visible mientras hacés scroll)
- Disabled state visual claro (opacity 0.5 + cursor not-allowed)

### 6.3 Polling

- En `/groups/{gid}` (vista del grupo): polling cada 30 segundos de `/groups/{gid}/jornadas/{jid}/picks` para "live" del estado de votación
- Limpiar interval al desmontar (`useEffect` cleanup)
- No polling en otras vistas (página de inicio, perfil)

### 6.4 Tokens y auth

- Persistir token en `localStorage` (no `sessionStorage`, no cookies — la API es stateless)
- Auto-logout en 401 (wrapper centralizado en `lib/api.ts`)
- Loading state en cualquier page load que dependa de `/auth/me`

### 6.5 Errores

- Mostrar `body.detail.message` cuando el detail sea objeto con `message`
- Mostrar `body.detail` cuando sea string
- **No mostrar stack traces ni emails ni tokens** al usuario
- Toast en la esquina superior derecha para errores no bloqueantes (4xx)
- Modal o página de error para errores bloqueantes (5xx)

---

## 7. Acceptance criteria (pre-merge)

Antes de mergear el cliente, validar:

### Auth
- [ ] Register: email duplicado → 409 con "ese email ya está registrado"
- [ ] Login: credenciales malas → 401 con "email o contraseña incorrectos"
- [ ] Logout: limpia token, redirige a /login
- [ ] Token expirado (24h): auto-logout, redirige a /login
- [ ] OAuth Google: id_token inválido → 401
- [ ] OAuth X: access_token inválido → 401; X caído → 502

### Profile
- [ ] `/auth/me` muestra `display_name`, `email`, `created_at` ("Member since"), `avatar_url`
- [ ] Upload avatar: max 5MB, solo PNG/JPG/WebP, preview antes de subir
- [ ] Avatar se actualiza en navbar después del upload

### Grupos
- [ ] Crear grupo: muestra `join_code` prominentemente con botón "Copiar"
- [ ] Unirse: código inválido → 404 con "código inválido"
- [ ] Unirse: grupo lleno → 400 con código `group_full`
- [ ] Unirse: ya miembro → 409 con código `already_member`
- [ ] Salir (member): 204, redirige a /
- [ ] Salir (creator): 400 con "El creador no puede salir"
- [ ] Eliminar (creator): confirmar modal doble, 204, redirige a /
- [ ] Eliminar (admin no creator): 403
- [ ] Promote (admin): otro member → 204; self → 400; creator → 400
- [ ] Demote (admin): otro admin → 204; self → 400; creator → 400
- [ ] Remove (admin): otro member → 204; self → 400

### Picks
- [ ] Listar jornadas: muestra `?status=active` primero
- [ ] Ver jornada: render de 15 partidos con logos (del embed)
- [ ] Form de picks: 14 inputs + 1 pleno multi-sign
- [ ] Submit picks: idempotente, valida server-side
- [ ] Picks: variantes del pleno inválidas → 422
- [ ] Picks: jornada no active → 403
- [ ] Picks: voting_closes_at pasado → 403
- [ ] Ver picks (show_picks=false): solo `display_name` + `voted: true/false`
- [ ] Ver picks (show_picks=true): incluye `picks` array por miembro
- [ ] Ver mis picks (`/picks/me`): 200 con los 15 picks
- [ ] Ver mis picks: 404 si no he votado

### Consensus
- [ ] Generar consenso: solo admin, 403 si no
- [ ] Generar consenso: 409 con `missing_voters` si falta gente
- [ ] Generar consenso: 200 con reporte completo
- [ ] Reporte: partido 15 muestra M0/M1/M2 (siempre 3 keys)
- [ ] Reporte: empates en 1-14 → multi-marca todos

### Uploads
- [ ] Upload logo de equipo (admin): 200 con `logo_url`
- [ ] Upload avatar (user): 200 con `avatar_url`
- [ ] Avatar > 5MB → 413
- [ ] Avatar wrong type → 415
- [ ] NO setear Content-Type en multipart (verificar en network tab)

### Imagenes / Equipo
- [ ] GET /jornadas/{id} embebe `local_team` y `visitante_team` con logos
- [ ] Logos vienen de R2 (URL absoluta)
- [ ] `<img>` tag renderiza sin proxy

### Misc
- [ ] Polling cada 30s en /groups/{gid}
- [ ] No mostrar `competicion_raw` (siempre null)
- [ ] Si jornada no active: form disabled
- [ ] Si voting_closes_at pasado: form disabled
- [ ] Si usuario no es miembro: 403 (no leak de que el grupo existe)

---

## 8. Decisiones de producto (para que se entienda el "por qué")

- **No hay refresh tokens** en MVP. Trade-off: UX peor (re-login cada 24h) vs implementación más simple. Si te molesta, es 2-3 días de trabajo agregar refresh tokens rotativos.
- **No hay edición de picks separada** del submit. El UPSERT cubre el caso. Si querés historial de cambios, hay que agregar tabla `pick_history`.
- **No hay grupos públicos**. Si en el futuro se quiere "peña pública de La Goyniela", hay que agregar un flag al grupo.
- **Consensus se recalcula cada vez**. No se guarda. Si querés guardar el boleto final una vez generado (para auditoría o para re-generar reportes), hay que agregar tabla `consensus_snapshot`.
- **No hay "scoring post-jornada"** (cuántos aciertos tuvo cada uno). Está planeado para después de T-data-4. Cuando se implemente, el GET /picks también debería retornar `aciertos` por miembro comparando contra `jornada_escrutinio.payload`.
- **El form de picks acepta 14 inputs + 1 pleno en la misma submission**. NO hay "submit por partido". El usuario debe llenar todos antes de poder guardar.
- **El admin NO puede modificar el nombre/descripción/max_members del grupo vía PATCH**. Solo `show_picks` es editable. Si querés editar el resto, hay que agregar campos a `GroupPatchIn`.

---

## 9. Recursos

- [`docs/API.md`](./API.md) — reference de cada endpoint (curl + JSON shape)
- [`docs/CLIENT.md`](./CLIENT.md) — patrones de integración (auth flow, fetch wrapper, gotchas)
- [`docs/FRONTEND-IMPLEMENTATION.md`](./FRONTEND-IMPLEMENTATION.md) — orden de implementación sugerido
- `http://localhost:8000/docs` — Swagger UI interactivo
- `http://localhost:8000/openapi.json` — para generar SDKs con `openapi-generator`
- [`docs/HANDOFF-NEXT-SESSION.md`](./HANDOFF-NEXT-SESSION.md) — historial de contract fixes