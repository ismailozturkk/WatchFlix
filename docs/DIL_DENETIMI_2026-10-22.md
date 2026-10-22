# Dil denetimi ve yarım kalan bildirim çalışması — 22 Ekim 2026

## Kapsam ve sonuç

Limit nedeniyle kesilen “Profil bildirim ekranı ekle” ve “Dil çevirilerini kontrol et” sohbetleri okunarak mevcut çalışma ağacıyla karşılaştırıldı. Bildirim sohbetinin son isteği kompakt, dokununca genişleyen görünüm; dil sohbetinin isteği çevirilerin ve gerçek kullanım yerlerinin denetlenmesiydi.

19 Ekim raporundaki sekiz ana bulguya yönelik düzeltmeler bu çalışma başlamadan önce kodda mevcuttu. Bunlar güncel kaynaklarla yeniden kontrol edildi. Uygulama artık TR / EN / ES / PT / DE olmak üzere beş dili kaydediyor. Bu rapor önceki dört dilli raporun yerine güncel durum olarak kullanılmalıdır.

## Sözlük doğrulaması

- Beş JSON sözlüğünün her birinde **3.047 yaprak anahtar** var; diziler tek yaprak sayıldı.
- Anahtar kümeleri eşit. Boş metin, yinelenen JSON nesne anahtarı ve diller arası `{{...}}` yer tutucu uyuşmazlığı bulunmadı.
- Yinelenen anahtar kontrolü JSON.parse sonrasındaki nesneyle sınırlanmadı; özgün dosyalar Babel parser ile incelendi.
- Statik çeviri anahtarları, dil kaydı, cihaz dili, ES/PT/DE metin tabloları, native izin ve widget metinleri mevcut testlerle kontrol edildi.

## Önceki sekiz bulgunun durumu

| Bulgu | Güncel durum ve kanıt |
| --- | --- |
| İçe aktarma akışının Türkçe kalması | Ayarlar giriş satırı, ImportDataModal ve ImportHelpModal `getImportCopy(language)` kullanıyor. `components/import/importCopy.js` beş dil içeriyor. Letterboxd/IMDb servisleri ImportError kodu üretiyor; arayüz `importErrorText` ile yerelleştiriyor. Hata kodları, yardım yer tutucuları ve ilerleme metinleri beş dilde çalıştırıldı. |
| Modül yüklenirken dondurulan etiketler | PrivacySettingsScreen, PosterSettingsScreen ve ActorViewScreen seçenekleri dil bağımlı üreticilerle yenileniyor. StoryTabs dil bağlamına abone; aynı memo bileşeni yeniden oluşturulmadan TR → EN → ES → PT → DE → TR geçişi test edildi. FriendProfileScreen liste başlıklarını çizim sırasında üretiyor; bu çalışmada memo liste kartına da doğrudan dil aboneliği eklendi. |
| Takvimde `{{n}}` görünmesi | CalendarScreen artık `n: monthCounts.total` gönderiyor. Gerçek i18next ile beş dilde 5 sayısının yer tutucu bırakmadan işlendiği mevcut test geçti. |
| Oscar/Emmy kategorilerinin Türkçe kalması | MovieOscar ve TvShowsEmmy önce `categoryLabelKey` üzerinden çeviri çözüyor; `categoryLabelTr` yedek. Kartların `t` prop'u dil bağlamından geliyor ve dil değişiminde yenileniyor. Kaynak düzeyinde doğrulandı. |
| Rozetlerin sonraki hedefinde ES/PT kaybı | `gruplaAileler` artık `dilAlanlari(sonraki)` taşıyor. Üretilen tüm sonraki hedeflerin beş dilde adı ve açıklaması özgün katalogla karşılaştırıldı. |
| Dönem mühürlerinde eksik dil alanları | `muhurDilAlanlari` desteklenen dillerin tamamını üretiyor. 2026 sonbahar mührünün kart başlığı ve açıklaması beş dilde doğrulandı. |
| Bölüm etiketindeki fazla noktalama | Beş sözlükte `autoI18n.bolum` düz etiket; TR `Bölüm`, EN `Episode`, ES `Episodio`, PT `Episódio`, DE `Folge`. |
| AI filtre çipinin İngilizce kullanıcı mesajı üretmesi | AIChatScreen filtre çipinin prompt'u beş dilde `pickByLanguage` ile seçiliyor ve memo bağımlılıklarında dil var. Kaynak düzeyinde doğrulandı; canlı modele istek gönderilmedi. |

