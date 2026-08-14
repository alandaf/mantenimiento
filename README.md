# PMS SIMARP

**Planned Maintenance System** para flotas marinas e instalaciones industriales.

Sistema de gestión de mantenimiento con KPIs de confiabilidad calculados
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

## Multi-instalación

Una instancia puede atender a varios buques o plantas. La **organización** es la
frontera: cada fila de dominio lleva `organization_id` y **toda** consulta filtra
por la organización activa de la sesión, que se resuelve desde la sesión y nunca
desde un parámetro de la petición — si viniera de la URL, cambiar un número daría
acceso a la flota ajena.

Tres cosas que hubo que corregir al probarlo con dos buques reales, y que con uno
solo habrían pasado desapercibidas:

- **Las restricciones de unicidad eran globales.** Dos buques tienen cada uno su
  `EQ-101` y su `FM-001`; ahora son únicos por organización.
- **Las listas filtraban pero las páginas de detalle no.** Escribir el id de una
  orden ajena en la URL la abría. Ahora devuelve 404.
- **La configuración y la lista de usuarios se compartían** entre instalaciones.

El seed crea dos buques deliberadamente distintos —un portacontenedores y un
granelero, con activos que no se solapan— porque con instalaciones idénticas un
fallo de aislamiento no se nota:

```bash
docker compose -f docker/compose.yml -f docker/compose.dev.yml --env-file .env exec web pnpm db:seed
```

Cada cuenta se asocia a una instalación por su slug:

```bash
docker compose -f docker/compose.yml -f docker/compose.dev.yml --env-file .env exec web pnpm tsx scripts/create-admin.ts "Nombre" correo@naviera.cl "clave-larga" bahia-valparaiso
```

## Autenticación y roles

Correo y contraseña, sin registro público: **las cuentas las crea el
administrador de la instalación**. Se eligió así por el contexto — a bordo la
conectividad es intermitente y un flujo OAuth contra un proveedor externo puede
quedar colgado, y el Jefe de Máquinas necesita dar de alta al cadete que embarca
mañana sin depender de TI en tierra.

| Rol | Puede |
|---|---|
| Administrador | Todo, más la gestión de cuentas |
| Jefe de Máquinas | Todo el mantenimiento; no gestiona cuentas |
| Planificador | Además importa datos y planifica rutinas |
| Técnico | Registra lecturas, ejecuta y cierra órdenes |
| Solo lectura | Consulta tableros y reportes |

Tres decisiones que sostienen esto:

- **Ocultar un enlace del menú no es seguridad.** El rol se comprueba en cada
  página y, sobre todo, en cada acción del servidor — que es la puerta real.
- **Los route handlers viven fuera del layout autenticado**, así que comprueban
  sesión por su cuenta. El PDF mensual contiene costos, fallas y activos: sin esa
  comprobación cualquiera con la URL se llevaba la operación completa.
- **Las cuentas se deshabilitan, no se borran.** El histórico de órdenes queda
  ligado a quien las ejecutó; borrarlas rompería la trazabilidad.

## Consola de plataforma

Dar de alta un cliente era una tarea de servidor: entrar por SSH y ejecutar un
script. Eso convertía una decisión comercial en un cuello de botella técnico, y
desplegar así habría sido desplegar el cuello de botella.

El **operador de plataforma** existe para eso. No es "un administrador con más
permisos": vive fuera de las instalaciones, no figura en la tripulación de
ninguna, y no tiene permisos de mantenimiento. Solo da de alta instalaciones y
su primer administrador. A partir de ahí ese administrador crea el resto de las
cuentas de su buque y el operador deja de intervenir.

Por eso `superadmin` está deliberadamente **fuera** de `ROLES` y de la jerarquía
de roles: el esquema que valida el alta de usuarios se construye sobre `ROLES`,
así que un administrador de buque no puede asignarlo ni ascenderse solo.

| Quién | Da de alta |
|---|---|
| Operador de plataforma | Instalaciones y su primer administrador |
| Administrador de instalación | La tripulación de su buque |

Queda un único arranque en frío — la cuenta del propio operador:

```bash
docker compose -f docker/compose.yml -f docker/compose.dev.yml --env-file .env exec web pnpm tsx scripts/create-superadmin.ts "Nombre Apellido" correo@dominio.cl "contrasena-larga"
```

Después, todo se hace desde `/plataforma`. `scripts/create-admin.ts` sigue ahí
para recuperar una instalación que se quedó sin administrador.

### Por qué el corte vive en la consulta y no en el layout

En Next.js el layout y la página renderizan **en paralelo**: una comprobación en
el layout no impide que la página lance su consulta. Por eso `getActiveOrgId()`
redirige él mismo cuando no hay organización —a `/plataforma` si es el operador,
a `/sin-instalacion` si es alguien sin buque asignado—. `redirect()` es una
señal que el framework entiende y detiene el render limpiamente; lanzar una
excepción dejaba un error en el log en cada carga.

La consecuencia práctica: nunca envuelvas `getActiveOrgId()` en un `try/catch`,
porque se tragaría esa señal.

## Migraciones

El esquema se versiona en `drizzle/`. `db:push` —que compara el esquema con la
base y decide sobre la marcha qué alterar— sirve mientras los datos son de
prueba y se pueden borrar; con el histórico de una naviera dentro, un `push` que
decida recrear una columna es pérdida irreversible.

