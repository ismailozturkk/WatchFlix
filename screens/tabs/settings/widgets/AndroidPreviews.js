// screens/tabs/settings/widgets/AndroidPreviews.js
//
// Android widget'larının ana ekrandaki BİREBİR önizlemesi (Yaklaşanlar, Listelerim,
// İstatistikler). Eskiden WidgetSettingsScreen.js içindeydi; iOS önizlemesi
// (IosPreviews.js) ve sahne (WidgetStage.js) ayrı dosyalara bölününce buraya taşındı.
// Ölçüler ve kurallar değişmedi: native kaynaklardaki dp/sp değerleri 1:1.

import React, { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { useLanguage } from "@context/LanguageContext";
import useAppLogo from "@hooks/useAppLogo";
import { alpha } from "../../../../theme/colors";
import { ANDROID_ASPECT } from "./widgetPlatform";
import { buildReminderSamples } from "./widgetSamples";

const POSTERS = [
  "https://image.tmdb.org/t/p/w342/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg",
  "https://image.tmdb.org/t/p/w342/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
  "https://image.tmdb.org/t/p/w342/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg",
  "https://image.tmdb.org/t/p/w342/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
  "https://image.tmdb.org/t/p/w342/bQLrHIRNEkE3PdIWQrZHynQZazu.jpg",
  "https://image.tmdb.org/t/p/w342/2IWouZK4gkgHhJa3oyYuSWfSqbG.jpg",
  "https://image.tmdb.org/t/p/w342/7WUHnWGx5OO145IRxPDUkQSh4C7.jpg",
  "https://image.tmdb.org/t/p/w342/49WJfeN0moxb9IPfGn8AIqMGskD.jpg",
  "https://image.tmdb.org/t/p/w342/6LWy0jvMpmjoS9fojNgHIKoWL05.jpg",
];

// GridView horizontalSpacing/verticalSpacing = 6dp (lists_widget.xml).
const GRID_GAP = 6;

// Widget metinleri: dize kaynağı GERÇEK widget ile aynı olmalı.
// • Sabit metinleri (başlık, sayaç, boş durum, tip etiketi) provider'lar dile
//   göre kendisi yazar — burada da öyle yazılır.
// • İstatistik etiketleri payload'dan gelir (services/statsWidgetService.js →
//   ProfileStatsContext → t.profileScreen.*) — aynı anahtarlar kullanılır ki
//   iki dilde de birebir aynı kelime çıksın. Bu anahtarların başında boşluk
//   var (" Yıl"), o yüzden trim edilir.
const etiket = (value, fallback) => String(value || fallback).trim();

const chunk = (list, size) =>
  list.reduce((acc, item, index) => {
    if (index % size === 0) acc.push([]);
    acc[acc.length - 1].push(item);
    return acc;
  }, []);

// ─── Gerçek widget ölçüleri ──────────────────────────────────────────────────
//
// Aşağıdaki bileşenler ana ekrandaki widget'ın BİREBİR kopyasıdır: sayılar
// native kaynaklardan alınır (Android dp'si RN biriminde 1:1 karşılanır), uydurma
// değer yok. Kaynaklar:
//   • native/android-widgets/res/layout/reminder_widget.xml (+ _item)
//   • native/android-widgets/res/layout/lists_widget.xml (+ _item)
//   • native/android-widgets/res/drawable/*.xml            (köşe yarıçapı/dolgu)
//   • .../widget/ReminderWidgetProvider.kt + ReminderWidgetRemoteViewsService.kt
//   • .../widget/ListsWidgetProvider.kt        (çalışma anı renkleri/görünürlük)
// Renkler tema paletinden ÇALIŞMA ANINDA basılır (WidgetThemeViews.tintBackground):
// kök = background, öne çıkan satır = surface, diğer satır = surfaceAlt.

function Poster({ uri, style, contain }) {
  return (
    <View style={[styles.posterFallback, style]}>
      <Image
        source={{ uri }}
        resizeMode={contain ? "contain" : "cover"}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

// Uygulama logosu. Ana uygulamayla AYNI launcher ikonu (reminder_widget.xml
// → @mipmap/ic_launcher; Android widget'ı kullanıcının SEÇTİĞİ simgeyi basar,
// bkz. native/android-widgets/.../AppIconRes.kt): kendi gradyan rozetini kurup
// üstüne beyaza boyanmış bir "S" siluet basmak yerine, gerçek Seelogd ikonu
// (gradyanı dahil) olduğu gibi gösterilir. Önizleme de aynı simgeyi izler.
function WidgetBrand({ size = 28, radius = 9 }) {
  const { icon } = useAppLogo();
  return (
    <Image
      source={icon}
      resizeMode="cover"
      style={[styles.brand, { width: size, height: size, borderRadius: radius }]}
    />
  );
}

// Kalan süreye göre renk. ReminderWidgetRemoteViewsService.kt'teki
// countdownColor() ile BİREBİR aynı kurallar: yalnız gerçekten yaklaşan
// (bugün/yarın) satırlar sabit alarm renginde parlar, sonrası widget'ın
// KENDİ temasına söner — böylece widget teması ne olursa olsun her satır
// gökkuşağı gibi görünmez, yalnız gerçek aciliyet öne çıkar.
const countdownColor = (days, p) => {
  if (days <= 0) return "#FF6B6B";
  if (days === 1) return "#FFB547";
  if (days <= 3) return p.accent;
  if (days <= 7) return p.secondaryText;
  return p.muted;
};


function ReminderPreview({ settings }) {
  const p = settings.appearance;
  const { language } = useLanguage();
  // Provider dizeleri dile göre kendisi yazar (ReminderWidgetProvider.kt).
  const isTr = language !== "en";
  const compact = settings.density === "compact";
  // Geri sayım ve tarih bugünden türetilir (saf, dile göre): bkz. widgetSamples.js.
  const samples = useMemo(() => buildReminderSamples({ isTr }), [isTr]);
  const filtered =
    settings.content === "all"
      ? samples
      : samples.filter((item) => item.type === settings.content);
  // Servis `take(maxItems)` yapar — eksikse eksik gösterilir, tekrar edilmez.
  // Ayar 100'e çıkabilir; önizleme kaydırılamaz olduğundan (bkz. aşağıdaki not)
  // yalnız çerçeveye sığan kadarı gösterilir — aynı örnekleri onlarca kez
  // render etmek de Ayarlar ekranını gereksiz yorardı.
  const display = filtered.slice(0, Math.min(settings.maxItems, 8));
  const typeLabel = (type) =>
    type === "movie" ? (isTr ? "Film" : "Movie") : isTr ? "Dizi" : "TV";

  return (
    <View
      style={[
        styles.widgetFrame,
        styles.reminderRoot,
        { backgroundColor: p.background, aspectRatio: ANDROID_ASPECT.reminders },
      ]}
    >
      {/* Başlık şeridi. showTitle YALNIZCA logo + başlığı gizler; sayaç rozeti
          gerçekte kalmaya devam eder (ReminderWidgetProvider.kt). */}
      <View style={styles.remHeader}>
        {/* Başlık gizlenince rozet SOLA yaslanır: native LinearLayout'un
            varsayılan start hizalaması budur, sağa itilmez. */}
        {settings.showTitle && (
          <>
            <WidgetBrand size={28} radius={9} />
            <Text
              numberOfLines={1}
              style={[styles.remTitle, { color: p.text }]}
            >
              {isTr ? "Yaklaşanlar" : "Coming Up"}
            </Text>
          </>
        )}
        <View
          // Rozetin dolgusu/çerçevesi çalışma anında BOYANMAZ: her temada aynı
          // indigo yıkama kalır, yalnız metin aksana döner (count_badge drawable).
          style={styles.remCountBadge}
        >
          <Text
            allowFontScaling={false}
            style={[styles.remCountText, { color: p.accent }]}
          >
            {display.length} {isTr ? "hatırlatma" : "reminders"}
          </Text>
        </View>
      </View>

      {/* Gerçeğinde bu bir ListView'dur: çerçeveye sığmayan satırlar kırpılır.
          Önizleme kaydırılabilir YAPILMAZ: bu panel Ayarlar'ın kendi dikey
          ScrollView'ı içinde yaşıyor, aynı yöndeki iç içe ScrollView jest
          çakışmasına (özellikle iOS'ta parmağın önizleme üstünde kilitlenip
          sayfanın kaydırılamaması) yol açardı. "5 öğe" ile "8 öğe" farkı
          sayaçta ve alttaki özellik etiketlerinde zaten görünür; taşan
          satırlar burada gerçek widget'ın ilk açılışındaki gibi kırpılır. */}
      {display.length === 0 ? (
        <View style={styles.remEmpty}>
          {/* İkon sabit gri (reminder_widget_ic_empty), yalnız metin temaya uyar. */}
          <AppIcon name="calendar-outline" size={30} color="#9AA3B8" />
          <Text style={[styles.remEmptyText, { color: p.muted }]}>
            {isTr
              ? "Yaklaşan film veya bölüm yok"
              : "No upcoming movies or episodes"}
          </Text>
        </View>
      ) : (
        <View style={styles.widgetScroll}>
          {display.map((item, index) => (
          <View
            key={`${item.title}-${index}`}
            style={[
              styles.remRow,
              {
                // Satır zemini DÜZ RENK DEĞİL. Provider drawable'ı SRC_IN ile
                // boyar; kaynak alfa korunduğu için sonuç, temanın renginin
                // saydam bir yıkaması olur: bugünküler surface @%35
                // (row_bg_today #59…), diğerleri surfaceAlt @%24 (row_bg #3D…).
                // Önceki %16/%8 değerleri koyu zeminlerde kartı neredeyse
                // görünmez kılıyordu; satırlar artık zeminden net ayrışır.
                backgroundColor:
                  item.daysLeft <= 0
                    ? alpha(p.surface, 0.349)
                    : alpha(p.surfaceAlt, 0.239),
                borderColor:
                  item.daysLeft <= 0
                    ? alpha(p.surface, 0.388)
                    : alpha(p.surfaceAlt, 0.259),
                // Dolgu 1'er azaltıldı: RN kenarlığı kutuya EKLER, native ise
                // 1dp çizgiyi içeri çizer — satır yüksekliği 64/58 kalsın.
                paddingHorizontal: compact ? 5 : 7,
                paddingVertical: compact ? 3 : 6,
              },
            ]}
          >
            {settings.showPosters && (
              <Poster
                uri={POSTERS[index % POSTERS.length]}
                style={styles.remPoster}
              />
            )}
            <View style={styles.remCopy}>
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                style={[
                  styles.remName,
                  { color: p.text, fontSize: compact ? 11 : 12 },
                ]}
              >
                {item.title}
              </Text>
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                style={[styles.remMeta, { color: p.secondaryText }]}
              >
                {[typeLabel(item.type), item.sub].filter(Boolean).join("  •  ")}
              </Text>
            </View>
            <View style={styles.remWhenBox}>
              <Text
                allowFontScaling={false}
                style={[
                  styles.remWhen,
                  { color: countdownColor(item.daysLeft, p) },
                ]}
              >
                {item.when}
              </Text>
              {settings.showDates && (
                <Text
                  allowFontScaling={false}
                  style={[styles.remDate, { color: p.muted }]}
                >
                  {item.date}
                </Text>
              )}
            </View>
          </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ListsPreview({ settings }) {
  const p = settings.appearance;
  const { language } = useLanguage();
  const isTr = language !== "en";
  const compact = settings.density === "compact";
  // Gerçek widget hücreleri 3 sütunda 6dp aralıkla dizilir. Eskiden hücre
  // yüksekliği SABİT 112dp'ydi ve poster "fitCenter" ile sığdırılıyordu; 2:3
  // afiş her sütun genişliğine tam oturmadığından yanlarda temanın rengiyle
  // boyanmış boşluk şeritleri kalıyordu. Artık hücre 2:3 oranında (poster
  // boyutuyla aynı) ve poster "cover" ile hücreyi TAMAMEN doldurur: arka
  // plan görünmez, poster sade ve yuvarlak köşeli kalır.
  const cells = Array.from(
    { length: Math.min(settings.maxPosters, 12) },
    (_, index) => POSTERS[index % POSTERS.length],
  );
  return (
    <View
      style={[
        styles.widgetFrame,
        styles.listsRoot,
        { backgroundColor: p.background, aspectRatio: ANDROID_ASPECT.lists },
      ]}
    >
      {/* Liste seçici şeridi. showTitle YALNIZCA ikon + adı gizler; şerit,
          sayaç ve ‹ 1/4 › kümesi yerinde kalır (ListsWidgetProvider.kt). */}
      <View
        style={[
          styles.listsHeader,
          {
            // Satırlarla aynı kural: header_bg #14FFFFFF olduğu için sonuç
            // surface'in %8'lik yıkaması, düz surface değil.
            backgroundColor: alpha(p.surface, 0.078),
            borderColor: alpha(p.surface, 0.07),
          },
        ]}
      >
        {settings.showTitle && (
          <>
            <View style={styles.listIconDot}>
              <AppIcon name="tv" size={14} color={p.accent} />
            </View>
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              style={[styles.listsTitle, { color: p.text }]}
            >
              {isTr ? "Listelerim" : "My Lists"}
            </Text>
          </>
        )}
        {settings.showCount && (
          <Text
            allowFontScaling={false}
            style={[styles.listCount, { color: p.accent }]}
          >
            80
          </Text>
        )}
        {settings.showNavigation && (
          <>
            <View style={styles.navButton}>
              <AppIcon name="chevron-back" size={12} color={p.secondaryText} />
            </View>
            <Text
              allowFontScaling={false}
              style={[styles.listPosition, { color: p.muted }]}
            >
              1/4
            </Text>
            <View style={styles.navButton}>
              <AppIcon name="chevron-forward" size={12} color={p.secondaryText} />
            </View>
          </>
        )}
      </View>

      {/* Gerçeğinde kaydırılabilir bir GridView. Burada kaydırılamaz bırakılır:
          Ayarlar'ın kendi dikey ScrollView'ı içinde aynı yönde ikinci bir
          ScrollView, parmağın önizleme üstünde kilitlenip sayfa kaydırmasını
          engellemesine yol açardı (özellikle iOS'ta). Poster sayısı farkı
          zaten alt etiketten okunur; taşan satırlar burada da kırpılır. */}
      <View style={[styles.widgetScroll, styles.posterGrid]}>
        {chunk(cells, 3).map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.gridRow}>
            {row.map((uri, index) => (
              <View
                key={`${uri}-${index}`}
                style={[styles.gridCell, { padding: compact ? 2 : 5 }]}
              >
                <Poster uri={uri} style={styles.gridPoster} />
              </View>
            ))}
            {/* Son satır eksikse boş hücreler koy: yoksa kalan afişler
                genişleyip ızgara sütun hizasını kaybeder. */}
            {Array.from({ length: 3 - row.length }, (_, index) => (
              <View key={`bos-${index}`} style={styles.gridCellEmpty} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

// Sağ paneldeki beş eşit sütun: değer 15sp bold, etiket 8sp muted.
const TimeUnit = ({ value, label, palette }) => (
  <View style={styles.timeUnit}>
    <Text allowFontScaling={false} style={[styles.timeValue, { color: palette.text }]}>
      {value}
    </Text>
    <Text
      numberOfLines={1}
      allowFontScaling={false}
      style={[styles.timeLabel, { color: palette.muted }]}
    >
      {label}
    </Text>
  </View>
);

// Sol paneldeki büyük sayaç: 19sp bold + 9sp etiket (Android ölçüsü).
const CountBlock = ({ value, label, palette }) => (
  <View style={styles.countBlock}>
    <Text allowFontScaling={false} style={[styles.bigStat, { color: palette.text }]}>
      {value}
    </Text>
    <Text
      numberOfLines={1}
      allowFontScaling={false}
      style={[styles.statCaption, { color: palette.muted }]}
    >
      {label}
    </Text>
  </View>
);

// Kart gövdesi: 315° gradyan (sol üstte %18 surface → sağ altta tam surface),
// 18dp köşe, %12 surface hairline (stats_widget_card_bg + runtime tint).
function StatsCard({ palette, style, children }) {
  return (
    <LinearGradient
      colors={[alpha(palette.surface, 0.18), palette.surface]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.statsCard, { borderColor: alpha(palette.surface, 0.12) }, style]}
    >
      {children}
    </LinearGradient>
  );
}

function StatsPreview({ settings }) {
  const p = settings.appearance;
  const { t, language } = useLanguage();
  const isTr = language !== "en";
  const compact = settings.density === "compact";
  // Etiketler widget'a hangi anahtarlardan gidiyorsa buraya da oradan gelir
  // (ProfileStatsContext.labels → statsWidgetService payload).
  const ps = t?.profileScreen || {};
  const saatEtiketi = etiket(ps.hours, isTr ? "Saat" : "Hours");
  // Yoğunluk bu widget'ta YALNIZCA kök dolguyu değiştirir (StatsWidgetProvider
  // setViewPadding); bölüm araları ve punto sabittir.
  const birimler = (values) =>
    [
      [values[0], etiket(ps.years, isTr ? "Yıl" : "Years")],
      [values[1], etiket(ps.months, isTr ? "Ay" : "Months")],
      [values[2], etiket(ps.days, isTr ? "Gün" : "Days")],
      [values[3], saatEtiketi],
      [values[4], etiket(ps.minutes, isTr ? "Dakika" : "Minutes")],
    ].map(([value, label]) => (
      <TimeUnit key={label} value={value} label={label} palette={p} />
    ));

  return (
    <View
      style={[
        styles.widgetFrame,
        {
          backgroundColor: p.background,
          aspectRatio: ANDROID_ASPECT.stats,
          paddingHorizontal: compact ? 6 : 8,
          paddingVertical: compact ? 3 : 4,
        },
      ]}
    >
      {settings.showTitle && (
        <View style={styles.statsHeader}>
          <WidgetBrand size={18} radius={7} />
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={[styles.statsHeaderTitle, { color: p.text }]}
          >
            {isTr ? "İstatistikler" : "Statistics"}
          </Text>
        </View>
      )}

      {settings.showMovies && (
        <StatsCard palette={p}>
          <View style={[styles.statsPanel, styles.statsCountPanel, { backgroundColor: alpha(p.surfaceAlt, 0.85) }]}>
            <CountBlock
              value="184"
              label={etiket(ps.movieWatched, isTr ? "İzlenen Filmler" : "Movies Watched")}
              palette={p}
            />
          </View>
          <View style={[styles.statsPanel, styles.statsTimePanel, { backgroundColor: alpha(p.surfaceAlt, 0.85) }]}>
            {birimler(["0", "1", "8", "6", "56"])}
          </View>
        </StatsCard>
      )}

      {settings.showDuration && (
        <View
          style={[
            styles.statsStrip,
            {
              backgroundColor: alpha(p.surfaceAlt, 0.07),
              borderColor: alpha(p.surfaceAlt, 0.1),
            },
          ]}
        >
          {[
            ["time-outline", "1.284", etiket(ps.totalDuration, isTr ? "Toplam Süre" : "Total Duration"), p.accent],
            ["film-outline", "356", etiket(t?.movies, isTr ? "Filmler" : "Movies"), p.accent],
            ["tv-outline", "928", etiket(t?.tvShows, isTr ? "Diziler" : "TV Shows"), p.bold],
          ].map(([icon, value, label, tint]) => (
            <View key={icon} style={styles.durationGroup}>
              {/* Üç ikon da sabit gri: provider bunları yeniden boyamaz. */}
              <AppIcon name={icon} size={14} color="#9AA3B8" />
              <View style={styles.durationCopy}>
                <Text
                  numberOfLines={1}
                  allowFontScaling={false}
                  style={[styles.durationNumber, { color: tint }]}
                >
                  {value} {saatEtiketi}
                </Text>
                <Text
                  numberOfLines={1}
                  allowFontScaling={false}
                  style={[styles.durationCaption, { color: p.muted }]}
                >
                  {label}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {settings.showTv && (
        <StatsCard palette={p} style={styles.statsCardFollow}>
          {/* Gerçek widget'ta (stats_widget.xml) dizi kartında YALNIZCA bölüm
              sayısı vardır — dizi sayısı hiç gösterilmez. Önizleme burada
              iki sayı gösteriyordu; film kartıyla birebir aynı tek-sayı
              düzenine (statsCountPanel) çekildi. */}
          <View
            style={[
              styles.statsPanel,
              styles.statsCountPanel,
              { backgroundColor: alpha(p.surfaceAlt, 0.85) },
            ]}
          >
            <CountBlock
              value="912"
              label={etiket(
                ps.tvShowEpisodetotalCount,
                isTr ? "Bölüm Sayısı" : "Episode Count",
              )}
              palette={p}
            />
          </View>
          <View style={[styles.statsPanel, styles.statsTimePanel, { backgroundColor: alpha(p.surfaceAlt, 0.85) }]}>
            {birimler(["0", "3", "20", "8", "35"])}
          </View>
        </StatsCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Widget önizlemeleri ────────────────────────────────────────────────
  // Sayılar native kaynaklardaki dp/sp değerleridir; ölçek 1:1 korunur.
  // Kök çerçevenin görünür kenarlığı YOK: gerçekte drawable'ın çizgisi de
  // arka plan rengiyle boyandığı için kaybolur (WidgetThemeViews.tintBackground).
  widgetFrame: {
    width: "100%",
    borderRadius: 24, // reminder_widget_background.xml
    overflow: "hidden",
  },

  /* Yaklaşanlar */
  reminderRoot: { paddingHorizontal: 13, paddingTop: 12, paddingBottom: 11 },
  remHeader: { height: 32, flexDirection: "row", alignItems: "center" },
  brand: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  remTitle: { flex: 1, marginStart: 9, fontSize: 15, fontWeight: "700" },
  remCountBadge: {
    // reminder_widget_count_badge.xml — sabit indigo, temayla değişmez.
    backgroundColor: "rgba(108,99,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(108,99,255,0.21)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  remCountText: { fontSize: 10, fontWeight: "700" },
  remRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 13,
    borderWidth: 1,
    marginTop: 6,
  },
  posterFallback: { backgroundColor: "#1F2233", overflow: "hidden" },
  remPoster: { width: 34, height: 50, borderRadius: 7 },
  remCopy: { flex: 1, marginStart: 10, marginEnd: 8 },
  remName: { fontWeight: "700" },
  remMeta: { fontSize: 9, marginTop: 2 },
  remWhenBox: { alignItems: "flex-end" },
  remWhen: { fontSize: 10, fontWeight: "700" },
  remDate: { fontSize: 8, marginTop: 1 },
  remEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  remEmptyText: { fontSize: 12, marginTop: 7, textAlign: "center" },

  /* Listelerim */
  listsRoot: { paddingHorizontal: 12, paddingTop: 11, paddingBottom: 10 },
  listsHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    // Native 1dp çizgiyi içeri çizer; RN dışarı ekler → dolgu 1 azaltıldı ki
    // şerit yüksekliği 38 kalsın.
    paddingHorizontal: 7,
    paddingVertical: 6,
  },
  listIconDot: {
    // lists_widget_icon_dot.xml — daire, sabit %12 beyaz (temaya bağlı değil).
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  listsTitle: { flex: 1, marginStart: 8, fontSize: 13, fontWeight: "700" },
  listCount: { fontSize: 12, fontWeight: "700", marginEnd: 6 },
  navButton: {
    // lists_widget_nav_btn.xml — sabit menekşe yıkama, temayla değişmez.
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "rgba(108,99,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(108,99,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  listPosition: {
    fontSize: 9,
    fontWeight: "700",
    minWidth: 24,
    marginHorizontal: 5,
    textAlign: "center",
  },
  // Kaydırılabilir gövde: gerçeğinde ListView/GridView, burada da öyle —
  // çerçeveye sığmayan içerik kırpılır ve kaydırılarak görülür.
  widgetScroll: { flex: 1 },
  posterGrid: { marginTop: 8 },
  gridRow: { flexDirection: "row", gap: GRID_GAP, marginBottom: GRID_GAP },
  // Sabit 112dp yükseklik yerine gerçek poster oranı (2:3): hücre her sütun
  // genişliğinde otomatik doğru yükseklikte olur, poster'ı asla letterbox'lamaz.
  gridCell: { flex: 1, aspectRatio: 2 / 3, borderRadius: 10, overflow: "hidden" },
  gridCellEmpty: { flex: 1 },
  gridPoster: { flex: 1, borderRadius: 10 },

  /* İstatistikler */
  statsHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  statsHeaderTitle: { flex: 1, fontSize: 14, fontWeight: "700" },
  statsCard: {
    flex: 1,
    flexDirection: "row",
    // Eskiden 18dp'ydi (profildeki watchStats'tan kopyalanmıştı); iç panelle
    // (12dp) daha iyi "iç içe" dursun diye 16dp'ye indirildi.
    borderRadius: 16,
    borderWidth: 1,
    padding: 2,
    marginTop: 3,
  },
  statsCardFollow: { marginTop: 3 },
  statsPanel: {
    // Eskiden 10dp'ydi (profildeki watchStatsView'dan — 7dp dolgulu bir
    // bağlamdan — olduğu gibi kopyalanmıştı); widget'ın 2dp dolgusuyla
    // eşleşmediği için dış karta göre köşeler orantısız/sivri duruyordu.
    // 12dp hem dış kartla (statsCard, 16) hem şeritle (statsStrip) uyumlu.
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 1,
  },
  statsCountPanel: { flex: 43, paddingHorizontal: 4 },
  statsTimePanel: {
    flex: 55,
    marginStart: 5,
    flexDirection: "row",
    paddingHorizontal: 3,
  },
  countBlock: { flex: 1, alignItems: "center", justifyContent: "center" },
  bigStat: { fontSize: 19, fontWeight: "700" },
  statCaption: { fontSize: 9, textAlign: "center" },
  timeUnit: { flex: 1, alignItems: "center", justifyContent: "center" },
  timeValue: { fontSize: 15, fontWeight: "700" },
  timeLabel: { fontSize: 8, textAlign: "center" },
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    // Kart panelleriyle (statsPanel, 12) aynı köşe dili.
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 3,
  },
  durationGroup: { flex: 1, flexDirection: "row", alignItems: "center" },
  durationCopy: { flex: 1, marginStart: 5 },
  durationNumber: { fontSize: 11, fontWeight: "700" },
  durationCaption: { fontSize: 8 },
});

export default function AndroidWidgetPreview({ active, settings }) {
  if (active === "reminders") return <ReminderPreview settings={settings} />;
  if (active === "lists") return <ListsPreview settings={settings} />;
  return <StatsPreview settings={settings} />;
}
