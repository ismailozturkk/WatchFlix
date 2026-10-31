# TMDB jetonu — karar notu ve döndürme prosedürü (M-1 / T-SEC-4)

**Tarih:** 2026-10-31 · **Durum:** KARAR KULLANICIDA. Kod değiştirilmedi; aşağıdaki öneri (a).

## Mevcut durum (kodda doğrulandı)
- İstemci TMDB v4 okuma jetonunu `EXPO_PUBLIC_API_KEY`'den okur → paket içine gömülür, APK/IPA'dan çıkarılabilir.
- Okuma noktaları: `context/AppSettingsContext.js` (ana kaynak, `Bearer` öneki burada eklenir),
  `services/cineswipe/cineswipeService.js`, `services/dataDownloader.js`, `services/import/tmdbResolver.js`,
  `services/tournamentService.js`.
- İstemcide **239 TMDB çağrı satırı, 112 dosya** (`api.themoviedb.org` taraması, testler hariç).
- Sunucuda ayrı bir jeton zaten var: `functions/index.js` `defineSecret("TMDB_API_KEY")` (yalnız zamanlanmış
  platform taraması ve haftalık özet kullanıyor).
- Jeton salt-okunur: sızarsa veri değiştirilemez; zarar = kota/hız sınırını başkasının harcaması, en kötü durumda
  TMDB'nin jetonu askıya alması.

## Seçenekler

| | (a) İstemcide kalsın + döndürme/izleme | (b) TMDB'yi Cloud Function proxy arkasına al |
|---|---|---|
| İş | Küçük (yalnız belge + süreç) | Büyük: 112 dosya / 239 çağrı tek bir istemci katmanına toplanmalı + proxy + önbellek |
| Gecikme | Değişmez (cihaz → TMDB CDN) | Her istek Cloud Function'dan geçer (+ soğuk başlangıç) |
| Maliyet | 0 | Her gezinme isteği = 1 fonksiyon çağrısı + çıkış trafiği; 10K kullanıcıda Functions faturasının baskın kalemi olur |
| **TMDB hız sınırı** | Yük binlerce kullanıcı IP'sine dağılır | Tüm trafik birkaç Cloud Run IP'sinden çıkar → TMDB'nin IP başına hız sınırına toplu takılma riski (kullanıcının "üçüncü taraf limitlerini aşma" kısıtıyla çelişir) — ağır önbellek şart |
| Güvenlik kazancı | Yok (jeton yine çıkarılabilir) | Jeton cihazdan kalkar; kötüye kullanım App Check + kota ile sınırlanabilir — **ama App Check bugün 0 VALID** (M-3), yani proxy de şu an korumasız olurdu |

**Öneri: (a).** Gerekçe: jeton salt-okunur; (b)'nin güvenlik kazancı App Check çalışmadan gerçekleşmez; (b) hız sınırı ve
maliyet riskini büyütür. App Check sahada VALID ≥ %95 olduktan sonra (b) yeniden değerlendirilebilir.

## (a) için döndürme prosedürü (jeton sızdığında ya da yılda bir)
1. TMDB hesabı → Ayarlar → API → yeni "API Read Access Token" üret. Eskiyi HEMEN iptal ETME.
2. EAS ortam değişkenini güncelle (production + preview): `EXPO_PUBLIC_API_KEY`.
3. Yeni JS paketini dağıt: `eas update` (aynı runtimeVersion'daki kurulu sürümler jetonu OTA ile alır; native build
   gerekmez — `EXPO_PUBLIC_` değerleri paket derlenirken gömülür).
4. Eski runtimeVersion'daki (güncelleme alamayan) sürümlerin payı düşünce eski jetonu iptal et. İptal anında bu
   sürümlerde film/dizi verisi gelmez — acil sızıntıda bu bedel kabul edilir.
5. Sunucu jetonu (`TMDB_API_KEY` secret) ayrıdır; sızıntı yalnız istemci jetonundaysa ona dokunma.
6. Yerel `.env` / `.env.local` değerini de güncelle (git'te değiller).

## İzleme
- TMDB hesap panelinde kullanım görünüyorsa aylık bak; ani artış = jeton başka yerde kullanılıyor olabilir.
- Uygulama tarafı belirtisi: TMDB 429 (hız sınırı) / 401 (iptal) oranında artış. Bunlar şu an Sentry'ye ayrı etiketle
  düşmüyor — istenirse ortak TMDB istek yardımcısına eklenebilir (açık iş, karar sonrası).
