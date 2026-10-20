import { isLightSurface } from "@utils/colorUtils";
import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  useWindowDimensions,
  Keyboard,
  StatusBar,
  TextInput,
  ScrollView,
  FlatList,
  Animated,
  PanResponder,
  Platform,
  ActivityIndicator,
  BackHandler,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
// SDK 57: `saveToLibraryAsync` ana giriste calisma aninda hata firlatiyor;
// legacy girisinden alinmali (izin fonksiyonlari ana giriste gecerli).
import { saveToLibraryAsync } from "expo-media-library/legacy";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "axios";
import Toast from "@components/AppToast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import {
  useApiSettings,
  useImageQualitySettings,
} from "@context/AppSettingsContext";
import GlassCloseButton from "@components/common/GlassCloseButton";
import { StoryHeader } from "@components/storyShare/StoryHeader";
import { StoryTabs } from "@components/storyShare/StoryTabs";
import { StoryActionBar } from "@components/storyShare/StoryActionBar";
import { SaveDraftModal } from "@components/storyShare/SaveDraftModal";
import StorySlider from "@components/storyShare/StorySlider";
import { StoryDraftService } from "@services/StoryDraftService";
import { i18nText } from "@utils/i18nText";
import { tmdbImageLanguageOrderOf } from "@utils/appLanguages";
import { getRatingColors } from "@utils/ratingColors";
import useAppLogo from "@hooks/useAppLogo";
import {
  fitStoryCanvas,
  storyScale,
  planStorySheet,
  liftSheetForKeyboard,
  stackBlocksVertically,
  storyTitleSize,
  planStoryActionBar,
} from "@utils/storyCanvasLayout";
import GlassTouchable from "../../components/common/GlassTouchable";
import GlassBox from "../../components/common/GlassBox";
import GlassTextInput from "../../components/common/GlassTextInput";

/* ── Tuval ölçüleri EKRANDAN ölçülür (utils/storyCanvasLayout.js) ──
   Eskiden modül yüklenirken Dimensions + sabit header/alt çubuk yüksekliğiyle
   hesaplanıyordu; gerçek alt çubuk (home indicator / navigasyon dolgusu) sabit
   100px'ten uzun olduğundan tuval çubuğun altına taşıyordu. Şimdi `canvasArea`
   onLayout ile ölçülür, tuval o alana 9:16 sığdırılır.
   Kapalı: tuval, header ile alt çubuk arasındaki tüm boşluğu kullanır.
   Açık:   tuval, header ile ayar sayfası arasına sığacak kadar küçülür. */
const CANVAS_TOP_GAP = 16; // canvasArea paddingTop (10) + canvasShadow marginTop (6)
const CANVAS_BOTTOM_GAP = 12;
const SIDE_PAD = 16;
const SHRINK_PREFERRED = 0.5;
const MIN_SHEET_H = 320;
const MIN_SHEET_H_FLOOR = 270;
/* Alt çubuğun ölçüm gelmeden önceki tahmini: kenarlık 1 + üst dolgu 8 + buton
   satırı (56 ya da 66; planStoryActionBar'dan) + alt dolgu (ilk karede doğru
   çıkar, sonra gerçek ölçü devralır). */
const HEADER_EXTRA = 8 + 40 + 10; // StoryHeader: üst boşluk + buton + alt boşluk


const TEXT_COLORS = [
  "#FFFFFF",
  "#111111",
  "#FFD700",
  "#FF5E7E",
  "#5AACF0",
  "#7CF29C",
  "#FF8A3D",
  "#B388FF",
];

const WM_POSITIONS = [
  { id: "bottom-right", icon: "arrow-down" },
  { id: "bottom-left", icon: "arrow-down" },
  { id: "top-right", icon: "arrow-up" },
  { id: "top-left", icon: "arrow-up" },
];
/* Filigran kenar boşluğu tuvalle birlikte ölçeklenir (off = 12 * ölçek). */
const wmStyle = (pos, off) => {
  switch (pos) {
    case "bottom-left":
      return { bottom: off, left: off };
    case "top-right":
      return { top: off, right: off };
    case "top-left":
      return { top: off, left: off };
    default:
      return { bottom: off, right: off };
  }
};

const BG_COLORS = [
  "#000000",
  "#FFFFFF",
  "#E50914",
  "#0A84FF",
  "#1DB954",
  "#7C3AED",
  "#FF8A3D",
  "#222222",
];

/* Yazı tipleri — yüklü özel font olmadığından platforma göre sistem fontları
   eşlenir. Geçersiz isimde RN sessizce varsayılana döner (çökmez). */
const FONTS = [
  { id: "system", name: "Sans", ios: undefined, android: undefined },
  { id: "serif", name: "Serif", ios: "Georgia", android: "serif" },
  { id: "mono", name: "Mono", ios: "Courier New", android: "monospace" },
  { id: "condensed", name: "Condensed", ios: "Avenir Next Condensed", android: "sans-serif-condensed" },
  { id: "light", name: "Light", ios: "Helvetica Neue", android: "sans-serif-light" },
  { id: "round", name: "Round", ios: "Arial Rounded MT Bold", android: "casual" },
  { id: "script", name: "Script", ios: "Snell Roundhand", android: "cursive" },
  { id: "marker", name: "Marker", ios: "Marker Felt", android: "casual" },
];

const fontFamilyOf = (id) => {
  const f = FONTS.find((x) => x.id === id) || FONTS[0];
  return Platform.OS === "ios" ? f.ios : f.android;
};

/* Varsayılan değerler (sıfırlama butonları buraya döndürür) */
const DEFAULTS = {
  scrim: 0.4,
  bgBlur: 0,
  bgRadius: 22,
  bgPadding: 0,
  textSize: 20,
  textColor: "#FFFFFF",
  textBgColor: "#000000",
  textBgOpacity: 0.45,
  textRadius: 12,
  textPadding: 10,
  textWidth: 0.7,
  posterRadius: 12,
  posterWidth: 0.42,
  graphWidth: 0.86,
  graphRadius: 3,
};

/* Paylaşılan/seçili içerik için kaliteyi ayardan bağımsız YÜKSEK tut
   (sadece tuvaldeki görseller — küçük resimler ayara uyar, kasmaz) */
const HQ_SIZE = { backdrop: "w1280", poster: "w780" };
const hqUrl = (path, type) =>
  path ? `https://image.tmdb.org/t/p/${HQ_SIZE[type] || "w780"}${path}` : null;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/* Ölçülen kutuyu birleştirir: aynı pencere boyutu/genişlikte yükseklik yalnız
   büyür (klavyenin yol açtığı geçici küçülme tuvali yeniden sığdırmasın);
   pencere boyutu değişince (katlanır, bölünmüş ekran) yeni ölçü esas alınır. */
const mergeBox = (prev, next, key) => {
  const same = prev && prev.key === key && prev.w === next.w;
  const h = same ? Math.max(prev.h, next.h) : next.h;
  if (same && prev.h === h && prev.y === next.y) return prev;
  return { ...next, h, key };
};

