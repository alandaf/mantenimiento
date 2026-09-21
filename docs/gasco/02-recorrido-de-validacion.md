# Recorrido de validación

**Instalación:** Planta GLP Metropolitana · `https://pms.simarp.net`
**Duración:** 25 a 30 minutos
**Usuario:** uno con rol *Jefe de Máquinas*. Para el paso de aprobación se necesita un segundo
usuario, porque nadie aprueba su propio trabajo en un equipo crítico.

Cada paso indica qué hacer y qué debe verse. Si lo que aparece no coincide, anota el número del
paso: identifica el punto exacto sin tener que describirlo.

> Antes de una sesión con el cliente, la carga se reinicia con la guía `01`, punto 4.1, para que
> los números coincidan con los de este documento.

---

## A. Primera impresión: el panel

| # | Acción | Resultado esperado |
|---|---|---|
| A1 | Entrar con el usuario. | Abre el **Panel**. Arriba aparece la franja «Datos de demostración». |
| A2 | Pulsar el círculo **?** junto a los títulos (MTBF, MTTR, disponibilidad). | Aparece una explicación en lenguaje llano. Está pensada para que un gerente entienda sin preguntar. |
| A3 | Revisar los indicadores. | Hay valores con tendencia, no ceros. La disponibilidad está por debajo del 100 %. |

## B. Activos y jerarquía

| # | Acción | Resultado esperado |
|---|---|---|
| B1 | Menú **Activos**. | 72 equipos agrupados por las 6 áreas de la planta. |
| B2 | Buscar `P-201A` y abrir la ficha. | Criticidad *crítica*, con respaldo (P-201B). Sus subconjuntos (motor y bomba) cuelgan de ella. |
| B3 | Revisar el historial de la ficha. | Tiene correctivas en enero, abril y julio, además de sus preventivas. |
| B4 | Abrir un detector de gas del área de almacenamiento. | Marcado como **sistema de seguridad**, con clasificación de área peligrosa. |

## C. Flujo preventivo completo

| # | Acción | Resultado esperado |
|---|---|---|
| C1 | Menú **Plan preventivo**. | Rutinas ordenadas por urgencia real. Hay vencidas (rojo) y próximas (ámbar). Las que van por horas muestran las horas restantes. |
| C2 | Pulsar el nombre de una rutina. | Abre la **pauta**: pasos numerados con su tipo (Verificar, Medir, Reemplazar) y las advertencias de seguridad en ámbar. |
| C3 | Agregar un paso al final, por ejemplo «Verificar estado de la puesta a tierra». | Aparece como último paso. El **Historial de cambios** registra quién lo agregó y cuándo. |
| C4 | Subirlo una posición con ↑ y luego quitarlo. | Se reordena y se renumera. Ambas acciones quedan en el historial. |
| C5 | Menú **Órdenes**, filtrar por *abiertas* y abrir una **preventiva**. | La pauta está **arriba**, antes del formulario. El botón **Cerrar orden** está deshabilitado e indica cuántos pasos faltan. |
| C6 | Marcar los pasos: uno *No conforme* con observación, uno *No aplica* y el resto *Conforme*. En un paso de medición, anotar un valor. | Cada paso se guarda al pulsarlo, sin botón de guardar. |
| C7 | Al marcar el último paso. | **Cerrar orden** se habilita sin recargar y dice que todos los pasos están registrados. |
| C8 | En **Mediciones**, registrar «Vibración LA», antes, 7,4 mm/s, límite 7,1. | El valor aparece en rojo, porque supera el límite. |
| C9 | En **Materiales y repuestos**, agregar «Rodamiento 6309-2Z», 2 u a $18.500. | La lista muestra $37.000, y el costo de repuestos del formulario sube en la misma cantidad. |
| C10 | Pulsar **Cerrar orden**. | La orden queda cerrada, con la hora actual como fin. La pauta pasa a solo lectura y muestra el nombre de quien marcó cada paso. |
| C11 | Revisar el **Historial de cambios** de la orden. | Aparecen el paso no conforme, la medición, el material con el cambio de costo y el cierre, cada uno con su autor. |

**Qué se valida:** una rutina no se cierra con pasos en blanco. El mecánico puede declarar que un
paso no se hizo o no aplicaba, pero no puede dejarlo sin respuesta, y su nombre queda en cada
paso.

## D. Flujo correctivo y recurrencia

| # | Acción | Resultado esperado |
|---|---|---|
| D1 | **Órdenes → Nueva**. Activo `P-201A`, tipo *correctivo*. | Aparecen los campos de diagnóstico: síntoma informado, causa encontrada y trabajo realizado. |
| D2 | Intentar guardar sin modo de falla. | Aviso emergente: «Modo de falla: Toda correctiva necesita un modo de falla para el análisis». |
| D3 | Elegir el modo de falla de vibración y guardar. | La orden queda creada y el historial registra la creación. |
| D4 | Menú **Análisis causa raíz**. | P-201A aparece como recurrente. La evidencia muestra la vibración subiendo de 7,2 a 9,8 y a 13,6 mm/s, y una desalineación de 0,31 mm. |

## E. Priorización y reglas de seguridad

| # | Acción | Resultado esperado |
|---|---|---|
| E1 | Menú **Priorización**. | Órdenes abiertas ordenadas por riesgo, cada una con la regla que fija su piso. |
| E2 | Buscar una orden de un detector de gas o del sistema contra incendio. | Prioridad **crítica** y bloqueada, con la regla 2: «Sistema de emergencia no disponible». |
| E3 | Pedir la recomendación de la IA. | La IA explica y puede reordenar dentro de una categoría, pero **no baja** una prioridad fijada por una regla: el piso se aplica sobre la respuesta de la IA, no antes. |

## F. Aprobación con segunda firma

| # | Acción | Resultado esperado |
|---|---|---|
| F1 | Con el mismo usuario que cerró la orden de C10, si el activo es crítico, intentar aprobarla. | Se rechaza: nadie aprueba su propio trabajo en un equipo crítico o de seguridad. |
| F2 | Entrar con el segundo usuario y aprobarla. | Queda aprobada con nombre y hora. Desde ese momento la pauta, las mediciones y los materiales son de solo lectura. |

## G. Aislamiento entre instalaciones

| # | Acción | Resultado esperado |
|---|---|---|
| G1 | Anotar el número de una orden de la planta GLP (la dirección termina en `/ordenes/<número>`). | — |
| G2 | Entrar con un usuario de otra instalación (Minera Cerro Bayo) y abrir esa dirección. | «No encontrado». Una instalación nunca ve los datos de otra, ni adivinando números. |

## H. Cierre del recorrido

Reiniciar la carga con la guía `01`, punto 4.1, para dejar la demostración limpia para la
siguiente sesión.

---

### Estado de la verificación

| Bloque | Verificado | Dónde |
|---|---|---|
| A, B | Sí | Producción |
| C1, C5–C7, C10, C11 | Sí | Producción (septiembre 2026) |
| C2–C4, C8, C9 | Sí | Entorno local. Pendiente de confirmar en producción tras el despliegue |
| D, E, F | Sí | Pruebas automáticas (`safety`, `approval`, `closure`) y producción |
| G | Sí | Prueba automática `tenancy`, que revisa que cada consulta filtre por instalación |

Las capturas de pantalla se toman en la sesión de validación con el cliente, sobre los datos
recién cargados, para que coincidan con lo que va a ver.
