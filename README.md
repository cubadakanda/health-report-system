# UTS Komputasi Awan - Health Report System

## Identitas Mahasiswa
Nama: Parisan Apro
NRP: 152023141

## Deskripsi Singkat Tugas
Health Report System adalah aplikasi pelaporan kesehatan lingkungan berbasis web dengan arsitektur cloud. Aplikasi ini dibuat untuk memenuhi UTS Komputasi Awan.

### Komponen Utama
- Backend: Node.js + Express
- Frontend: HTML, CSS, JavaScript
- Database: AWS RDS MySQL
- Storage: AWS S3
- Deployment: AWS EC2 + Docker

## Fitur Utama
1. Pelaporan kesehatan lingkungan oleh masyarakat.
2. Dashboard admin untuk melihat semua laporan.
3. Admin dapat memverifikasi atau menolak laporan.
4. Upload foto bukti laporan ke AWS S3.
5. Monitoring laporan berdasarkan lokasi dan status.

## Akun Pengguna

Aplikasi ini memiliki 2 tipe pengguna:

### 1. User (Masyarakat)
- Dapat membuat laporan baru tentang kesehatan lingkungan
- Dapat melihat laporan yang telah dibuat
- Dapat mengedit atau menghapus laporan milik sendiri
- Dapat melihat status verifikasi laporan mereka

### 2. Admin (Petugas Verifikasi)
- Akses ke seluruh laporan dari semua user
- Dapat memverifikasi atau menolak laporan
- Melihat statistik dan monitoring laporan
- Melihat riwayat audit (audit logs)

**Akun Admin Khusus:**
- Email: `admin@healthreport.com`
- Password: `Admin@123456`
- Akun ini sudah tersedia di database dan dapat langsung digunakan untuk akses admin dashboard

**Akun User (Test):**
- Email: `parisan@gmail.com`
- Password: `123456`
- Akun user untuk testing fitur pelaporan kesehatan

## Struktur Proyek
- `src/server.js`: backend Express dan API.
- `public/index.html`: tampilan frontend aplikasi.
- `database.sql`: schema database MySQL.
- `Dockerfile`: konfigurasi container.
- `.github/workflows/deploy.yml`: pipeline CI/CD.
- `.env.example`: template environment variable.

## Cara Menjalankan Proyek

### 1. Clone repository
```bash
git clone https://github.com/USERNAME/health-report-system.git
cd health-report-system
```

### 2. Setup environment
Salin `.env.example` menjadi `.env`, lalu isi konfigurasi berikut:
- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `S3_BUCKET_NAME`

### 3. Import database schema
Jalankan `database.sql` ke AWS RDS MySQL.

### 4. Build dan jalankan aplikasi
```bash
docker build -t health-report-system .
docker run -d --name health-report -p 3000:3000 --env-file .env health-report-system
```

### 5. Akses aplikasi
- Aplikasi: `http://EC2_PUBLIC_IP:3000`

## Konfigurasi Database
Database utama menggunakan:
- `DB_NAME=health_report_db`

Jika ingin mengganti database, sesuaikan variabel:
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

## Endpoint API
- `GET /` : halaman utama
- `GET /api/reports` : ambil semua laporan
- `POST /api/reports` : buat laporan baru
- `PUT /api/reports/:id` : update status laporan
- `GET /api/admin/dashboard` : statistik dashboard admin
- `GET /api/disease-monitoring` : monitoring laporan per lokasi

## Teknologi yang Digunakan
- Node.js
- Express.js
- MySQL
- Docker
- AWS EC2
- AWS RDS
- AWS S3
- GitHub Actions

## Catatan
- File foto laporan disimpan di AWS S3.
- Data laporan disimpan di AWS RDS.
- Aplikasi dijalankan di AWS EC2 menggunakan Docker.

