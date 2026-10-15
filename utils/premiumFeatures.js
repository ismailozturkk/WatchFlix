// utils/premiumFeatures.js
//
// PREMIUM YETKİLERİNİN TEK KAYNAĞI.
//
// Neden tek dosya: 12 Ağustos'ta (P0.2) ödeme ekranı, uygulamada karşılığı
// olmayan vaatler ("reklamsız", "tüm Wrapped yılları", "sınırsız liste")
// gösterdiği için temizlenmişti; bir sonraki tasarım turunda aynı vaatler geri
// geldi. Kök neden vaat metni ile yetki kapısının ayrı yerlerde yaşamasıydı.
// Artık:
//   • Her ücretli fark burada BİR girdi: plan başına limit + ekranda görünen metin.
//   • Kapılar (hooks/usePremiumGate.js) limiti buradan okur.
//   • Ödeme ekranı, Ayarlar kartı ve Hakkında SSS'i metni buradan üretir.
// Burada olmayan bir şey satılamaz; burada olan her şeyin bir kapısı vardır.
//
// Sunucuda zorlanan limitlerin (AI kotası, platform bildirimleri) aynası
// functions/ altındadır; eşitliği __tests__/premiumFeatures.test.js doğrular.
//
// Bu modül SAF: React, depolama veya ağ import etmez (testlerde doğrudan
// çalışır, typographySettings gibi React dışı store'lar da kullanabilir).

import {
  AI_PLAN_LIMITS,
  PREMIUM_PLAN,
  getPremiumPlanDisplayName,
} from "./premium";

export const UNLIMITED = Infinity;

const PLAN_ORDER = Object.freeze([
  PREMIUM_PLAN.FREE,
  PREMIUM_PLAN.PREMIUM,
  PREMIUM_PLAN.UNLIMITED,
]);

export const PLANS = PLAN_ORDER;

export function normalizePlan(plan) {
  return PLAN_ORDER.includes(plan) ? plan : PREMIUM_PLAN.FREE;
}

export function planRank(plan) {
  return PLAN_ORDER.indexOf(normalizePlan(plan));
}

/** İki plandan yüksek olanı döner (bilinmeyen değer free sayılır). */
export function higherPlan(left, right) {
  return planRank(left) >= planRank(right)
    ? normalizePlan(left)
    : normalizePlan(right);
}

export const FEATURE_KIND = Object.freeze({
  /** Aç/kapa: minPlan ve üstü kullanır. */
  ACCESS: "access",
  /**
   * Toplam adet: sahip olunan liste/arkadaş/grup sayısı. `window: true` olan
   * girdi (Wrapped arşivi) harcanan bir miktar değil geriye doğru görülebilen
   * yıl penceresidir: sayaç/gösterge çizilmez, etiketi `planValue`dan gelir.
   */
  COUNT: "count",
  /** Günlük hak: yerel gün değişince sıfırlanır. */
  DAILY: "daily",
  // COUNT/DAILY'de bir planın limiti 0 olabilir: özellik o planda KAPALIDIR
  // (ör. Free'de oyun). Kapalılık `isLockedFor` ile sorulur; ekranlar "limit
  // doldu" yerine "Premium özelliği" konuşur.
  /** Günlük + aylık mesaj kotası; sunucuda (functions/aiQuota.js) zorlanır. */
  AI_QUOTA: "ai_quota",
});

const { ACCESS, COUNT, DAILY, AI_QUOTA } = FEATURE_KIND;

export const FEATURE_CATEGORIES = Object.freeze([
  {
    id: "ai",
    icon: "sparkles",
    color: "#8B5CF6",
    title: { tr: "CineMatch AI", en: "CineMatch AI" },
  },
  {
    id: "social",
    icon: "people",
    color: "#EC4899",
    title: { tr: "Sosyal", en: "Social" },
  },
  {
    id: "library",
    icon: "albums",
    color: "#10B981",
    title: { tr: "Kütüphane", en: "Library" },
  },
  {
    id: "notes",
    icon: "document-text",
    color: "#14B8A6",
    title: { tr: "Notlar", en: "Notes" },
  },
  {
    id: "play",
    icon: "game-controller",
    color: "#3B82F6",
    title: { tr: "Oyun, CineSwipe & Turnuva", en: "Games, CineSwipe & Tournament" },
  },
  {
    id: "personal",
    icon: "color-palette",
    color: "#F59E0B",
    title: { tr: "Kişiselleştirme", en: "Personalization" },
  },
  {
    id: "alerts",
    icon: "notifications",
    color: "#06B6D4",
    title: { tr: "Bildirim & Arşiv", en: "Alerts & Archive" },
  },
]);

/**
 * Ücretsiz yazı tipleri: her rol (başlık / gövde / rakam) için en az iki
 * okunaklı seçenek. Geri kalan katalog Premium'dadır.
 */
export const FREE_FONT_PRESET_IDS = Object.freeze([
  "system",
  "barlow",
  "lexend",
  "bitter",
  "spaceMono",
  "oswald",
  "playfairDisplay",
]);

