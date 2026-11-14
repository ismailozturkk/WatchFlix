# seelogd pazarlama klasörü

Pazarlamayla ilgili her şey burada. Bir bilgi değişince önce ilgili dosya güncellenir, sonra `DURUM.md`.

**Nereden başlanır:** [DURUM.md](DURUM.md). Hesapların, kararların ve açık işlerin güncel hâli orada.

## Klasör düzeni

| Dosya | Ne için |
|---|---|
| [DURUM.md](DURUM.md) | Tek bakışta durum, kararlar, açık işler |
| [urun/UYGULAMA_BILGI_KARTI.md](urun/UYGULAMA_BILGI_KARTI.md) | Özellikler, planlar, fiyatlar, söylenebilecek ve söylenemeyecek şeyler |
| [marka/MARKA_REHBERI.md](marka/MARKA_REHBERI.md) | Ses tonu, sloganlar, renk ve yazı tipi |
| [analiz/PAZAR_VE_RAKIP_ANALIZI.md](analiz/PAZAR_VE_RAKIP_ANALIZI.md) | Rakipler, konum, güçlü ve zayıf yanlar |
| [analiz/HAZIRLIK_DENETIMI_2026-11-02.md](analiz/HAZIRLIK_DENETIMI_2026-11-02.md) | Pazarlamaya başlamadan önce bulunan sorunlar |
| [analiz/KANAL_VE_DONUSUM_ANALIZI.md](analiz/KANAL_VE_DONUSUM_ANALIZI.md) | Kullanıcı nereden gelir: huni, kanca sıralaması, ölçüm, karar kuralları |
| [strateji/PAZARLAMA_STRATEJISI.md](strateji/PAZARLAMA_STRATEJISI.md) | Hedefler, aşamalar, kanal öncelikleri |
| [strateji/REKLAM_PLANI.md](strateji/REKLAM_PLANI.md) | Ücretli reklamın şartları, bütçesi, ölçümü |
| [strateji/ICERIK_URETICI_PLANI.md](strateji/ICERIK_URETICI_PLANI.md) | Influencer seçimi, promosyon kodu, DM metinleri |
| [hesaplar/](hesaplar/) | Her platform için ayrı dosya: hesap bilgisi, bio, format, kurallar, kayıt |
| [takvim/HAFTA_01.md](takvim/HAFTA_01.md) | İlk haftanın takvimi ve hazır metinleri |
| [icerik/METIN_KUTUPHANESI.md](icerik/METIN_KUTUPHANESI.md) | Tekrar kullanılabilir gönderi, yorum ve yanıt metinleri |
| [icerik/GORSEL_ENVANTERI.md](icerik/GORSEL_ENVANTERI.md) | Her görselin durumu ve nerede kullanılabileceği |
| [icerik/VIDEO_BILGI_DOSYASI.md](icerik/VIDEO_BILGI_DOSYASI.md) | Videolarda anlatılacak özellikler, plan bilgisi, kayıt kuralları |
| [olcum/METRIKLER.md](olcum/METRIKLER.md) | Hangi sayı nereden okunur, haftalık özet |
| [olcum/PAYLASIM_KAYDI.csv](olcum/PAYLASIM_KAYDI.csv) | Yapılan her paylaşımın kaydı |
| [sosyal-medya/](sosyal-medya/README.md) | Görsel üretim sistemi ve hazır PNG'ler |

## Bilgi gelince nereye yazılır

| Gelen bilgi | Güncellenecek dosya |
|---|---|
| Kullanıcı adı, hesap açıldı, takipçi sayısı | `hesaplar/<platform>.md`, `DURUM.md` |
| Paylaşım yapıldı | `olcum/PAYLASIM_KAYDI.csv` |
| Kayıt sayısı, erişim, tıklama | `olcum/METRIKLER.md` |
| Özellik, plan, fiyat değişti | `urun/UYGULAMA_BILGI_KARTI.md`, etkilenen metinler |
| Mağaza yayını, karar, sorun çözüldü | `DURUM.md` |
| Yeni görsel üretildi | `icerik/GORSEL_ENVANTERI.md` |
| Videoda anlatılacak özellik veya istek | `icerik/VIDEO_BILGI_DOSYASI.md` |
| İçerik üreticiyle görüşüldü | `strateji/ICERIK_URETICI_PLANI.md` |

## Yazım kuralları

- Ölçülen sayı, tahmin ve öneri ayrı yazılır. Kaynağı olmayan sayı "ölçüldü" diye yazılmaz.
- Her dosyanın başında son güncelleme tarihi bulunur.
- Parola, kurtarma kodu, API anahtarı ve e-posta listesi bu klasöre **yazılmaz**.
