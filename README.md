# ServerPanel

A self-hosted web-based Ubuntu server management panel. Monitor system metrics, manage Docker containers, browse files, run terminal commands, and control services — all from a single browser tab.

---

## ✦ Features

### Overview Dashboard
- **Customizable widget grid** — drag, resize, and reorder widgets freely
- **Metric cards** with real-time sparkline charts and trend indicators (CPU, RAM, Disk, Network, Swap)
- **Charts** — CPU & RAM history, Network I/O history, Disk I/O history
- **Per-core CPU** — individual load bar for each CPU core
- **Docker widget** — running container count with quick status
- **Docker list widget** — all containers with start / stop / restart controls
- **Disk list** — all mount points with usage bars
- **Listening ports** — active TCP/UDP ports, process names, searchable
- **Top processes** — sorted by CPU or memory, responsive row count
- **Recent logs** — latest errors and warnings from journald
- **Widget gallery** — categorized picker with live previews, toggle visibility, filter active/hidden

### Alert System
- Real-time threshold monitoring for CPU, RAM, disk, swap, and failed systemd services
- Configurable warning / critical thresholds stored in localStorage
- Bell icon in the top bar with badge count; per-alert dismiss

### Top Bar
- Hostname, uptime, and **customizable metric pills** (CPU, RAM, Disk, Net)
- Drag to reorder pills; toggle visibility per metric
- Settings persist across sessions

### Terminal
- Full SSH terminal emulator via xterm.js
- Multi-tab support with open / close / rename
- Paste helper for clipboard text

### File Explorer
- Browse the host filesystem
- Upload, download, delete files
- In-browser text file viewer

### Docker Management
- Container list with live CPU / memory stats
- Start, stop, restart, remove containers
- Image management — pull by name, remove unused images
- Live log streaming per container

### Process Manager
- Full process list with PID, CPU %, memory
- Kill signal support
- Sort by CPU or memory

### Services (systemd)
- List all systemd units with active / enabled state
- Start, stop, restart, enable, disable
- Live log viewer per service (`journalctl -u`)

### Cron Jobs
- View cron entries from `/etc/crontab`, `/etc/cron.d/`, and user crontabs
- Add and remove entries

### Firewall (UFW)
- Enable / disable UFW
- Add / delete rules with common-port presets
- Per-rule protocol, direction, source filter

### Package Manager (APT)
- Browse installed packages, check upgradable
- Install, remove, upgrade packages with live output
- `apt update` in one click

### System Logs
- journald viewer with priority filter (error, warning, info…)
- Unit filter, keyword search
- Raw `/var/log` file browser

---

## ✦ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Zustand, React Query, react-grid-layout, recharts, xterm.js |
| Backend | Node.js 20, Fastify, systeminformation, Dockerode, bcrypt, JWT |
| Runtime | Docker Compose — two containers (nginx + Node.js) |

---

## ✦ Quick Setup (Ubuntu)

```bash
# 1. Clone the repository
git clone https://github.com/anilyagizbasaran/voidspec.git
cd voidspec

# 2. Create the environment file
cp backend/.env.example backend/.env
nano backend/.env
```

Set the following in `.env`:

```env
JWT_SECRET=your_random_secret_here
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=   # generate below
```

Generate a bcrypt password hash:

```bash
node -e "const b=require('bcryptjs'); b.hash('YOUR_PASSWORD',10).then(h=>console.log(h))"
```

```bash
# 3. Start the containers
docker compose up -d

# 4. Open in browser
# http://YOUR_SERVER_IP
```

---

## ✦ Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Backend port (default: `3001`) |
| `JWT_SECRET` | Secret key for JWT signing |
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the admin password |
| `ALLOWED_ORIGIN` | CORS allowed origin (e.g. `https://panel.example.com`) |

---

## ✦ Development

```bash
# Backend
cd backend
npm install
cp .env.example .env   # fill in the values
node src/index.js

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:3001`

---

## ✦ Architecture Notes

- The backend runs inside Docker but mounts `/var/run/docker.sock` for full Docker API access.
- Filesystem operations use `nsenter` to reach the host filesystem from within the container.
- Auth is a single admin account (credentials in `.env`). JWT is stored as an `httpOnly` cookie (24 h TTL).
- All widget layout preferences, metric pill order, and alert thresholds are stored in `localStorage`.

---

---

# ServerPanel (Türkçe)

Kendi sunucunda barındırılan, web tabanlı Ubuntu sunucu yönetim paneli. Sistem metriklerini izle, Docker container'larını yönet, dosyalara göz at, terminal komutları çalıştır ve servisleri kontrol et — hepsini tek bir tarayıcı sekmesinden.

---

## ✦ Özellikler

### Overview Dashboard
- **Özelleştirilebilir widget grid** — widget'ları sürükle, boyutlandır, yeniden sırala
- **Metrik kartları** — gerçek zamanlı sparkline grafiği ve trend göstergesiyle CPU, RAM, Disk, Network, Swap
- **Grafikler** — CPU & RAM geçmişi, Network I/O, Disk I/O zaman serileri
- **Per-core CPU** — her CPU çekirdeği için ayrı yük çubuğu
- **Docker widget** — çalışan container sayısı ve durum özeti
- **Docker listesi** — tüm container'lar, start / stop / restart kontrolleri
- **Disk listesi** — tüm mount noktaları ve doluluk barları
- **Dinlenen portlar** — aktif TCP/UDP portları, servis adları, arama desteği
- **Top processes** — CPU veya belleğe göre sıralı, boyuta göre responsive satır sayısı
- **Son loglar** — journald'dan son hata ve uyarılar
- **Widget galerisi** — kategorili seçici, canlı önizleme, aktif/gizli filtresi

