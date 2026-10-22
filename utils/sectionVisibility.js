// utils/sectionVisibility.js
//
// "Hangi ekranda hangi BÖLÜM görünsün" kararının SAF mantığı. Burada RN importu YOK
// (jest yalnız saf modülleri test edebiliyor, bkz. jest.config.js).
//
// KAVRAMLAR
//   ekran  : bölümlerin yaşadığı beş yüzey — Diziler ("tv"), Filmler ("movie"), Eğlence
//            (eski Hub, kimliği "hub" kaldı), Kütüphane ("library") ve Profil ("profile").
//            Film ve Dizi tek sekmede ama AYRI ekran: ikisinin rafları farklı ve kullanıcı
//            birini sadeleştirip ötekini bırakabilmeli (screens/tabs/DiscoverScreen.js).
//   bölüm  : ekranın bağımsız bir parçası (bir raf, bir kart, bir şerit).
//   gizli  : kullanıcının kapattığı (ekran, bölüm) çiftleri.
//
// NEDEN "GİZLİ" LİSTESİ SAKLANIYOR, "GÖRÜNÜR" DEĞİL: varsayılan her bölümün
// görünmesi (bugünkü davranış) ve yarın yeni bir bölüm eklenirse, eski kayıtlı
// tercihin onu SESSİZCE kapalı bırakmaması. Boş kayıt = hepsi görünür. Aynı karar
// utils/decorScopes.js'te de verilmişti.
//
// ESKİ TEK ANAHTARLI BÖLÜM (`legacy`): "Sıradaki" (devam eden diziler) rafının kendi ayarı zaten
// vardı (Ayarlar > Dil ve içerik, `showOngoingTvShows`). İkinci bir kayıt açılsa
// aynı bölüm için iki gerçek doğruluk kaynağı olurdu ("burada kapalı, orada açık").
// Bu yüzden böyle bölümler BURADA listelenir (ayar ekranı tek yerden yönetsin) ama
// görünürlükleri bu modülün kaydında DEĞİL, `legacy` anahtardaki ayarda saklanır;
// ekran bölümü o ayardan okumaya devam eder.
//
// YENİ BÖLÜM: ilgili ekrana `show("kimlik")` / `filter` ile bağla + aşağıdaki
// listeye ekle + screens/tabs/settings/sectionVisibilityCopy.js'e üç dilde metin
// yaz. __tests__/sectionVisibility.test.js üçünü birden denetler (listede olup
// ekranda bağlanmamış ya da ekranda olup listede olmayan bölüm testi kırar).

// `tint`: ayar ekranındaki simge karosunun rengi (buildUiColors anahtarı).
const section = (id, icon, tint, extra = {}) => Object.freeze({ id, icon, tint, ...extra });

/**
 * Ekranlar ve bölümleri. Sıra, ayar ekranındaki sıradır — ve ekranda göründüğü
 * sıra (kullanıcı listeyi ekrandaki gibi okusun diye).
 *
 *   legacy      : görünürlüğü bu modülün kaydında değil, bu depo anahtarındaki
 *                 boolean ayarda (yukarıdaki not)
 *   confirmHide : gizlemeden önce onay iste — bölüm başka hiçbir yerden
 *                 erişilemeyen bir giriş noktası
 */
