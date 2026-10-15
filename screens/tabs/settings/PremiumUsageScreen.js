// screens/tabs/settings/PremiumUsageScreen.js
//
// Ayarlar > Kullanım ve haklar. Planın her özellikteki limitini ve ne kadarını
// kullandığını tek yerde gösterir: kalan hak, dolu çubuk, kilitli özellikler ve
// yenilenme zamanı.
//
// Bu ekran hiçbir limit ya da vaat ÜRETMEZ. Limitler utils/premiumFeatures.js
// kaydından, harcananlar kapıların saydığı kaynaklardan (hooks/usePremiumUsage)
// gelir; satırları utils/premiumUsageModel.js kurar. Kayıtta yeni bir özellik
// açılınca bu ekranda kendiliğinden bir satır olur.

import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import PremiumPill from "@components/premium/PremiumPill";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import usePremiumUsage from "@hooks/usePremiumUsage";
import { showPremiumLimitAlert } from "@services/premiumUpsell";
import { i18nText } from "@utils/i18nText";
import { PREMIUM_PLAN } from "@utils/premium";
import { buildUsageModel, nextUtcMidnight } from "@utils/premiumUsageModel";
import { alpha } from "@theme/colors";
import { SectionLabel, SettingsSubScreen, buildUiColors } from "./settingsUi";

const CLOCK_TICK_MS = 30000;

