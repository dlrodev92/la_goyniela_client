# Plan de cierre de features frente a FEATURES.md

Comparación de [`FEATURES.md`](../FEATURES.md) con el cliente actual (Next.js, rediseño fases 1–5b). El documento define qué está hecho, qué falta y se puede hacer hoy solo en el cliente, qué está bloqueado por el backend y qué se desvía de la spec a propósito.

## Resumen

| Estado | Cantidad | Qué significa |
|---|---|---|
| ✅ Implementado | 9 áreas | Coincide con la spec y está verificado contra el backend real |
| ✅ Hecho (lotes A, B y C) | 12 tareas | T1–T12 implementadas y verificadas |
| 🔴 Bloqueado por backend | 3 temas | Necesitan cambios o datos del backend antes de tocar el cliente |
| ⚪ Desviación deliberada | 4 puntos | La spec propone algo menos seguro o peor; se mantiene lo actual |
| ❓ Pendiente de decisión | 2 puntos | Falta una decisión de producto |

---

## 1. Estado por feature

| Feature (FEATURES.md) | Estado | Notas |
|---|---|---|
| 3.1 Auth email | ✅ | Registro, login, `/auth/me`, 401 → `/login`, mensajes en español |
| 3.1 Registro: contraseña dos veces | ✅ T1 | Hecho |
| 3.1 Logout con confirmación | ✅ T2 | Hecho |
| 3.1 OAuth Google / X | ✅ ⚪ | Implementado del lado del servidor con PKCE (ver desviaciones). Sin probar con credenciales reales |
| 3.2 Perfil, "Miembro desde" | ✅ | `created_at` ya llega del backend |
| 3.2 Avatar: preview antes de subir | ✅ T3 | Hecho |
| 3.2 Avatar visible en la barra superior tras subirlo | ✅ T3 | Hecho |
| 3.3 Grupos: crear, unirse, detalle, roles, salir, eliminar | ✅ | Errores `group_full` / `already_member` mapeados por status |
| 3.3 "Compartir por WhatsApp" | ✅ T4 | Hecho |
| 3.3 Errores 400 de promote/demote/remove con mensajes propios | ✅ T5 | Hecho |
| 3.4 Catálogo de equipos (browse) | ❓ D2 | La spec no define ninguna pantalla que lo use |
| 3.5 Jornadas: activa, estados, cierre | ✅ | |
| 3.5 Estado `draft` → "Próximamente" | ✅ T6 | Hecho |
| 3.6 Picks 1–14, edición, idempotencia, `picks/me` | ✅ | |
| 3.6 403 "jornada no activa" vs "votación cerrada" | ✅ T7 | Hecho |
| 3.6 422: resaltar el primer partido inválido | ✅ T8 | Hecho |
| 3.6 Pleno al 15 | 🔴 B2 | La spec (M0/M1/M2) contradice la regla real (ver B2) |
| 3.7 Consenso (admin, 409 con faltantes, 200 boleto) | ✅ | El boleto completo solo se vio con datos simulados |
| 3.8 Subida de avatar (5 MB, PNG/JPG/WebP) | ✅ | |
| 3.8 Subida de logo de equipo `/admin/teams/{id}/logo` | ❓ D1 | ¿Quién es "Admin" aquí? |
| Imágenes: escudos en la jornada | 🔴 B1 | El backend todavía no los manda |
| 6.3 Polling cada 30 s de la participación | ✅ T9 | Hecho |
| 6.1 Skeletons y estados vacíos | ✅ | |
| Pulido detectado en el QA del rediseño | ✅ T10–T12 | Hecho |

---

## 2. Lote de hoy (solo cliente)

Orden pensado para entregar valor visible primero y dejar el pulido al final. Cada tarea lleva su test o su captura.

