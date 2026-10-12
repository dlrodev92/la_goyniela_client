# La Goyniela — API Reference

**Base URL (dev)**: `http://localhost:8000`
**Versión**: 0.4.x (votación MVP-02 + scheduler + Losilla persistence)
**OpenAPI interactivo**: `http://localhost:8000/docs` (Swagger UI) — siempre actualizado con el código
**OpenAPI JSON**: `http://localhost:8000/openapi.json`

---

## 1. Convenciones

### 1.1 Autenticación

Todos los endpoints excepto los marcados como **Público** requieren un Bearer JWT en el header `Authorization`:

```bash
curl -H "Authorization: Bearer eyJhbGc..." http://localhost:8000/auth/me
```

Los tokens se obtienen vía `POST /auth/register`, `POST /auth/login`, `POST /auth/google`, o `POST /auth/x`. Vencen en 24 horas (1440 minutos). No hay refresh tokens en MVP-02.

### 1.2 Formato de request

- JSON para `Content-Type: application/json`
- `multipart/form-data` para uploads de imagen (logo, avatar)
- URL params para path y query string

### 1.3 Formato de respuesta

Todas las respuestas exitosas son JSON. Los errores siguen este formato:

```json
{
  "detail": "human-readable error message"
}
```

### 1.4 Códigos de estado

| Código | Significado |
|---|---|
| `200` | OK (GET, PATCH) |
| `201` | Created (POST) |
| `204` | No content (DELETE exitoso) |
| `400` | Bad request (validación falla, jornada no existe) |
| `401` | No autenticado (falta token o token inválido) |
| `403` | No autorizado (token válido pero no tiene permisos) |
| `404` | No encontrado |
| `409` | Conflicto (email duplicado, login_code colisión, miembros no han votado en consensus) |
| `422` | Unprocessable (Pydantic validation) |
| `500` | Error interno |
| `502` | Upstream no disponible (Losilla, Quiniwin) |

### 1.5 Filtros y paginación

Los endpoints de listado (`GET /jornadas`, `GET /teams`) aceptan `limit` (default 50, max 200) y `offset` (default 0). La respuesta incluye `total`, `items`, `limit`, `offset`:

```json
{
  "items": [...],
  "total": 423,
  "limit": 50,
  "offset": 0
}
```

---

## 2. Auth

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/auth/register` | Público | Crear user con email + password |
| `POST` | `/auth/login` | Público | Login con email + password |
| `POST` | `/auth/google` | Público | Login/signup con Google id_token |
| `POST` | `/auth/x` | Público | Login/signup con X (Twitter) access_token |
| `GET` | `/auth/me` | Bearer | Datos del usuario actual |

### 2.1 `POST /auth/register`

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "supersecret123",
    "display_name": "Alice"
  }'
```

**Response 201**:
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": 42,
    "email": "alice@example.com",
    "display_name": "Alice",
    "avatar_url": null,
    "is_active": true,
    "created_at": "2026-10-04T12:00:00Z"
  }
}
```

**Errores**: `409` si el email ya existe.

### 2.2 `POST /auth/login`

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "supersecret123"}'
```

Response: igual que register. Error `401` si credenciales inválidas.

### 2.3 `GET /auth/me`

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/auth/me
```

**Response 200**:
```json
{
  "id": 42,
  "email": "alice@example.com",
  "display_name": "Alice",
  "avatar_url": null,
  "is_active": true,
  "created_at": "2026-10-04T12:00:00Z"
}
```

---

## 3. Groups

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/groups` | Bearer | Crear grupo (queda como admin) |
| `GET` | `/groups` | Bearer | Listar grupos del usuario |
| `POST` | `/groups/join` | Bearer | Unirse a un grupo vía join_code |
| `GET` | `/groups/{id}` | Miembro | Detalle del grupo + miembros |
| `POST` | `/groups/{id}/leave` | Miembro (no creator) | Salir del grupo |
| `DELETE` | `/groups/{id}` | Creador | Eliminar grupo + cascade |
| `POST` | `/groups/{id}/members/{uid}/promote` | Admin | member → admin |
| `POST` | `/groups/{id}/members/{uid}/demote` | Admin | admin → member (excepto creator) |
| `DELETE` | `/groups/{id}/members/{uid}` | Admin | Quitar miembro del grupo |
| `PATCH` | `/groups/{id}` | Admin | Actualizar `show_picks` (toggle visibilidad) |