### Alert Sistemi
- CPU, RAM, disk, swap ve başarısız systemd servisleri için eşik tabanlı izleme
- localStorage'da saklanan uyarı / kritik eşik değerleri, kullanıcı tarafından ayarlanabilir
- Üst çubukta badge sayısıyla zil ikonu; her uyarı ayrı ayrı kapatılabilir

### Üst Çubuk
- Hostname, uptime ve **özelleştirilebilir metrik pill'leri** (CPU, RAM, Disk, Net)
- Sürükleyerek sıralama; her metrik ayrı ayrı göster/gizle
- Ayarlar oturumlar arası korunur

### Terminal
- xterm.js ile tam SSH terminal emülatörü
- Sekme desteğiyle çoklu terminal açma / kapatma
- Pano metni için yapıştır yardımcısı

### Dosya Gezgini
- Host dosya sisteminde gezinme
- Dosya yükleme, indirme, silme
- Tarayıcıda metin dosyası görüntüleme

### Docker Yönetimi
- Canlı CPU / bellek istatistikleriyle container listesi
- Container başlatma, durdurma, yeniden başlatma, silme
- Image yönetimi — isme göre pull, kullanılmayan image silme
- Container başına canlı log akışı

### Proses Yöneticisi
- PID, CPU % ve bellek bilgisiyle tam proses listesi
- Kill sinyali gönderme
- CPU veya belleğe göre sıralama

### Servisler (systemd)
- Tüm systemd birimlerini active / enabled durumuyla listeleme
- Başlatma, durdurma, yeniden başlatma, etkinleştirme, devre dışı bırakma
- Servis başına canlı log görüntüleyici (`journalctl -u`)

### Cron İşleri
- `/etc/crontab`, `/etc/cron.d/` ve kullanıcı crontab'larından girdileri görüntüleme
- Giriş ekleme ve silme

### Güvenlik Duvarı (UFW)
- UFW etkinleştirme / devre dışı bırakma
- Yaygın port ön ayarlarıyla kural ekleme / silme
- Kural başına protokol, yön, kaynak filtresi

### Paket Yöneticisi (APT)
- Yüklü paketleri göz atma, güncellenebilir paketleri kontrol etme
- Canlı çıktıyla paket yükleme, kaldırma, güncelleme
- Tek tıkla `apt update`

### Sistem Logları
- Öncelik filtresiyle journald görüntüleyici (hata, uyarı, bilgi…)
- Birim filtresi, anahtar kelime arama
- Ham `/var/log` dosya tarayıcısı

---

## ✦ Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Zustand, React Query, react-grid-layout, recharts, xterm.js |
| Backend | Node.js 20, Fastify, systeminformation, Dockerode, bcrypt, JWT |
| Çalışma Ortamı | Docker Compose — iki container (nginx + Node.js) |

---

## ✦ Hızlı Kurulum (Ubuntu)

```bash
# 1. Repoyu klonla
git clone https://github.com/anilyagizbasaran/voidspec.git
cd voidspec

# 2. Ortam dosyasını oluştur
cp backend/.env.example backend/.env
nano backend/.env
```

`.env` dosyasında şunları ayarla:

```env
JWT_SECRET=rastgele_gizli_anahtar
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=   # aşağıda oluştur
```

Bcrypt şifre hash'i oluştur:

```bash
node -e "const b=require('bcryptjs'); b.hash('ŞİFRENİZ',10).then(h=>console.log(h))"
```

```bash
# 3. Container'ları başlat
docker compose up -d

# 4. Tarayıcıda aç
# http://SUNUCU_IP_ADRESİN
```

---

## ✦ Ortam Değişkenleri

| Değişken | Açıklama |
|---|---|
| `PORT` | Backend portu (varsayılan: `3001`) |
| `JWT_SECRET` | JWT imzalama gizli anahtarı |
| `ADMIN_USERNAME` | Yönetici kullanıcı adı |
| `ADMIN_PASSWORD_HASH` | Yönetici şifresinin bcrypt hash'i |
| `ALLOWED_ORIGIN` | CORS için izin verilen origin (ör. `https://panel.example.com`) |

---

## ✦ Geliştirme Ortamı

```bash
# Backend
cd backend
npm install
cp .env.example .env   # değerleri doldur
node src/index.js

# Frontend (ayrı terminalde)
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:3001`

---

## ✦ Mimari Notlar

- Backend Docker içinde çalışır ancak tam Docker API erişimi için `/var/run/docker.sock` mount eder.
- Dosya sistemi işlemleri, container içinden host dosya sistemine ulaşmak için `nsenter` kullanır.
- Auth, tek bir yönetici hesabıdır (kimlik bilgileri `.env`'de). JWT, `httpOnly` cookie olarak saklanır (24 saatlik TTL).
- Tüm widget düzeni tercihleri, metrik pill sırası ve uyarı eşikleri `localStorage`'da saklanır.