| # | Tarea | Detalle | Verificación |
|---|---|---|---|
| ✅ T1 | Confirmar contraseña en el registro | Campo "Repite la contraseña", validado en el servidor (server action) y en el cliente. Error: "Las contraseñas no coinciden." | Test unitario + Playwright — Campo "Repite la contraseña" con validación en servidor y cliente. |
| ✅ T2 | Confirmar el logout | `ConfirmSheet` "¿Cerrar sesión?" en el perfil | Playwright — `ConfirmSheet` "¿Cerrar sesión?" en el perfil. |
| ✅ T3 | Avatar: preview y barra superior | Preview con `URL.createObjectURL` (y `revokeObjectURL` al cambiar o desmontar). Avatar pequeño en la barra superior que enlaza a `/profile`, actualizado tras subir o quitar la foto (`revalidatePath` del layout) | Playwright: subir, ver la preview, ver la barra — Preview del avatar y avatar en la barra superior. |
| ✅ T4 | Compartir por WhatsApp | Botón con `https://wa.me/?text=` + texto de invitación con el código, junto a "Copiar" y "Compartir" | Test del texto generado — Botón de WhatsApp con el código de invitación. |
| ✅ T5 | Errores de acciones de admin | Mapear 400/403/409 de promote/demote/remove/leave a mensajes en español ("No puedes degradarte a ti mismo…", "El creador no puede ser degradado", "Ya es admin") | Tests de gateway — Errores de admin: autoacción, creador protegido, ya es admin, no es admin. |
| ✅ T6 | Copy por estado de jornada | `draft`: "Próximamente". `closed`: "Cerrada". `completed`: "Finalizada". El formulario se bloquea fuera de `active` | Test de `isVotingOpen` + captura — Etiquetas por estado de jornada y formulario bloqueado fuera de `active`. |
| ✅ T7 | 403 al votar | Si la jornada no está `active`: "La jornada no está activa". Si pasó el cierre: "El plazo de votación cerró el {fecha}" | Tests — Mensajes del 403 según el estado conocido de la jornada. |
| ✅ T8 | 422 al votar | Leer `detail[].loc` del 422 para señalar el partido inválido (scroll y foco) sin mostrar el texto de Pydantic | Test del parser + Playwright — Parser del 422 por `loc` para señalar el partido inválido. |
| ✅ T9 | Participación en vivo | Componente cliente que hace `router.refresh()` cada 30 s solo con la pestaña visible (`visibilitychange`), con limpieza al desmontar. En el detalle del grupo y en la jornada | Test con temporizadores falsos — `AutoRefresh` cada 30 s solo con la pestaña visible. |
| ✅ T10 | `TeamCrest` con respaldo | Componente de escudo: usa `logo_url` si existe y, si no o si falla, un escudo pixelado con iniciales. Schemas que aceptan `local_team`/`visitante_team` **opcionales**, así se activa solo cuando el backend los mande (ver B1) | Tests de schema + captura — `TeamCrest` con respaldo pixelado; schemas con `local_team`/`visitante_team` opcionales; escudos en picks, resumen, boleto y resultados. |
| ✅ T11 | Escrutinio sin publicar | No mostrar la tabla de premios si no hay resultados (todo en 0 y sin aciertos); mostrar "Aún sin publicar" | Test + captura — `hasPublishedPrizes`: sin datos reales se muestra "Aún sin publicar". |
| ✅ T12 | Participación a 360 px | Nombre en una línea con elipsis, y el badge y la flecha sin aplastar el nombre | Captura a 360 px — Nombre con elipsis y `title`; badge y flecha no lo aplastan. |

**Cierre del lote:** lint, tsc, `pnpm test`, build, y recorrido con Playwright contra el backend real a 360 y 1280 px.

---

## 3. Bloqueado por el backend

### B1. Escudos de equipo

