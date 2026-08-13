#!/bin/sh
# nginx:alpine imajı açılışta /docker-entrypoint.d/*.sh betiklerini çalıştırır.
# Sertifika yoksa self-signed üretir; volume'a yazıldığı için container
# yeniden kurulsa da aynı sertifika kalır (tarayıcıdaki istisna bozulmaz).
set -e

CERT_DIR=/etc/nginx/certs
CRT="$CERT_DIR/panel.crt"
KEY="$CERT_DIR/panel.key"

mkdir -p "$CERT_DIR"

if [ -s "$CRT" ] && [ -s "$KEY" ]; then
  echo "[cert] mevcut sertifika kullanılıyor: $CRT"
  exit 0
fi

# PANEL_HOST verilmişse SAN'a eklenir (IP ya da alan adı olabilir).
HOST="${PANEL_HOST:-serverpanel.local}"
case "$HOST" in
  *[0-9].[0-9]*) SAN="IP:$HOST,DNS:localhost" ;;
  *)             SAN="DNS:$HOST,DNS:localhost" ;;
esac

echo "[cert] self-signed sertifika üretiliyor (CN=$HOST, SAN=$SAN)"
openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
  -keyout "$KEY" -out "$CRT" \
  -subj "/CN=$HOST" \
  -addext "subjectAltName=$SAN" >/dev/null 2>&1

chmod 600 "$KEY"
