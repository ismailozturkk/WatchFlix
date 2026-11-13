// screens/match/MatchScreen.js
//
// Zevk Çemberleri Faz 6 — "Önerilerim": sunucunun gece hazırladığı öneri belgesi (MatchSuggestions/{uid}).
// Ekran açılınca BİR okuma (dinleyici yok — rehber §11 maliyet kuralı); aşağı çekince yeniden okur.
// Selam / gizle / engelle / şikâyet / çember callable ile (services/matchSuggestions.js); adayın uid'si
// istemciye yalnız karşılıklı selamdan sonra (arkadaş olunca) gelir.
// Görünüm modeli: utils/matchSuggestions.js · gövde: components/match/MatchSuggestionsView.js.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { appAlert } from "@components/AppAlert";
import { toast } from "@components/AppToast";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { useUserProfile } from "../../context/UserProfileContext";
import LensLoader from "../../components/LensLoader";
import MatchSuggestionsView from "../../components/match/MatchSuggestionsView";
import ReportReasonSheet from "../../components/moderation/ReportReasonSheet";
import useMatchFeature from "../../hooks/useMatchFeature";
import useMatchStrength from "../../hooks/useMatchStrength";
import useMatchTitles from "../../hooks/useMatchTitles";
import {
  fetchMatchSuggestions,
  joinMatchCircle,
  matchCandidateAction,
  sendMatchHello,
} from "../../services/matchSuggestions";
import { intlLocaleOf } from "../../utils/appLanguages";
import { getMatchCopy, stepText } from "../../utils/matchCopy";
import { getMatchScreenCopy } from "../../utils/matchScreenCopy";
import {
  applyCircleResult,
  applyHelloResult,
  errorKindOf,
  normalizeSuggestions,
  removeCandidate,
  titleKeysOf,
} from "../../utils/matchSuggestions";
import { SettingsSubScreen, buildUiColors } from "../tabs/settings/settingsUi";

