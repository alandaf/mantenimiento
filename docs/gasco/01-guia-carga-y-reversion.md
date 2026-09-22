# Guía de ejecución y reversión de la carga de demostración

**Instalación:** Planta GLP Metropolitana (`PGLP-MET-01`)
**Identificador interno:** `planta-glp-metropolitana`
**Conjunto de datos:** `glp`

> Los datos son ficticios y sirven solo como demostración. Las frecuencias y actividades no son
> instrucciones operacionales. La aplicación lo muestra en una franja fija en todas las pantallas.

---

## 1. Qué carga

| Elemento | Cantidad | Nota |
|---|---:|---|
| Activos | 72 | Los 65 de la propuesta, más 7 subconjuntos (motor y bomba separados en los equipos críticos) |
| Activos críticos | 33 | |
| Sistemas de seguridad | 11 | Detección de gas, ESD, red contra incendio, válvulas de alivio |
| Modos de falla | 41 | Códigos FM-1xx a FM-5xx, agrupados por familia de equipo |
| Técnicos | 9 | Con especialidad y costo por hora |
| Planes preventivos | 151 | 12 plantillas aplicadas a cada equipo compatible |
| Pasos de pauta (plantilla) | 755 | |
| Órdenes de trabajo | 1.051 | 12 meses, con estacionalidad del GLP (más carga en invierno) |
| Órdenes abiertas | 49 | Para que la cartera de trabajo y la priorización tengan contenido |
| Pasos ejecutados | 3.020 | Con resultado, valor medido y responsable |
| Mediciones | 197 | Antes y después de intervenir |
| Materiales | 636 | |
| Lecturas de horómetro | 675 | |
| Órdenes aprobadas | 326 | Segunda firma en equipos críticos y de seguridad |
| Registros de auditoría | ~11.500 | Creación, cierre y aprobación de cada orden |

**Caso guionizado:** la bomba de transferencia **P-201A** falla en enero, abril y julio. La
vibración sube de 7,2 a 9,8 y luego a 13,6 mm/s, y en julio aparece una desalineación de 0,31 mm.
Es la recurrencia que el análisis de causa raíz debe detectar.

## 2. Requisitos

- Acceso por SSH al servidor, como `root`.
- El proyecto desplegado en `/opt/pms`, con `.env.prod` configurado.
- Cinco minutos de ventana **sin usuarios conectados**. Rehacer la carga cambia todos los
  identificadores, así que cualquiera que tenga una orden abierta en pantalla verá un error al guardar.

## 3. Ejecución

Todas las órdenes se ejecutan desde `/opt/pms`. Para abreviar, se define un alias:

```bash
cd /opt/pms
alias pmsc='docker compose -p pms -f docker/compose.yml -f docker/compose.prod.yml -f docker/compose.host-proxy.yml --env-file .env.prod'
```

### 3.1 Primera carga (instalación nueva)

```bash
pmsc run --rm -v /opt/pms/scripts:/app/scripts -v /opt/pms/src:/app/src \
  migrate pnpm tsx scripts/seed-demo.ts planta-glp-metropolitana glp "Planta GLP Metropolitana"
```

El script crea la instalación si no existe, carga los datos y termina con
`✔ Planta GLP Metropolitana sembrada con el set "glp"`.

**Si la instalación ya tiene activos, el script se niega a continuar.** Cargar dos veces duplicaría
los activos y las órdenes, y los indicadores quedarían al doble sin que nada lo delate.

Después, desde `https://pms.simarp.net/plataforma`, el operador de la plataforma asigna un
administrador a la instalación.

**Después de cada carga**, devuelva la carpeta de adjuntos a la aplicación. El script corre como
`root` y crea la carpeta de la instalación a su nombre. Sin este paso, la aplicación muestra los
documentos cargados, pero no puede guardar los que suban los usuarios:

```bash
chown -R 1001:1001 /opt/pms-data/adjuntos
```

### 3.2 Por qué se montan `scripts` y `src`

