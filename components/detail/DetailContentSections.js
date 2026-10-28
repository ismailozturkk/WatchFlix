import React from "react";
import {
  Animated,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassTouchable from "../common/GlassTouchable";
import { alpha } from "@theme/colors";

const FALLBACK_COLORS = {
  blue: "#5A9CF8",
  purple: "#A77BFF",
  green: "#3CCB9A",
};

function ActionButton({ action, theme, featured = false }) {
  const tone = action.color || theme.accent;
  return (
    <GlassTouchable
      activeOpacity={0.88}
      onPress={action.onPress}
      accessibilityRole="button"
      accessibilityLabel={`${action.title}. ${action.subtitle}`}
      style={[
        featured ? styles.featuredAction : styles.quickAction,
        {
          backgroundColor: featured ? alpha(tone, 0.12) : "transparent",
          borderColor: featured ? alpha(tone, 0.38) : alpha(theme.border, 0.9),
        },
      ]}
    >
      <View style={[featured ? styles.featuredIcon : styles.quickIcon, { backgroundColor: alpha(tone, 0.16) }]}>
        <Ionicons name={action.icon} size={featured ? 21 : 19} color={tone} />
      </View>
      <View style={featured ? styles.featuredCopy : styles.quickCopy}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[featured ? styles.featuredTitle : styles.quickTitle, { color: theme.text.primary }]}
        >
          {action.title}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[featured ? styles.featuredSubtitle : styles.quickSubtitle, { color: theme.text.muted }]}
        >
          {action.subtitle}
        </Text>
      </View>
      {featured ? <Ionicons name="arrow-forward" size={17} color={tone} /> : null}
    </GlassTouchable>
  );
}

export function DetailActionCluster({ theme, review, ai, send }) {
  const actions = [
    { ...review, color: theme.colors?.blue || FALLBACK_COLORS.blue },
    { ...ai, color: theme.colors?.purple || FALLBACK_COLORS.purple },
    { ...send, color: theme.colors?.green || FALLBACK_COLORS.green },
  ];

  return (
    <View style={styles.actionCluster}>
      <ActionButton action={actions[0]} theme={theme} featured />
      <View style={styles.quickActions}>
        <ActionButton action={actions[1]} theme={theme} />
        <ActionButton action={actions[2]} theme={theme} />
      </View>
    </View>
  );
}

export function DetailFactsStrip({ theme, facts }) {
  return (
    <View
      style={[
        styles.factsStrip,
        { borderTopColor: theme.border, borderBottomColor: theme.border },
      ]}
    >
      {facts.map((fact, index) => {
        const tone = fact.color || theme.accent;
        return (
          <React.Fragment key={fact.key || fact.label}>
            {index > 0 ? <View style={[styles.factDivider, { backgroundColor: theme.border }]} /> : null}
            <View style={styles.factItem}>
              <Ionicons name={fact.icon} size={15} color={tone} />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.factValue, { color: theme.text.primary }]}
              >
                {fact.value}
                {fact.trailing ? (
                  <Text style={[styles.factTrailing, { color: theme.text.muted }]}>{fact.trailing}</Text>
                ) : null}
              </Text>
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.factLabel, { color: theme.text.muted }]}>
                {fact.label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

function JournalRow({ item, theme }) {
  const tone = item.color || theme.accent;
  return (
    <GlassTouchable
      activeOpacity={0.86}
      onPress={item.onPress}
      accessibilityRole="button"
      accessibilityLabel={item.subtitle ? `${item.title}. ${item.subtitle}` : item.title}
      style={styles.journalRow}
    >
      <View style={[styles.journalIcon, { backgroundColor: alpha(tone, 0.14) }]}>
        <Ionicons name={item.icon} size={19} color={tone} />
      </View>
      <View style={styles.journalCopy}>
        <Text allowFontScaling={false} style={[styles.journalTitle, { color: theme.text.primary }]}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.journalSubtitle, { color: theme.text.muted }]}>
            {item.subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={17} color={theme.text.muted} />
    </GlassTouchable>
  );
}

export function DetailJournalPanel({ theme, comment, note, renderCommentRow }) {
  const commentRow = <JournalRow item={comment} theme={theme} />;
  return (
    <View
      style={[
        styles.journalPanel,
        { backgroundColor: alpha(theme.secondary, 0.72), borderColor: theme.border },
      ]}
    >
      {renderCommentRow ? renderCommentRow(commentRow) : commentRow}
      <View style={[styles.journalDivider, { backgroundColor: theme.border }]} />
      <JournalRow item={note} theme={theme} />
    </View>
  );
}

export function DetailOverviewSection({ theme, title, body, expanded, progress, onToggle, moreLabel }) {
  return (
    <View style={styles.editorialSection}>
      <GlassTouchable
        activeOpacity={0.86}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.editorialHeader}
      >
        <View style={[styles.editorialEyebrow, { backgroundColor: alpha(theme.accent, 0.14) }]}>
          <Ionicons name="reader-outline" size={16} color={theme.accent} />
        </View>
        <Text allowFontScaling={false} style={[styles.editorialTitle, { color: theme.text.primary }]}>
          {title}
        </Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={17} color={theme.text.muted} />
      </GlassTouchable>
      <Animated.View
        style={{
          maxHeight: progress.interpolate({ inputRange: [0, 1], outputRange: [48, 420] }),
          overflow: "hidden",
        }}
      >
        <Text
          allowFontScaling={false}
          numberOfLines={expanded ? null : 2}
          style={[styles.editorialBody, { color: theme.text.secondary }]}
        >
          {body}
        </Text>
      </Animated.View>
      {!expanded ? (
        <Text allowFontScaling={false} style={[styles.editorialMore, { color: theme.accent }]}>
          {moreLabel}
        </Text>
      ) : null}
    </View>
  );
}

function ProviderBubble({ item, theme, link, network = false, getTmdbUrl }) {
  const content = (
    <>
      <View style={[styles.providerLogoShell, { backgroundColor: network ? "#FFFFFF" : alpha(theme.secondary, 0.9), borderColor: theme.border }]}>
        {item.logo_path ? (
          <Image
            source={{ uri: getTmdbUrl(item.logo_path, "poster", 200) }}
            style={network ? styles.networkLogo : styles.providerLogo}
            resizeMode={network ? "contain" : "cover"}
          />
        ) : (
          <Ionicons name="tv-outline" size={21} color={theme.text.muted} />
        )}
      </View>
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.providerName, { color: theme.text.secondary }]}>
        {item.provider_name || item.name}
      </Text>
    </>
  );

  if (!network && link) {
    return (
      <GlassTouchable
        activeOpacity={0.82}
        accessibilityRole="link"
        accessibilityLabel={item.provider_name}
        onPress={() => Linking.openURL(link).catch(() => {})}
        style={styles.providerItem}
      >
        {content}
      </GlassTouchable>
    );
  }

  return <View style={styles.providerItem}>{content}</View>;
}