function Meter({ ratio, color, track }) {
  return (
    <View style={[st.track, { backgroundColor: track }]}>
      <View style={[st.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

function stateColor(state, C) {
  if (state === "full") return C.danger;
  if (state === "low") return C.amber;
  if (state === "unlimited" || state === "included") return C.green;
  if (state === "locked" || state === "unknown") return C.muted;
  return C.accent;
}

/** Sağ üst köşedeki kısa değer: "3 / 5", "Sınırsız", "Açık", Premium rozeti. */
function ValueChip({ row, C, tr }) {
  if (row.state === "locked") return <PremiumPill />;
  const color = stateColor(row.state, C);
  let text;
  if (row.state === "included") text = tr ? "Açık" : "On";
  else if (row.state === "unlimited") text = tr ? "Sınırsız" : "Unlimited";
  else if (row.kind === "ai_quota") {
    text =
      row.remaining === null
        ? "—"
        : tr
          ? `${row.remaining} kaldı`
          : `${row.remaining} left`;
  } else {
    text = `${row.used === null ? "–" : row.used} / ${row.limit}`;
  }
  return (
    <View style={[st.chip, { backgroundColor: alpha(color, 0.14), borderColor: alpha(color, 0.34) }]}>
      <Text allowFontScaling={false} style={[st.chipText, { color }]}>
        {text}
      </Text>
    </View>
  );
}

/** Başlığın altındaki tek satırlık durum cümlesi. */
function statusLine(row, tr) {
  switch (row.state) {
    case "locked":
      return row.kind === "access"
        ? tr ? "Bu planda kapalı" : "Not included in this plan"
        : tr ? "Bu planda dahil değil" : "Not included in this plan";
    case "included":
      return row.valueLabel;
    case "unlimited":
      return row.used !== null
        ? tr ? `${row.used} kullanılıyor` : `${row.used} in use`
        : tr ? "Sınırsız kullanım" : "Unlimited use";
    case "unknown":
      return tr ? "Yükleniyor…" : "Loading…";
    case "full":
      return row.kind === "ai_quota"
        ? tr ? "Şu an mesaj gönderemezsin" : "You can't send messages right now"
        : tr ? "Hak doldu" : "Limit reached";
    default:
      break;
  }
  if (row.kind === "ai_quota") {
    return tr
      ? `Şu an ${row.remaining} mesaj gönderebilirsin`
      : `You can send ${row.remaining} more messages right now`;
  }
  return tr ? `Kalan: ${row.remaining}` : `${row.remaining} left`;
}

function UsageRow({ row, C, tr, last, onPress }) {
  const color = stateColor(row.state, C);
  const locked = row.state === "locked";
  const Body = onPress ? Pressable : View;
  return (
    <Body
      {...(onPress ? { onPress, accessibilityRole: "button" } : null)}
      style={[st.row, { borderBottomColor: C.borderMuted }, last && st.rowLast]}
    >
      <View style={[st.iconTile, { backgroundColor: alpha(row.color, 0.14) }]}>
        <AppIcon family="Ionicons" name={row.icon} size={16} color={locked ? C.muted : row.color} />
      </View>

      <View style={st.rowBody}>
        <View style={st.rowTop}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[st.rowTitle, { color: locked ? C.muted : C.text }]}
          >
            {row.title}
          </Text>
          <ValueChip row={row} C={C} tr={tr} />
        </View>

        <Text allowFontScaling={false} style={[st.rowStatus, { color: row.state === "full" ? C.danger : C.muted }]}>
          {statusLine(row, tr)}
          {row.overflow > 0
            ? tr
              ? ` · ${row.overflow} yapım takip dışı`
              : ` · ${row.overflow} not tracked`
            : ""}
        </Text>

        {row.meters.length > 0 && row.state !== "unlimited" ? (
          <View style={st.meters}>
            {row.meters.map((meter, index) => (
              <View key={index} style={st.meterRow}>
                {meter.label ? (
                  <Text allowFontScaling={false} style={[st.meterLabel, { color: C.muted }]}>
                    {meter.label}
                  </Text>
                ) : null}
                <Meter ratio={meter.ratio} color={color} track={alpha(C.muted, 0.18)} />
                {row.meters.length > 1 ? (
                  <Text allowFontScaling={false} style={[st.meterValue, { color: C.muted }]}>
                    {meter.used === null ? "–" : meter.used}/{meter.limit}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {row.reset ? (
          <View style={st.resetRow}>
            <AppIcon family="Ionicons" name="time-outline" size={11} color={C.muted} />
            <Text allowFontScaling={false} style={[st.resetText, { color: C.muted }]}>
              {row.reset.label}
            </Text>
          </View>
        ) : null}

        {row.note ? (
          <Text allowFontScaling={false} style={[st.note, { color: C.muted }]}>
            {row.note}
          </Text>
        ) : null}
      </View>

      {onPress ? <AppIcon family="Ionicons" name="chevron-forward" size={14} color={C.muted} /> : null}
    </Body>
  );
}

export default function PremiumUsageScreen({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const C = buildUiColors(theme);
  const tr = language === "tr";
  const { plan, usage } = usePremiumUsage();

  // Geri sayımlar (yenilenmesine X sa Y dk) ekran açıkken kendini yeniler.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const model = useMemo(
    () => buildUsageModel({ plan, usage, now, language }),
    [plan, usage, now, language],
  );

  const { counts } = model.summary;
  const summaryLine = [
    counts.locked > 0
      ? tr ? `${counts.locked} özellik bu planda kapalı` : `${counts.locked} features not in this plan`
      : null,
    counts.full > 0
      ? tr ? `${counts.full} hak doldu` : `${counts.full} limits reached`
      : null,
    counts.low > 0
      ? tr ? `${counts.low} hak azalıyor` : `${counts.low} running low`
      : null,
  ].filter(Boolean);

  const openPlans = () => navigation.navigate("PremiumScreen", { source: "usage" });
  // Yükseltilebilen ve sınırı hissedilen satırlar yükseltme sayfasını açar.
  const pressFor = (row) =>
    row.nextPlan && (row.state === "locked" || row.state === "full" || row.state === "low")
      ? () => showPremiumLimitAlert(row.id, plan, { used: row.used ?? undefined })
      : undefined;

  const utcResetLocal = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(tr ? "tr-TR" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(nextUtcMidnight(now));
    } catch {
      return "00:00 UTC";
    }
  }, [now, tr]);

  return (
    <SettingsSubScreen title={i18nText("autoI18n.kullanim_haklar_baslik", "Kullanım ve haklar")}>
      {/* Üst özet: plan + tek cümlelik durum + planlara geçiş */}
      <View style={[st.summary, { backgroundColor: C.card, borderColor: C.border, marginTop: 8 }]}>
        <View style={st.summaryTop}>
          <View style={[st.summaryIcon, { backgroundColor: C.accentDim }]}>
            <AppIcon
              family="Ionicons"
              name={plan === PREMIUM_PLAN.UNLIMITED ? "infinite" : "diamond"}
              size={20}
              color={C.accent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text allowFontScaling={false} style={[st.summaryEyebrow, { color: C.muted }]}>
              {tr ? "AKTİF PLAN" : "CURRENT PLAN"}
            </Text>
            <Text allowFontScaling={false} style={[st.summaryPlan, { color: C.text }]}>
              {model.planName}
            </Text>
          </View>
        </View>
        <Text allowFontScaling={false} style={[st.summaryLine, { color: C.muted }]}>
          {summaryLine.length > 0
            ? summaryLine.join(" · ")
            : tr
              ? "Tüm haklarının durumu aşağıda."
              : "Here's where all your limits stand."}
        </Text>
        {model.canUpgrade ? (
          <Pressable
            onPress={openPlans}
            accessibilityRole="button"
            style={[st.summaryCta, { backgroundColor: C.accent }]}
          >
            <Text allowFontScaling={false} style={st.summaryCtaText}>
              {tr ? "Planları ve fiyatları gör" : "View plans & pricing"}
            </Text>
            <AppIcon family="Ionicons" name="arrow-forward" size={14} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>

      {model.sections.map((section) => (
        <View key={section.id}>
          <SectionLabel color={C.muted}>{section.title.toUpperCase()}</SectionLabel>
          <View style={[st.card, { backgroundColor: C.card, borderColor: C.border }]}>
            {section.rows.map((row, index) => (
              <UsageRow
                key={row.id}
                row={row}
                C={C}
                tr={tr}
                last={index === section.rows.length - 1}
                onPress={pressFor(row)}
              />
            ))}
          </View>
        </View>
      ))}

      <Text allowFontScaling={false} style={[st.footnote, { color: C.muted }]}>
        {tr
          ? `Oyun ve CineSwipe hakları gece yarısı (yerel saat) yenilenir. AI mesajları UTC 00:00'da, yani senin saatinle ${utcResetLocal}'da yenilenir; aylık hak her ayın başında sıfırlanır.\n\nLimit dolsa bile mevcut verilerin silinmez; yalnızca yeni ekleme durur.`
          : `Game and CineSwipe limits reset at midnight (local time). AI messages reset at 00:00 UTC, which is ${utcResetLocal} for you; the monthly limit resets at the start of each month.\n\nHitting a limit never deletes what you already have; it only stops new additions.`}
      </Text>
    </SettingsSubScreen>
  );
}

const st = StyleSheet.create({
  summary: { borderRadius: 18, borderWidth: 1, padding: 16 },
  summaryTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryEyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  summaryPlan: { fontSize: 20, fontWeight: "900", letterSpacing: -0.3, marginTop: 1 },
  summaryLine: { fontSize: 12, fontWeight: "600", lineHeight: 17, marginTop: 12 },
  summaryCta: {
    marginTop: 14,
    height: 44,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  summaryCtaText: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "800" },

  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  rowLast: { borderBottomWidth: 0 },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: "600" },
  rowStatus: { fontSize: 11.5, fontWeight: "600", marginTop: 3 },

  chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },

  meters: { marginTop: 9, gap: 6 },
  meterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  meterLabel: { width: 54, fontSize: 10.5, fontWeight: "700" },
  meterValue: { width: 44, fontSize: 10.5, fontWeight: "700", textAlign: "right", fontVariant: ["tabular-nums"] },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },

  resetRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  resetText: { fontSize: 10.5, fontWeight: "600" },
  note: { fontSize: 10.5, lineHeight: 14, marginTop: 6, fontStyle: "italic" },

  footnote: { fontSize: 11, lineHeight: 16, marginTop: 20, marginHorizontal: 6 },
});
