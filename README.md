# ServerPanel

Web tabanlı Ubuntu sunucu yönetim paneli.

## Özellikler

- **Dashboard** — CPU, RAM, disk, network metrikleri + canlı sparkline grafik
- **Terminal** — xterm.js ile tam terminal emülatörü, multiple tab desteği
- **File Explorer** — Dosya gezinme, görüntüleme, yükleme, indirme, silme
- **Docker** — Container/image yönetimi, canlı log stream

## Hızlı Kurulum (Ubuntu)

```bash
# 1. Dosyaları sunucuya kopyala
scp -r serverpanel/ user@sunucu:/opt/serverpanel

# 2. .env dosyasını düzenle
cd /opt/serverpanel/backend
cp .env.example .env
nano .env

# Şifre hash'i oluştur:
node -e "const b=require('bcrypt'); b.hash('ŞİFRENİZ',10).then(h=>console.log(h))"

# 3. Kurulum scriptini çalıştır
DOMAIN=panel.sunucu.com bash /opt/serverpanel/setup.sh
```

## Geliştirme Ortamı

```bash
# Backend
cd backend
npm install
cp .env.example .env
# .env düzenle
node src/index.js

# Frontend (ayrı terminalde)
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:3001

## Ortam Değişkenleri

| Değişken | Açıklama |
|---|---|
| `PORT` | Backend port (default: 3001) |
| `JWT_SECRET` | JWT imzalama anahtarı |
| `ADMIN_USERNAME` | Yönetici kullanıcı adı |
| `ADMIN_PASSWORD_HASH` | bcrypt hash |
| `ALLOWED_ORIGIN` | CORS için izin verilen origin |

## Gereksinimler

- Node.js 20+
- Docker (Docker Manager için, backend kullanıcısının `docker` grubunda olması gerekir)
- nginx (production için)
- PM2 (production için)
