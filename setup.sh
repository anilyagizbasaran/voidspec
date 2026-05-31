#!/bin/bash
# ServerPanel kurulum scripti — Ubuntu 22.04+
set -e

PANEL_DIR="/opt/serverpanel"
DOMAIN="${DOMAIN:-panel.sunucu.com}"

echo "==> ServerPanel kurulumu başlıyor..."

# Node.js 20 kur (yoksa)
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# PM2 kur (yoksa)
if ! command -v pm2 &>/dev/null; then
  sudo npm install -g pm2
fi

# Backend bağımlılıkları
echo "==> Backend bağımlılıkları kuruluyor..."
cd "$PANEL_DIR/backend"
npm install

# .env yoksa örneği kopyala
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "!!! .env dosyasını düzenleyin:"
  echo "    $PANEL_DIR/backend/.env"
  echo ""
  echo "    Şifre hash'i oluşturmak için:"
  echo "    node -e \"const b=require('bcrypt'); b.hash('ŞİFRENİZ',10).then(h=>console.log(h))\""
  echo ""
fi

# Frontend build
echo "==> Frontend build ediliyor..."
cd "$PANEL_DIR/frontend"
npm install
npm run build

# nginx konfigürasyonu
echo "==> nginx konfigürasyonu kuruluyor..."
sudo cp "$PANEL_DIR/nginx/serverpanel.conf" /etc/nginx/sites-available/serverpanel
# Domain adını güncelle
sudo sed -i "s/panel.sunucu.com/$DOMAIN/g" /etc/nginx/sites-available/serverpanel
sudo ln -sf /etc/nginx/sites-available/serverpanel /etc/nginx/sites-enabled/serverpanel
sudo nginx -t && sudo systemctl reload nginx

# PM2 ile backend başlat
echo "==> Backend PM2 ile başlatılıyor..."
cd "$PANEL_DIR/backend"
pm2 start src/index.js --name serverpanel --interpreter node
pm2 save
pm2 startup

echo ""
echo "✓ ServerPanel kurulumu tamamlandı!"
echo "  Backend: http://localhost:3001"
echo "  Panel:   https://$DOMAIN"
echo ""
echo "  PM2 durumu: pm2 status"
echo "  Backend log: pm2 logs serverpanel"
