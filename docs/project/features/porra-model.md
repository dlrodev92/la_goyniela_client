# La porra de la peña: modelo acordado y contrato propuesto

Cómo juega una peña cada jornada en La Goyniela, cómo se calcula el boleto del grupo a partir de la media de todos y qué tiene que exponer la API para soportarlo. Sustituye al modelo actual de la API (configuración global por jornada, pleno M0/M1/M2), que no encaja con el producto.

## Flujo acordado (2026-10-05)

1. **El admin crea la porra** de su peña para una jornada activa. Fija el **presupuesto** y elige un **formato** que quepa en él: cuántos **dobles** y cuántos **triples** llevará el boleto. El resto de partidos van simples.
2. **Cada miembro vota a su manera:** en cada partido del 1 al 14 marca los signos que quiera (1, 2 o 3), y en el pleno al 15 elige los goles de cada equipo.
3. **La media genera un boleto propuesto.** El formato del admin se aplica sobre la media de todos los votos: los dobles y triples caen en los partidos donde el grupo está más dividido, y el resto toma el signo más votado.
4. **El admin decide el boleto final.** Parte de la propuesta y puede cambiar signos, mover los dobles y triples de partido (respetando el formato, o cambiándolo si sigue dentro del presupuesto) y elegir el pleno. Al confirmar, el boleto queda **guardado como el boleto oficial de la peña** para esa jornada, y cualquier miembro puede verlo.

## Reglas del juego (Quiniela real)

| Regla | Valor |
|---|---|
| Partidos 1–14 | Signo 1, X o 2. Simple = 1 signo, doble = 2, triple = 3 |
| Pleno al 15 | **Un valor por equipo**: goles del local ∈ {0, 1, 2, M} y goles del visitante ∈ {0, 1, 2, M}. No admite dobles ni triples |
| Columnas (apuestas) de un boleto múltiple | **2^dobles × 3^triples**. Todo simple = 1 columna. Ejemplo: 2 dobles + 1 triple = 12 columnas |
| Coste | **apuestas × 0,75 €** (confirmado 2026-10-06; coincide con `coste_apuesta_eur` de Losilla y con las reducidas oficiales: 9 → 6,75 €, 16 → 12 €, 132 → 99 €) |
| Tipos de jugada | **Sencilla:** 1 signo por partido, mínimo 2 apuestas (2 columnas, 1,50 €). **Múltiple:** dobles y triples, mínimo 1 doble, 2^D·3^T apuestas. **Reducidas oficiales:** 1ª 4T → 9 apuestas; 2ª 7D → 16; 3ª 3D+3T → 24; 4ª 2T+6D → 64; 5ª 8T → 81; 6ª 11D → 132. Pendiente de rediseñar el formato de la porra como "tipo de jugada" |

## Algoritmo de la media

**Entrada:** los votos de los miembros y el formato (D dobles, T triples).

1. **Peso del voto.** Cada miembro aporta **1 voto por partido**, repartido a partes iguales entre los signos que marcó (1 signo = 1; doble = 0,5 + 0,5; triple = 1/3 cada uno). Así, marcar un triple no pesa más que marcar un simple. *Confirmado (P1).*
2. **Reparto por partido.** Para cada partido se calcula el porcentaje de cada signo (s₁, sₓ, s₂) y se ordenan de mayor a menor: a ≥ b ≥ c.
3. **Ganancia de cubrir más signos.**
   - Pasar a doble gana **b**.
   - Pasar a triple gana **b + c**.
4. **Asignación.** Se elige el reparto de T triples y D dobles entre los 14 partidos que **maximiza la cobertura total del voto del grupo** (la suma de las ganancias). Con 14 partidos se resuelve de forma exacta. Los empates se rompen por posición del partido.
5. **Signos del boleto.**
   - Simple: el más votado (a).
   - Doble: los dos más votados (a, b).
   - Triple: los tres.
   - Empates de signo: 1 > X > 2.
6. **Pleno al 15.** Por cada equipo, el valor más votado entre 0, 1, 2 y M. Empate: pendiente de decidir (P2).
7. **Salida.** Por partido: reparto, signos elegidos y tipo (simple/doble/triple). Además el pleno, el total de columnas, el coste y cuántos miembros votaron.

## Contrato propuesto para el backend

La configuración pasa de la tabla `jornada` (global) a una entidad **porra** por peña.

