import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  TextInput,
  ScrollView,
  FlatList,
  Animated,
  PanResponder,
  Platform,
  ActivityIndicator,
} from "react-native";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "axios";
import Toast from "react-native-toast-message";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { i18nText } from "../utils/i18nText";
import { getRatingColors } from "../utils/ratingColors";
import {
  useApiSettings,
  useImageQualitySettings,
} from "../context/AppSettingsContext";
import { StoryHeader } from "../components/storyShare/StoryHeader";
import { StoryTabs } from "../components/storyShare/StoryTabs";
import { StoryActionBar } from "../components/storyShare/StoryActionBar";
import { SaveDraftModal } from "../components/storyShare/SaveDraftModal";
import StorySlider from "../components/storyShare/StorySlider";
import { StoryDraftService } from "../services/StoryDraftService";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

/* ── Boyutları açık/kapalı duruma göre optimize et ──
   Kapalı: tuval, header ile alt çubuk arasındaki tüm boşluğu kullanır.
   Açık:   tuval, header ile modal (sheet) arasına tam sığacak kadar küçülür. */
const HEADER_H = (Platform.OS === "ios" ? 56 : 40) + 48;
const ACTION_H = 100;
const GAP = 16;

let CANVAS_W = SCREEN_W - 32;
let CANVAS_H = (CANVAS_W * 16) / 9;
const MAX_CLOSED_H = SCREEN_H - HEADER_H - ACTION_H - GAP;
if (CANVAS_H > MAX_CLOSED_H) {
  CANVAS_H = MAX_CLOSED_H;
  CANVAS_W = (CANVAS_H * 9) / 16;
}

/* Modal açılınca tuval bu orana küçülür (üst kenar sabit kalır) */
const SHRINK = 0.5;
const CANVAS_TOP = HEADER_H + 10; // header + canvasArea paddingTop
/* Modal, küçülen tuvalin hemen 4px altından başlar ve ekranın altına kadar uzanır */
const SHEET_TOP = CANVAS_TOP + Math.round(CANVAS_H * SHRINK) + 16;
const SHEET_H = SCREEN_H - SHEET_TOP;

