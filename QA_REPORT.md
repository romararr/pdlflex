# PadelFlex Pro v4 — QA Report

Tanggal pengujian: 28 Juli 2026  
Build: Stable QA Build  
Penyimpanan: localStorage `padelflex_v4`

## Ringkasan

PadelFlex Pro v4 diuji pada lapisan:

1. Alur pengguna dan UI berbasis Chromium.
2. Core turnamen dan validasi skor.
3. Scheduler Per Player dan Per Tim.
4. Perubahan roster di tengah turnamen.
5. Responsivitas halaman.
6. Export, backup, dan import.
7. Migrasi data versi lama.
8. Recovery data rusak.
9. PWA/service worker.
10. Audit statis HTML, JavaScript, manifest, icon, dan referensi file.

Total: **1.836 pemeriksaan dan skenario otomatis**.

Hasil akhir:

- JavaScript syntax error: **0**
- Page runtime error pada alur valid: **0**
- Referensi file hilang: **0**
- Horizontal page overflow pada ukuran yang diuji: **0**
- Kegagalan scheduler akhir: **0**

## Matriks Pengujian

| Kelompok | Jumlah | Hasil |
|---|---:|---|
| Browser end-to-end | 54 | Lulus |
| Audit statis HTML/PWA/asset | 205 | Lulus |
| Fuzz scheduler awal | 780 | Lulus |
| Fuzz late join Per Player | 272 | Lulus |
| Fuzz late join Per Tim | 375 | Lulus |
| Fuzz deaktivasi/perubahan roster | 56 | Lulus |
| Core score/lifecycle edge cases | 12 | Lulus |
| Validasi roster dan input | 11 | Lulus |
| Audit layout responsif | 49 | Lulus |
| Export dan import UI | 5 | Lulus |
| Completed tournament read-only UI | 7 | Lulus |
| Direct-route guard | 4 | Lulus |
| Service worker lifecycle | 6 | Lulus |

## Alur yang Diuji

### Tournament Hub

- Membuat turnamen baru.
- Membuka turnamen.
- Duplikasi turnamen.
- Arsip dan pemulihan.
- Penghapusan.
- Pencarian dan filter status.
- Banyak turnamen dalam satu browser.

### Setup dan Roster

- Mode Per Player.
- Mode Per Tim.
- Skor total 11, 15, dan 21.
- Skor manual.
- Batas jumlah court sesuai roster.
- Minimum peserta.
- Nama kosong.
- Nama duplikat tanpa membedakan huruf besar/kecil.
- Pemain yang dipakai pada lebih dari satu tim.
- Penambahan pemain massal.
- Penambahan peserta di tengah turnamen.
- Aktivasi dan istirahat peserta.

### Scheduler

Kombinasi yang diuji mencakup:

- 4 sampai 32 pemain.
- 2 sampai 20 tim.
- 1 sampai 6 court.
- Minimum 1 sampai 8 game.
- Sebagian pertandingan sudah selesai.
- Ronde aktif berada di awal atau tengah jadwal.
- Pemain/tim baru ditambahkan setelah beberapa skor tersimpan.
- Peserta dinonaktifkan setelah turnamen berjalan.

Validasi pada setiap jadwal:

- Peserta tidak muncul dua kali dalam satu ronde.
- Match Per Player selalu berisi empat pemain unik.
- Match Per Tim selalu berisi dua tim unik.
- Jumlah match tidak melampaui court tersedia.
- Semua peserta memenuhi minimum game.
- Selisih jumlah game akhir maksimal satu.
- ID ronde dan match tidak duplikat.
- Match dengan skor lama tetap tersimpan.

## Perbaikan Bug Penting

### 1. Late join gagal masuk jadwal

Sebelumnya, ketika pemain baru membuat jumlah peserta tepat memenuhi semua
court, semua peserta dijadwalkan bermain setiap ronde. Pemain baru tidak dapat
mengejar ketertinggalan jumlah game.

Perbaikan:

- Scheduler menggunakan target appearance per peserta.
- Jumlah court dapat berubah per ronde.
- Court dikurangi sementara ketika diperlukan untuk memberikan giliran istirahat
  kepada peserta dengan game lebih banyak.
- Jadwal kembali memakai court maksimal setelah distribusi memungkinkan.

### 2. Direct route menghasilkan error

Membuka `matches.html`, `players.html`, atau `leaderboard.html` tanpa turnamen
terpilih sebelumnya sempat menjalankan skrip halaman sebelum redirect.

Perbaikan:

- Guard redirect menghentikan inisialisasi skrip halaman.
- Tidak ada runtime error sebelum diarahkan ke halaman yang benar.

### 3. Turnamen selesai masih dapat dimodifikasi

Core sebelumnya masih dapat dipanggil untuk mengubah skor atau roster setelah
turnamen selesai.

Perbaikan:

- Roster, skor, undo, dan aktivasi ronde dikunci.
- Perubahan baru diizinkan setelah tombol **Buka Kembali Turnamen** digunakan.
- UI roster dan input skor menjadi read-only.

### 4. Anomali input skor

Perbaikan:

- Skor desimal ditolak.
- Skor negatif ditolak.
- Skor melebihi total pertandingan ditolak.
- Mode total otomatis mengosongkan kedua skor ketika salah satu sisi dihapus.
- Mengisi nilai yang sama tidak menambah riwayat undo.

### 5. Recovery localStorage

Perbaikan:

- Data JSON rusak dipindahkan ke key karantina:
  `padelflex_v4_corrupt_<timestamp>`.
- Aplikasi tetap terbuka.
- Migrasi versi lama tetap dapat berjalan.
- Data rusak tidak langsung ditimpa.

### 6. Leaderboard dan mobile UX

Perbaikan:

- Tie ranking menggunakan seluruh tie-breaker.
- Tampilan mobile tidak mengulang kartu ringkasan desktop.
- Tidak ada horizontal page overflow pada 320, 360, 390, 768, 800, 1024,
  dan 1440 px.

## Export dan Backup

Berhasil diuji:

- CSV leaderboard.
- PNG leaderboard.
- JSON satu turnamen.
- JSON seluruh aplikasi.
- Import backup melalui file input.
- Penolakan backup dengan struktur salah.
- Penolakan ID turnamen duplikat.
- Konfirmasi sebelum seluruh data diganti.

## PWA dan Offline

Diuji:

- Syntax service worker.
- Event install, activate, dan fetch.
- Seluruh file cache tersedia.
- Pembersihan cache versi lama.
- Network-first saat online.
- Cache fallback saat fetch gagal.
- Manifest dan ukuran icon 192×192 serta 512×512.

Catatan: lingkungan pengujian membatasi registrasi service worker melalui URL
lokal Chromium. Karena itu, tombol install browser tidak dijalankan secara
end-to-end. Lifecycle service worker, daftar cache, fallback offline, manifest,
dan asset telah diuji menggunakan mock browser service-worker.

## Batasan Arsitektur

Aplikasi masih tanpa backend/database.

Konsekuensi:

- Data antar-browser tidak otomatis sinkron.
- Data `localhost` dan alamat IP server dianggap penyimpanan berbeda.
- Display TV pada perangkat berbeda tidak menerima update dari browser operator.
- Pembersihan site data browser tetap dapat menghapus localStorage.

Gunakan **Settings → Export Semua JSON** secara rutin.
