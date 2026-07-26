// Özel tema oluşturucu.
//
// Tasarım: kullanıcıların %90'ı için "hızlı kurulum" yeterli — bir zemin + bir
// vurgu rengi seç, "Paleti Üret" tüm 11 token'ı HSL ölçeğiyle türetsin; hazır
// vurgu şeridi ve rastgele zar da tek dokunuşluk yollar. Tek tek renk ayarı
// isteyenler için gruplu token listesi katlanabilir "İnce Ayar" bölümünde
// durur (düzenleme modunda varsayılan açık). Önizleme altındaki kontrast
// rozeti okunabilirliği anlık puanlar.
import React, { useMemo, useState } from "react";
import {
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "@services/hapticsService";
import AppIcon from "@components/AppIcon";
import { toast } from "@components/AppToast";
import { appAlert } from "@components/AppAlert";
import ColorPickerSheet from "@components/theme/ColorPickerSheet";
import ThemePreviewCard from "@components/theme/ThemePreviewCard";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import { clamp, hexToHsl, hslToHex, luminance } from "@utils/colorUtils";
import {
  applyRelative,
  buildCustomTheme,
  CUSTOM_THEME_GROUPS,
  CUSTOM_THEME_TOKENS,
  DEFAULT_CUSTOM_TOKENS,
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
  { key: "blue", labelKey: "blueTheme", fallback: "Lacivert" },
  { key: "green", labelKey: "greenTheme", fallback: "Yeşil" },
  { key: "purple", labelKey: "purpleTheme", fallback: "Gece Moru" },
  { key: "amber", labelKey: "amberTheme", fallback: "Kehribar" },
];

// Hazır vurgu renkleri — tek dokunuşla accent + bold güncellenir.
const ACCENT_PRESETS = [
  "#3B82F6", "#6C63FF", "#8B5CF6", "#EC4899", "#EF4444",
  "#F97316", "#F59E0B", "#22C55E", "#14B8A6", "#06B6D4",
];

const contrastRatio = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const tokenLabel = (key) => {
  const tok = CUSTOM_THEME_TOKENS.find((x) => x.key === key);
  return tok ? i18nText(tok.labelKey, tok.fallback) : key;
};

const tokenByKey = (key) => CUSTOM_THEME_TOKENS.find((x) => x.key === key) || null;

const describeRelative = (value) => {
  const parts = [];
  if (value.l) parts.push(`L${value.l > 0 ? "+" : ""}${value.l}`);
  if (value.s) parts.push(`S${value.s > 0 ? "+" : ""}${value.s}`);
  return `${tokenLabel(value.from)}${parts.length ? ` · ${parts.join(" ")}` : ""}`;
};

/**
 * Zemin + vurgu renginden tam 11 token'lık uyumlu palet türetir. Zeminin
 * algısal parlaklığına göre koyu/açık ölçek seçilir; yüzeyler zeminin hue'sunu
 * korur, metin ölçeği aynı hue ailesinden okunur kademelerle kurulur.
 */
const generateTokensFromSeeds = (bgHex, accentHex) => {
  const bg = hexToHsl(bgHex);
  const T = (h, s, l) => hslToHex(h, clamp(s, 0, 100), clamp(l, 0, 100));
  const isDarkBg = bg.l < 55;
  if (isDarkBg) {
    return {
      primary: bgHex,
      secondary: T(bg.h, bg.s, bg.l + 6),
      between: T(bg.h, bg.s, bg.l + 3),
      tab: T(bg.h, bg.s, bg.l + 2),
      border: T(bg.h, Math.max(bg.s - 4, 0), bg.l + 14),
      accent: accentHex,
      bold: applyRelative(accentHex, { l: -10 }),
      textPrimary: T(bg.h, 8, 96),
      textSecondary: T(bg.h, 10, 82),
      textBetween: T(bg.h, 10, 66),
      textMuted: T(bg.h, 8, 52),
    };
  }
  return {
    primary: bgHex,
    secondary: T(bg.h, Math.min(bg.s + 4, 100), Math.min(bg.l + 5, 98)),
    between: T(bg.h, bg.s, bg.l - 5),
    tab: T(bg.h, Math.min(bg.s + 4, 100), Math.min(bg.l + 5, 98)),
    border: T(bg.h, bg.s, bg.l - 13),
    accent: accentHex,
    bold: applyRelative(accentHex, { l: -9 }),
    textPrimary: T(bg.h, 22, 13),
    textSecondary: T(bg.h, 16, 30),
    textBetween: T(bg.h, 12, 44),
    textMuted: T(bg.h, 10, 55),
  };
};

export default function CustomThemeScreen({ navigation, route }) {
  const { theme, selectedTheme, customThemes = [], changeTheme, saveCustomTheme, deleteCustomTheme } = useTheme();
  const { language } = useLanguage();
  const isEn = language === "en";

  const editingId = route?.params?.themeId || null;
  const existing = editingId ? customThemes.find((tm) => tm.id === editingId) : null;

  const [name, setName] = useState(existing?.name || "");
  const [draft, setDraft] = useState(() =>
    existing?.tokens ||
    themeToTokens(THEME_NAMES.includes(selectedTheme) ? selectedTheme : "dark"),
  );
  const [activeToken, setActiveToken] = useState(null);
  // Yeni temada ince ayar kapalı başlar (hızlı kurulum öne çıkar);
  // mevcut temayı düzenlerken açık başlar.
  const [advancedOpen, setAdvancedOpen] = useState(!!editingId);

  const resolved = useMemo(() => resolveThemeTokens(draft), [draft]);
  const previewTheme = useMemo(() => buildCustomTheme(draft), [draft]);

  const setColor = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const seedFrom = (themeName) => {
    Haptics.selectionAsync().catch(() => {});
    setDraft(themeToTokens(themeName));
    toast.info(i18nText("autoI18n.ct_taban_uygulandi", "Taban tema yüklendi"));
  };

  const applyAccentPreset = (hex) => {
    Haptics.selectionAsync().catch(() => {});
    setDraft((prev) => ({ ...prev, accent: hex, bold: applyRelative(hex, { l: -10 }) }));
  };

  const generatePalette = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDraft(generateTokensFromSeeds(resolved.primary, resolved.accent));
    toast.success(i18nText("autoI18n.ct_palet_uretildi", "Palet iki renkten üretildi"));
  };

  const randomize = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const hue = Math.floor(Math.random() * 360);
    const darkBg = Math.random() < 0.72; // koyu temalar uygulamaya daha çok yakışıyor
    const bg = darkBg
      ? hslToHex(hue, 18 + Math.floor(Math.random() * 14), 9 + Math.floor(Math.random() * 5))
      : hslToHex(hue, 16 + Math.floor(Math.random() * 12), 90 + Math.floor(Math.random() * 5));
    const accentHue = (hue + 120 + Math.floor(Math.random() * 120)) % 360;
    const accent = hslToHex(accentHue, 72 + Math.floor(Math.random() * 16), darkBg ? 58 : 42);
    setDraft(generateTokensFromSeeds(bg, accent));
  };

  const save = () => {
    const id = saveCustomTheme({ id: editingId, name, tokens: draft });
    changeTheme(`custom:${id}`);
    toast.success(i18nText("autoI18n.ct_kaydedildi", "Özel tema uygulandı"));
    navigation.goBack();
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
            deleteCustomTheme(editingId);
            if (selectedTheme === `custom:${editingId}`) changeTheme("dark");
            toast.success(i18nText("autoI18n.ct_silindi", "Tema silindi"));
            navigation.goBack();
          },
        },
      ],
    );
  };

  const toggleAdvanced = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAdvancedOpen((v) => !v);
  };

  // Picker için kaynak token listesi (kendisi hariç) — bağıl mod kaynakları.
  const pickerSources = useMemo(() => {
    if (!activeToken) return [];
    return CUSTOM_THEME_TOKENS.filter((tok) => tok.key !== activeToken.key).map((tok) => ({
      key: tok.key,
      label: i18nText(tok.labelKey, tok.fallback),
      color: resolved[tok.key],
    }));
  }, [activeToken, resolved]);

  // Kontrast skoru: ana metin ↔ zemin.
  const ratio = contrastRatio(resolved.primary, resolved.textPrimary);
  const ratioText = `${ratio.toFixed(1)}:1`;
  const ratioMeta =
    ratio >= 7
      ? { tone: theme.colors.green, label: "AAA", icon: "shield-checkmark" }
      : ratio >= 4.5
        ? { tone: theme.colors.green, label: "AA", icon: "checkmark-circle" }
        : ratio >= 3
          ? { tone: theme.colors.orange, label: i18nText("autoI18n.ct_dusuk", "Düşük"), icon: "alert-circle" }
          : { tone: theme.colors.red, label: i18nText("autoI18n.ct_yetersiz", "Yetersiz"), icon: "warning" };

  const QuickCard = ({ tokenKey, icon, label }) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.8}
      onPress={() => setActiveToken(tokenByKey(tokenKey))}
      style={[styles.quickCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <View style={[styles.quickSwatch, { backgroundColor: resolved[tokenKey], borderColor: theme.border }]}>
        <AppIcon
          family="Ionicons"
          name={icon}
          size={16}
          color={hexToHsl(resolved[tokenKey] || "#000000").l > 55 ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.85)"}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.quickLabel, { color: theme.text.primary }]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.quickHex, { color: theme.text.muted }]}>{String(resolved[tokenKey] || "").toUpperCase()}</Text>
      </View>
      <AppIcon family="Ionicons" name="chevron-forward" size={15} color={theme.text.muted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.primary }]} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={isEn ? "Back" : "Geri"} onPress={() => navigation.goBack()} style={[styles.iconBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <AppIcon family="Ionicons" name="arrow-back" size={21} color={theme.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>{editingId ? i18nText("autoI18n.ct_temayi_duzenle", "Temayı Düzenle") : i18nText("autoI18n.ozel_tema", "Özel Tema")}</Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]} numberOfLines={1}>{i18nText("autoI18n.ct_alt_baslik_v2", "İki renk seç, gerisini biz kuralım")}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={isEn ? "Random" : "Rastgele"} onPress={randomize} style={[styles.iconBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <AppIcon family="Ionicons" name="dice-outline" size={19} color={theme.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={isEn ? "Reset" : "Sıfırla"} onPress={() => setDraft(DEFAULT_CUSTOM_TOKENS)} style={[styles.iconBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <AppIcon family="Ionicons" name="refresh" size={19} color={theme.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* En üstte canlı önizleme + kontrast rozeti */}
        <View>
          <ThemePreviewCard theme={previewTheme} isEn={isEn} />
          <View style={[styles.ratioPill, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <AppIcon family="Ionicons" name={ratioMeta.icon} size={13} color={ratioMeta.tone} />
            <Text style={[styles.ratioText, { color: theme.text.secondary }]}>
              {i18nText("autoI18n.ct_kontrast", "Kontrast")} {ratioText}
            </Text>
            <View style={[styles.ratioBadge, { backgroundColor: `${ratioMeta.tone}22` }]}>
              <Text style={[styles.ratioBadgeText, { color: ratioMeta.tone }]}>{ratioMeta.label}</Text>
            </View>
          </View>
        </View>

        {/* Tema adı */}
        <View style={[styles.nameRow, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <AppIcon family="Ionicons" name="pricetag-outline" size={17} color={theme.text.muted} />
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={32}
            placeholder={i18nText("autoI18n.ct_isim_placeholder", "Temana bir isim ver")}
            placeholderTextColor={theme.text.muted}
            style={[styles.nameInput, { color: theme.text.primary }]}
          />
        </View>

        {/* ── Hızlı kurulum ── */}
        <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>{i18nText("autoI18n.ct_hizli_kurulum", "Hızlı kurulum").toUpperCase()}</Text>
        <View style={styles.quickRow}>
          <QuickCard tokenKey="primary" icon="layers-outline" label={i18nText("autoI18n.ct_arka_plan", "Arka Plan")} />
          <QuickCard tokenKey="accent" icon="color-wand-outline" label={i18nText("autoI18n.ct_vurgu", "Vurgu")} />
        </View>

        {/* Hazır vurgu renkleri */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
          {ACCENT_PRESETS.map((hex) => {
            const selected = String(resolved.accent).toUpperCase() === hex.toUpperCase();
            return (
              <TouchableOpacity
                key={hex}
                accessibilityRole="button"
                accessibilityLabel={hex}
                activeOpacity={0.8}
                onPress={() => applyAccentPreset(hex)}
                style={[
                  styles.presetDot,
                  { backgroundColor: hex, borderColor: selected ? theme.text.primary : "transparent" },
                ]}
              >
                {selected ? <AppIcon family="Ionicons" name="checkmark" size={13} color="#fff" /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Zemin + vurgudan tam palet üret */}
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.85}
          onPress={generatePalette}
          style={[styles.generateBtn, { backgroundColor: `${resolved.accent}1F`, borderColor: `${resolved.accent}66` }]}
        >
          <AppIcon family="Ionicons" name="sparkles" size={17} color={resolved.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.generateTitle, { color: theme.text.primary }]}>{i18nText("autoI18n.ct_paleti_uret", "Paleti Üret")}</Text>
            <Text style={[styles.generateSub, { color: theme.text.muted }]} numberOfLines={1}>{i18nText("autoI18n.ct_paleti_uret_aciklama", "Zemin + vurgudan tüm renkleri türet")}</Text>
          </View>
          <AppIcon family="Ionicons" name="arrow-forward-circle" size={22} color={resolved.accent} />
        </TouchableOpacity>

        {/* Taban temadan başlat */}
        <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>{i18nText("autoI18n.ct_tabandan_basla", "Bir tabandan başla").toUpperCase()}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.baseRow}>
          {BASE_THEMES.map((base) => {
            const p = getThemeColors(base.key);
            return (
              <TouchableOpacity key={base.key} accessibilityRole="button" activeOpacity={0.8} onPress={() => seedFrom(base.key)} style={[styles.baseChip, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                <View style={styles.baseSwatches}>
                  <View style={[styles.baseSwatch, { backgroundColor: p.primary }]} />
                  <View style={[styles.baseSwatch, { backgroundColor: p.secondary }]} />
                  <View style={[styles.baseSwatch, { backgroundColor: p.accent }]} />
                </View>
                <Text style={[styles.baseLabel, { color: theme.text.secondary }]} numberOfLines={1}>{i18nText(base.labelKey, base.fallback)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── İnce ayar (katlanabilir) ── */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded: advancedOpen }}
          activeOpacity={0.75}
          onPress={toggleAdvanced}
          style={[styles.advancedHeader, { backgroundColor: theme.secondary, borderColor: theme.border }]}
        >
          <AppIcon family="Ionicons" name="options-outline" size={17} color={theme.accent} />
          <Text style={[styles.advancedTitle, { color: theme.text.primary }]}>{i18nText("autoI18n.ct_ince_ayar", "İnce Ayar")}</Text>
          <Text style={[styles.advancedCount, { color: theme.text.muted }]}>{CUSTOM_THEME_TOKENS.length}</Text>
          <AppIcon family="Ionicons" name={advancedOpen ? "chevron-up" : "chevron-down"} size={17} color={theme.text.muted} />
        </TouchableOpacity>

        {advancedOpen
          ? CUSTOM_THEME_GROUPS.map((group) => (
              <View key={group.id} style={styles.group}>
                <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>{i18nText(group.labelKey, group.fallback).toUpperCase()}</Text>
                <View style={[styles.panel, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                  {CUSTOM_THEME_TOKENS.filter((token) => token.group === group.id).map((token, index, arr) => {
                    const value = draft[token.key];
                    const relative = isRelativeToken(value);
                    return (
                      <TouchableOpacity
                        key={token.key}
                        accessibilityRole="button"
                        accessibilityLabel={i18nText(token.labelKey, token.fallback)}
                        activeOpacity={0.7}
                        onPress={() => setActiveToken(token)}
                        style={[styles.colorRow, index !== arr.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
                      >
                        <View style={[styles.swatch, { backgroundColor: resolved[token.key], borderColor: theme.border }]}>
                          {relative ? <View style={styles.linkBadge}><AppIcon family="Ionicons" name="link" size={10} color="#fff" /></View> : null}
                        </View>
                        <View style={styles.colorCopy}>
                          <Text style={[styles.colorLabel, { color: theme.text.primary }]}>{i18nText(token.labelKey, token.fallback)}</Text>
                          {relative ? <Text style={[styles.colorSub, { color: theme.accent }]} numberOfLines={1}>{describeRelative(value)}</Text> : null}
                        </View>
                        <Text style={[styles.colorHex, { color: theme.text.muted }]}>{String(resolved[token.key] || "").toUpperCase()}</Text>
                        <AppIcon family="Ionicons" name="chevron-forward" size={17} color={theme.text.muted} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))
          : null}

        <View style={{ height: 8 }} />
      </ScrollView>

      {/* Alt sabit aksiyon */}
      <View style={[styles.footer, { backgroundColor: theme.primary, borderTopColor: theme.border }]}>
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

      <ColorPickerSheet
        visible={!!activeToken}
        isEn={isEn}
        initialValue={activeToken ? draft[activeToken.key] : "#000000"}
        title={activeToken ? i18nText(activeToken.labelKey, activeToken.fallback) : ""}
        sources={pickerSources}
        onClose={() => setActiveToken(null)}
        onConfirm={(value) => { if (activeToken) setColor(activeToken.key, value); setActiveToken(null); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { minHeight: 60, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  title: { fontSize: 21, fontWeight: "900" },
  subtitle: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 13 },

  /* Kontrast rozeti */
  ratioPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    marginTop: 9,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  ratioText: { fontSize: 11.5, fontWeight: "750" },
  ratioBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  ratioBadgeText: { fontSize: 10, fontWeight: "900" },

  nameRow: { minHeight: 50, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 },
  nameInput: { flex: 1, fontSize: 15, fontWeight: "750", paddingVertical: 11 },
  sectionTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 0.7, marginLeft: 2, marginBottom: -4 },

  /* Hızlı kurulum */
  quickRow: { flexDirection: "row", gap: 10 },
  quickCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 15,
    borderWidth: 1,
    padding: 11,
  },
  quickSwatch: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontSize: 12.5, fontWeight: "800" },
  quickHex: { fontSize: 10, fontWeight: "700", marginTop: 1, letterSpacing: 0.4 },
  presetRow: { gap: 9, paddingVertical: 2, paddingRight: 8 },
  presetDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  generateTitle: { fontSize: 13.5, fontWeight: "850" },
  generateSub: { fontSize: 10.5, fontWeight: "650", marginTop: 1 },

  baseRow: { gap: 9, paddingVertical: 2, paddingRight: 8 },
  baseChip: { minWidth: 96, borderRadius: 14, borderWidth: 1, padding: 10, gap: 8, alignItems: "center" },
  baseSwatches: { flexDirection: "row", gap: 4 },
  baseSwatch: { width: 18, height: 18, borderRadius: 6 },
  baseLabel: { fontSize: 11, fontWeight: "800" },

  /* İnce ayar */
  advancedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 13,
    minHeight: 48,
  },
  advancedTitle: { flex: 1, fontSize: 13.5, fontWeight: "850" },
  advancedCount: { fontSize: 11, fontWeight: "800" },

  group: { gap: 9 },
  panel: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14 },
  colorRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 13 },
  swatch: { width: 34, height: 34, borderRadius: 11, borderWidth: 1.5, alignItems: "flex-end", justifyContent: "flex-end" },
  linkBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", margin: -1 },
  colorCopy: { flex: 1 },
  colorLabel: { fontSize: 14, fontWeight: "750" },
  colorSub: { fontSize: 10, fontWeight: "800", marginTop: 2 },
  colorHex: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },

  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 11 },
  deleteBtn: { width: 52, minHeight: 52, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  saveBtn: { flex: 1, minHeight: 52, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "900" },
});
