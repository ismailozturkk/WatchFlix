// components/settings/AtmosphereControls.js
//
// Atmosfer ayarının ortak parçaları: efekt adları/simgeleri, gruplu efekt
// seçici ve yoğunluk segmenti. Ayarlar > Atmosfer (AtmosphereScreen) ve
// Kişiselleştirme (ambiyans / ikon yoğunluğu için DensitySegment) kullanır.

import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from "react-native";
import AppIcon from "../AppIcon";
import GlassTouchable from "../common/GlassTouchable";
import * as Haptics from "../../services/hapticsService";
import { i18nText } from "../../utils/i18nText";
import { DECOR_DENSITIES } from "../../utils/decorLayout";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";
import { WEATHER_GROUPS } from "../../utils/weatherParticles";

export const DENSITY_LABELS = {
  auto: () => i18nText("autoI18n.dekor_yogunluk_otomatik", "Otomatik"),
  low: () => i18nText("autoI18n.dekor_yogunluk_az", "Az"),
  medium: () => i18nText("autoI18n.dekor_yogunluk_orta", "Orta"),
  high: () => i18nText("autoI18n.dekor_yogunluk_cok", "Çok"),
};

// Yoğunluk seçici: kartın ORTASINDA durduğu için alt köşe yuvarlaması yok
// (kart sonundaki "Düzen" segmentinden farkı bu).
export function DensitySegment({ value, onChange, colors }) {
  return (
    <View
      accessibilityRole="radiogroup"
      style={[s.densitySegment, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
    >
      {DECOR_DENSITIES.map((d) => {
        const active = value === d;
        return (
          <GlassTouchable
            key={d}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            style={[s.segOpt, active && { backgroundColor: colors.accent }]}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync();
              onChange(d);
            }}
            activeOpacity={0.7}
          >
            <Text
              allowFontScaling={false}
              style={[
                s.segText,
                { color: active ? colors.white : colors.muted, fontWeight: active ? "700" : "500" },
              ]}
            >
              {DENSITY_LABELS[d]()}
            </Text>
          </GlassTouchable>
        );
      })}
    </View>
  );
}