/** Katalogdaki toplam yazı tipi sayısı (utils/typographyRoles.js FONT_PRESETS). */
export const FONT_CATALOG_SIZE = 56;

/** Hazır tema sayısı (theme/colors.js `themes`). */
export const PRESET_THEME_COUNT = 8;

/**
 * Wrapped arşivinde GÖRÜLEBİLEN yıl sayısı, bu yıl DAHİL: Free yalnız bu yılı,
 * Premium son 5 yılı görür; Premium Max'te sınır yok. Kayıttaki `wrapped_archive`
 * limitleri ve karşılaştırma metinleri buradan türer.
 */
export const WRAPPED_YEARS_VISIBLE = Object.freeze({ free: 1, premium: 5 });

const feature = (definition) =>
  Object.freeze({
    note: null,
    detail: null,
    // Yükseltme sayfasının (components/premium) özelliğe özel metni. Her girdi
    // için zorunlu — bkz. __tests__/premiumFeatures.test.js.
    upsell: null,
    enforcedBy: "client",
    ...definition,
  });

export const PREMIUM_FEATURES = Object.freeze({
  ai_messages: feature({
    id: "ai_messages",
    kind: AI_QUOTA,
    category: "ai",
    icon: "sparkles",
    enforcedBy: "server",
    limits: AI_PLAN_LIMITS,
    title: { tr: "CineMatch AI mesajı", en: "CineMatch AI messages" },
    upsell: {
      title: { tr: "Bugünkü AI mesaj hakkın bitti", en: "You're out of AI messages for today" },
    },
    detail: {
      tr: "Ruh haline ve izleme geçmişine göre film/dizi önerileri",
      en: "Movie and TV picks based on your mood and watch history",
    },
    phrase: {
      tr: (n) => `günde ${n} CineMatch AI mesajı gönderebilirsin`,
      en: (n) => `you can send ${n} CineMatch AI messages per day`,
    },
  }),
  identity_badge: feature({
    id: "identity_badge",
    kind: ACCESS,
    category: "social",
    icon: "diamond",
    enforcedBy: "server",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Profil kimlik rozeti", en: "Profile identity badge" },
    upsell: {
      title: { tr: "Profil rozeti Premium'da", en: "The profile badge is a Premium perk" },
      message: {
        tr: "Profilinde ve arkadaşlarının gördüğü sayfada parlayan bir kimlik rozeti kazan.",
        en: "Get a badge that shines on your profile and on the page your friends see.",
      },
    },
    detail: {
      tr: "Profilinde ve arkadaşlarının gördüğü profil sayfanda",
      en: "On your profile and on the profile your friends see",
    },
    planValue: {
      [PREMIUM_PLAN.PREMIUM]: { tr: "Epik rozet", en: "Epic badge" },
      [PREMIUM_PLAN.UNLIMITED]: { tr: "Efsanevi rozet", en: "Legendary badge" },
    },
  }),
  friends: feature({
    id: "friends",
    kind: COUNT,
    category: "social",
    icon: "person-add",
    limits: { free: 2, premium: 150, unlimited: UNLIMITED },
    title: { tr: "Arkadaş", en: "Friends" },
    upsell: {
      title: { tr: "Arkadaş listen doldu", en: "Your friends list is full" },
    },
    unit: { tr: "arkadaş", en: "friends" },
    note: {
      tr: "Gelen istekleri kabul etmek her zaman serbest",
      en: "Accepting incoming requests is always free",
    },
    phrase: {
      tr: (n) => `en fazla ${n} arkadaş ekleyebilirsin`,
      en: (n) => `you can add up to ${n} friends`,
    },
  }),
  chat_groups: feature({
    id: "chat_groups",
    kind: COUNT,
    category: "social",
    icon: "chatbubbles",
    limits: { free: 1, premium: 10, unlimited: UNLIMITED },
    title: { tr: "Kurduğun sohbet grubu", en: "Group chats you create" },
    upsell: {
      title: { tr: "Grup kurma limitin doldu", en: "You've reached your group limit" },
    },
    unit: { tr: "grup", en: "groups" },
    note: {
      tr: "Birebir mesajlaşmak ve gruplara katılmak serbest",
      en: "Direct messages and joining groups are free",
    },
    phrase: {
      tr: (n) => `en fazla ${n} sohbet grubu kurabilirsin`,
      en: (n) => `you can create up to ${n} group chat${n === 1 ? "" : "s"}`,
    },
  }),
  custom_lists: feature({
    id: "custom_lists",
    kind: COUNT,
    category: "library",
    icon: "list",
    limits: { free: 1, premium: 25, unlimited: UNLIMITED },
    title: { tr: "Özel liste", en: "Custom lists" },
    upsell: {
      title: { tr: "Liste limitin doldu", en: "You've reached your list limit" },
    },
    unit: { tr: "liste", en: "lists" },
    note: {
      tr: "İzleme listesi, izlenenler (film/dizi) ve favoriler her planda sınırsız",
      en: "Watchlist, watched (movies/shows) and favorites are unlimited on every plan",
    },
    phrase: {
      tr: (n) => `en fazla ${n} özel liste oluşturabilirsin`,
      en: (n) => `you can create up to ${n} custom list${n === 1 ? "" : "s"}`,
    },
  }),
  shared_lists: feature({
    id: "shared_lists",
    kind: COUNT,
    category: "library",
    icon: "people-circle",
    limits: { free: 2, premium: 10, unlimited: UNLIMITED },
    title: { tr: "Kurduğun ortak liste", en: "Shared lists you create" },
    upsell: {
      title: { tr: "Ortak liste limitin doldu", en: "You've reached your shared list limit" },
    },
    unit: { tr: "liste", en: "lists" },
    note: {
      tr: "Davet edildiğin listelere katılmak serbest",
      en: "Joining lists you're invited to is free",
    },
    phrase: {
      tr: (n) => `en fazla ${n} ortak liste kurabilirsin`,
      en: (n) => `you can create up to ${n} shared lists`,
    },
  }),
  notes: feature({
    id: "notes",
    kind: COUNT,
    category: "notes",
    icon: "document-text",
    limits: { free: 5, premium: 50, unlimited: UNLIMITED },
    title: { tr: "Not", en: "Notes" },
    upsell: {
      title: { tr: "Not limitin doldu", en: "You've reached your notes limit" },
    },
    unit: { tr: "not", en: "notes" },
    note: {
      tr: "Mevcut notlarını düzenlemek ve silmek her zaman serbest",
      en: "Editing and deleting your notes is always free",
    },
    phrase: {
      tr: (n) => `en fazla ${n} not tutabilirsin`,
      en: (n) => `you can keep up to ${n} notes`,
    },
  }),
  todos: feature({
    id: "todos",
    kind: COUNT,
    category: "notes",
    icon: "checkbox",
    limits: { free: 5, premium: 50, unlimited: UNLIMITED },
    title: { tr: "Yapılacaklar listesi", en: "To-do lists" },
    upsell: {
      title: { tr: "Yapılacaklar limitin doldu", en: "You've reached your to-do limit" },
    },
    unit: { tr: "liste", en: "lists" },
    note: {
      tr: "Bir listedeki madde sayısı sınırsız",
      en: "The number of items inside a list is unlimited",
    },
    phrase: {
      tr: (n) => `en fazla ${n} yapılacaklar listesi tutabilirsin`,
      en: (n) => `you can keep up to ${n} to-do lists`,
    },
  }),
  movie_notes: feature({
    id: "movie_notes",
    kind: COUNT,
    category: "notes",
    icon: "film",
    limits: { free: 20, premium: 200, unlimited: UNLIMITED },
    title: { tr: "Film notu", en: "Movie notes" },
    upsell: {
      title: { tr: "Film notu limitin doldu", en: "You've reached your movie notes limit" },
    },
    unit: { tr: "film", en: "movies" },
    note: {
      tr: "Her film için tek not; mevcut notu düzenlemek serbest",
      en: "One note per movie; editing an existing note is free",
    },
    phrase: {
      tr: (n) => `en fazla ${n} filme not yazabilirsin`,
      en: (n) => `you can write notes for up to ${n} movies`,
    },
  }),
  tv_notes: feature({
    id: "tv_notes",
    kind: COUNT,
    category: "notes",
    icon: "tv",
    limits: { free: 20, premium: 200, unlimited: UNLIMITED },
    title: { tr: "Dizi notu", en: "Show notes" },
    upsell: {
      title: { tr: "Dizi notu limitin doldu", en: "You've reached your show notes limit" },
    },
    unit: { tr: "dizi", en: "shows" },
    note: {
      tr: "Her dizi için tek not; mevcut notu düzenlemek serbest",
      en: "One note per show; editing an existing note is free",
    },
    phrase: {
      tr: (n) => `en fazla ${n} diziye not yazabilirsin`,
      en: (n) => `you can write notes for up to ${n} shows`,
    },
  }),
  games: feature({
    id: "games",
    kind: DAILY,
    category: "play",
    icon: "game-controller",
    limits: { free: 0, premium: 20, unlimited: UNLIMITED },
    title: { tr: "Sahne tahmin oyunu", en: "Scene guess games" },
    upsell: {
      // `title`: limit dolunca (Premium'da günlük hak bitti); `lockedTitle` +
      // `message`: planda hiç yokken (Free). Bkz. utils/premiumUpsellContent.js.
      title: { tr: "Bugünkü oyun hakkın bitti", en: "You're out of games for today" },
      lockedTitle: { tr: "Oyunlar Premium'da", en: "Games are a Premium perk" },
      message: {
        tr: "Sahne tahmin oyunlarını, liderlik tablosunu ve istatistiklerini Premium ile aç.",
        en: "Unlock the scene guess games, leaderboards and stats with Premium.",
      },
    },
    unit: { tr: "oyun", en: "games" },
    phrase: {
      tr: (n) => `günde ${n} oyun oynayabilirsin`,
      en: (n) => `you can play ${n} games per day`,
    },
  }),
  cineswipe_rooms: feature({
    id: "cineswipe_rooms",
    kind: DAILY,
    category: "play",
    icon: "people",
    limits: { free: 0, premium: 10, unlimited: UNLIMITED },
    title: { tr: "CineSwipe odası kurma", en: "CineSwipe rooms you host" },
    upsell: {
      title: { tr: "Bugünkü oda hakkın bitti", en: "You've hosted all of today's rooms" },
      lockedTitle: { tr: "Arkadaşınla CineSwipe Premium'da", en: "CineSwipe with friends is a Premium perk" },
      message: {
        tr: "Arkadaşınla ortak oda kur, kaydırdıkça eşleşin ve bu akşamki filmi birlikte seçin.",
        en: "Host a shared room with a friend, match as you swipe and pick tonight's movie together.",
      },
    },
    unit: { tr: "oda", en: "rooms" },
    phrase: {
      tr: (n) => `günde ${n} CineSwipe odası kurabilirsin`,
      en: (n) => `you can host ${n} CineSwipe rooms per day`,
    },
  }),
  cineswipe_swipes: feature({
    id: "cineswipe_swipes",
    kind: DAILY,
    category: "play",
    icon: "swap-horizontal",
    limits: { free: 0, premium: 300, unlimited: UNLIMITED },
    title: { tr: "Tek başına CineSwipe", en: "Solo CineSwipe" },
    upsell: {
      title: { tr: "Bugünkü kaydırma hakkın bitti", en: "You're out of swipes for today" },
      lockedTitle: { tr: "CineSwipe Premium'da", en: "CineSwipe is a Premium perk" },
      message: {
        tr: "Kartları kaydırarak sana uygun film ve dizileri keşfet.",
        en: "Swipe through cards to discover movies and shows you'll like.",
      },
    },
    unit: { tr: "kart", en: "cards" },
    phrase: {
      tr: (n) => `günde ${n} kart kaydırabilirsin`,
      en: (n) => `you can swipe ${n} cards per day`,
    },
  }),
  tournament_vote: feature({
    id: "tournament_vote",
    kind: ACCESS,
    category: "play",
    icon: "trophy",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Turnuvada oy kullanma", en: "Voting in the tournament" },
    upsell: {
      title: { tr: "Turnuvada oy Premium'da", en: "Tournament voting is a Premium perk" },
      message: {
        tr: "Turnuvayı herkes izleyebilir; aday gösterme ve maç oyları Premium'a özel.",
        en: "Anyone can follow the tournament; nominating and voting on matches is for Premium.",
      },
    },
    freeValue: { tr: "Yalnız izleyici", en: "Spectator only" },
    paidValue: { tr: "Oy kullanabilir", en: "Can vote" },
  }),
  custom_themes: feature({
    id: "custom_themes",
    kind: ACCESS,
    category: "personal",
    icon: "color-palette",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Kendi temanı oluştur", en: "Create your own themes" },
    upsell: {
      title: { tr: "Kendi temanı tasarla", en: "Design your own theme" },
      message: {
        tr: "Renkleri sen seç, temanı kaydet ve istediğin an değiştir.",
        en: "Pick your own colors, save your theme and switch whenever you like.",
      },
    },
    freeValue: {
      tr: `${PRESET_THEME_COUNT} hazır tema`,
      en: `${PRESET_THEME_COUNT} preset themes`,
    },
    paidValue: { tr: "Sınırsız özel tema", en: "Unlimited custom themes" },
  }),
  font_catalog: feature({
    id: "font_catalog",
    kind: ACCESS,
    category: "personal",
    icon: "text",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Yazı tipi kataloğu", en: "Font catalog" },
    upsell: {
      title: { tr: `${FONT_CATALOG_SIZE} yazı tipinin kilidini aç`, en: `Unlock all ${FONT_CATALOG_SIZE} fonts` },
      message: {
        tr: "Başlık, gövde ve rakamlar için istediğin yazı tipini seç.",
        en: "Pick the font you like for headings, body text and numbers.",
      },
    },
    freeValue: {
      tr: `${FREE_FONT_PRESET_IDS.length} yazı tipi`,
      en: `${FREE_FONT_PRESET_IDS.length} fonts`,
    },
    paidValue: {
      tr: `${FONT_CATALOG_SIZE} yazı tipi`,
      en: `${FONT_CATALOG_SIZE} fonts`,
    },
  }),
  app_icon: feature({
    id: "app_icon",
    kind: ACCESS,
    category: "personal",
    icon: "apps",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Uygulama simgesi", en: "App icon" },
    upsell: {
      title: { tr: "Simgeyi değiştir", en: "Change your app icon" },
      message: {
        tr: "Ana ekranında görünecek Seelogd simgesini kendin seç.",
        en: "Pick the Seelogd icon that shows on your home screen.",
      },
    },
    freeValue: { tr: "Varsayılan simge", en: "Default icon" },
    paidValue: { tr: "Simge seçici", en: "Icon picker" },
  }),
  snow_effect: feature({
    id: "snow_effect",
    kind: ACCESS,
    category: "personal",
    icon: "snow",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Kar animasyonu", en: "Snow animation" },
    upsell: {
      title: { tr: "Kar yağışı Premium'da", en: "Snowfall is a Premium perk" },
      message: {
        tr: "Ekranlarının üzerine hafif hafif kar yağdır.",
        en: "Let a gentle snowfall drift across your screens.",
      },
    },
    freeValue: { tr: "Kapalı", en: "Off" },
    paidValue: { tr: "Kar yağışı", en: "Snowfall" },
  }),
  icon_background: feature({
    id: "icon_background",
    kind: ACCESS,
    category: "personal",
    icon: "image",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "İkon arka planı", en: "Icon background" },
    upsell: {
      title: { tr: "İkon arka planı Premium'da", en: "Icon background is a Premium perk" },
      message: {
        tr: "Ekran arka planlarına desen ekle; saydamlığını ve düzenini ayarla.",
        en: "Add a pattern behind your screens and tune its opacity and layout.",
      },
    },
    freeValue: { tr: "Kapalı", en: "Off" },
    paidValue: { tr: "Desenli arka plan", en: "Patterned background" },
  }),
  pet_companion: feature({
    id: "pet_companion",
    kind: ACCESS,
    category: "personal",
    icon: "paw",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Pet / Dost", en: "Pet companion" },
    upsell: {
      title: { tr: "Pet Premium'da", en: "The pet companion is a Premium perk" },
      message: {
        tr: "Ekranında dolaşan bir dost edin; dokununca durumu değişir, basılı tutunca AI açılır.",
        en: "Get a companion that roams your screen; tap it to change its mood, hold it to open the AI.",
      },
    },
    freeValue: { tr: "Kapalı", en: "Off" },
    paidValue: { tr: "Ekranda pet", en: "On-screen pet" },
  }),
  streaming_alerts: feature({
    id: "streaming_alerts",
    kind: COUNT,
    category: "alerts",
    icon: "notifications",
    enforcedBy: "server",
    limits: { free: 10, premium: 100, unlimited: 100 },
    title: { tr: "Platform bildirimi", en: "Streaming alerts" },
    upsell: {
      title: { tr: "Takip limitin doldu", en: "Tracking limit reached" },
    },
    unit: { tr: "başlık", en: "titles" },
    detail: {
      tr: "İzleme listene son eklediğin yapımlar bir platforma gelince haber verir",
      en: "Tells you when your latest watchlist titles start streaming",
    },
    phrase: {
      tr: (n) => `izleme listene son eklediğin ${n} başlık takip edilir`,
      en: (n) => `your ${n} most recent watchlist titles are tracked`,
    },
  }),
  movie_reminders: feature({
    id: "movie_reminders",
    kind: COUNT,
    category: "alerts",
    icon: "film",
    limits: { free: 10, premium: 50, unlimited: UNLIMITED },
    title: { tr: "Film hatırlatması", en: "Movie reminders" },
    upsell: {
      title: { tr: "Film hatırlatma limitin doldu", en: "You've reached your movie reminder limit" },
    },
    unit: { tr: "film", en: "movies" },
    note: {
      tr: "Çıkışı geçmiş filmler sayılmaz",
      en: "Movies that have already released don't count",
    },
    phrase: {
      tr: (n) => `aynı anda en fazla ${n} filmin çıkışı için hatırlatma kurabilirsin`,
      en: (n) => `you can have reminders for up to ${n} upcoming movies at once`,
    },
  }),
  tv_reminders: feature({
    id: "tv_reminders",
    kind: COUNT,
    category: "alerts",
    icon: "tv",
    limits: { free: 20, premium: 100, unlimited: UNLIMITED },
    title: { tr: "Dizi hatırlatması", en: "Show reminders" },
    upsell: {
      title: { tr: "Dizi hatırlatma limitin doldu", en: "You've reached your show reminder limit" },
    },
    unit: { tr: "dizi", en: "shows" },
    note: {
      tr: "Bir dizinin tüm bölümleri tek hak sayılır; yayınlanmış bölümler sayılmaz",
      en: "All episodes of one show use a single slot; aired episodes don't count",
    },
    phrase: {
      tr: (n) => `aynı anda en fazla ${n} dizi için bölüm hatırlatması kurabilirsin`,
      en: (n) => `you can have episode reminders for up to ${n} shows at once`,
    },
  }),
  wrapped_archive: feature({
    id: "wrapped_archive",
    kind: COUNT,
    // PENCERE özelliği: sayı harcanan bir miktar değil, geriye doğru görülebilen
    // yıl sayısı (bu yıl dahil). Bu yüzden kullanım göstergesi/sayaç yok; kapı
    // `canViewWrappedYear` ile "yıl kaç yıl geride?" diye sorar (bkz. aşağıda).
    window: true,
    category: "alerts",
    icon: "albums",
    limits: {
      free: WRAPPED_YEARS_VISIBLE.free,
      premium: WRAPPED_YEARS_VISIBLE.premium,
      unlimited: UNLIMITED,
    },
    title: { tr: "Wrapped arşivi", en: "Wrapped archive" },
    unit: { tr: "yıl", en: "years" },
    upsell: {
      title: { tr: "Geçmiş yıllar Premium'da", en: "Past years are a Premium perk" },
      // Premium'un penceresi dolunca (5 yıldan eski) hedef plan Max olur.
      titleByTarget: {
        [PREMIUM_PLAN.UNLIMITED]: {
          tr: "Tüm yıllar Premium Max'te",
          en: "Every year is a Premium Max perk",
        },
      },
    },
    planValue: {
      [PREMIUM_PLAN.FREE]: { tr: "Yalnız bu yıl", en: "This year only" },
      [PREMIUM_PLAN.PREMIUM]: {
        tr: `Son ${WRAPPED_YEARS_VISIBLE.premium} yıl`,
        en: `Last ${WRAPPED_YEARS_VISIBLE.premium} years`,
      },
      [PREMIUM_PLAN.UNLIMITED]: { tr: "Tüm yıllar", en: "Every year" },
    },
    phrase: {
      tr: (n) =>
        n === 1
          ? "yalnızca bu yılın Wrapped özetini görebilirsin"
          : Number.isFinite(n)
            ? `son ${n} yılın Wrapped özetlerini görebilirsin`
            : "tüm yılların Wrapped özetlerini görebilirsin",
      en: (n) =>
        n === 1
          ? "you can view this year's Wrapped recap only"
          : Number.isFinite(n)
            ? `you can view your Wrapped recaps from the last ${n} years`
            : "you can view your Wrapped recaps from every year",
    },
  }),
});

