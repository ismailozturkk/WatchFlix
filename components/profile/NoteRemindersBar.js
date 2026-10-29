// components/profile/NoteRemindersBar.js
//
// Profilin üstündeki etkileşimli hatırlatma şeridi (davetler artık
// yüzen bildirimde, components/floatingNotice): vadesi gelmiş, okunmamış not / liste
// hatırlatmaları. Eylemler:
//   • 1 saat ertele → notun gün + saatini ileri alır (cihaz bildirimi yeniden kurulur).
//     Ertelemek yeni bir zaman kurmaktır: hatırlatıcı Premium'a özel (registry:
//     note_reminders), Free'de yükseltme sayfası açılır (düğmede ◆ işareti).
//   • Tamam        → okundu (bildirim kutusunda da okundu görünür)
//   • Notu aç      → okundu + Notlar'da o notun düzenleyicisi
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "../AppIcon";
import GlassPressable from "../common/GlassPressable";
import { toast } from "../AppToast";
import { useLanguage } from "../../context/LanguageContext";
import { useProfileNotes } from "../../context/ProfileNotesContext";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import useNoteReminderInbox from "../../hooks/useNoteReminderInbox";
import { notificationContent, notificationDateLabel } from "../../utils/notificationInbox";
import { notificationInboxCopy } from "../../utils/notificationInboxCopy";
import { noteReminderPreview, snoozedSchedule } from "../../utils/noteReminders";

const SNOOZE_MINUTES = 60;

export default function NoteRemindersBar({ navigation }) {
  const { theme } = useTheme();
  const { language, t } = useLanguage();
  const notesApi = useProfileNotes();
  const { unread, markSeen } = useNoteReminderInbox();
  const copy = notificationInboxCopy(language);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);

  const position = Math.max(0, unread.findIndex((item) => item.id === selectedId));
  const item = unread[position];
  const content = useMemo(() => (item ? notificationContent(item, t, copy) : null), [item, t, copy]);
  if (!item || !content) return null;
  const accent = item.color || theme.colors?.orange || "#F59E0B";
  const when = notificationDateLabel(item, language, copy).split(" · ")[0];

  const done = () => markSeen(item);
  const open = () => {
    markSeen(item);
    navigation.navigate("NotesScreen", { openNoteId: item.noteId });
  };
  const reminderLocked = !notesApi?.canSetNoteReminder;
  const snooze = async () => {
    if (busy) return;
    const note = (notesApi?.notes || []).find((entry) => String(entry?.id) === item.noteId);
    if (!note || !notesApi?.saveNote) return;
    const schedule = snoozedSchedule(SNOOZE_MINUTES);
    if (reminderLocked) {
      notesApi.showNoteReminderUpsell?.(noteReminderPreview(note, schedule));
      return;
    }
    setBusy(true);
    try {
      const saved = await notesApi.saveNote({ ...note, ...schedule });
      if (saved === false) throw new Error("snooze");
      toast.success(copy.reminderSnoozed);
    } catch {
      toast.error(copy.reminderSnoozeError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="note-reminders-bar" style={[styles.bar, { backgroundColor: theme.secondary, borderColor: alpha(accent, 0.45) }]}>
      <View style={styles.header}>
        <AppIcon family="Ionicons" name="alarm" size={18} color={accent} />
        <Text style={[styles.heading, { color: theme.text.primary }]}>{content.action}</Text>
        <Text style={[styles.count, { color: accent }]}>{copy.reminderCount(unread.length)}</Text>
        {unread.length > 1 && <GlassPressable
          testID="note-reminder-next"
          accessibilityRole="button"
          accessibilityLabel={copy.nextReminder}
          disabled={busy}
          onPress={() => setSelectedId(unread[(position + 1) % unread.length].id)}
          style={styles.next}
        >
          <AppIcon family="Ionicons" name="chevron-forward" size={17} color={theme.text.primary} />
        </GlassPressable>}
      </View>
      <View style={styles.detail}>
        <Text style={[styles.message, { color: theme.text.primary }]} numberOfLines={1}>{content.title}</Text>
        {!!content.detail && (
          <Text style={[styles.preview, { color: theme.text.secondary }]} numberOfLines={2}>{content.detail}</Text>
        )}
        <Text style={[styles.date, { color: theme.text.muted }]}>{when}</Text>
      </View>
      <View style={styles.actions}>
        <GlassPressable testID="note-reminder-snooze" accessibilityRole="button"
          accessibilityLabel={reminderLocked ? `${copy.reminderSnooze} · Premium` : copy.reminderSnooze}
          disabled={busy} onPress={snooze}
          style={[styles.iconButton, { borderColor: theme.border, backgroundColor: theme.primary }]}>
          <AppIcon family="Ionicons" name="time-outline" size={18} color={theme.text.primary} />
          {reminderLocked ? (
            <View testID="note-reminder-snooze-premium" style={[styles.premiumBadge, { backgroundColor: theme.accent, borderColor: theme.secondary }]}>
              <AppIcon family="Ionicons" name="diamond" size={7} color="#FFFFFF" />
            </View>
          ) : null}
        </GlassPressable>
        <GlassPressable testID="note-reminder-done" accessibilityRole="button" accessibilityLabel={copy.reminderDone}
          disabled={busy} onPress={done}
          style={[styles.button, { borderColor: theme.border, backgroundColor: theme.primary }]}>
          <Text style={[styles.buttonText, { color: theme.text.primary }]}>{copy.reminderDone}</Text>
        </GlassPressable>
        <GlassPressable testID="note-reminder-open" accessibilityRole="button" accessibilityLabel={copy.reminderOpen}
          disabled={busy} onPress={open}
          style={[styles.button, { backgroundColor: accent, borderColor: accent }]}>
          <Text style={[styles.buttonText, { color: "#FFFFFF" }]}>{copy.reminderOpen}</Text>
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
  preview: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  date: { fontSize: 11, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, marginTop: 11 },
  iconButton: { width: 39, minHeight: 39, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  premiumBadge: { position: "absolute", top: -4, right: -4, width: 15, height: 15, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  button: { flex: 1, minHeight: 39, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  buttonText: { fontSize: 12, fontWeight: "800" },
});
