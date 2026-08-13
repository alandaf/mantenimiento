# GMAO-AI · Gálvanica Operaciones Inteligentes

Sistema de gestión de mantenimiento (CMMS) con KPIs de confiabilidad calculados
sobre datos reales. **Fases 1–5 completas**: modelo de datos, CRUD de activos y
órdenes de trabajo, motor de KPIs, dashboard, priorización asistida por IA, análisis de causa raíz, importador de
Excel y reporte mensual en PDF.

## Stack

Next.js 15 (App Router, RSC + Server Actions) · TypeScript strict · Tailwind v4 ·
Postgres 17 · Drizzle ORM · Zod · Recharts · Vitest · Gemini (`@google/genai`) ·
ExcelJS · @react-pdf/renderer.
Todo corre en Docker.

## Arrancar

Requisitos: Docker Desktop. Nada más — ni Node ni Postgres en el host.

```bash
cp .env.example .env
docker compose -f docker/compose.yml -f docker/compose.dev.yml --env-file .env up -d --build
```

Luego, esquema y datos de demostración:

```bash
docker compose -f docker/compose.yml -f docker/compose.dev.yml --env-file .env exec web pnpm db:push --force
```

```bash
docker compose -f docker/compose.yml -f docker/compose.dev.yml --env-file .env exec web pnpm db:seed
```

| Servicio | URL |
|---|---|
| App | http://localhost:3100 |
| Adminer (BD) | http://localhost:8080 · servidor `db`, usuario/clave `gmao` |
| Postgres | `localhost:5432` |

El puerto de la app se cambia con `WEB_PORT` en `.env` (por defecto 3100, porque
el 3000 suele estar ocupado).

## Comandos

Todos se ejecutan dentro del contenedor para que dev y producción no diverjan:

```bash
docker compose -f docker/compose.yml -f docker/compose.dev.yml --env-file .env exec web pnpm test
```

- `pnpm test` — tests unitarios de las fórmulas de KPI
- `pnpm typecheck` — TypeScript sin emitir
- `pnpm db:generate` / `db:migrate` — migraciones versionadas (para producción)
- `pnpm db:push` — sincroniza el esquema sin migración (solo desarrollo)
- `pnpm db:seed` — datos de demostración industriales (planta de galvanizado)
- `pnpm db:seed marino` — flota marina: sala de máquinas, cubierta y casco de un
  buque portacontenedores

## Configuración regional

La moneda y el locale se definen en `.env` y se leen en un solo sitio
([config.ts](src/lib/config.ts)):

```
APP_LOCALE=es-CL
APP_CURRENCY=CLP
```

Alcanza a la interfaz, el PDF, las etiquetas de formulario y los prompts del
modelo. Las monedas sin subunidad de uso corriente (CLP, JPY, COP…) se formatean
sin decimales automáticamente.

## Sets de datos

El generador de demostración es común; lo que cambia entre mercados es el
catálogo. Añadir un rubro nuevo es escribir datos, no lógica
([seeds/types.ts](src/db/seeds/types.ts)).

| Set | Contenido |
|---|---|
| `industrial` | Planta de galvanizado: hornos, bombas, compresores, servicios auxiliares |
| `marino` | Buque portacontenedores: motor principal, auxiliares, purificadoras, servomotor, casco |

El set marino refleja diferencias reales del rubro: reparaciones más largas
porque no hay taller a mano, redundancia de auxiliares, equipos cuya criticidad
viene de la consecuencia de falla y no del lucro cesante, y la corrosión por agua
salada como modo de falla dominante.

> Nota: el preventivo marino se programa en la práctica por horas de
> funcionamiento. El modelo de planes es por calendario, así que aquí se
> aproxima; soportar horómetros es un cambio de esquema pendiente.

## Cómo se calculan los KPIs

Los indicadores **no** son estimaciones ni salidas de un modelo: se agregan en
SQL y se combinan con funciones puras cubiertas por tests.

