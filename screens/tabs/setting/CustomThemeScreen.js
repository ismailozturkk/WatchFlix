import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import { toast } from "@components/AppToast";
import { appAlert } from "@components/AppAlert";
import ColorPickerSheet from "@components/theme/ColorPickerSheet";
import ThemePreviewCard from "@components/theme/ThemePreviewCard";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import { luminance } from "@utils/colorUtils";
import {
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

const describeRelative = (value) => {
  const parts = [];
  if (value.l) parts.push(`L${value.l > 0 ? "+" : ""}${value.l}`);
  if (value.s) parts.push(`S${value.s > 0 ? "+" : ""}${value.s}`);
  return `${tokenLabel(value.from)}${parts.length ? ` · ${parts.join(" ")}` : ""}`;
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

  const resolved = useMemo(() => resolveThemeTokens(draft), [draft]);
  const previewTheme = useMemo(() => buildCustomTheme(draft), [draft]);

  const setColor = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const seedFrom = (themeName) => {
    setDraft(themeToTokens(themeName));
    toast.info(i18nText("autoI18n.ct_taban_uygulandi", "Taban tema yüklendi"));
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

  // Picker için kaynak token listesi (kendisi hariç) — bağıl mod kaynakları.
  const pickerSources = useMemo(() => {
    if (!activeToken) return [];
    return CUSTOM_THEME_TOKENS.filter((tok) => tok.key !== activeToken.key).map((tok) => ({
      key: tok.key,
      label: i18nText(tok.labelKey, tok.fallback),
      color: resolved[tok.key],
    }));
  }, [activeToken, resolved]);

  const lowContrast = contrastRatio(resolved.primary, resolved.textPrimary) < 3;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.primary }]} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={isEn ? "Back" : "Geri"} onPress={() => navigation.goBack()} style={[styles.iconBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <AppIcon family="Ionicons" name="arrow-back" size={21} color={theme.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>{editingId ? i18nText("autoI18n.ct_temayi_duzenle", "Temayı Düzenle") : i18nText("autoI18n.ozel_tema", "Özel Tema")}</Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]} numberOfLines={1}>{i18nText("autoI18n.ct_alt_baslik", "Her rengi kendine göre ayarla")}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={isEn ? "Reset" : "Sıfırla"} onPress={() => setDraft(DEFAULT_CUSTOM_TOKENS)} style={[styles.iconBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <AppIcon family="Ionicons" name="refresh" size={19} color={theme.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* En üstte canlı önizleme */}
        <ThemePreviewCard theme={previewTheme} isEn={isEn} />

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

        {lowContrast ? (
          <View style={[styles.warning, { backgroundColor: `${theme.colors.orange}1A`, borderColor: `${theme.colors.orange}66` }]}>
            <AppIcon family="Ionicons" name="warning-outline" size={16} color={theme.colors.orange} />
            <Text style={[styles.warningText, { color: theme.text.secondary }]}>{i18nText("autoI18n.ct_dusuk_kontrast", "Ana metin ve arka plan kontrastı düşük; okunması zor olabilir.")}</Text>
          </View>
        ) : null}

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

        {/* Gruplu renk düzenleyiciler */}
        {CUSTOM_THEME_GROUPS.map((group) => (
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
        ))}

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
  header: { minHeight: 60, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  iconBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  title: { fontSize: 21, fontWeight: "900" },
  subtitle: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
  nameRow: { minHeight: 50, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 },
  nameInput: { flex: 1, fontSize: 15, fontWeight: "750", paddingVertical: 11 },
  warning: { flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 14, borderWidth: 1, padding: 12 },
  warningText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "650" },
  sectionTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 0.7, marginLeft: 2, marginBottom: -4 },
  baseRow: { gap: 9, paddingVertical: 2, paddingRight: 8 },
  baseChip: { minWidth: 96, borderRadius: 14, borderWidth: 1, padding: 10, gap: 8, alignItems: "center" },
  baseSwatches: { flexDirection: "row", gap: 4 },
  baseSwatch: { width: 18, height: 18, borderRadius: 6 },
  baseLabel: { fontSize: 11, fontWeight: "800" },
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