### 3.1 `POST /groups`

```bash
curl -X POST http://localhost:8000/groups \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Peña del barrio", "description": "Los del café de la esquina"}'
```

**Response 201**:
```json
{
  "id": 7,
  "name": "Peña del barrio",
  "description": "Los del café de la esquina",
  "created_by_user_id": 42,
  "join_code": "A3F9KX",
  "max_members": 50,
  "show_picks": false,
  "created_at": "2026-10-04T12:00:00Z"
}
```

El `join_code` es un string alfanumérico de 6 caracteres sin ambigüedad (sin 0/O/1/I/l). Lo compartís con tus amigos para que se unan.

### 3.2 `POST /groups/join`

```bash
curl -X POST http://localhost:8000/groups/join \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"join_code": "A3F9KX"}'
```

**Response 200**:
```json
{
  "id": 7,
  "name": "Peña del barrio",
  "role": "member"
}
```

**Errores**: `404` si el join_code no existe, `409` si ya sos miembro, `400` si el grupo está lleno.

### 3.3 `GET /groups/{id}`

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/groups/7
```

**Response 200** (miembro):
```json
{
  "id": 7,
  "name": "Peña del barrio",
  "description": "Los del café de la esquina",
  "created_by_user_id": 1,
  "join_code": "A3F9KX",
  "max_members": 50,
  "show_picks": false,
  "created_at": "2026-10-04T12:00:00Z",
  "members": [
    {"user_id": 1, "display_name": "Alice", "role": "admin", "joined_at": "..."},
    {"user_id": 2, "display_name": "Bob",   "role": "member", "joined_at": "..."}
  ],
  "member_count": 2,
  "role": "admin"
}
```

`role` indica el rol del caller dentro del grupo. `404` si no existe, `403` si no es miembro.

### 3.4 `PATCH /groups/{id}` (admin only)

```bash
curl -X PATCH http://localhost:8000/groups/7 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"show_picks": true}'
```

**Response 200**:
```json
{
  "id": 7, "name": "Peña del barrio", ..., "show_picks": true, ...
}
```

Solo los admins pueden hacer PATCH. `403` si no es admin. PATCH es parcial: solo `show_picks` es editable por ahora (no se pueden modificar name/description/max_members).

---

## 4. Competiciones

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/competitions` | Público | Lista 10 competiciones |
| `GET` | `/api/v1/competitions/{id}` | Público | Una competición |

### 4.1 `GET /api/v1/competitions`

```bash
curl "http://localhost:8000/api/v1/competitions?tier=1&country=Spain"
```

**Response 200**:
```json
{
  "items": [
    {"id": "laliga-ea-sports", "name": "LALIGA EA SPORTS", "tier": 1, "country": "Spain", ...},
    {"id": "liga-f", "name": "Liga F", "tier": 1, "country": "Spain", ...}
  ],
  "total": 2, "limit": 50, "offset": 0
}
```

Filtros: `?tier=1|2|3`, `?country=Spain`.

---

## 5. Teams (Equipos)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/teams` | Público | Lista equipos con filtros |
| `GET` | `/api/v1/teams/{team_id}` | Público | Un equipo |

### 5.1 `GET /api/v1/teams`

```bash
curl "http://localhost:8000/api/v1/teams?competition_id=laliga-ea-sports&gender=men&limit=10"
```

**Response 200**:
```json
{
  "items": [
    {
      "id": 30,
      "entity_id": "club-men-athletic-club",
      "competition_id": "laliga-ea-sports",
      "canonical_name": "Athletic Club",
      "short_name": "Athletic Bilbao",
      "gender": "men",
      "country": "ESP",
      "logo_url": "https://cdn.la-goyniela.example/teams/club-men-athletic-club.png"
    }
  ],
  "total": 20, "limit": 10, "offset": 0
}
```