| KPI | Fórmula |
|---|---|
| MTTR | `Σ(fin − inicio) / nº correctivas cerradas` |
| MTBF | `horas operativas / nº de fallas` |
| Disponibilidad inherente | `MTBF / (MTBF + MTTR)` |
| Disponibilidad operacional | `(calendario − parada) / calendario` |
| Cumplimiento PMP | `preventivas ejecutadas / programadas` |
| Trabajo reactivo | `horas correctivas / horas totales` |

Decisiones que evitan errores comunes:

- **El MTBF usa horas operativas, no calendario.** Un activo no puede fallar
  mientras está detenido; usar calendario infla el indicador.
- **El tiempo operativo de la flota cuenta solo equipos**, no la planta ni las
  líneas: son agrupadores del árbol, no activos que fallen.
- **Un KPI sin datos devuelve `null`, no `0`.** Un MTTR de 0 significaría
  reparación instantánea y contaminaría la disponibilidad.
- **Las tres marcas de tiempo se validan en la entrada** (`reportado ≤ inicio ≤
  fin`): un MTTR negativo rompería todo el tablero.
- **Toda correctiva exige modo de falla**, porque sin él no hay Pareto ni
  análisis de causa raíz.

## Priorización con IA (fase 3)

La página `/priorizacion` combina dos capas que nunca se mezclan:

1. **Score determinista 0–100**, calculado en el servidor por una función pura
   con tests ([risk.ts](src/lib/kpi/risk.ts)). Cinco factores con techo propio:
   criticidad del activo (30), prioridad declarada (25), antigüedad de la OT (18),
   fallas repetidas en 90 días (15) y exposición económica por hora de parada (12).
2. **Análisis de Gemini**, que recibe ese score ya calculado y aporta lo que la
   aritmética no ve: patrones de falla repetitiva, planes preventivos vencidos,
   dependencias entre equipos de una línea.

El modelo accede a los datos mediante **function calling** — `get_kpis`, `get_failure_pareto`,
`get_asset_context`, `get_asset_history` — todas de solo lectura y todas devolviendo
cifras ya computadas en SQL. **El modelo no calcula ningún indicador**: si no puede
verificar un número con una herramienta, no puede afirmarlo. La salida se fuerza con
*structured outputs* contra un esquema JSON y se valida con Zod antes de tocar la BD.

Cada ejecución queda registrada en `ai_insights` con el modelo, el prompt y los datos
de entrada — trazable de punta a punta.

Sin `GEMINI_API_KEY` la aplicación funciona igual y el score determinista sigue
visible; solo se deshabilita el botón de análisis.

## Análisis de causa raíz (fase 4)

La página `/causa-raiz` sigue la misma separación de capas que F3.

**Detección determinista.** Un patrón es el mismo modo de falla reincidiendo en el
mismo activo. Lo relevante no es solo la frecuencia sino **si los intervalos se
acortan**: un equipo que falla cada 90, 60 y luego 30 días se está degradando.
[recurrence.ts](src/lib/kpi/recurrence.ts) calcula intervalos, tendencia,
cronicidad y prioridad — funciones puras con 18 tests.

La tendencia exige al menos 4 eventos (3 intervalos). Con menos devuelve
`indeterminada` en vez de fingir una pendiente sobre ruido.

**Análisis con IA.** Sobre cada patrón, el modelo produce 5 Porqués e Ishikawa (6M)
consultando el historial real por function calling. Dos reglas lo mantienen honesto:

- Cada eslabón de los 5 Porqués lleva su evidencia, y si no la tiene debe marcarse
  como `hipótesis: falta evidencia`. La UI las distingue visualmente (⚠ vs ✓).
- La confianza la determinan los datos, no lo redondo del razonamiento. El modelo
  además declara qué habría que registrar para cerrar el análisis.

Las acciones se clasifican por tipo (correctiva / preventiva / predictiva / rediseño)
y plazo, con la instrucción explícita de atacar la causa y no el síntoma.

## Importador de Excel (fase 5)

`/importar` carga el histórico que hoy vive en una hoja de cálculo. El trabajo
está en tolerar archivos reales, que nunca vienen con el formato esperado:

