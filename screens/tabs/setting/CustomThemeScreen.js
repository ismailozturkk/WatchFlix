// Özel tema stüdyosu — ÜÇ TONLU temalar.
//
// Bir özel tema artık tek renk ailesinin üç tonudur: açık · orta · koyu. Hepsi
// aynı "ana renkten" ve aynı vurgudan türetilir; her ton ayrıca tek başına
// ayarlanabilir. Ayar ekranında temanın altında üç ton düğmesi çıkar.
//
// Tek ekranda dört sekme; üstte HER ZAMAN canlı önizleme (+ ton anahtarı):
//   • Kur       — ana renk + vurgu, üç tonun zemini ayrı ayrı, hazır renkler,
//                 uyumlu vurgu önerileri, kontrast/yüzey stili.
//   • Keşfet    — ruh haline göre ALTI rastgele ÜÇ TONLU aday; ana renk/vurgu
//                 kilitlenebilir; beğenilen adaya dokunulur (geri alınabilir).
//   • Hazır     — Varsayılan/Mavi/Yeşil + Gece Moru, Kızıl Sinema ve yeni setler;
//                 üç tonuyla yüklenir, sonra istenen ayarlanır.
//   • İnce ayar — önizlenen tonun 11 token'ını tek tek ayarla.
// Her değişiklik bir geçmiş adımıdır (geri al / yinele). Okunabilirlik özeti
// önizlemenin altında (önizlenen ton için); sorun varsa tek dokunuşla düzeltilir.
// Kaydedilmemiş değişiklikle çıkarken onay istenir.
import { intlLocaleOf } from "../../../utils/appLanguages";
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "@services/hapticsService";
import AppIcon from "@components/AppIcon";
import GlassIconButton from "@components/common/GlassIconButton";
import { toast } from "@components/AppToast";
import { appAlert } from "@components/AppAlert";
import ColorPickerSheet from "@components/theme/ColorPickerSheet";
import ThemePreviewCard from "@components/theme/ThemePreviewCard";
import ThemeShuffleDeck from "@components/theme/ThemeShuffleDeck";
import { PresetGrid, ToneTile } from "@components/theme/ThemeToneKit";
import {
  ColorTile,
  GhostButton,
  HarmonyRow,
  MiniLabel,
  PaletteStrip,
  ReadabilityPanel,
  ReadabilityPill,
  Segmented,
  SectionHeader,
  StudioTabs,
  SwatchRow,
  TokenRow,
} from "@components/theme/ThemeStudioKit";
import {
  getStudioCopy,
  harmonyLabel,
  hueLabel,
  moodLabel,
  presetLabel,
  suggestedBundleName,
  toneLabel,
} from "@components/theme/themeStudioCopy";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import useReduceMotion from "@hooks/useReduceMotion";
import { i18nText } from "@utils/i18nText";
import { isLightSurface, shiftLightness, toHex } from "@utils/colorUtils";
import {
  ACCENT_PRESETS,
  BASE_PRESETS,
  CONTRAST_LEVELS,
  SURFACE_MODES,
  TONES,
  analyzeContrast,
  describeTheme,
  fixReadability,
  generateCandidates,
  generateToneFromBackground,
  generateToneSet,
  suggestAccents,
  toneAccent,
  uniqueName,
} from "@utils/themeStudio";
import {
  THEME_PRESETS,
  entryFromBundle,
  getPresetBundle,
  initialBundle,
} from "@utils/themePresets";
import { canRedo, canUndo, createHistory, historyReducer } from "@utils/draftHistory";
import ScreenDecor from "@components/ScreenDecor";
import { usePremiumGate } from "@hooks/usePremiumGate";
import BackButton from "@components/BackButton";
import {
  CUSTOM_THEME_GROUPS,
  CUSTOM_THEME_TOKENS,
  buildCustomTheme,
  customSelectionKey,
  isRelativeToken,
  parseCustomSelection,
  resolveThemeTokens,
} from "../../../theme/colors";
import GlassTouchable from "../../../components/common/GlassTouchable";
import GlassBox from "../../../components/common/GlassBox";

// ColorPickerSheet, `sources` kimliği değişince durumunu sıfırlar; her render'da
// yeni `[]` vermek sürükleme sırasında seçiciyi sıfırlardı.
const NO_SOURCES = [];

const CANDIDATE_COUNT = 6;

// Bir token'ın okunurluğu hangi yüzeye karşı ölçülür (yoksa satırda gösterilmez).
const RATIO_AGAINST = {
  textPrimary: "primary",
  textSecondary: "secondary",
  textBetween: "primary",
  textMuted: "primary",
  accent: "primary",
};

