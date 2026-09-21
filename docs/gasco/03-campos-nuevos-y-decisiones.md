# Campos nuevos y decisiones de modelo

Este documento recoge lo que se agregó al modelo de datos para cumplir la propuesta de
implementación de la planta GLP, y por qué se hizo de esa forma. Los cambios están en las
migraciones `0001` a `0005` de la carpeta `drizzle/`. Todas se aplican solas al desplegar, en orden
y una sola vez.

Todas las tablas nuevas llevan `organization_id`. Una prueba automática (`tenancy.test.ts`) revisa
que cada tabla del dominio tenga esa columna y que cada consulta escrita a mano la filtre. Si
alguien agrega una consulta que olvida el filtro, la prueba falla antes de llegar a producción.

---

## 1. Activos

| Campo | Tipo | Para qué |
|---|---|---|
| `asset_type` | lista: sistema, conjunto, bomba, motor, compresor, válvula, instrumento, controlador, tanque… | Asocia a cada equipo los modos de falla de su familia. Una bomba no puede «fallar» como un detector. |
| `has_backup` | sí/no | Alimenta las reglas 3 y 4 de prioridad: un equipo crítico sin respaldo pesa más que uno con gemelo. |
| `is_safety_system` | sí/no | Alimenta la regla 2: un sistema de emergencia fuera de servicio siempre es prioridad crítica. |
| `meter_type` | lista: horas, ciclos, producción, kilómetros, otro | No todo se mide en horas. Una válvula cuenta ciclos, y un cargadero cuenta toneladas. |
| `hazardous_area_class` | texto | Clasificación de área peligrosa (por ejemplo Clase I Div. 1). Condiciona herramientas y permisos. |
| Criticidad | lista cerrada: crítica, alta, media, baja | Antes era A/B/C. Se cambió para usar el vocabulario de la propuesta. La migración convirtió los valores existentes, sin perder datos. |
| Estado `degradado` | valor nuevo | Un equipo que funciona, pero mal. Es distinto de «detenido» y distinto de «operando». |

**Decisión:** los subconjuntos (motor y bomba de un mismo equipo) son activos hijos, no campos del
padre. Así cada uno tiene su propio historial de fallas, y el análisis puede decir «es el sello de
la bomba» en lugar de «es la P-201A».

## 2. Órdenes de trabajo

| Campo | Tipo | Para qué |
|---|---|---|
| `symptom` | texto | Lo que se reportó, con las palabras de quien lo vio. |
| `cause_found` | texto | Lo que se encontró al abrir el equipo. |
| `action_performed` | texto | Lo que se hizo. |
| `work_permit_ref` | texto (80) | Número del permiso de trabajo. Es obligatorio en la práctica para trabajar en caliente o en espacios confinados. |
| `unavailable_at` | fecha y hora | Cuándo el equipo dejó de estar disponible. |
| `returned_to_service_at` | fecha y hora | Cuándo volvió a servicio. Con el campo anterior mide la indisponibilidad real, que no siempre coincide con el tiempo de trabajo. |
| `approved_by`, `approved_at` | usuario, fecha y hora | Segunda firma. |
| Tipo `inspeccion` | valor nuevo | Separa las rondas de inspección de las preventivas, para que no inflen el cumplimiento del plan. |

**Decisión:** síntoma, causa y acción son tres campos y no una sola descripción. Es lo que permite
comparar lo reportado con lo encontrado. Cuando no coinciden seguido, el problema está en cómo se
diagnostica.

**Decisión:** una correctiva no se guarda sin modo de falla. Sin ese dato no hay análisis de
recurrencia posible, y es el campo que más se omite cuando es opcional.

## 3. Tablas nuevas

### `audit_log`: registro de auditoría

Guarda quién, cuándo, qué cambió (valor anterior y nuevo) y el motivo.

- Se escribe **después** de que la operación tuvo éxito. Anotar una intención que luego falla
  produce un histórico que miente.
- Anular, reabrir y rechazar **exigen motivo**. Son las acciones que cambian lo que cuentan los
  indicadores.