- **Cabeceras por sinónimo**, sin distinguir mayúsculas, tildes ni símbolos:
  «Equipo», «N° OT» y «Fecha Solicitud» se reconocen solas. Las columnas que no
  se reconocen se ignoran sin bloquear la carga.
- **Fechas** en serial de Excel, `dd/mm/aaaa` o ISO. **Números** como `1.234,50`
  o `S/ 1,234.50`.
- **Validación fila por fila.** Un importador que falla entero por una celda mala
  es inservible: las filas válidas entran y las inválidas se listan con su motivo
  y su número de fila del Excel, para corregirlas en el archivo original.
- **Las mismas reglas de negocio que el formulario** — un MTTR negativo
  envenenaría el tablero igual venga de la UI o de un Excel.
- **Dos pasos**: validar sin importar, y luego confirmar. La inserción es
  transaccional: o entra todo o no entra nada.
- Los códigos ya existentes se omiten en vez de duplicarse.

Hay una plantilla descargable en `/api/plantilla` con las cabeceras exactas, una
fila de ejemplo y una hoja de instrucciones.

Para ejercitar el pipeline contra un archivo deliberadamente sucio:

```bash
docker compose -f docker/compose.yml -f docker/compose.dev.yml --env-file .env exec web pnpm tsx scripts/test-import.ts
```

## Reporte mensual en PDF (fase 5)

`/reportes` genera un PDF de dos páginas por mes con datos: indicadores clave,
distribución de OT, Pareto de fallas, activos de mayor impacto, patrones
repetitivos y una sección de metodología que explica cómo se calcula cada
indicador, para que quien reciba el reporte pueda auditarlo.

Usa exactamente las mismas consultas que el dashboard: si la pantalla y el
reporte divergieran, el reporte dejaría de servir para decidir.

## Estructura

```
src/
├─ app/
│  ├─ dashboard/        KPIs, tendencia, Pareto, malos actores
│  ├─ activos/          CRUD + jerarquía (CTE recursiva)
│  ├─ ordenes/          CRUD + filtros + cierre rápido
│  ├─ priorizacion/     score determinista + análisis del modelo
│  ├─ causa-raiz/       patrones repetitivos + 5 Porqués e Ishikawa
│  ├─ importar/        carga de Excel con validación fila por fila
│  ├─ reportes/        descarga del reporte mensual
│  └─ api/             plantilla .xlsx y reporte .pdf
├─ components/          UI, gráficos, formularios
├─ db/schema/           Drizzle: activos, OT, modos de falla, planes, ai_insights
└─ lib/
   ├─ kpi/formulas.ts   MTTR, MTBF, disponibilidad, Pareto — puras + tests
   ├─ kpi/risk.ts       score de riesgo de OT — puro + tests
   ├─ kpi/recurrence.ts intervalos, tendencia y cronicidad — puro + tests
   ├─ kpi/patterns.ts   detección de fallas repetitivas en SQL
   ├─ kpi/queries.ts    agregación en SQL
   ├─ ai/tools.ts       herramientas de solo lectura para tool use
   ├─ ai/prioritize.ts  bucle agéntico + salida estructurada
   ├─ ai/rca.ts         5 Porqués + Ishikawa con evidencia declarada
   ├─ import/           parser de Excel + validación — puro + tests
   ├─ report/           datos y maquetación del PDF mensual
   ├─ actions/          Server Actions
   └─ validation.ts     esquemas Zod compartidos
```

## Roadmap

- [x] **F1** Esquema, seed y CRUD de activos y órdenes de trabajo
- [x] **F2** Motor de KPIs y dashboard
- [x] **F3** Priorización de OT con Gemini vía *function calling*, con score determinista
      y bitácora auditable en `ai_insights`
- [x] **F4** Detección de fallas repetitivas y análisis de causa raíz
      (5 Porqués + Ishikawa) con evidencia e hipótesis diferenciadas
- [x] **F5** Importador de Excel y reporte mensual en PDF
- [ ] **F6** Despliegue al VPS (pendiente: IP, acceso SSH y dominio)
