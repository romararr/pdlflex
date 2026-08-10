# PadelFlex Pro v4.5 — Compact Operator QA

Build date: 10 Agustus 2026

## Perubahan UI

- Stepper besar dihilangkan dari halaman Operator.
- Summary dipadatkan menjadi empat mini metric.
- Fairness berada dalam satu baris overview.
- Hanya match aktif yang menggunakan scoreboard besar.
- Antrean memakai scroll internal.
- Riwayat default memuat match selesai.
- Riwayat menggunakan row compact.
- Riwayat dibatasi tinggi 365 px dan menggunakan scroll internal.
- Tambah Match Manual dipindahkan ke modal.
- Bottom action bar dipangkas menjadi Undo, Selesaikan, dan Leaderboard.

## Modal

Dapat ditutup menggunakan:

- tombol X;
- tombol Batal;
- klik backdrop;
- tombol ESC.

Sesudah match berhasil dibuat, modal otomatis tertutup.

## Bug Fix

`activeRoundId` dapat tetap menunjuk ronde yang baru selesai. UI sekarang
memvalidasi `round.status === "active"` sebelum menampilkan panel Match Aktif.
Match selesai langsung muncul di Riwayat dan tidak lagi terlihat seolah-olah
masih aktif.

## Validasi Build

- JavaScript syntax error: 0.
- Missing asset reference: 0.
- Missing DOM ID reference pada matches.js: 0.
- Duplicate HTML ID: 0.
- Form Tambah Match tidak lagi berada inline pada halaman utama.