export const SECTION_SCREENS = Object.freeze(
  [
    {
      id: "tv",
      icon: "tv-outline",
      sections: [
        section("trends", "flame-outline", "blue"),
        section("best", "star-outline", "amber"),
        section("followedPeople", "notifications-outline", "blue"),
        section("fromFavorites", "heart-outline", "purple"),
        section("subscriptions", "layers-outline", "teal"),
        section("topGenres", "pricetags-outline", "blue"),
        section("recentFavorites", "thumbs-up-outline", "green"),
        section("worldTour", "earth-outline", "teal"),
        section("emmy", "trophy-outline", "amber"),
        section("providers", "apps-outline", "teal"),
        section("genres", "shapes-outline", "blue"),
        section("onTheAir", "radio-outline", "green"),
        section("airingToday", "today-outline", "amber"),
      ],
    },
    {
      id: "movie",
      icon: "videocam-outline",
      sections: [
        section("trends", "flame-outline", "blue"),
        section("bests", "star-outline", "amber"),
        section("followedPeople", "notifications-outline", "blue"),
        section("fromFavorites", "heart-outline", "purple"),
        section("subscriptions", "layers-outline", "teal"),
        section("topGenres", "pricetags-outline", "blue"),
        section("recentFavorites", "thumbs-up-outline", "green"),
        section("worldTour", "earth-outline", "teal"),
        section("nowPlaying", "ticket-outline", "green"),
        section("oscar", "trophy-outline", "amber"),
        section("collection", "albums-outline", "purple"),
        section("providers", "apps-outline", "teal"),
        section("genres", "shapes-outline", "blue"),
        section("upcoming", "calendar-outline", "blue"),
      ],
    },
    {
      id: "hub",
      icon: "game-controller-outline",
      sections: [
        section("feed", "chatbubbles-outline", "blue"),
        section("cineswipe", "heart-half-outline", "purple"),
        section("bingo", "grid-outline", "teal"),
        section("poll", "help-circle-outline", "purple"),
        section("tournament", "trophy-outline", "amber"),
        section("games", "game-controller-outline", "purple"),
      ],
    },
    {
      // Günlük işler: Profil'den taşınan Listeler / Hatırlatmalar / Notlar + devam
      // eden dizilerin rafı (Sıradaki; TV ana ekranından buraya taşındı) + Wrapped
      // (Eğlence'den taşındı).
      id: "library",
      icon: "library-outline",
      sections: [
        // Eski "Devam eden diziler" ayarı (Ayarlar > Dil ve içerik): tek doğruluk kaynağı.
        section("nextUp", "play-skip-forward-outline", "green", { legacy: "showOngoingTvShows" }),
        section("lists", "albums-outline", "purple"),
        section("reminders", "notifications-outline", "amber"),
        section("notes", "document-text-outline", "blue"),
        // Yıllık izleme özeti + arşiv: Eğlence'den taşındı (kimliği aynı kaldı).
        section("wrapped", "bar-chart-outline", "green"),
      ],
    },
    {
      id: "profile",
      icon: "person-circle-outline",
      sections: [
        // Başlıktaki (Düzenle / Paylaş'ın yanındaki) halka düğmesi: ekranda en üstte.
        section("goal", "flag-outline", "amber"),
        section("badges", "ribbon-outline", "amber"),
        // Mesajlar, arkadaş listesi ve istekler uygulamada YALNIZ buradan açılıyor.
        section("friends", "people-outline", "blue", { confirmHide: true }),
        section("stats", "stats-chart-outline", "green"),
        section("activity", "pulse-outline", "teal"),
      ],
    },
  ].map((screen) =>
    Object.freeze({ ...screen, sections: Object.freeze([...screen.sections]) }),
  ),
);

export const SECTION_SCREEN_IDS = Object.freeze(SECTION_SCREENS.map((screen) => screen.id));

const SCREEN_BY_ID = new Map(SECTION_SCREENS.map((screen) => [screen.id, screen]));

export const isSectionScreen = (screen) => SCREEN_BY_ID.has(screen);

/** Ekranın TÜM bölümleri (eski tek anahtarlılar dahil), ayar sırasıyla. */
export const sectionsOf = (screen) => SCREEN_BY_ID.get(screen)?.sections ?? [];

/** Yalnız bu modülün kaydında saklanan bölümler (eski tek anahtarlılar HARİÇ). */
export const storedSectionsOf = (screen) => sectionsOf(screen).filter((item) => !item.legacy);

export const getSection = (screen, id) => sectionsOf(screen).find((item) => item.id === id) ?? null;

const emptyHidden = () => Object.fromEntries(SECTION_SCREEN_IDS.map((screen) => [screen, []]));

/**
 * Kütüphane sekmesine taşınan bölümler (kimlikleri aynı kaldı): Listeler / Hatırlatmalar /
 * Notlar Profil'den, Wrapped Eğlence'den ("hub"). Eski kayıtta kaynak ekranda gizlenmiş
 * olanlar, taşınmayla birlikte sessizce geri görünmesin diye "library" ekranına aktarılır.
 * Yeniden yazım zaten normalize çıktısını (taşınmış hâlini) saklar; yani bu göç yalnız
 * bir kez iş görür.
 */
const MOVED_TO_LIBRARY = Object.freeze([
  { from: "profile", ids: Object.freeze(["lists", "reminders", "notes"]) },
  { from: "hub", ids: Object.freeze(["wrapped"]) },
]);
function migrateMovedSections(raw) {
  let next = raw;
  for (const { from, ids } of MOVED_TO_LIBRARY) {
    if (!Array.isArray(next[from])) continue;
    const moved = next[from].filter((id) => ids.includes(id));
    if (moved.length === 0) continue;
    const library = Array.isArray(next.library) ? next.library : [];
    next = { ...next, library: [...new Set([...library, ...moved])] };
  }
  return next;
}