| Entidad `porra` | |
|---|---|
| Campos | `id`, `group_id`, `jornada_id`, `created_by`, `budget_eur`, `dobles`, `triples`, `precio_apuesta_eur`, `status` (`open` \| `closed`), `created_at` |
| Restricción | Única por (`group_id`, `jornada_id`) |

| Método | Ruta | Quién | Qué hace |
|---|---|---|---|
| `GET` | `/groups/{gid}/porras?jornada_id=` | Miembro | Lista las porras de la peña |
| `GET` | `/groups/{gid}/porra-formats?jornada_id=&budget_eur=` | Admin | Formatos que caben en el presupuesto: `[{dobles, triples, columnas, coste_eur}]`, ordenados por columnas |
| `POST` | `/groups/{gid}/porras` | Admin | Crea la porra: `{jornada_id, budget_eur, dobles, triples}`. 409 si ya existe; 422 si el formato no cabe en el presupuesto o la jornada no está activa |
| `GET` | `/groups/{gid}/porras/{pid}` | Miembro | Detalle: formato, columnas, coste, estado y participación |
| `PATCH` | `/groups/{gid}/porras/{pid}` | Admin | Cambia el presupuesto o el formato mientras esté abierta. Los votos no dependen del formato, así que no hace falta congelarlo |
| `POST` | `/groups/{gid}/porras/{pid}/picks` | Miembro | `{picks: [{partido_orden: 1..14, signs: ["1"\|"X"\|"2", ...] (1–3 únicos)}], pleno: {local: "0"\|"1"\|"2"\|"M", visitante: …}}`. Idempotente; 403 si la porra o la votación están cerradas |
| `GET` | `/groups/{gid}/porras/{pid}/picks/me` | Miembro | Mis votos, o 404 si no voté |
| `GET` | `/groups/{gid}/porras/{pid}/picks` | Miembro | Participación; los votos de cada miembro solo si `show_picks` |
| `POST` | `/groups/{gid}/porras/{pid}/propuesta` | Admin | Calcula la media y devuelve el boleto **propuesto** (algoritmo de arriba) sin guardarlo, con la participación que haya y la lista de quién falta |
| `PUT` | `/groups/{gid}/porras/{pid}/boleto` | Admin | Guarda el boleto **final** decidido por el admin: `{matches: [{partido_orden, signs}], pleno: {local, visitante}}`. Valida que el número de dobles y triples dé un coste dentro del presupuesto. Se puede reemplazar mientras la votación siga abierta |
| `GET` | `/groups/{gid}/porras/{pid}/boleto` | Miembro | Boleto final con sus columnas y su coste, o 404 si el admin todavía no lo decidió |

**Además:**
- Retirar `quini_config` de `jornada` y los endpoints `/open`, `/optimize` y `/cost` (los sustituyen `porra-formats` y `porras`).
- Corregir el cálculo de columnas a 2^D × 3^T.
- Migrar el pleno a `{local, visitante}`.

## Plan del cliente

| # | Entrega | Depende de |
|---|---|---|
| 1 | **Sección Jornadas:** todas las jornadas y su detalle (partidos con escudos, día y hora, comentarios, bote, precio y escrutinio) | Nada; en curso |
| 2 | **Crear porra (admin):** presupuesto → formatos que caben → elegir → crear | Backend: porras y formatos |
| 3 | **Votar:** chips 1/X/2 de selección múltiple por partido, más el pleno con dos selectores 0/1/2/M | Backend: picks por porra |
| 4 | **Boleto del grupo:** la propuesta de la media con el reparto por partido; el admin la edita (signos, dobles, triples, pleno) viendo columnas y coste en vivo, y la confirma. Todos ven el boleto final con formato de boleto real | Backend: propuesta y boleto |

El formulario de votos y el boleto actuales (signo único, pleno M0/M1/M2) **se sustituyen** en las entregas 3 y 4. Hasta entonces quedan incompatibles con MVP-04 (`sign` → `signs`).

## Pendiente de decidir

| # | Pregunta | Propuesta |
|---|---|---|
| P1 | ¿Un doble o triple de un miembro pesa lo mismo que un simple? | **Decidido (2026-10-05):** sí, 1 voto por partido repartido entre los signos marcados |
| P2 | Empate en el pleno (mismo número de votos para dos valores) | **Decidido (2026-10-05):** la propuesta usa el valor con menos goles y el admin decide el final |
| P3 | ¿Se puede generar el boleto si falta gente por votar? | **Decidido (2026-10-05):** sí. La propuesta usa la participación que haya y muestra quién falta, y el admin decide cuándo confirmar el boleto final |