Filtros: `?competition_id=X`, `?gender=men|women`, `?country=ESP`, `?q=substring`.

### 5.2 `GET /api/v1/teams/{team_id}`

```bash
curl http://localhost:8000/api/v1/teams/30
```

**Response 200**: mismo shape que un item de la lista. `404` si no existe.

---

## 6. Losilla (datos en vivo + escrutinio persistido)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/losilla/jornada/{n}` | Público | Payload completo (live + escrutinio + comentarios) |
| `GET` | `/api/v1/losilla/jornada/{n}/escrutinio` | Público | Solo escrutinio (DB-first, fallback upstream) |
| `GET` | `/api/v1/losilla/jornada/{n}/comentarios` | Público | Solo comentarios (DB-first, fallback upstream) |

### 6.1 `GET /api/v1/losilla/jornada/{n}/escrutinio`

```bash
curl "http://localhost:8000/api/v1/losilla/jornada/8/escrutinio?temporada=2026"
```

**Response 200** (jornada cerrada, escrutinio en DB):
```json
{
  "source": "db",
  "escrutinio": {
    "estimada": false,
    "recaudacion_eur": "3.781.971,75",
    "bote_eur": "3.159.105,01",
    "jornada_etiqueta": 8,
    "temporada_etiqueta": "26/27",
    "fecha_jornada": "26/09/2026",
    "categorias": [
      {"aciertos": 15, "acertantes": 1, "premio_eur": "2.762.202,31"},
      {"aciertos": 14, "acertantes": 22, "premio_eur": "27.505,25"},
      {"aciertos": 13, "acertantes": 348, "premio_eur": "1.039,50"}
    ],
    "elige8": null
  }
}
```

**Response 200** (en vivo, sin escrutinio en DB):
```json
{
  "source": "upstream",
  "escrutinio": null
}
```

**Response 204** (jornada no jugada, upstream no tiene escrutinio aún): sin body.

Header `X-Losilla-Source` también devuelve `db` o `upstream` para detección desde el cliente.

---

## 7. Jornadas

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/jornadas` | Público | Lista jornadas con filtros |
| `GET` | `/jornadas/{id}` | Público | Detalle de una jornada con 15 partidos |

### 7.1 `GET /jornadas`

```bash
curl "http://localhost:8000/jornadas?season=2027&status=active&limit=5"
```

**Response 200**:
```json
[
  {
    "id": 1, "temporada": 2027, "temporada_str": "2026/2027", "numero": 8,
    "status": "draft", "sale_opens_at": null, "voting_closes_at": null,
    "kickoff_first_match_at": "2026-09-26T18:00:00Z", "fetched_at": "..."
  }
]
```

Filtros: `?season=YYYY` (end-year, e.g. 2027 = 26/27), `?status=draft|active|closed|completed`, `?limit=N&offset=N`.

### 7.2 `GET /jornadas/{id}`

```bash
curl http://localhost:8000/jornadas/1
```

**Response 200**:
```json
{
  "id": 1, "temporada": 2027, ..., "kickoff_first_match_at": "...",
  "partidos": [
    {
      "id": 1, "jornada_id": 1, "posicion": 1,
      "local_team_id": 30, "visitante_team_id": 71,
      "local_raw": "Athletic Club", "visitante_raw": "Sevilla",
      "competicion_raw": null, "kickoff_at": null, "fetched_at": "..."
    },
    ...
  ]
}
```

`posicion` es 1..15. `competicion_raw` siempre `null` (el upstream no la emite; resolver a `competition.id` queda como tarea futura). `404` si no existe.

---

## 8. Picks (votación — MVP-02)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/groups/{gid}/jornadas/{jid}/picks` | Miembro | Subir/actualizar tus 15 picks |
| `GET` | `/groups/{gid}/jornadas/{jid}/picks` | Miembro | Ver picks de todos (respeta `show_picks`) |
| `GET` | `/groups/{gid}/jornadas/{jid}/picks/me` | Miembro | Tus picks |
| `POST` | `/groups/{gid}/jornadas/{jid}/consensus` | Admin | Generar boleto consensuado |