El servicio `migrate` usa la imagen construida en el último despliegue. Si el generador cambió
después, la imagen tendría la versión vieja. Montar las carpetas del repositorio asegura que se
ejecuta el código actual.

## 4. Reversión

### 4.1 Volver al estado inicial de la demostración

Es lo habitual después de una sesión en la que se crearon, cerraron o editaron órdenes:

```bash
pmsc run --rm -v /opt/pms/scripts:/app/scripts -v /opt/pms/src:/app/src \
  migrate pnpm tsx scripts/seed-demo.ts planta-glp-metropolitana glp "Planta GLP Metropolitana" --rehacer
chown -R 1001:1001 /opt/pms-data/adjuntos
```

Qué borra, **solo de esta instalación**:
órdenes de trabajo (y con ellas sus pasos, mediciones, materiales y aprobaciones), planes
preventivos (y sus pautas), lecturas de horómetro, análisis de IA, activos, modos de falla y técnicos.

Qué **no** toca:
- Los usuarios, sus contraseñas y su pertenencia a la instalación. Nadie pierde el acceso.
- La configuración de la instalación (nombre, moneda, formato regional).
- El registro de auditoría. Se escribe una sola vez y nunca se borra, ni siquiera en una
  reversión. Los registros de la carga anterior quedan asociados a órdenes que ya no existen y no
  se muestran en ninguna ficha.
- Las otras instalaciones del servidor.

### 4.2 Eliminar la instalación por completo

No hay botón para esto, a propósito. Se hace en la base, dentro de una transacción, **después de
un respaldo**:

```bash
/opt/pms/scripts/respaldo.sh
pmsc exec db psql -U pms -d pms
```

```sql
SELECT id AS org FROM organization WHERE slug = 'planta-glp-metropolitana' \gset
BEGIN;
DELETE FROM work_orders    WHERE organization_id = :'org';
DELETE FROM pm_plans       WHERE organization_id = :'org';
DELETE FROM meter_readings WHERE organization_id = :'org';
DELETE FROM ai_insights    WHERE organization_id = :'org';
DELETE FROM assets         WHERE organization_id = :'org';
DELETE FROM failure_modes  WHERE organization_id = :'org';
DELETE FROM technicians    WHERE organization_id = :'org';
DELETE FROM settings       WHERE organization_id = :'org';
DELETE FROM member         WHERE organization_id = :'org';
DELETE FROM organization   WHERE id = :'org';
-- Revisar los conteos de cada DELETE antes de confirmar
COMMIT;   -- o ROLLBACK si algo no cuadra
```

Las cuentas de usuario quedan sin instalación. Al entrar verán la pantalla «Sin instalación
asignada», no un error.

### 4.3 Volver a un respaldo

El servidor genera un respaldo diario a las 03:00 en `/root/backups/pms_AAAA-MM-DD.sql.gz` y
guarda 14 días.

El respaldo no borra nada antes de cargar, así que la base se recrea vacía primero:

```bash
/opt/pms/scripts/respaldo.sh                      # respaldo del estado actual, por si acaso
pmsc stop web
pmsc exec db dropdb -U pms pms
pmsc exec db createdb -U pms pms
gunzip -c /root/backups/pms_AAAA-MM-DD.sql.gz | pmsc exec -T db psql -U pms -d pms -v ON_ERROR_STOP=1
pmsc start web
```

La restauración reemplaza la base **completa**, todas las instalaciones incluidas. Solo se usa si
la reversión del punto 4.1 no alcanza.

## 5. Verificación posterior

Después de cualquiera de las operaciones:

1. `https://pms.simarp.net` responde y permite entrar.
2. En **Activos** aparecen 72 equipos.
3. En **Órdenes**, el filtro «abiertas» muestra alrededor de 50.
4. La ficha de **P-201A** muestra las correctivas de enero, abril y julio.
5. En **Plan preventivo** hay rutinas vencidas y próximas, no solo «al día».
