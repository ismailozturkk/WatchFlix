import React, { memo, useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";
import { planStoryActionBar } from "../../utils/storyCanvasLayout";
import GlassTouchable from "../common/GlassTouchable";
import { useLiquidGlass } from "../../services/liquidGlass";

// Ölçüler pencere genişliğinden HESAPLANIR (utils/storyCanvasLayout.js →
// planStoryActionBar): eskiden `genişlik < 400` eşiğiyle iki sabit düzen vardı
// ve 400–440 dp arasında "Tasarımı Paylaş" kırpılıyordu. Metin sığmıyorsa kısa
// etiket seçilir; sığan en uzun başlık gösterilir.
function StoryActionBarComponent({ busy, onShare, onShareSticker, onOpenSettings, onSaveImage }) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  // Camda düğme kırpılmaz (cam katmanı çocuğudur, basılınca sınırda kesilirdi); taşan parıltı
  // dairesi de bu yüzden yalnız eski görünümde çizilir — cam kendi parlamasını taşır.
  const glass = useLiquidGlass();

  const fullTitle = i18nText("autoI18n.tasarimi_paylas", "Tasarımı Paylaş");
  const shortTitle = i18nText("autoI18n.paylas", "Paylaş");
  const busyTitle = i18nText("autoI18n.gorsel_hazirlaniyor", "Görsel hazırlanıyor");
  const subText = i18nText("autoI18n.png_olarak_disa_aktar", "PNG olarak dışa aktar");

  const plan = useMemo(
    () =>
      planStoryActionBar(width, {
        titles: busy ? [busyTitle, shortTitle] : [fullTitle, shortTitle],
        // Düzen meşgulken değişmesin: çubuk yüksekliği sıçrayıp tuvali oynatmasın.
        variantTitle: fullTitle,
        sub: subText,
      }),
    [width, busy, busyTitle, shortTitle, fullTitle, subText]
  );

  const secondary = [
    styles.iconBtn,
    {
      width: plan.secondaryW,
      minHeight: plan.rowH,
      backgroundColor: theme.secondary,
      borderColor: theme.border,
    },
  ];

  return (
    <View style={[styles.row, { gap: plan.gap }]}>
      <GlassTouchable
        activeOpacity={0.9}
        onPress={onShare}
        disabled={busy}
        style={[
          styles.shareBtn,
          {
            minHeight: plan.rowH,
            gap: plan.innerGap,
            paddingHorizontal: plan.pad.x,
            paddingVertical: plan.pad.y,
            backgroundColor: theme.accent,
            opacity: busy ? 0.7 : 1,
          },
        ]}
      >
        {glass ? null : <View style={styles.glow} />}
        <View
          style={[
            styles.iconWrap,
            { width: plan.icon, height: plan.icon, borderRadius: Math.round(plan.icon * 0.33) },
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="share-social" size={plan.icon >= 42 ? 22 : 20} color="#fff" />
          )}
        </View>
        <View style={styles.copy}>
          {/* adjustsFontSizeToFit: hesaplanan genişlik gerçek yazı tipinden dar
              kalırsa (Android Roboto Black gibi) kırpmak yerine küçülür. */}
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[styles.title, { fontSize: plan.titleSize }]}
          >
            {plan.title}
          </Text>
          {plan.showSub && (
            <Text allowFontScaling={false} numberOfLines={1} style={styles.sub}>
              {subText}
            </Text>
          )}
        </View>
      </GlassTouchable>

      {/* İçerikleri saydam zeminli PNG (çıkartma) olarak paylaş */}
      {onShareSticker && (
        <GlassTouchable
          activeOpacity={0.85}
          onPress={onShareSticker}
          disabled={busy}
          style={secondary}
        >
          <Ionicons name="cut-outline" size={22} color={theme.text.secondary} />
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.iconLabel, { color: theme.text.muted }]}>
            {i18nText("autoI18n.sticker", "Sticker")}
          </Text>
        </GlassTouchable>
      )}

      <GlassTouchable
        activeOpacity={0.85}
        onPress={onSaveImage}
        disabled={busy}
        style={secondary}
      >
        <Ionicons name="download-outline" size={22} color={theme.text.secondary} />
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.iconLabel, { color: theme.text.muted }]}>
          {i18nText("autoI18n.galeri", "Galeri")}
        </Text>
      </GlassTouchable>

      <GlassTouchable
        activeOpacity={0.85}
        onPress={onOpenSettings}
        disabled={busy}
        style={secondary}
      >
        <Ionicons name="color-wand-outline" size={22} color={theme.accent} />
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.iconLabel, { color: theme.text.muted }]}>
          {i18nText("autoI18n.duzenle", "Düzenle")}
        </Text>
      </GlassTouchable>
    </View>
  );
}

export const StoryActionBar = memo(StoryActionBarComponent);

const styles = StyleSheet.create({
  row: { width: "100%", flexDirection: "row", alignItems: "stretch" },
  shareBtn: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 10,
  },
  glow: {
    position: "absolute",
    top: -24,
    right: -18,
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  iconWrap: {
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: "#fff", fontWeight: "900" },
  sub: { color: "rgba(255,255,255,0.78)", fontSize: 11, fontWeight: "800" },
  iconBtn: {
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 2,
  },
  iconLabel: { fontSize: 10, fontWeight: "800", alignSelf: "stretch", textAlign: "center" },
});
