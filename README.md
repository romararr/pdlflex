# PadelFlex Pro v4

PadelFlex Pro v4 adalah aplikasi web statis multi-turnamen untuk mengelola
pertandingan padel tanpa backend dan tanpa database server.

## Fitur Utama

- Multi-turnamen dalam satu browser.
- Status turnamen: Draft, Aktif, Selesai, dan Arsip.
- Mode random Per Player dan Per Tim.
- Sistem skor total otomatis atau skor manual.
- Jumlah ronde otomatis berdasarkan pemerataan game.
- Penambahan peserta di tengah turnamen.
- Match yang sudah memiliki skor dan ronde aktif tetap dipertahankan.
- Pemilihan pertandingan langsung tanpa tombol skip.
- Pencarian pemain/tim dan filter ronde.
- Edit skor lama.
- Undo perubahan skor sampai 50 riwayat terakhir.
- Indikator fairness jadwal.
- Leaderboard PDLUP-style.
- Ranking By Points, Wins, Difference, atau Win Rate.
- Export CSV, PNG, dan JSON.
- Display TV untuk pertandingan aktif dan leaderboard.
- Duplikasi format turnamen.
- Backup/restore seluruh turnamen.
- Migrasi otomatis dari storage `padelflex_flow_v2`.
- PWA dan offline cache.

## Halaman

- `index.html` — Tournament Hub.
- `setup.html` — Inisialisasi turnamen.
- `players.html` — Roster dan submit jadwal.
- `matches.html` — Operator pertandingan.
- `leaderboard.html` — Ranking dan export.
- `display.html` — Tampilan TV.
- `settings.html` — Backup, restore, arsip, dan penghapusan data.

## Penyimpanan Tanpa Database

Data disimpan pada browser menggunakan localStorage:

```text
padelflex_v4
```

Reload halaman, menutup browser, atau restart Apache tidak menghapus data.
Data tetap terikat pada browser dan origin yang sama.

Alamat berikut dianggap berbeda oleh browser:

```text
http://localhost/padelflex-pro-v4/
http://192.168.1.10/padelflex-pro-v4/
```

Karena itu, gunakan alamat yang konsisten dan lakukan backup JSON secara rutin.

## Migrasi Versi Lama

Saat `padelflex_v4` belum tersedia, aplikasi akan mencari:

```text
padelflex_flow_v2
```

Data turnamen lama akan dibungkus menjadi satu session v4 secara otomatis.
Data lama tidak dihapus.

## Instalasi XAMPP

Ekstrak folder ke:

```text
C:\xampp\htdocs\padelflex-pro-v4
```

Jalankan Apache lalu buka:

```text
http://localhost/padelflex-pro-v4/
```

Tidak memerlukan PHP, Node.js, MySQL, atau SQL Server.

## PWA / Offline

Service worker hanya aktif melalui HTTP/HTTPS, bukan saat file HTML dibuka
langsung menggunakan `file://`.

Untuk pemasangan sebagai aplikasi:

1. Buka melalui `localhost` atau HTTPS.
2. Pilih menu browser.
3. Pilih **Install app** atau **Add to Home Screen**.

## Display TV

`display.html` membaca localStorage pada browser yang sama dan memperbarui
tampilan setiap beberapa detik.

Tanpa backend/database, browser pada perangkat lain memiliki penyimpanan
terpisah. Untuk layar TV yang berbeda perangkat, diperlukan sinkronisasi server
pada versi mendatang.


## Stable QA Build — 28 Juli 2026

Build ini telah melalui pengujian otomatis dan pengujian UI berbasis Chromium.

Perbaikan stabilitas yang sudah diterapkan:

- Scheduler adaptif untuk pemain/tim yang ditambahkan di tengah turnamen.
- Jumlah court per ronde dapat dikurangi sementara agar peserta yang tertinggal
  dapat mengejar jumlah game.
- Match yang sudah memiliki skor dan ronde aktif tetap dipertahankan ketika
  jadwal mendatang dibuat ulang.
- Proteksi halaman internal ketika tidak ada turnamen yang dipilih.
- Proteksi perubahan roster, skor, undo, dan aktivasi setelah turnamen selesai.
- Validasi skor harus bilangan bulat.
- Menghapus satu skor pada mode total otomatis akan mengosongkan kedua sisi.
- Input skor yang sama tidak lagi menambah riwayat undo.
- Data localStorage yang rusak dikarantina sebelum aplikasi melakukan recovery.
- Validasi backup lebih ketat dan menolak ID turnamen duplikat.
- Konfirmasi sebelum backup mengganti seluruh data browser.
- Penambahan pemain massal hanya melakukan satu kali penyusunan ulang jadwal.
- Tie-breaker leaderboard mengikuti seluruh kolom pembanding, bukan hanya
  nilai utama.
- Tampilan leaderboard mobile diringkas dan tidak lagi menampilkan informasi
  desktop yang berulang.
- Service worker menggunakan network-first dan cache version baru agar update
  file tidak tertahan cache lama.

Laporan lengkap tersedia pada `QA_REPORT.md`.


## PadelFlex Pro v4.1 — Match Tambahan

Operator dapat menambahkan satu match baru ketika turnamen sedang berjalan.

### Per Player

- Tersedia empat slot pemain.
- Pemain dapat dipilih satu per satu.
- Tombol **Random Peserta** mengisi empat slot secara acak.
- Random memprioritaskan pemain aktif dengan jumlah game paling sedikit.
- Setelah empat pemain dipilih, pasangan Tim A dan Tim B diacak otomatis.

### Per Tim

- Tersedia dua slot tim.
- Tim dapat dipilih manual atau menggunakan random.
- Pasangan anggota tim tidak berubah.

### Bobot leaderboard

Match tambahan memakai sistem skor turnamen yang sama.

- Total 21: peserta yang tertinggal satu match memperoleh `+10` pada `+M`.
- Total 15: memperoleh `+7`.
- Total 11: memperoleh `+5`.
- Skor manual: memperoleh `+1.5` poin per match yang lebih sedikit.

Dengan demikian, menambah satu match tidak langsung membuat peserta lain jatuh
hanya karena jumlah mainnya lebih sedikit.

### Perlindungan data

- Skor lama tidak diubah.
- Jadwal lama tidak dihapus.
- Match tambahan dapat diaktifkan langsung atau dimasukkan ke antrean.
- Match tambahan tanpa skor dapat dihapus.
- Match tambahan yang sudah memiliki skor tidak dapat dihapus.
- Match manual tetap dipertahankan ketika roster berubah dan jadwal otomatis
  berikutnya dihitung ulang.
