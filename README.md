# GMAO-AI · Gálvanica Operaciones Inteligentes

Sistema de gestión de mantenimiento (CMMS) con KPIs de confiabilidad calculados
sobre datos reales. **Fases 1–3 completas**: modelo de datos, CRUD de activos y
órdenes de trabajo, motor de KPIs, dashboard y priorización asistida por IA.

## Stack

Next.js 15 (App Router, RSC + Server Actions) · TypeScript strict · Tailwind v4 ·
Postgres 17 · Drizzle ORM · Zod · Recharts · Vitest · Gemini (`@google/genai`).
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
- `pnpm db:seed` — datos de demostración: 21 activos, 12 meses de historia

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

## Estructura

```
src/
├─ app/
│  ├─ dashboard/        KPIs, tendencia, Pareto, malos actores
│  ├─ activos/          CRUD + jerarquía (CTE recursiva)
│  ├─ ordenes/          CRUD + filtros + cierre rápido
│  └─ priorizacion/     score determinista + análisis del modelo
├─ components/          UI, gráficos, formularios
├─ db/schema/           Drizzle: activos, OT, modos de falla, planes, ai_insights
└─ lib/
   ├─ kpi/formulas.ts   MTTR, MTBF, disponibilidad, Pareto — puras + tests
   ├─ kpi/risk.ts       score de riesgo de OT — puro + tests
   ├─ kpi/queries.ts    agregación en SQL
   ├─ ai/tools.ts       herramientas de solo lectura para tool use
   ├─ ai/prioritize.ts  bucle agéntico + salida estructurada
   ├─ actions/          Server Actions
   └─ validation.ts     esquemas Zod compartidos
```

## Roadmap

- [x] **F1** Esquema, seed y CRUD de activos y órdenes de trabajo
- [x] **F2** Motor de KPIs y dashboard
- [x] **F3** Priorización de OT con Gemini vía *function calling*, con score determinista
      y bitácora auditable en `ai_insights`
- [ ] **F4** Análisis de causa raíz y detección de fallas repetitivas
- [ ] **F5** Importador de Excel, exportación PDF y despliegue al VPS
