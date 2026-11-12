// screens/tabs/settings/DecorScopesScreen.js
//
// Ayarlar > Atmosfer > Ekran bazında. Atmosfer, ikon deseni ve ambiyans
// efektlerinin HANGİ EKRAN GRUPLARINDA görüneceğini seçtirir (ör. ana
// ekranlarda atmosfer, sohbette ikon, liste/detayda ambiyans).
//
// Üç kapıdan biri: efektin kendi genel anahtarı Atmosfer ekranında, bu ekran
// onun ÜSTÜNDE bir süzgeç. Genel anahtarı kapalı bir efekti burada açmak onu
// görünür kılmaz — bu yüzden altta bir not var. Free'de kilitli efektlerin
// (atmosfer, ikon) kutuları yükseltme sayfasına gider, tıpkı ana ekrandaki anahtar
// gibi.
//
// Mantık utils/decorScopes.js'te (saf, testli); burada yalnız çizim.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import AppIcon from "@components/AppIcon";
import { usePremiumGate } from "@hooks/usePremiumGate";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import {
  useAmbientBackgroundSettings,
  useDecorScopeSettings,
  useIconBackgroundSettings,
  useSnowSettings,
} from "@context/AppSettingsContext";
import * as Haptics from "@services/hapticsService";
import { i18nText } from "@utils/i18nText";
import {
  DECOR_EFFECTS,
  DECOR_SCOPES,
  decorScopeSupports,
  isDecorCustomized,
  isDecorEffectEverywhere,
  isDecorEffectNowhere,
  isDecorVisible,
} from "@utils/decorScopes";
import { alpha } from "@theme/colors";
import { SettingsSubScreen, buildUiColors } from "./settingsUi";
import GlassTouchable from "../../../components/common/GlassTouchable";
import GlassBox from "../../../components/common/GlassBox";

// Etiketler render içinde çözülür (dil değişince yeniden çizilsin); anahtarlar
// STATİK yazılı çünkü i18nKeys bekçisi yalnız düz dizgeleri tarar.
function buildCopy() {
  return {
    effects: {
      snow: i18nText("autoI18n.dekor_efekt_kar", "Atmosfer"),
      icon: i18nText("autoI18n.dekor_efekt_ikon", "İkon"),
      ambient: i18nText("autoI18n.dekor_efekt_ambiyans", "Ambiyans"),
    },
    groups: {
      home: [
        i18nText("autoI18n.dekor_grup_home", "Ana ekranlar"),
        i18nText("autoI18n.dekor_grup_home_alt", "Eğlence, Film, Dizi, Sıradaki, Tümünü gör"),
      ],
      search: [
        i18nText("autoI18n.dekor_grup_search", "Arama"),
        i18nText("autoI18n.dekor_grup_search_alt", "Film, dizi ve oyuncu arama"),
      ],
      details: [
        i18nText("autoI18n.dekor_grup_details", "Film ve dizi detayları"),
        i18nText(
          "autoI18n.dekor_grup_details_alt",
          "Film, dizi, sezon, bölüm, oyuncu ve yorumlar",
        ),
      ],
      lists: [
        i18nText("autoI18n.dekor_grup_lists", "Listeler"),
        i18nText(
          "autoI18n.dekor_grup_lists_alt",
          "Kütüphane, listelerim, liste içi ve paylaşılan listeler",
        ),
      ],
      chat: [
        i18nText("autoI18n.dekor_grup_chat", "Sohbet"),
        i18nText(
          "autoI18n.dekor_grup_chat_alt",
          "Mesajlar, gruplar ve yeni grup oluşturma",
        ),
      ],
      conversation: [
        i18nText("autoI18n.dekor_grup_conversation", "Sohbet içi"),
        i18nText(
          "autoI18n.dekor_grup_conversation_alt",
          "Birebir ve grup sohbet ekranları",
        ),
      ],
      social: [
        i18nText("autoI18n.dekor_grup_social", "Paylaşımlar"),
        i18nText(
          "autoI18n.dekor_grup_social_alt",
          "Akış, gönderilerim, gönderi detayı, hikâye taslakları",
        ),
      ],
      profile: [
        i18nText("autoI18n.dekor_grup_profile", "Profil ve arkadaşlar"),
        i18nText(
          "autoI18n.dekor_grup_profile_alt",
          "Profil, arkadaşlar, rozetler, istatistikler",
        ),
      ],
      settings: [
        i18nText("autoI18n.dekor_grup_settings", "Ayarlar"),
        i18nText("autoI18n.dekor_grup_settings_alt", "Ayarlar ve alt sayfaları"),
      ],
      more: [
        i18nText("autoI18n.dekor_grup_more", "Takvim ve oyunlar"),
        i18nText("autoI18n.dekor_grup_more_alt", "Takvim, turnuva"),
      ],
      auth: [
        i18nText("autoI18n.dekor_grup_auth", "Giriş ve kayıt"),
        i18nText("autoI18n.dekor_grup_auth_alt", "Giriş, kayıt, şifremi unuttum"),
      ],
    },
  };
}