export const FEATURE_IDS = Object.freeze(Object.keys(PREMIUM_FEATURES));

const pick = (copy, language) =>
  (language === "tr" ? copy?.tr : copy?.en) ?? copy?.en ?? copy?.tr ?? "";

/** Sayısal karşılaştırma için limit (AI kotasında günlük tavan). */
const numericLimit = (definition, limit) =>
  definition.kind === AI_QUOTA ? limit.daily : limit;

export function getFeature(featureId) {
  return PREMIUM_FEATURES[featureId] || null;
}

/**
 * Plan için limit:
 *   ACCESS   → boolean
 *   COUNT / DAILY → sayı (sınırsızsa Infinity)
 *   AI_QUOTA → { daily, monthly }
 * Bilinmeyen özellikte en kısıtlayıcı değer döner (kapı açık kalmasın).
 */
export function getFeatureLimit(featureId, plan) {
  const definition = getFeature(featureId);
  const normalized = normalizePlan(plan);
  if (!definition) return 0;
  if (definition.kind === ACCESS) {
    return planRank(normalized) >= planRank(definition.minPlan);
  }
  return definition.limits[normalized];
}

export function isUnlimitedFor(featureId, plan) {
  const limit = getFeatureLimit(featureId, plan);
  return typeof limit === "number" && !Number.isFinite(limit);
}

