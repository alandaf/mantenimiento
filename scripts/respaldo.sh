#!/usr/bin/env bash
#
# Respaldo diario de la base de PMS SIMARP.
#
#   bash respaldo.sh            → escribe /root/backups/pms_AAAA-MM-DD.sql.gz
#
# Pensado para cron. Se instala con:
#   0 3 * * * /opt/pms/scripts/respaldo.sh >> /var/log/pms-respaldo.log 2>&1
set -euo pipefail

DESTINO="${DESTINO:-/root/backups}"
DIAS_A_CONSERVAR="${DIAS_A_CONSERVAR:-14}"
CONTENEDOR="${CONTENEDOR:-pms-db-1}"
ENV_FILE="${ENV_FILE:-/opt/pms/.env.prod}"

# Usuario y base se leen del mismo archivo que usa la aplicación: si mañana
# cambian ahí, el respaldo los sigue en vez de quedarse apuntando al nombre
# viejo y fallar en silencio.
USUARIO="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | cut -d= -f2-)"
BASE="$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | cut -d= -f2-)"
: "${USUARIO:?falta POSTGRES_USER en $ENV_FILE}"
: "${BASE:?falta POSTGRES_DB en $ENV_FILE}"

mkdir -p "$DESTINO"
ARCHIVO="$DESTINO/pms_$(date +%F).sql.gz"
PARCIAL="$ARCHIVO.parcial"

# Se escribe a un archivo temporal y se renombra al final. Si el volcado se
# corta a la mitad —disco lleno, contenedor reiniciado— no queda un .sql.gz
# truncado con aspecto de respaldo bueno, que es la peor forma de descubrir
# que no había respaldo.
docker exec "$CONTENEDOR" pg_dump -U "$USUARIO" "$BASE" | gzip > "$PARCIAL"

# Un volcado válido de esta base pasa holgadamente de 10 KB comprimido.
TAMANO=$(stat -c%s "$PARCIAL")
if [ "$TAMANO" -lt 10240 ]; then
  rm -f "$PARCIAL"
  echo "$(date +'%F %T') ✖ El volcado salió de solo $TAMANO bytes. No se guarda." >&2
  exit 1
fi

# Se comprueba que el gzip se pueda descomprimir antes de darlo por bueno.
gzip -t "$PARCIAL"

mv "$PARCIAL" "$ARCHIVO"
find "$DESTINO" -name 'pms_*.sql.gz' -mtime "+$DIAS_A_CONSERVAR" -delete

echo "$(date +'%F %T') ✔ $ARCHIVO ($((TAMANO/1024)) KB) · copias: $(find "$DESTINO" -name 'pms_*.sql.gz' | wc -l)"