export default function MatchScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const C = useMemo(() => buildUiColors(theme), [theme]);
  const { language } = useLanguage();
  const locale = intlLocaleOf(language);
  const copy = getMatchScreenCopy(language);
  const base = getMatchCopy(language);
  const { uid } = useUserProfile() || {};
  const match = useMatchFeature();
  const strength = useMatchStrength({ enabled: match.available && match.optedIn });

  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lane, setLane] = useState(null);
  const [busyCid, setBusyCid] = useState(null);
  const [circleBusy, setCircleBusy] = useState(false);
  const [reportCid, setReportCid] = useState(null);

  const lanes = match.lanes;
  const current = lane && lanes.includes(lane) ? lane : lanes[0] || "movie";

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const doc = await fetchMatchSuggestions(uid);
      setView(normalizeSuggestions(doc));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [uid]);

  useEffect(() => {
    if (!match.available || !match.optedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [match.available, match.optedIn, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const titles = useMatchTitles(useMemo(() => (view ? titleKeysOf(view, current) : []), [view, current]));

  const showError = (error) => toast.error(copy.errors[errorKindOf(error)]);

  const openChat = useCallback(
    (friendUid, friendName) => navigation.navigate("ChatScreen", { friendUid, friendName: friendName || "" }),
    [navigation],
  );

  const onHello = useCallback(
    async (item) => {
      if (busyCid) return;
      setBusyCid(item.cid);
      try {
        const result = await sendMatchHello(item.cid);
        setView((v) => applyHelloResult(v, item.cid, result));
        if (result?.status === "mutual") {
          toast.success(copy.mutualToast(result.friendName || item.displayName));
          // Karşılıklı selam = arkadaşlık → artık uid bilinir; sohbet bir dokunuşta.
          if (result.friendUid) setView((v) => ({ ...v, friends: { ...(v?.friends || {}), [item.cid]: result.friendUid } }));
        } else if (result?.status === "sent") {
          toast.success(copy.helloSentToast);
        }
      } catch (error) {
        showError(error);
        if (errorKindOf(error) === "gone") setView((v) => removeCandidate(v, item.cid));
      } finally {
        setBusyCid(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busyCid, copy],
  );

  const runAction = useCallback(
    async (cid, action, reason) => {
      try {
        await matchCandidateAction(cid, action, reason);
        setView((v) => removeCandidate(v, cid));
        toast.success(copy.done[action]);
      } catch (error) {
        showError(error);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [copy],
  );

  const onMore = useCallback(
    (item) =>
      appAlert(item.displayName || copy.menuTitle, null, [
        { text: copy.hide, onPress: () => runAction(item.cid, "hide") },
        {
          text: copy.block,
          style: "destructive",
          onPress: () =>
            setTimeout(
              () =>
                appAlert(copy.blockTitle, copy.blockBody, [
                  { text: copy.cancel, style: "cancel" },
                  { text: copy.block, style: "destructive", onPress: () => runAction(item.cid, "block") },
                ]),
              250,
            ),
        },
        { text: copy.report, style: "destructive", onPress: () => setTimeout(() => setReportCid(item.cid), 250) },
        { text: copy.cancel, style: "cancel" },
      ]),
    [copy, runAction],
  );

  const onOpenChat = useCallback(
    (item) => {
      const friendUid = item.friendUid || view?.friends?.[item.cid];
      if (friendUid) openChat(friendUid, item.displayName);
      // uid yoksa (eski belge: karşılıklı ama bu oturumda değil) arkadaş listesinden açılır.
      else navigation.navigate("FriendsListScreen");
    },
    [view, openChat, navigation],
  );

  const onJoinCircle = useCallback(async () => {
    if (circleBusy) return;
    setCircleBusy(true);
    try {
      const result = await joinMatchCircle(current, copy.circle.groupName);
      setView((v) => applyCircleResult(v, current, result));
      if (result?.groupId) {
        navigation.navigate("ChatScreen", { groupId: result.groupId, groupName: copy.circle.groupName });
      } else {
        toast.success(copy.circle.waiting);
      }
    } catch (error) {
      if (String(error?.message || "").includes("blocked")) toast.error(copy.circle.blocked);
      else showError(error);
    } finally {
      setCircleBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleBusy, current, copy, navigation]);

  const onOpenGroup = useCallback(
    (circle) => navigation.navigate("ChatScreen", { groupId: circle.groupId, groupName: copy.circle.groupName }),
    [navigation, copy],
  );

  const goSettings = useCallback(() => navigation.navigate("MatchSettingsScreen"), [navigation]);

  if (!match.available) return <SettingsSubScreen title={copy.title} />;

  if (!match.optedIn) {
    return (
      <SettingsSubScreen title={copy.title}>
        <View style={st.center}>
          <Text style={[st.text, { color: C.text }]}>{copy.notJoined}</Text>
          <Text onPress={goSettings} accessibilityRole="link" style={[st.link, { color: C.accentStrong }]}>
            {copy.goSettings}
          </Text>
        </View>
      </SettingsSubScreen>
    );
  }

  return (
    <SettingsSubScreen title={copy.title} scrollable={false}>
      <ScrollView
        contentContainerStyle={st.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      >
        {loading ? (
          <View style={st.center}>
            <LensLoader size="small" color={C.accent} />
          </View>
        ) : failed && !view ? (
          <View style={st.center}>
            <Text style={[st.text, { color: C.text }]}>{copy.errors.error}</Text>
            <Text onPress={onRefresh} accessibilityRole="button" style={[st.link, { color: C.accentStrong }]}>
              ↻
            </Text>
          </View>
        ) : (
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
            locale={locale}
            stepNote={strength?.[current] ? stepText(base, strength[current].next) : ""}
            busyCid={busyCid}
            circleBusy={circleBusy}
            onHello={onHello}
            onMore={onMore}
            onOpenChat={onOpenChat}
            onJoinCircle={onJoinCircle}
            onOpenGroup={onOpenGroup}
            onSettings={goSettings}
          />
        )}
      </ScrollView>
      <ReportReasonSheet
        visible={!!reportCid}
        onClose={() => setReportCid(null)}
        onSelect={(reason) => {
          const cid = reportCid;
          setReportCid(null);
          if (cid) runAction(cid, "report", reason);
        }}
        subtitle={copy.reportSubtitle}
      />
    </SettingsSubScreen>
  );
}

const st = StyleSheet.create({
  scroll: { paddingBottom: 48 },
  center: { alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 40 },
  text: { fontSize: 14.5, fontWeight: "700", textAlign: "center", lineHeight: 20 },
  link: { fontSize: 14.5, fontWeight: "800" },
});