## Bu çalışmada tamamlanan ek düzeltmeler

- StoryTabs içindeki sabit `Poster` metni mevcut `autoI18n.profil_story_ogr_poster` çevirisine bağlandı. Sekmenin adı diğer sekmelerle birlikte dil değiştiriyor.
- FriendProfileScreen içindeki memo SharedListGridCard doğrudan dil bağlamına abone edildi. Liste prop'ları aynı kalsa bile başlığın yeniden çizilmesi sağlandı.
- Bildirim testlerindeki `act` dışı unmount işlemleri ve temizlenmeyen rozet test ağacı düzeltildi.
- Yeni `localizationRuntime.test.js`, gerçek i18next sözlükleriyle monte edilmiş paylaşım sekmelerini, gruplanmış rozetleri, dönem mühürlerini ve içe aktarma hata/metin akışını kapsıyor.

## Kompakt bildirim ekranı

Önceki sohbetten kalan ekran kodu ve profil bağlantısı mevcut. Son kontroller tamamlandı:

- Profilde zil düğmesi ve okunmamış sayı rozeti, kayıtlı NotificationsScreen rotasına açılıyor.
- Satırlar küçük simge, ad, kısa zaman ve tek satır önizleme gösteriyor.
- Dokununca detay ve tam tarih-saat açılıyor; yalnız bir bildirim genişletilmiş kalıyor. Aynı satıra tekrar dokununca kapanıyor.
- İlgili içeriğe yalnız detay içindeki ayrı düğmeyle gidiliyor.
- Okunmamış filtresinde yeni okunan açık bildirim, kapatılana veya filtre değiştirilene kadar görünür kalıyor.
- Okundu kaydı başarısız olduğunda durum korunuyor ve hata gösteriliyor. Sonradan içerik düğmesiyle başlatılan bekleyen işlem, hesap değiştiğinde yönlendirme yapmıyor.
- Sayfalama, hesap değişiminde eski kayıtların temizlenmesi, yükleme/hata durumları ve RelativeTimeFormat bulunmayan çalışma ortamı testleri geçti.
- Yeni test açık bildirimin başlığı, eylem metni ve içerik düğmesinin beş dil arasında yenilendiğini doğruluyor.

## Doğrulama sonuçları

İki ayrı, örtüşmeyen son başarılı test grubu:

1. **12 paket / 321 test:** i18nKeys, appLanguages, deviceLanguage, germanSupport, portugueseSupport, copyTablesSpanish, nativePermissionLocales, widgetNativeLanguage, watchBadgeCatalog, aiCopy, onboardingCopy, trailerLanguages.
2. **6 paket / 93 test:** notificationsScreen, localizationRuntime, notificationInbox, notificationsService, profileIdentityBlockGoal, glassCoverageGuard.

**Toplam: 18 paket / 414 test başarılı.** Yeni davranış testlerinde ilk çalıştırmada test yardımcısının iç içe `act` kullanımından kaynaklanan iki hata düzeltildi; yukarıdaki sayılar son başarılı çalışmalara aittir.

StoryTabs, FriendProfileScreen ve NotificationsScreen Babel dönüşümü başarılı. Bu çalışmanın değişikliklerinde whitespace kontrolü temiz.

## Kapsam sınırları ve kalan gözlemler

- Testler kaynak ve taklit native bileşenlerle davranış doğrulamasıdır. Fiziksel cihaz/emülatörde görsel taşma, native cam görünümü veya canlı Firestore uçtan uca testi yapılmadı; yeni build/deploy oluşturulmadı.
- Beş dilin tüm metinleri için ana dil düzeyinde editoryal onay verilmiş değildir. Sözlük eşitliği, uygulamanın her metninin kusursuz çevrildiği anlamına gelmez.
- `legalLanguageOf` ES/PT/DE için İngilizce yasal sayfa seçiyor. Web dil menüsünün beş dili tanıması hukuki metinlerin de beş dilde yazıldığı anlamına gelmiyor; bu mevcut kapsam sınırı sürüyor.
- SharedListsContext sıralaması artık uygulama yereline bağlı. `utils/listSearch.js:topListGenres` ise eşit sayıda kullanılan türler için deterministik bağlayıcı olarak `localeCompare(..., "tr")` kullanmaya devam ediyor; bu bir çevrilmemiş ekran metni değildir.
- FriendProfileScreen sıfır süreyi artık yerelleştirilmiş `duration_minutes` anahtarıyla gösteriyor.
