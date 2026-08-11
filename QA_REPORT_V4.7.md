# PadelFlex Pro v4.7 — Runtime QA

Tanggal build: 11 Agustus 2026

## Akar masalah yang ditangani

Kegagalan jadwal otomatis dan modal memiliki satu titik risiko yang sama: seluruh halaman Operator bergantung pada satu runtime JavaScript. Selain itu, service worker/cache versi lama dapat menyajikan pasangan HTML dan JavaScript yang berbeda versi.

## Perbaikan v4.7

- Operator menggunakan file unik `storage-v47.js`, `scheduler-v47.js`, `core-v47.js`, `common-v47.js`, dan `matches-v47.js`.
- Service worker tidak diregistrasikan lagi.
- Saat build v4.7 terdeteksi, registrasi service worker PadelFlex lama di-unregister dan cache `padelflex-*` dibersihkan.
- Render halaman utama tidak lagi menjalankan builder modal. Error pada form Tambah Match tidak bisa mematikan jadwal.
- Modal ditampilkan lebih dulu; builder dijalankan dalam `try/catch`. Bila builder bermasalah, modal tetap muncul dan pesan error terlihat.
- Setiap section Operator dirender secara terisolasi (`safeRender`), sehingga satu section error tidak menghentikan section lain.
- Auto schedule memiliki self-repair dan fallback rebuild.
- Auto schedule yang belum punya hasil otomatis menampilkan filter `Menunggu`, sehingga seluruh jadwal berikutnya terlihat.
- Runtime error sekarang tampil pada banner Operator dan tidak gagal diam-diam.

## Real Browser DOM Simulation

Pengujian dijalankan dengan Chromium headless 390×844 menggunakan DOM browser asli.

### Auto Schedule

Konfigurasi:

- 8 pemain
- Per Player
- Total 21
- 1 court
- minimum 4 game
- rest 1
- mode Auto

Hasil:

- 8 ronde terbentuk.
- Ronde 1 tampil sebagai Match Aktif.
- 7 ronde berikutnya tampil di Antrean.
- Filter otomatis berubah ke `Menunggu`.
- Tidak ada page runtime error.

### Auto State Repair

State sengaja dirusak menjadi `submitted=true`, `scheduleMode=auto`, `rounds=[]`.

Hasil:

- 8 ronde dibuat kembali.
- Ronde aktif dan 7 antrean tampil kembali.
- Tidak ada runtime error.

### Tambah Match Modal

Pada mode Auto dan Manual:

- Tombol `+ Match` membuka modal.
- Modal berisi 4 select untuk mode Per Player.
- Random mengisi 4 pemain unik.
- Create menambahkan match dan modal tertutup otomatis.

### Manual 0 Match

- Submit manual tetap menghasilkan 0 ronde.
- Tambah Match berhasil membuat match pertama.

## Static Validation

- JavaScript syntax error: 0
- Missing asset: 0
- Missing DOM ID: 0
- Duplicate HTML ID: 0

## Deployment yang direkomendasikan

Untuk menghindari scope service worker folder lama, deploy v4.7 ke folder baru, misalnya:

```text
C:\xampp\htdocs\padelflex-v47
```

Buka:

```text
http://localhost/padelflex-v47/
```

Data tetap terbaca karena `localStorage` mengikuti origin `http://localhost`, bukan nama folder.
