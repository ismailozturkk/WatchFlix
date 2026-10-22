import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import AppIcon from "../AppIcon";
import GlassPressable from "../common/GlassPressable";
import { useLanguage } from "../../context/LanguageContext";
import { useNotifications } from "../../context/NotificationsContext";
import { useTheme } from "../../context/ThemeContext";
import { usePremiumGate } from "../../hooks/usePremiumGate";
import { alpha } from "../../theme/colors";
import { INVITE_TYPES, invitationDestination, pendingInvitations } from "../../utils/importantInvites";
import { notificationDateLabel } from "../../utils/notificationInbox";
import { notificationInboxCopy } from "../../utils/notificationInboxCopy";

export default function ImportantInvitesBar({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { items, respond } = useNotifications();
  const gamesGate = usePremiumGate("games");
  const copy = notificationInboxCopy(language);
  const [now, setNow] = useState(Date.now());
  const [selectedId, setSelectedId] = useState(null);
  const [hidden, setHidden] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const invitations = useMemo(
    () => pendingInvitations(items, now).filter((item) => !hidden.has(item.id)),
    [items, now, hidden],
  );
  const position = Math.max(0, invitations.findIndex((item) => item.id === selectedId));
  const item = invitations[position];
  if (!item) return null;
  const accent = item.type === INVITE_TYPES.cine ? "#E11D48" : "#F59E0B";
  const action = item.type === INVITE_TYPES.cine ? copy.cineInvite : copy.duelInvite;
  const name = item.fromName || copy.title;
  const date = notificationDateLabel(item, language, copy, now).split(" · ")[0];

  const decide = async (response) => {
    if (busy) return;
    const destination = response === "accepted" ? invitationDestination(item) : null;
    if (response === "accepted" && !destination) return;
    if (response === "accepted" && item.type === INVITE_TYPES.duel && !gamesGate.allows(0)) {
      gamesGate.showUpsell();
      return;
    }
    setBusy(true);
    setError(false);
    try {
      const saved = await respond(item.id, response);
      setHidden((previous) => new Set(previous).add(item.id));
      if (saved && destination) navigation.navigate(destination.name, destination.params);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="important-invites-bar" style={[styles.bar, { backgroundColor: theme.secondary, borderColor: alpha(accent, 0.45) }]}>
      <View style={styles.header}>
        <AppIcon family="Ionicons" name="alert-circle" size={18} color={accent} />
        <Text style={[styles.heading, { color: theme.text.primary }]}>{copy.importantTitle}</Text>
        <Text style={[styles.count, { color: accent }]}>{copy.inviteCount(invitations.length)}</Text>
        {invitations.length > 1 && <GlassPressable
          testID="important-invite-next"
          accessibilityRole="button"
          accessibilityLabel={copy.nextInvite}
          disabled={busy}
          onPress={() => setSelectedId(invitations[(position + 1) % invitations.length].id)}
          style={styles.next}
        >
          <AppIcon family="Ionicons" name="chevron-forward" size={17} color={theme.text.primary} />
        </GlassPressable>}
      </View>
      <View style={styles.detail}>
        <Text style={[styles.message, { color: theme.text.primary }]} numberOfLines={2}>{name} {action}</Text>
        <Text style={[styles.date, { color: theme.text.muted }]}>{date}</Text>
      </View>
      {error && <Text accessibilityRole="alert" style={[styles.error, { color: theme.text.primary }]}>{copy.inviteError}</Text>}
      <View style={styles.actions}>
        <GlassPressable testID="important-invite-decline" accessibilityRole="button" accessibilityLabel={copy.declineInvite}
          disabled={busy} onPress={() => decide("declined")}
          style={[styles.button, { borderColor: theme.border, backgroundColor: theme.primary }]}>
          <Text style={[styles.buttonText, { color: theme.text.primary }]}>{copy.declineInvite}</Text>
        </GlassPressable>
        <GlassPressable testID="important-invite-accept" accessibilityRole="button" accessibilityLabel={copy.acceptInvite}
          disabled={busy} onPress={() => decide("accepted")}
          style={[styles.button, { backgroundColor: accent, borderColor: accent }]}>
          {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={[styles.buttonText, { color: "#FFFFFF" }]}>{copy.acceptInvite}</Text>}
        </GlassPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { alignSelf: "stretch", marginHorizontal: 16, marginBottom: 14, padding: 13, borderRadius: 18, borderWidth: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 7 },
  heading: { flex: 1, fontSize: 13, fontWeight: "800" },
  count: { fontSize: 11, fontWeight: "800" },
  next: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  detail: { marginTop: 5 },
  message: { fontSize: 14, lineHeight: 19, fontWeight: "700" },
  date: { fontSize: 11, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, marginTop: 11 },
  button: { flex: 1, minHeight: 39, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  buttonText: { fontSize: 12, fontWeight: "800" },
  error: { fontSize: 11, marginTop: 6 },
});