export const WEATHER_LABELS = {
  auto: () => i18nText("autoI18n.hava_tur_otomatik", "Mevsime göre"),
  snow: () => i18nText("autoI18n.hava_tur_kar", "Kar"),
  leaves: () => i18nText("autoI18n.hava_tur_yaprak", "Yaprak"),
  rain: () => i18nText("autoI18n.hava_tur_yagmur", "Yağmur"),
  storm: () => i18nText("autoI18n.atmosfer_firtina", "Fırtına"),
  sakura: () => i18nText("autoI18n.hava_tur_sakura", "Sakura"),
  springGarden: () => i18nText("autoI18n.atmosfer_bahar", "Bahar bahçesi"),
  fireflies: () => i18nText("autoI18n.hava_tur_atesbocegi", "Ateş böceği"),
  summerShore: () => i18nText("autoI18n.atmosfer_yaz_kiyisi", "Yaz kıyısı"),
  aurora: () => i18nText("autoI18n.atmosfer_aurora", "Kuzey ışıkları"),
  popcorn: () => i18nText("autoI18n.atmosfer_misir", "Patlamış mısır"),
  tickets: () => i18nText("autoI18n.atmosfer_bilet", "Bilet ve yıldız"),
  embers: () => i18nText("autoI18n.atmosfer_kivilcim", "Kıvılcım"),
  solarSystem: () => i18nText("autoI18n.atmosfer_gunes_sistemi", "Güneş sistemi"),
  stardust: () => i18nText("autoI18n.atmosfer_yildiz_tozu", "Yıldız tozu"),
  butterflies: () => i18nText("autoI18n.atmosfer_kelebek", "Kelebek"),
  dandelion: () => i18nText("autoI18n.atmosfer_karahindiba", "Karahindiba"),
  fireworks: () => i18nText("autoI18n.atmosfer_havai_fisek", "Havai fişek"),
  hearts: () => i18nText("autoI18n.atmosfer_kalpler", "Kalpler"),
  halloween: () => i18nText("autoI18n.atmosfer_cadilar", "Cadılar Bayramı"),
  christmas: () => i18nText("autoI18n.ozel_gun_noel", "Noel"),
  // film/dizi/anime evrenleri (utils/weatherUniverses)
  starWars: () => i18nText("autoI18n.evren_star_wars", "Star Wars"),
  matrix: () => i18nText("autoI18n.evren_matrix", "Matrix"),
  harryPotter: () => i18nText("autoI18n.evren_harry_potter", "Harry Potter"),
  lotr: () => i18nText("autoI18n.evren_yuzuklerin_efendisi", "Yüzüklerin Efendisi"),
  dune: () => i18nText("autoI18n.evren_dune", "Dune"),
  batman: () => i18nText("autoI18n.evren_batman", "Batman"),
  spiderMan: () => i18nText("autoI18n.evren_spider_man", "Örümcek Adam"),
  breakingBad: () => i18nText("autoI18n.evren_breaking_bad", "Breaking Bad"),
  got: () => i18nText("autoI18n.evren_game_of_thrones", "Game of Thrones"),
  vikings: () => i18nText("autoI18n.evren_vikings", "Vikings"),
  prisonBreak: () => i18nText("autoI18n.evren_prison_break", "Prison Break"),
  sherlock: () => i18nText("autoI18n.evren_sherlock", "Sherlock"),
  deathNote: () => i18nText("autoI18n.evren_death_note", "Death Note"),
  aot: () => i18nText("autoI18n.evren_attack_on_titan", "Attack on Titan"),
  naruto: () => i18nText("autoI18n.evren_naruto", "Naruto"),
  onePiece: () => i18nText("autoI18n.evren_one_piece", "One Piece"),
  fma: () => i18nText("autoI18n.evren_fullmetal", "Fullmetal Alchemist"),
  rickAndMorty: () => i18nText("autoI18n.evren_rick_morty", "Rick and Morty"),
  jujutsuKaisen: () => i18nText("autoI18n.evren_jujutsu_kaisen", "Jujutsu Kaisen"),
  hunterXHunter: () => i18nText("autoI18n.evren_hunter_x_hunter", "Hunter x Hunter"),
  squidGame: () => i18nText("autoI18n.evren_squid_game", "Squid Game"),
  dark: () => i18nText("autoI18n.evren_dark", "Dark"),
  titanic: () => i18nText("autoI18n.evren_titanic", "Titanik"),
  inception: () => i18nText("autoI18n.evren_inception", "Inception"),
  pirates: () => i18nText("autoI18n.evren_pirates", "Karayip Korsanları"),
  madMax: () => i18nText("autoI18n.evren_mad_max", "Mad Max"),
  avatar: () => i18nText("autoI18n.evren_avatar", "Avatar"),
  jurassicPark: () => i18nText("autoI18n.evren_jurassic_park", "Jurassic Park"),
  lastOfUs: () => i18nText("autoI18n.evren_last_of_us", "The Last of Us"),
  ghibli: () => i18nText("autoI18n.evren_ghibli", "Ghibli dünyası"),
  bladeRunner: () => i18nText("autoI18n.evren_blade_runner", "Blade Runner"),
  demonSlayer: () => i18nText("autoI18n.evren_demon_slayer", "Demon Slayer"),
  strangerThings: () => i18nText("autoI18n.evren_stranger_things", "Stranger Things"),
  interstellar: () => i18nText("autoI18n.evren_interstellar", "Yıldızlararası"),
};

export const WEATHER_GROUP_LABELS = {
  seasons: () => i18nText("autoI18n.atmosfer_grup_mevsimler", "Mevsimler"),
  sky: () => i18nText("autoI18n.atmosfer_grup_gokyuzu", "Gökyüzü ve ışık"),
  nature: () => i18nText("autoI18n.atmosfer_grup_doga", "Doğa"),
  festive: () => i18nText("autoI18n.atmosfer_grup_senlik", "Sinema ve şenlik"),
  films: () => i18nText("autoI18n.atmosfer_grup_filmler", "Film evrenleri"),
  series: () => i18nText("autoI18n.atmosfer_grup_diziler", "Dizi evrenleri"),
  anime: () => i18nText("autoI18n.atmosfer_grup_anime", "Anime"),
};