export function DetailProviderRail({ theme, title, providers = [], networks = [], link, getTmdbUrl }) {
  if (!providers.length && !networks.length) return null;
  return (
    <View style={styles.providerSection}>
      <View style={styles.providerHeading}>
        <Ionicons name="play-circle-outline" size={18} color={theme.accent} />
        <Text allowFontScaling={false} style={[styles.providerTitle, { color: theme.text.primary }]}>
          {title}
        </Text>
        <View style={[styles.providerRule, { backgroundColor: theme.border }]} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.providerRail}>
        {providers.map((item) => (
          <ProviderBubble key={`p-${item.provider_id}`} item={item} theme={theme} link={link} getTmdbUrl={getTmdbUrl} />
        ))}
        {networks.map((item) => (
          <ProviderBubble key={`n-${item.id}`} item={item} theme={theme} network getTmdbUrl={getTmdbUrl} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  actionCluster: { marginBottom: 18, gap: 9 },
  featuredAction: {
    minHeight: 64,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  featuredIcon: { width: 39, height: 39, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  featuredCopy: { flex: 1, minWidth: 0 },
  featuredTitle: { fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
  featuredSubtitle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  quickActions: { flexDirection: "row", gap: 9 },
  quickAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    borderBottomWidth: 1,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  quickCopy: { flex: 1, minWidth: 0 },
  quickTitle: { fontSize: 12.5, fontWeight: "800" },
  quickSubtitle: { fontSize: 9.5, fontWeight: "600", marginTop: 1 },
  factsStrip: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    marginBottom: 18,
  },
  factItem: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 4 },
  factDivider: { width: StyleSheet.hairlineWidth, marginVertical: 5, opacity: 0.75 },
  factValue: { fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
  factTrailing: { fontSize: 10, fontWeight: "600" },
  factLabel: { fontSize: 10, fontWeight: "600" },
  journalPanel: { borderRadius: 20, borderWidth: 1, overflow: "hidden", marginBottom: 24 },
  journalRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, paddingVertical: 10 },
  journalIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  journalCopy: { flex: 1, minWidth: 0 },
  journalTitle: { fontSize: 14, fontWeight: "800" },
  journalSubtitle: { fontSize: 11, fontWeight: "500", marginTop: 2 },
  journalDivider: { height: StyleSheet.hairlineWidth, marginLeft: 60, opacity: 0.9 },
  editorialSection: { marginBottom: 26 },
  editorialHeader: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 },
  editorialEyebrow: { width: 31, height: 31, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  editorialTitle: { flex: 1, fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  editorialBody: { fontSize: 14, lineHeight: 22 },
  editorialMore: { fontSize: 11, fontWeight: "700", marginTop: 6 },
  providerSection: { marginBottom: 28 },
  providerHeading: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 13 },
  providerTitle: { fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  providerRule: { flex: 1, height: StyleSheet.hairlineWidth, opacity: 0.9 },
  providerRail: { gap: 13, paddingRight: 8 },
  providerItem: { width: 64, alignItems: "center", gap: 6 },
  providerLogoShell: { width: 54, height: 54, borderRadius: 27, borderWidth: 1, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  providerLogo: { width: 54, height: 54 },
  networkLogo: { width: 42, height: 28 },
  providerName: { width: 64, fontSize: 9.5, fontWeight: "600", textAlign: "center" },
});
