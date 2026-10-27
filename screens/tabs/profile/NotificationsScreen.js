import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from "react-native";
// Ekran kökü: Premium şeridi yüzerken üst boşluğu ona göre büyür.
import SafeAreaView from "@components/common/ScreenSafeAreaView";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useNotifications } from "../../../context/NotificationsContext";
import { useUserProfile } from "../../../context/UserProfileContext";
import ScreenDecor from "../../../components/ScreenDecor";
import FriendsScreenHeader from "../../../components/friends/FriendsScreenHeader";
import GlassPressable from "../../../components/common/GlassPressable";
import GlassIconButton from "../../../components/common/GlassIconButton";
import AppIcon from "../../../components/AppIcon";
import { toast } from "../../../components/AppToast";
import { alpha } from "../../../theme/colors";
import { fetchOlderNotifications } from "../../../services/notificationsService";
import { notificationInboxCopy } from "../../../utils/notificationInboxCopy";
import useNoteReminderInbox from "../../../hooks/useNoteReminderInbox";
import {
  mergeNotifications, notificationContent, notificationDateLabel,
  notificationDestination, notificationSections,
} from "../../../utils/notificationInbox";

// Key the paginated history and pending actions to the signed-in account.
export default function NotificationsScreen({ navigation }) {
  const { user } = useAuth();
  return <Inbox key={user?.uid || "signed-out"} uid={user?.uid} navigation={navigation} />;
}