/**
 * Depodan okunan ham değeri güvenli biçime çevirir. Bozuk/eksik/eski kayıt asla
 * hata vermez: bilinmeyen ekran ve bölüm kimlikleri atılır, eski tek anahtarlı
 * bölümler atılır (görünürlükleri başka yerde), tekrarlar silinir, sıra kanonik
 * hale gelir (aynı küme = aynı JSON → gereksiz yazım olmaz).
 *
 * @returns {Record<string, string[]>} her ekran için gizli bölüm kimlikleri
 */
export function normalizeSectionVisibility(rawValue) {
  const out = emptyHidden();
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) return out;
  const raw = migrateMovedSections(rawValue);
  for (const screen of SECTION_SCREEN_IDS) {
    const list = raw[screen];
    if (!Array.isArray(list)) continue;
    out[screen] = storedSectionsOf(screen)
      .map((item) => item.id)
      .filter((id) => list.includes(id));
  }
  return out;
}

/**
 * Bölüm bu ekranda görünür mü? Bilinmeyen ekran/bölüm için true: kayıtta olmayan
 * bir şeyi gizleme yetkisi yoktur. Eski tek anahtarlı bölümler için de true —
 * onların kararı kendi ayarında (üstteki not).
 */
export function isSectionVisible(hidden, screen, id) {
  const list = hidden && hidden[screen];
  return !(Array.isArray(list) && list.includes(id));
}

/**
 * Bir liste öğesini ekranın bölüm kimliğine göre süzer (Film/Dizi rafları).
 * Hiçbir şey elenmiyorsa AYNI diziyi döner: çağıranın useMemo'su ve FlatList
 * `data` kimliği gereksiz yere değişmez.
 *
 * @param {Record<string, string[]>} hidden
 * @param {string} screen
 * @param {Array} items
 * @param {(item: any) => string} [idOf]
 */
export function filterVisibleSections(hidden, screen, items, idOf = (item) => item?.key) {
  const list = hidden && hidden[screen];
  if (!Array.isArray(list) || list.length === 0) return items;
  const kept = items.filter((item) => !list.includes(idOf(item)));
  return kept.length === items.length ? items : kept;
}

/**
 * Tek bir (ekran, bölüm) çiftini açar/kapatır. Yeni, normalize nesne döner.
 * Bilinmeyen ya da eski tek anahtarlı bölüm yok sayılır.
 */
export function setSectionVisible(hidden, screen, id, visible) {
  const next = normalizeSectionVisibility(hidden);
  if (!isSectionScreen(screen) || !storedSectionsOf(screen).some((item) => item.id === id)) {
    return next;
  }
  const rest = next[screen].filter((item) => item !== id);
  return normalizeSectionVisibility({
    ...next,
    [screen]: visible ? rest : [...rest, id],
  });
}

/** Bir ekranın saklanan tüm bölümlerini açar ya da kapatır. */
export function setScreenSectionsVisible(hidden, screen, visible) {
  const next = normalizeSectionVisibility(hidden);
  if (!isSectionScreen(screen)) return next;
  next[screen] = visible ? [] : storedSectionsOf(screen).map((item) => item.id);
  return next;
}

/** Kaç bölüm gizli? `screen` verilmezse tüm ekranlar. Eski tek anahtarlılar sayılmaz. */
export function countHiddenSections(hidden, screen) {
  const normalized = normalizeSectionVisibility(hidden);
  const screens = screen === undefined ? SECTION_SCREEN_IDS : [screen];
  return screens.reduce((sum, id) => sum + (normalized[id]?.length ?? 0), 0);
}

/** Varsayılandan (hepsi görünür) sapma var mı — "Özel" rozeti ve sıfırlama için. */
export const isSectionVisibilityCustomized = (hidden) => countHiddenSections(hidden) > 0;

/**
 * Depoya yazılacak değer: hiçbir şey gizli değilse `null` (anahtar silinir, kayıt
 * varsayılana döner — yedekte ve diskte boş nesne dolaşmaz).
 */
export function toStoredSectionVisibility(hidden) {
  const normalized = normalizeSectionVisibility(hidden);
  return isSectionVisibilityCustomized(normalized) ? normalized : null;
}

/**
 * Ayar ekranı özeti: bölüm sayısı ve görünür olanlar. Eski tek anahtarlı bölümlerin
 * durumu `legacyValues`tan okunur ({ [depoAnahtarı]: boolean }); verilmeyen açık sayılır.
 */
export function summarizeScreen(hidden, screen, legacyValues = {}) {
  const normalized = normalizeSectionVisibility(hidden);
  const all = sectionsOf(screen);
  const shown = all.filter((item) =>
    item.legacy ? legacyValues[item.legacy] !== false : isSectionVisible(normalized, screen, item.id),
  ).length;
  return { total: all.length, shown, hidden: all.length - shown };
}
