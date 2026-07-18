# PadelFlex Flow v2

Aplikasi web statis multi-page untuk pertandingan padel tanpa database.

## Alur

1. Init pertandingan:
   - nama match;
   - sistem skor;
   - random per player atau per tim;
   - jumlah court;
   - minimum game per peserta.
2. Masukkan pemain atau tim.
3. Submit pertandingan.
4. Sistem membuat ronde otomatis berdasarkan pemerataan.
5. Mainkan, input skor, skip match, atau tambahkan peserta baru.
6. Export leaderboard.

## Mode random

### Per Player

Nama pemain dimasukkan satu per satu. Sistem mengacak pasangan dan lawan pada
setiap ronde, sambil mengurangi pasangan/lawan berulang.

### Per Tim

Satu tim berisi dua pemain tetap. Sistem hanya mengacak lawan dan giliran
bermain. Leaderboard dihitung per tim.

## Penambahan peserta di tengah

Ketika peserta baru ditambahkan setelah pertandingan disubmit:

- seluruh match yang sudah memiliki skor dipertahankan;
- ronde yang sedang aktif dipertahankan;
- match yang pernah ditunda dipertahankan;
- match terjadwal setelahnya dihapus dan dibuat ulang;
- jumlah ronde tambahan dihitung ulang agar game kembali semerata mungkin.

## Skip pertandingan

Tombol **Tunda / Skip Match** memindahkan match ke belakang antrean. Match
tersebut belum dianggap selesai dan belum masuk leaderboard. Ronde berikutnya
dapat langsung dimainkan bila ronde aktif sudah tidak memiliki match lain.

## Penyimpanan tanpa database

Semua data disimpan pada `localStorage` browser menggunakan key:

```text
padelflex_flow_v2
```

Reload, menutup tab, atau restart Apache tidak menghapus data. Data hanya hilang
jika sesi di-reset atau data situs browser dibersihkan.

## Instalasi XAMPP

Ekstrak seluruh isi folder ke:

```text
C:\xampp\htdocs\padelflex
```

Buka:

```text
http://localhost/padelflex/
```

Tidak membutuhkan PHP, Node.js, atau database.


## Memainkan kembali match yang di-skip

Versi 2.1 menampilkan bagian **Antrean Match Tertunda** di atas daftar ronde.

- Tekan **Mainkan Lagi** pada match yang dipilih.
- Atau gunakan tombol tetap **Mainkan Match Tertunda** di bagian bawah layar.
- Ronde yang sedang aktif akan dikembalikan ke antrean normal tanpa kehilangan
  skor atau susunan.
- Match tertunda menjadi ronde aktif dan input skornya terbuka.
- Setelah match tertunda selesai, sistem dapat melanjutkan kembali ke ronde
  normal berikutnya.


## Tampilan leaderboard mobile v2.2

Pada layar maksimal 720px, leaderboard berubah dari tabel horizontal menjadi
daftar kartu seperti aplikasi turnamen mobile:

- ringkasan nama pertandingan, tipe random, sistem skor, peserta, dan court;
- header kolom tetap: G, W-L-T, Diff, +M, dan P;
- medal untuk peringkat 1–3;
- nama peserta diprioritaskan dan dipotong otomatis bila terlalu panjang;
- tidak ada horizontal scroll;
- navigasi bawah Rounds dan Leaderboard;
- desktop tetap menggunakan tabel penuh.
