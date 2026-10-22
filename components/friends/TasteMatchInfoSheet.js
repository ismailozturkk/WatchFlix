// components/friends/TasteMatchInfoSheet.js
//
// Zevk uyumu kartındaki "!" düğmesinin açtığı bilgi sayfası: yüzde neye göre belirlenir, hangi
// bileşenin ağırlığı ne, kademeler, hangi veriler hesaba girer, ne zaman yüzde çıkmaz.
//
// Ağırlıklar, kademe eşikleri ve asgari kayıt sayıları utils/tasteMatch.js'teki SABİTLERDEN okunur
// (metne elle yazılmaz): hesap değişince bu sayfa kendiliğinden doğru kalır.
// Kabuk ortak BottomSheetModal (blur yerinde solar, sayfa kayar).
import React, { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheetModal from "../common/BottomSheetModal";
import GlassCloseButton from "../common/GlassCloseButton";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import {
  MIN_FAVORITES,
  MIN_RATED_PAIRS,
  MIN_WATCHED_FOR_OVERLAP,
  TIERS,
  WEIGHTS,
} from "../../utils/tasteMatch";

const CORE = [
  { id: "genres", icon: "pricetags-outline" },
  { id: "overlap", icon: "checkmark-done-outline" },
  { id: "ratings", icon: "star-half-outline" },
];

function Badge({ text, color }) {
  return (
    <View style={[styles.badge, { backgroundColor: alpha(color, 0.16) }]}>
      <Text allowFontScaling={false} style={[styles.badgeText, { color }]}>
        {text}
      </Text>
    </View>
  );
}

function PartRow({ icon, title, desc, badge, theme }) {
  return (
    <View style={[styles.part, { backgroundColor: theme.between, borderColor: theme.border }]}>
      <View style={[styles.partIcon, { backgroundColor: alpha(theme.accent, 0.14) }]}>
        <Ionicons name={icon} size={17} color={theme.accent} />
      </View>
      <View style={styles.partText}>
        <Text style={[styles.partTitle, { color: theme.text.primary }]}>{title}</Text>
        <Text style={[styles.partDesc, { color: theme.text.secondary }]}>{desc}</Text>
      </View>
      <Badge text={badge} color={theme.accent} />
    </View>
  );
}

function Section({ title, children, theme }) {
  return (
    <View style={styles.section}>
      <Text allowFontScaling={false} style={[styles.sectionTitle, { color: theme.text.muted }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onClose
 * @param {ReturnType<typeof import("../../utils/tasteMatchCopy").getTasteMatchCopy>} props.copy
 */
function TasteMatchInfoSheet({ visible, onClose, copy }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const info = copy.info;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={38}
      dimColor="rgba(0,0,0,0.42)"
      sheetStyle={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border, maxHeight: "88%" }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      <View style={styles.header}>
        <View style={[styles.headerTile, { backgroundColor: alpha(theme.accent, 0.14) }]}>
          <Ionicons name="information" size={21} color={theme.accent} />
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text.primary }]} numberOfLines={2}>
          {info.title}
        </Text>
        <GlassCloseButton size={34} fallbackRadius={11} backgroundColor={theme.between} onPress={onClose} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 12, 28) }}
      >
        <Text style={[styles.intro, { color: theme.text.secondary }]}>{info.intro}</Text>

        <Section title={info.partsTitle} theme={theme}>
          <View style={styles.parts}>
            {CORE.map((part) => (
              <PartRow
                key={part.id}
                icon={part.icon}
                title={copy.parts[part.id]}
                desc={info.partsDesc[part.id]}
                badge={copy.percent(Math.round(WEIGHTS[part.id] * 100))}
                theme={theme}
              />
            ))}
            <PartRow
              icon="heart-outline"
              title={copy.parts.favorites}
              desc={info.partsDesc.favorites}
              badge={info.bonus}
              theme={theme}
            />
          </View>
        </Section>

        <Section title={info.tiersTitle} theme={theme}>
          <View style={styles.tiers}>
            {TIERS.map((tier, index) => {
              const upper = index === 0 ? 100 : TIERS[index - 1].min - 1;
              return (
                <View key={tier.id} style={styles.tierRow}>
                  <Text allowFontScaling={false} style={[styles.tierRange, { color: theme.accent }]}>
                    {copy.percent(tier.min)}–{copy.percent(upper)}
                  </Text>
                  <Text style={[styles.tierText, { color: theme.text.primary }]}>{copy.tiers[tier.id]}</Text>
                </View>
              );
            })}
          </View>
        </Section>

        <Section title={info.scopeTitle} theme={theme}>
          <Text style={[styles.body, { color: theme.text.secondary }]}>{info.scopeBody}</Text>
        </Section>

        <Section title={info.minTitle} theme={theme}>
          <Text style={[styles.body, { color: theme.text.secondary }]}>
            {info.minBody(MIN_WATCHED_FOR_OVERLAP, MIN_RATED_PAIRS, MIN_FAVORITES)}
          </Text>
        </Section>
      </ScrollView>
    </BottomSheetModal>
  );
}

export default memo(TasteMatchInfoSheet);

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 11,
  },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 12 },
  headerTile: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: "800", letterSpacing: -0.25 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  intro: { fontSize: 13.5, lineHeight: 19, fontWeight: "500" },
  section: { marginTop: 18, gap: 8 },
  sectionTitle: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  parts: { gap: 8 },
  part: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 11,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  partIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  partText: { flex: 1, gap: 1 },
  partTitle: { fontSize: 14, fontWeight: "800" },
  partDesc: { fontSize: 12, lineHeight: 16 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: "800" },
  tiers: { gap: 7 },
  tierRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  tierRange: { width: 86, fontSize: 13, fontWeight: "800" },
  tierText: { flex: 1, fontSize: 13.5, fontWeight: "600" },
  body: { fontSize: 13, lineHeight: 19 },
});
