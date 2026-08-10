# PadelFlex Pro v4.4 Stable QA

PadelFlex Pro adalah aplikasi turnamen padel local-first tanpa database server.
Semua data disimpan di browser dengan `localStorage` key `padelflex_v4`.

## Flow utama

1. Buat/pilih turnamen.
2. Init nama, skor, mode Per Player/Per Tim, court, dan minimal rest.
3. Masukkan roster.
4. Mulai turnamen. Mode default **Manual** dimulai dengan **0 match**.
5. Tambahkan match satu per satu, pilih peserta manual atau Random Peserta.
6. Aktifkan match yang pemainnya sudah siap, input skor, dan lihat leaderboard.
7. Export CSV/PNG/JSON atau backup seluruh aplikasi.

## Fairness yang dipakai

- Pemain yang datang terlambat **tidak dipaksa mengejar** total game pemain awal.
- Saat roster berubah, fairness dimulai dari epoch roster baru.
- Random memprioritaskan peserta yang cukup istirahat dan jumlah giliran sejak epoch terbaru paling sedikit.
- Default minimal rest adalah 1 ronde/match.
- `+M` late join hanya menghitung kesempatan setelah pemain mulai tersedia; ronde sebelum bergabung tidak dianggap missed game.

## Mode jadwal

### Manual — default

Turnamen dimulai dengan 0 match. Setiap match dibuat satu per satu. Untuk Per Player, pilih 4 pemain; untuk Per Tim, pilih 2 tim.

### Otomatis — opsional

Scheduler membuat ronde berdasarkan minimum game, court, pemerataan, dan rest. Jumlah court per ronde dapat dikurangi jika perlu untuk memberikan jeda tanpa menambah target game hanya demi rest.

## Proteksi data

- Turnamen selesai read-only sampai dibuka kembali.
- Undo skor sampai 50 perubahan terakhir.
- Match selesai bisa dibuka kembali untuk koreksi skor.
- Peserta nonaktif tidak dapat dipakai pada match baru.
- Match terjadwal yang melibatkan peserta yang dihapus/nonaktif dibersihkan dengan aman.
- Completed/active match tidak dihapus saat roster berubah.
- Data JSON rusak dikarantina sebelum recovery.
- Backup JSON bisa diexport/import.
- Migrasi dari `padelflex_flow_v2` tetap tersedia.

## Instalasi XAMPP

Ekstrak folder ke, misalnya:

```text
C:\xampp\htdocs\padelflex-pro-v4
```

Buka:

```text
http://localhost/padelflex-pro-v4/
```

Tidak membutuhkan PHP, Node.js, MySQL, atau SQL Server.

## PWA / Offline

Service worker aktif saat aplikasi dibuka melalui HTTP/HTTPS. Browser dapat menawarkan **Install app** / **Add to Home Screen**. Cache versi v4.4 menggunakan network-first agar file update lebih cepat terbaca.

## Catatan localStorage

`localhost`, IP LAN, domain, dan port yang berbeda dianggap origin yang berbeda. Gunakan alamat yang konsisten dan lakukan **Settings → Export Semua JSON** sebelum memindahkan server atau membersihkan data browser.

Lihat `QA_REPORT_V4.4.md` untuk hasil pengujian build ini.


## v4.5 Compact Operator

Halaman Pertandingan diringkas:

- stepper besar dihapus dari halaman operator;
- empat metrik dibuat menjadi mini-stat;
- fairness digabung ke overview;
- hanya satu match aktif ditampilkan detail;
- antrean berikutnya memakai area scroll internal;
- riwayat default hanya menampilkan match selesai;
- match selesai tampil sebagai row compact, bukan scoreboard penuh;
- aksi operator dipadatkan menjadi bar bawah;
- form Tambah Match Manual dipindahkan ke modal.

Modal dapat ditutup dengan tombol X, Batal, klik backdrop, atau tombol ESC.
