// components/wrapped/WrappedShareEditor.js
//
// Wrapped'in son slaytı: paylaşım kartının CANLI önizlemesi + özelleştirme paneli
// + Kaydet / Paylaş. Önceki sürümde özelleştirme, kartı örten tam ekran bir
// pencerede açılıyordu; kullanıcı değişikliği göremeden seçim yapıyordu. Şimdi
// önizleme hep görünür, altında dört sekmeli (Düzen / Stil / İçerik / Not) sabit
// yükseklikli bir panel var — sekme değişince sayfa zıplamaz.
//
// Kart HER ZAMAN 360x640 olarak yerleşir ve burada `transform: scale` ile
// küçültülüp gösterilir; yakalama düğümün kendi boyutunu (360x640 → 1080x1920)
// alır, önizlemeyle birebir aynıdır (bkz. WrappedShareCard.js).
//
// Önizleme boyutu `onLayout` ile ÖLÇÜLÜR (sabit pay hesabı yok): panel, klavye
// ya da cihaz yüksekliği değişince kart kendiliğinden küçülüp büyür.
//
// Seçimler (düzen/palet/arka plan/poster içeriği/anahtarlar) MMKV'de hatırlanır;
// not hatırlanmaz (Keys.wrappedCard, utils/wrappedCard.js).

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassIconButton from "../common/GlassIconButton";
import WrappedShareCard, { makeWrappedPosterUri } from "./WrappedShareCard";
import { alpha } from "../../theme/colors";
import { triggerHaptic } from "../../services/hapticsService";
import { Keys, get, set } from "../../services/storage";
import {
  DEFAULT_WRAPPED_CARD_OPTIONS,
  WRAPPED_CAPTION_MAX,
  WRAPPED_CARD_H,
  WRAPPED_CARD_LAYOUT_IDS,
  WRAPPED_CARD_THEME_IDS,
  WRAPPED_CARD_W,
  WRAPPED_PALETTES,
  buildWrappedCardPosters,
  cleanWrappedCaption,
  layoutSupportsModule,
  persistableWrappedCardOptions,
  resolveWrappedPalette,
  sanitizeWrappedCardOptions,
  wrappedModuleAvailability,
} from "../../utils/wrappedCard";
import GlassPressable from "../common/GlassPressable";
import GlassBox from "../common/GlassBox";

const PANEL_H = 118;
const TABS = [
  { id: "layout", icon: "grid-outline", labelKey: "tabLayout" },
  { id: "style", icon: "color-palette-outline", labelKey: "tabStyle" },
  { id: "content", icon: "options-outline", labelKey: "tabContent" },
  { id: "note", icon: "chatbox-ellipses-outline", labelKey: "tabNote" },
];

const LAYOUT_LABEL_KEYS = {
  showcase: "layoutShowcase",
  posters: "layoutPosters",
  ticket: "layoutTicket",
  minimal: "layoutMinimal",
};
const BACKGROUNDS = [
  { id: "glow", icon: "sparkles-outline", labelKey: "bgGlow" },
  { id: "clean", icon: "remove-outline", labelKey: "bgClean" },
  { id: "poster", icon: "image-outline", labelKey: "bgPoster" },
];
const TOGGLES = [
  { key: "showPersonality", icon: "happy-outline", labelKey: "personalityOption" },
  { key: "showStats", icon: "grid-outline", labelKey: "statsOption" },
  { key: "showGenres", icon: "pricetags-outline", labelKey: "genresOption" },
  { key: "showPosters", icon: "images-outline", labelKey: "postersOption" },
  { key: "showActivity", icon: "calendar-outline", labelKey: "activityOption" },
  { key: "showName", icon: "person-outline", labelKey: "nameOption" },
];

const MUTED = "rgba(255,255,255,0.56)";
const EDGE = "rgba(255,255,255,0.12)";
const FILL = "rgba(255,255,255,0.07)";

// ── Küçük denetim parçaları ──────────────────────────────────────────────────

