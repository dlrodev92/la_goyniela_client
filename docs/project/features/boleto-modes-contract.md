# Boleto modes: agreed product rules and backend contract

Status: agreed with product on 2026-10-12. **Backend: done. Client: done** (see section 5 for the contract as shipped, which supersedes sections 2.1 to 2.4 where they differ: a fourth mode, `intuicion`, was added and the formats helper stayed múltiple-only).

## 1. Product rules

The price of one apuesta (one column) is `precio_apuesta_eur`, 0.75 € today, resolved from Losilla.

A peña's porra produces **one final boleto**, in one of three modes (a fourth, Intuición, was added later; see section 5):

| Mode | Columns on the boleto | Signs | Apuestas played | Cost |
|---|---|---|---|---|
| `sencilla` | N independent columns, **N ≥ 2** | exactly 1 sign per match in every column | N | N × price |
| `multiple` (directa) | 1 column | any number of dobles (D) and triples (T), D + T ≤ 14, at least one doble or triple | 2^D × 3^T | 2^D × 3^T × price |
| `reducida` | 1 column | D and T **exactly** as one of the official reductions below | the reduction's fixed count | count × price |

Official reductions:

| Code | Dobles | Triples | Equivalent múltiple | Apuestas played | Cost at 0.75 € | Guarantee if signs hit |
|---|---|---|---|---|---|---|
| `R1` | 0 | 4 | 81 | 9 | 6.75 € | 13 |
| `R2` | 7 | 0 | 128 | 16 | 12.00 € | 13 |
| `R3` | 3 | 3 | 216 | 24 | 18.00 € | 13 |
| `R4` | 6 | 2 | 576 | 64 | 48.00 € | 13 |
| `R5` | 0 | 8 | 6561 | 81 | 60.75 € | 12 |
| `R6` | 11 | 0 | 2048 | 132 | 99.00 € | 12 |

More rules:
- Matches without a doble or triple carry one fixed sign.
- Check the table against loteriasyapuestas.es before shipping.
- The app only **records** the boleto. The official system generates the reduced combinations, so the reduction matrices are not needed. They would only be needed for scoring individual apuestas, which is out of scope.
- **Pleno al 15:** one per boleto in every mode. It never multiplies apuestas and stays outside reductions. Its values are `local`/`visitante` ∈ {0, 1, 2, M}, where **M = 3 or more goals** (fix the backend docstrings that say "more than 3").
- **Budget:** the admin sets `budget_eur`, and the boleto cost must be ≤ budget. Realistic budgets are far below the 10,000 € client cap.
- **Admin control:** the admin chooses the mode and its parameters when creating the porra. The admin can change them while the porra is editable; if a boleto already exists, it has to be deleted first.

## 2. Backend contract changes

### 2.1 Porra

Add `modo: "sencilla" | "multiple" | "reducida"` to the porra (DB column, `PorraOut`, `PorraCreateIn`, `PorraPatchIn`).

| `modo` | Required params | Rules |
|---|---|---|
| `sencilla` | `columnas: int ≥ 2` | `dobles = triples = 0` |
| `multiple` | `dobles`, `triples` | D + T ≤ 14 and not (0, 0); this is today's behaviour |
| `reducida` | `reduccion: "R1".."R6"` | the backend sets `dobles`/`triples` from the table; the client does not send them |

Notes:
- `columns` on `PorraOut` means apuestas played: N, 2^D·3^T, or the reduction count. `cost_eur = columns × precio_apuesta_eur`. The server computes both, and the client never recomputes them.
- Replace the DB check `ck_porra_min_columns` with a mode-aware check: the sencilla needs N ≥ 2, the múltiple must not be (0, 0), and the reducida must have a valid code.
- Migration: existing porras become `modo = "multiple"`.
- PATCH must re-validate the **merged** state: mode params, D + T ≤ 14, and cost ≤ budget. It also keeps the 422 when a boleto exists and the format changes.

### 2.2 Formats helper

`GET /porras/porra-formats?jornada_id&budget_eur` returns every option that fits the budget, tagged by mode:

```json
[
  { "modo": "sencilla", "columnas": 6, "columns": 6, "coste_eur": "4.50" },
  { "modo": "multiple", "dobles": 1, "triples": 1, "columns": 6, "coste_eur": "4.50" },
  { "modo": "reducida", "reduccion": "R1", "dobles": 0, "triples": 4, "columns": 9, "coste_eur": "6.75" }
]
```