// Efekt başına simge: Atmosfer satırlarıyla aynı (atmosfer / ikon / ambiyans).
const EFFECT_ICONS = {
  snow: { off: "sparkles-outline", on: "sparkles" },
  icon: { off: "image-outline", on: "image" },
  ambient: { off: "prism-outline", on: "prism" },
};

/**
 * Bir efektin tek bir grup için aç/kapat kutusu. `state`: "on" | "off" |
 * "mixed" (yalnız "Tüm ekranlar" satırında: bazı gruplarda açık, bazılarında
 * kapalı).
 */
function EffectChip({ effect, state, color, dimmed, locked, onPress, a11yLabel, accessibilityHint, C }) {
  const on = state === "on";
  const mixed = state === "mixed";
  const lit = on || mixed;
  return (
    <GlassTouchable
      accessibilityRole="switch"
      accessibilityLabel={a11yLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked: mixed ? "mixed" : on }}
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        s.chip,
        {
          backgroundColor: lit ? alpha(color, mixed ? 0.09 : 0.16) : C.cardAlt,
          borderColor: lit ? alpha(color, mixed ? 0.55 : 1) : C.borderMuted,
          opacity: dimmed ? 0.5 : 1,
        },
      ]}
    >
      <AppIcon
        name={lit ? EFFECT_ICONS[effect].on : EFFECT_ICONS[effect].off}
        size={17}
        color={lit ? color : C.muted}
      />
      {locked ? (
        <View style={s.chipMark}><AppIcon name="lock-closed" size={9} color={C.muted} /></View>
      ) : mixed ? (
        <View style={s.chipMark}><AppIcon name="remove" size={10} color={color} /></View>
      ) : on ? (
        <View style={s.chipMark}><AppIcon name="checkmark" size={10} color={color} /></View>
      ) : null}
    </GlassTouchable>
  );
}