const Segmented = memo(function Segmented({ items, value, onChange, accent, onAccent, disabled }) {
  return (
    <View style={styles.segmented}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <GlassPressable
            key={item.id}
            onPress={() => onChange(item.id)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segmentedItem, active && { backgroundColor: accent }]}
          >
            {item.icon ? (
              <Ionicons name={item.icon} size={14} color={active ? onAccent : MUTED} />
            ) : null}
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.segmentedText, { color: active ? onAccent : "rgba(255,255,255,0.7)" }]}
            >
              {item.label}
            </Text>
          </GlassPressable>
        );
      })}
    </View>
  );
});

// Küçük tel kafes: kullanıcı düzeni adından önce şeklinden tanısın.
const Block = ({ l, t, w, h, r = 2, o = 1, color, round }) => (
  <View
    style={{
      position: "absolute",
      left: l,
      top: t,
      width: w,
      height: h,
      borderRadius: round ? w / 2 : r,
      backgroundColor: color,
      opacity: o,
    }}
  />
);

function LayoutThumb({ id, color }) {
  const frame = { backgroundColor: alpha(color, 0.1), borderColor: alpha(color, 0.25) };
  return (
    <View style={[styles.thumb, frame]}>
      {/* Vitrin: başlık, kimlik, dev sayı, üç karo, çipler, ısı ızgarası, poster şeridi */}
      {id === "showcase" && (
        <>
          <Block l={4} t={4} w={8} h={8} r={3} color={color} />
          <Block l={14} t={6} w={14} h={3} color={color} o={0.7} />
          <Block l={4} t={15} w={36} h={7} r={3} color={color} o={0.35} />
          <Block l={4} t={25} w={24} h={8} r={1.5} color={color} />
          <Block l={4} t={36} w={11} h={9} r={2.5} color={color} o={0.5} />
          <Block l={17} t={36} w={11} h={9} r={2.5} color={color} o={0.5} />
          <Block l={30} t={36} w={10} h={9} r={2.5} color={color} o={0.5} />
          <Block l={4} t={48} w={36} h={3} r={1.5} color={color} o={0.35} />
          <Block l={4} t={54} w={36} h={5} r={1} color={color} o={0.25} />
          {[0, 1, 2].map((i) => (
            <Block key={`p${i}`} l={4 + i * 10} t={62} w={9} h={13} r={1.5} color={color} o={0.85} />
          ))}
        </>
      )}
      {/* Poster: büyük poster + 2x2 ızgara */}
      {id === "posters" && (
        <>
          <Block l={4} t={4} w={8} h={5} r={2} color={color} />
          <Block l={4} t={13} w={19} h={27} r={3} color={color} />
          <Block l={25} t={13} w={7} h={13} r={2} color={color} o={0.55} />
          <Block l={34} t={13} w={7} h={13} r={2} color={color} o={0.55} />
          <Block l={25} t={28} w={7} h={12} r={2} color={color} o={0.4} />
          <Block l={34} t={28} w={7} h={12} r={2} color={color} o={0.4} />
          <Block l={4} t={44} w={37} h={7} r={3} color={color} o={0.35} />
          <Block l={4} t={54} w={22} h={8} r={1.5} color={color} />
          <Block l={4} t={65} w={37} h={5} r={2} color={color} o={0.3} />
        </>
      )}
      {/* Bilet: çentikli kart + barkod */}
      {id === "ticket" && (
        <>
          <Block l={4} t={3} w={37} h={72} r={5} color={color} o={0.28} />
          <Block l={0} t={49} w={4} h={7} r={2} color={color} />
          <Block l={41} t={49} w={4} h={7} r={2} color={color} />
          <Block l={8} t={8} w={20} h={3} color={color} o={0.7} />
          <Block l={8} t={15} w={29} h={10} r={1.5} color={color} />
          <Block l={8} t={28} w={29} h={6} r={3} color={color} o={0.4} />
          <Block l={8} t={37} w={20} h={4} r={1.5} color={color} o={0.8} />
          <Block l={8} t={44} w={29} h={3} color={color} o={0.3} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Block key={`b${i}`} l={8 + i * 3.6} t={60} w={i % 3 === 0 ? 2 : 1.2} h={10} color={color} o={0.8} />
          ))}
        </>
      )}
      {/* Minimal: dev sayı + hizalı satırlar */}
      {id === "minimal" && (
        <>
          <Block l={4} t={4} w={8} h={8} r={3} color={color} />
          <Block l={4} t={17} w={37} h={15} r={2} color={color} />
          <Block l={4} t={35} w={20} h={3} color={color} o={0.5} />
          {[0, 1, 2].map((i) => (
            <View key={`r${i}`}>
              <Block l={4} t={44 + i * 7} w={37} h={0.8} color={color} o={0.35} />
              <Block l={4} t={46 + i * 7} w={11} h={2} color={color} o={0.5} />
              <Block l={30} t={45.5 + i * 7} w={11} h={3.5} r={1} color={color} o={0.9} />
            </View>
          ))}
          <Block l={4} t={67} w={37} h={4} r={1} color={color} o={0.3} />
        </>
      )}
    </View>
  );
}