const MCI = "MaterialCommunityIcons";
export const WEATHER_ICONS = {
  auto: { name: "calendar-outline" },
  snow: { name: "snow-outline" },
  leaves: { name: "leaf-outline" },
  rain: { name: "rainy-outline" },
  storm: { name: "thunderstorm-outline" },
  sakura: { name: "flower-outline" },
  springGarden: { family: MCI, name: "flower-tulip-outline" },
  fireflies: { name: "sparkles-outline" },
  summerShore: { family: MCI, name: "beach" },
  aurora: { family: MCI, name: "aurora" },
  popcorn: { family: MCI, name: "popcorn" },
  tickets: { name: "ticket-outline" },
  embers: { name: "flame-outline" },
  solarSystem: { family: MCI, name: "orbit" },
  stardust: { name: "star-outline" },
  butterflies: { family: MCI, name: "butterfly-outline" },
  dandelion: { family: MCI, name: "flower-pollen-outline" },
  fireworks: { family: MCI, name: "firework" },
  hearts: { name: "heart-outline" },
  halloween: { family: MCI, name: "halloween" },
  christmas: { family: MCI, name: "pine-tree" },
  starWars: { family: MCI, name: "death-star-variant" },
  matrix: { family: MCI, name: "matrix" },
  harryPotter: { family: MCI, name: "wizard-hat" },
  lotr: { family: MCI, name: "ring" },
  dune: { family: MCI, name: "terrain" },
  batman: { family: MCI, name: "bat" },
  spiderMan: { family: MCI, name: "spider-web" },
  breakingBad: { family: MCI, name: "flask-outline" },
  got: { family: MCI, name: "wall" },
  vikings: { family: MCI, name: "sail-boat" },
  prisonBreak: { family: MCI, name: "fence" },
  sherlock: { family: MCI, name: "magnify" },
  deathNote: { family: MCI, name: "notebook-outline" },
  aot: { family: MCI, name: "castle" },
  naruto: { family: MCI, name: "ninja" },
  onePiece: { family: MCI, name: "treasure-chest" },
  fma: { family: MCI, name: "hexagram-outline" },
  rickAndMorty: { family: MCI, name: "alien-outline" },
  jujutsuKaisen: { family: MCI, name: "eye-circle-outline" },
  hunterXHunter: { family: MCI, name: "fishbowl-outline" },
  squidGame: { family: MCI, name: "shape-outline" },
  dark: { family: MCI, name: "timer-sand" },
  titanic: { family: MCI, name: "ferry" },
  inception: { family: MCI, name: "rotate-3d-variant" },
  pirates: { family: MCI, name: "skull-crossbones-outline" },
  madMax: { family: MCI, name: "tanker-truck" },
  avatar: { family: MCI, name: "tree-outline" },
  jurassicPark: { family: MCI, name: "google-downasaur" },
  lastOfUs: { family: MCI, name: "sprout" },
  ghibli: { family: MCI, name: "bus-side" },
  bladeRunner: { family: MCI, name: "city-variant-outline" },
  demonSlayer: { family: MCI, name: "sword" },
  strangerThings: { family: MCI, name: "lightbulb-group" },
  interstellar: { family: MCI, name: "orbit" },
};

// Seçicide olmayan, yalnız tür karışımında çizilen efektlerin adları/simgeleri
// (türe göre açıklama sayfası).
const INTERNAL_LABELS = {
  balloons: () => i18nText("autoI18n.atmosfer_ic_balon", "Balonlar"),
  notes: () => i18nText("autoI18n.atmosfer_ic_nota", "Notalar"),
  ash: () => i18nText("autoI18n.atmosfer_ic_kul", "Kül"),
  bats: () => i18nText("autoI18n.atmosfer_ic_yarasa", "Yarasalar"),
  wisps: () => i18nText("autoI18n.atmosfer_ic_hayalet", "Hayalet ışıklar"),
  motes: () => i18nText("autoI18n.atmosfer_ic_toz", "Toz zerreleri"),
  sandDrift: () => i18nText("autoI18n.atmosfer_ic_kum", "Savrulan kum"),
  rosePetals: () => i18nText("autoI18n.atmosfer_ic_gul_yapragi", "Gül yaprakları"),
  // tür aileleri (bileşik atmosfer: parçacık + ışık katmanı)
  genreAction: () => i18nText("autoI18n.atmosfer_aile_aksiyon", "Kıvılcım ve patlama"),
  genreScifi: () => i18nText("autoI18n.atmosfer_aile_bilimkurgu", "Yıldız tozu ve gezegen"),
  genreThriller: () => i18nText("autoI18n.atmosfer_aile_gerilim", "Fırtına ve kalp atışı"),
  genreHorror: () => i18nText("autoI18n.atmosfer_aile_korku", "Yarasa, sis, titreyen lamba"),
  genreMystery: () => i18nText("autoI18n.atmosfer_aile_gizem", "Hayalet ışık ve el feneri"),
  genreCrime: () => i18nText("autoI18n.atmosfer_aile_suc", "Noir yağmur ve neon"),
  genreRomance: () => i18nText("autoI18n.atmosfer_aile_romantik", "Kalp ve gül yaprağı"),
  genreDrama: () => i18nText("autoI18n.atmosfer_aile_dram", "Yaprak ve cam damlası"),
  genreComedy: () => i18nText("autoI18n.atmosfer_aile_komedi", "Mısır ve konfeti"),
  genreAnimation: () => i18nText("autoI18n.atmosfer_aile_animasyon", "Kâğıt yıldız ve bulut"),
  genreFamily: () => i18nText("autoI18n.atmosfer_aile_aile", "Balon, uçurtma, kâğıt uçak"),
  genreMusic: () => i18nText("autoI18n.atmosfer_aile_muzik", "Nota ve ekolayzer"),
  genreHistory: () => i18nText("autoI18n.atmosfer_aile_tarih", "Parşömen ve mum ışığı"),
  genreDocumentary: () => i18nText("autoI18n.atmosfer_aile_belgesel", "Kamera vizörü ve toz"),
  genreWar: () => i18nText("autoI18n.atmosfer_aile_savas", "Kül, duman, uzak çakma"),
  genreWestern: () => i18nText("autoI18n.atmosfer_aile_western", "Kum, çalı, sıcak hava"),
  genreReality: () => i18nText("autoI18n.atmosfer_aile_realite", "Spot ışığı ve flaşlar"),
};

