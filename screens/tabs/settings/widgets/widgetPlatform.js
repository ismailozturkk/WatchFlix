// screens/tabs/settings/widgets/widgetPlatform.js
//
// Widget ayar ekranının SAF (React Native'siz) platform bilgisi.
//
// Android ve iOS widget'ları aynı tercih JSON'unu okuyor ama aynı şeyi ÇİZMİYOR;
// önizleme ve kontroller bu farkı yansıtmalı, yoksa kullanıcı iOS'ta hiçbir şey
// yapmayan bir düğmeyle ya da Android'e özgü bir düzenle karşılaşır. Fark tablosu
// burada, çünkü jest yalnız saf modülleri çalıştırır (bkz. jest.config.js) ve bu
// sayılar native koddaki sabitlerle birebir eşleşmek zorunda.
//
// Kaynaklar:
//   • Android: native/android-widgets/res/xml/*_widget_info.xml (hücre oranları)
//   • iOS: targets/reminder-widget/{shared,index,lists-widget,stats-widget}.swift

export const WIDGET_IDS = Object.freeze(["reminders", "lists", "stats"]);

// Android ana ekran hücre oranı (targetCellWidth × targetCellHeight).
// Yaklaşanlar ve Listeler 4×3, kompakt İstatistikler 4×2.
export const ANDROID_ASPECT = Object.freeze({
  reminders: 1.4,
  lists: 1.35,
  stats: 2.05,
});

// Android'de widget'ın varsayılan kapladığı ızgara (targetCellWidth × targetCellHeight);
// kullanıcı ana ekranda yeniden boyutlandırabilir.
export const ANDROID_CELLS = Object.freeze({
  reminders: "4×3",
  lists: "4×3",
  stats: "4×2",
});

// WidgetKit aileleri, 6,1" iPhone'da (393 pt) — iPhone 15/16 ölçüleri.
export const IOS_FAMILY_SIZE = Object.freeze({
  medium: Object.freeze({ width: 338, height: 158 }),
  large: Object.freeze({ width: 338, height: 354 }),
});

// supportedFamilies: üç widget da orta + büyük (İstatistikler eskiden yalnız büyüktü).
export const IOS_FAMILIES = Object.freeze({
  reminders: Object.freeze(["medium", "large"]),
  lists: Object.freeze(["medium", "large"]),
  stats: Object.freeze(["medium", "large"]),
});

export const IOS_DEFAULT_FAMILY = "large";

/** İstenen aile o widget'ta yoksa desteklenen ilkine döner. */
export const iosFamilyFor = (widgetId, requested) => {
  const families = IOS_FAMILIES[widgetId] || IOS_FAMILIES.reminders;
  return families.includes(requested) ? requested : families[families.length - 1];
};

// ─── iOS satır bütçesi (Swift ikizi) ─────────────────────────────────────────
//
// Eskiden Swift satır sayısını aileye göre SABİT seçiyordu (orta 3, büyük 6…); orta
// boy widget'ın içeriği buna yetmiyor, SwiftUI taşan içeriği ortalayıp iki ucundan
// kırpıyor ve BAŞLIK görünmez oluyordu. Artık satır sayısı widget'ın GERÇEK
// yüksekliğinden hesaplanır. Aşağıdaki sayılar targets/reminder-widget/*.swift
// içindeki `ReminderMetrics` / `ListMetrics` / `fitRows` / `StatsMediumBudget` ile
// BİREBİR aynı olmalı (widgetSettingsModel.test.js Swift dosyalarını okuyup kilitler).

// iOS 17+ widget'a sistem içerik kenar boşluğunu kendisi verir (≈16 pt); Swift'te
// elle dolgu yalnız eski sürümlerde. Önizleme iOS 17+ davranışını çizer.
export const IOS_SYSTEM_MARGIN = 16;

/** Çerçeve yüksekliğinden içeriğin kullanabileceği yükseklik. */
export const iosContentHeight = (frameHeight) =>
  Math.max(0, frameHeight - IOS_SYSTEM_MARGIN * 2);

/** ReminderMetrics.make(large:compact:) — `header` = badge + gap [+ 1 + gap]. */
export const iosReminderMetrics = ({ family, compact }) => {
  const large = family === "large";
  const base = large
    ? compact
      ? { badge: 22, divider: true, icon: 22, padV: 4, gap: 5, title: 11, meta: 8, textBlock: 24 }
      : { badge: 26, divider: true, icon: 26, padV: 6, gap: 8, title: 12, meta: 9, textBlock: 26 }
    : compact
      ? { badge: 20, divider: false, icon: 20, padV: 3, gap: 4, title: 11, meta: 8, textBlock: 24 }
      : { badge: 24, divider: false, icon: 24, padV: 5, gap: 6, title: 12, meta: 9, textBlock: 26 };
  return {
    ...base,
    header: base.badge + base.gap + (base.divider ? 1 + base.gap : 0),
  };
};

/** ReminderMetrics.row(showIcon:) */
export const iosReminderRowHeight = (metrics, showIcon) =>
  Math.max(showIcon ? metrics.icon : 0, metrics.textBlock) + metrics.padV * 2;

/** ListMetrics.make(large:compact:) — `header` = badge + gap, `row` = max(circle, line) + 2·padV. */
export const iosListMetrics = ({ family, compact }) => {
  const large = family === "large";
  const base = large
    ? compact
      ? { badge: 20, circle: 20, padV: 5, gap: 5, font: 11, line: 14 }
      : { badge: 24, circle: 22, padV: 7, gap: 7, font: 12, line: 15 }
    : compact
      ? { badge: 18, circle: 16, padV: 3, gap: 4, font: 11, line: 14 }
      : { badge: 22, circle: 20, padV: 4, gap: 5, font: 12, line: 15 };
  return {
    ...base,
    header: base.badge + base.gap,
    row: Math.max(base.circle, base.line) + base.padV * 2,
  };
};