/**
 * Özellik bu planda tamamen KAPALI mı? ACCESS'te erişim yok; COUNT/DAILY/AI'da
 * limit 0 (ör. Free'de oyun). "Limit doldu" ile "bu plana dahil değil"i
 * ayırmak için: ilkinde sayaç ve yenilenme anlatılır, ikincisinde yalnız hangi
 * planın açtığı.
 */
export function isLockedFor(featureId, plan) {
  const definition = getFeature(featureId);
  if (!definition) return true;
  const limit = getFeatureLimit(featureId, plan);
  if (definition.kind === ACCESS) return !limit;
  return !(numericLimit(definition, limit) > 0);
}

/**
 * Bir sonraki kullanım serbest mi? `used`, COUNT için sahip olunan adet,
 * DAILY için bugün harcanan hak. ACCESS'te yok sayılır.
 */
export function canUseFeature(featureId, plan, used = 0) {
  const definition = getFeature(featureId);
  if (!definition) return false;
  const limit = getFeatureLimit(featureId, plan);
  if (definition.kind === ACCESS) return limit === true;
  if (definition.kind === AI_QUOTA) {
    return Math.max(0, Number(used) || 0) < limit.daily;
  }
  return Math.max(0, Number(used) || 0) < limit;
}

/** Kalan hak (sınırsızsa Infinity). ACCESS için erişim varsa Infinity, yoksa 0. */
export function remainingUses(featureId, plan, used = 0) {
  const definition = getFeature(featureId);
  if (!definition) return 0;
  const limit = getFeatureLimit(featureId, plan);
  if (definition.kind === ACCESS) return limit ? UNLIMITED : 0;
  const cap = definition.kind === AI_QUOTA ? limit.daily : limit;
  return Math.max(0, cap - Math.max(0, Number(used) || 0));
}