// Özel günler (utils/weatherParticles SPECIAL_DAYS) — ad ve simge.
export const SPECIAL_DAY_LABELS = {
  newYear: () => i18nText("autoI18n.ozel_gun_yilbasi", "Yılbaşı"),
  valentines: () => i18nText("autoI18n.ozel_gun_sevgililer", "Sevgililer Günü"),
  womensDay: () => i18nText("autoI18n.ozel_gun_kadinlar", "Kadınlar Günü"),
  earthDay: () => i18nText("autoI18n.ozel_gun_dunya", "Dünya Günü"),
  halloween: () => i18nText("autoI18n.atmosfer_cadilar", "Cadılar Bayramı"),
  childrensDay: () => i18nText("autoI18n.ozel_gun_cocuk", "Dünya Çocuk Günü"),
  christmas: () => i18nText("autoI18n.ozel_gun_noel", "Noel"),
  cinemaDay: () => i18nText("autoI18n.ozel_gun_sinema", "Sinema Günü"),
};

export const SPECIAL_DAY_ICONS = {
  newYear: { family: MCI, name: "firework" },
  valentines: { name: "heart-outline" },
  womensDay: { name: "flower-outline" },
  earthDay: { family: MCI, name: "earth" },
  halloween: { family: MCI, name: "halloween" },
  childrensDay: { family: MCI, name: "balloon" },
  christmas: { family: MCI, name: "pine-tree" },
  cinemaDay: { family: MCI, name: "popcorn" },
};

/** Seçilebilir + iç efektlerin simgeleri. */
export const EFFECT_ICONS = {
  ...WEATHER_ICONS,
  balloons: { family: MCI, name: "balloon" },
  notes: { name: "musical-notes-outline" },
  ash: { family: MCI, name: "weather-dust" },
  bats: { family: MCI, name: "bat" },
  wisps: { family: MCI, name: "blur" },
  motes: { family: MCI, name: "grain" },
  sandDrift: { family: MCI, name: "weather-windy" },
  rosePetals: { name: "flower-outline" },
  genreAction: { family: MCI, name: "fire" },
  genreScifi: { family: MCI, name: "orbit" },
  genreThriller: { name: "thunderstorm-outline" },
  genreHorror: { family: MCI, name: "bat" },
  genreMystery: { family: MCI, name: "flashlight" },
  genreCrime: { family: MCI, name: "weather-pouring" },
  genreRomance: { name: "heart-outline" },
  genreDrama: { name: "leaf-outline" },
  genreComedy: { family: MCI, name: "popcorn" },
  genreAnimation: { family: MCI, name: "star-four-points-outline" },
  genreFamily: { family: MCI, name: "balloon" },
  genreMusic: { family: MCI, name: "equalizer" },
  genreHistory: { family: MCI, name: "script-text-outline" },
  genreDocumentary: { name: "videocam-outline" },
  genreWar: { family: MCI, name: "weather-dust" },
  genreWestern: { family: MCI, name: "cactus" },
  genreReality: { family: MCI, name: "spotlight-beam" },
};

/** Herhangi bir efektin (iç efektler dahil) adı. */
export function effectLabel(effect) {
  const f = WEATHER_LABELS[effect] || INTERNAL_LABELS[effect];
  return f ? f() : effect;
}

