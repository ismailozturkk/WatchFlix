// Özel tema stüdyosu.
//
// Tek ekranda üç sekme; üstte HER ZAMAN canlı önizleme:
//   • Kur       — zemin + vurgu (iki büyük kutu, hazır renkler, zeminden hesaplanan
//                 uyumlu vurgu önerileri, kontrast/yüzey stili). Zemin değişince
//                 tüm palet o zeminden yeniden türetilir.
//   • Keşfet    — ruh haline göre ALTI rastgele aday; zemin/vurgu kilitlenebilir;
//                 beğenilen adaya dokunulur (tek adım geri alınabilir).
//   • İnce ayar — 11 token'ı tek tek ayarla; metin kademelerinin zemine kontrastı
//                 satır başında görünür.
// Her değişiklik bir geçmiş adımıdır (geri al / yinele). Okunabilirlik özeti
// önizlemenin altında; sorun varsa tek dokunuşla düzeltilir. Kaydedilmemiş
// değişiklikle çıkarken onay istenir.
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
  suggestedThemeName,
} from "@components/theme/themeStudioCopy";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import useReduceMotion from "@hooks/useReduceMotion";
import { i18nText } from "@utils/i18nText";
import { isLightSurface, shiftLightness, toHex } from "@utils/colorUtils";
import {
  ACCENT_PRESETS,
  BACKGROUND_PRESETS,
  CONTRAST_LEVELS,
  SURFACE_MODES,
  analyzeContrast,
  describeTheme,
  fitAccent,
  fixReadability,
  generateCandidates,
  generateTokensFromSeeds,
  suggestAccents,
  uniqueName,
} from "@utils/themeStudio";
import { canRedo, canUndo, createHistory, historyReducer } from "@utils/draftHistory";
import ScreenDecor from "@components/ScreenDecor";
import { usePremiumGate } from "@hooks/usePremiumGate";
import BackButton from "@components/BackButton";
import {
  CUSTOM_THEME_GROUPS,
  CUSTOM_THEME_TOKENS,
  buildCustomTheme,
  getThemeColors,
  isRelativeToken,
  resolveThemeTokens,
  THEME_NAMES,
  themeToTokens,
} from "../../../theme/colors";

const BASE_THEMES = [
  { key: "gray", labelKey: "grayTheme", fallback: "Gri" },
  { key: "dark", labelKey: "darkTheme", fallback: "Karanlık" },
  { key: "light", labelKey: "lightTheme", fallback: "Açık" },
  { key: "sky", labelKey: "skyTheme", fallback: "Açık Mavi" },
  { key: "blue", labelKey: "blueTheme", fallback: "Lacivert" },
  { key: "green", labelKey: "greenTheme", fallback: "Yeşil" },
  { key: "purple", labelKey: "purpleTheme", fallback: "Gece Moru" },
  { key: "amber", labelKey: "amberTheme", fallback: "Kızıl Sinema" },
];

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

