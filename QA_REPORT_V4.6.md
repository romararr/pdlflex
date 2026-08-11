# PadelFlex Pro v4.6 — QA Report

## Fokus perbaikan

Screenshot build v4.5 menunjukkan placeholder HTML seperti `0%`, `Menunggu`,
dan `0 menunggu` tidak berubah. Hal ini berarti JavaScript Operator tidak
menyelesaikan render.

v4.6 melakukan dua lapis perbaikan:

1. File halaman Operator diganti menjadi `matches-v46.js`, sehingga browser
   tidak dapat menggunakan `matches.js` lama dari cache.
2. Dependency Operator memakai query build `?v=4.6.0`, dan service worker
   memakai cache baru.

## Jadwal otomatis

Test utama:

- 8 pemain
- Per Player
- Total 21
- 1 court
- minimum 4 game
- rest 1
- Jadwal Otomatis

Hasil:

- 8 ronde dibuat.
- Ronde 1 aktif.
- Ronde 2–8 scheduled.
- Setiap pemain mendapat 4 game.

Self-repair juga diuji dengan state buatan:
`submitted=true`, `scheduleMode=auto`, `rounds=[]`.
`ensureAutoSchedule()` berhasil membuat ulang 8 ronde.

## Manual mode

Manual mode tetap diuji:

- Submit menghasilkan 0 ronde.
- Match pertama dapat ditambahkan manual.
- 4 peserta unik tetap diwajibkan.
- Rest-aware dan leaderboard tidak diubah.

## UI mobile

- Hero Operator disembunyikan di layar kecil.
- Tombol Match/Peserta/TV/Ranking satu baris.
- Mini-stat menjadi Total/Selesai/Menunggu/Jeda.
- Fairness kosong menampilkan `Belum ada data`.
- Antrean kosong disembunyikan.
- Riwayat disembunyikan bila belum ada ronde.
- Antrean dan riwayat memiliki internal scroll.
- Tambah Match tetap berupa modal.

## Validasi statis

- JavaScript syntax error: 0.
- Missing local asset: 0.
- Missing DOM ID pada Operator: 0.
- Duplicate HTML ID: 0.