const APP_LOGO = require("../assets/android-icon-foreground.png");

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
const WM_STYLE = {
  "bottom-right": { bottom: 12, right: 12 },
  "bottom-left": { bottom: 12, left: 12 },
  "top-right": { top: 12, right: 12 },
  "top-left": { top: 12, left: 12 },
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
              return (
                <View key={d.s} style={{ width: cell, height: cell }} />
              );
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

/* #RRGGBB + opaklık → #RRGGBBAA */
const hexA = (hex, a) => {
  const v = Math.round(clamp(a, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${v}`;
};

export default function StoryShareScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { API_KEY } = useApiSettings();
  const { getTmdbUrl } = useImageQualitySettings();

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
  const positionsRef = useRef({});
  const sizesRef = useRef({});
  const respondersRef = useRef({});
  const dragStartRef = useRef({ x: 0, y: 0 });
  const bgPaddingRef = useRef(0);
  const bgInitRef = useRef(false);
  const dragScaleRef = useRef(1);

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
  const [posterLinked, setPosterLinked] = useState(false);

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
    els.push(makeText(title, { size: 26, bold: true, x: cx, y: 0.5 }));
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
  const editRef = useRef(null);

  /* ── Taslak ── */
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState(params.draftId || null);

  /* ── Ayar modalı (alt sheet) + tuval küçülme animasyonu ── */
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setSettingsOpen(false));
  };
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
    outputRange: [SHEET_H + 60, 0],
  });
  const actionBarOpacity = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const selected = blocks.find((b) => b.id === selectedId) || null;

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
          `https://api.themoviedb.org/3/${type}/${id}/images?include_image_language=tr,en,null`,
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
  }, [id, type, API_KEY]);

  /* ── Taslak yükle (düzenleme) ── */
  useEffect(() => {
    if (!params.draftId) return;
    let active = true;
    (async () => {
      const d = await StoryDraftService.getDraftById(params.draftId);
      if (!active || !d) return;
      const e = d.editor || {};
      if (Array.isArray(e.blocks)) setBlocks(e.blocks);
      if (Array.isArray(e.backgrounds)) setBackgrounds(e.backgrounds);
      if (typeof e.scrim === "number") setScrim(e.scrim);
      if (typeof e.bgBlur === "number") setBgBlur(e.bgBlur);
      if (typeof e.bgRadius === "number") setBgRadius(e.bgRadius);
      if (typeof e.bgPadding === "number") setBgPadding(e.bgPadding);
      if (typeof e.posterLinked === "boolean") setPosterLinked(e.posterLinked);
      if (e.watermarkPos) setWatermarkPos(e.watermarkPos);
      setDraftName(d.name || "");
      setCurrentDraftId(d.id);
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
      const pad = bgPaddingRef.current;
      const x = clamp(block.x * CANVAS_W, pad, Math.max(pad, CANVAS_W - size.w - pad));
      const y = clamp(block.y * CANVAS_H, pad, Math.max(pad, CANVAS_H - size.h - pad));
      getPosition(block.id).setValue({ x, y });
    },
    [getPosition]
  );

  /* bgPadding değişince hem ref güncelle hem blokları yeniden sınırla */
  useEffect(() => {
    bgPaddingRef.current = bgPadding;
    blocks.forEach(syncPosition);
  }, [bgPadding]);

  useEffect(() => {
    blocks.forEach(syncPosition);
  }, [blocks, syncPosition]);

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
            const pad = bgPaddingRef.current;
            const s = dragScaleRef.current || 1;
            const nx = clamp(
              dragStartRef.current.x + g.dx / s,
              pad,
              Math.max(pad, CANVAS_W - size.w - pad)
            );
            const ny = clamp(
              dragStartRef.current.y + g.dy / s,
              pad,
              Math.max(pad, CANVAS_H - size.h - pad)
            );
            getPosition(bid).setValue({ x: nx, y: ny });
          },
          onPanResponderRelease: (_, g) => {
            const size = sizesRef.current[bid] || { w: 0, h: 0 };
            const pad = bgPaddingRef.current;
            const s = dragScaleRef.current || 1;
            const nx = clamp(
              dragStartRef.current.x + g.dx / s,
              pad,
              Math.max(pad, CANVAS_W - size.w - pad)
            );
            const ny = clamp(
              dragStartRef.current.y + g.dy / s,
              pad,
              Math.max(pad, CANVAS_H - size.h - pad)
            );
            getPosition(bid).setValue({ x: nx, y: ny });
            setBlocks((prev) =>
              prev.map((b) =>
                b.id === bid
                  ? { ...b, x: nx / CANVAS_W, y: ny / CANVAS_H }
                  : b
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
        widthFrac = clamp((maxH * S) / (maxE * CANVAS_W), 0.2, DEFAULTS.graphWidth);

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

  const MAX_BACKGROUNDS = 3;
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

  const resizeSelected = (delta) => {
    if (!selected) return;
    if (selected.type === "text")
      updateSelected({ size: clamp(selected.size + delta * 3, 10, 80) });
    else if (selected.type === "image" || selected.type === "graph")
      updateSelected({
        widthFrac: clamp(selected.widthFrac + delta * 0.04, 0.18, 0.95),
      });
  };

  /* ── Yakalama ── */
  const capture = async () => {
    setSelectedId(null);
    setCapturing(true);
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
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Toast.show({
          type: "error",
          text1: i18nText(
            "autoI18n.galeriye_kaydetmek_icin_izin_gerekli",
            "Galeriye kaydetmek için izin gerekli",
          ),
        });
        return;
      }
      const uri = await capture();
      await MediaLibrary.saveToLibraryAsync(uri);
      Toast.show({ type: "success", text1: i18nText("autoI18n.galeriye_kaydedildi", "Galeriye kaydedildi") });
    } catch (e) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.kaydetme_hatasi", "Kaydetme hatası: ") + e.message });
    } finally {
      setBusy(false);
    }
  };

  /* ── Render: tuval ── */
  const renderBlock = (block) => {
    const position = getPosition(block.id);
    const responder = makeResponder(block.id);
    const isSel = selectedId === block.id && !capturing;
    return (
      <Animated.View
        key={block.id}
        onLayout={(e) => {
          sizesRef.current[block.id] = {
            w: e.nativeEvent.layout.width,
            h: e.nativeEvent.layout.height,
          };
          if (selectedId !== block.id) syncPosition(block);
        }}
        style={[
          position.getLayout(),
          { position: "absolute" },
          isSel && {
            borderWidth: 1.5,
            borderColor: "#ffffffdd",
            borderStyle: "dashed",
            borderRadius: (block.radius || 0) + (block.type === "image" ? 2 : 0),
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
              borderRadius: block.radius || 0,
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
                    borderRadius: block.radius || 0,
                  },
                ]}
              />
            )}
            <Text
              style={{
                color: block.color,
                fontSize: block.size,
                fontWeight: block.bold ? "900" : "600",
                fontStyle: block.italic ? "italic" : "normal",
                textDecorationLine: block.underline ? "underline" : "none",
                textAlign: block.align,
                width: CANVAS_W * (block.width ?? DEFAULTS.textWidth),
                paddingHorizontal: block.padding,
                paddingVertical: block.padding * 0.7,
                textShadowColor: block.bg ? "transparent" : "rgba(0,0,0,0.55)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 5,
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
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" />
      <StoryHeader
        busy={busy}
        onBack={() => navigation.goBack()}
        onOpenDrafts={() => navigation.navigate("StoryDraftsScreen")}
        onSaveDraft={openSaveModal}
      />

      {/* ══════ TUVAL (modal açılınca küçülür) ══════ */}
      <View style={styles.canvasArea}>
        <Animated.View
          style={[
            styles.canvasShadow,
            { transform: [{ translateY: canvasTranslateY }, { scale: canvasScale }] },
          ]}
        >
          <ViewShot
            ref={viewShotRef}
            options={{ format: "png", quality: 1 }}
            style={[styles.canvas, { borderRadius: bgRadius, backgroundColor: "#000" }]}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={StyleSheet.absoluteFill}
              onPress={() => setSelectedId(null)}
            >
              <View
                style={{
                  position: "absolute",
                  top: bgPadding,
                  left: bgPadding,
                  right: bgPadding,
                  bottom: bgPadding,
                  borderRadius: Math.max(0, bgRadius - bgPadding),
                  overflow: "hidden",
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
                    colors={[theme.accent + "AA", theme.primary, "#000"]}
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
              style={[styles.watermark, WM_STYLE[watermarkPos]]}
              pointerEvents="none"
            >
              <Image source={APP_LOGO} style={styles.wmLogo} resizeMode="contain" />
              <Text style={styles.wmText}>Seelogd</Text>
            </View>
          </ViewShot>
        </Animated.View>
      </View>

      {/* ══════ ALT EYLEM (paylaş + düzenle) ══════ */}
      <Animated.View
        style={[styles.bottomBar, { borderTopColor: theme.border, opacity: actionBarOpacity }]}
        pointerEvents={settingsOpen ? "none" : "auto"}
      >
        <StoryActionBar
          busy={busy}
          onShare={handleShare}
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
            top: SHEET_TOP,
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
            >
              {i18nText("autoI18n.duzenle", "Düzenle")}
            </Text>
            <TouchableOpacity
              onPress={closeSettings}
              style={[styles.sheetClose, { backgroundColor: theme.secondary }]}
            >
              <Ionicons name="chevron-down" size={22} color={theme.text.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sheetTabs}>
          <StoryTabs activeTab={activeTab} onChangeTab={setActiveTab} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.sheetScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── ARKA PLAN ── */}
          {activeTab === "background" && (
            <View>
              <Label theme={theme}>
                {i18nText(
                  "autoI18n.arka_plan_sayaci",
                  "Arka Plan ({{n}}/{{max}} — alt alta dizilir)",
                  { n: backgrounds.length, max: MAX_BACKGROUNDS },
                )}
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
                label={i18nText(
                  "autoI18n.cevre_boslugu_icerik_kenar_mesafesi",
                  "Çevre Boşluğu (içerik kenar mesafesi)",
                )}
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
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: theme.secondary, borderColor: theme.border, borderWidth: 1, marginTop: 14 }]}
                  onPress={() => setPosterImage(poster_path)}
                >
                  <Ionicons name="image" size={18} color={theme.accent} />
                  <Text style={[styles.addBtnText, { color: theme.text.primary }]}>
                    {i18nText("autoI18n.posteri_geri_ekle", "Posteri Geri Ekle")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── İÇERİKLER ── */}
          {activeTab === "content" && (
            <View>
              <View style={styles.addRow}>
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: theme.accent }]}
                  onPress={addText}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.addBtnText}>{i18nText("autoI18n.yazi_ekle", "Yazı Ekle")}</Text>
                </TouchableOpacity>
                {!blocks.some((b) => b.id === "poster") && poster_path && (
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: theme.secondary, borderColor: theme.border, borderWidth: 1 }]}
                    onPress={() => setPosterImage(poster_path)}
                  >
                    <Ionicons name="image" size={18} color={theme.accent} />
                    <Text style={[styles.addBtnText, { color: theme.text.primary }]}>
                      {i18nText("autoI18n.poster_ekle", "Poster Ekle")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Bölüm Graph — yalnızca dizilerde, tek örnek */}
              {type === "tv" && !blocks.some((b) => b.id === "epgraph") && (
                <TouchableOpacity
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
                </TouchableOpacity>
              )}

              {blocks.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedId(b.id);
                    if (b.type === "text") setActiveTab("style");
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
            </View>
          )}

          {/* ── STİL ── */}
          {activeTab === "style" && (
            <View>
              {selected && selected.type === "text" ? (
                <>
                  <TextInput
                    ref={editRef}
                    value={selected.text}
                    onChangeText={(txt) => updateSelected({ text: txt })}
                    maxLength={200}
                    placeholder={i18nText("autoI18n.yazini_gir", "Yazını gir...")}
                    placeholderTextColor={theme.text.muted}
                    multiline
                    style={[
                      styles.editInput,
                      { color: theme.text.primary, borderColor: theme.border, backgroundColor: theme.secondary },
                    ]}
                  />
                  <View style={[styles.ctrlHead, { marginTop: 14 }]}>
                    <Text allowFontScaling={false} style={[styles.ctrlLabel, { color: theme.text.muted }]}>
                      {i18nText("autoI18n.renk", "Renk")}
                    </Text>
                    <ResetBtn theme={theme} onPress={() => updateSelected({ color: DEFAULTS.textColor })} />
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                    <Tool theme={theme} label="İ" active={selected.italic} italic onPress={() => updateSelected({ italic: !selected.italic })} />
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
                      label={
                        selected.bg
                          ? i18nText("autoI18n.acik", "Açık")
                          : i18nText("autoI18n.kapali", "Kapalı")
                      }
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
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
              ) : selected &&
                (selected.type === "image" || selected.type === "graph") ? (
                <>
                  <SliderControl
                    theme={theme}
                    icon="resize-outline"
                    label={
                      selected.type === "graph"
                        ? i18nText("autoI18n.graph_boyutu", "Graph Boyutu")
                        : i18nText("autoI18n.poster_boyutu", "Poster Boyutu")
                    }
                    value={selected.widthFrac}
                    min={0.18}
                    max={0.95}
                    step={0.02}
                    decimals={2}
                    onChange={(v) => updateSelected({ widthFrac: v })}
                    onReset={() =>
                      updateSelected({
                        widthFrac:
                          selected.type === "graph"
                            ? DEFAULTS.graphWidth
                            : DEFAULTS.posterWidth,
                      })
                    }
                  />
                  <SliderControl
                    theme={theme}
                    icon="square-outline"
                    label={`${i18nText("autoI18n.kose_yuvarlakligi", "Köşe Yuvarlaklığı")}${
                      selected.type === "image" && posterLinked
                        ? i18nText("autoI18n.bagli_eki", " — bağlı")
                        : ""
                    }`}
                    value={selected.radius}
                    min={0}
                    max={selected.type === "graph" ? 24 : 48}
                    step={1}
                    disabled={selected.type === "image" && posterLinked}
                    onChange={(v) => updateSelected({ radius: v })}
                    onReset={() =>
                      updateSelected({
                        radius:
                          selected.type === "graph"
                            ? DEFAULTS.graphRadius
                            : DEFAULTS.posterRadius,
                      })
                    }
                  />
                  <View style={styles.toolRow}>
                    {selected.type === "image" && (
                      <Tool
                        theme={theme}
                        icon="link"
                        active={posterLinked}
                        label={
                          posterLinked
                            ? i18nText("autoI18n.arka_plana_bagli", "Arka plana bağlı")
                            : i18nText("autoI18n.arka_plana_bagla", "Arka plana bağla")
                        }
                        onPress={() => setPosterLinked((v) => !v)}
                      />
                    )}
                    <Tool theme={theme} icon="trash-outline" danger onPress={() => deleteBlock(selected.id)} />
                  </View>
                </>
              ) : (
                <Text style={[styles.hint, { color: theme.text.muted }]}>
                  {i18nText(
                    "autoI18n.duzenlemek_icin_tuvalden_bir_yazi_poster_sec_ya_da",
                    "Düzenlemek için tuvalden bir yazı/poster seç ya da yeni yazı ekle.",
                  )}
                </Text>
              )}

              {/* Filigran konumu */}
              <Label theme={theme}>
                {i18nText("autoI18n.filigran_konumu_zorunlu", "Filigran Konumu (zorunlu)")}
              </Label>
              <View style={styles.toolRow}>
                {WM_POSITIONS.map((p) => (
                  <TouchableOpacity
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
                      {p.id === "bottom-right"
                        ? i18nText("autoI18n.konum_sag_alt", "Sağ Alt")
                        : p.id === "bottom-left"
                          ? i18nText("autoI18n.konum_sol_alt", "Sol Alt")
                          : p.id === "top-right"
                            ? i18nText("autoI18n.konum_sag_ust", "Sağ Üst")
                            : i18nText("autoI18n.konum_sol_ust", "Sol Üst")}
                    </Text>
                  </TouchableOpacity>
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
    <TouchableOpacity
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
    </TouchableOpacity>
  );
}

function ResetBtn({ theme, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[styles.resetBtn, { borderColor: theme.border }]}
    >
      <Ionicons name="refresh" size={11} color={theme.text.muted} />
      <Text allowFontScaling={false} style={[styles.resetTxt, { color: theme.text.muted }]}>
        {i18nText("autoI18n.sifirla", "Sıfırla")}
      </Text>
    </TouchableOpacity>
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
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
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
  canvas: {
    width: CANVAS_W,
    height: CANVAS_H,
    borderRadius: 22,
    overflow: "hidden",
  },

  block: { position: "absolute", padding: 6 },
  blockSelected: {
    borderWidth: 1,
    borderColor: "#ffffffcc",
    borderStyle: "dashed",
    borderRadius: 8,
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
  wmLogo: { width: 36, height: 36, marginRight: 0 },
  wmText: { color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },

  panel: { width: CANVAS_W, marginTop: 16 },
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
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
  },
});
