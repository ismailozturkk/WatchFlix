// components/settings/DevTasteShadowCard.js
//
// Geliştirici Laboratuvarı > "Zevk uyumu: eski / yeni" (Zevk eşleşmesi Faz 2 gölge modu).
// Son açılan arkadaş profillerinde eski kart yüzdesi (utils/tasteMatch.js) ile yeni v3 skorunu
// (utils/tasteMatchV3.js, varsayılan bağlam + lite K3) yan yana gösterir. YALNIZ __DEV__.
// Metinler bilerek Türkçe ve çevrilmez: yalnız geliştiricinin gördüğü ekran.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import GlassBox from "../common/GlassBox";
import GlassTouchable from "../common/GlassTouchable";
import { clearTasteShadow, useTasteShadowRows } from "../../services/tasteShadowLog";

const LANE_LABEL = { movie: "Film", tv: "Dizi", all: "Karma" };
const BINDING_LABEL = { none: "—", experience: "deneyim", evidence: "kanıt" };
const VERDICT_LABEL = { twin: "ikiz", near: "yakın", guide: "rehber", none: "" };

const fmt = (v, digits = 2) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "–");

function LaneLine({ lane, r, C }) {
  if (!r || r.score == null) {
    return (
      <Text allowFontScaling={false} style={[styles.mono, { color: C.muted }]}>
        {LANE_LABEL[lane]}: veri yok ({r?.nA ?? 0}/{r?.nB ?? 0})
      </Text>
    );
  }
  const flags = [
    VERDICT_LABEL[r.verdict],
    r.opinionGate ? "görüş kapısı" : "",
    r.immature ? "olgun değil" : "",
    r.implicitHeavy ? "örtük ağır" : "",
  ].filter(Boolean);
  return (
    <View style={styles.laneBlock}>
      <Text allowFontScaling={false} style={[styles.mono, { color: C.text }]}>
        {LANE_LABEL[lane]} {r.display}  (ham {fmt(r.score, 1)}) · {r.nA}/{r.nB} · ortak {r.common}
      </Text>
      <Text allowFontScaling={false} style={[styles.mono, { color: C.muted }]}>
        K1 {fmt(r.K1)} · K2 {fmt(r.K2)} · K3 {fmt(r.K3)} · E1 {fmt(r.E1, 1)} · tavan {BINDING_LABEL[r.binding] || r.binding}
        {flags.length ? ` · ${flags.join(", ")}` : ""}
      </Text>
    </View>
  );
}

export default function DevTasteShadowCard({ C }) {
  const rows = useTasteShadowRows();
  if (typeof __DEV__ === "undefined" || !__DEV__) return null;
  return (
    <GlassBox role="card" style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
      <Text allowFontScaling={false} style={[styles.hint, { color: C.muted }]}>
        Arkadaş profili açıldıkça dolar (bellekte, en çok 20). Eski = profildeki kart yüzdesi. Yeni = v3 çekirdeği;
        nüfus olmadığından varsayılan tablolar ve yalnız tür/süre içerik profili. Önemli olan SIRALAMA: en benzer
        bildiğin arkadaş yenide de üstte mi?
      </Text>
      {rows.length === 0 ? (
        <Text allowFontScaling={false} testID="tasteShadow.empty" style={[styles.hint, { color: C.muted }]}>
          Henüz kayıt yok — bir arkadaş profili aç.
        </Text>
      ) : (
        rows.map((row) => (
          <View key={row.uid} testID={`tasteShadow.row.${row.uid}`} style={[styles.row, { borderColor: C.border }]}>
            <Text allowFontScaling={false} style={[styles.name, { color: C.text }]} numberOfLines={1}>
              {row.name || row.uid.slice(0, 6)} — eski {row.oldScore ?? "–"} · yeni (karma) {row.lanes.all?.display ?? "–"}
            </Text>
            {["movie", "tv", "all"].map((lane) => (
              <LaneLine key={lane} lane={lane} r={row.lanes[lane]} C={C} />
            ))}
          </View>
        ))
      )}
      {rows.length > 0 ? (
        <GlassTouchable
          accessibilityRole="button"
          onPress={clearTasteShadow}
          style={[styles.chip, { borderColor: C.border, backgroundColor: C.cardAlt }]}
        >
          <Text allowFontScaling={false} style={[styles.chipText, { color: C.text }]}>
            Tabloyu temizle
          </Text>
        </GlassTouchable>
      ) : null}
    </GlassBox>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 18, gap: 10 },
  hint: { fontSize: 12, lineHeight: 16, flexShrink: 1 },
  row: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 4 },
  name: { fontSize: 13.5, fontWeight: "700" },
  laneBlock: { gap: 1 },
  mono: { fontSize: 11.5, lineHeight: 15, fontVariant: ["tabular-nums"] },
  chip: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 12.5, fontWeight: "700" },
});
