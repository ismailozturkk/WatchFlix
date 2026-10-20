# AI model değerlendirmesi

CineMatch'in kullandığı Gemini 2.5 Flash'ı, Gemini 2.5 Flash-Lite ve Claude Haiku 5.5 ile
**aynı istemlerle** karşılaştırır. İstemler uygulamanın gerçek kurucularından gelir
(`buildCineSystemInstruction`, kütüphane özeti, tekrar engeli, bağlam bloğu), Gemini ayarları
`functions/index.js` içindeki `callGemini` ile birebir aynıdır.

## Ne ölçer

| Ölçüt | Anlamı |
|---|---|
| Kabul oranı | JSON temiz + doğru yanıt tipi + şema kuralları + başlıkların ≥%80'i TMDB'de aynı adla var + izlenmiş/önerilmiş başlık tekrarı yok + konu dışı istek reddedildi |
| JSON geçerliliği | ayrıştı / kesik yanıttan onarıldı / `max_tokens`'ta kesildi |
| TMDB eşleşmesi | **katı**: aranan türde (film/dizi) aynı adlı yapım var mı. "Şüpheli" = arama sonuç verdi ama ad tutmuyor — uygulama bunu poster olarak gösterir, yani yanlış film çıkar |
| Token ve maliyet | mesaj başı giriş/çıkış token'ı, USD, 1.000 mesaj maliyeti, gecikme p50/p95 |

Ölçmediği: önerinin kullanıcının zevkine uygunluğu. Karar öncesi birkaç yanıtı gözle oku
(`out/results.jsonl` içinde ham metinler var).

## Kurulum (bir kez)

```bash
npm install --prefix scripts/ai-eval
```

Anthropic SDK'sı bu klasöre kurulur; uygulamanın `package.json`'una dokunmaz.

## Çalıştırma

Önce **PLAN modu** (çağrı yapmaz, vaka sayısı ve tahmini maliyeti yazar):

```bash
npm run ai:eval
```

Gerçek çalıştırma için anahtarları ortam değişkeni olarak ver (PowerShell):

```powershell
$env:GEMINI_API_KEY = "..."      # Google AI Studio anahtarı
$env:ANTHROPIC_API_KEY = "..."   # console.anthropic.com anahtarı
$env:TMDB_TOKEN = "..."          # TMDB v4 "Read Access Token"
$env:AI_EVAL_RUN = "1"
$env:AI_EVAL_LIMIT = "10"        # önce küçük bir deneme: 10 vaka
npm run ai:eval
```

Anahtarlar hiçbir dosyaya yazılmaz. Sorun yoksa `AI_EVAL_LIMIT`'i kaldırıp tam çalıştır
(71 vaka × 3 model ≈ 0,12 USD tahmini, en kötü ≈ 0,48 USD).

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `AI_EVAL_RUN` | — | `1` olmadan hiçbir API çağrısı yapılmaz |
| `AI_EVAL_MODELS` | 3 model | virgüllü liste: `gemini-2.5-flash,gemini-2.5-flash-lite,claude-haiku-5-5,claude-haiku-5-5-think-low` |
| `AI_EVAL_RUNS` | 1 | vaka başına tekrar; farklar küçükse 3 yap (model çıktısı rastgeledir) |
| `AI_EVAL_LIMIT` | hepsi | tür dengesi korunarak ilk N vaka |
| `AI_EVAL_CASES` | hepsi | vaka kimliği önekleri: `rec-tr,cmp` |
| `AI_EVAL_MAX_TOKENS` | 1800 | üretimdeki `cine` tavanı |
| `AI_EVAL_CONCURRENCY` | 4 | eşzamanlı istek |
| `AI_EVAL_REPORT_ONLY` | — | `1` ise model çağırmaz, kayıtlı yanıtlardan raporu yeniden üretir |

Yeniden çalıştırma güvenlidir: başarılı çağrılar `out/results.jsonl`'den okunur (para harcanmaz),
hatalı olanlar tekrar denenir.

## Çıktılar (`out/`, git'e girmez)

- `report-latest.md` — karşılaştırma tablosu, vaka türüne göre kırılım, en sık kusurlar, şüpheli başlık örnekleri
- `results.jsonl` — ham model yanıtları + token/gecikme
- `scored-latest.json` — vaka başına puan ve kusur kodları
- `tmdb-cache.json` — TMDB doğrulama önbelleği

## Kendi isteklerini ekle

Elle yazılmış 71 vaka gerçek kullanımı birebir yansıtmaz. Uygulamadan topladığın gerçek
isteklerden 20–30 tanesini `scripts/ai-eval/extraCases.json` olarak ekle (diziyle aynı şema,
bkz. `dataset.js` başı):

```json
[
  { "id": "real-01", "category": "öneri", "language": "tr", "persona": "none",
    "message": "…", "expect": ["recommendations"] }
]
```

## Dikkat

- Fiyatlar `lib/models.js` içinde ve 2026-10-19'da resmi sayfalardan okundu; değişirse oradan güncelle.
- Claude Haiku 5.5 için `temperature/top_p/top_k` gönderilmez (varsayılan dışı değerler 400 verir) ve
  asistan ön doldurması yoktur; JSON yalnız talimatla istenir. `claude-haiku-5-5` çalıştırmasında düşünme
  kapalıdır (Gemini'deki `thinkingBudget: 0` ile eşdeğer). Çağrı `thinking` nedeniyle 400 dönerse
  `lib/models.js`'te `thinking`'i `adaptive` + `effort: "low"` yapan `-think-low` varyantını kullan.
- Claude tokenizer'ı Türkçede Gemini'den farklı sayar; maliyet karşılaştırması token sayısını gerçek
  yanıtlardan okuduğu için bunu zaten yansıtır.
- Modeller eşit koşulda ölçülür ama JSON zorlaması farklıdır: Gemini `responseMimeType: application/json`
  kullanır (üretimle aynı), Claude'da böyle bir kısıt yok. Bu fark gerçektir ve sonucu etkiler.
