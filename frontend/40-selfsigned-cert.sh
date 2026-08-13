#!/bin/sh
# nginx:alpine imajı açılışta /docker-entrypoint.d/*.sh betiklerini çalıştırır.
# Sertifika seçim sırası:
#   1. PANEL_CERT_NAME ile verilen Let's Encrypt sertifikası (host'tan ro mount)
#   2. volume'da duran mevcut sertifika
#   3. yeni üretilen self-signed sertifika
# Volume kullanılmasının sebebi: rebuild sonrası aynı sertifika kalsın ki
# tarayıcıdaki istisna bozulmasın.
set -e

CERT_DIR=/etc/nginx/certs
CRT="$CERT_DIR/panel.crt"
KEY="$CERT_DIR/panel.key"

mkdir -p "$CERT_DIR"

# Let's Encrypt sertifikası varsa ona symlink veririz — kopyalamıyoruz, çünkü
# live/ dizini yenilemede archive/ içindeki yeni dosyaya döner; symlink sayesinde
# yenileme sonrası tek yapılması gereken `nginx -s reload` (certbot deploy hook).
LE_NAME="${PANEL_CERT_NAME:-}"
LE_DIR="/etc/letsencrypt/live/$LE_NAME"
if [ -n "$LE_NAME" ] && [ -r "$LE_DIR/fullchain.pem" ] && [ -r "$LE_DIR/privkey.pem" ]; then
  echo "[cert] Let's Encrypt sertifikası kullanılıyor: $LE_DIR"
  ln -sfn "$LE_DIR/fullchain.pem" "$CRT"
  ln -sfn "$LE_DIR/privkey.pem" "$KEY"
  exit 0
fi

# LE sertifikası artık yoksa geride kalan symlink'ler kırık olur. Temizlemezsek
# openssl aşağıda symlink'i izleyip /etc/letsencrypt altına yazmaya çalışır.
if [ -L "$CRT" ] || [ -L "$KEY" ]; then
  echo "[cert] Let's Encrypt symlink'leri kırık, temizleniyor"
  rm -f "$CRT" "$KEY"
fi

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
