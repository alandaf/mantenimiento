#!/usr/bin/env bash
#
# Prepara un VPS Ubuntu/Debian para alojar PMS SIMARP.
# Se ejecuta UNA vez, en el servidor, como root:
#
#   bash preparar-vps.sh
#
# Deja instalado Docker, un usuario sin privilegios para desplegar y el
# repositorio clonado.
#
# NO toca nada que ya esté funcionando. Si el servidor ya presta otros
# servicios, se limita a informar: activar un cortafuegos o reconfigurar un
# proxy ajeno a ciegas es la forma más rápida de tumbar lo que ya andaba.
set -euo pipefail

REPO="${REPO:-https://github.com/alandaf/mantenimiento.git}"
DEPLOY_USER="${DEPLOY_USER:-simarp}"
DEPLOY_DIR="/opt/simarp"

echo "→ Reconociendo el servidor…"
OCUPA_80="$(ss -lntp 2>/dev/null | awk '$4 ~ /:80$/ {print $NF}' | head -1 || true)"
OCUPA_443="$(ss -lntp 2>/dev/null | awk '$4 ~ /:443$/ {print $NF}' | head -1 || true)"
PROXY_EXISTENTE=""
if [ -n "$OCUPA_80$OCUPA_443" ]; then
  PROXY_EXISTENTE="si"
  echo "  · Los puertos 80/443 ya están ocupados:"
  [ -n "$OCUPA_80" ]  && echo "      80  → $OCUPA_80"
  [ -n "$OCUPA_443" ] && echo "      443 → $OCUPA_443"
  echo "  · Se usará el proxy existente. Caddy no se levantará."
else
  echo "  · Puertos 80/443 libres: Caddy puede encargarse del TLS."
fi

echo "→ Paquetes base…"
apt-get update -qq
apt-get install -y -qq ca-certificates curl git

echo "→ Docker…"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

# Desplegar como root no aporta nada y multiplica el daño de cualquier fallo:
# una cadena de despliegue comprometida tendría la máquina entera.
echo "→ Usuario de despliegue ($DEPLOY_USER)…"
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"

echo "→ Cortafuegos…"
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  echo "  · ufw ya está activo. No se toca: cambiar reglas de un servidor en"
  echo "    producción a ciegas puede dejar fuera lo que ya funcionaba —incluso"
  echo "    tu propia sesión SSH—. Revisa a mano que 80 y 443 estén permitidos."
elif [ -n "$PROXY_EXISTENTE" ]; then
  echo "  · El servidor ya presta servicios y el cortafuegos no está activo."
  echo "    No se activa desde aquí: hazlo tú cuando sepas qué puertos usan."
else
  apt-get install -y -qq ufw
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  # Postgres NO se abre: solo lo alcanza la aplicación, por la red interna de
  # compose. Publicarlo al exterior es cómodo un día y una filtración al
  # siguiente.
  ufw --force enable
fi

echo "→ Repositorio en $DEPLOY_DIR…"
mkdir -p "$DEPLOY_DIR"
chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_DIR"
if [ ! -d "$DEPLOY_DIR/.git" ]; then
  sudo -u "$DEPLOY_USER" git clone "$REPO" "$DEPLOY_DIR"
fi

cat <<FIN

✔ Servidor preparado.

Falta, como $DEPLOY_USER:

  1. Autorizar la clave del despliegue:
       mkdir -p ~/.ssh && nano ~/.ssh/authorized_keys   # pega la clave pública
       chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys

  2. Configurar los secretos:
       cd $DEPLOY_DIR
       cp .env.prod.example .env.prod
       nano .env.prod
       chmod 600 .env.prod

  3. Levantar (elige según lo detectado arriba):

     $( [ -n "$PROXY_EXISTENTE" ] \
        && echo "Hay un proxy en 80/443 → la aplicación escucha solo en 127.0.0.1" \
        || echo "Puertos libres → Caddy se encarga del certificado" )

       docker compose -p simarp -f docker/compose.yml -f docker/compose.prod.yml \\
         -f docker/$( [ -n "$PROXY_EXISTENTE" ] && echo "compose.host-proxy.yml" || echo "compose.caddy.yml" ) \\
         --env-file .env.prod up -d --build
$( [ -n "$PROXY_EXISTENTE" ] && cat <<'EXTRA'

  3b. Publicar el sitio en el proxy existente:
       sudo cp docker/nginx-pms.simarp.net.conf /etc/nginx/sites-available/pms.simarp.net
       sudo ln -s /etc/nginx/sites-available/pms.simarp.net /etc/nginx/sites-enabled/
       sudo nginx -t && sudo systemctl reload nginx
       sudo certbot --nginx -d pms.simarp.net
EXTRA
)

  4. Crear el operador de plataforma:
       docker compose -p simarp -f docker/compose.yml -f docker/compose.prod.yml \\
         --env-file .env.prod run --rm migrate \\
         pnpm tsx scripts/create-superadmin.ts "Tu Nombre" tu@correo.cl "clave-larga"

FIN