/* #RRGGBB + opaklık → #RRGGBBAA */
const hexA = (hex, a) => {
  const v = Math.round(clamp(a, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${v}`;
};

/* ── Hex renk kodu girişi ──
   Renk seçim satırlarının en başında serbest kod girişi: 6 haneli hex
   yazılıp onaylanınca uygulanır; geçersiz girişte mevcut renge geri döner. */
function HexColorInput({ theme, color, onChange }) {
  const [text, setText] = useState((color || "").replace(/^#/, ""));
  useEffect(() => {
    setText((color || "").replace(/^#/, ""));
  }, [color]);
  const valid = /^[0-9a-fA-F]{6}$/.test(text);
  const commit = () => {
    if (valid) onChange("#" + text.toUpperCase());
    else setText((color || "").replace(/^#/, ""));
  };
  return (
    <GlassBox role="field"
      style={[
        styles.hexBox,
        { borderColor: theme.border, backgroundColor: theme.secondary },
      ]}
    >
      <View
        style={[
          styles.hexPreview,
          { backgroundColor: valid ? "#" + text : color || "#000000" },
        ]}
      />
      <Text
        allowFontScaling={false}
        style={[styles.hexHash, { color: theme.text.muted }]}
      >
        #
      </Text>
      <TextInput
        value={text}
        onChangeText={(v) =>
          setText(v.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))
        }
        maxLength={6}
        onSubmitEditing={commit}
        onBlur={commit}
        placeholder="FF5E7E"
        placeholderTextColor={theme.text.muted}
        autoCapitalize="characters"
        autoCorrect={false}
        style={[styles.hexInput, { color: theme.text.primary }]}
      />
    </GlassBox>
  );
}

/* ── Bölüm Graph bloğu ──
   TvGraphDetailScreen ızgarasının story versiyonu: sütun = sezon,
   satır = bölüm; kareler puana göre boyanır (ortak RATING_TIERS).
   Veri blokta gömülü ({ s: sezonNo, r: [puanlar] }) → taslaklarda da
   yeniden fetch gerekmeden çizilir. */
function EpisodeGraph({ block, width }) {
  const data = block.data || [];
  const S = data.length;
  if (!S) return null;
  const maxE = Math.max(...data.map((d) => d.r.length), 0);
  const gap = 2;
  const cell = (width - gap * (S - 1)) / S;
  const cellRadius = Math.min(block.radius ?? DEFAULTS.graphRadius, cell / 2);
  const showText = cell >= 15;
  const headerFont = clamp(cell * 0.32, 6, 10);

  return (
    <View style={{ width }}>
      {/* Sezon başlıkları */}
      <View style={{ flexDirection: "row", gap, marginBottom: 2 }}>
        {data.map((d) => (
          <View key={d.s} style={{ width: cell, alignItems: "center" }}>
            <Text
              allowFontScaling={false}
              style={{
                color: "#fff",
                fontSize: headerFont,
                fontWeight: "800",
                textShadowColor: "rgba(0,0,0,0.6)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
              }}
            >
              S{d.s}
            </Text>
          </View>
        ))}
      </View>

      {/* Bölüm kareleri */}
      {[...Array(maxE)].map((_, ei) => (
        <View key={ei} style={{ flexDirection: "row", gap, marginBottom: gap }}>
          {data.map((d) => {
            const r = d.r[ei];
            if (r === undefined)
              return <View key={d.s} style={{ width: cell, height: cell }} />;
            const { bg, text } = getRatingColors(r);
            return (
              <View
                key={d.s}
                style={{
                  width: cell,
                  height: cell,
                  backgroundColor: bg,
                  borderRadius: cellRadius,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {showText && (
                  <Text
                    allowFontScaling={false}
                    style={{
                      color: text,
                      fontSize: cell * 0.34,
                      fontWeight: "800",
                    }}
                  >
                    {r ? r.toFixed(1) : "–"}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export default function StoryShareScreen({ route, navigation }) {
  // Marka logosu seçili uygulama simgesini izler (hooks/useAppLogo.js).
  const { logo: appLogo } = useAppLogo();
  const { theme } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const { API_KEY } = useApiSettings();
  const { getTmdbUrl } = useImageQualitySettings();
  const imageLanguageOrder = tmdbImageLanguageOrderOf(language);

  const params = route.params || {};
  const {
    id,
    type = "movie",
    title = "",
    year = "",
    rating = 0,
    genres = [],
    backdrop_path = null,
    poster_path = null,
  } = params;

  const viewShotRef = useRef(null);
  const rootRef = useRef(null);
  const positionsRef = useRef({});
  const sizesRef = useRef({});
  const respondersRef = useRef({});
  const dragStartRef = useRef({ x: 0, y: 0 });
  const bgInitRef = useRef(false);
  const dragScaleRef = useRef(1);
  // Sürükleme/konum geri çağrıları ilk render'da önbelleğe alınır; güncel tuval
  // ölçüsüne (w/h px, k içerik ölçeği, pad çevre boşluğu px) bu ref'ten erişir.
  const metricsRef = useRef({ w: 0, h: 0, k: 1, pad: 0 });

  /* ── Görsel havuzu (TMDB) ── */
  const [posterChoices, setPosterChoices] = useState(
    poster_path ? [poster_path] : []
  );
  const [backdropChoices, setBackdropChoices] = useState(
    backdrop_path ? [backdrop_path] : []
  );

  /* ── Arka plan & efektler ── */
  const [backgrounds, setBackgrounds] = useState(
    backdrop_path ? [backdrop_path] : []
  );
  const [scrim, setScrim] = useState(0.4);
  const [bgBlur, setBgBlur] = useState(0);
  const [bgRadius, setBgRadius] = useState(22);
  const [bgPadding, setBgPadding] = useState(0);
  // Arka plan görseli seçilmediğinde kullanılan zemin gradyanı renkleri;
  // üst null = tema varsayılanı (accent), alt null = siyah.
  const [bgColor, setBgColor] = useState(null);
  const [bgColorBottom, setBgColorBottom] = useState(null);
  const [posterLinked, setPosterLinked] = useState(false);

  /* ── Ekran ölçüleri: tuval, ayar sayfası, klavye ── */
  const { width: winW, height: winH } = useWindowDimensions();
  const winKey = `${winW}x${winH}`;
  // Kök görünüm ve tuval alanı ÖLÇÜLÜR; aynı pencere boyutunda yalnız büyürler
  // (Android'de klavye pencereyi geçici küçültünce tuval yeniden sığıp zıplamasın).
  const [rootBox, setRootBox] = useState(null);
  const [areaBox, setAreaBox] = useState(null);
  // Klavye açıkken { visibleH, rootH }: kökün klavyeyle örtüşmeyen yüksekliği.
  const [kb, setKb] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // İlk kare için tahmin (ölçüm gelince gerçek değer devralır).
  const topInset = Math.max(
    insets.top,
    Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0
  );
  const estAreaY = topInset + HEADER_EXTRA;
  // Buton satırı yüksekliği StoryActionBar ile AYNI hesaptan gelir (eşik tutmazsa
  // ilk karedeki tuval, ölçüm gelince sıçrar).
  const estBarH =
    1 +
    8 +
    planStoryActionBar(winW, {
      titles: [
        i18nText("autoI18n.tasarimi_paylas", "Tasarımı Paylaş"),
        i18nText("autoI18n.paylas", "Paylaş"),
      ],
      variantTitle: i18nText("autoI18n.tasarimi_paylas", "Tasarımı Paylaş"),
    }).rowH +
    Math.max(24, insets.bottom + 14);
  const area =
    areaBox && areaBox.key === winKey
      ? areaBox
      : { y: estAreaY, w: winW, h: Math.max(0, winH - estAreaY - estBarH) };
  const root = rootBox && rootBox.key === winKey ? rootBox : { w: winW, h: winH };

  const canvasFit = useMemo(
    () =>
      fitStoryCanvas(area.w, area.h, {
        sidePad: SIDE_PAD,
        topGap: CANVAS_TOP_GAP,
        bottomGap: CANVAS_BOTTOM_GAP,
      }),
    [area.w, area.h]
  );
  const CANVAS_W = canvasFit.w;
  const CANVAS_H = canvasFit.h;
  // İçerik (yazı, dolgu, köşe, filigran) bu çarpanla ölçeklenir; kaydedilen
  // değerler referans (360px tuval) biriminde kalır → taslaklar cihazlar arası taşınır.
  const k = storyScale(CANVAS_W);
  const padPx = bgPadding * k;
  metricsRef.current = { w: CANVAS_W, h: CANVAS_H, k, pad: padPx };

  const sheetPlan = planStorySheet({
    areaY: area.y,
    topGap: CANVAS_TOP_GAP,
    canvasH: CANVAS_H,
    containerH: root.h,
    preferredShrink: SHRINK_PREFERRED,
    // Kısa ekranda sayfa ekranın yarısını geçmesin: tuval ancak o zaman
    // düzenlerken görülebilecek kadar büyük kalır (568 dp'de 320 dp'lik sayfa
    // tuvali ~78 dp genişliğe indiriyordu).
    minSheetH: clamp(Math.round(root.h * 0.5), MIN_SHEET_H_FLOOR, MIN_SHEET_H),
  });
  const SHRINK = sheetPlan.shrink;
  let sheetTop = sheetPlan.sheetTop;
  let sheetBottom = 0;
  // Yalnız sayfa açıkken: kapalıyken (ör. taslak adı penceresinin klavyesi)
  // ekran dışına itilmiş sayfa klavyeyle birlikte yukarı kaymasın.
  if (kb && settingsOpen) {
    const lifted = liftSheetForKeyboard({
      sheetTop,
      containerH: kb.rootH,
      visibleH: kb.visibleH,
      minSheetH: 300,
      minTop: area.y,
    });
    sheetTop = lifted.top;
    sheetBottom = lifted.bottom;
  }
  const sheetW = Math.min(winW, 640);

  const onRootLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    setRootBox((p) => mergeBox(p, { w: width, h: height }, winKey));
  };
  const onAreaLayout = (e) => {
    const { y, width, height } = e.nativeEvent.layout;
    setAreaBox((p) => mergeBox(p, { y, w: width, h: height }, winKey));
  };

  /* Klavye: ayar sayfası klavyenin üstüne oturur (yazı kutusu örtülmesin). */
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const onShow = (e) => {
      const screenY = e?.endCoordinates?.screenY;
      rootRef.current?.measureInWindow?.((x, y, w, h) => {
        if (!h) return;
        const raw = Number.isFinite(screenY) ? screenY - y : h;
        if (raw >= h - 1) {
          setKb(null);
          return;
        }
        // Güvenlik: bozuk screenY tüm ekranı klavye saymasın.
        setKb({ visibleH: Math.max(h * 0.4, raw), rootH: h });
      });
    };
    const onHide = () => setKb(null);
    const subs = [
      Keyboard.addListener(ios ? "keyboardWillChangeFrame" : "keyboardDidShow", onShow),
      Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", onHide),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  /* ── Bloklar ── */
  const genreText = (genres || [])
    .slice(0, 3)
    .map((g) => (typeof g === "string" ? g : g?.name))
    .filter(Boolean)
    .join(" • ");

  const makeText = (text, opts = {}) => ({
    id: Math.random().toString(36).slice(2),
    type: "text",
    text,
    color: opts.color || "#FFFFFF",
    size: opts.size || 20,
    bold: opts.bold !== undefined ? opts.bold : true,
    italic: false,
    underline: false,
    align: opts.align || "center",
    font: opts.font || "system",
    x: opts.x ?? 0.1,
    y: opts.y ?? 0.5,
    width: opts.width ?? DEFAULTS.textWidth,
    // arka plan kutusu
    bg: false,
    bgColor: DEFAULTS.textBgColor,
    bgOpacity: DEFAULTS.textBgOpacity,
    radius: DEFAULTS.textRadius,
    padding: DEFAULTS.textPadding,
  });

  const [blocks, setBlocks] = useState(() => {
    const els = [];
    // Varsayılan: içerikler alt alta ve ortalı (genişliğe göre x ortalanır)
    const cx = (1 - DEFAULTS.textWidth) / 2; // ortalanmış yazı x'i
    if (poster_path)
      els.push({
        id: "poster",
        type: "image",
        path: poster_path,
        widthFrac: 0.42,
        radius: 12,
        x: (1 - 0.42) / 2,
        y: 0.1,
      });
    els.push(
      makeText(title, { size: storyTitleSize(title), bold: true, x: cx, y: 0.5 })
    );
    if (year || genreText)
      els.push(
        makeText([year, genreText].filter(Boolean).join("  •  "), {
          size: 14,
          bold: false,
          color: "#EAEAEA",
          x: cx,
          y: 0.61,
        })
      );
    if (rating > 0)
      els.push(
        makeText(`★ ${Number(rating).toFixed(1)}`, {
          size: 18,
          color: "#FFD700",
          x: cx,
          y: 0.69,
        })
      );
    return els;
  });

  const [activeTab, setActiveTab] = useState("background");
  const [selectedId, setSelectedId] = useState(null);
  const [watermarkPos, setWatermarkPos] = useState("bottom-right");
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  // Sticker modu: yakalama sırasında arka plan katmanları gizlenir, tuval
  // şeffaf olur → yalnızca içerik bloklarından oluşan saydam PNG çıkar.
  const [stickerCapturing, setStickerCapturing] = useState(false);
  const editRef = useRef(null);

  /* ── Taslak ── */
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState(params.draftId || null);

  /* ── Ayar modalı (alt sheet) + tuval küçülme animasyonu ── */
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const openSettings = () => {
    dragScaleRef.current = SHRINK;
    setSettingsOpen(true);
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 3,
      speed: 13,
    }).start();
  };
  const closeSettings = () => {
    dragScaleRef.current = 1;
    // Sayfa içindeki yazı kutusu odaktayken sayfa kapanırsa klavye açık kalıp
    // alt eylem çubuğunu örterdi.
    Keyboard.dismiss();
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setSettingsOpen(false));
  };

  /* Android geri tuşu: ayar sayfası açıkken önce onu kapatır (ekranı değil).
     Güncel durum ref'ten okunur; dinleyici odakta bir kez kurulur. */
  const backStateRef = useRef({ settingsOpen: false, close: closeSettings });
  backStateRef.current = { settingsOpen, close: closeSettings };
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!backStateRef.current.settingsOpen) return false;
        backStateRef.current.close();
        return true;
      });
      return () => sub.remove();
    }, [])
  );

  /* Sekme değişince ayar sayfası en üste döner: kısa sekmeye geçişte ScrollView
     eski kaydırma konumunu kırpıp içeriği sıçratmasın. */
  const sheetScrollRef = useRef(null);
  useEffect(() => {
    sheetScrollRef.current?.scrollTo?.({ y: 0, animated: false });
  }, [activeTab]);

  const canvasScale = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, SHRINK],
  });
  const canvasTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(CANVAS_H * (1 - SHRINK)) / 2],
  });
  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [sheetPlan.sheetH + 60, 0],
  });
  const actionBarOpacity = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const selected = blocks.find((b) => b.id === selectedId) || null;
  const posterBlock = blocks.find((b) => b.id === "poster") || null;
  const graphBlock = blocks.find((b) => b.id === "epgraph") || null;

  /* En güncel değerlere drag sırasında erişim */
  const dragStateRef = useRef({ blocks });
  useEffect(() => {
    dragStateRef.current = { blocks };
  });

  /* ── TMDB'den tüm poster/backdrop'lar ── */
  useEffect(() => {
    if (!id || !API_KEY) return;
    let active = true;
    (async () => {
      try {
        const res = await axios.get(
          `https://api.themoviedb.org/3/${type}/${id}/images?include_image_language=${imageLanguageOrder}`,
          { headers: { accept: "application/json", Authorization: API_KEY } }
        );
        if (!active) return;
        const posters = (res.data.posters || []).map((i) => i.file_path).slice(0, 30);
        const backdrops = (res.data.backdrops || []).map((i) => i.file_path).slice(0, 30);
        setPosterChoices((p) => Array.from(new Set([...p, ...posters])));
        setBackdropChoices((p) => Array.from(new Set([...p, ...backdrops])));

        // Varsayılan: ilk açılışta ilk 3 arka planı seç (taslak değilse)
        if (!params.draftId && !bgInitRef.current) {
          const mergedBd = Array.from(
            new Set([...(backdrop_path ? [backdrop_path] : []), ...backdrops])
          );
          if (mergedBd.length) {
            bgInitRef.current = true;
            setBackgrounds(mergedBd.slice(0, 3));
          }
        }
      } catch {
        /* sessiz */
      }
    })();
    return () => {
      active = false;
    };
  }, [id, type, API_KEY, imageLanguageOrder]);

  /* ── Taslak yükle (düzenleme) ── */
  useEffect(() => {
    if (!params.draftId) return;
    let active = true;
    (async () => {
      let d = null;
      try {
        d = await StoryDraftService.getDraftById(params.draftId);
      } catch {
        /* okunamayan taslak = bulunamayan taslak */
      }
      if (!active) return;
      if (!d) {
        // Taslak yok: varsayılan bloklar olduğu gibi gösterilsin (yığma yapılmaz).
        autoStackRef.current.pending = false;
        setStackReady(true);
        return;
      }
      const e = d.editor || {};
      if (Array.isArray(e.blocks)) setBlocks(e.blocks);
      if (Array.isArray(e.backgrounds)) setBackgrounds(e.backgrounds);
      if (typeof e.scrim === "number") setScrim(e.scrim);
      if (typeof e.bgBlur === "number") setBgBlur(e.bgBlur);
      if (typeof e.bgRadius === "number") setBgRadius(e.bgRadius);
      if (typeof e.bgPadding === "number") setBgPadding(e.bgPadding);
      if (typeof e.bgColor === "string") setBgColor(e.bgColor);
      if (typeof e.bgColorBottom === "string") setBgColorBottom(e.bgColorBottom);
      if (typeof e.posterLinked === "boolean") setPosterLinked(e.posterLinked);
      if (e.watermarkPos) setWatermarkPos(e.watermarkPos);
      setDraftName(d.name || "");
      setCurrentDraftId(d.id);
      // Taslak blokları yerleşip ölçülünce (runAutoStack) gösterilir.
      autoStackRef.current.draftApplied = true;
      scheduleAutoStack();
    })();
    return () => {
      active = false;
    };
  }, [params.draftId]);

  const openSaveModal = () => {
    setDraftName((n) => n || title || "Story");
    setSaveModalVisible(true);
  };

  const handleSaveDraft = async () => {
    if (!draftName.trim()) {
      Toast.show({ type: "warning", text1: i18nText("autoI18n.taslak_adi_gerekli", "Taslak adı gerekli") });
      return;
    }
    if (savingDraft) return;
    setSavingDraft(true);
    try {
      let thumbnailUri;
      try {
        setSelectedId(null);
        setCapturing(true);
        await new Promise((r) => requestAnimationFrame(() => r()));
        await new Promise((r) => setTimeout(r, 90));
        thumbnailUri = await captureRef(viewShotRef, {
          format: "jpg",
          quality: 0.4,
          result: "data-uri",
        });
      } catch {
        /* thumbnail opsiyonel */
      } finally {
        setCapturing(false);
      }

      const data = {
        name: draftName.trim(),
        params: { id, type, title, year, rating, genres, backdrop_path, poster_path },
        editor: {
          backgrounds,
          scrim,
          bgBlur,
          bgRadius,
          bgPadding,
          bgColor,
          bgColorBottom,
          posterLinked,
          blocks,
          watermarkPos,
        },
        thumbnailUri,
      };

      if (currentDraftId) {
        const upd = await StoryDraftService.updateDraft(currentDraftId, data);
        if (!upd) {
          const nd = await StoryDraftService.saveDraft(data);
          setCurrentDraftId(nd.id);
        }
        Toast.show({ type: "success", text1: i18nText("autoI18n.taslak_guncellendi", "Taslak güncellendi"), text2: data.name });
      } else {
        const nd = await StoryDraftService.saveDraft(data);
        setCurrentDraftId(nd.id);
        Toast.show({ type: "success", text1: i18nText("autoI18n.taslak_kaydedildi", "Taslak kaydedildi"), text2: data.name });
      }
      setSaveModalVisible(false);
    } catch (e) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.taslak_kaydedilemedi", "Taslak kaydedilemedi") });
    } finally {
      setSavingDraft(false);
    }
  };

  /* ── Konum yönetimi (kesir tabanlı) ── */
  const getPosition = useCallback((bid) => {
    if (!positionsRef.current[bid])
      positionsRef.current[bid] = new Animated.ValueXY();
    return positionsRef.current[bid];
  }, []);

  const syncPosition = useCallback(
    (block) => {
      const size = sizesRef.current[block.id] || { w: 0, h: 0 };
      const { w: cw, h: ch, pad } = metricsRef.current;
      const x = clamp(block.x * cw, pad, Math.max(pad, cw - size.w - pad));
      const y = clamp(block.y * ch, pad, Math.max(pad, ch - size.h - pad));
      getPosition(block.id).setValue({ x, y });
    },
    [getPosition]
  );

  /* Tuval ölçüsü ya da çevre boşluğu değişince blokları yeniden sınırla */
  useEffect(() => {
    blocks.forEach(syncPosition);
  }, [CANVAS_W, CANVAS_H, padPx]);

  useEffect(() => {
    blocks.forEach(syncPosition);
  }, [blocks, syncPosition]);

  /* ── İlk yerleşim: varsayılan blokları üst üste binmeden alt alta diz ──
     Bloklar sabit y oranlarıyla doğar; başlık uzunluğu/tuval boyutu/yazı
     ölçeği değişince bir önceki satırın üstüne binebilir. Tüm bloklar
     ölçülünce (taslak değilse) bir kez ölçülen yüksekliklerle dikey olarak
     yığılır; sığmazsa poster küçülür. O ana dek bloklar gizli tutulur.
     Taslakta yığma YOK ama gizleme var: taslak yüklenene dek ekranda
     varsayılan (üst üste binen) bloklar parlayıp sönmesin diye bloklar,
     taslak uygulanıp ölçülünce gösterilir. */
  const autoStackRef = useRef({
    pending: true,
    timer: null,
    draft: !!params.draftId,
    draftApplied: false,
  });
  const areaReadyRef = useRef(false);
  areaReadyRef.current = !!areaBox;
  const [stackReady, setStackReady] = useState(false);
  const runAutoStack = () => {
    const st = autoStackRef.current;
    if (!st.pending || !areaReadyRef.current) return;
    const list = dragStateRef.current.blocks;
    // Geç yığma: bloklar zaten gösterildi; kullanıcı dokunup düzeni değiştirdiyse bırak.
    if (st.fallbackBlocks && st.fallbackBlocks !== list) {
      st.pending = false;
      return;
    }
    const measured = list.every((b) => sizesRef.current[b.id]?.h > 0);
    if (st.draft) {
      if (!st.draftApplied || !measured) return;
      st.pending = false;
      setStackReady(true);
      return;
    }
    if (!list.length || !measured) return;
    st.pending = false;

    const m = metricsRef.current;
    const items = list.map((b) => ({
      id: b.id,
      h: sizesRef.current[b.id].h,
      flex: b.id === "poster",
    }));
    const { tops, resized } = stackBlocksVertically(items, m.h, {
      gap: 10 * m.k,
      marginTop: Math.max(0.06 * m.h, 24 * m.k),
      // alt boşluk filigranı da içerir (36 logo + 12 kenar)
      marginBottom: Math.max(0.06 * m.h, 56 * m.k),
      minFlexH: 0.18 * m.w * 1.5,
    });
    setBlocks((prev) =>
      prev.map((b) => {
        if (tops[b.id] === undefined) return b;
        const patch = { y: tops[b.id] / m.h };
        if (b.id === "poster" && resized.poster !== undefined) {
          const wf = clamp(resized.poster / 1.5 / m.w, 0.18, 0.95);
          patch.widthFrac = wf;
          patch.x = (1 - wf) / 2;
        }
        return { ...b, ...patch };
      })
    );
    // Hemen göstermek (setStackReady) bir kare boyunca blokları ESKİ konumda
    // görünür yapıyordu: yeni konumlar Animated değerlerine bir efektte
    // yazılıyor. Konumlar yazıldıktan sonra gösterilir (aşağıdaki efekt).
    st.reveal = true;
  };
  useEffect(() => {
    if (autoStackRef.current.reveal) setStackReady(true);
  }, [blocks]);
  // Her ölçüm olayında kısa bir gecikmeyle dener: aynı karedeki tüm blok
  // ölçümleri ve tuval alanı ölçümü geldikten sonra, güncel yüksekliklerle çalışır.
  const scheduleAutoStack = () => {
    const st = autoStackRef.current;
    if (!st.pending) return;
    clearTimeout(st.timer);
    st.timer = setTimeout(runAutoStack, 90);
  };
  // Tuval alanı ölçüldüğünde (bloklar ondan önce ölçülmüş olabilir) bir deneme daha.
  useEffect(() => {
    if (areaBox) scheduleAutoStack();
  }, [areaBox]);
  // Ölçüm hiç tamamlanmazsa içerik sonsuza dek gizli kalmasın. Yığma İPTAL
  // EDİLMEZ: yavaş cihazda ölçüm 1.2 sn'den geç gelirse bloklar yine üst üste
  // binmeden dizilir. Kullanıcı bu arada bir bloğa dokunduysa (blocks dizisi
  // değiştiyse) onun düzeni ezilmez — runAutoStack bunu `fallbackBlocks` ile ayırır.
  useEffect(() => {
    if (stackReady) return;
    const timer = setTimeout(() => {
      autoStackRef.current.fallbackBlocks = dragStateRef.current.blocks;
      setStackReady(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [stackReady]);
  useEffect(() => () => clearTimeout(autoStackRef.current.timer), []);

  /* Poster yuvarlaklığını arka plana bağla (padding hesaba katılır) */
  useEffect(() => {
    if (!posterLinked) return;
    const r = clamp(bgRadius - bgPadding, 0, 60);
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === "poster" && b.radius !== r ? { ...b, radius: r } : b
      )
    );
  }, [posterLinked, bgRadius, bgPadding]);

  const bringToFront = useCallback((bid) => {
    setSelectedId(bid);
    setBlocks((prev) => {
      const target = prev.find((b) => b.id === bid);
      if (!target) return prev;
      return [...prev.filter((b) => b.id !== bid), target];
    });
  }, []);

  const makeResponder = useCallback(
    (bid) => {
      if (!respondersRef.current[bid]) {
        respondersRef.current[bid] = PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: (_, g) =>
            Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
          onPanResponderGrant: () => {
            bringToFront(bid);
            getPosition(bid).stopAnimation((v) => {
              dragStartRef.current = v;
            });
          },
          onPanResponderMove: (_, g) => {
            const size = sizesRef.current[bid] || { w: 0, h: 0 };
            const { w: cw, h: ch, pad } = metricsRef.current;
            const s = dragScaleRef.current || 1;
            const nx = clamp(
              dragStartRef.current.x + g.dx / s,
              pad,
              Math.max(pad, cw - size.w - pad)
            );
            const ny = clamp(
              dragStartRef.current.y + g.dy / s,
              pad,
              Math.max(pad, ch - size.h - pad)
            );
            getPosition(bid).setValue({ x: nx, y: ny });
          },
          onPanResponderRelease: (_, g) => {
            const size = sizesRef.current[bid] || { w: 0, h: 0 };
            const { w: cw, h: ch, pad } = metricsRef.current;
            const s = dragScaleRef.current || 1;
            const nx = clamp(
              dragStartRef.current.x + g.dx / s,
              pad,
              Math.max(pad, cw - size.w - pad)
            );
            const ny = clamp(
              dragStartRef.current.y + g.dy / s,
              pad,
              Math.max(pad, ch - size.h - pad)
            );
            getPosition(bid).setValue({ x: nx, y: ny });
            setBlocks((prev) =>
              prev.map((b) =>
                b.id === bid ? { ...b, x: nx / cw, y: ny / ch } : b
              )
            );
          },
        });
      }
      return respondersRef.current[bid];
    },
    [bringToFront, getPosition]
  );

  /* ── Blok yardımcıları ── */
  const updateBlock = (bid, patch) =>
    setBlocks((prev) => prev.map((b) => (b.id === bid ? { ...b, ...patch } : b)));
  const updateSelected = (patch) => selectedId && updateBlock(selectedId, patch);

  const deleteBlock = (bid) => {
    setBlocks((prev) => prev.filter((b) => b.id !== bid));
    delete positionsRef.current[bid];
    delete respondersRef.current[bid];
    delete sizesRef.current[bid];
    if (bid === selectedId) setSelectedId(null);
  };

  const addText = () => {
    const el = makeText("", { x: 0.2, y: 0.45, size: 22 });
    setBlocks((prev) => [...prev, el]);
    setSelectedId(el.id);
    setActiveTab("style");
    setTimeout(() => editRef.current?.focus(), 200);
  };

  const setPosterImage = (path) => {
    setBlocks((prev) => {
      if (prev.some((b) => b.id === "poster"))
        return prev.map((b) => (b.id === "poster" ? { ...b, path } : b));
      return [
        { id: "poster", type: "image", path, widthFrac: 0.42, radius: 12, x: 0.29, y: 0.08 },
        ...prev,
      ];
    });
  };

  /* ── Bölüm Graph ekle (yalnızca dizi) ──
     Tüm sezonların bölüm puanları TMDB'den çekilir ve blokta gömülü
     saklanır; graph tuvale sürüklenebilir/boyutlanabilir blok olarak iner. */
  const [graphLoading, setGraphLoading] = useState(false);
  const addEpisodeGraph = async () => {
    if (graphLoading || blocks.some((b) => b.id === "epgraph")) return;
    setGraphLoading(true);
    try {
      const showRes = await axios.get(
        `https://api.themoviedb.org/3/tv/${id}`,
        { headers: { accept: "application/json", Authorization: API_KEY } }
      );
      const seasons = (showRes.data.seasons || []).filter(
        (s) => s.season_number > 0
      );
      if (!seasons.length) throw new Error("no-seasons");
      const data = await Promise.all(
        seasons.map(async (s) => {
          const res = await axios.get(
            `https://api.themoviedb.org/3/tv/${id}/season/${s.season_number}`,
            { headers: { accept: "application/json", Authorization: API_KEY } }
          );
          return {
            s: s.season_number,
            r: (res.data.episodes || []).map((ep) => ep.vote_average || 0),
          };
        })
      );

      // Başlangıç genişliği: graph yüksekliği tuvalin ~%55'ini aşmasın.
      const S = data.length;
      const maxE = Math.max(...data.map((d) => d.r.length), 1);
      let widthFrac = DEFAULTS.graphWidth;
      const estH = ((widthFrac * CANVAS_W) / S) * maxE;
      const maxH = CANVAS_H * 0.55;
      if (estH > maxH)
        widthFrac = clamp(
          (maxH * S) / (maxE * CANVAS_W),
          0.2,
          DEFAULTS.graphWidth
        );

      const el = {
        id: "epgraph",
        type: "graph",
        data,
        widthFrac,
        radius: DEFAULTS.graphRadius,
        x: (1 - widthFrac) / 2,
        y: 0.16,
      };
      setBlocks((prev) => [...prev, el]);
      setSelectedId("epgraph");
    } catch {
      Toast.show({
        type: "error",
        text1: i18nText(
          "autoI18n.bolum_verisi_alinamadi",
          "Bölüm verisi alınamadı"
        ),
      });
    } finally {
      setGraphLoading(false);
    }
  };

  const MAX_BACKGROUNDS = 5;
  const toggleBackground = (path) =>
    setBackgrounds((prev) => {
      if (prev.includes(path)) return prev.filter((p) => p !== path);
      if (prev.length >= MAX_BACKGROUNDS) {
        Toast.show({
          type: "warning",
          text1: i18nText(
            "autoI18n.en_fazla_n_arka_plan",
            "En fazla {{count}} arka plan eklenebilir",
            { count: MAX_BACKGROUNDS },
          ),
        });
        return prev;
      }
      return [...prev, path];
    });


  /* ── Yakalama ── */
  const capture = async (asSticker = false) => {
    setSelectedId(null);
    setCapturing(true);
    if (asSticker) setStickerCapturing(true);
    await new Promise((r) => requestAnimationFrame(() => r()));
    await new Promise((r) => setTimeout(r, 120));
    try {
      return await captureRef(viewShotRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
    } finally {
      setCapturing(false);
      if (asSticker) setStickerCapturing(false);
    }
  };

  const handleShare = async () => {
    try {
      setBusy(true);
      const uri = await capture();
      if (!(await Sharing.isAvailableAsync())) {
        Toast.show({ type: "error", text1: i18nText("autoI18n.paylasim_kullanilamiyor", "Paylaşım kullanılamıyor") });
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: title });
    } catch (e) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.paylasim_hatasi", "Paylaşım hatası: ") + e.message });
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    try {
      setBusy(true);
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== "granted") {
        Toast.show({ type: "error", text1: i18nText("autoI18n.galeri_izni_gerekli", "Galeri izni gerekli") });
        return;
      }
      const uri = await capture();
      await saveToLibraryAsync(uri);
      Toast.show({ type: "success", text1: i18nText("autoI18n.galeriye_kaydedildi", "Galeriye kaydedildi") });
    } catch (e) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.kaydetme_hatasi", "Kaydetme hatası: ") + e.message });
    } finally {
      setBusy(false);
    }
  };

  /* Sticker: içerik blokları saydam zeminli PNG olarak paylaşılır.
     Instagram/WhatsApp'ta galeri-çıkartma özelliğiyle story üzerine
     yerleştirilebilir (saydamlık korunur). */
  const handleShareSticker = async () => {
    try {
      setBusy(true);
      const uri = await capture(true);
      if (!(await Sharing.isAvailableAsync())) {
        Toast.show({
          type: "error",
          text1: i18nText(
            "autoI18n.paylasim_kullanilamiyor",
            "Paylaşım kullanılamıyor",
          ),
        });
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: title,
      });
    } catch (e) {
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.paylasim_hatasi", "Paylaşım hatası: ") + e.message,
      });
    } finally {
      setBusy(false);
    }
  };

  /* ── Render: tuval ── */
  const renderBlock = (block) => {
    const position = getPosition(block.id);
    const responder = makeResponder(block.id);
    const isSel = selectedId === block.id && !capturing;
    // Köşe/dolgu/yazı referans (360px tuval) biriminde saklanır; çizimde k ile
    // ölçeklenir → küçük ve büyük telefonda aynı oranlı, üst üste binmeyen görünüm.
    const radiusPx = (block.radius || 0) * k;
    return (
      <Animated.View
        key={block.id}
        onLayout={(e) => {
          sizesRef.current[block.id] = {
            w: e.nativeEvent.layout.width,
            h: e.nativeEvent.layout.height,
          };
          if (selectedId !== block.id) syncPosition(block);
          scheduleAutoStack();
        }}
        style={[
          position.getLayout(),
          // İlk yerleşim bitene dek gizli: bloklar sıçrayarak oturmasın.
          { position: "absolute", opacity: stackReady ? 1 : 0 },
          isSel && {
            borderWidth: 1.5,
            borderColor: "#ffffffdd",
            borderStyle: "dashed",
            borderRadius: radiusPx + (block.type === "image" ? 2 : 0),
          },
        ]}
        {...responder.panHandlers}
      >
        {block.type === "image" ? (
          <Image
            source={{ uri: hqUrl(block.path, "poster") }}
            style={{
              width: block.widthFrac * CANVAS_W,
              height: block.widthFrac * CANVAS_W * 1.5,
              borderRadius: radiusPx,
            }}
          />
        ) : block.type === "graph" ? (
          <EpisodeGraph block={block} width={block.widthFrac * CANVAS_W} />
        ) : (
          <View>
            {block.bg && (
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: hexA(block.bgColor, block.bgOpacity),
                    borderRadius: radiusPx,
                  },
                ]}
              />
            )}
            {/* Tuval yazısı sistem yazı boyutu ayarından etkilenmez: dışa aktarılan
                görsel ve blok yerleşimi her cihazda aynı kalır. */}
            <Text
              allowFontScaling={false}
              style={{
                color: block.color,
                fontSize: block.size * k,
                fontFamily: fontFamilyOf(block.font),
                fontWeight: block.bold ? "900" : "600",
                fontStyle: block.italic ? "italic" : "normal",
                textDecorationLine: block.underline ? "underline" : "none",
                textAlign: block.align,
                width: CANVAS_W * (block.width ?? DEFAULTS.textWidth),
                paddingHorizontal: block.padding * k,
                paddingVertical: block.padding * 0.7 * k,
                textShadowColor: block.bg ? "transparent" : "rgba(0,0,0,0.55)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 5 * k,
              }}
            >
              {block.text || (isSel ? "Yaz..." : " ")}
            </Text>
          </View>
        )}
      </Animated.View>
    );
  };

  return (
    <View
      ref={rootRef}
      collapsable={false}
      onLayout={onRootLayout}
      style={[styles.root, { backgroundColor: theme.primary }]}
    >
      <StatusBar barStyle={isLightSurface(theme.primary) ? "dark-content" : "light-content"} />
      <StoryHeader
        busy={busy}
        onBack={() => navigation.goBack()}
        onOpenDrafts={() => {
          Keyboard.dismiss();
          navigation.navigate("StoryDraftsScreen");
        }}
        onSaveDraft={openSaveModal}
      />

      {/* ══════ TUVAL (modal açılınca küçülür) ══════ */}
      <View style={styles.canvasArea} onLayout={onAreaLayout}>
        <Animated.View
          style={[
            styles.canvasShadow,
            { transform: [{ translateY: canvasTranslateY }, { scale: canvasScale }] },
          ]}
        >
          <ViewShot
            ref={viewShotRef}
            options={{ format: "png", quality: 1 }}
            style={[
              styles.canvas,
              {
                width: CANVAS_W,
                height: CANVAS_H,
                borderRadius: bgRadius * k,
                // Sticker yakalamada tuval saydam — PNG alfa kanalı korunur.
                backgroundColor: stickerCapturing ? "transparent" : "#000",
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={StyleSheet.absoluteFill}
              onPress={() => setSelectedId(null)}
            >
              <View
                style={{
                  position: "absolute",
                  top: padPx,
                  left: padPx,
                  right: padPx,
                  bottom: padPx,
                  borderRadius: Math.max(0, bgRadius - bgPadding) * k,
                  overflow: "hidden",
                  // Sticker yakalamada arka plan katmanları gizlenir.
                  opacity: stickerCapturing ? 0 : 1,
                }}
              >
                {backgrounds.length > 0 ? (
                  <View style={[StyleSheet.absoluteFill, { flexDirection: "column" }]}>
                    {backgrounds.map((bg, i) => (
                      <Image
                        key={bg + i}
                        source={{ uri: hqUrl(bg, "backdrop") }}
                        style={{ flex: 1, width: "100%", height: undefined }}
                        resizeMode="cover"
                        blurRadius={bgBlur}
                      />
                    ))}
                  </View>
                ) : (
                  <LinearGradient
                    colors={
                      bgColor || bgColorBottom
                        ? [
                            bgColor ?? theme.accent + "AA",
                            bgColorBottom ?? "#000000",
                          ]
                        : [theme.accent + "AA", theme.primary, "#000"]
                    }
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <View
                  style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${scrim})` }]}
                />
              </View>
            </TouchableOpacity>

            {blocks.map(renderBlock)}

            {/* Filigran (sabit, zorunlu) */}
            <View
              style={[
                styles.watermark,
                wmStyle(watermarkPos, 12 * k),
                {
                  paddingLeft: 2 * k,
                  paddingRight: 8 * k,
                  borderRadius: 22 * k,
                },
              ]}
              pointerEvents="none"
            >
              <Image
                source={appLogo}
                style={{ width: 36 * k, height: 36 * k }}
                resizeMode="contain"
              />
              <Text allowFontScaling={false} style={[styles.wmText, { fontSize: 12 * k }]}>
                Seelogd
              </Text>
            </View>
          </ViewShot>
        </Animated.View>
      </View>

      {/* ══════ ALT EYLEM (paylaş + düzenle) ══════ */}
      <Animated.View
        style={[
          styles.bottomBar,
          {
            borderTopColor: theme.border,
            opacity: actionBarOpacity,
            paddingBottom: Math.max(24, insets.bottom + 14),
          },
        ]}
        pointerEvents={settingsOpen ? "none" : "auto"}
      >
        <StoryActionBar
          busy={busy}
          onShare={handleShare}
          onShareSticker={handleShareSticker}
          onOpenSettings={openSettings}
          onSaveImage={handleSave}
        />
      </Animated.View>

      {/* ══════ AYAR MODALI (alt sheet) ══════ */}
      <Animated.View
        pointerEvents={settingsOpen ? "auto" : "none"}
        style={[
          styles.sheet,
          {
            top: sheetTop,
            // Klavye açıkken sayfanın altı klavyenin üst kenarına oturur.
            bottom: sheetBottom,
            // Tabletlerde/katlanırda sayfa tam genişliğe yayılmaz.
            left: (winW - sheetW) / 2,
            right: (winW - sheetW) / 2,
            backgroundColor: theme.primary,
            borderColor: theme.border,
            transform: [{ translateY: sheetTranslateY }],
          },
        ]}
      >
        <View style={styles.sheetHeader}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          <View style={styles.sheetTitleRow}>
            <Text
              allowFontScaling={false}
              style={[styles.sheetTitle, { color: theme.text.primary }]}
            >{i18nText("autoI18n.duzenle", "Düzenle")}</Text>
            <GlassCloseButton
              icon="chevron-down"
              size={36}
              fallbackRadius={12}
              iconSize={22}
              color={theme.text.primary}
              backgroundColor={theme.secondary}
              accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
              onPress={closeSettings}
            />
          </View>
        </View>

        <View style={styles.sheetTabs}>
          <StoryTabs activeTab={activeTab} onChangeTab={setActiveTab} />
        </View>

        <ScrollView
          ref={sheetScrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.sheetScroll,
            { paddingBottom: 34 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── ARKA PLAN ── */}
          {activeTab === "background" && (
            <View>
              <Label theme={theme}>
                {i18nText("autoI18n.arka_plan_stack", "Arka Plan ({{count}}/{{max}} — alt alta dizilir)", {
                  count: backgrounds.length,
                  max: MAX_BACKGROUNDS,
                })}
              </Label>
              <FlatList
                data={backdropChoices}
                keyExtractor={(p) => p}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbRow}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={5}
                removeClippedSubviews
                renderItem={({ item: path }) => {
                  const order = backgrounds.indexOf(path);
                  const active = order !== -1;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => toggleBackground(path)}
                      style={[
                        styles.bdThumb,
                        active && { borderColor: theme.accent, borderWidth: 2.5 },
                      ]}
                    >
                      <Image
                        source={{ uri: getTmdbUrl(path, "backdrop", 300) }}
                        style={StyleSheet.absoluteFill}
                      />
                      {active && (
                        <View style={[styles.orderBadge, { backgroundColor: theme.accent }]}>
                          <Text style={styles.orderBadgeText}>{order + 1}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />

              {/* Görsel seçilmediğinde zemin gradyanının üst/alt renkleri */}
              {backgrounds.length === 0 && (
                <>
                  <View style={[styles.ctrlHead, { marginTop: 14 }]}>
                    <Text
                      allowFontScaling={false}
                      style={[styles.ctrlLabel, { color: theme.text.muted }]}
                    >
                      {i18nText("autoI18n.zemin_rengi_ust", "Zemin Rengi (Üst)")}
                    </Text>
                    <ResetBtn theme={theme} onPress={() => setBgColor(null)} />
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    <HexColorInput
                      theme={theme}
                      color={bgColor}
                      onChange={setBgColor}
                    />
                    {/* Tema varsayılanı (accent gradyanı) */}
                    <TouchableOpacity
                      onPress={() => setBgColor(null)}
                      style={[
                        styles.swatch,
                        { backgroundColor: theme.accent },
                        bgColor === null && {
                          borderColor: theme.accent,
                          borderWidth: 3,
                        },
                      ]}
                    >
                      <Ionicons
                        name="color-wand"
                        size={14}
                        color="#fff"
                        style={{ alignSelf: "center", marginTop: 7 }}
                      />
                    </TouchableOpacity>
                    {BG_COLORS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setBgColor(c)}
                        style={[
                          styles.swatch,
                          { backgroundColor: c },
                          bgColor === c && {
                            borderColor: theme.accent,
                            borderWidth: 3,
                          },
                        ]}
                      />
                    ))}
                  </ScrollView>

                  <View style={[styles.ctrlHead, { marginTop: 12 }]}>
                    <Text
                      allowFontScaling={false}
                      style={[styles.ctrlLabel, { color: theme.text.muted }]}
                    >
                      {i18nText("autoI18n.zemin_rengi_alt", "Zemin Rengi (Alt)")}
                    </Text>
                    <ResetBtn
                      theme={theme}
                      onPress={() => setBgColorBottom(null)}
                    />
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    <HexColorInput
                      theme={theme}
                      color={bgColorBottom}
                      onChange={setBgColorBottom}
                    />
                    {BG_COLORS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setBgColorBottom(c)}
                        style={[
                          styles.swatch,
                          { backgroundColor: c },
                          bgColorBottom === c && {
                            borderColor: theme.accent,
                            borderWidth: 3,
                          },
                        ]}
                      />
                    ))}
                  </ScrollView>
                </>
              )}

              <SliderControl
                theme={theme}
                icon="contrast-outline"
                label={i18nText("autoI18n.karartma", "Karartma")}
                value={scrim}
                min={0}
                max={0.85}
                step={0.05}
                decimals={2}
                onChange={setScrim}
                onReset={() => setScrim(DEFAULTS.scrim)}
              />
              <SliderControl
                theme={theme}
                icon="cloud-outline"
                label={i18nText("autoI18n.bulaniklik", "Bulanıklık")}
                value={bgBlur}
                min={0}
                max={20}
                step={1}
                onChange={setBgBlur}
                onReset={() => setBgBlur(DEFAULTS.bgBlur)}
              />
              <SliderControl
                theme={theme}
                icon="square-outline"
                label={i18nText("autoI18n.kose_yuvarlakligi", "Köşe Yuvarlaklığı")}
                value={bgRadius}
                min={0}
                max={48}
                step={1}
                onChange={setBgRadius}
                onReset={() => setBgRadius(DEFAULTS.bgRadius)}
              />
              <SliderControl
                theme={theme}
                icon="scan-outline"
                label={i18nText("autoI18n.cevre_boslugu_icerik_kenar_mesafesi", "Çevre Boşluğu (içerik kenar mesafesi)")}
                value={bgPadding}
                min={0}
                max={40}
                step={1}
                onChange={setBgPadding}
                onReset={() => setBgPadding(DEFAULTS.bgPadding)}
              />
            </View>
          )}

          {/* ── POSTER ── */}
          {activeTab === "poster" && (
            <View>
              <Label theme={theme}>{i18nText("autoI18n.poster_sec", "Poster Seç")}</Label>
              <FlatList
                data={posterChoices}
                keyExtractor={(p) => p}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbRow}
                initialNumToRender={5}
                maxToRenderPerBatch={6}
                windowSize={5}
                removeClippedSubviews
                renderItem={({ item: path }) => {
                  const active = blocks.some(
                    (b) => b.id === "poster" && b.path === path
                  );
                  return (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setPosterImage(path)}
                      style={[
                        styles.posterThumb,
                        active && { borderColor: theme.accent, borderWidth: 2.5 },
                      ]}
                    >
                      <Image
                        source={{ uri: getTmdbUrl(path, "poster", 185) }}
                        style={StyleSheet.absoluteFill}
                      />
                      {active && (
                        <View style={[styles.posterCheck, { backgroundColor: theme.accent }]}>
                          <Ionicons name="checkmark" size={13} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
              {!blocks.some((b) => b.id === "poster") && poster_path && (
                <GlassTouchable
                  style={[styles.addBtn, { backgroundColor: theme.secondary, borderColor: theme.border, borderWidth: 1, marginTop: 14 }]}
                  onPress={() => setPosterImage(poster_path)}
                >
                  <Ionicons name="image" size={18} color={theme.accent} />
                  <Text style={[styles.addBtnText, { color: theme.text.primary }]}>{i18nText("autoI18n.posteri_geri_ekle", "Posteri Geri Ekle")}</Text>
                </GlassTouchable>
              )}

              {/* Poster özelleştirme (eskiden Stil sekmesindeydi) */}
              {posterBlock && (
                <>
                  <SliderControl
                    theme={theme}
                    icon="resize-outline"
                    label={i18nText("autoI18n.poster_boyutu", "Poster Boyutu")}
                    value={posterBlock.widthFrac}
                    min={0.18}
                    max={0.95}
                    step={0.02}
                    decimals={2}
                    onChange={(v) => updateBlock("poster", { widthFrac: v })}
                    onReset={() => updateBlock("poster", { widthFrac: DEFAULTS.posterWidth })}
                  />
                  <SliderControl
                    theme={theme}
                    icon="square-outline"
                    label={
                      posterLinked
                        ? i18nText("autoI18n.corner_radius_linked", "Köşe Yuvarlaklığı — bağlı")
                        : i18nText("autoI18n.kose_yuvarakligi", "Köşe Yuvarlaklığı")
                    }
                    value={posterBlock.radius}
                    min={0}
                    max={48}
                    step={1}
                    disabled={posterLinked}
                    onChange={(v) => updateBlock("poster", { radius: v })}
                    onReset={() => updateBlock("poster", { radius: DEFAULTS.posterRadius })}
                  />
                  <View style={styles.toolRow}>
                    <Tool
                      theme={theme}
                      icon="link"
                      active={posterLinked}
                      label={posterLinked ? i18nText("autoI18n.arka_plana_bagli", "Arka plana bağlı") : i18nText("autoI18n.arka_plana_bagla", "Arka plana bağla")}
                      onPress={() => setPosterLinked((v) => !v)}
                    />
                    <Tool theme={theme} icon="trash-outline" danger onPress={() => deleteBlock("poster")} />
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── İÇERİKLER ── */}
          {activeTab === "content" && (
            <View>
              <View style={styles.addRow}>
                <GlassTouchable
                  style={[styles.addBtn, { backgroundColor: theme.accent }]}
                  onPress={addText}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.addBtnText}>{i18nText("autoI18n.yazi_ekle", "Yazı Ekle")}</Text>
                </GlassTouchable>
                {!blocks.some((b) => b.id === "poster") && poster_path && (
                  <GlassTouchable
                    style={[styles.addBtn, { backgroundColor: theme.secondary, borderColor: theme.border, borderWidth: 1 }]}
                    onPress={() => setPosterImage(poster_path)}
                  >
                    <Ionicons name="image" size={18} color={theme.accent} />
                    <Text style={[styles.addBtnText, { color: theme.text.primary }]}>{i18nText("autoI18n.poster_ekle", "Poster Ekle")}</Text>
                  </GlassTouchable>
                )}
              </View>

              {/* Bölüm Graph — yalnızca dizilerde, tek örnek */}
              {type === "tv" && !graphBlock && (
                <GlassTouchable
                  style={[
                    styles.addBtn,
                    {
                      backgroundColor: theme.secondary,
                      borderColor: theme.border,
                      borderWidth: 1,
                      marginBottom: 6,
                    },
                  ]}
                  onPress={addEpisodeGraph}
                  disabled={graphLoading}
                >
                  {graphLoading ? (
                    <ActivityIndicator size="small" color={theme.accent} />
                  ) : (
                    <Ionicons name="grid" size={18} color={theme.accent} />
                  )}
                  <Text style={[styles.addBtnText, { color: theme.text.primary }]}>
                    {i18nText("autoI18n.bolum_graph_ekle", "Bölüm Graph Ekle")}
                  </Text>
                </GlassTouchable>
              )}

              {blocks.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedId(b.id);
                    if (b.type === "text") setActiveTab("style");
                    else if (b.type === "image") setActiveTab("poster");
                    // graph: kontrolleri bu sekmede (aşağıda) — sekme değişmez
                  }}
                  style={[
                    styles.blockRow,
                    {
                      backgroundColor: theme.secondary,
                      borderColor: selectedId === b.id ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      b.type === "image"
                        ? "image-outline"
                        : b.type === "graph"
                          ? "grid-outline"
                          : "text-outline"
                    }
                    size={18}
                    color={theme.accent}
                  />
                  <Text
                    numberOfLines={1}
                    style={[styles.blockRowText, { color: theme.text.primary }]}
                  >
                    {b.type === "image"
                      ? "Poster"
                      : b.type === "graph"
                        ? i18nText("autoI18n.bolum_graph", "Bölüm Graph")
                        : b.text || i18nText("autoI18n.bos_yazi", "Boş yazı")}
                  </Text>
                  <TouchableOpacity
                    onPress={() => deleteBlock(b.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#e53935" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}

              {/* Bölüm Graph özelleştirme — poster sekmesindeki desenle aynı */}
              {graphBlock && (
                <>
                  <SliderControl
                    theme={theme}
                    icon="resize-outline"
                    label={i18nText("autoI18n.graph_boyutu", "Graph Boyutu")}
                    value={graphBlock.widthFrac}
                    min={0.18}
                    max={0.95}
                    step={0.02}
                    decimals={2}
                    onChange={(v) => updateBlock("epgraph", { widthFrac: v })}
                    onReset={() =>
                      updateBlock("epgraph", { widthFrac: DEFAULTS.graphWidth })
                    }
                  />
                  <SliderControl
                    theme={theme}
                    icon="square-outline"
                    label={i18nText(
                      "autoI18n.kare_yuvarlakligi",
                      "Kare Yuvarlaklığı"
                    )}
                    value={graphBlock.radius}
                    min={0}
                    max={24}
                    step={1}
                    onChange={(v) => updateBlock("epgraph", { radius: v })}
                    onReset={() =>
                      updateBlock("epgraph", { radius: DEFAULTS.graphRadius })
                    }
                  />
                </>
              )}
            </View>
          )}

          {/* ── STİL ── */}
          {activeTab === "style" && (
            <View>
              {selected && selected.type === "text" ? (
                <>
                  <GlassTextInput
                    ref={editRef}
                    value={selected.text}
                    onChangeText={(txt) => updateSelected({ text: txt })}
                    maxLength={200}
                    placeholder={i18nText("autoI18n.yazini_gir", "Yazını gir...")}
                    placeholderTextColor={theme.text.muted}
                    multiline
                    style={[
                      styles.editInput,
                      {
                        color: theme.text.primary,
                        borderColor: theme.border,
                        backgroundColor: theme.secondary,
                        fontFamily: fontFamilyOf(selected.font),
                      },
                    ]}
                  />
                  <View style={[styles.ctrlHead, { marginTop: 14 }]}>
                    <Text allowFontScaling={false} style={[styles.ctrlLabel, { color: theme.text.muted }]}>
                      {i18nText("autoI18n.renk", "Renk")}
                    </Text>
                    <ResetBtn theme={theme} onPress={() => updateSelected({ color: DEFAULTS.textColor })} />
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    <HexColorInput
                      theme={theme}
                      color={selected.color}
                      onChange={(c) => updateSelected({ color: c })}
                    />
                    {TEXT_COLORS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => updateSelected({ color: c })}
                        style={[
                          styles.swatch,
                          { backgroundColor: c },
                          selected.color === c && { borderColor: theme.accent, borderWidth: 3 },
                        ]}
                      />
                    ))}
                  </ScrollView>

                  <Label theme={theme}>{i18nText("autoI18n.yazi_tipi", "Yazı Tipi")}</Label>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {FONTS.map((f) => {
                      const active = (selected.font || "system") === f.id;
                      return (
                        <GlassTouchable
                          key={f.id}
                          activeOpacity={0.8}
                          onPress={() => updateSelected({ font: f.id })}
                          style={[
                            styles.fontChip,
                            {
                              backgroundColor: theme.secondary,
                              borderColor: active ? theme.accent : theme.border,
                              borderWidth: active ? 2 : 1,
                            },
                          ]}
                        >
                          <Text
                            allowFontScaling={false}
                            style={{ color: theme.text.primary, fontSize: 20, fontFamily: fontFamilyOf(f.id) }}
                          >
                            Aa
                          </Text>
                          <Text
                            allowFontScaling={false}
                            style={{
                              color: active ? theme.accent : theme.text.muted,
                              fontSize: 10,
                              fontWeight: "700",
                              marginTop: 2,
                            }}
                          >
                            {f.name}
                          </Text>
                        </GlassTouchable>
                      );
                    })}
                  </ScrollView>

                  <SliderControl
                    theme={theme}
                    icon="text"
                    label={i18nText("autoI18n.boyut", "Boyut")}
                    value={selected.size}
                    min={10}
                    max={80}
                    step={1}
                    onChange={(v) => updateSelected({ size: v })}
                    onReset={() => updateSelected({ size: DEFAULTS.textSize })}
                  />
                  <SliderControl
                    theme={theme}
                    icon="resize-outline"
                    label={i18nText("autoI18n.genislik", "Genişlik")}
                    value={selected.width}
                    min={0.2}
                    max={1}
                    step={0.05}
                    decimals={2}
                    onChange={(v) => updateSelected({ width: v })}
                    onReset={() => updateSelected({ width: DEFAULTS.textWidth })}
                  />

                  <View style={styles.toolRow}>
                    <Tool theme={theme} icon="text" active={selected.bold} onPress={() => updateSelected({ bold: !selected.bold })} />
                    <Tool theme={theme} label={i18nText("autoI18n.italic_short", "İ")} active={selected.italic} italic onPress={() => updateSelected({ italic: !selected.italic })} />
                    <Tool theme={theme} label="U" active={selected.underline} underline onPress={() => updateSelected({ underline: !selected.underline })} />
                    <View style={{ width: 8 }} />
                    <Tool theme={theme} icon="menu-outline" active={selected.align === "left"} onPress={() => updateSelected({ align: "left" })} />
                    <Tool theme={theme} icon="reorder-three-outline" active={selected.align === "center"} onPress={() => updateSelected({ align: "center" })} />
                    <Tool theme={theme} icon="menu-outline" active={selected.align === "right"} onPress={() => updateSelected({ align: "right" })} flip />
                    <View style={{ width: 8 }} />
                    <Tool theme={theme} icon="trash-outline" danger onPress={() => deleteBlock(selected.id)} />
                  </View>

                  <Label theme={theme}>{i18nText("autoI18n.yazi_arka_plani", "Yazı Arka Planı")}</Label>
                  <View style={styles.toolRow}>
                    <Tool
                      theme={theme}
                      icon={selected.bg ? "checkbox" : "square-outline"}
                      active={selected.bg}
                      label={selected.bg ? i18nText("autoI18n.acik", "Açık") : i18nText("autoI18n.kapali", "Kapalı")}
                      onPress={() => updateSelected({ bg: !selected.bg })}
                    />
                  </View>
                  {selected.bg && (
                    <>
                      <View style={[styles.ctrlHead, { marginTop: 12 }]}>
                        <Text allowFontScaling={false} style={[styles.ctrlLabel, { color: theme.text.muted }]}>
                          {i18nText("autoI18n.arka_plan_rengi", "Arka Plan Rengi")}
                        </Text>
                        <ResetBtn theme={theme} onPress={() => updateSelected({ bgColor: DEFAULTS.textBgColor })} />
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                      >
                        <HexColorInput
                          theme={theme}
                          color={selected.bgColor}
                          onChange={(c) => updateSelected({ bgColor: c })}
                        />
                        {BG_COLORS.map((c) => (
                          <TouchableOpacity
                            key={c}
                            onPress={() => updateSelected({ bgColor: c })}
                            style={[
                              styles.swatch,
                              { backgroundColor: c },
                              selected.bgColor === c && { borderColor: theme.accent, borderWidth: 3 },
                            ]}
                          />
                        ))}
                      </ScrollView>
                      <SliderControl
                        theme={theme}
                        icon="contrast-outline"
                        label={i18nText("autoI18n.arka_plan_saydamligi", "Arka Plan Saydamlığı")}
                        value={selected.bgOpacity}
                        min={0}
                        max={1}
                        step={0.05}
                        decimals={2}
                        onChange={(v) => updateSelected({ bgOpacity: v })}
                        onReset={() => updateSelected({ bgOpacity: DEFAULTS.textBgOpacity })}
                      />
                    </>
                  )}

                  <SliderControl
                    theme={theme}
                    icon="square-outline"
                    label={i18nText("autoI18n.kose_yuvarlakligi", "Köşe Yuvarlaklığı")}
                    value={selected.radius}
                    min={0}
                    max={40}
                    step={1}
                    onChange={(v) => updateSelected({ radius: v })}
                    onReset={() => updateSelected({ radius: DEFAULTS.textRadius })}
                  />
                  <SliderControl
                    theme={theme}
                    icon="scan-outline"
                    label={i18nText("autoI18n.ic_bosluk", "İç Boşluk")}
                    value={selected.padding}
                    min={0}
                    max={28}
                    step={1}
                    onChange={(v) => updateSelected({ padding: v })}
                    onReset={() => updateSelected({ padding: DEFAULTS.textPadding })}
                  />
                </>
              ) : (
                <Text style={[styles.hint, { color: theme.text.muted }]}>{i18nText("autoI18n.duzenlemek_icin_tuvalden_bir_yazi_poster_sec_ya_da", "Düzenlemek için tuvalden bir yazı/poster seç ya da yeni yazı ekle.")}</Text>
              )}

              {/* Filigran konumu */}
              <Label theme={theme}>{i18nText("autoI18n.filigran_konumu_zorunlu", "Filigran Konumu (zorunlu)")}</Label>
              <View style={styles.toolRow}>
                {WM_POSITIONS.map((p) => (
                  <GlassTouchable
                    key={p.id}
                    onPress={() => setWatermarkPos(p.id)}
                    style={[
                      styles.wmPosBtn,
                      {
                        backgroundColor: watermarkPos === p.id ? theme.accent + "22" : theme.secondary,
                        borderColor: watermarkPos === p.id ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="logo-buffer"
                      size={14}
                      color={watermarkPos === p.id ? theme.accent : theme.text.muted}
                    />
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: watermarkPos === p.id ? theme.accent : theme.text.muted,
                      }}
                    >
                      {p.id === "bottom-right" ? i18nText("autoI18n.sag_alt", "Sağ Alt") : p.id === "bottom-left" ? i18nText("autoI18n.sol_alt", "Sol Alt") : p.id === "top-right" ? i18nText("autoI18n.sag_ust", "Sağ Üst") : i18nText("autoI18n.sol_ust", "Sol Üst")}
                    </Text>
                  </GlassTouchable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      <SaveDraftModal
        visible={saveModalVisible}
        draftName={draftName}
        saving={savingDraft}
        isUpdate={!!currentDraftId}
        onChangeName={setDraftName}
        onClose={() => setSaveModalVisible(false)}
        onSave={handleSaveDraft}
      />
    </View>
  );
}

function Label({ theme, children }) {
  return (
    <Text style={[styles.label, { color: theme.text.muted }]}>{children}</Text>
  );
}

function Tool({ theme, icon, label, onPress, active, danger, italic, underline, flip }) {
  return (
    <GlassTouchable
      onPress={onPress}
      style={[
        styles.toolBtn,
        {
          backgroundColor: danger ? "#e5393522" : active ? theme.accent + "22" : theme.secondary,
          borderColor: danger ? "#e53935" : active ? theme.accent : theme.border,
        },
      ]}
    >
      {label && icon ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Ionicons
            name={icon}
            size={15}
            color={danger ? "#e53935" : active ? theme.accent : theme.text.primary}
          />
          <Text
            style={{
              color: danger ? "#e53935" : active ? theme.accent : theme.text.primary,
              fontSize: 12,
              fontWeight: "800",
            }}
          >
            {label}
          </Text>
        </View>
      ) : label ? (
        <Text
          style={{
            color: danger ? "#e53935" : active ? theme.accent : theme.text.primary,
            fontSize: 16,
            fontWeight: "900",
            fontStyle: italic ? "italic" : "normal",
            textDecorationLine: underline ? "underline" : "none",
          }}
        >
          {label}
        </Text>
      ) : (
        <Ionicons
          name={icon}
          size={17}
          color={danger ? "#e53935" : active ? theme.accent : theme.text.primary}
          style={flip ? { transform: [{ scaleX: -1 }] } : undefined}
        />
      )}
    </GlassTouchable>
  );
}

function ResetBtn({ theme, onPress }) {
  return (
    <GlassTouchable
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[styles.resetBtn, { borderColor: theme.border }]}
    >
      <Ionicons name="refresh" size={11} color={theme.text.muted} />
      <Text allowFontScaling={false} style={[styles.resetTxt, { color: theme.text.muted }]}>{i18nText("autoI18n.sifirla", "Sıfırla")}</Text>
    </GlassTouchable>
  );
}

function SliderControl({
  theme,
  icon,
  label,
  value,
  min,
  max,
  step,
  decimals = 0,
  disabled,
  onChange,
  onReset,
}) {
  return (
    <View style={{ marginTop: 14 }}>
      <View style={styles.ctrlHead}>
        <Text
          allowFontScaling={false}
          style={[styles.ctrlLabel, { color: theme.text.muted }]}
        >
          {label} ({decimals ? Number(value).toFixed(decimals) : Math.round(value)})
        </Text>
        <ResetBtn theme={theme} onPress={onReset} />
      </View>
      <View style={styles.sliderRow}>
        {icon ? <Ionicons name={icon} size={16} color={theme.text.muted} /> : null}
        <StorySlider
          value={value}
          minimumValue={min}
          maximumValue={max}
          step={step}
          disabled={disabled}
          onValueChange={onChange}
          accentColor={theme.accent}
          trackColor={theme.border}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  canvasArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 10,
  },

  /* Alt sheet (ayar modalı) */
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 30,
  },
  sheetHeader: { paddingTop: 10 },
  grabber: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
  },
  sheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 19, fontWeight: "900" },
  sheetTabs: { marginBottom: 4 },
  sheetScroll: { paddingBottom: 34, paddingTop: 2 },

  canvasShadow: {
    marginTop: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 14,
  },
  /* width/height/borderRadius ölçülen alana göre inline verilir */
  canvas: {
    overflow: "hidden",
  },


  watermark: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingLeft:2,
    paddingRight: 8,
    paddingVertical: 0,
    borderRadius: 22,
    
  },
  wmText: { color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },

  label: { fontSize: 12, fontWeight: "800", marginTop: 14, marginBottom: 8 },

  thumbRow: { gap: 10, paddingVertical: 2 },
  bdThumb: {
    width: 120,
    height: 68,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  orderBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  orderBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  posterThumb: {
    width: 64,
    height: 96,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  posterCheck: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  sliderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ctrlHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  ctrlLabel: { fontSize: 12, fontWeight: "800", flex: 1 },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  resetTxt: { fontSize: 10, fontWeight: "700" },

  addRow: { flexDirection: "row", gap: 10, marginBottom: 6 },
  addBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  addBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  blockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  blockRowText: { flex: 1, fontSize: 14, fontWeight: "600" },

  editInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 46,
  },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  /* Hex renk girişi — swatch satırlarının başındaki kutu */
  hexBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 8,
    marginRight: 10,
  },
  hexPreview: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  hexHash: { fontSize: 12, fontWeight: "800" },
  hexInput: {
    fontSize: 12,
    fontWeight: "700",
    minWidth: 58,
    padding: 0,
    height: "100%",
  },
  fontChip: {
    width: 60,
    height: 58,
    borderRadius: 12,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  toolBtn: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  wmPosBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
  },
  hint: { fontSize: 13, lineHeight: 19, marginTop: 8 },

  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    borderTopWidth: 1,
  },
});
