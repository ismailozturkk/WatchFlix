# Seelogd — Yük Testi İskeletleri

> **DURUM: HENÜZ ÇALIŞTIRILMADI.** Bu klasör yalnızca *plan* ve *hazır senaryolardır*.
> Çalıştırmadan önce `docs/guvenlik/DENETIM_2026-10-31_GUVENLIK_PERFORMANS.md` §4'ü oku ve onay al.

## Altın kurallar
1. **Asla prod'a (`movieandtv-2832a`) karşı çalıştırma.** Scriptler prod proje kimliğini görürse kendini durdurur.
2. Hedef yalnızca: **(A) Firebase Emulator** ya da **(B) ayrı Blaze staging projesi**.
3. Üçüncü taraf (TMDB/Gemini/OMDb/RevenueCat) uçlarına **hiç dokunma** — functions `FUNCTIONS_TEST=1` ile stub'lanmış olmalı.

## Ortam hazırlığı

### (A) Emülatör — doğruluk + çekişme (gerçek throughput değil)
```bash
firebase emulators:start --only firestore,auth,functions
# Ayrı terminalde harness:
#   STAGING_PROJECT=demo-seelogd FIRESTORE_EMULATOR_HOST=localhost:8085 \
#   node load-test/firestore-hotspot-harness.mjs
```

### (B) Staging — gerçek sayılar
```bash
# 1) Ayrı proje oluştur (bir kez): movieandtv-staging gibi
# 2) Aynı kurallar + functions'ı FUNCTIONS_TEST=1 ile deploy et
# 3) k6 senaryosunu staging functions taban URL'sine yönelt:
#   BASE_URL=https://<region>-<staging-proj>.cloudfunctions.net \
#   ID_TOKEN=<staging test kullanıcısının auth jetonu> \
#   k6 run load-test/k6-callables.js
```

## Dosyalar
- `k6-callables.js` — Cloud Functions callable uçları için k6 senaryosu (100→1k→5k→10k VU kademeleri).
- `firestore-hotspot-harness.mjs` — tek-belge sayaç çekişmesi (DailyPolls / Top100Hype) için eşzamanlılık koşumu.

## Kademeler
Her senaryo 100 → 1.000 → 5.000 → 10.000 VU; ramp-up 2dk / kararlı 5dk / ramp-down 1dk.
Eşikler aşılınca (hata > %5 veya p95 > hedef) koşum otomatik iptal edilir.