- La aplicación no tiene función para editar ni borrar registros de auditoría. Ni siquiera la
  reversión de la carga de demostración los toca.
- Se muestra en la ficha de cada orden y de cada plan, no en una pantalla de administración aparte.

### `measurements`: mediciones

Variable, momento (antes o después), valor, unidad, límite y observación.

**Decisión:** es una tabla y no un campo de texto, para poder preguntar cómo evolucionó la
vibración de una bomba durante el año. Esa pregunta convierte un histórico de reparaciones en
mantenimiento predictivo, y con texto libre no se puede hacer.

### `work_order_materials`: materiales

Descripción, cantidad, unidad, costo unitario y número de parte.

**Decisión:** al agregar un material, su subtotal se suma al costo de repuestos de la orden. Si no,
el indicador de costo y la lista de materiales contarían historias distintas.

### `pm_tasks` y `work_order_tasks`: pauta y su ejecución

La pauta es la lista de pasos de una rutina: tipo (verificar, medir, reemplazar, intervenir,
registrar), unidad esperada y advertencia de seguridad. Al generar una orden, la pauta **se copia**
a la orden, y ahí se registra el resultado de cada paso: conforme, no conforme o no aplica, con el
valor medido, una observación, quién lo marcó y cuándo.

**Decisión:** son dos tablas y no una. Si la orden apuntara a la pauta viva, cambiar la rutina hoy
reescribiría lo que se pidió hacer el año pasado. Con la copia, cada orden conserva la pauta con
la que se emitió.

**Decisión:** una orden no se cierra con pasos en blanco. «No se hizo» es una respuesta válida
(*no conforme* o *no aplica*); «no respondí» no lo es. El nombre de quien marca cada paso queda
grabado. Si el equipo falla después, se sabe quién fue el último que lo revisó y qué declaró.

## 4. Reglas que no dependen de un campo

| Regla | Dónde vive | Prueba |
|---|---|---|
| Seis reglas de piso de prioridad (seguridad, emergencia, crítico sin respaldo, etc.) | `src/lib/kpi/safety.ts` | `safety.test.ts` |
| La IA puede reordenar o subir una prioridad, **nunca bajarla** por debajo del piso | `src/lib/kpi/safety.ts` (`aplicarPiso`) | `safety.test.ts` |
| Nadie aprueba su propio trabajo en un equipo crítico o de seguridad | `src/lib/kpi/approval.ts` | `approval.test.ts` |
| Una orden no se cierra con pasos de la pauta sin responder | `src/lib/kpi/closure.ts` | `closure.test.ts` |
| Una orden cerrada o aprobada no admite cambios en su pauta, mediciones ni materiales | acciones del servidor (`tasks.ts`, `records.ts`) | Verificación manual |
| Los indicadores (MTBF, MTTR, disponibilidad, riesgo) se calculan siempre con fórmulas fijas. La IA solo los interpreta | `src/lib/kpi/` | `formulas`, `risk`, `recurrence`, `meters` |

## 5. Lo que queda pendiente

| Campo de la propuesta | Estado | Motivo |
|---|---|---|
| Manuales del equipo (adjunto) | Pendiente | Falta decidir dónde se guardan los archivos: disco del servidor, volumen adicional o almacenamiento externo. |
| Planos (adjunto) | Pendiente | Misma decisión. |
| Evidencia fotográfica de la intervención | Pendiente | Misma decisión. |
| Lectura de medidores que no son horómetro (ciclos, producción) | Parcial | El tipo de medidor ya existe en el activo. Falta la pantalla para registrar lecturas en esas unidades. |

Resuelto después de la primera revisión:
- La pauta de cada plan se edita desde el plan: agregar, modificar, reordenar y quitar pasos, con
  auditoría.
- Las mediciones y los materiales se registran desde la orden mientras está abierta. Solo se
  agregan. Una lectura mal anotada se corrige agregando la correcta con una observación, como en
  un libro de máquinas.
