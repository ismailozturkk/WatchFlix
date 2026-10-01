// components/settings/AppIconSection.js
//
// Ayarlar > Kişiselleştirme: uygulama simgesi seçici. Katalog utils/appIcons.js,
// çalışma zamanı köprüsü services/appIconService.js (yerel modül modules/app-icon).
//
// Destek yoksa (modül bu binary'de yok — Expo Go / eski build — ya da cihaz
// alternatif simge desteklemiyor) kart HİÇ çizilmez: kullanıcıya çalışmayan bir
// seçenek göstermek, hiç göstermemekten kötü.
//
// Simgenin gerçeği işletim sisteminde; seçim burada saklanmaz, açılışta OS'tan
// okunur (bkz. services/appIconService.js).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import AppIcon from "@components/AppIcon";
import { toast } from "@components/AppToast";
import * as Haptics from "@services/hapticsService";
import {
  getActiveAppIconId,
  isAppIconChangeSupported,
  setActiveAppIcon,
} from "@services/appIconService";
import { APP_ICONS, DEFAULT_APP_ICON_ID } from "@utils/appIcons";
import { i18nText } from "@utils/i18nText";
import { alpha } from "@theme/colors";

// Görseller statik require: Metro bunları derleme anında paketler.
const PREVIEWS = {
  default: require("../../assets/icon_default/icon.png"),
  glass: require("../../assets/icon_glass/icon.png"),
};

export default function AppIconSection({ colors: C }) {
  const [supported, setSupported] = useState(false);
  const [activeId, setActiveId] = useState(DEFAULT_APP_ICON_ID);
  const [busyId, setBusyId] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      const ok = await isAppIconChangeSupported();
      if (!mountedRef.current || !ok) return;
      const id = await getActiveAppIconId();
      if (!mountedRef.current) return;
      setActiveId(id);
      setSupported(true);
    })();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const onSelect = useCallback(
    async (id) => {
      if (busyId || id === activeId) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setBusyId(id);
      try {
        const applied = await setActiveAppIcon(id);
        if (!mountedRef.current) return;
        setActiveId(applied);
        toast.success(
          i18nText("autoI18n.uygulama_simgesi_degisti", "Simge değişti"),
          // Android başlatıcıları simgeyi gecikmeli yeniler; iOS kendi sistem
          // uyarısını gösterir, ek not gerekmez.
          Platform.OS === "android"
            ? i18nText(
                "autoI18n.uygulama_simgesi_degisti_android",
                "Ana ekran birkaç saniye içinde güncellenir",
              )
            : undefined,
        );
      } catch (e) {
        if (__DEV__) console.warn("setActiveAppIcon:", e?.message);
        toast.error(
          i18nText("autoI18n.uygulama_simgesi_hata", "Simge değiştirilemedi"),
          i18nText("autoI18n.uygulama_simgesi_hata_alt", "Biraz sonra tekrar dene"),
        );
      } finally {
        if (mountedRef.current) setBusyId(null);
      }
    },
    [activeId, busyId],
  );

  if (!supported) return null;

  return (
    <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: C.iconBlue }]}>
          <AppIcon name="apps-outline" size={16} color={C.blue} />
        </View>
        <View style={styles.headerTexts}>
          <Text allowFontScaling={false} style={[styles.title, { color: C.text }]}>
            {i18nText("autoI18n.uygulama_simgesi_baslik", "Uygulama simgesi")}
          </Text>
          <Text allowFontScaling={false} style={[styles.sub, { color: C.muted }]}>
            {i18nText(
              "autoI18n.uygulama_simgesi_aciklama",
              "Ana ekranda görünecek simgeyi seç",
            )}
          </Text>
        </View>
      </View>

      <View style={styles.options}>
        {APP_ICONS.map((icon) => {
          const active = icon.id === activeId;
          const pending = busyId === icon.id;
          const label = i18nText(icon.labelKey, icon.labelFallback);
          return (
            <Pressable
              key={icon.id}
              onPress={() => onSelect(icon.id)}
              disabled={!!busyId}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, busy: pending }}
              accessibilityLabel={label}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: active ? alpha(C.accent, 0.08) : C.cardAlt,
                  borderColor: active ? C.accent : C.borderMuted,
                },
                pressed && styles.optionPressed,
                !!busyId && !pending && styles.optionDimmed,
              ]}
            >
              <View style={styles.previewWrap}>
                <Image
                  source={PREVIEWS[icon.id]}
                  style={[styles.preview, { borderColor: alpha(C.border, 0.8) }]}
                  contentFit="cover"
                  cachePolicy="memory"
                />
                {active ? (
                  <View style={[styles.check, { backgroundColor: C.accent, borderColor: C.card }]}>
                    <AppIcon name="checkmark" size={11} color={C.white} />
                  </View>
                ) : null}
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[
                  styles.optionLabel,
                  { color: active ? C.accentStrong : C.text },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // marginBottom: kart yalnız destek varken çizilir; boşluğu kendisi taşır ki
  // desteklenmeyen cihazda ekranda artık bir boşluk kalmasın.
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden", marginBottom: 10 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerTexts: { flex: 1 },
  title: { fontSize: 14, fontWeight: "500" },
  sub: { fontSize: 11, marginTop: 2 },
  options: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  option: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 10,
  },
  optionPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  optionDimmed: { opacity: 0.55 },
  previewWrap: { width: 72, height: 72 },
  // iOS simge köşesi ≈ kenarın %22'si.
  preview: { width: 72, height: 72, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  check: {
    position: "absolute",
    right: -6,
    top: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: { fontSize: 13, fontWeight: "700" },
});