const LayoutCard = memo(function LayoutCard({ id, label, active, accent, onPress }) {
  const color = active ? accent : "#FFFFFF";
  return (
    <GlassPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.layoutCard,
        active && { backgroundColor: alpha(accent, 0.15), borderColor: alpha(accent, 0.7) },
      ]}
    >
      <LayoutThumb id={id} color={color} />
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.layoutLabel, { color: active ? "#FFFFFF" : "rgba(255,255,255,0.64)" }]}
      >
        {label}
      </Text>
    </GlassPressable>
  );
});

const Swatch = memo(function Swatch({ palette, label, active, accent, onAccent, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={styles.swatchWrap}
    >
      <View style={[styles.swatchRing, { borderColor: active ? accent : "transparent" }]}>
        <LinearGradient
          colors={palette.colors}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.swatch}
        >
          <View style={[styles.swatchDot, { backgroundColor: palette.accent }]} />
          {active ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
        </LinearGradient>
      </View>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.swatchLabel, { color: active ? "#FFFFFF" : MUTED }]}
      >
        {label}
      </Text>
    </Pressable>
  );
});

const ToggleChip = memo(function ToggleChip({ item, label, on, disabled, accent, onPress }) {
  return (
    <GlassPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      style={[
        styles.toggleChip,
        on && !disabled && { backgroundColor: alpha(accent, 0.16), borderColor: alpha(accent, 0.6) },
        disabled && { opacity: 0.38 },
      ]}
    >
      <Ionicons
        name={on && !disabled ? "checkmark-circle" : item.icon}
        size={15}
        color={on && !disabled ? accent : MUTED}
      />
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.toggleText, { color: on && !disabled ? "#FFFFFF" : "rgba(255,255,255,0.72)" }]}
      >
        {label}
      </Text>
    </GlassPressable>
  );
});

// ── Düzenleyici ──────────────────────────────────────────────────────────────