/** Bu özelliğin limitini ARTIRAN ilk üst plan; yoksa null. */
export function nextPlanFor(featureId, plan) {
  const definition = getFeature(featureId);
  if (!definition) return null;
  const current = getFeatureLimit(featureId, plan);
  for (const candidate of PLAN_ORDER.slice(planRank(plan) + 1)) {
    const next = getFeatureLimit(featureId, candidate);
    if (definition.kind === ACCESS) {
      if (next && !current) return candidate;
    } else if (numericLimit(definition, next) > numericLimit(definition, current)) {
      return candidate;
    }
  }
  return null;
}

export function isFontPresetFree(presetId) {
  return FREE_FONT_PRESET_IDS.includes(presetId);
}

/** Yazı tipi bu planda seçilebilir mi? */
export function canUseFontPreset(presetId, plan) {
  return isFontPresetFree(presetId) || getFeatureLimit("font_catalog", plan);
}

/**
 * Bu plan bu Wrapped yılını görebilir mi? Kapı bir pencere: yıl bu yıldan kaç yıl
 * geride ise o sayı `used` olarak sorulur, limit (görülebilen yıl sayısı, bu yıl
 * dahil) altında kalıyorsa açıktır. Free'de limit 1 → yalnız bu yıl; Premium'da 5
 * → bu yıl + 4 yıl geri; Max'te sınırsız. Gelecek yıl (saat/veri kayması) açıktır.
 */
