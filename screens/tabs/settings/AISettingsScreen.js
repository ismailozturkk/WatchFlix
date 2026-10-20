// screens/tabs/settings/AISettingsScreen.js
//
// Ayarlar > Dil ve içerik > Yapay zeka (CineMatch).
//
// Sohbet içindeki hızlı panel (components/ai/AIPrefsPanel) ile AYNI kaydı
// (Keys.aiCinePrefs) okur ve yazar — biri değişince diğeri anında güncellenir.
// Şema ve doğrulama: utils/aiPrefs.js. Bu ekran yalnız tercihleri değiştirir;
// hiçbir değişiklik yapay zeka hakkı harcamaz.

import { intlLocaleOf } from "../../../utils/appLanguages";
import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import AppIcon from "@components/AppIcon";
import SwitchToggle from "@components/SwitchToggle";
import { appAlert } from "@components/AppAlert";
import { toast } from "@components/AppToast";
import { ChoiceChip, ChoiceWrap, SegmentedChoice } from "@components/ai/AIChips";
import { genreLabel } from "@components/ai/AIPrefsPanel";
import { STREAMING_PROVIDERS } from "@context/AppSettingsContext";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import useAiPrefs from "@hooks/useAiPrefs";
import useAiConversations from "@hooks/useAiConversations";
import { fillCopy, getAiCopy } from "@utils/aiCopy";
import {
  AI_HISTORY_LIMITS,
  AI_MAX_ITEM_CHOICES,
  AI_RESPONSE_STYLES,
  AI_SPOILER_LEVELS,
  countDiscoveryFilters,
} from "@utils/aiPrefs";
import { ONBOARDING_GENRES } from "@utils/onboardingPreferences";
import { SettingsSubScreen, SectionLabel, SettingRow, Chevron, buildUiColors, ui } from "./settingsUi";
import GlassBox from "../../../components/common/GlassBox";

const LIST_KEYS = ["watchList", "favorites", "custom", "watched"];

const genreSupported = (genre, mediaType) =>
  mediaType === "movie" ? genre.movieId : mediaType === "tv" ? genre.tvId : genre.movieId || genre.tvId;

/** Kart içinde başlık + ipucu + serbest içerik bloğu (çip/bölmeli seçim satırları için). */
function Block({ C, title, hint, last, children }) {
  return (
    <View style={[s.block, { borderBottomColor: C.borderMuted }, last && { borderBottomWidth: 0 }]}>
      <Text allowFontScaling={false} style={[ui.rowTitle, { color: C.text }]}>
        {title}
      </Text>
      {hint ? (
        <Text allowFontScaling={false} style={[ui.rowSub, { color: C.muted }]}>
          {hint}
        </Text>
      ) : null}
      <View style={s.blockBody}>{children}</View>
    </View>
  );
}

