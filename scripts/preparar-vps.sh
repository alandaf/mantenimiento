#!/usr/bin/env bash
#
# Prepara un VPS Ubuntu/Debian recién creado para alojar PMS SIMARP.
# Se ejecuta UNA vez, en el servidor, como root:
#
#   bash preparar-vps.sh
#
# Deja instalado Docker, un usuario sin privilegios para desplegar, el
# cortafuegos cerrado salvo 22/80/443, y el repositorio clonado.
set -euo pipefail

REPO="${REPO:-https://github.com/alandaf/mantenimiento.git}"
DEPLOY_USER="${DEPLOY_USER:-simarp}"
DEPLOY_DIR="/opt/simarp"

echo "→ Paquetes base…"
apt-get update -qq
apt-get install -y -qq ca-certificates curl git ufw

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
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
# Postgres NO se abre: solo lo alcanza la aplicación, por la red interna de
# compose. Publicarlo al exterior es cómodo un día y una filtración al
# siguiente.
ufw --force enable

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

  3. Levantar:
       docker compose -p simarp -f docker/compose.yml -f docker/compose.prod.yml \\
         --env-file .env.prod up -d --build

  4. Crear el operador de plataforma:
       docker compose -p simarp -f docker/compose.yml -f docker/compose.prod.yml \\
         --env-file .env.prod run --rm migrate \\
         pnpm tsx scripts/create-superadmin.ts "Tu Nombre" tu@correo.cl "clave-larga"

FIN