/** Seçimin (auto dahil) adı; auto için "Mevsime göre · şu an Yaprak". */
export function weatherChoiceLabel(choice, effect) {
  const name = (WEATHER_LABELS[choice] || WEATHER_LABELS.snow)();
  if (choice !== "auto") return name;
  const now = (WEATHER_LABELS[effect] || WEATHER_LABELS.snow)();
  return `${name} · ${now}`;
}

// Çip açılma süresi: simge → simge + ad.
const EXPAND_MS = 240;

/**
 * Simge çipi: kapalıyken yalnız simge; seçilince adı animasyonla açılır ve
 * vurgu rengine geçer. Ad genişliği önceden ölçülür (ChipRow), açılma
 * RN Animated ile (width yerleşim özelliği; Reanimated'ın ilk-değer yazma
 * tuzağı burada yok — bkz. hafıza notu "reanimated-initial-value-vanish").
 */
function ExpandingChip({ item, colors, labelWidth }) {
  const progress = useRef(new Animated.Value(item.active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: item.active ? 1 : 0,
      duration: EXPAND_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [item.active, progress]);
  const fg = item.active ? colors.white : colors.muted;
  return (
    <GlassTouchable
      accessibilityRole={item.role || "radio"}
      accessibilityState={{ checked: item.active }}
      accessibilityLabel={item.label}
      style={[
        s.iconChip,
        {
          backgroundColor: item.active ? colors.accent : colors.cardAlt,
          borderColor: item.active ? colors.accent : colors.border,
        },
      ]}
      onPress={item.onPress}
      activeOpacity={0.7}
    >
      <AppIcon family={item.icon?.family} name={item.icon?.name || "ellipse-outline"} size={17} color={fg} />
      <Animated.View
        style={[
          s.labelClip,
          {
            width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, labelWidth + 1] }),
            marginLeft: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }),
            opacity: progress,
          },
        ]}
      >
        <Text allowFontScaling={false} numberOfLines={1} style={[
            s.chipText,
            s.chipTextOn,
            // Sabit genişlik: açılırken üç noktayla kısalmaz, kenardan kırpılır.
            { color: colors.white, width: labelWidth ? labelWidth + 1 : undefined, flexShrink: 0 },
          ]}
        >
          {item.label}
        </Text>
      </Animated.View>
    </GlassTouchable>
  );
}

/**
 * Yatay kayan çip şeridi (efekt grubu, örnek türler…). Şerit kartın iç
 * boşluğunu (16) taşar: çipler kenara kadar kayar. Çipler simge; seçili
 * olanın adı açılır.
 */
export function ChipRow({ items, colors }) {
  // Ad genişlikleri: görünmez bir katmanda doğal genişlikte ölçülür.
  const [widths, setWidths] = useState({});
  return (
    <View>
      <View style={s.measure} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {items.map((it) => (
          <Text
            key={it.key}
            allowFontScaling={false}
            numberOfLines={1}
            style={[s.chipText, s.chipTextOn]}
            onLayout={(e) => {
              const w = Math.ceil(e.nativeEvent.layout.width);
              setWidths((prev) => (prev[it.key] === w ? prev : { ...prev, [it.key]: w }));
            }}
          >
            {it.label}
          </Text>
        ))}
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        style={s.rowBleed}
        contentContainerStyle={s.row}
      >
        {items.map((it) => (
          <ExpandingChip key={it.key} item={it} colors={colors} labelWidth={widths[it.key] || 0} />
        ))}
      </ScrollView>
    </View>
  );
}

// Atmosfer seçici: grup başlığı + kayan çip şeridi (7 grup, en çok 15 simge).
// Kapalıyken de seçilebilir — önizleme seçileni gösterir (Free da görür).
export function WeatherPicker({ value, onChange, colors }) {
  return (
    <View accessibilityRole="radiogroup" style={s.groups}>
      {WEATHER_GROUPS.map((group) => (
        <View key={group.id}>
          <Text allowFontScaling={false} style={[s.groupTitle, { color: colors.muted }]}>
            {WEATHER_GROUP_LABELS[group.id]()}
          </Text>
          <ChipRow
            colors={colors}
            items={group.effects.map((c) => ({
              key: c,
              label: WEATHER_LABELS[c](),
              icon: WEATHER_ICONS[c],
              active: value === c,
              onPress: () => {
                if (value === c) return;
                Haptics.selectionAsync();
                onChange(c);
              },
            }))}
          />
        </View>
      ))}
    </View>
  );
}

