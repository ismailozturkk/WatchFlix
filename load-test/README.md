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
# 1) Ayrı Blaze proje oluştur (bir kez, KULLANICI): movieandtv-staging gibi;
#    .firebaserc'a "staging" alias'ı ekle: firebase use --add
# 2) Sahte secret'lar (gerçek anahtar KOYMA — stub zaten dışarı çıkmaz):
#    firebase functions:secrets:set GEMINI_API_KEY -P staging   (değer: dummy) — OMDB_API_KEY,
#    REVENUECAT_SECRET_API_KEY, REVENUECAT_WEBHOOK_AUTH, TMDB_API_KEY, APPLE_* için de aynı
# 3) functions/.env.<staging-proje-kimliği> dosyasına:
#      FUNCTIONS_TEST=1
#      FUNCTIONS_TEST_LATENCY_MS=300   (isteğe bağlı: gerçek upstream gecikmesini taklit)
#    sonra: firebase deploy -P staging --only firestore:rules,functions
# 4) Test kullanıcıları + ID jetonları (tokens.json, JSON dizi) üret, k6'yı staging'e yönelt:
#   BASE_URL=https://<region>-<staging-proj>.cloudfunctions.net \
#   ID_TOKENS_FILE=./tokens.json STAGE=smoke \
#   k6 run load-test/k6-callables.js
```

**Stub (`functions/upstreamStub.js`):** `FUNCTIONS_TEST=1` iken Gemini, OMDb, RevenueCat, TMDB sahte yanıt döner;
Google/Apple kimlik uçları her zaman reddeder (sahte kimlik üretmez); Expo push gönderilmez (her mesaja "ok" bileti).
Proje kimliği `movieandtv-2832a` ise bayrak **yok sayılır** ve hata günlüğe yazılır. Bayrak yoksa hiçbir şey
değişmez. Emülatörde uçtan uca doğrulandı (31 Eki): `getExternalRatings` ve `callGemini` (kimlik → Firestore kota →
sahte Gemini → yanıt) dışarıya istek atmadan döndü.

**k6 notu:** kota ve hız sınırı kullanıcı başına → tek jetonla koşum ilk saniyelerde 429'a düşer. 429 beklenen
sonuç sayılır (hata oranına girmez), ama anlamlı ölçüm için VU sayısı kadar test kullanıcısı gerekir.

## Dosyalar
- `k6-callables.js` — Cloud Functions callable uçları için k6 senaryosu (100→1k→5k→10k VU kademeleri).
- `firestore-hotspot-harness.mjs` — tek-belge sayaç çekişmesi (DailyPolls / Top100Hype) için eşzamanlılık koşumu.

## Kademeler
Her senaryo 100 → 1.000 → 5.000 → 10.000 VU; ramp-up 2dk / kararlı 5dk / ramp-down 1dk.
Eşikler aşılınca (hata > %5 veya p95 > hedef) koşum otomatik iptal edilir.