/**
 * `fitRows` (shared.swift) — `available` yüksekliğe (başlık dahil) kaç satır sığar.
 * n satır = n·row + (n−1)·gap ≤ body. Satırlar "+N daha" etiketinden önceliklidir;
 * etiket ancak satırlardan arta kalan yere sığarsa konur. En az 1 satır çizilir.
 */
export const fitRows = ({ available, header, row, gap, label, total, limit }) => {
  const wanted = Math.max(0, Math.min(total, limit));
  if (wanted === 0) return { rows: 0, overflow: false };
  const body = available - header;
  const capacity = body >= row ? Math.floor((body + gap) / (row + gap)) : 0;
  const rows = Math.max(1, Math.min(wanted, capacity));
  const used = rows * row + (rows - 1) * gap;
  return { rows, overflow: total > rows && body - used >= gap + label };
};

// StatsScale.large / StatsScale.medium (stats-widget.swift): punto ve dolgu ölçekleri.
export const IOS_STATS_SCALE = Object.freeze({
  large: Object.freeze({
    countValue: 26,
    countLabel: 10,
    unitValue: 18,
    unitLabel: 9,
    durationValue: 12,
    durationLabel: 9,
    durationIcon: 13,
    panelPadV: 8,
  }),
  medium: Object.freeze({
    countValue: 17,
    countLabel: 8,
    unitValue: 13,
    unitLabel: 7,
    durationValue: 11,
    durationLabel: 8,
    durationIcon: 11,
    panelPadV: 4,
  }),
});

// StatsMediumBudget (stats-widget.swift): orta boyda parçaların yükseklik bütçesi.
export const IOS_STATS_MEDIUM = Object.freeze({
  title: 25,
  bothCards: 83,
  wideCard: 47,
  strip: 31,
  gap: 5,
});

/**
 * İstatistikler orta boy planı (Swift `mediumLayout`): şerit en son feda edilir;
 * kartlar + başlık yerleşince kalan yere sığıyorsa konur.
 */
export const iosStatsMediumPlan = ({ height, showTitle, showMovies, showTv, showDuration }) => {
  const budget = IOS_STATS_MEDIUM;
  const bothCards = showMovies && showTv;
  const anyCard = showMovies || showTv;
  const titleBlock = showTitle ? budget.title : 0;
  const cardsBlock = bothCards ? budget.bothCards : anyCard ? budget.wideCard : 0;
  const stripBlock = (anyCard ? budget.gap : 0) + budget.strip;
  return {
    bothCards,
    anyCard,
    showStrip: showDuration && titleBlock + cardsBlock + stripBlock <= height,
  };
};

/**
 * Önizleme çerçevesinin en/boy oranı (genişlik / yükseklik).
 * @param {"ios"|"android"} platform
 * @param {string} widgetId
 * @param {"medium"|"large"} [family] yalnız iOS
 */
export const widgetAspect = (platform, widgetId, family) => {
  if (platform === "ios") {
    const size = IOS_FAMILY_SIZE[iosFamilyFor(widgetId, family)];
    return size.width / size.height;
  }
  return ANDROID_ASPECT[widgetId] || ANDROID_ASPECT.reminders;
};

/**
 * Önizlemenin doğal genişliği. iOS widget'ı cihazda sabit pt genişliğindedir;
 * sahne bundan darsa sahneye sığar, genişse büyütülmez (gerçek oran bozulmasın).
 * Android widget'ı hücre sayısına göre yayılır — sahne genişliğini alır.
 */
export const widgetNaturalWidth = (platform, widgetId, family, available) => {
  if (platform === "ios") {
    const size = IOS_FAMILY_SIZE[iosFamilyFor(widgetId, family)];
    return Math.min(available, size.width);
  }
  return available;
};

/** Doğal yükseklik `maxHeight`a sığmıyorsa orantılı küçültme (alt sınırlı). */
export const fitScale = (naturalHeight, maxHeight, minScale = 0.6) => {
  if (!(naturalHeight > 0) || naturalHeight <= maxHeight) return 1;
  return Math.max(minScale, maxHeight / naturalHeight);
};

/** Hangi kontrol hangi platformda gerçekten bir şey yapıyor. */
export const widgetCapabilities = (platform) => {
  const ios = platform === "ios";
  return {
    // iOS'ta satır sayısını widget boyutu belirler; "kaç öğe" ayarı anlamsız.
    reminderLimit: !ios,
    // iOS'ta poster yok: aynı düğme tür rozetini (F/D) açıp kapatır.
    reminderArtwork: ios ? "badge" : "poster",
    // iOS Listelerim: poster ızgarası ve ‹ › liste seçici yok.
    listsPosterLimit: !ios,
    listsNavigation: !ios,
    // iOS'ta widget ailesi (orta/büyük) önizlemede seçilebilir.
    sizePicker: ios,
  };
};

// Önizleme sahnesinin duvar kâğıtları — widget'ı koyu/açık/canlı zeminde sınamak için.
export const WALLPAPERS = Object.freeze([
  Object.freeze({ id: "night", colors: ["#0B1020", "#232B52"], dark: true }),
  Object.freeze({ id: "sunrise", colors: ["#FFB88C", "#8E7CFF"], dark: false }),
  Object.freeze({ id: "paper", colors: ["#EEF1F8", "#FBF4FF"], dark: false }),
]);
