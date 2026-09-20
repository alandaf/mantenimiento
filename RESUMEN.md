# PMS SIMARP — qué hace la plataforma

> Resumen para quien no va a leer el código: un armador, un gerente, un jefe de
> flota. Si buscas cómo levantar el proyecto o cómo está construido, eso está en
> el [README](README.md).

**PMS SIMARP** es un sistema de mantenimiento planificado (*Planned Maintenance
System*) para buques, faenas mineras y plantas industriales. Está en producción
en **https://pms.simarp.net**.

---

## El problema que resuelve

En la mayoría de las operaciones el mantenimiento se gestiona en planillas de
Excel y en la cabeza del jefe de máquinas. Eso funciona hasta que deja de
funcionar, y entonces aparecen tres síntomas:

1. **Nadie sabe qué atender primero.** Hay veinte órdenes abiertas y la
   prioridad la decide quien grita más fuerte, no el riesgo real.
2. **Las mismas fallas se repiten.** Se cambia el rodamiento quemado cada tres
   meses sin preguntarse por qué se quema.
3. **Armar el reporte mensual toma días.** Y cuando está listo, los números ya
   no describen el presente.

La plataforma ataca los tres con la misma materia prima: las órdenes de trabajo
que la tripulación ya registra.

---

## Qué hace

### Registra el trabajo
Activos organizados en jerarquía (buque → sala de máquinas → motor principal) y
órdenes de trabajo con su equipo, modo de falla, responsable, tiempo de parada y
costo. Es la base de todo lo demás: los indicadores no son más que la suma de
estas órdenes.

### Calcula los indicadores de confiabilidad
Sin fórmulas, sin planillas, actualizados al momento:

| Indicador | Qué responde |
|---|---|
| **MTTR** | Cuánto tardamos en reparar |
| **MTBF** | Cuánto aguanta el equipo antes de volver a fallar |
| **Disponibilidad** | Qué porcentaje del tiempo estuvo listo para trabajar |
| **Cumplimiento del plan preventivo** | De lo programado, cuánto se hizo de verdad |
| **Trabajo reactivo** | Cuánto fue apagar incendios en vez de prevenir |
| **Backlog y costo** | Qué se acumula y cuánto cuesta |

Cada uno lleva una explicación emergente en la propia pantalla —**25 términos
del rubro en castellano llano**— para que alguien ajeno al mantenimiento pueda
leer el tablero sin preguntar qué significa cada sigla.

### Planifica el preventivo por calendario y por horas de marcha
Una rutina puede vencer por fecha, por horómetro, o por **lo que llegue
primero** —que es lo habitual en máquinas—. Un equipo que trabajó el doble llega
a las horas antes de que llegue la fecha, y esperar al calendario sería tarde.
El sistema proyecta la fecha real según el ritmo de uso de las últimas semanas.

### Prioriza las órdenes abiertas
Un puntaje de 0 a 100 que combina criticidad del equipo, prioridad declarada,
antigüedad, repetición de la falla y costo de tenerlo detenido. Sobre esa base,
la IA reordena y **justifica cada posición citando las cifras** que la sustentan.

### Analiza la causa raíz
Detecta patrones de falla repetitiva y construye el análisis: cinco porqués,
diagrama de Ishikawa, nivel de confianza y —esto importa— **qué datos faltan**
para estar seguro. Cuando una hipótesis no tiene respaldo en los datos, lo dice.

### Importa desde Excel y exporta a PDF
Carga masiva del histórico que ya existe en planillas, con validación previa. Y
el reporte mensual imprimible, listo para la reunión.

### Separa por instalación
Cada buque o faena ve **solo sus datos**: sus activos, su tripulación, su
moneda, sus reportes. Un administrador de un buque no puede ver ni tocar la
información de otro, aunque escriba la dirección a mano.

### Gestiona cuentas y permisos
Cinco roles —administrador, jefe de máquinas, planificador, técnico y solo
lectura— y las cuentas las crea el administrador de cada instalación, no un
registro público abierto. A bordo las cuentas las da quien manda en máquinas.

---

## La regla que hace confiables los números

**Los indicadores los calcula el sistema. La IA solo los interpreta.**

Ninguna cifra de este sistema sale de un modelo de lenguaje. Los KPI se calculan
con aritmética en la base de datos y funciones con pruebas automatizadas. Cuando
interviene la IA, recibe esas cifras ya calculadas y tiene prohibido inventar
otras: su trabajo es ordenar, explicar y señalar patrones, siempre citando los
datos que le dieron.

La consecuencia práctica: **si la IA se cae o se queda sin cuota, los números
siguen ahí**. Se pierde el comentario, no el tablero.

Una segunda regla, del mismo espíritu: cuando no hay datos suficientes para un
indicador, el sistema **no muestra un cero**. Muestra que no se puede calcular.
Un cero se lee como "excelente" y un dato faltante no es un dato bueno.

---

## Para quién sirve

Nació del mundo marítimo, pero el modelo es el mismo en cualquier operación con
equipos que fallan. Hoy trae cinco catálogos de demostración:

- **Portacontenedores** y **granelero** — motores principales, auxiliares, grúas de bodega
- **Remolcador de puerto** — propulsores azimutales, maquinilla de remolque, sistema contraincendios
- **Faena minera de cobre** — chancado, molienda, flotación, flota de camiones y palas
- **Planta industrial** — línea de proceso y servicios

La moneda y el formato regional se configuran por instalación: pesos chilenos,
dólares, soles o euros, sin tocar el código.

---

## Qué **no** hace todavía

Conviene decirlo, porque un resumen que solo enumera virtudes termina
decepcionando:

- **No gestiona inventario de repuestos.** Registra el costo de los materiales
  usados, pero no lleva stock ni pedidos.
- **No se conecta a sensores.** Los horómetros se registran a mano o por
  importación; no hay lectura automática desde el equipo.
- **No tiene aplicación móvil.** Funciona en el navegador del teléfono, pero no
  hay app nativa ni modo sin conexión — y a bordo la conectividad es
  intermitente.
- **No emite certificados ni cubre requisitos de clasificación.** No reemplaza
  al sistema que exige la sociedad clasificadora.

---

## Estado

En producción desde agosto de 2026, con despliegue en servidor propio, HTTPS y
respaldo del esquema en migraciones versionadas. 91 pruebas automatizadas sobre
los cálculos de confiabilidad, que es donde un error silencioso haría más daño.

Dos instalaciones de demostración cargadas con doce meses de historial:
**Minera Cerro Bayo** y **Remolcadores Hualpén**.
