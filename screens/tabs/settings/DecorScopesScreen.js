// screens/tabs/settings/DecorScopesScreen.js
//
// Ayarlar > Kişiselleştirme > Ekran bazında. Kar, ikon deseni ve ambiyans
// efektlerinin HANGİ EKRAN GRUPLARINDA görüneceğini seçtirir (ör. ana
// ekranlarda kar, sohbette ikon, liste/detayda ambiyans).
//
// Üç kapıdan biri: efektin kendi genel anahtarı Kişiselleştirme'de, bu ekran
// onun ÜSTÜNDE bir süzgeç. Genel anahtarı kapalı bir efekti burada açmak onu
// görünür kılmaz — bu yüzden altta bir not var. Free'de kilitli efektlerin
// (kar, ikon) kutuları yükseltme sayfasına gider, tıpkı ana ekrandaki anahtar
// gibi.
//
// Mantık utils/decorScopes.js'te (saf, testli); burada yalnız çizim.

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
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

// Etiketler render içinde çözülür (dil değişince yeniden çizilsin); anahtarlar
// STATİK yazılı çünkü i18nKeys bekçisi yalnız düz dizgeleri tarar.
function buildCopy() {
  return {
    effects: {
      snow: i18nText("autoI18n.dekor_efekt_kar", "Kar"),
      icon: i18nText("autoI18n.dekor_efekt_ikon", "İkon"),
      ambient: i18nText("autoI18n.dekor_efekt_ambiyans", "Ambiyans"),
    },
    groups: {
      home: [
        i18nText("autoI18n.dekor_grup_home", "Ana ekranlar"),
        i18nText("autoI18n.dekor_grup_home_alt", "Hub, Film, Dizi, Sıradaki, Tümünü gör"),
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
          "Listelerim, liste içi ve paylaşılan listeler",
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
          "Birebir ve grup sohbet ekranları (kar yok)",
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
          "Profil, arkadaşlar, rozetler, istatistikler, notlar",
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

// Efekt başına simge: Personalization satırlarıyla AYNI (kar / ikon / ambiyans).
const EFFECT_ICONS = {
  snow: { off: "snow-outline", on: "snow" },
  icon: { off: "image-outline", on: "image" },
  ambient: { off: "prism-outline", on: "prism" },
};

/**
 * Bir efektin tek bir grup için aç/kapat kutusu. `state`: "on" | "off" |
 * "mixed" (yalnız "Tüm ekranlar" satırında: bazı gruplarda açık, bazılarında
 * kapalı).
 */
function EffectChip({ effect, label, state, color, dimmed, locked, onPress, a11yLabel, C }) {
  const on = state === "on";
  const mixed = state === "mixed";
  const lit = on || mixed;
  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityLabel={a11yLabel}
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
        size={14}
        color={lit ? color : C.muted}
      />
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[
          s.chipLabel,
          { color: lit ? C.text : C.muted, fontWeight: on ? "700" : "500" },
        ]}
      >
        {label}
      </Text>
      {locked ? (
        <AppIcon name="lock-closed" size={10} color={C.muted} />
      ) : mixed ? (
        <AppIcon name="remove" size={12} color={color} />
      ) : on ? (
        <AppIcon name="checkmark" size={12} color={color} />
      ) : null}
    </TouchableOpacity>
  );
}

export default function DecorScopesScreen() {
  useLanguage(); // dil değişince yeniden çiz (etiketler i18nText ile render'da çözülür)
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const copy = buildCopy();

  const { showSnow, snowAllowed } = useSnowSettings();
  const { showIconBackground, iconBackgroundAllowed } = useIconBackgroundSettings();
  const { showAmbientBackground } = useAmbientBackgroundSettings();
  const { decorHidden, changeDecorVisible, changeDecorEffectVisible, resetDecorScopes } =
    useDecorScopeSettings();
  const snowGate = usePremiumGate("snow_effect");
  const iconGate = usePremiumGate("icon_background");

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
    ambient: { enabled: showAmbientBackground, locked: false, gate: null, color: C.purple },
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
          "Her efekti hangi ekran gruplarında görmek istediğini seç. Bir gruptaki kutuya dokunarak o efekti orada aç ya da kapat.",
        )}
      </Text>

      <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
        {/* Tüm ekranlar: sütun toplu anahtarı */}
        <View style={[s.block, { borderBottomColor: C.borderMuted }]}>
          <View style={s.head}>
            <View style={[s.iconWrap, { backgroundColor: C.iconTeal }]}>
              <AppIcon name="apps-outline" size={16} color={C.teal} />
            </View>
            <View style={s.headTexts}>
              <Text allowFontScaling={false} style={[s.title, { color: C.text }]}>
                {i18nText("autoI18n.dekor_tum_ekranlar", "Tüm ekranlar")}
              </Text>
              <Text allowFontScaling={false} style={[s.sub, { color: C.muted }]}>
                {i18nText(
                  "autoI18n.dekor_tum_ekranlar_alt",
                  "Bir efekti tüm gruplarda tek dokunuşla aç ya da kapat",
                )}
              </Text>
            </View>
          </View>
          <View style={s.chipRow}>
            {DECOR_EFFECTS.map((effect) => (
              <EffectChip
                key={effect}
                C={C}
                effect={effect}
                label={copy.effects[effect]}
                state={allState(effect)}
                color={effectInfo[effect].color}
                dimmed={!effectInfo[effect].enabled && !effectInfo[effect].locked}
                locked={effectInfo[effect].locked}
                a11yLabel={`${copy.effects[effect]}, ${i18nText("autoI18n.dekor_tum_ekranlar", "Tüm ekranlar")}`}
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
                <View style={[s.iconWrap, { backgroundColor: C.iconBlue }]}>
                  <AppIcon name={scope.icon} size={16} color={C.blue} />
                </View>
                <View style={s.headTexts}>
                  <Text allowFontScaling={false} style={[s.title, { color: C.text }]}>
                    {name}
                  </Text>
                  <Text allowFontScaling={false} style={[s.sub, { color: C.muted }]}>
                    {hint}
                  </Text>
                </View>
              </View>
              <View style={s.chipRow}>
                {DECOR_EFFECTS.map((effect) => {
                  const info = effectInfo[effect];
                  // Grup bu efekti hiç çizmiyorsa (ör. Sohbet içi + kar) kutu
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
                      label={copy.effects[effect]}
                      state={visible ? "on" : "off"}
                      color={info.color}
                      dimmed={!info.enabled && !info.locked}
                      locked={info.locked}
                      a11yLabel={`${copy.effects[effect]}, ${name}`}
                      onPress={() => toggleScope(effect, scope.id)}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>

      {anyGloballyOff ? (
        <Text allowFontScaling={false} style={[s.note, { color: C.muted }]}>
          {i18nText(
            "autoI18n.dekor_genel_kapali_not",
            "Kişiselleştirme'de genel olarak kapalı olan efekt, burada açık olsa da hiçbir ekranda görünmez.",
          )}
        </Text>
      ) : null}

      {isDecorCustomized(decorHidden) ? (
        <TouchableOpacity
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
        </TouchableOpacity>
      ) : null}
    </SettingsSubScreen>
  );
}

const s = StyleSheet.create({
  intro: { fontSize: 12, lineHeight: 17, marginTop: 6, marginBottom: 12, marginHorizontal: 4 },
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  block: {
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 13,
    borderBottomWidth: 1,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  headTexts: { flex: 1 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: { fontSize: 14, fontWeight: "500" },
  sub: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  chipRow: { flexDirection: "row", gap: 8, marginTop: 11 },
  chip: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  chipUnsupported: { borderStyle: "dashed", opacity: 0.4 },
  chipLabel: { fontSize: 12, flexShrink: 1 },
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