```bash
pnpm db:generate   # tras cambiar el esquema: escribe el SQL en drizzle/
pnpm db:migrate    # aplica lo pendiente
```

`scripts/migrate.ts` cubre además el caso de **adoptar una base preexistente**:
si el esquema ya está pero no hay registro de migraciones —porque se creó con
`push`—, aplicar la inicial fallaría al crear tablas que ya existen. Detecta esa
situación y da las migraciones por aplicadas sin ejecutarlas. Ocurre una sola
vez; en una base nueva no se ejecuta nada de eso.

En producción corren como **servicio de un solo uso** (`docker/compose.prod.yml`),
no dentro de la aplicación: la imagen de runtime es el build standalone de Next
y no lleva ni `tsx` ni el ejecutor. El servicio `web` espera a que `migrate`
haya salido bien, así que nunca hay una versión del código hablando con un
esquema que todavía no existe.

## Configuración regional

La moneda, el formato regional y el nombre de la instalación viven **en base de
datos**, no en variables de entorno: el administrador los cambia desde
`/configuracion` sin acceso al servidor y sin reiniciar nada. Las variables de
entorno solo aportan los valores iniciales del primer arranque.

Alcanza a la interfaz, el PDF, las etiquetas de formulario y las instrucciones
que recibe el modelo. Las monedas sin subunidad de uso corriente (CLP, JPY,
COP…) se formatean sin decimales automáticamente.

La lectura se memoiza por petición con `cache()` de React: aunque diez
componentes pidan el formateador, la base se consulta una vez.

> Cambiar la moneda **reformatea** los montos, no los convierte. La interfaz lo
> advierte, porque es un malentendido fácil y caro.

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

El set marino incluye horómetros con ritmos de uso realistas: el motor principal
navega ~14 h/día, la purificadora ~20 h/día y el generador de emergencia apenas
0,3 h/día de pruebas.

## Preventivo por horas de marcha

El mantenimiento de equipos rotativos no se programa por calendario sino por
**horas de funcionamiento**. Un auxiliar que estuvo tres meses en dique no
necesita su rutina de 500 h; uno que hizo dos travesías seguidas la necesita
antes. Los GMAO genéricos lo hacen mal o no lo hacen.

Una rutina se dispara por `calendario`, por `horas` o por **ambos** — lo que
llegue primero, que es el caso real más común: el aceite se degrada con el uso
pero también con el tiempo.

**El puente entre horas y fechas es lo que lo hace útil.** Saber que una rutina
«vence a las 12.500 h» no permite planificar; saber que eso ocurrirá el 15 de
marzo sí. Con el ritmo de uso real ([meters.ts](src/lib/kpi/meters.ts), 24 tests)
el sistema proyecta la fecha y ordena por urgencia real, no por fecha nominal.

Decisiones que evitan cifras falsas:

- **Se guardan lecturas, no un contador mutable.** El histórico permite calcular
  el ritmo real y una cifra mal tecleada se corrige sin perder la serie.
- **El ritmo se mide entre extremos de la ventana**, no promediando tramos: un
  buque alterna travesía y puerto, y promediar tramos amplifica el ruido.
- **Un horómetro que retrocede se rechaza** — es reemplazo de instrumento o error
  de tecleo, y proyectar sobre eso da fechas absurdas. También se rechaza un
  avance superior a 24 h por día de calendario.
- **Un equipo detenido no vence nunca por horas.** Se informa «sin uso» en vez de
  proyectar una fecha inventada.
- **Vencida por horas es un hecho, no una proyección**: no depende de conocer el
  ritmo.

Al cerrar una orden preventiva, el plan que la originó se reprograma en la misma
transacción que el cierre — una rutina que no avanza deja el tablero mintiendo
desde el primer cierre. La cadencia se cuenta desde la lectura de horómetro
**vigente al cerrar**, no la de hoy: si la orden se registra con retraso, avanzar
sobre la lectura actual regalaría horas de la cadencia.

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
│  ├─ preventivo/      rutinas con vencimiento por horas o calendario
│  ├─ horometros/      lecturas y ritmo de uso por activo
│  ├─ importar/        carga de Excel con validación fila por fila
│  ├─ reportes/        descarga del reporte mensual
│  └─ api/             plantilla .xlsx y reporte .pdf
├─ components/          UI, gráficos, formularios
├─ db/schema/           Drizzle: activos, OT, modos de falla, planes, ai_insights
└─ lib/
   ├─ kpi/formulas.ts   MTTR, MTBF, disponibilidad, Pareto — puras + tests
   ├─ kpi/risk.ts       score de riesgo de OT — puro + tests
   ├─ kpi/recurrence.ts intervalos, tendencia y cronicidad — puro + tests
   ├─ kpi/meters.ts     ritmo de uso y vencimiento de rutinas — puro + tests
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
- [x] **F6** Preventivo por horas de marcha (horómetros)
- [x] **F7** Autenticación por correo y contraseña, con roles y gestión de cuentas
- [x] **F8** Multi-instalación: `organization_id` en el dominio y configuración
      en base de datos
- [ ] **F9** Despliegue al VPS (pendiente: IP, acceso SSH y dominio)