export default function CustomThemeScreen({ navigation, route }) {
  const { theme, selectedTheme, customThemes = [], changeTheme, saveCustomTheme, deleteCustomTheme } = useTheme();
  const { language } = useLanguage();
  const isEn = language === "en";
  const copy = useMemo(() => getStudioCopy(isEn), [isEn]);
  const locale = isEn ? "en-US" : "tr-TR";
  const reduceMotion = useReduceMotion();
  // Kısa ekranda (iPhone SE gibi) sabit önizleme mini kipe geçer; kaydırılan alana yer kalır.
  const { height: windowHeight } = useWindowDimensions();
  const miniPreview = windowHeight < 700;

  const editingId = route?.params?.themeId || null;
  const existing = editingId ? customThemes.find((tm) => tm.id === editingId) : null;

  // Açılış anındaki değerler: "başlangıca dön" ve kirli-durum karşılaştırması için.
  const initialRef = useRef(null);
  if (initialRef.current === null) {
    initialRef.current = {
      tokens:
        existing?.tokens || themeToTokens(THEME_NAMES.includes(selectedTheme) ? selectedTheme : "dark"),
      name: existing?.name || "",
    };
  }

  const [history, dispatch] = useReducer(historyReducer, initialRef.current.tokens, createHistory);
  const draft = history.present;
  const commit = useCallback((next) => dispatch({ type: "commit", value: next }), []);

  const [name, setName] = useState(initialRef.current.name);
  // Yeni temada Keşfet (hazır adaylar), mevcut temada İnce ayar açılır.
  const [tab, setTab] = useState(editingId ? "fine" : "discover");
  const [scene, setScene] = useState("home");
  const [style, setStyle] = useState({ contrast: "balanced", surfaces: "tinted" });
  const [moodId, setMoodId] = useState(null);
  const [locks, setLocks] = useState({ bg: false, accent: false });
  const [readabilityOpen, setReadabilityOpen] = useState(false);
  const [picker, setPicker] = useState(null); // { kind: "bg" | "accent" | "token", token? }
  const [origin, setOrigin] = useState(null); // en son uygulanan adayın ruh hali
  const [shuffleKey, setShuffleKey] = useState(0);
  const [candidates, setCandidates] = useState(() => generateCandidates(CANDIDATE_COUNT));

  const resolved = useMemo(() => resolveThemeTokens(draft), [draft]);
  const previewTheme = useMemo(() => buildCustomTheme(draft), [draft]);
  const analysis = useMemo(() => analyzeContrast(resolved), [resolved]);
  const draftJson = useMemo(() => JSON.stringify(draft), [draft]);

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
  const described = useMemo(() => describeTheme(resolved), [resolved]);
  const suggestion = useMemo(() => {
    const mood = origin && origin.json === draftJson ? origin.moodId : null;
    const base = suggestedThemeName(copy, { moodId: mood, ...described });
    const others = customThemes.filter((c) => c.id !== editingId).map((c) => c.name);
    return uniqueName(base, others);
  }, [origin, draftJson, copy, described, customThemes, editingId]);

  /* ── Kaydedilmemiş değişiklikle çıkış koruması ── */
  const dirty = draftJson !== JSON.stringify(initialRef.current.tokens) || name.trim() !== initialRef.current.name.trim();
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
    commit(initialRef.current.tokens);
    setOrigin(null);
    pulse();
  };

  /* ── Renk uygulayıcılar ── */
  const accentPatch = useCallback(
    (hex) => ({ accent: hex, bold: shiftLightness(hex, isLightSurface(resolved.primary) ? -9 : -10) }),
    [resolved.primary],
  );

  const applyAccent = (hex) => {
    tick();
    commit({ ...draft, ...accentPatch(toHex(hex)) });
    setOrigin(null);
  };

  const applyBackground = (hex, { announce = true } = {}) => {
    tick();
    const bg = toHex(hex);
    commit(generateTokensFromSeeds(bg, fitAccent(resolved.accent, bg), style));
    setOrigin(null);
    pulse();
    if (announce) toast.info(copy.bgMatched);
  };

  const rebuildPalette = () => {
    bump();
    commit(generateTokensFromSeeds(resolved.primary, resolved.accent, style));
    setOrigin(null);
    pulse();
    toast.success(i18nText("autoI18n.ct_palet_uretildi", "Palet iki renkten üretildi"));
  };

  const changeStyle = (patch) => {
    tick();
    const next = { ...style, ...patch };
    setStyle(next);
    commit(generateTokensFromSeeds(resolved.primary, resolved.accent, next));
    setOrigin(null);
    pulse();
  };

  const fixReadable = () => {
    const patch = fixReadability(resolved);
    if (!Object.keys(patch).length) return;
    bump();
    commit({ ...draft, ...patch });
    setOrigin(null);
    pulse();
    toast.success(copy.fixed);
  };

  /* ── Keşfet ── */
  const regenerate = (over = {}) => {
    const nextMood = "moodId" in over ? over.moodId : moodId;
    const nextLocks = over.locks || locks;
    const lock = {
      bg: nextLocks.bg ? resolved.primary : null,
      accent: nextLocks.accent ? resolved.accent : null,
    };
    setCandidates((prev) =>
      generateCandidates(CANDIDATE_COUNT, {
        moodId: nextMood,
        lock,
        avoid: over.fresh ? [] : prev,
        contrast: style.contrast,
        surfaces: style.surfaces,
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
    commit(item.tokens);
    setOrigin({ json: JSON.stringify(item.tokens), moodId: item.moodId });
    pulse();
  };

  const pickBase = (key) => {
    tick();
    commit(themeToTokens(key));
    setOrigin(null);
    pulse();
    toast.info(i18nText("autoI18n.ct_taban_uygulandi", "Taban tema yüklendi"));
  };

  const appliedKey = useMemo(
    () => candidates.find((c) => JSON.stringify(c.tokens) === draftJson)?.key || null,
    [candidates, draftJson],
  );
  const candidateLabel = useCallback(
    (item) => `${moodLabel(copy, item.moodId)} · ${hueLabel(copy, item.family)}`,
    [copy],
  );
  const bases = useMemo(
    () =>
      BASE_THEMES.map((b) => ({
        key: b.key,
        label: i18nText(b.labelKey, b.fallback),
        colors: getThemeColors(b.key),
      })),
    // i18nText aktif dile bakar; dil değişince etiketler yenilenmeli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language],
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
    // Aktif temanın kendisi düzenleniyorsa token yazımı geçişin apply adımına
    // bırakılır: erken yazılırsa ekran görüntü alınmadan yeni renklere boyanır
    // ve solma "yeniden yeniye" olduğu için görünmez olur.
    const isActiveEdit = editingId && selectedTheme === `custom:${editingId}`;
    const done = isActiveEdit
      ? changeTheme(`custom:${editingId}`, {
          onApply: () => saveCustomTheme({ id: editingId, name: finalName, tokens: draft }),
        })
      : changeTheme(`custom:${saveCustomTheme({ id: editingId, name: finalName, tokens: draft })}`);
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
            const wasActive = selectedTheme === `custom:${editingId}`;
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
  // ayardaki token'lar bağlanabilir; zemin/vurgu kutuları mutlak renk ister.
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
    if (picker.kind === "bg") {
      return {
        title: tokenLabel("primary"),
        initialValue: resolved.primary,
        sources: NO_SOURCES,
        original: resolved.primary,
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
  }, [picker, resolved, draft, tokenSources]);

  const confirmPicker = (value) => {
    if (!picker) return;
    if (picker.kind === "bg") applyBackground(value);
    else if (picker.kind === "accent") applyAccent(value);
    else {
      commit({ ...draft, [picker.token.key]: value });
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
          label={tokenLabel("primary")}
          sub={copy.bgSub}
          color={resolved.primary}
          icon="layers-outline"
          onPress={() => setPicker({ kind: "bg" })}
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
        <MiniLabel theme={theme}>{copy.readyBackgrounds.toLocaleUpperCase(locale)}</MiniLabel>
        <SwatchRow colors={BACKGROUND_PRESETS} selected={resolved.primary} onPick={applyBackground} theme={theme} shape="square" />
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
      lockColors={{ bg: resolved.primary, accent: resolved.accent }}
      onToggleLock={toggleLock}
      onShuffle={shuffle}
      onPick={pickCandidate}
      shuffleKey={shuffleKey}
      bases={bases}
      onBase={pickBase}
      reduceMotion={reduceMotion}
    />
  );

  const fineContent = (
    <View style={styles.stack}>
      <View style={styles.block}>
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
            {i18nText("autoI18n.ct_alt_baslik_v2", "İki renk seç, gerisini biz kuralım")}
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
          <ThemePreviewCard theme={previewTheme} isEn={isEn} scene={scene} compact mini={miniPreview} />
        </Animated.View>
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
        <View style={[styles.nameRow, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <AppIcon family="Ionicons" name="pricetag-outline" size={17} color={theme.text.muted} />
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={32}
            placeholder={suggestion || i18nText("autoI18n.ct_isim_placeholder", "Temana bir isim ver")}
            placeholderTextColor={theme.text.muted}
            style={[styles.nameInput, { color: theme.text.primary }]}
          />
          <TouchableOpacity
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
          </TouchableOpacity>
        </View>

        <StudioTabs tabs={tabs} value={tab} onChange={(key) => { tick(); setTab(key); }} theme={theme} reduceMotion={reduceMotion} />

        <Animated.View
          style={{
            opacity: tabFade,
            transform: [{ translateY: tabFade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          }}
        >
          {tab === "setup" ? setupContent : tab === "discover" ? discoverContent : fineContent}
        </Animated.View>

        <View style={{ height: 8 }} />
      </ScrollView>

      {/* Alt sabit aksiyon: sil / kaydet */}
      <View style={[styles.footer, { backgroundColor: theme.primary, borderTopColor: theme.border }]}>
        <View style={styles.footerRow}>
          {editingId ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={i18nText("autoI18n.sil", "Sil")} activeOpacity={0.85} onPress={remove} style={[styles.deleteBtn, { borderColor: `${theme.colors.red}88` }]}>
              <AppIcon family="Ionicons" name="trash-outline" size={20} color={theme.colors.red} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity accessibilityRole="button" activeOpacity={0.85} onPress={save} style={[styles.saveBtn, { backgroundColor: theme.accent }]}>
            <AppIcon family="Ionicons" name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.saveText}>{i18nText("autoI18n.ct_kaydet_uygula", "Kaydet ve Uygula")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ColorPickerSheet
        visible={!!picker}
        isEn={isEn}
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
