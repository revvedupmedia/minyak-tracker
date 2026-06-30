# Minyak Tracker (v2 — rebuilt)

Web app peribadi untuk track mileage harian + minyak (Diesel & RON95 Boat) sekali dengan resit.

## ⚠️ PENTING: Step wajib di phone sebelum test versi baru ni

App lama yang awak install kat phone tu stuck dengan fail lama sebab service worker — walaupun saya update GitHub berkali-kali, phone awak tak download fail baru. Versi ni dah saya bina semula guna pendekatan berbeza (native `<dialog>` instead of custom popup), dan service worker baru sengaja **tak cache apa-apa langsung** supaya benda ni tak jadi lagi.

Tapi sekali ni je, awak kena buang install lama dulu:

1. **Padam app dari home screen** — tahan icon lama → Remove/Uninstall/Delete
2. **Buka Chrome** (bukan app yang install), pergi **Settings → Privacy and security → Clear browsing data** → pilih "Cached images and files" dan "Cookies and site data" → clear (atau senang punya cara: Settings → Site settings → cari domain `github.io` awak → "Clear & reset")
3. Push fail v2 ni (replace SEMUA fail dalam repo GitHub awak)
4. Tunggu GitHub Pages re-deploy (~1-2 minit)
5. Buka link dalam Chrome biasa dulu — test add entry, tap history item, confirm semua jalan lancar
6. Baru **Add to Home Screen** balik

Lepas step ni, update akan datang terus tanpa drama, sebab service worker baru tak simpan apa-apa untuk jadi "stuck".

## Apa yang berubah dari versi sebelum (kenapa bug overlapping sheet tu hilang)

Versi sebelum guna `<div>` biasa untuk popup borang (Tambah Entry / Butiran Entry), dengan saya tulis logic sendiri untuk pastikan satu je boleh terbuka. Logic tu sepatutnya betul, tapi disebabkan service worker cache stuck, fix-fix saya tak pernah sampai ke phone awak — jadi nampak macam "tak boleh hilang."

Versi ni guna elemen **`<dialog>`** browser yang sebenar (HTML native, bukan reka sendiri). Bila satu dialog buka guna `showModal()`, browser sendiri jamin semua benda lain dalam page jadi "inert" (tak boleh di-klik), automatik — bukan saya kena tulis logic untuk block tu. Ini dah saya test guna automation (Playwright) dan confirm: cuba klik history item masa form terbuka pun, browser refuse hantar event tu terus. Jadi struktur bug yang awak alami tu dah tak boleh wujud lagi.

## Apa yang ada

- **Dashboard** dengan fuel gauge — tengok pecahan spending Diesel vs RON95 sekali pandang
- **Add Entry** — odometer mula/akhir (auto-kira jarak), amount, upload resit (gambar/PDF)
- **History** — senarai entry ikut bulan, boleh tap untuk tengok butiran & download resit
- **Status Claim** — tanda entry mana yang perlu claim & dah claim ke belum
- **PWA** — boleh "Add to Home Screen" kat phone, jadi macam app, takyah ingat link

## Setup: Push ke GitHub & Deploy ke GitHub Pages

```bash
cd minyak-tracker-app
git add .
git commit -m "Rebuild: native dialog elements, no-cache service worker"
git push
```

Kalau ni first time push, rujuk command penuh dalam mesej sebelum ni (git init, remote add, dll).

GitHub Pages settings tak perlu diubah — guna setting sama yang awak dah enable.

## Files

- `index.html` — struktur page, guna `<dialog>` untuk Tambah Entry & Butiran Entry
- `style.css` — semua styling
- `app.js` — logic (connect Supabase, render gauge, handle dialog)
- `config.js` — Supabase URL & key
- `manifest.json` + `sw.js` — PWA installability (sw.js sengaja takde caching)
- `icons/` — icon app

## Nota privacy

App ni guna "publishable key" Supabase yang memang reka untuk client-side, jadi selamat letak dalam code. Sesiapa yang ada link app awak boleh akses data (takde sistem login) — kalau nak privacy lagi tinggi, buat repo private atau jangan share link.

## Nak tambah ciri lain?

Bagitahu saya kalau nak: export Excel, filter ikut jenis minyak, summary tahunan, reminder bulanan, dsb.