### 8.1 Formato de un pick

- **Partidos 1-14**: `{"partido_orden": 1, "sign": "1"}` (sign ∈ {1, X, 2})
- **Partido 15 (pleno al 15, multi-sign)**: `{"partido_orden": 15, "pleno_signs": {"M0": ["0-0"], "M1": ["0-1", "1-0"], "M2": []}}`

Variantes válidas del pleno (Quiniela estándar):
- **M0** (1 variante): `["0-0"]`
- **M1** (5 variantes): `["0-1", "0-2", "1-0", "1-1", "1-2"]`
- **M2** (7 variantes): `["2-0", "2-1", "2-2", "3-0", "3-1", "3-2", "M"]` (M = "más de 3 goles")

### 8.2 `POST /groups/{gid}/jornadas/{jid}/picks`

```bash
curl -X POST http://localhost:8000/groups/7/jornadas/1/picks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "picks": [
      {"partido_orden": 1,  "sign": "1"},
      {"partido_orden": 2,  "sign": "X"},
      {"partido_orden": 3,  "sign": "2"},
      ...
      {"partido_orden": 14, "sign": "1"},
      {"partido_orden": 15, "pleno_signs": {
        "M0": ["0-0"],
        "M1": ["0-1", "1-0"],
        "M2": []
      }}
    ]
  }'
```

**Response 201** (o 200 si ya existía y se actualizó):
```json
{
  "saved": 15,
  "picks": [
    {"partido_orden": 1, "sign": "1", "pleno_signs": null},
    ...
    {"partido_orden": 15, "sign": null, "pleno_signs": {"M0": ["0-0"], "M1": ["0-1", "1-0"], "M2": []}}
  ]
}
```

**Idempotente**: si ya votaste, sobreescribe tus picks anteriores. Para partidos 1-14 `pleno_signs` debe ser null. Para el 15 `sign` debe ser null.

**Errores**: `400` si no hay 15 picks, `403` si no sos miembro, `404` si la jornada no existe.

### 8.3 `GET /groups/{gid}/jornadas/{jid}/picks`

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/groups/7/jornadas/1/picks
```

**Response 200** (con `show_picks=false`):
```json
{
  "show_picks": false,
  "members": [
    {"user_id": 1, "display_name": "Alice", "voted": true,  "voted_at": "2026-10-04T10:00:00Z", "picks": null},
    {"user_id": 2, "display_name": "Bob",   "voted": false, "voted_at": null, "picks": null},
    {"user_id": 3, "display_name": "Carol", "voted": true,  "voted_at": "2026-10-04T11:00:00Z", "picks": null}
  ]
}
```

**Response 200** (con `show_picks=true`):
```json
{
  "show_picks": true,
  "members": [
    {"user_id": 1, "display_name": "Alice", "voted": true, "voted_at": "...", "picks": [
      {"partido_orden": 1, "sign": "1", "pleno_signs": null},
      ...
    ]},
    ...
  ]
}
```

`picks: null` cuando `voted=false` o cuando `show_picks=false`. El admin decide cuándo revelar.

### 8.4 `GET /groups/{gid}/jornadas/{jid}/picks/me`

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/groups/7/jornadas/1/picks/me
```

**Response 200**: igual que un `PickOut` individual por los 15 partidos. `404` si no has votado.

### 8.5 `POST /groups/{gid}/jornadas/{jid}/consensus` (admin only)

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/groups/7/jornadas/1/consensus
```

**Response 200** (todos los miembros han votado):
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
      "local": "Athletic Club", "visitante": "Sevilla",
      "vote_counts": {"1": 3, "X": 1, "2": 1},
      "consensus": {"signs": ["1"]}
    },
    {
      "partido_orden": 15,
      "local": "Real Madrid", "visitante": "Barcelona",
      "vote_counts": {
        "M0": {"0-0": 2, "0-1": 1},
        "M1": {"1-0": 1, "1-1": 2},
        "M2": {}
      },
      "consensus": {
        "pleno": {
          "M0": ["0-0", "0-1"],
          "M1": ["1-0", "1-1"],
          "M2": []
        }
      }
    }
  ]
}
```