- **Sencilla:** return the largest N that fits as a single entry with `columnas_max`, or return a range. The client lets the admin pick N between 2 and `columnas_max`. Either shape works; document the one you choose.
- **Múltiple:** today's list.
- **Reducida:** every R1–R6 whose cost fits.

### 2.3 Boleto

`PUT /porras/{id}/boleto`:

```json
{
  "columnas": [
    { "matches": [ { "partido_orden": 1, "signs": ["1"] }, "... 14 rows" ] }
  ],
  "pleno": { "local": "1", "visitante": "M" }
}
```

Validation by mode:

| `modo` | Required `columnas` | Validation |
|---|---|---|
| `sencilla` | exactly N entries | every row has exactly 1 sign |
| `multiple` | exactly 1 entry | exactly D rows with 2 signs, T rows with 3, and the rest with 1 (today's validation) |
| `reducida` | exactly 1 entry | the counts must equal the reduction's D and T |

- For every mode: 14 rows per column, unique `partido_orden` 1–14, and cost ≤ budget.
- Keep accepting the legacy top-level `matches` as an alias for a single column, so the current client keeps working until it migrates.
- `GET /boleto` returns `modo`, `columnas` (the same shape), `pleno`, `columns`, `cost_eur`, `set_at` and `set_by_user_id`. Storage: `boleto_columns JSONB`; migrate the existing `boleto_matches` as one column.
- `DELETE /porras/{id}/boleto` already exists. Add tests for it and for `DELETE /porras/{id}`; neither has tests today.

### 2.4 Propuesta

`POST /porras/{id}/propuesta` keeps the vote tally per match (`vote_counts`) and the `pleno`. Proposed boleto by mode:

| `modo` | Proposal |
|---|---|
| `multiple` | today's behaviour |
| `reducida` | the same as múltiple, using the reduction's D and T |
| `sencilla` | column 1 = the most-voted sign per match; columns 2..N = the next most likely combinations (for example, change the least-certain match to its second sign), deduplicated |

The proposal is only a starting point; the admin edits it. Return it as `columnas` in the same shape as the boleto.

## 3. Backend fixes found in the audit

These are independent of the modes:

1. **Price fallback.** When Losilla has no `recaudacion_bote_live.coste_apuesta_eur`, the price silently becomes 0.50 €, which understates every porra by a third. Fail creation with a clear 409/422 ("precio no disponible"), or let the admin refresh the price.
2. **Price drift.** `porra-formats` prices with the current Losilla value, but PATCH validates with the stored porra price. Use the stored price for an existing porra.
3. **PATCH D + T ≤ 14** is not re-checked after merging with the stored values (today only the DB constraint catches it, as a 500).
4. **`budget_eur` is unbounded** in the schema, but the column is `Numeric(10,2)`, so huge values cause a 500. Add `le` and `decimal_places=2`.
5. **The propuesta greedy is not optimal** (`app/services/propuesta.py:267-312`). It picks triples by b+c and then dobles by b; random tests lose coverage in about 17% of cases. Use a DP or brute force over which upgraded matches become triples.
6. **`max_columns_for_budget`** is unused and can return the invalid (0, 0). Remove it.
7. **Docs.** M means 3 or more goals (`schemas/porra.py:52,229`).

## 4. What the client will do after the backend lands

- **Create porra:** a mode selector (Sencilla / Múltiple / Reducida), then the options that fit the budget from `porra-formats`. For the sencilla, an N picker from 2 to the max.
- **Editor:**
  - Sencilla: N columns of simples, with add or remove column within the limit and "copy previous column".
  - Múltiple / reducida: today's single column with the D/T counters.
  - One clear "Formato" line and one "Ahora" line.
- **`/final`:** render every column with its real count. This also fixes today's "Tu peña juega una columna" bug.
- **Delete boleto:** a "Borrar boleto para cambiar el formato" action using the existing DELETE. Budget-only edits stay allowed while a boleto exists.
- **Client-only fixes** that need no backend:
  - drop the duplicated cost lines in the editor;
  - show an over-placement warning;
  - remove the dead mismatch banner;
  - remove the stale "Todo simple" copy and the duplicated helpers.


## 5. Final contract as implemented (backend and client)

### 5.1 Modes

`PorraModo = "multiple" | "sencilla" | "reducida" | "intuicion"`.

| Mode | Create / patch fields | Boleto (`columnas`) | Apuestas played |
|---|---|---|---|
| `multiple` | `dobles`, `triples` (D + T ≤ 14, not (0, 0)) | 1 column with exactly D doubles and T triples | 2^D · 3^T |
| `sencilla` | `columnas` (2..12) | exactly `columnas` columns, 1 sign per match | `columnas` |
| `reducida` | `reduccion` (`R1`..`R6`) | 1 column with exactly the reduction's D and T | the reduction's `apuestas` |
| `intuicion` | `fijos` (0..13), `columnas` (2..12) | exactly `columnas` columns, 1 sign per match; matches 1..`fijos` carry the same sign in every column | `columnas` |

- `POST /groups/{g}/porras` is discriminated by `modo` (default `multiple`). The client never sends `precio_apuesta_eur` and never sends `dobles`/`triples` for a reducida (the server stamps them).
- `PorraOut` adds `modo`, `fijos` (intuicion), `columnas` (sencilla and intuicion). `dobles`/`triples` stay (derived for reducida, 0 for sencilla and intuicion). `columns` and `cost_eur` are always the server's; the client does not recompute them.
- `PATCH /porras/{id}` takes the same fields, all optional. A budget-only patch is always allowed. A format or mode change must be preceded by `DELETE /porras/{id}/boleto`.
- Reductions (mirrored in the client as display and selection data only; source of truth is `app/services/reducciones.py`): R1 0D+4T 9 apuestas, R2 7D 16, R3 3D+3T 24, R4 6D+2T 64, R5 8T 81, R6 11D 132.
- `GET /groups/{g}/porras/intuicion-options?budget_eur=5.00` returns `{budget_eur, options: [{columnas, fijos, variables, cost_eur}]}` sorted by `columnas` descending. Any member. The server prices it at `columnas × 0.75 €`.
- `GET /porras/porra-formats` is unchanged and lists múltiple formats only. The client prices sencilla and reducida options with the per-column price implied by that list.

### 5.2 Boleto

- `PUT /porras/{id}/boleto` body: `{columnas: [{matches: [{partido_orden, signs[]} × 14]}], pleno: {local, visitante}}`. The client no longer sends the legacy top-level `matches`.
- `GET /porras/{id}/boleto` returns `{porra_id, modo, set_at, set_by_user_id, columnas, pleno, columns, cost_eur, reduccion}`.
- `GET /porras/{id}/boleto.pdf` returns `application/pdf` (any member; 404 without a boleto, 403 for a non-member). The client serves it through a BFF route handler at `/groups/{g}/porras/{p}/boleto.pdf` that reads the session from the HttpOnly cookie and streams the PDF with its `Content-Type` and `Content-Disposition`.
- `POST /porras/{id}/propuesta` is still single-column. For sencilla and intuicion the client builds the N starting columns itself (domain function `seedColumnsFromPropuesta`): column 1 is the most voted sign per match; the next columns are the next best combinations by lost vote weight (best-first, no repeats); in intuicion, matches 1..`fijos` take their most voted sign in every column and only the other matches vary.

### 5.3 Client behaviour

- Create and settings: budget, then mode, then that mode's options (múltiple formats; sencilla column count; the six reductions with those over budget disabled; intuicion advisor options).
- Editor: múltiple and reducida keep the single column with D/T counters; sencilla and intuicion edit one column at a time with an N × 14 overview matrix, "copy previous column", and fijos edited once and mirrored.
- `/final`: every column with the real apuestas count and cost, the pleno, and "Descargar PDF".
- Budget-only edits stay available with a boleto; "Borrar boleto para cambiar el formato" deletes it after an in-page confirmation.

### 5.4 Gaps found in the backend while integrating (not fixed here)

1. `PorraPatchIn` only guards an existing boleto for `multiple` (and only through `boleto_matches`). Changing the mode, `columnas`, `fijos` or `reduccion` with a boleto saved is accepted and leaves a stale boleto. The client checks `has_boleto` before every format patch.
2. The create validators and the endpoint do not re-check `columnas × price ≤ budget` (sencilla, intuicion) or `apuestas × price ≤ budget` (reducida) with the resolved price; the schema validator uses a 0.50 € fallback. A too-small budget is only rejected later by `PUT /boleto`. The client prices these options before creating.
3. `PorraOut` does not expose `reduccion` (only `BoletoOut` does). The client derives the code from (`dobles`, `triples`), which is unique per reduction.
4. `intuicion-options` uses a fixed 0.75 € per column, while the porra later prices with its own `precio_apuesta_eur`.
5. `POST /propuesta` returns `columns` and `cost_eur` for the single proposed column; the client ignores them for sencilla, intuicion and reducida and uses the porra's totals.
