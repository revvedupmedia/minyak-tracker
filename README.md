# Minyak Tracker

Web app peribadi untuk track mileage harian + minyak (Diesel & RON95 Boat) sekali dengan resit.

## Apa yang ada

- **Dashboard** dengan fuel gauge — tengok pecahan spending Diesel vs RON95 sekali pandang
- **Add Entry** — odometer mula/akhir (auto-kira jarak), amount, upload resit (gambar/PDF)
- **History** — senarai entry ikut bulan, boleh tap untuk tengok butiran & download resit
- **Status Claim** — tanda entry mana yang perlu claim & dah claim ke belum
- **PWA** — boleh "Add to Home Screen" kat phone, jadi macam app, takyah ingat link

## Setup: Push ke GitHub & Deploy ke GitHub Pages

### 1. Push code ke repo GitHub awak

```bash
cd minyak-tracker-app
git init
git add .
git commit -m "Initial commit: minyak tracker app"
git branch -M main
git remote add origin https://github.com/USERNAME/minyak-tracker.git
git push -u origin main
```

(Tukar `USERNAME` dengan GitHub username awak, dan buat repo baru kat github.com/new dulu sebelum push — boleh private atau public)

### 2. Enable GitHub Pages

1. Pergi ke repo awak kat GitHub → **Settings** → **Pages** (sebelah kiri)
2. Bawah **Build and deployment**, pilih Source: **Deploy from a branch**
3. Branch: pilih **main**, folder: **/ (root)**
4. Klik **Save**
5. Tunggu 1-2 minit, refresh page tu — link app awak akan muncul kat atas, contoh:
   `https://USERNAME.github.io/minyak-tracker/`

### 3. Install kat phone (Add to Home Screen)

**Android (Chrome):**
1. Buka link app tu dalam Chrome
2. Tap menu titik tiga (⋮) atas sebelah kanan
3. Tap "Add to Home screen" / "Install app"

**iPhone (Safari):**
1. Buka link app tu dalam Safari (kena Safari, bukan Chrome)
2. Tap butang Share (kotak dengan anak panah)
3. Scroll, tap "Add to Home Screen"

Lepas tu app akan muncul kat home screen macam app biasa, dengan icon sendiri — takyah buka browser dah.

## Files

- `index.html` — struktur page
- `style.css` — semua styling
- `app.js` — logic (connect Supabase, render gauge, handle form)
- `config.js` — Supabase URL & key (jangan share repo ni secara public kalau risau privacy data)
- `manifest.json` + `sw.js` — buatkan app ni installable sebagai PWA
- `icons/` — icon app

## Nota penting pasal privacy

App ni guna "publishable key" Supabase yang memang reka untuk client-side, jadi selamat letak dalam code. TAPI — sesiapa yang ada link app awak (`https://USERNAME.github.io/minyak-tracker/`) boleh akses dan edit data, sebab takde sistem login. Kalau nak privacy lagi tinggi:

- Buat **repo private** dekat GitHub (Pages still boleh jalan kalau awak ada GitHub Pro, atau guna Netlify/Vercel free untuk private repo)
- Atau just jangan share link tu kat orang lain

## Macam mana nak tambah ciri lain nanti

Kalau nak tambah benda macam: export ke Excel, filter by jenis minyak, summary tahunan, atau reminder bulanan — bagitahu saya, saya boleh sambung terus dari struktur ni.