export function canViewWrappedYear(year, plan, now = new Date()) {
  const numeric = Number(year);
  if (!Number.isFinite(numeric)) return false;
  return canUseFeature("wrapped_archive", plan, now.getFullYear() - numeric);
}

/**
 * Verilen yıllar (yeniden eskiye) içinden planın görebildiği İLK yıl; yoksa null.
 * Hub kartı ve Wrapped ekranı "en yeni yıl" derken kilitli bir yılı öne
 * çıkarmasın diye buradan seçer.
 */
export function pickViewableWrappedYear(years, plan, now = new Date()) {
  if (!Array.isArray(years)) return null;
  return years.find((year) => canViewWrappedYear(year, plan, now)) ?? null;
}

/**
 * Bu Wrapped yılını açan EN DÜŞÜK plan; hiçbiri açmıyorsa null. Kilitli satırda
 * "Premium ile aç" mı "Premium Max ile aç" mı denmesi gerektiğini söyler.
 */
export function requiredPlanForWrappedYear(year, now = new Date()) {
  return PLAN_ORDER.find((plan) => canViewWrappedYear(year, plan, now)) ?? null;
}

const unlimitedWord = (language) => (language === "tr" ? "Sınırsız" : "Unlimited");

/**
 * Özelliğin birim adı ("liste", "lists"). Kayıttaki İngilizce birimler çoğul
 * yazılı; tek adette ("1 list", "1 group") tekile iner. Türkçe adetle değişmez.
 */
