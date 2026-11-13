// components/settings/DevMatchLab.js
//
// Geliştirici Laboratuvarı — Zevk Çemberleri öneri ekranının bütün durumları SAHTE veriyle (utils/matchDevSamples.js).
// Ağa/sunucuya hiçbir şey gitmez: selam / menü / çember düğmeleri yalnız yerel görünümü değiştirir.

import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import GlassTouchable from "../common/GlassTouchable";
import MatchSuggestionsView from "../match/MatchSuggestionsView";
import { toast } from "../AppToast";
import useMatchTitles from "../../hooks/useMatchTitles";
import { intlLocaleOf } from "../../utils/appLanguages";
import { getMatchCopy } from "../../utils/matchCopy";
import { MATCH_DEV_STATES } from "../../utils/matchDevSamples";
import { getMatchScreenCopy } from "../../utils/matchScreenCopy";
import {
  applyCircleResult,
  applyHelloResult,
  normalizeSuggestions,
  removeCandidate,
  titleKeysOf,
} from "../../utils/matchSuggestions";

export default function DevMatchLab({ C, language }) {
  const [stateId, setStateId] = useState("twin");
  const [lane, setLane] = useState("movie");
  const [overrides, setOverrides] = useState({});
  const copy = getMatchScreenCopy(language);
  const base = getMatchCopy(language);
  const sample = MATCH_DEV_STATES.find((s) => s.id === stateId);
  const view = overrides[stateId] || normalizeSuggestions(sample.doc);
  const lanes = sample.doc?.lanes?.tv ? ["movie", "tv"] : ["movie"];
  const current = lanes.includes(lane) ? lane : "movie";
  const titles = useMatchTitles(useMemo(() => titleKeysOf(view, current), [view, current]));
  const update = (fn) => setOverrides((o) => ({ ...o, [stateId]: fn(view) }));

  return (
    <View style={s.root}>
      <View style={s.chips}>
        {MATCH_DEV_STATES.map((st) => {
          const on = st.id === stateId;
          return (
            <GlassTouchable
              key={st.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                setStateId(st.id);
                setOverrides({});
              }}
              style={[s.chip, { borderColor: on ? C.accent : C.border, backgroundColor: on ? C.accentDim : C.cardAlt }]}
            >
              <Text allowFontScaling={false} style={[s.chipText, { color: on ? C.accent : C.text }]}>
                {st.label}
              </Text>
            </GlassTouchable>
          );
        })}
      </View>
      <MatchSuggestionsView
        view={view}
        lane={current}
        lanes={lanes}
        onLane={setLane}
        titles={titles}
        copy={copy}
        laneNames={base.lanes}
        C={C}
        language={language}
        locale={intlLocaleOf(language)}
        stepNote={base.step.rate(12)}
        onHello={(item) =>
          update((v) => applyHelloResult(v, item.cid, { status: item.greeted ? "mutual" : "sent" }))
        }
        onMore={(item) => {
          update((v) => removeCandidate(v, item.cid));
          toast.info(copy.done.hide);
        }}
        onOpenChat={() => toast.info(copy.openChat)}
        onJoinCircle={() =>
          update((v) => {
            const c = v.lanes[current].circle;
            const joined = c.joinedCount + 1;
            return applyCircleResult(v, current, { joined, groupId: joined >= 3 ? "dev_group" : null });
          })
        }
        onOpenGroup={() => toast.info(copy.circle.openGroup)}
        onSettings={() => toast.info(copy.goSettings)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: "700" },
});
