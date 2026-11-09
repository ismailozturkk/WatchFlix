# Atmosfer — tür aileleri (8 Kas 2026, KODLANDI)

Kod: `utils/weatherParticles.js` → `GENRE_FAMILIES` + `COMPOSITES.genre*`.
Film ve dizi türleri farklı adlarla gelir; benzer türler **aynı aileye** düşer
ve aile **tek atmosfer** kullanır (filmde "Bilim Kurgu" = dizide "Bilim Kurgu &
Fantazi"). Bir yapımın ilk 3 farklı ailesinin atmosferi karışık çizilir
(2. ve 3. aile daha seyrek; ışık katmanları seyrelmez, hep 1 tane).

TMDB: 19 film + 16 dizi türü = 27 id (8'i ortak).

Her aile atmosferi bir **bileşik**: parçacık (Atlas) + gerekirse **ışık
katmanı** (vektör, `components/decor/OverlayLayers.js`).

| # | Aile | Film (id) | Dizi (id) | Bileşik | Parçacık | Işık katmanı |
|---|------|-----------|-----------|---------|----------|--------------|
| 1 | Aksiyon & Macera | 28, 12 | 10759 | genreAction | kıvılcım + kor | alt kenardan patlama ışığı (7–11 sn'de bir) |
| 2 | Bilim Kurgu & Fantastik | 878, 14 | 10765 | genreScifi | yıldız tozu + büyülü zerre | yavaş geçen halkalı gezegen (80–110 sn) |
| 3 | Gerilim | 53 | — | genreThriller | yağmur + şimşek | kalp atışı vinyeti (önde) |
| 4 | Korku | 27 | — | genreHorror | yarasa | 2 sis bandı (önde) + titreyen tavan lambası |
| 5 | Gizem | 9648 | 9648 | genreMystery | hayalet ışık | gezinen el feneri |
| 6 | Suç | 80 | 80 | genreCrime | yağmur | jaluzi gölgesi + pembe/camgöbeği neon |
| 7 | Romantik | 10749 | — | genreRomance | kalp + kırmızı gül yaprağı | üst köşelerde sıcak ışık |
| 8 | Dram | 18 | 18, 10766 | genreDrama | yaprak + cama süzülen damla | — |
| 9 | Komedi | 35, 10770 | 35 | genreComedy | mısır + konfeti | — |
| 10 | Animasyon | 16 | 16 | genreAnimation | kâğıt yıldız + bulut + kelebek | — |
| 11 | Aile & Çocuk | 10751 | 10751, 10762 | genreFamily | balon + uçurtma + kâğıt uçak | — |
| 12 | Müzik | 10402 | — | genreMusic | nota | ekolayzer çubukları (önde) |
| 13 | Tarih | 36 | — | genreHistory | parşömen + toz | mum ışığı titremesi |
| 14 | Belgesel & Haber | 99 | 99, 10763 | genreDocumentary | toz | kamera vizörü + REC noktası (önde) |
| 15 | Savaş & Politika | 10752 | 10768 | genreWar | kül + duman | ufukta uzak çakmalar |
| 16 | Western | 37 | 37 | genreWestern | kum + yuvarlanan çalı | sıcak hava dalgaları |
| 17 | Realite & Talk | — | 10764, 10767 | genreReality | bilet/yıldız | gezen spot + paparazzi flaşları (önde) |

Yeni şekiller (doku 8 × 5 = 512 × 320): cam damlası, konfeti, bulut, uçurtma,
kâğıt uçak, parşömen, yuvarlanan çalı.

Işığa duyarlılık (testte: `weatherParticles.test.js`)
- Flaş katmanları (patlama, uzak çakma, paparazzi) herhangi 1 saniyede en çok
  3 çakma; zamanın yarısından azında yanık; yükseliş yumuşak.
- Tam ekranı kaplayan katmanlar (vinyet, mum, neon, lamba) yalnız yavaş nabız
  ya da hafif titreme; tavan opaklığı ≤ 0,55, çoğu ≤ 0,3.
- Şimşek kuralı değişmedi (aydınlık ≤ %20, döngüde ≤ 2 çakma).

Görülmedi: cihazda hiçbir tür atmosferi denenmedi (Android'i kullanıcı deneyecek).
Ayar: renk/opaklık `OVERLAY_TONES`, zamanlama `makeOverlay` + `overlayFrame`.