export default function AISettingsScreen() {
  const navigation = useNavigation();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const locale = intlLocaleOf(language);
  const copy = useMemo(() => getAiCopy(language), [language]);
  const text = copy.settings;
  const { prefs, updatePrefs, resetPrefs } = useAiPrefs();
  // Sohbet geçmişi hesaba yedeklenir; sayı yerel kopyadan canlı gelir. Kopya
  // henüz yoksa (yeni telefon, indirme sürüyor) sayı gösterilmez.
  const { conversations, ready: chatsReady, trim: trimChats, clearAll: clearChats } = useAiConversations();
  const savedChats = chatsReady || conversations.length > 0 ? conversations.length : null;

  const filterCount = countDiscoveryFilters(prefs);

  const toggle = (key) => () => updatePrefs({ [key]: !prefs[key] });

  const styleOptions = useMemo(
    () => AI_RESPONSE_STYLES.map((value) => ({ value, label: copy.panel.style[value] })),
    [copy],
  );
  const spoilerOptions = useMemo(
    () => AI_SPOILER_LEVELS.map((value) => ({ value, label: copy.panel.spoiler[value] })),
    [copy],
  );
  const countOptions = useMemo(
    () => AI_MAX_ITEM_CHOICES.map((value) => ({ value, label: String(value) })),
    [],
  );
  const historyOptions = useMemo(
    () => AI_HISTORY_LIMITS.map((value) => ({ value, label: String(value) })),
    [],
  );
  const mediaOptions = useMemo(
    () => [
      { value: "all", label: text.mediaAll, icon: "apps-outline" },
      { value: "movie", label: text.mediaMovie, icon: "film-outline" },
      { value: "tv", label: text.mediaTv, icon: "tv-outline" },
    ],
    [text],
  );
  const genreOptions = useMemo(
    () =>
      ONBOARDING_GENRES.filter((genre) => genreSupported(genre, prefs.mediaType)).map((genre) => ({
        value: genre.key,
        label: genreLabel(genre, prefs.mediaType, language),
        icon: genre.icon,
      })),
    [prefs.mediaType, language],
  );

  const toggleProvider = (providerId) => {
    updatePrefs({
      providerIds: prefs.providerIds.includes(providerId)
        ? prefs.providerIds.filter((id) => id !== providerId)
        : [...prefs.providerIds, providerId],
    });
  };

  const changeMediaType = (mediaType) => {
    // Yeni içerik türünde karşılığı olmayan türler seçimden düşer.
    const genreKeys = prefs.genreKeys.filter((key) => {
      const genre = ONBOARDING_GENRES.find((item) => item.key === key);
      return genre && genreSupported(genre, mediaType);
    });
    updatePrefs({ mediaType, genreKeys });
  };

  const toggleGenre = (genreKey) => {
    updatePrefs({
      genreKeys: prefs.genreKeys.includes(genreKey)
        ? prefs.genreKeys.filter((key) => key !== genreKey)
        : [...prefs.genreKeys, genreKey],
    });
  };

  const changeHistoryLimit = (limit) => {
    updatePrefs({ historyLimit: limit });
    // Yeni sınır geçmişten küçükse en eski sohbetler hemen silinir (hesaptan da).
    trimChats(limit);
  };

  const confirmClearHistory = () => {
    appAlert(text.clearHistory, text.clearHistoryMessage, [
      { text: text.cancel, style: "cancel" },
      {
        text: text.deleteAction,
        style: "destructive",
        onPress: () => {
          clearChats();
        },
      },
    ]);
  };

  const confirmReset = () => {
    appAlert(text.resetConfirmTitle, text.resetConfirmMessage, [
      { text: text.cancel, style: "cancel" },
      {
        text: text.reset,
        style: "destructive",
        onPress: () => {
          resetPrefs();
          toast.success(text.reset);
        },
      },
    ]);
  };

  const switchRow = ({ key, icon, tone, title, hint, last }) => (
    <SettingRow
      key={key}
      colors={C}
      iconBg={tone[0]}
      iconColor={tone[1]}
      iconName={icon}
      title={title}
      subtitle={hint}
      last={last}
      right={<SwitchToggle value={prefs[key]} onValueChange={(value) => updatePrefs({ [key]: value })} size={36} />}
    />
  );

  const upper = (value) => value.toLocaleUpperCase(locale);

  return (
    <SettingsSubScreen title={text.title}>
      {/* ── Tanıtım ── */}
      <GlassBox role="card" style={[s.hero, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={[s.heroIcon, { backgroundColor: C.accentDim }]}>
          <AppIcon family="Ionicons" name="sparkles-outline" size={26} color={C.accent} />
        </View>
        <View style={s.heroCopy}>
          <Text allowFontScaling={false} style={[s.heroTitle, { color: C.text }]}>
            {text.heroTitle}
          </Text>
          <Text allowFontScaling={false} style={[s.heroText, { color: C.muted }]}>
            {text.heroText}
          </Text>
        </View>
      </GlassBox>
      <GlassBox role="card" style={[ui.card, s.usageCard, { backgroundColor: C.card, borderColor: C.border }]}>
        <SettingRow
          colors={C}
          iconBg={C.iconPurple}
          iconColor={C.purple}
          iconName="speedometer-outline"
          title={text.usage}
          onPress={() => navigation.navigate("PremiumUsageScreen")}
          right={<Chevron color={C.muted} />}
          last
        />
      </GlassBox>

      {/* ── Kişiselleştirme ── */}
      <SectionLabel color={C.muted}>{upper(text.sectionPersonal)}</SectionLabel>
      <GlassBox role="card" style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}>
        {switchRow({
          key: "enabled",
          icon: "library-outline",
          tone: [C.iconBlue, C.blue],
          title: text.useLists,
          hint: text.useListsHint,
        })}
        {prefs.enabled ? (
          <View style={[s.listChips, { borderBottomColor: C.borderMuted }]}>
            {LIST_KEYS.map((key) => (
              <ChoiceChip
                key={key}
                label={text.lists[key]}
                icon={prefs[key] ? "checkmark-circle" : "ellipse-outline"}
                selected={prefs[key]}
                onPress={toggle(key)}
                theme={theme}
              />
            ))}
          </View>
        ) : null}
        {switchRow({
          key: "timeContext",
          icon: "time-outline",
          tone: [C.iconAmber, C.amber],
          title: text.timeContext,
          hint: text.timeContextHint,
        })}
        {switchRow({
          key: "avoidRepeats",
          icon: "shuffle-outline",
          tone: [C.iconGreen, C.green],
          title: text.avoidRepeats,
          hint: text.avoidRepeatsHint,
        })}
        {switchRow({
          key: "showMatchScore",
          icon: "pie-chart-outline",
          tone: [C.iconPurple, C.purple],
          title: text.matchScore,
          hint: text.matchScoreHint,
        })}
        {switchRow({
          key: "showFollowUps",
          icon: "chatbubbles-outline",
          tone: [C.iconTeal, C.teal],
          title: text.followUps,
          hint: text.followUpsHint,
          last: true,
        })}
      </GlassBox>

      {/* ── Keşif filtreleri ── */}
      <SectionLabel color={C.muted}>{upper(text.sectionFilters)}</SectionLabel>
      <GlassBox role="card" style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Block C={C} title={text.mediaType}>
          <ChoiceWrap
            options={mediaOptions}
            selected={[prefs.mediaType]}
            onToggle={changeMediaType}
            theme={theme}
          />
        </Block>
        <Block C={C} title={text.platforms} hint={text.platformsHint}>
          <View style={s.wrap}>
            <ChoiceChip
              label={text.all}
              icon="globe-outline"
              selected={prefs.providerIds.length === 0}
              onPress={() => updatePrefs({ providerIds: [] })}
              theme={theme}
            />
            {STREAMING_PROVIDERS.map((provider) => (
              <ChoiceChip
                key={provider.id}
                label={provider.name}
                dotColor={provider.color}
                selected={prefs.providerIds.includes(provider.id)}
                onPress={() => toggleProvider(provider.id)}
                theme={theme}
              />
            ))}
          </View>
        </Block>
        <Block C={C} title={text.genres} hint={text.genresHint} last={filterCount === 0}>
          <ChoiceWrap options={genreOptions} selected={prefs.genreKeys} onToggle={toggleGenre} theme={theme} />
        </Block>
        {filterCount > 0 ? (
          <SettingRow
            colors={C}
            iconBg={C.dangerDim}
            iconColor={C.danger}
            iconName="close-circle-outline"
            title={text.clearFilters}
            onPress={() => updatePrefs({ mediaType: "all", providerIds: [], genreKeys: [] })}
            right={
              <View style={[s.badge, { backgroundColor: C.accentDim }]}>
                <Text allowFontScaling={false} style={[s.badgeText, { color: C.accentStrong }]}>
                  {filterCount}
                </Text>
              </View>
            }
            last
          />
        ) : null}
      </GlassBox>

      {/* ── Cevap stili ── */}
      <SectionLabel color={C.muted}>{upper(text.sectionStyle)}</SectionLabel>
      <GlassBox role="card" style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Block C={C} title={text.styleLength} hint={text.styleLengthHint}>
          <SegmentedChoice
            options={styleOptions}
            value={prefs.responseStyle}
            onChange={(value) => updatePrefs({ responseStyle: value })}
            theme={theme}
          />
        </Block>
        <Block C={C} title={copy.panel.spoilerTitle} hint={text.spoilerHint}>
          <SegmentedChoice
            options={spoilerOptions}
            value={prefs.spoilerLevel}
            onChange={(value) => updatePrefs({ spoilerLevel: value })}
            theme={theme}
          />
        </Block>
        <Block C={C} title={text.itemCount} hint={text.itemCountHint} last>
          <SegmentedChoice
            options={countOptions}
            value={prefs.maxItems}
            onChange={(value) => updatePrefs({ maxItems: value })}
            theme={theme}
          />
        </Block>
      </GlassBox>

      {/* ── Sohbet geçmişi ── */}
      <SectionLabel color={C.muted}>{upper(text.sectionHistory)}</SectionLabel>
      <GlassBox role="card" style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Block
          C={C}
          title={text.historyLimit}
          hint={
            savedChats == null
              ? text.historyLimitHint
              : `${fillCopy(text.historyCount, { n: savedChats })} · ${text.historyLimitHint}`
          }
        >
          <SegmentedChoice
            options={historyOptions}
            value={prefs.historyLimit}
            onChange={changeHistoryLimit}
            theme={theme}
          />
        </Block>
        <SettingRow
          colors={C}
          iconBg={C.dangerDim}
          iconColor={C.danger}
          iconName="trash-outline"
          title={text.clearHistory}
          onPress={confirmClearHistory}
          danger
          right={<Chevron color={C.muted} />}
          last
        />
      </GlassBox>

      {/* ── Sıfırla ── */}
      <SectionLabel color={C.muted}>{upper(text.sectionReset)}</SectionLabel>
      <GlassBox role="card" style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <SettingRow
          colors={C}
          iconBg={C.iconAmber}
          iconColor={C.amber}
          iconName="refresh-outline"
          title={text.resetAll}
          subtitle={text.resetAllHint}
          onPress={confirmReset}
          right={<Chevron color={C.muted} />}
          last
        />
      </GlassBox>

      <Text allowFontScaling={false} style={[s.note, { color: C.muted }]}>
        {text.footnote}
      </Text>
    </SettingsSubScreen>
  );
}

const s = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginTop: 4,
  },
  heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  heroCopy: { flex: 1 },
  heroTitle: { fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  heroText: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  usageCard: { marginTop: 10 },
  block: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
  blockBody: { marginTop: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  listChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  badge: { minWidth: 24, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 11, fontWeight: "800" },
  note: { fontSize: 11, lineHeight: 16, marginTop: 14, marginHorizontal: 6, textAlign: "center" },
});