// ── Hızlı seçim şeridi (tam ekran önizlemenin altı) ─────────────────────────
// Tüm seçenekler tek yatay sırada küçük simge; gruplar arasında ince ayraç.
// Üstte seçilinin adı. Seçili simge açılışta ve değişince ortaya kayar.
// Zemin her zaman koyu (tam ekran perdesi) → renkler sabit beyaz tonlar.
const QS_ITEM = 34;
const QS_GAP = 6;
const QS_SEP = 13; // ayraç genişliği (iki yanında QS_GAP)
const QS_PAD = 16;

// Sıra + her simgenin x'i (onLayout beklemeden ortalamak için hesapla).
const QS_LAYOUT = (() => {
  const items = [];
  let x = QS_PAD;
  WEATHER_GROUPS.forEach((group, gi) => {
    if (gi > 0) x += QS_SEP + QS_GAP;
    group.effects.forEach((c) => {
      items.push({ key: c, x, sepBefore: gi > 0 && c === group.effects[0] });
      x += QS_ITEM + QS_GAP;
    });
  });
  return { items, width: x - QS_GAP + QS_PAD };
})();

export function QuickWeatherStrip({ value, effect, onChange, accent, width }) {
  const scrollRef = useRef(null);
  const first = useRef(true);
  useEffect(() => {
    const it = QS_LAYOUT.items.find((i) => i.key === value);
    if (!it || !scrollRef.current || !width) return;
    const max = Math.max(0, QS_LAYOUT.width - width);
    const target = Math.min(max, Math.max(0, it.x + QS_ITEM / 2 - width / 2));
    scrollRef.current.scrollTo({ x: target, animated: !first.current });
    first.current = false;
  }, [value, width]);
  return (
    <View style={s.qsWrap}>
      <Text allowFontScaling={false} numberOfLines={1} style={s.qsName}>
        {weatherChoiceLabel(value, effect)}
      </Text>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.qsRow}
        accessibilityRole="radiogroup"
      >
        {QS_LAYOUT.items.map(({ key, sepBefore }) => {
          const active = key === value;
          const icon = WEATHER_ICONS[key];
          return (
            <React.Fragment key={key}>
              {sepBefore ? <View style={s.qsSep} /> : null}
              <GlassTouchable
                glass={false}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={WEATHER_LABELS[key]()}
                activeOpacity={0.7}
                style={[
                  s.qsItem,
                  active
                    ? { backgroundColor: accent, borderColor: accent }
                    : { backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.14)" },
                ]}
                onPress={() => {
                  if (active) return;
                  Haptics.selectionAsync();
                  onChange(key);
                }}
              >
                <AppIcon
                  family={icon?.family}
                  name={icon?.name || "ellipse-outline"}
                  size={16}
                  color={active ? "#ffffff" : "rgba(255,255,255,0.72)"}
                />
              </GlassTouchable>
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  qsWrap: { alignSelf: "stretch", gap: 8 },
  qsName: { color: "#ffffff", fontSize: 13, fontWeight: "700", textAlign: "center", paddingHorizontal: QS_PAD },
  qsRow: { paddingHorizontal: QS_PAD, gap: QS_GAP, alignItems: "center" },
  qsItem: {
    width: QS_ITEM,
    height: QS_ITEM,
    borderRadius: QS_ITEM / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qsSep: { width: QS_SEP, height: 1, alignSelf: "center", backgroundColor: "rgba(255,255,255,0.22)" },
  segOpt: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  segText: { fontSize: 11, textAlign: "center" },
  densitySegment: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  groups: { gap: 10 },
  groupTitle: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  // Dikeyde GLASS_PRESS_ROOM: basılan cam çip büyüyünce kaydırıcı kabı onu
  // kesmesin (negatif margin yerleşimi korur).
  rowBleed: { marginHorizontal: -16, marginVertical: -GLASS_PRESS_ROOM },
  row: { paddingHorizontal: 16, paddingVertical: GLASS_PRESS_ROOM, gap: 6 },
  iconChip: {
    flexDirection: "row",
    alignItems: "center",
    height: 36,
    minWidth: 36,
    paddingHorizontal: 9,
    borderRadius: 18,
    borderWidth: 1,
  },
  labelClip: { overflow: "hidden" },
  measure: { position: "absolute", flexDirection: "row", opacity: 0, left: 0, top: 0 },
  chipText: { fontSize: 12 },
  chipTextOn: { fontWeight: "700" },
});