export function unitLabel(definition, count, language = "en") {
  const text = pick(definition?.unit, language);
  if (language !== "tr" && count === 1) return text.replace(/s$/, "");
  return text;
}

/**
 * Karşılaştırma tablosundaki hücre metni: "5 liste", "20 oyun/gün",
 * "Sınırsız", "Epik rozet", "—".
 */
export function formatFeatureValue(featureId, plan, language = "en") {
  const definition = getFeature(featureId);
  if (!definition) return "—";
  const normalized = normalizePlan(plan);
  const limit = getFeatureLimit(featureId, normalized);
  const tr = language === "tr";

  if (definition.kind === AI_QUOTA) {
    return tr
      ? `${limit.daily}/gün · ${limit.monthly}/ay`
      : `${limit.daily}/day · ${limit.monthly}/mo`;
  }
  if (definition.kind === ACCESS) {
    if (!limit) return definition.freeValue ? pick(definition.freeValue, language) : "—";
    if (definition.planValue?.[normalized]) {
      return pick(definition.planValue[normalized], language);
    }
    return definition.paidValue ? pick(definition.paidValue, language) : "✓";
  }
  // Plana özel hazır etiket varsa ("Son 5 yıl") üretilen "5 yıl"ın önüne geçer.
  if (definition.planValue?.[normalized]) {
    return pick(definition.planValue[normalized], language);
  }
  if (!Number.isFinite(limit)) return unlimitedWord(language);
  // Limit 0 = özellik bu planda kapalı ("0 oyun/gün" yazmak yanıltıcı olur).
  if (limit <= 0) return definition.freeValue ? pick(definition.freeValue, language) : "—";
  const unit = unitLabel(definition, limit, language);
  if (definition.kind === DAILY) {
    return tr ? `${limit} ${unit}/gün` : `${limit} ${unit}/day`;
  }
  return `${limit} ${unit}`;
}

