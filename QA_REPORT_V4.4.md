# PadelFlex Pro v4.4 — Stable QA Report

Build date: 10 Agustus 2026  
Storage key: `padelflex_v4`

## Ringkasan hasil

Build final menjalani **39.845 automated assertions** ditambah **12 JavaScript syntax checks** dan **80 konfigurasi performance sampling** pada scheduler otomatis.

Hasil akhir:

- Automated assertion gagal: **0**
- JavaScript syntax error: **0**
- Missing HTML/JS/PWA asset: **0**
- Missing DOM ID reference: **0**
- Duplicate HTML ID: **0**
- CSS class yang terdeteksi tidak terpakai: **0**
- Real-case late join 1.000 random seed: **0 kegagalan**

## Cakupan pengujian

| Kelompok | Pemeriksaan | Hasil |
|---|---:|---|
| Core flow, scheduler, score, migration | 8.771 | Lulus |
| Deep lifecycle, rest, pairing, auto/manual | 2.449 | Lulus |
| Edge-case score/history/roster | 14 | Lulus |
| Real-case 8 → 9 → 10 pemain, 1.000 seed | 28.000 | Lulus |
| HTML, DOM ID, PWA, asset, CSS audit | 599 | Lulus |
| Malformed-but-valid JSON recovery | 12 | Lulus |
| JavaScript syntax | 12 file | Lulus |

Total automated assertions: **39.845**.

## Real-case late join yang diuji

Skenario:

- P1–P8 hadir dari awal.
- P9 masuk setelah ronde 4 selesai.
- P10 masuk setelah ronde 9 selesai.
- Manual 0 Match.
- Per Player.
- Skor total 21.
- Rest minimal 1 ronde.
- Simulasi diteruskan sampai ronde 20.
- Diulang 1.000 random seed.

Validasi setiap seed:

- tidak ada pemain bermain pada dua ronde berturut-turut;
- P9 tidak dipaksa mengejar total game pemain awal;
- P10 tidak dipaksa mengejar total game pemain awal;
- `joinedAtRound` P9 = 5;
- `joinedAtRound` P10 = 10;
- `+M` hanya menggunakan window setelah pemain tersedia;
- fairness setelah roster P10 masuk tetap memakai epoch baru;
- selisih giliran sejak epoch terbaru maksimal satu.

Hasil: **28.000 / 28.000 assertions lulus**.

## Bug dan anomali yang ditemukan lalu diperbaiki

### 1. Duplikasi turnamen membawa state turnamen lama

Sebelumnya hasil duplikasi masih dapat membawa `roundCompletionCounter` dan
`balanceEpochRound` dari turnamen sumber.

Perbaikan: copy selalu dimulai dengan counter 0, epoch 1, ronde kosong, dan
`submitted = false`. Draft yang belum di-init juga tetap belum di-init.

### 2. Turnamen selesai berubah menjadi aktif setelah restore dari arsip

Sebelumnya `restoreSession()` hanya melihat `submitted`, sehingga turnamen yang
sudah selesai berubah menjadi Active.

Perbaikan: jika `completedAt` tersedia, status kembali menjadi `completed`.

### 3. Ghost participant setelah pemain dihapus

Scheduled manual match dapat tetap menyimpan ID pemain yang sudah dihapus dari
roster.

Perbaikan: semua unplayed reference dibersihkan sebelum hard delete. Completed
atau active match tetap dipertahankan untuk menjaga histori.

### 4. Match dengan pemain nonaktif masih bisa diaktifkan

Perbaikan: ronde divalidasi sebelum activation. Peserta pada incomplete match
harus masih tersedia dan aktif.

### 5. Status rest salah setelah edit skor ronde lama

Reopen completed match sebelumnya masih membawa `completedOrder`, sehingga
urutan rest tidak sesuai waktu completion baru.

Perbaikan: completion order dihapus saat reopen dan seluruh completed order
diresequence secara kronologis. Undo juga melakukan resequence.