function Inbox({ uid, navigation }) {
  const { theme } = useTheme();
  const { language, t } = useLanguage();
  const { items, loading, error, cursor, hasMore, retry, markRead, markAll } = useNotifications();
  const { profile } = useUserProfile();
  // Vadesi gelen not hatırlatmaları: sunucu kaydı değil, nottan türetilir; okundu durumu cihazda.
  const reminders = useNoteReminderInbox();
  const copy = notificationInboxCopy(language);
  const accent = theme.accent || "#8B7CF8";
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState(false);
  // copy anahtarı: "readError" | "markAllError"
  const [actionError, setActionError] = useState(null);
  const [readIds, setReadIds] = useState(() => new Set());
  const [openingId, setOpeningId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const active = useRef(true);
  const fetching = useRef(false);
  const opening = useRef(false);
  const marking = useRef(false);
  useEffect(() => {
    active.current = true;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => { active.current = false; clearInterval(timer); };
  }, []);

  const merged = useMemo(
    () => mergeNotifications([...items, ...reminders.items], page?.items || [], readIds),
    [items, reminders.items, page, readIds],
  );
  const sections = useMemo(() => notificationSections(
    // Keep the detail being read visible until it is collapsed or the filter changes.
    filter === "unread" ? merged.filter((item) => !item.read || item.id === expandedId) : merged,
    language, copy, new Date(now),
  ), [merged, filter, expandedId, language, copy, now]);
  const moreAvailable = page ? page.hasMore : hasMore;
  // Sayaç yüklenmemiş eski bildirimleri de sayar; kaymışsa düğmeye basmak onu sıfırlar.
  const hasUnread = merged.some((item) => !item.read) || Number(profile?.unreadNotifsCount) > 0;

  const loadMore = async () => {
    if (fetching.current || !uid || !moreAvailable) return;
    fetching.current = true;
    setLoadingMore(true);
    setPageError(false);
    try {
      const result = await fetchOlderNotifications(uid, page ? page.cursor : cursor);
      if (active.current) setPage((previous) => ({ ...result, items: mergeNotifications(result.items, previous?.items || []) }));
    } catch {
      if (active.current) setPageError(true);
    } finally {
      fetching.current = false;
      if (active.current) setLoadingMore(false);
    }
  };

  const openNotification = async (item, navigate = true) => {
    if (opening.current || !uid) return;
    opening.current = true;
    setOpeningId(item.id);
    setActionError(null);
    try {
      if (!item.read) {
        if (item.local) reminders.markSeen(item);
        else await markRead(item.id);
      }
      if (!active.current) return;
      setReadIds((previous) => new Set(previous).add(item.id));
      const destination = notificationDestination(item);
      if (navigate && destination) navigation.navigate(destination.name, destination.params);
    } catch {
      if (active.current) setActionError("readError");
    } finally {
      opening.current = false;
      if (active.current) setOpeningId(null);
    }
  };

  const markAllRead = async () => {
    if (marking.current || !uid) return;
    marking.current = true;
    setMarkingAll(true);
    setActionError(null);
    // Yazımdan ÖNCE alınır: işlem sürerken gelen yeni bildirim okunmamış kalmalı.
    const unreadIds = merged.filter((item) => !item.read).map((item) => item.id);
    try {
      reminders.markAllSeen();
      await markAll();
      if (!active.current) return;
      // Eski sayfalar canlı dinlenmiyor; onlar da yerelde okundu görünsün.
      setReadIds((previous) => new Set([...previous, ...unreadIds]));
      toast.success(copy.markAllDone);
    } catch {
      if (active.current) setActionError("markAllError");
    } finally {
      marking.current = false;
      if (active.current) setMarkingAll(false);
    }
  };

  const toggleNotification = (item) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.id);
    return openNotification(item, false);
  };

  const renderItem = ({ item }) => {
    const content = notificationContent(item, t, copy);
    // Türe göre renk (beğeni kırmızı, istek mavi…); tema renklerinden, "accent" = vurgu.
    const tone = content.tone === "accent" ? accent : theme.colors?.[content.tone] || accent;
    const unread = !item.read;
    const destination = notificationDestination(item);
    const expanded = expandedId === item.id;
    const dateLabel = notificationDateLabel(item, language, copy, now);
    const relativeTime = dateLabel.split(" · ")[0];
    return (
      <View style={[styles.card, { backgroundColor: theme.secondary, borderColor: alpha(expanded || unread ? tone : theme.border, expanded ? 0.45 : 0.2) }]}>
      <GlassPressable
        glass={false}
        testID={`notification-${item.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${content.title}. ${content.action}. ${content.responseLabel ? `${content.responseLabel}. ` : ""}${relativeTime}. ${unread ? copy.unread : copy.read}`}
        accessibilityHint={expanded ? copy.collapse : copy.expand}
        accessibilityState={{ expanded, disabled: openingId !== null, busy: openingId === item.id }}
        disabled={openingId !== null}
        onPress={() => toggleNotification(item)}
        style={styles.rowButton}
      >
        <View style={styles.topRow}>
          <View style={[styles.icon, { backgroundColor: alpha(tone, unread ? 0.16 : 0.09) }]}>
            <AppIcon family="Ionicons" name={content.icon} size={18} color={unread ? tone : alpha(tone, 0.7)} />
            {unread && <View style={[styles.unreadDot, { backgroundColor: tone, borderColor: theme.secondary }]} />}
          </View>
          <View style={styles.titleColumn}>
            <View style={styles.titleRow}>
              <Text numberOfLines={1} style={[styles.name, { color: theme.text.primary, fontWeight: unread ? "700" : "600" }]}>{content.title}</Text>
              <Text numberOfLines={1} style={[styles.relativeTime, { color: theme.text.secondary }]}>{relativeTime}</Text>
            </View>
            <Text numberOfLines={1} style={[styles.preview, { color: theme.text.secondary }]}>{content.responseLabel || content.detail || content.action}</Text>
          </View>
          {openingId === item.id ? <ActivityIndicator size="small" color={accent} /> : (
            <AppIcon family="Ionicons" name={expanded ? "chevron-up" : "chevron-down"} size={14} color={theme.text.secondary} />
          )}
        </View>
      </GlassPressable>
      {expanded && <View testID={`notification-detail-${item.id}`} style={[styles.expanded, { borderTopColor: alpha(theme.border, 0.45) }]}>
        <Text style={[styles.sender, { color: theme.text.primary }]}>{content.title}</Text>
        <Text style={[styles.action, { color: theme.text.primary }]}>{content.action}</Text>
        {!!content.responseLabel && <Text style={[styles.response, { color: tone }]}>{content.responseLabel}</Text>}
        {!!content.detail && (
          <View style={[styles.detail, { backgroundColor: alpha(tone, 0.08) }]}>
            <Text style={[styles.body, { color: theme.text.primary }]}>{content.detail}</Text>
          </View>
        )}
        <Text style={[styles.date, { color: theme.text.secondary }]}>{dateLabel}</Text>
        {destination && <GlassPressable
          testID={`notification-open-${item.id}`}
          accessibilityRole="button"
          disabled={openingId !== null}
          accessibilityState={{ disabled: openingId !== null }}
          onPress={() => openNotification(item)}
          style={[styles.openButton, { backgroundColor: alpha(tone, 0.13) }]}
        >
          <Text style={[styles.filterText, { color: theme.text.primary }]}>{copy.open}</Text>
          <AppIcon family="Ionicons" name="arrow-forward" size={15} color={tone} />
        </GlassPressable>}
      </View>}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.primary }]}>
      <ScreenDecor scope="profile" iconOpacity={0.3} />
      <FriendsScreenHeader title={copy.title} subtitle={copy.subtitle} right={hasUnread ? (
        <GlassIconButton
          testID="notifications-mark-all"
          icon="checkmark-done"
          color={accent}
          accessibilityLabel={copy.markAllRead}
          accessibilityState={{ disabled: markingAll, busy: markingAll }}
          disabled={markingAll}
          onPress={markAllRead}
        >
          {markingAll ? <ActivityIndicator size="small" color={accent} /> : undefined}
        </GlassIconButton>
      ) : null} />
      <View style={styles.filters}>
        {["all", "unread"].map((key) => (
          <GlassPressable key={key} accessibilityRole="button" accessibilityState={{ selected: filter === key }}
            onPress={() => { setFilter(key); setExpandedId(null); }}
            style={[styles.filter, { backgroundColor: filter === key ? alpha(accent, 0.18) : theme.secondary, borderColor: filter === key ? accent : theme.border }]}>
            <Text style={[styles.filterText, { color: theme.text.primary }]}>{copy[key]}</Text>
          </GlassPressable>
        ))}
      </View>
      {actionError && <Text accessibilityRole="alert" style={[styles.error, { color: theme.text.primary }]}>{copy[actionError]}</Text>}
      {error && <View style={styles.errorBox}>
        <Text accessibilityRole="alert" style={[styles.body, { color: theme.text.primary }]}>{copy.error}</Text>
        <GlassPressable accessibilityRole="button" onPress={retry} style={[styles.more, { backgroundColor: theme.secondary }]}>
          <Text style={{ color: theme.text.primary }}>{copy.retry}</Text>
        </GlassPressable>
      </View>}
      {loading ? <ActivityIndicator testID="notifications-loading" style={styles.loading} color={accent} /> : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>{section.title}</Text>}
          ListEmptyComponent={!error ? <View style={styles.empty}>
            <AppIcon family="Ionicons" name="notifications-outline" size={42} color={accent} />
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{filter === "unread" ? copy.emptyUnread : copy.empty}</Text>
            <Text style={[styles.emptyBody, { color: theme.text.secondary }]}>{filter === "unread" ? copy.emptyUnreadBody : copy.emptyBody}</Text>
          </View> : null}
          ListFooterComponent={<View style={styles.footer}>
            {pageError && <Text accessibilityRole="alert" style={[styles.error, { color: theme.text.primary }]}>{copy.error}</Text>}
            {loadingMore ? <ActivityIndicator color={accent} /> : moreAvailable && (
              <GlassPressable accessibilityRole="button" onPress={loadMore} style={[styles.more, { backgroundColor: theme.secondary }]}>
                <Text style={[styles.filterText, { color: theme.text.primary }]}>{pageError ? copy.retry : copy.more}</Text>
              </GlassPressable>
            )}
          </View>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, loading: { flex: 1 }, list: { paddingHorizontal: 16, paddingBottom: 24 },
  filters: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  filter: { paddingHorizontal: 16, paddingVertical: 10, minHeight: 44, justifyContent: "center", borderRadius: 16, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: "700" },
  sectionTitle: { fontSize: 12, fontWeight: "700", marginTop: 14, marginBottom: 8 },
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 6 },
  rowButton: { paddingHorizontal: 12, paddingVertical: 12, minHeight: 68, borderRadius: 16 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  unreadDot: { position: "absolute", top: -2, right: -2, width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  titleColumn: { flex: 1, minWidth: 0 }, titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flex: 1, fontSize: 14 }, relativeTime: { maxWidth: "44%", fontSize: 10 },
  preview: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  expanded: { marginHorizontal: 12, paddingVertical: 12, borderTopWidth: 1 },
  sender: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  action: { fontSize: 13, lineHeight: 20 },
  response: { fontSize: 12, fontWeight: "700", marginTop: 5 },
  detail: { borderRadius: 10, padding: 10, marginTop: 8 }, body: { fontSize: 13, lineHeight: 20 },
  date: { fontSize: 11, lineHeight: 17, marginTop: 10 },
  openButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginTop: 10 },
  empty: { alignItems: "center", paddingVertical: 64, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 19, fontWeight: "700", textAlign: "center", marginTop: 18 },
  emptyBody: { fontSize: 14, lineHeight: 22, textAlign: "center", marginTop: 10 },
  footer: { paddingVertical: 12 }, more: { minHeight: 46, borderRadius: 18, padding: 14, alignItems: "center", justifyContent: "center" },
  error: { fontSize: 13, lineHeight: 20, padding: 16 }, errorBox: { padding: 16, gap: 12 },
});