const tokenLabel = (key) => {
  const tok = CUSTOM_THEME_TOKENS.find((x) => x.key === key);
  return tok ? i18nText(tok.labelKey, tok.fallback) : key;
};

const describeRelative = (value) => {
  const parts = [];
  if (value.l) parts.push(`L${value.l > 0 ? "+" : ""}${value.l}`);
  if (value.s) parts.push(`S${value.s > 0 ? "+" : ""}${value.s}`);
  return `${tokenLabel(value.from)}${parts.length ? ` · ${parts.join(" ")}` : ""}`;
};

const haptic = (fn) => {
  try {
    fn().catch(() => {});
  } catch {
    /* haptics yoksa sessizce geç */
  }
};
const tick = () => haptic(() => Haptics.selectionAsync());
const bump = () => haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

const fillTone = (text, tone) => String(text).replace("{tone}", tone);

export default function CustomThemeScreen({ navigation, route }) {
  const { theme, selectedTheme, customThemes = [], changeTheme, saveCustomTheme, deleteCustomTheme } = useTheme();
  const { language } = useLanguage();
  const copy = useMemo(() => getStudioCopy(language), [language]);
  const locale = intlLocaleOf(language);
  const reduceMotion = useReduceMotion();
  // Kısa ekranda (iPhone SE, ~700-760 dp Android'ler) sabit önizleme mini kipe
  // geçer; ton anahtarı satırı eklendiği için eşik 700'den 760'a çıktı: kaydırılan
  // alana yer kalsın.
  const { height: windowHeight } = useWindowDimensions();
  const miniPreview = windowHeight < 760;

  const editingId = route?.params?.themeId || null;
  const existing = editingId ? customThemes.find((tm) => tm.id === editingId) : null;

  // Açılış anındaki değerler: "başlangıca dön" ve kirli-durum karşılaştırması için.
  const initialRef = useRef(null);
  if (initialRef.current === null) {
    const start = initialBundle({ existing, selectedTheme, customThemes });
    initialRef.current = {
      bundle: start.bundle,
      json: JSON.stringify(start.bundle),
      tone: start.tone,
      name: existing?.name || "",
    };
  }

  const [history, dispatch] = useReducer(historyReducer, initialRef.current.bundle, createHistory);
  const bundle = history.present;
  const commit = useCallback((next) => dispatch({ type: "commit", value: next }), []);

  // Önizlenen / düzenlenen ton.
  const [tone, setTone] = useState(initialRef.current.tone);
  const draft = bundle.tones[tone];

  const [name, setName] = useState(initialRef.current.name);
  // Yeni temada Keşfet (hazır adaylar), mevcut temada İnce ayar açılır.
  const [tab, setTab] = useState(editingId ? "fine" : "discover");
  const [scene, setScene] = useState("home");
  const [style, setStyle] = useState({ contrast: "balanced", surfaces: "tinted" });
  // Stil seçilmediyse Keşfet kontrast/yüzey kipini kendisi çeşitlendirir.
  const [styleTouched, setStyleTouched] = useState(false);
  const [moodId, setMoodId] = useState(null);
  const [locks, setLocks] = useState({ bg: false, accent: false });
  const [readabilityOpen, setReadabilityOpen] = useState(false);
  const [picker, setPicker] = useState(null); // { kind: "base" | "accent" | "toneBg" | "token", tone?, token? }
  const [origin, setOrigin] = useState(null); // en son uygulanan adayın ruh hali
  const [presetOrigin, setPresetOrigin] = useState(null); // en son yüklenen hazır tema
  const [shuffleKey, setShuffleKey] = useState(0);
  const [candidates, setCandidates] = useState(() => generateCandidates(CANDIDATE_COUNT));

  const resolvedTones = useMemo(
    () => ({
      light: resolveThemeTokens(bundle.tones.light),
      mid: resolveThemeTokens(bundle.tones.mid),
      dark: resolveThemeTokens(bundle.tones.dark),
    }),
    [bundle.tones],
  );
  const resolved = resolvedTones[tone];
  const previewTheme = useMemo(() => buildCustomTheme(draft), [draft]);
  const analysis = useMemo(() => analyzeContrast(resolved), [resolved]);
  const bundleJson = useMemo(() => JSON.stringify(bundle), [bundle]);

  /* ── Önizleme "nabzı": toplu bir değişiklikte hafifçe yaylanır ── */
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulse = useCallback(() => {
    if (reduceMotion) return;
    pulseAnim.setValue(0.982);
    Animated.spring(pulseAnim, { toValue: 1, friction: 6, tension: 170, useNativeDriver: true }).start();
  }, [pulseAnim, reduceMotion]);

  /* ── Sekme içeriği geçişi ── */
  const tabFade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) return undefined;
    tabFade.setValue(0);
    const run = Animated.timing(tabFade, { toValue: 1, duration: 200, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [tab, tabFade, reduceMotion]);

  /* ── İsim ── */
  const described = useMemo(() => describeTheme(resolvedTones.mid), [resolvedTones.mid]);
  const suggestion = useMemo(() => {
    const mood = origin && origin.json === bundleJson ? origin.moodId : null;
    const base = suggestedBundleName(copy, { moodId: mood, family: described.family });
    const others = customThemes.filter((c) => c.id !== editingId).map((c) => c.name);
    return uniqueName(base, others);
  }, [origin, bundleJson, copy, described, customThemes, editingId]);

  /* ── Kaydedilmemiş değişiklikle çıkış koruması ── */
  const dirty = bundleJson !== initialRef.current.json || name.trim() !== initialRef.current.name.trim();
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const leavingRef = useRef(false);
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (leavingRef.current || !dirtyRef.current) return;
      e.preventDefault();
      appAlert(copy.leaveTitle, copy.leaveBody, [
        { text: copy.leaveKeep, style: "cancel" },
        {
          text: copy.leaveDiscard,
          style: "destructive",
          onPress: () => {
            leavingRef.current = true;
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
    return unsubscribe;
  }, [navigation, copy]);

  /* ── Geçmiş ── */
  const undo = () => {
    if (!canUndo(history)) return;
    tick();
    dispatch({ type: "undo" });
    setOrigin(null);
  };
  const redo = () => {
    if (!canRedo(history)) return;
    tick();
    dispatch({ type: "redo" });
    setOrigin(null);
  };
  const resetToStart = () => {
    bump();
    commit(initialRef.current.bundle);
    setOrigin(null);
    pulse();
  };

  /* ── Düzenleyiciler ── */
  const styleOpts = useMemo(() => ({ contrast: style.contrast, surfaces: style.surfaces }), [style]);

  // Yalnız önizlenen tonun token'larını değiştirir.
  const commitTone = (next) => commit({ ...bundle, tones: { ...bundle.tones, [tone]: next } });

  const changeTone = (next) => {
    if (next === tone) return;
    tick();
    setTone(next);
  };

  // Vurgu: üç tona birden. Önizlenen tonda seçilen renk AYNEN (yetmiyorsa
  // okunabilirlik uyarısı verir, "Düzelt" ile oturtulur); diğer tonlar kendi
  // zeminine oturtulur.
  const applyAccent = (hex) => {
    tick();
    const accent = toHex(hex);
    const tones = {};
    for (const t of TONES) {
      const primary = resolvedTones[t].primary;
      const fitted = t === tone ? accent : toneAccent(accent, t, primary);
      tones[t] = {
        ...bundle.tones[t],
        accent: fitted,
        bold: shiftLightness(fitted, isLightSurface(primary) ? -9 : -10),
      };
    }
    commit({ ...bundle, accent, tones });
    setOrigin(null);
  };

  // Ana renk: üç ton da bu tondan/doygunluktan yeniden kurulur.
  const applyBase = (hex, { announce = true } = {}) => {
    tick();
    const base = toHex(hex);
    commit({ base, accent: bundle.accent, tones: generateToneSet(base, bundle.accent, styleOpts) });
    setOrigin(null);
    pulse();
    if (announce) toast.info(copy.bgMatched);
  };

  // Tek tonun zemini: yalnız o ton yeniden kurulur, diğerleri dokunulmaz.
  const applyToneBackground = (target, hex) => {
    tick();
    const next = generateToneFromBackground(hex, bundle.accent, target, styleOpts);
    commit({ ...bundle, tones: { ...bundle.tones, [target]: next } });
    setTone(target);
    setOrigin(null);
    pulse();
  };

  const rebuildPalette = () => {
    bump();
    commit({ ...bundle, tones: generateToneSet(bundle.base, bundle.accent, styleOpts) });
    setOrigin(null);
    pulse();
    toast.success(i18nText("autoI18n.ct_palet_uretildi", "Palet iki renkten üretildi"));
  };

  const changeStyle = (patch) => {
    tick();
    const next = { ...style, ...patch };
    setStyle(next);
    setStyleTouched(true);
    commit({ ...bundle, tones: generateToneSet(bundle.base, bundle.accent, next) });
    setOrigin(null);
    pulse();
  };

  const fixReadable = () => {
    const patch = fixReadability(resolved);
    if (!Object.keys(patch).length) return;
    bump();
    commitTone({ ...draft, ...patch });
    setOrigin(null);
    pulse();
    toast.success(copy.fixed);
  };

  /* ── Keşfet ── */
  const regenerate = (over = {}) => {
    const nextMood = "moodId" in over ? over.moodId : moodId;
    const nextLocks = over.locks || locks;
    const lock = {
      base: nextLocks.bg ? bundle.base : null,
      accent: nextLocks.accent ? bundle.accent : null,
    };
    setCandidates((prev) =>
      generateCandidates(CANDIDATE_COUNT, {
        moodId: nextMood,
        lock,
        avoid: over.fresh ? [] : prev,
        // Kullanıcı stil seçmediyse kontrast/yüzey her adayda ayrı çeşitlenir.
        ...(styleTouched ? { contrast: style.contrast, surfaces: style.surfaces } : {}),
      }),
    );
    setShuffleKey((k) => k + 1);
  };

  const shuffle = () => {
    bump();
    regenerate();
  };

  const pickMood = (id) => {
    tick();
    setMoodId(id);
    regenerate({ moodId: id, fresh: true });
  };

  const toggleLock = (kind) => {
    tick();
    const next = { ...locks, [kind]: !locks[kind] };
    setLocks(next);
    regenerate({ locks: next, fresh: true });
  };

  const pickCandidate = (item) => {
    tick();
    const next = { base: item.base, accent: item.accent, tones: item.tones };
    commit(next);
    setOrigin({ json: JSON.stringify(next), moodId: item.moodId });
    pulse();
  };

  /* ── Hazır temalar ── */
  const pickPreset = (id) => {
    const next = getPresetBundle(id);
    if (!next) return;
    tick();
    commit(next);
    setPresetOrigin({ id, json: JSON.stringify(next) });
    setOrigin(null);
    pulse();
    toast.info(copy.presetLoaded);
  };

  const presetItems = useMemo(
    () =>
      THEME_PRESETS.map((preset) => ({
        id: preset.id,
        label: presetLabel(copy, preset.id),
        bundle: getPresetBundle(preset.id),
      })),
    [copy],
  );
  const activePresetId = presetOrigin && presetOrigin.json === bundleJson ? presetOrigin.id : null;

  const appliedKey = useMemo(
    () => candidates.find((c) => JSON.stringify({ base: c.base, accent: c.accent, tones: c.tones }) === bundleJson)?.key || null,
    [candidates, bundleJson],
  );
  const candidateLabel = useCallback(
    (item) => `${moodLabel(copy, item.moodId)} · ${hueLabel(copy, item.family)}`,
    [copy],
  );

  /* ── Kaydet / sil ── */
  // Cross-fade bitene kadar ekran etkileşimli kaldığından ikinci bir dokunuş
  // yeni bir tema kaydı daha üretebilirdi; ilk dokunuşta kilitlenir.
  const savingRef = useRef(false);
  // İkinci kapı: giriş noktası (SettingsTheme) zaten kontrol ediyor; ekran
  // başka yoldan açılırsa özel tema kaydı Free'de sessizce geçmesin.
  const customThemesGate = usePremiumGate("custom_themes");

  const save = () => {
    if (savingRef.current) return;
    if (!customThemesGate.check()) return;
    savingRef.current = true;
    leavingRef.current = true;
    const finalName = name.trim() || suggestion;
    // Önizlenen ton uygulanır: kullanıcı hangi tonu gördüyse o seçili olur.
    // Aktif temanın kendisi düzenleniyorsa kayıt geçişin apply adımına bırakılır:
    // erken yazılırsa ekran görüntü alınmadan yeni renklere boyanır ve solma
    // "yeniden yeniye" olduğu için görünmez olur.
    const activeSelection = parseCustomSelection(selectedTheme);
    const isActiveEdit = Boolean(editingId) && activeSelection?.id === editingId;
    const build = (id) => entryFromBundle(bundle, { id, name: finalName });
    const done = isActiveEdit
      ? changeTheme(customSelectionKey(editingId, tone), {
          onApply: () => saveCustomTheme(build(editingId)),
        })
      : changeTheme(customSelectionKey(saveCustomTheme(build(editingId)), tone));
    // Toast ve geri dönüş cross-fade bitince: erken çağrılırlarsa toast
    // ekran görüntüsünün altında gizli kalıyor, pop animasyonu da görüntünün
    // alınmasıyla yarışıp yarım kalmış kare donduruyor.
    done.then(() => {
      toast.success(i18nText("autoI18n.ct_kaydedildi", "Özel tema uygulandı"));
      navigation.goBack();
      savingRef.current = false;
    });
  };

  const remove = () => {
    appAlert(
      i18nText("autoI18n.ct_sil_baslik", "Tema silinsin mi?"),
      i18nText("autoI18n.ct_sil_aciklama", "Bu özel tema kalıcı olarak silinecek."),
      [
        { text: i18nText("autoI18n.vazgec", "Vazgeç"), style: "cancel" },
        {
          text: i18nText("autoI18n.sil", "Sil"),
          style: "destructive",
          onPress: () => {
            leavingRef.current = true;
            const wasActive = parseCustomSelection(selectedTheme)?.id === editingId;
            deleteCustomTheme(editingId);
            // animated:false — onay alert'i (RN Modal) daha kapanırken görüntü
            // alınırsa iOS'ta alert'in hayaleti solmaya karışıyor; silme
            // yıkıcı bir eylem olduğundan dark'a anında dönülür. Aynı handler
            // içinde batch'lendiği için ara gri kare de oluşmaz.
            if (wasActive) changeTheme("dark", { animated: false });
            toast.success(i18nText("autoI18n.ct_silindi", "Tema silindi"));
            navigation.goBack();
          },
        },
      ],
    );
  };

  /* ── Renk seçici ── */
  // Kaynak token listesi (kendisi hariç) — bağıl mod kaynakları. Yalnız ince
  // ayardaki token'lar bağlanabilir; ana renk/vurgu/zemin kutuları mutlak renk ister.
  const tokenSources = useMemo(() => {
    if (picker?.kind !== "token") return NO_SOURCES;
    return CUSTOM_THEME_TOKENS.filter((tok) => tok.key !== picker.token.key).map((tok) => ({
      key: tok.key,
      label: i18nText(tok.labelKey, tok.fallback),
      color: resolved[tok.key],
    }));
  }, [picker, resolved]);

  const pickerView = useMemo(() => {
    if (!picker) return { title: "", initialValue: "#000000", sources: NO_SOURCES, original: null, against: null };
    if (picker.kind === "base") {
      return {
        title: copy.baseTitle,
        initialValue: bundle.base,
        sources: NO_SOURCES,
        original: bundle.base,
        against: null,
      };
    }
    if (picker.kind === "toneBg") {
      const current = resolvedTones[picker.tone].primary;
      return {
        title: fillTone(copy.toneBgTitle, toneLabel(copy, picker.tone)),
        initialValue: current,
        sources: NO_SOURCES,
        original: current,
        against: null,
      };
    }
    if (picker.kind === "accent") {
      return {
        title: tokenLabel("accent"),
        initialValue: resolved.accent,
        sources: NO_SOURCES,
        original: resolved.accent,
        against: { color: resolved.primary, label: tokenLabel("primary") },
      };
    }
    const key = picker.token.key;
    const againstKey = key === "bold" ? "primary" : RATIO_AGAINST[key];
    return {
      title: tokenLabel(key),
      // Kayıtlı tema eski/eksik token taşıyabilir: çözülmüş değere düş.
      initialValue: draft[key] ?? resolved[key],
      sources: tokenSources,
      original: resolved[key],
      against: againstKey ? { color: resolved[againstKey], label: tokenLabel(againstKey) } : null,
    };
  }, [picker, resolved, resolvedTones, draft, tokenSources, bundle.base, copy]);

  const confirmPicker = (value) => {
    if (!picker) return;
    if (picker.kind === "base") applyBase(value);
    else if (picker.kind === "accent") applyAccent(value);
    else if (picker.kind === "toneBg") applyToneBackground(picker.tone, value);
    else {
      commitTone({ ...draft, [picker.token.key]: value });
      setOrigin(null);
    }
    setPicker(null);
  };

  /* ── Türetilmiş görünüm verisi ── */
  const harmonyItems = useMemo(
    () =>
      suggestAccents(resolved.primary, resolved.accent).map((item) => ({
        ...item,
        label: harmonyLabel(copy, item.id),
      })),
    [resolved.primary, resolved.accent, copy],
  );

  const tabs = useMemo(
    () => [
      { key: "setup", label: copy.tabSetup, icon: "color-palette-outline" },
      { key: "discover", label: copy.tabDiscover, icon: "dice-outline" },
      { key: "presets", label: copy.tabPresets, icon: "albums-outline" },
      { key: "fine", label: copy.tabFine, icon: "options-outline" },
    ],
    [copy],
  );
  const sceneOptions = useMemo(
    () => [
      { key: "home", label: copy.sceneHome },
      { key: "detail", label: copy.sceneDetail },
    ],
    [copy],
  );
  const toneOptions = useMemo(
    () => TONES.map((key) => ({ key, label: toneLabel(copy, key) })),
    [copy],
  );
  const contrastOptions = useMemo(
    () => CONTRAST_LEVELS.map((key) => ({ key, label: copy[`contrast${key.charAt(0).toUpperCase()}${key.slice(1)}`] })),
    [copy],
  );
  const surfaceOptions = useMemo(
    () => SURFACE_MODES.map((key) => ({ key, label: copy[`surfaces${key.charAt(0).toUpperCase()}${key.slice(1)}`] })),
    [copy],
  );

  const toggleReadability = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setReadabilityOpen((v) => !v);
  };

  const undoable = canUndo(history);
  const redoable = canRedo(history);

  /* ───────────── Sekme içerikleri ───────────── */

  const setupContent = (
    <View style={styles.stack}>
      <SectionHeader icon="color-palette-outline" title={copy.sectionColors} sub={copy.sectionColorsSub} theme={theme} />
      <View style={styles.tileRow}>
        <ColorTile
          label={copy.baseTitle}
          sub={copy.baseSub}
          color={bundle.base}
          icon="layers-outline"
          onPress={() => setPicker({ kind: "base" })}
          theme={theme}
        />
        <ColorTile
          label={tokenLabel("accent")}
          sub={copy.accentSub}
          color={resolved.accent}
          icon="color-wand-outline"
          onPress={() => setPicker({ kind: "accent" })}
          theme={theme}
        />
      </View>

      <View style={styles.block}>
        <SectionHeader icon="contrast-outline" title={copy.toneSectionTitle} sub={copy.toneSectionSub} theme={theme} />
        <View style={styles.tileRow}>
          {TONES.map((key) => (
            <ToneTile
              key={key}
              label={toneLabel(copy, key)}
              tokens={resolvedTones[key]}
              active={tone === key}
              onPress={() => {
                setTone(key);
                setPicker({ kind: "toneBg", tone: key });
              }}
              theme={theme}
            />
          ))}
        </View>
        <Text style={[styles.hint, { color: theme.text.muted }]}>{copy.toneBgSub}</Text>
      </View>

      <View style={styles.block}>
        <MiniLabel theme={theme}>{copy.readyBases.toLocaleUpperCase(locale)}</MiniLabel>
        <SwatchRow colors={BASE_PRESETS} selected={bundle.base} onPick={applyBase} theme={theme} shape="square" />
      </View>

      <View style={styles.block}>
        <MiniLabel theme={theme}>{copy.readyAccents.toLocaleUpperCase(locale)}</MiniLabel>
        <SwatchRow colors={ACCENT_PRESETS} selected={resolved.accent} onPick={applyAccent} theme={theme} />
      </View>

      <View style={styles.block}>
        <MiniLabel theme={theme}>{copy.harmonyTitle.toLocaleUpperCase(locale)}</MiniLabel>
        <HarmonyRow items={harmonyItems} selected={resolved.accent} onPick={applyAccent} theme={theme} />
        <Text style={[styles.hint, { color: theme.text.muted }]}>{copy.harmonyHint}</Text>
      </View>

      <SectionHeader icon="speedometer-outline" title={copy.sectionStyle} theme={theme} />
      <View style={styles.block}>
        <MiniLabel theme={theme}>{copy.styleContrast.toLocaleUpperCase(locale)}</MiniLabel>
        <Segmented options={contrastOptions} value={style.contrast} onChange={(key) => changeStyle({ contrast: key })} theme={theme} />
      </View>
      <View style={styles.block}>
        <MiniLabel theme={theme}>{copy.styleSurfaces.toLocaleUpperCase(locale)}</MiniLabel>
        <Segmented options={surfaceOptions} value={style.surfaces} onChange={(key) => changeStyle({ surfaces: key })} theme={theme} />
        <Text style={[styles.hint, { color: theme.text.muted }]}>{copy.styleHint}</Text>
      </View>

      <View style={styles.ghostRow}>
        <GhostButton icon="refresh" label={copy.rebuild} onPress={rebuildPalette} theme={theme} />
        <GhostButton icon="arrow-undo-outline" label={copy.resetToStart} onPress={resetToStart} disabled={!dirty} theme={theme} />
      </View>
    </View>
  );

  const discoverContent = (
    <ThemeShuffleDeck
      theme={theme}
      copy={copy}
      locale={locale}
      candidates={candidates}
      appliedKey={appliedKey}
      candidateLabel={candidateLabel}
      moodId={moodId}
      onMood={pickMood}
      lockBg={locks.bg}
      lockAccent={locks.accent}
      lockColors={{ bg: bundle.base, accent: bundle.accent }}
      onToggleLock={toggleLock}
      onShuffle={shuffle}
      onPick={pickCandidate}
      shuffleKey={shuffleKey}
      tone={tone}
      reduceMotion={reduceMotion}
    />
  );

  const presetsContent = (
    <View style={styles.stack}>
      <SectionHeader icon="albums-outline" title={copy.presetsTitle} sub={copy.presetsSub} theme={theme} />
      <PresetGrid items={presetItems} activeId={activePresetId} onPick={pickPreset} appliedText={copy.applied} theme={theme} />
    </View>
  );

  const fineContent = (
    <View style={styles.stack}>
      <View style={styles.block}>
        <MiniLabel theme={theme}>{`${toneLabel(copy, tone)} · ${copy.tabFine}`.toLocaleUpperCase(locale)}</MiniLabel>
        <PaletteStrip resolved={resolved} height={14} theme={theme} />
        <Text style={[styles.hint, { color: theme.text.muted }]}>{copy.fineHint}</Text>
      </View>
      {CUSTOM_THEME_GROUPS.map((group) => {
        const tokens = CUSTOM_THEME_TOKENS.filter((token) => token.group === group.id);
        return (
          <View key={group.id} style={styles.block}>
            <MiniLabel theme={theme}>{i18nText(group.labelKey, group.fallback).toLocaleUpperCase(locale)}</MiniLabel>
            <View style={[styles.panel, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              {tokens.map((token, index) => {
                const value = draft[token.key];
                const relative = isRelativeToken(value);
                const againstKey = RATIO_AGAINST[token.key];
                return (
                  <TokenRow
                    key={token.key}
                    label={i18nText(token.labelKey, token.fallback)}
                    color={resolved[token.key]}
                    hex={String(resolved[token.key] || "").toUpperCase()}
                    linked={relative}
                    linkText={relative ? describeRelative(value) : ""}
                    ratioAgainst={againstKey ? resolved[againstKey] : null}
                    last={index === tokens.length - 1}
                    onPress={() => setPicker({ kind: "token", token })}
                    theme={theme}
                  />
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.primary }]} edges={["top"]}>
      {/* Arka plan dekoru (ikon deseni + kar) — içeriğin ARKASINDA */}
      <ScreenDecor scope="settings" iconOpacity={0.12} />
      <View style={styles.header}>
        <BackButton absolute={false} onPress={() => navigation.goBack()} />
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
            {editingId ? i18nText("autoI18n.ct_temayi_duzenle", "Temayı Düzenle") : i18nText("autoI18n.ozel_tema", "Özel Tema")}
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]} numberOfLines={1}>
            {copy.headerSub}
          </Text>
        </View>
        {/* Devre dışı: eski kutuda opaklık 0.4; cam yolunda opaklık YOK, ikon soluk. */}
        <GlassIconButton
          icon="arrow-undo"
          iconSize={18}
          size={40}
          fallbackRadius={13}
          color={undoable ? theme.text.primary : theme.text.muted}
          fallbackStyle={{
            backgroundColor: theme.secondary,
            borderColor: theme.border,
            borderWidth: 1,
            opacity: undoable ? 1 : 0.4,
          }}
          accessibilityLabel={copy.undo}
          disabled={!undoable}
          onPress={undo}
        />
        <GlassIconButton
          icon="arrow-redo"
          iconSize={18}
          size={40}
          fallbackRadius={13}
          color={redoable ? theme.text.primary : theme.text.muted}
          fallbackStyle={{
            backgroundColor: theme.secondary,
            borderColor: theme.border,
            borderWidth: 1,
            opacity: redoable ? 1 : 0.4,
          }}
          accessibilityLabel={copy.redo}
          disabled={!redoable}
          onPress={redo}
        />
      </View>

      {/* Canlı önizleme SABİT: aşağıdaki denetimlerde gezinirken (ya da bir
          aday seçerken) sonuç gözden kaçmasın. Yalnız altındaki içerik kayar. */}
      <View style={[styles.pinned, { borderBottomColor: theme.border }]}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <ThemePreviewCard theme={previewTheme} language={language} scene={scene} compact mini={miniPreview} />
        </Animated.View>
        {/* Ton anahtarı: önizlenen ve düzenlenen ton (açık · orta · koyu) */}
        <View accessibilityLabel={copy.previewTone}>
          <Segmented options={toneOptions} value={tone} onChange={changeTone} theme={theme} dense />
        </View>
        <View style={styles.previewBar}>
          <View style={styles.sceneToggle}>
            <Segmented options={sceneOptions} value={scene} onChange={setScene} theme={theme} dense />
          </View>
          <ReadabilityPill analysis={analysis} copy={copy} open={readabilityOpen} onPress={toggleReadability} theme={theme} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {readabilityOpen ? <ReadabilityPanel analysis={analysis} copy={copy} onFix={fixReadable} theme={theme} /> : null}

        {/* Tema adı (+ öneri) */}
        <GlassBox role="field" style={[styles.nameRow, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <AppIcon family="Ionicons" name="pricetag-outline" size={17} color={theme.text.muted} />
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={32}
            placeholder={suggestion || i18nText("autoI18n.ct_isim_placeholder", "Temana bir isim ver")}
            placeholderTextColor={theme.text.muted}
            style={[styles.nameInput, { color: theme.text.primary }]}
          />
          <GlassTouchable
            accessibilityRole="button"
            accessibilityLabel={copy.suggestName}
            activeOpacity={0.75}
            onPress={() => {
              tick();
              setName(suggestion);
            }}
            style={[styles.nameMagic, { backgroundColor: `${theme.accent}22` }]}
          >
            <AppIcon family="Ionicons" name="sparkles" size={15} color={theme.accent} />
          </GlassTouchable>
        </GlassBox>

        <StudioTabs tabs={tabs} value={tab} onChange={(key) => { tick(); setTab(key); }} theme={theme} reduceMotion={reduceMotion} />

        <Animated.View
          style={{
            opacity: tabFade,
            transform: [{ translateY: tabFade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          }}
        >
          {tab === "setup" ? setupContent : tab === "discover" ? discoverContent : tab === "presets" ? presetsContent : fineContent}
        </Animated.View>

        <View style={{ height: 8 }} />
      </ScrollView>

      {/* Alt sabit aksiyon: sil / kaydet */}
      <View style={[styles.footer, { backgroundColor: theme.primary, borderTopColor: theme.border }]}>
        <View style={styles.footerRow}>
          {editingId ? (
            <GlassTouchable accessibilityRole="button" accessibilityLabel={i18nText("autoI18n.sil", "Sil")} activeOpacity={0.85} onPress={remove} style={[styles.deleteBtn, { borderColor: `${theme.colors.red}88` }]}>
              <AppIcon family="Ionicons" name="trash-outline" size={20} color={theme.colors.red} />
            </GlassTouchable>
          ) : null}
          <GlassTouchable accessibilityRole="button" activeOpacity={0.85} onPress={save} style={[styles.saveBtn, { backgroundColor: theme.accent }]}>
            <AppIcon family="Ionicons" name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.saveText}>{i18nText("autoI18n.ct_kaydet_uygula", "Kaydet ve Uygula")}</Text>
          </GlassTouchable>
        </View>
      </View>

      <ColorPickerSheet
        visible={!!picker}
        language={language}
        initialValue={pickerView.initialValue}
        title={pickerView.title}
        sources={pickerView.sources}
        originalHex={pickerView.original}
        contrastAgainst={pickerView.against}
        onClose={() => setPicker(null)}
        onConfirm={confirmPicker}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { minHeight: 60, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  headerCopy: { flex: 1 },
  title: { fontSize: 21, fontWeight: "900" },
  subtitle: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  pinned: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 9, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  content: { paddingHorizontal: 16, paddingTop: 13, paddingBottom: 24, gap: 13 },

  previewBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  sceneToggle: { width: 160 },

  nameRow: { minHeight: 50, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 14, paddingRight: 7 },
  nameInput: { flex: 1, fontSize: 15, fontWeight: "750", paddingVertical: 11 },
  nameMagic: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  stack: { gap: 16 },
  block: { gap: 9 },
  tileRow: { flexDirection: "row", gap: 10 },
  hint: { fontSize: 11, fontWeight: "650", lineHeight: 15, marginLeft: 2 },
  ghostRow: { flexDirection: "row", gap: 10 },

  panel: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14 },

  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth },
  footerRow: { flexDirection: "row", gap: 11 },
  deleteBtn: { width: 52, minHeight: 52, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  saveBtn: { flex: 1, minHeight: 50, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "900" },
});
