# Cliente de la porra: boleto por columnas y jornada separada de la apuesta

Plan para adaptar el cliente al modelo de porra ya implementado en el backend (`/groups/{gid}/porras/**`). Hay dos ideas de producto:

1. **Un boleto que se ve como la quiniela real en papel**, por columnas, aunque cada miembro rellene solo una.
2. **La jornada (información) separada de la apuesta (porra).** El boleto se rellena en un panel que no tapa los datos de la jornada, para que el usuario pueda consultar horarios, comentarios y bote mientras decide.

## Experiencia

| Pieza | Comportamiento |
|---|---|
| **Jornada** (`/jornadas/[id]`) | Solo información: partidos, escudos, horarios, comentarios, bote, escrutinio. Si el usuario tiene porras abiertas para esa jornada, muestra un acceso "Rellenar mi boleto en {peña}" |
| **Porra** (`/groups/[gid]/porras/[pid]`) | Debajo de la cabecera de la porra (peña, jornada, formato, presupuesto, columnas, coste, participación), los mismos datos de la jornada. Abajo, una barra fija con el botón "Rellenar mi boleto" / "Editar mi boleto" |
| **Boleto** (`/groups/[gid]/porras/[pid]/boleto`) | Se abre como **hoja modal** sobre la porra mediante una intercepting route de Next, así la URL se puede compartir y el botón atrás la cierra. En móvil es una hoja inferior que se puede **minimizar** para volver a consultar los partidos sin perder lo marcado. En escritorio es un **panel lateral** fijo, con los datos de la jornada a la izquierda. Al entrar directo a la URL se ve como página completa |
| **Ayuda para decidir** | Cada fila del boleto tiene un botón ⓘ que muestra, sin salir del boleto, el horario, el comentario editorial y el resultado de ese partido |

## El boleto (componente `Boleto`)

- **Aspecto de boleto real:**
  - papel crema (`#F6EBD7`) con tinta oscura;
  - cabecera con "LA QUINIELA", el número de jornada y la temporada;
  - **filas 1–14** con los dos equipos y su escudo pequeño;
  - **columnas de casillas 1 · X · 2**, que se marcan con una X dibujada;
  - abajo, la caja del **Pleno al 15**, con local y visitante, cada uno con casillas 0 · 1 · 2 · M.
- **Columnas:** se dibuja el número de columnas del boleto real. **Solo la primera está activa.** Las demás se ven, pero deshabilitadas y atenuadas, con la leyenda "Tu peña juega una columna". El componente acepta `activeColumns` para poder abrir más columnas en el futuro sin rediseñarlo.
- **Modos:**

  | Modo | Quién | Qué permite |
  |---|---|---|
  | `vote` | Miembro | 1 a 3 marcas por fila; el pleno con un valor por equipo |
  | `proposal` | Admin | Ver la propuesta de la media, con el reparto por fila (barras 1/X/2) y qué filas salen dobles o triples |
  | `edit` | Admin | Editar la propuesta: contadores "Dobles 1/1 · Triples 0/1", columnas y coste en vivo, y bloqueo si se pasa del presupuesto |
  | `final` | Todos | Solo lectura del boleto oficial, con sello "Boleto de la peña", columnas y coste |
- **Accesibilidad:** cada fila es un `fieldset` con casillas reales (`checkbox` en las filas 1–14, `radio` en el pleno) y un texto equivalente ("Partido 3, Barcelona contra Getafe: 1 y X"). Funciona sin hover y a 360 px; en móvil la fila se lee como "nº · equipos · casillas".

## Flujos

| Flujo | Pasos | Endpoints |
|---|---|---|
| Crear porra (admin) | Desde la peña o desde la jornada: "Crear porra" → elegir jornada activa → presupuesto → lista de formatos que caben (dobles, triples, columnas, coste) → crear | `GET .../porras/porra-formats`, `POST .../porras` |
| Cambiar formato (admin) | Mientras esté abierta | `PATCH .../porras/{pid}` |
| Votar (miembro) | Abrir el boleto → marcar → "Guardar mi boleto" → precargado al volver | `POST .../picks`, `GET .../picks/me` |
| Participación | Quién votó, con sus votos si `show_picks` está activo; se actualiza cada 30 s | `GET .../picks`, `participation` |
| Propuesta y boleto final (admin) | "Calcular propuesta" → modo `proposal` → "Ajustar" → modo `edit` → "Confirmar boleto de la peña" | `POST .../propuesta`, `PUT .../boleto` |
| Ver el boleto final | En la porra, en la peña y en el dashboard | `GET .../boleto` |
| Quiniela (barra de navegación) | Lleva a la porra abierta de tu peña; con varias, un selector; sin porra abierta, "Tu admin todavía no ha abierto la porra" | `GET .../porras?jornada_id=` |

## Lotes

| Lote | Contenido | Revisión |
|---|---|---|
| **1. Base** | Dominio y gateway Zod de porras (todos los schemas nuevos). Componente `Boleto` con los modos `vote` y `final` y su lógica pura (marcas, validación, columnas 2^D·3^T, coste) con tests. Escaparate en `/dev/ui` | Capturas del boleto a 360 y 1280 |
| **2. Miembro** | Página de la porra, hoja modal del boleto con la intercepting route y la minimización, ⓘ por partido, guardar y precargar, participación, `/quiniela`, acceso desde la jornada. **Retirar** `matchdays/[id]` dentro de la peña y las features `picks` y `consensus` viejas | Recorrido real contra el backend |
| **3. Admin** | Crear porra con presupuesto y formatos, cambiar formato, propuesta, edición con contadores y bloqueo por presupuesto, guardar el boleto final, vista final para todos | Recorrido real contra el backend |

## Respuestas a las dudas del backend

| Duda | Respuesta propuesta |
|---|---|
| Precio por defecto 0,50 € | **Decidido (2026-10-06): 0,75 € por apuesta (columna).** Sencilla: mínimo 2 apuestas (1,50 €). Múltiple: 2^D·3^T apuestas. Reducidas: número de apuestas oficial (ver porra-model.md) |
| Porcentajes de Losilla | No están en la API: el scraper de Losilla los ignora. Hay que extraer el reparto 1/X/2 por partido (y el del pleno si existe) y exponerlo en `/api/v1/losilla/jornada/{n}`. El cliente ya muestra el hueco y lo rellena cuando lleguen |
| `PATCH` del precio | No hace falta exponerlo si el precio se toma de Losilla al crear la porra |
| Documentación desactualizada | Sí, actualizar los cuatro documentos: el cliente los usa como referencia |
