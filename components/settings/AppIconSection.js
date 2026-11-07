// components/settings/AppIconSection.js
//
// Ayarlar > Kişiselleştirme: uygulama simgesi seçici. Katalog utils/appIcons.js,
// çalışma zamanı köprüsü services/appIconService.js (yerel modül modules/app-icon).
//
// Destek yoksa (modül bu binary'de yok — Expo Go / eski build — ya da cihaz
// alternatif simge desteklemiyor) kart HİÇ çizilmez: kullanıcıya çalışmayan bir
// seçenek göstermek, hiç göstermemekten kötü. YALNIZ geliştirme build'inde
// (__DEV__) kartın yerine nedenini söyleyen soluk bir not çizilir; yoksa kart
// "kayboldu" sanılıyor ve eski bir native build'de saatlerce aranıyor.
//
// Simgenin gerçeği işletim sisteminde; seçim services/appIconStore.js'a da
// yazılır ve uygulamadaki TÜM logolar (giriş, splash, hakkında, paylaşım
// kartları...) hooks/useAppLogo.js ile oradan beslenir — simge değişince hepsi
// birlikte, yeniden başlatma olmadan değişir.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import AppIcon from "@components/AppIcon";
import { toast } from "@components/AppToast";
import * as Haptics from "@services/hapticsService";
import {
  getAppIconSupportStatus,
  getAvailableAppIconIds,
  reconcileAppIconWithSystem,
  setActiveAppIcon,
} from "@services/appIconService";
import { useAppIconId } from "@services/appIconStore";
import { APP_LOGO_SOURCES } from "@components/appLogoSources";
import { APP_ICONS, DEFAULT_APP_ICON_ID } from "@utils/appIcons";
import { i18nText } from "@utils/i18nText";
import { usePremiumGate } from "@hooks/usePremiumGate";
import PremiumPill from "@components/premium/PremiumPill";
import { alpha } from "@theme/colors";
import GlassBox from "../common/GlassBox";

