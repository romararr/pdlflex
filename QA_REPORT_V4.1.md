# PadelFlex Pro v4.1 — QA Addendum

Build date: 28 Juli 2026  
Feature: Match Tambahan + Adaptive Leaderboard Weight

## Fitur yang diuji

- Tambah match Per Player dengan empat peserta.
- Tambah match Per Tim dengan dua tim.
- Pilih peserta satu per satu.
- Random peserta.
- Random berulang untuk beberapa match tambahan.
- Prioritas completed game dan scheduled game paling sedikit.
- Random pairing untuk mode Per Player.
- Pilihan court.
- Aktivasi langsung.
- Masuk antrean tanpa aktivasi.
- Skor otomatis total 11, 15, dan 21.
- Skor manual.
- Kompensasi leaderboard `+M`.
- Hapus match tambahan tanpa skor.
- Larangan menghapus match tambahan yang sudah memiliki skor.
- Larangan peserta duplikat.
- Larangan perubahan setelah turnamen selesai.
- Preservasi match tambahan saat pemain baru masuk.
- Preservasi skor dan ID match lama.
- Rebuild jadwal setelah match tambahan dihapus.
- Kompatibilitas storage `padelflex_v4`.

## Hasil

- Core assertions: 29 lulus.
- Preservasi/rebuild assertions: 2 lulus.
- Randomized/fuzz assertions: 525 lulus.
- Total pemeriksaan fitur: **556 lulus**.
- JavaScript syntax error: **0**.
- Referensi ID UI yang hilang: **0**.
- Referensi asset HTML yang hilang: **0**.

## Bobot leaderboard

| Sistem skor | Kompensasi per game tertinggal |
|---|---:|
| Total 21 | +10 |
| Total 15 | +7 |
| Total 11 | +5 |
| Manual | +1.5 |

Pada mode total, skor match tambahan tetap menggunakan total pertandingan yang
dipilih saat init. Pada mode manual, dasar poin adalah menang 3, seri 1, kalah 0,
ditambah kompensasi untuk jumlah game yang lebih sedikit.

## Catatan desain

Random menggunakan urutan prioritas:

1. Game yang sudah selesai paling sedikit.
2. Total game yang sudah terjadwal paling sedikit.
3. Random di antara peserta dengan beban yang sama.

Dengan cara ini, beberapa match tambahan tidak terus menggunakan peserta yang
sama.