export default function DecorScopesScreen() {
  useLanguage(); // dil değişince yeniden çiz (etiketler i18nText ile render'da çözülür)
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const copy = buildCopy();

  const { showSnow, snowAllowed } = useSnowSettings();
  const { showIconBackground, iconBackgroundAllowed } = useIconBackgroundSettings();
  const { showAmbientBackground, ambientAllowed } = useAmbientBackgroundSettings();
  const { decorHidden, changeDecorVisible, changeDecorEffectVisible, resetDecorScopes } =
    useDecorScopeSettings();
  const snowGate = usePremiumGate("snow_effect");
  const iconGate = usePremiumGate("icon_background");
  const ambientGate = usePremiumGate("ambient_background");

  // `enabled`: genel anahtar etkin değer (Free'de kilitliyse zaten false).
  // `locked`: Premium gerektiriyor ve plan yetmiyor → kutu yükseltmeye gider.
  const effectInfo = {
    snow: { enabled: showSnow, locked: !snowAllowed, gate: snowGate, color: C.teal },
    icon: {
      enabled: showIconBackground,
      locked: !iconBackgroundAllowed,
      gate: iconGate,
      color: C.blue,
    },
    ambient: {
      enabled: showAmbientBackground,
      locked: !ambientAllowed,
      gate: ambientGate,
      color: C.purple,
    },
  };

  const guard = (effect) => {
    const info = effectInfo[effect];
    if (info.locked) {
      info.gate?.showUpsell();
      return false;
    }
    Haptics.selectionAsync();
    return true;
  };

  const toggleScope = (effect, scope) => {
    if (!guard(effect)) return;
    changeDecorVisible(effect, scope, !isDecorVisible(decorHidden, effect, scope));
  };

  // "Tüm ekranlar": her yerde açıksa hepsini kapat, değilse hepsini aç.
  const toggleAll = (effect) => {
    if (!guard(effect)) return;
    changeDecorEffectVisible(effect, !isDecorEffectEverywhere(decorHidden, effect));
  };

  const allState = (effect) =>
    isDecorEffectEverywhere(decorHidden, effect)
      ? "on"
      : isDecorEffectNowhere(decorHidden, effect)
        ? "off"
        : "mixed";

  const anyGloballyOff = DECOR_EFFECTS.some(
    (e) => !effectInfo[e].enabled && !effectInfo[e].locked,
  );

  return (
    <SettingsSubScreen
      title={i18nText("autoI18n.dekor_kapsam_sayfa_baslik", "Ekran bazında efektler")}
    >
      <Text allowFontScaling={false} style={[s.intro, { color: C.muted }]}>
        {i18nText(
          "autoI18n.dekor_kapsam_aciklama",
          "Efektlerin hangi ekranlarda görüneceğini seç.",
        )}
      </Text>

      <View style={s.legend}>
        {DECOR_EFFECTS.map((effect) => (
          <View key={effect} style={s.legendItem}>
            <AppIcon name={EFFECT_ICONS[effect].on} size={14} color={effectInfo[effect].color} />
            <Text allowFontScaling={false} numberOfLines={1} style={[s.legendText, { color: C.muted }]}>
              {copy.effects[effect]}
            </Text>
          </View>
        ))}
      </View>

      <GlassBox role="card" style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
        {/* Tüm ekranlar: sütun toplu anahtarı */}
        <View style={[s.block, s.allBlock, { borderBottomColor: C.borderMuted, backgroundColor: C.cardAlt }]}>
          <View style={s.head}>
            <View style={[s.iconWrap, { backgroundColor: C.iconTeal }]}>
              <AppIcon name="apps-outline" size={16} color={C.teal} />
            </View>
            <View style={s.headTexts}>
              <Text allowFontScaling={false} style={[s.title, { color: C.text }]}>
                {i18nText("autoI18n.dekor_tum_ekranlar", "Tüm ekranlar")}
              </Text>
            </View>
          </View>
          <View style={s.chipRow}>
            {DECOR_EFFECTS.map((effect) => (
              <EffectChip
                key={effect}
                C={C}
                effect={effect}
                state={allState(effect)}
                color={effectInfo[effect].color}
                dimmed={!effectInfo[effect].enabled && !effectInfo[effect].locked}
                locked={effectInfo[effect].locked}
                a11yLabel={`${copy.effects[effect]}, ${i18nText("autoI18n.dekor_tum_ekranlar", "Tüm ekranlar")}`}
                accessibilityHint={i18nText("autoI18n.dekor_tum_ekranlar_alt", "Bu efekti tüm ekranlarda aç veya kapat")}
                onPress={() => toggleAll(effect)}
              />
            ))}
          </View>
        </View>

        {DECOR_SCOPES.map((scope, index) => {
          const [name, hint] = copy.groups[scope.id];
          const last = index === DECOR_SCOPES.length - 1;
          return (
            <View
              key={scope.id}
              style={[
                s.block,
                { borderBottomColor: C.borderMuted },
                last && { borderBottomWidth: 0 },
              ]}
            >
              <View style={s.head}>
                <View style={s.headTexts}>
                  <Text allowFontScaling={false} numberOfLines={3} style={[s.title, { color: C.text }]}>
                    {name}
                  </Text>
                </View>
              </View>
              <View style={s.chipRow}>
                {DECOR_EFFECTS.map((effect) => {
                  const info = effectInfo[effect];
                  // Grup bu efekti hiç çizmiyorsa kutu
                  // yerine soluk bir yer tutucu: sütunlar hizalı kalsın, kullanıcı
                  // "kapalı" ile "desteklenmiyor"u karıştırmasın.
                  if (!decorScopeSupports(scope.id, effect)) {
                    return (
                      <View
                        key={effect}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        style={[s.chip, s.chipUnsupported, { borderColor: C.borderMuted }]}
                      >
                        <AppIcon name="remove" size={14} color={C.muted} />
                      </View>
                    );
                  }
                  const visible = isDecorVisible(decorHidden, effect, scope.id);
                  return (
                    <EffectChip
                      key={effect}
                      C={C}
                      effect={effect}
                      state={visible ? "on" : "off"}
                      color={info.color}
                      dimmed={!info.enabled && !info.locked}
                      locked={info.locked}
                      a11yLabel={`${copy.effects[effect]}, ${name}`}
                      accessibilityHint={hint}
                      onPress={() => toggleScope(effect, scope.id)}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </GlassBox>

      {anyGloballyOff ? (
        <Text allowFontScaling={false} style={[s.note, { color: C.muted }]}>
          {i18nText(
            "autoI18n.dekor_genel_kapali_not",
            "Atmosfer ayarlarında kapalı olan efekt burada açık olsa da görünmez.",
          )}
        </Text>
      ) : null}

      {isDecorCustomized(decorHidden) ? (
        <GlassTouchable
          accessibilityRole="button"
          activeOpacity={0.7}
          onPress={() => {
            Haptics.selectionAsync();
            resetDecorScopes();
          }}
          style={[s.reset, { backgroundColor: C.card, borderColor: C.border }]}
        >
          <View style={[s.iconWrap, { backgroundColor: C.iconAmber }]}>
            <AppIcon name="refresh-outline" size={16} color={C.amber} />
          </View>
          <View style={s.headTexts}>
            <Text allowFontScaling={false} style={[s.title, { color: C.text }]}>
              {i18nText("autoI18n.dekor_varsayilana_don", "Varsayılana dön")}
            </Text>
            <Text allowFontScaling={false} style={[s.sub, { color: C.muted }]}>
              {i18nText(
                "autoI18n.dekor_varsayilana_don_alt",
                "Her efekt her ekran grubunda görünsün",
              )}
            </Text>
          </View>
        </GlassTouchable>
      ) : null}
    </SettingsSubScreen>
  );
}

const s = StyleSheet.create({
  intro: { fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 10, marginHorizontal: 4 },
  legend: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 10, paddingHorizontal: 4 },
  legendItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minWidth: 0 },
  legendText: { fontSize: 11, fontWeight: "600", flexShrink: 1 },
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  block: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  allBlock: { paddingVertical: 9 },
  head: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  headTexts: { flex: 1, minWidth: 0 },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: { fontSize: 12.5, lineHeight: 16, fontWeight: "600" },
  sub: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  chipRow: { width: 144, flexDirection: "row", gap: 5 },
  chip: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipMark: { position: "absolute", right: 3, bottom: 3 },
  chipUnsupported: { borderStyle: "dashed", opacity: 0.4 },
  note: { fontSize: 11, lineHeight: 15, marginTop: 10, marginHorizontal: 4 },
  reset: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