### 6. Late join salah jika sudah ada match manual yang dibuat lebih dahulu

Sebelumnya pemain baru dapat dianggap bergabung di `activeRound + 1`, walaupun
sudah ada beberapa manual round di antrean.

Perbaikan: pada Manual mode, pemain baru mulai setelah nomor ronde tertinggi
yang sudah ada. Ia tidak mengejar match yang sudah dibuat sebelum kedatangannya.

### 7. Reactivate pemain bisa mendapat kompensasi untuk masa nonaktif

Perbaikan: ketika pemain diaktifkan kembali, eligibility window dimulai ulang
dari ronde berikutnya.

### 8. Score history bisa menunjuk match yang sudah dibersihkan

Perbaikan: ketika scheduled match dibuang akibat perubahan roster, history yang
mengarah ke match/round tersebut ikut dibersihkan.

### 9. Undo menghapus history sebelum memastikan target masih valid

Perbaikan: undo sekarang memvalidasi target terlebih dahulu, baru mem-pop
history.

### 10. Sorting leaderboard bisa memisahkan pemain yang seharusnya tie

Comparator pada mode Points/Wins/Difference/Win Rate belum menggunakan semua
field tie-breaker dalam urutan yang sama.

Perbaikan: sort comparator dan tie-key sekarang konsisten.

### 11. Data JSON valid tetapi strukturnya rusak dapat membuat runtime error

Perbaikan normalizer sekarang membersihkan:

- player/team invalid;
- round/match invalid;
- nilai numeric non-finite;
- score history orphan;
- activeRound ID yang sudah tidak ada;
- duplicate session ID.

JSON yang benar-benar tidak dapat diparse tetap dikarantina ke
`padelflex_v4_corrupt_<timestamp>`.

### 12. Rest status partial multi-match round ikut menghitung match yang sudah selesai

Perbaikan: activation/rest check hanya melihat incomplete match pada ronde
tersebut.

### 13. Pair manual terlalu random dan dapat mengulang partner yang sama

Untuk empat pemain yang sudah dipilih, sistem sekarang memilih salah satu dari
tiga kombinasi pairing dengan penalti tinggi untuk partner berulang dan penalti
lebih kecil untuk lawan berulang. Random hanya menjadi tie-breaker.

### 14. Label manual match disimpan tetapi tidak pernah tampil

Perbaikan: label sekarang ditampilkan pada header ronde.

## Cleanup technical debt

Dihapus atau dipangkas:

- `getPendingRounds()` yang sudah tidak digunakan;
- legacy `buildRounds()` scheduler yang sudah digantikan adaptive scheduler;
- public export internal yang tidak dipakai UI;
- `isManualExtra`, `isManual`, dan `weightMode` pada match baru;
- CSS `.grid-2`, `.badge-danger`, dan `.desktop-summary` yang tidak digunakan;
- parameter `force` pada `completeTournament()` yang tidak pernah dipakai;
- laporan QA versi lama dari paket distribusi final.

## Scheduler otomatis

Diuji pada kombinasi:

- Per Player dan Per Tim;
- 1–6 court;
- berbagai jumlah roster;
- rest 0–3;
- minimum game berbeda;
- late join;
- deactivate/reactivate;
- out-of-order activation.

Performance sampling 80 konfigurasi menunjukkan skenario umum berada dari
milidetik sampai beberapa detik. Kasus berat yang disampling masih selesai
tanpa hang permanen.

## Batasan arsitektur yang tetap berlaku

Aplikasi masih local-first tanpa backend/database. Karena itu:

- browser/perangkat berbeda tidak otomatis sinkron;
- `localhost`, IP LAN, domain, dan port berbeda mempunyai localStorage berbeda;
- Display TV pada perangkat berbeda tidak menerima live state browser operator;
- clear site data browser dapat menghapus localStorage.

Gunakan **Settings → Export Semua JSON** sebagai backup rutin.