- **Lo que dice la spec:** `/jornadas/{id}` embebe `local_team` y `visitante_team` con logo, y las URLs son absolutas de R2.
- **Lo que devuelve hoy la API** (verificado 2026-10-05):
  - `partidos[]` solo trae `local_team_id`/`visitante_team_id`.
  - `logo_url` en `/api/v1/teams` es `data/team-assets/...` en 423 de 427 equipos, y esa ruta da 404.
- **Lo que tiene que hacer el backend:**
  1. Correr `python -m app.scripts.bootstrap_team_logos --force` (sin `--force` se saltea los equipos que ya tienen la ruta relativa).
  2. Embeber `local_team`/`visitante_team` `{id, name, short_name, logo_url}` en `/jornadas/{id}`, en `/picks` y en `/consensus`.
- **Cliente:** T10 deja todo listo. `TeamCrest` sirve las imágenes sin optimizar (`unoptimized`, como el avatar), así que no hace falta tocar `next.config.ts`. Nota 2026-10-05: `/jornadas/{id}` ya embebe `local_team`/`visitante_team` con URLs absolutas de R2; falta confirmar `/picks` y `/consensus`.

### B2. Pleno al 15 (y columnas): la spec contradice la regla real

- **Spec y backend actuales:** el pleno son tres columnas M0/M1/M2 con variantes tipo "1-0".
- **Regla real** (indicada por el usuario): en el pleno se elige **un valor por equipo**, los goles del local y los del visitante, entre `0`, `1`, `2` o `M`.
- **Cambio de contrato propuesto:** `{"partido_orden": 15, "pleno": {"local": "0|1|2|M", "visitante": "0|1|2|M"}}`. Afecta la validación, `/picks`, `/picks/me`, `/consensus` (voto por equipo, con empate multi-marca) y los datos ya guardados (migración).
- **Columnas:** pendiente de la decisión D3. Hasta que esté decidida, no tiene sentido cambiar el modelo dos veces.

### B3. Probar OAuth de verdad

Faltan `APP_URL` y las credenciales de Google y X en el `.env` del cliente, más las callback URLs dadas de alta. Sin eso los botones salen deshabilitados.

---

## 4. Desviaciones deliberadas (no se implementan como dice la spec)

| Spec | Cliente actual | Por qué |
|---|---|---|
| Token en `localStorage` | JWT en cookie HttpOnly, SameSite=Lax, Secure en producción | Un token en `localStorage` lo puede robar cualquier XSS; la cookie HttpOnly no es legible desde JavaScript |
| OAuth en el navegador (Google SDK y X) | Authorization Code + PKCE en route handlers del servidor | El canje de código de X necesita `client_secret`, y ese secreto no puede viajar al navegador |
| Mostrar `body.detail` al usuario | Mensajes propios en español por código de estado | `detail` llegó a contener texto de excepciones y emails; la UI no depende de textos del backend |
| Redirigir a `/` tras salir o eliminar un grupo | Redirige a `/groups` | `/` es ahora la portada pública; `/groups` es el destino útil |

---

## 5. Decisiones pendientes

| # | Pregunta | Recomendación |
|---|---|---|
| D1 | `POST /admin/teams/{id}/logo`: ¿es para el admin de una peña o para un admin global de la app? Un logo de equipo es global y afecta a todas las peñas | Admin global (rol de plataforma), fuera del MVP del cliente |
| D2 | ¿Hace falta una pantalla para explorar el catálogo de equipos? | No por ahora; los escudos llegan embebidos en la jornada (B1) |
| D3 | Columnas: ¿cada miembro vota una columna, varias columnas (hasta 8), o el boleto del grupo se arma en columnas? | Esperando respuesta del usuario |

---

## Ejecución de hoy

1. **Lote A (T1–T5):** auth, perfil y grupos. Un solo escritor y capturas para revisar.
2. **Lote B (T6–T9):** jornada y votos. Revisión.
3. **Lote C (T10–T12):** escudos con respaldo y pulido. Revisión.
4. **Commits por lote** (conventional commits). B1 y B2 se le pasan al backend en paralelo.
