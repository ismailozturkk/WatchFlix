// components/settings/AtmosphereGenreInfoSheet.js
//
// "Türe göre atmosfer nasıl çalışır?" sayfası: Ayarlar > Atmosfer'de telefonun
// sağındaki "Türe göre" başlığının ünlem düğmesinden açılır. Ne yaptığını
// anlatır ve tür ailesi → atmosfer tablosunu gösterir (utils/weatherParticles
// GENRE_FAMILIES: film ve dizi adı farklı türler aynı ailede, aynı atmosfer).

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import GlassTouchable from "@components/common/GlassTouchable";
import SheetScroll from "@components/common/SheetScroll";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { i18nText } from "@utils/i18nText";
import { copyLanguage } from "@utils/appLanguages";
import { GENRE_LABELS, localizeGenreName } from "@utils/genreDisplay";
import { GENRE_FAMILIES, GENRE_MIX_MAX } from "@utils/weatherParticles";
import { alpha } from "@theme/colors";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";
import { EFFECT_ICONS, effectLabel } from "./AtmosphereControls";

const LANGS = ["tr", "en", "es", "pt", "de", "it"];

// Yalnız dizide olan (bileşik) TMDB türlerinin özgün adları → yerel ad.
const TV_ONLY_NAMES = {
  10759: "Action & Adventure",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10762: "Kids",
  10763: "News",
  10768: "War & Politics",
  10764: "Reality",
  10767: "Talk",
};

export default function AtmosphereGenreInfoSheet({ visible, onClose }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const lang = copyLanguage(language, LANGS);

  const rows = useMemo(
    () =>
      GENRE_FAMILIES.map((f) => {
        const names = f.genres.map((g) => GENRE_LABELS[g]?.[lang] || g);
        const tv = f.tv
          .filter((id) => TV_ONLY_NAMES[id])
          .map((id) => localizeGenreName(TV_ONLY_NAMES[id], lang))
          .filter((n) => !names.includes(n));
        return { id: f.id, title: names.join(" · "), tv, effect: f.effect };
      }),
    [lang],
  );

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={35}
      dimColor="rgba(0,0,0,0.35)"
      sheetStyle={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      <SheetScroll style={styles.scrollRoom} contentContainerStyle={styles.scrollRoomContent}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: alpha(theme.accent, 0.14) }]}>
            <AppIcon family="MaterialCommunityIcons" name="movie-filter-outline" size={20} color={theme.accent} />
          </View>
          <View style={styles.flex}>
            <Text allowFontScaling={false} style={[styles.title, { color: theme.text.primary }]}>
              {i18nText("autoI18n.atmosfer_tur_bilgi_baslik", "Türe göre atmosfer")}
            </Text>
            <Text allowFontScaling={false} style={[styles.body, { color: theme.text.secondary }]}>
              {i18nText(
                "autoI18n.atmosfer_tur_bilgi_govde",
                "Açıkken film, dizi, sezon ve bölüm detaylarında atmosferi seçtiğin efekt değil yapımın türleri belirler. En fazla {{n}} türün efekti birlikte çizilir; kapalıyken detaylarda da seçtiğin efekt görünür.",
              ).replace("{{n}}", String(GENRE_MIX_MAX))}
            </Text>
          </View>
          <GlassCloseButton size={34} fallbackRadius={12} iconSize={19} color={theme.text.secondary} onPress={onClose} />
        </View>

        <View style={[styles.note, { backgroundColor: alpha(theme.accent, 0.1), borderColor: alpha(theme.accent, 0.3) }]}>
          <AppIcon name="git-merge-outline" size={16} color={theme.accent} />
          <Text allowFontScaling={false} style={[styles.noteText, { color: theme.text.primary }]}>
            {i18nText(
              "autoI18n.atmosfer_tur_bilgi_aile",
              "Film ve dizi türleri aynı aileye düşer: filmde Bilim Kurgu, dizide Bilim Kurgu & Fantazi aynı atmosferi kullanır.",
            )}
          </Text>
        </View>

        <Text allowFontScaling={false} style={[styles.sectionLabel, { color: theme.text.muted }]}>
          {i18nText("autoI18n.atmosfer_tur_bilgi_liste", "Tür → atmosfer")}
        </Text>
        <View style={[styles.table, { borderColor: theme.border, backgroundColor: theme.primary }]}>
          {rows.map((r, i) => {
            const icon = EFFECT_ICONS[r.effect] || { name: "sparkles-outline" };
            return (
              <View
                key={r.id}
                style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}
              >
                <View style={styles.flex}>
                  <Text allowFontScaling={false} style={[styles.rowTitle, { color: theme.text.primary }]}>
                    {r.title}
                  </Text>
                  {r.tv.length ? (
                    <Text allowFontScaling={false} style={[styles.rowSub, { color: theme.text.muted }]}>
                      {i18nText("autoI18n.atmosfer_tur_bilgi_dizide", "Dizide: {{names}}").replace(
                        "{{names}}",
                        r.tv.join(", "),
                      )}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.effect, { backgroundColor: alpha(theme.accent, 0.14) }]}>
                  <AppIcon family={icon.family} name={icon.name} size={14} color={theme.accent} />
                  <Text allowFontScaling={false} numberOfLines={1} style={[styles.effectText, { color: theme.text.primary }]}>
                    {effectLabel(r.effect)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <GlassTouchable
          glass={false}
          onPress={onClose}
          accessibilityRole="button"
          style={[styles.cta, { backgroundColor: theme.accent }]}
        >
          <Text allowFontScaling={false} style={styles.ctaText}>
            {i18nText("autoI18n.atmosfer_tur_bilgi_tamam", "Anladım")}
          </Text>
        </GlassTouchable>
      </SheetScroll>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 26,
    maxHeight: "88%",
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  // Kapat düğmesi kaydırma bölgesinin en üstünde: basılınca kırpılmasın.
  scrollRoom: { marginTop: -GLASS_PRESS_ROOM },
  scrollRoomContent: { paddingTop: GLASS_PRESS_ROOM },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  iconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "900" },
  body: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
  },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },
  table: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  rowTitle: { fontSize: 13.5, fontWeight: "700" },
  rowSub: { fontSize: 11, marginTop: 2 },
  effect: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 99,
    maxWidth: "48%",
  },
  effectText: { fontSize: 11.5, fontWeight: "600", flexShrink: 1 },
  cta: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 16 },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "900" },
});