export default function WrappedShareEditor({
  cardRef,
  recap,
  str,
  theme,
  language,
  getTmdbUrl,
  userName,
  pace,
  topInset,
  bottomInset,
  busy,
  busyAction,
  onSave,
  onShare,
  onBack,
}) {
  const { width: winW } = useWindowDimensions();
  const [options, setOptions] = useState(() => sanitizeWrappedCardOptions(get(Keys.wrappedCard)));
  const [captionDraft, setCaptionDraft] = useState("");
  const [tab, setTab] = useState("layout");
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [keyboardH, setKeyboardH] = useState(0);
  const [loaded, setLoaded] = useState({});
  const [giveUp, setGiveUp] = useState(false);
  const inputRef = useRef(null);

  // Seçimleri hatırla (not hariç).
  useEffect(() => {
    try {
      set(Keys.wrappedCard, persistableWrappedCardOptions(options));
    } catch {
      // Kalıcılık başarısız olsa da düzenleyici çalışmaya devam eder.
    }
  }, [options]);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, (e) => setKeyboardH(e?.endCoordinates?.height || 1));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardH(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const update = useCallback((patch) => {
    triggerHaptic("selection");
    setOptions((current) => sanitizeWrappedCardOptions({ ...current, ...patch }));
  }, []);

  const reset = useCallback(() => {
    triggerHaptic("selection");
    setOptions(sanitizeWrappedCardOptions(DEFAULT_WRAPPED_CARD_OPTIONS));
    setCaptionDraft("");
  }, []);

  // Rastgele düzen + palet: mevcut seçimden FARKLI bir çift seçer (aynısı çıkarsa
  // düğmeye basmak hiçbir şey değiştirmemiş gibi görünürdü).
  const shuffle = useCallback(() => {
    const pick = (list, current) => {
      const others = list.filter((id) => id !== current);
      return others[Math.floor(Math.random() * others.length)] || current;
    };
    update({
      layout: pick(WRAPPED_CARD_LAYOUT_IDS, options.layout),
      themeId: pick(WRAPPED_CARD_THEME_IDS, options.themeId),
    });
  }, [update, options.layout, options.themeId]);

  const cardOptions = useMemo(
    () => ({ ...options, caption: cleanWrappedCaption(captionDraft) }),
    [options, captionDraft],
  );

  const palette = resolveWrappedPalette(options.themeId, theme?.accent);
  const accent = palette.accent;
  const onAccent = palette.onAccent;

  const hasUserName = Boolean((userName || "").trim());
  const avail = useMemo(
    () => wrappedModuleAvailability(recap, { hasUserName }),
    [recap, hasUserName],
  );
  const hasPosterChoice = Boolean(recap.topShows?.length && recap.moviePosters?.length);

  // ── Poster hazır mı? ──
  // Yakalama, posterler indirilmeden alınırsa boş yuvalı kart çıkar. Gösterilen
  // görsellerin hepsi yüklenene (ya da 4,5 sn dolana — ağ yoksa sonsuza dek
  // beklemesin) kadar eylem düğmeleri bekletilir.
  const wantedUris = useMemo(
    () => buildWrappedCardPosters(recap, cardOptions, makeWrappedPosterUri(getTmdbUrl)).uris,
    [recap, cardOptions, getTmdbUrl],
  );
  const onImageSettled = useCallback((uri) => {
    setLoaded((current) => (current[uri] ? current : { ...current, [uri]: true }));
  }, []);
  const pendingKey = wantedUris.filter((uri) => !loaded[uri]).join("|");
  useEffect(() => {
    setGiveUp(false);
    if (!pendingKey) return undefined;
    const id = setTimeout(() => setGiveUp(true), 4500);
    return () => clearTimeout(id);
  }, [pendingKey]);
  const ready = !pendingKey || giveUp;
  const disabled = busy || !ready;

  // ── Ölçüler ──
  const typing = keyboardH > 0;
  const k = area.h > 0 && area.w > 0 ? Math.min((area.h - 6) / WRAPPED_CARD_H, (area.w - 4) / WRAPPED_CARD_W) : 0;
  const frameW = Math.round(WRAPPED_CARD_W * k);
  const frameH = Math.round(WRAPPED_CARD_H * k);
  // iOS'ta klavye ekranı örter ve pencere küçülmez; Android "resize" modunda
  // pencere kendiliğinden daralır (app.json softwareKeyboardLayoutMode).
  const lift = Platform.OS === "ios" ? keyboardH : 0;

  // Giriş: panel/eylemler karttan hemen sonra hafifçe süzülür (yalnız mount).
  const intro = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 520, delay: 140, useNativeDriver: true }).start();
  }, [intro]);
  const introRise = intro.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });

  const tabLabel = (item) => str[item.labelKey];

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[palette.colors[2], "#08070B", "#000000"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.glow, { backgroundColor: accent, opacity: 0.2 }]} />
      <View style={[styles.glowAlt, { backgroundColor: palette.secondary || accent, opacity: 0.13 }]} />

      {/* Başlık bandı (üst çubuk ve kapat düğmesiyle aynı hizada) */}
      <View
        pointerEvents="none"
        style={[styles.headerBand, { top: topInset + 20, right: onBack ? 108 : 64 }]}
      >
        <Ionicons name="sparkles" size={15} color={accent} />
        <Text style={styles.headline} allowFontScaling={false} numberOfLines={1}>
          {str.shareCardReady}
        </Text>
      </View>
      {/* Özet son slayttır ve alttaki gezinme okları gizli: bir önceki slayda dönüş. */}
      {onBack ? (
        <GlassIconButton
          variant="blur"
          flatFallback
          icon="chevron-back"
          iconSize={22}
          size={38}
          fallbackRadius={19}
          hitSlop={10}
          fallbackStyle={styles.shuffleBtnFallback}
          accessibilityLabel={str.backAction}
          style={[styles.shuffleBtn, styles.backBtn, { top: topInset + 18 }]}
          onPress={onBack}
        />
      ) : null}
      <GlassIconButton
        variant="blur"
        flatFallback
        icon="shuffle"
        iconSize={20}
        size={38}
        fallbackRadius={19}
        hitSlop={10}
        fallbackStyle={styles.shuffleBtnFallback}
        accessibilityLabel={str.shuffle}
        style={[styles.shuffleBtn, { top: topInset + 18 }]}
        onPress={shuffle}
      />

      <View
        style={[
          styles.body,
          { paddingTop: topInset + 58, paddingBottom: Math.max(bottomInset, 10) + (typing ? lift - bottomInset : 0) + 6 },
        ]}
      >
        {/* Canlı önizleme: kart 360x640 yerleşir, burada ölçeklenerek gösterilir. */}
        <Pressable
          onPress={Keyboard.dismiss}
          style={styles.previewArea}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setArea((cur) => (cur.w === width && cur.h === height ? cur : { w: width, h: height }));
          }}
        >
          {k > 0 && (
            <View
              style={[
                styles.cardShadow,
                {
                  width: frameW,
                  height: frameH,
                  borderRadius: Math.round(WRAPPED_CARD_H * k * 0.045),
                  shadowColor: accent,
                },
              ]}
            >
              <View style={[styles.previewFrame, { borderRadius: Math.round(WRAPPED_CARD_H * k * 0.045) }]}>
                <View
                  style={{
                    width: WRAPPED_CARD_W,
                    height: WRAPPED_CARD_H,
                    transformOrigin: "top left",
                    transform: [{ scale: k }],
                  }}
                >
                  <View ref={cardRef} collapsable={false} style={{ width: WRAPPED_CARD_W, height: WRAPPED_CARD_H }}>
                    <WrappedShareCard
                      recap={recap}
                      str={str}
                      theme={theme}
                      language={language}
                      getTmdbUrl={getTmdbUrl}
                      userName={userName}
                      options={cardOptions}
                      pace={pace}
                      onImageSettled={onImageSettled}
                    />
                  </View>
                </View>
              </View>
            </View>
          )}
        </Pressable>

        <Animated.View style={{ opacity: intro, transform: [{ translateY: introRise }] }}>
          {/* Sekmeler */}
          <View style={styles.tabs}>
            {TABS.map((item) => {
              const active = tab === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    triggerHaptic("selection");
                    setTab(item.id);
                    if (item.id === "note") setTimeout(() => inputRef.current?.focus?.(), 60);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.tab,
                    active && { backgroundColor: alpha(accent, 0.16), borderColor: alpha(accent, 0.55) },
                  ]}
                >
                  <Ionicons name={item.icon} size={14} color={active ? accent : MUTED} />
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[styles.tabText, { color: active ? "#FFFFFF" : "rgba(255,255,255,0.66)" }]}
                  >
                    {tabLabel(item)}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={reset}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={str.reset}
              style={styles.resetBtn}
            >
              <Ionicons name="refresh" size={15} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>

          {/* Panel: sabit yükseklik — sekme değişince sayfa zıplamaz. */}
          <View style={styles.panel}>
            {tab === "layout" && (
              <View style={styles.layoutRow}>
                {WRAPPED_CARD_LAYOUT_IDS.map((id) => (
                  <LayoutCard
                    key={id}
                    id={id}
                    label={str[LAYOUT_LABEL_KEYS[id]]}
                    active={options.layout === id}
                    accent={accent}
                    onPress={() => update({ layout: id })}
                  />
                ))}
              </View>
            )}

            {tab === "style" && (
              <View style={styles.stylePanel}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.noGrow}
                  contentContainerStyle={styles.swatchRow}
                >
                  {WRAPPED_PALETTES.map((item) => (
                    <Swatch
                      key={item.id}
                      palette={resolveWrappedPalette(item.id, theme?.accent)}
                      label={str[item.labelKey]}
                      active={options.themeId === item.id}
                      accent={accent}
                      onAccent={onAccent}
                      onPress={() => update({ themeId: item.id })}
                    />
                  ))}
                </ScrollView>
                <Segmented
                  accent={accent}
                  onAccent={onAccent}
                  value={options.background}
                  onChange={(background) => update({ background })}
                  items={BACKGROUNDS.map((item) => ({
                    id: item.id,
                    icon: item.icon,
                    label: str[item.labelKey],
                  }))}
                />
              </View>
            )}

            {tab === "content" && (
              <View style={styles.contentPanel}>
                {hasPosterChoice ? (
                  <Segmented
                    accent={accent}
                    onAccent={onAccent}
                    value={options.posterContent}
                    onChange={(posterContent) => update({ posterContent })}
                    items={[
                      { id: "shows", icon: "tv-outline", label: str.postersShows },
                      { id: "movies", icon: "film-outline", label: str.postersMovies },
                    ]}
                  />
                ) : null}
                <View style={styles.chipGrid}>
                  {[TOGGLES.slice(0, 3), TOGGLES.slice(3)].map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.chipRow}>
                      {row.map((item) => {
                        const supported = layoutSupportsModule(options.layout, item.key);
                        return (
                          <ToggleChip
                            key={item.key}
                            item={item}
                            label={str[item.labelKey]}
                            on={options[item.key]}
                            disabled={!supported || !avail[item.key]}
                            accent={accent}
                            onPress={() => update({ [item.key]: !options[item.key] })}
                          />
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {tab === "note" && (
              <View style={styles.notePanel}>
                <GlassBox role="field" style={styles.noteBox}>
                  <Ionicons name="chatbox-ellipses-outline" size={17} color={MUTED} />
                  <TextInput
                    ref={inputRef}
                    value={captionDraft}
                    onChangeText={setCaptionDraft}
                    placeholder={str.captionPlaceholder}
                    placeholderTextColor="rgba(255,255,255,0.38)"
                    maxLength={WRAPPED_CAPTION_MAX}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    allowFontScaling={false}
                    selectionColor={accent}
                    style={styles.noteInput}
                  />
                  {captionDraft ? (
                    <Pressable onPress={() => setCaptionDraft("")} hitSlop={8} accessibilityRole="button">
                      <Ionicons name="close-circle" size={18} color={MUTED} />
                    </Pressable>
                  ) : null}
                </GlassBox>
                <View style={styles.noteMeta}>
                  <Text style={styles.noteHint} allowFontScaling={false} numberOfLines={2}>
                    {str.captionHint}
                  </Text>
                  <Text style={styles.noteCount} allowFontScaling={false}>
                    {Array.from(captionDraft).length}/{WRAPPED_CAPTION_MAX}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Eylemler (yazarken gizlenir: klavyenin üstünde yalnız önizleme + not kalır) */}
          {!typing && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.saveBtn, disabled && styles.actionDisabled]}
                onPress={onSave}
                disabled={disabled}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={str.saveActionLabel}
              >
                {busyAction === "save" ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={19} color="#fff" />
                    <Text style={styles.actionText} allowFontScaling={false}>
                      {str.save}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.shareBtn, disabled && styles.actionDisabled]}
                onPress={onShare}
                disabled={disabled}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={str.share}
              >
                <LinearGradient
                  colors={[accent, palette.secondary || accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.shareBtnFill}
                >
                  {busyAction === "share" || !ready ? (
                    <ActivityIndicator size="small" color={onAccent} />
                  ) : (
                    <>
                      <Ionicons name="share-social" size={19} color={onAccent} />
                      <Text style={[styles.shareText, { color: onAccent }]} allowFontScaling={false}>
                        {str.share}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: "absolute", width: 340, height: 340, borderRadius: 170, top: -140, right: -130 },
  glowAlt: { position: "absolute", width: 300, height: 300, borderRadius: 150, bottom: -120, left: -120 },

  headerBand: {
    position: "absolute",
    left: 64,
    height: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  headline: { color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: -0.3, flexShrink: 1 },
  shuffleBtn: {
    position: "absolute",
    right: 16,
    zIndex: 30,
  },
  // Eski (cam yokken) zemin; cam yolunda kullanılmaz.
  shuffleBtnFallback: { backgroundColor: "rgba(0,0,0,0.4)" },

  backBtn: { right: 62 },

  body: { flex: 1, paddingHorizontal: 16 },
  previewArea: { flex: 1, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  cardShadow: {
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
    backgroundColor: "#000",
  },
  previewFrame: { flex: 1, overflow: "hidden" },

  tabs: { flexDirection: "row", alignItems: "center", gap: 4, height: 36, marginBottom: 8 },
  tab: {
    flex: 1,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabText: { fontSize: 11.5, fontWeight: "800" },
  resetBtn: {
    width: 34,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },

  panel: {
    height: PANEL_H,
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: EDGE,
    backgroundColor: FILL,
    padding: 8,
    marginBottom: 10,
  },
  noGrow: { flexGrow: 0 },

  layoutRow: { flexDirection: "row", gap: 7, flex: 1 },
  layoutCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  layoutLabel: { fontSize: 11.5, fontWeight: "800" },
  thumb: { width: 45, height: 76, borderRadius: 8, borderWidth: 1, overflow: "hidden" },

  stylePanel: { gap: 10 },
  swatchRow: { gap: 10, paddingHorizontal: 2, alignItems: "flex-start" },
  swatchWrap: { alignItems: "center", gap: 3, width: 60 },
  swatchRing: { padding: 2, borderRadius: 15, borderWidth: 2 },
  swatch: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  swatchDot: { position: "absolute", top: 5, right: 5, width: 7, height: 7, borderRadius: 4 },
  swatchLabel: { fontSize: 10, fontWeight: "700" },

  contentPanel: { gap: 8 },
  chipGrid: { gap: 8 },
  chipRow: { flexDirection: "row", gap: 8 },
  toggleChip: {
    flex: 1,
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  toggleText: { fontSize: 11.5, fontWeight: "700", flexShrink: 1 },

  segmented: {
    flexDirection: "row",
    height: 34,
    padding: 3,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.07)",
    gap: 3,
  },
  segmentedItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
  },
  segmentedText: { fontSize: 12, fontWeight: "800" },

  notePanel: { gap: 9 },
  noteBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    height: 48,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: EDGE,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  noteInput: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "600", paddingVertical: 0 },
  noteMeta: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingHorizontal: 4 },
  noteHint: { flex: 1, color: MUTED, fontSize: 11, lineHeight: 15, fontWeight: "600" },
  noteCount: { color: MUTED, fontSize: 11, fontWeight: "800" },

  actions: { flexDirection: "row", gap: 11 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 18,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  shareBtn: { flex: 1.4, overflow: "hidden" },
  // alignSelf: stretch — üst kapta alignItems: center olduğundan dolgu aksi halde
  // yalnız içerik yüksekliğinde (düğmenin ortasında ince bir bant) kalırdı.
  shareBtnFill: {
    flex: 1,
    width: "100%",
    alignSelf: "stretch",
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  shareText: { fontSize: 16, fontWeight: "900", letterSpacing: 0.3 },
  actionDisabled: { opacity: 0.58 },
  actionText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 0.2 },
});