/** "Premium ile 25, Premium Max ile sınırsız." — üst planların bu özellikteki değeri. */
function upgradeSentence(featureId, plan, language) {
  const definition = getFeature(featureId);
  if (!definition || definition.kind === ACCESS) return "";
  const tr = language === "tr";
  const current = numericLimit(definition, getFeatureLimit(featureId, plan));
  const parts = [];
  for (const candidate of PLAN_ORDER.slice(planRank(plan) + 1)) {
    const limit = numericLimit(definition, getFeatureLimit(featureId, candidate));
    if (!(limit > current)) continue;
    // Pencere özelliğinde çıplak "5" anlamsız kalır: "son 5 yıl" / "tüm yıllar".
    const value = definition.window
      ? formatFeatureValue(featureId, candidate, language).toLocaleLowerCase(tr ? "tr" : "en")
      : Number.isFinite(limit)
        ? String(limit)
        : tr
          ? "sınırsız"
          : "unlimited";
    const name = getPremiumPlanDisplayName(candidate);
    parts.push(tr ? `${name} ile ${value}` : `with ${name}: ${value}`);
  }
  if (!parts.length) return "";
  const sentence = `${parts.join(", ")}.`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/**
 * "Free planında en fazla 1 özel liste oluşturabilirsin." — planın bu özellikteki
 * mevcut sınırını tek cümleyle söyler. ACCESS özelliklerde ve cümle kalıbı
 * olmayanlarda boş döner. Hem limit uyarısı hem yükseltme sayfası kullanır.
 */
export function describeCurrentLimit(featureId, plan, language = "en") {
  const definition = getFeature(featureId);
  if (!definition || definition.kind === ACCESS) return "";
  // Kapalı özellikte "günde 0 oyun oynayabilirsin" demek yerine cümle yok.
  if (isLockedFor(featureId, plan)) return "";
  const tr = language === "tr";
  const normalized = normalizePlan(plan);
  const planName = getPremiumPlanDisplayName(normalized);
  const cap = numericLimit(definition, getFeatureLimit(featureId, normalized));
  const phrase = definition.phrase ? pick(definition.phrase, language) : null;
  if (typeof phrase !== "function") return "";
  return tr
    ? `${planName} planında ${phrase(cap)}.`
    : `On ${planName}, ${phrase(cap)}.`;
}

/**
 * Limit dolduğunda gösterilecek uyarı metni.
 * @returns {{ title: string, message: string, canUpgrade: boolean }}
 */
export function buildLimitCopy(featureId, plan, language = "en") {
  const definition = getFeature(featureId);
  const tr = language === "tr";
  const normalized = normalizePlan(plan);
  const canUpgrade = Boolean(nextPlanFor(featureId, normalized));

  if (!definition) {
    return {
      title: tr ? "Premium özelliği" : "Premium feature",
      message: "",
      canUpgrade: false,
    };
  }

  // ACCESS ya da bu planda kapalı (limit 0) bir sayılı özellik.
  if (definition.kind === ACCESS || isLockedFor(featureId, normalized)) {
    const title = pick(definition.title, language);
    return {
      title: tr ? "Premium özelliği" : "Premium feature",
      message: tr
        ? `${title} Premium ve Premium Max planlarında açık.`
        : `${title} is included in Premium and Premium Max.`,
      canUpgrade,
    };
  }

  const base = describeCurrentLimit(featureId, normalized, language);
  const upgrade = canUpgrade ? upgradeSentence(featureId, normalized, language) : "";
  const renew =
    definition.kind === DAILY
      ? tr
        ? "Hakların yarın yenilenir."
        : "Your limit resets tomorrow."
      : "";

  return {
    title:
      definition.kind === DAILY
        ? tr
          ? "Bugünkü hakkın doldu"
          : "Today's limit reached"
        : tr
          ? "Limite ulaştın"
          : "Limit reached",
    message: [base, upgrade, renew].filter(Boolean).join(" "),
    canUpgrade,
  };
}

/**
 * Ödeme ekranı karşılaştırma tablosu: kategori → satırlar → plan değerleri.
 * Sıra FEATURE_CATEGORIES ve PREMIUM_FEATURES tanım sırasını izler.
 */
export function getComparisonSections(language = "en") {
  return FEATURE_CATEGORIES.map((category) => ({
    id: category.id,
    icon: category.icon,
    color: category.color,
    title: pick(category.title, language),
    rows: FEATURE_IDS.filter(
      (id) => PREMIUM_FEATURES[id].category === category.id,
    ).map((id) => {
      const definition = PREMIUM_FEATURES[id];
      return {
        id,
        icon: definition.icon,
        title: pick(definition.title, language),
        detail: definition.detail ? pick(definition.detail, language) : null,
        note: definition.note ? pick(definition.note, language) : null,
        values: Object.fromEntries(
          PLAN_ORDER.map((plan) => [plan, formatFeatureValue(id, plan, language)]),
        ),
      };
    }),
  })).filter((section) => section.rows.length > 0);
}