Algoritmo:
- **1-14**: signo(s) más votados. Empate → multi-marca todos los empatados.
- **15 (pleno)**: por cada columna M0/M1/M2, **unión** de las variantes votadas por todos. Si nadie votó en una columna, queda `[]`.

**Response 409** (falta gente por votar):
```json
{
  "detail": "no todos los miembros han votado",
  "missing_voters": [
    {"user_id": 2, "display_name": "Bob"}
  ]
}
```

El botón de UI debe esperar 200 para mostrar el reporte, 409 para mostrar "Bob todavía no votó".

**Errores**: `403` si no sos admin, `404` si la jornada no existe.

---

## 9. Health

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/health` | Público | Liveness probe |
| `GET` | `/health/db` | Público | DB readiness (`SELECT 1`) |

```bash
curl http://localhost:8000/health
# {"status": "ok"}

curl http://localhost:8000/health/db
# {"status": "ok", "database": "reachable"}
```

---

## 10. Ejemplos de flujo

### 10.1 Crear peña, unirse, votar, consenso

```bash
# 1. Alice se registra
ALICE_TOKEN=$(curl -s -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"hunter22","display_name":"Alice"}' \
  | jq -r .access_token)

# 2. Alice crea la peña
PEÑA=$(curl -s -X POST http://localhost:8000/groups \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Peña del café"}')
JOIN_CODE=$(echo $PEÑA | jq -r .join_code)
GROUP_ID=$(echo $PEÑA | jq -r .id)
echo "join_code: $JOIN_CODE"

# 3. Bob se une con el código
BOB_TOKEN=$(curl -s -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","password":"hunter22","display_name":"Bob"}' \
  | jq -r .access_token)
curl -s -X POST http://localhost:8000/groups/join \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"join_code\":\"$JOIN_CODE\"}"

# 4. Alice (admin) habilita visibilidad
curl -s -X PATCH http://localhost:8000/groups/$GROUP_ID \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"show_picks": true}'

# 5. Ambos votan en la jornada 8
curl -s -X POST http://localhost:8000/groups/$GROUP_ID/jornadas/1/picks \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"picks":[...15 picks...]}'

curl -s -X POST http://localhost:8000/groups/$GROUP_ID/jornadas/1/picks \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"picks":[...15 picks diferentes...]}'

# 6. Alice genera el consenso
curl -s -X POST http://localhost:8000/groups/$GROUP_ID/jornadas/1/consensus \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq
```

### 10.2 Construir el boleto del HTML

El script de build `scripts/build_jornada.py` consume `/jornadas/{id}` para obtener los 15 partidos, y opcionalmente `/api/v1/losilla/jornada/{n}/escrutinio` para los porcentajes. No necesita auth (esos endpoints son públicos). Ver `scripts/build_jornada.py --help`.

---

## 11. Rate limits y notas operacionales

- **Rate limit**: 100 requests/minuto por IP (configurable en `app/core/config.py`). El reverse proxy debe respetar el header `Retry-After` cuando viene en 429.
- **CORS**: en dev `*`, en producción solo el dominio del frontend.
- **Logging**: todo request se loguea con su `user_id` (si está autenticado) y tiempo de respuesta.
- **Versionado**: prefijo `/api/v1/` para catalog/competitions/teams/losilla. Los endpoints de auth/groups/jornadas/picks NO usan prefijo (es la API de la app, no API pública). Si en v2 rompemos compatibilidad, se introduce `/api/v2/...` para los afectados.

---

## 12. Recursos

- **OpenAPI interactivo**: http://localhost:8000/docs (Swagger UI con botón "Try it out")
- **OpenAPI JSON**: http://localhost:8000/openapi.json (para generar SDKs con `openapi-generator`)
- **ReDoc**: http://localhost:8000/redoc (lectura alternativa, más bonita)
- **Source del proyecto**: ver `app/api/v1/*.py`
- **Schemas Pydantic**: ver `app/schemas/*.py`