export default function AppIconSection({ colors: C }) {
  // null = henüz sorgulanmadı; sonra getAppIconSupportStatus() değerlerinden biri.
  const [status, setStatus] = useState(null);
  // Seçili simge uygulama içi logoların da kaynağı olan store'dan okunur: kart
  // ile giriş/splash/paylaşım logoları AYNI değeri gösterir, ayrı state tutulmaz.
  const activeId = useAppIconId();
  const [busyId, setBusyId] = useState(null);
  // Bu binary'de bulunan simgeler. Katalog native build'den önce büyüyebilir (JS OTA
  // ile gelir); olmayan simge listelenirse seçince "Simge değiştirilemedi" çıkar.
  const [availableIds, setAvailableIds] = useState([DEFAULT_APP_ICON_ID]);
  const mountedRef = useRef(true);
  // Simge değiştirmek Premium'da. Ücretsiz kullanıcı varsayılan simgede kalır;
  // plan düşmüş olsa bile varsayılana DÖNMEK serbest (kilit yalnız diğer simgeler).
  const iconGate = usePremiumGate("app_icon");
  const iconLocked = !iconGate.allows();

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      const next = await getAppIconSupportStatus();
      if (!mountedRef.current) return;
      if (next !== "supported") {
        setStatus(next);
        return;
      }
      // Store açılışta zaten eşitlendi; kart açılırken bir kez daha doğrula.
      const [ids] = await Promise.all([getAvailableAppIconIds(), reconcileAppIconWithSystem()]);
      if (!mountedRef.current) return;
      setAvailableIds(ids);
      setStatus(next);
    })();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const onSelect = useCallback(
    async (id) => {
      if (busyId || id === activeId) return;
      if (iconLocked && id !== DEFAULT_APP_ICON_ID) {
        iconGate.showUpsell();
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setBusyId(id);
      try {
        // Başarıda store da güncellenir: tüm uygulama logoları anında geçer.
        await setActiveAppIcon(id);
        if (!mountedRef.current) return;
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
        // Sebep yayın yapısında da gösterilir: simge değişimi yalnız cihazda
        // denenebiliyor ve sebebi gizlendiğinde (1.5.0) sorunu ancak derleme
        // kaydından tahmin edebildik. Sistemin kendi metni Türkçeleştirilemez,
        // ama tanıyı bir build turu kısaltıyor.
        const reason = typeof e?.message === "string" ? e.message.trim() : "";
        toast.error(
          i18nText("autoI18n.uygulama_simgesi_hata", "Simge değiştirilemedi"),
          reason || i18nText("autoI18n.uygulama_simgesi_hata_alt", "Biraz sonra tekrar dene"),
        );
      } finally {
        if (mountedRef.current) setBusyId(null);
      }
    },
    [activeId, busyId, iconGate, iconLocked],
  );

  const icons = APP_ICONS.filter((i) => availableIds.includes(i.id));
  // Varsayılan dışındaki her simge Premium (kapı: "app_icon").
  const premiumIconCount = icons.filter((i) => i.id !== DEFAULT_APP_ICON_ID).length;
  const missingCount = APP_ICONS.length - icons.length;

  if (status !== "supported") {
    if (!__DEV__ || !status) return null;
    return (
      <GlassBox role="card" style={[styles.card, styles.devNote, { borderColor: C.borderMuted }]}>
        <Text allowFontScaling={false} style={[styles.devTitle, { color: C.muted }]}>
          Uygulama simgesi seçici gizli (yalnız geliştirme build'inde görünür)
        </Text>
        <Text allowFontScaling={false} style={[styles.devBody, { color: C.muted }]}>
          {status === "no-module"
            ? "Bu yapıda SeelogdAppIcon native modülü yok (Expo Go ya da modülden önce alınmış build). Yeni bir development build gerekir."
            : "Modül var ama alternatif simge desteği yok. Android'de AndroidManifest'te MainActivityDefault/Glass alias'ları eksik: eski bir android/ klasörü kullanılıyor olabilir, `npx expo prebuild --platform android` ile yeniden üret."}
        </Text>
      </GlassBox>
    );
  }

  return (
    <GlassBox role="card" style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: C.iconBlue }]}>
          <AppIcon name="apps-outline" size={16} color={C.blue} />
        </View>
        <View style={styles.headerTexts}>
          <Text allowFontScaling={false} style={[styles.title, { color: C.text }]}>
            {i18nText("autoI18n.uygulama_simgesi_baslik", "Uygulama simgesi")}
          </Text>
          <Text allowFontScaling={false} style={[styles.sub, { color: C.muted }]}>
            {iconLocked
              ? i18nText(
                  "autoI18n.uygulama_simgesi_premium_alt",
                  `Premium ile ${premiumIconCount} özel simgenin kilidi açılır`,
                  { count: premiumIconCount },
                )
              : i18nText(
                  "autoI18n.uygulama_simgesi_aciklama",
                  "Ana ekranda görünecek simgeyi seç",
                )}
          </Text>
        </View>
        {iconLocked ? <PremiumPill /> : null}
      </View>

      <View style={styles.options}>
        {icons.map((icon) => {
          const active = icon.id === activeId;
          const pending = busyId === icon.id;
          const locked = iconLocked && icon.id !== DEFAULT_APP_ICON_ID;
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
                locked && styles.optionLocked,
              ]}
            >
              <View style={styles.previewWrap}>
                <Image
                  source={APP_LOGO_SOURCES[icon.id].icon}
                  style={[styles.preview, { borderColor: alpha(C.border, 0.8) }]}
                  contentFit="cover"
                  cachePolicy="memory"
                />
                {active ? (
                  <View style={[styles.check, { backgroundColor: C.accent, borderColor: C.card }]}>
                    <AppIcon name="checkmark" size={11} color={C.white} />
                  </View>
                ) : locked ? (
                  <View style={[styles.check, { backgroundColor: C.accent, borderColor: C.card }]}>
                    <AppIcon name="diamond" size={10} color={C.white} />
                  </View>
                ) : null}
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
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
      {__DEV__ && missingCount > 0 ? (
        <Text allowFontScaling={false} style={[styles.devFootnote, { color: C.muted }]}>
          {`${missingCount} simge bu native build'de yok (yalnız geliştirme build'inde görünür). Yeni build gerekir.`}
        </Text>
      ) : null}
    </GlassBox>
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
  devNote: { borderStyle: "dashed", padding: 12, gap: 4, opacity: 0.8 },
  devTitle: { fontSize: 12, fontWeight: "600" },
  devBody: { fontSize: 11, lineHeight: 16 },
  devFootnote: { fontSize: 10.5, lineHeight: 15, paddingHorizontal: 14, paddingBottom: 12, marginTop: -4 },
  // Üç sütunlu ızgara: katalog sırasıyla üst satır Lens (Varsayılan · 3B · Cam), alt satır S
  // (Klasik · Cam · Düz). Sütun aralığı yüzde genişlik + space-between ile verilir: `gap`
  // yüzdelere eklenince son sütun alt satıra düşüyordu.
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  option: {
    width: "31.5%",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 7,
  },
  optionPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  optionDimmed: { opacity: 0.55 },
  optionLocked: { opacity: 0.72 },
  previewWrap: { width: 56, height: 56 },
  // iOS simge köşesi ≈ kenarın %22'si.
  preview: { width: 56, height: 56, borderRadius: 12.5, borderWidth: StyleSheet.hairlineWidth },
  check: {
    position: "absolute",
    right: -5,
    top: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: { fontSize: 11.5, fontWeight: "700", alignSelf: "stretch", textAlign: "center" },
});
