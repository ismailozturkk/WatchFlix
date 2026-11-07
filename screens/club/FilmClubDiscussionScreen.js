// screens/club/FilmClubDiscussionScreen.js
//
// Film Kulübü — bir turun SPOILER'SIZ tartışma odası. Rota parametreleri: `groupId`, `roundId`.
// Kapı kuralda: mesajları yalnız turda "izledim" işaretli üye okur/yazar (firestore.rules → discussion).
// İzlemeyen buraya gelirse kilit ekranı görür ve dinleyici hiç kurulmaz (kural zaten reddederdi).
//
// KLAVYE: yazma çubuğu `useKeyboardInset` ile klavyenin örttüğü kadar yukarı alınır (FilmChainScreen ile aynı
// yöntem; KeyboardAvoidingView Android'de güvenilmez — bkz. hooks/useKeyboardInset.js).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { appAlert } from "@components/AppAlert";
import { toast } from "@components/AppToast";
import { CLUB_ACCENT } from "@components/club/ClubCandidatePicker";
import GlassField from "@components/common/GlassField";
import GlassPressable from "@components/common/GlassPressable";
import UserAvatar from "@components/common/UserAvatar";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import useClubSender from "@hooks/useClubSender";
import useKeyboardInset from "@hooks/useKeyboardInset";
import {
  deleteClubComment,
  postClubComment,
  subscribeClubRound,
  subscribeDiscussion,
} from "@services/filmClubService";
import { subscribeGroup } from "@services/groupsService";
import { intlLocaleOf } from "@utils/appLanguages";
import { CLUB_COMMENT_MAX, hasWatched, toMillis } from "@utils/filmClub";
import { getFilmClubCopy } from "@utils/filmClubCopy";
import { canManageGroup } from "@utils/groupRoles";
import { GameScreenShell } from "../game/GameScreenShell";

function Comment({ item, mine, info, canDelete, onDelete, theme, copy, locale }) {
  const when = toMillis(item.createdAt);
  return (
    <View style={[styles.comment, mine && styles.commentMine]}>
      {!mine ? <UserAvatar avatarIndex={info?.avatarIndex} photoURL={info?.photoURL || null} size={30} /> : null}
      <GlassPressable
        glass={false}
        accessibilityRole="text"
        accessibilityHint={canDelete ? copy.deleteComment : undefined}
        onLongPress={canDelete ? onDelete : undefined}
        style={[
          styles.bubble,
          mine ? { backgroundColor: CLUB_ACCENT } : { backgroundColor: theme.secondary, borderColor: theme.border, borderWidth: 1 },
        ]}
      >
        {!mine ? (
          <Text style={[styles.author, { color: CLUB_ACCENT }]} numberOfLines={1}>
            {item.senderName || info?.name || copy.memberFallback}
          </Text>
        ) : null}
        <Text style={[styles.body, { color: mine ? "#fff" : theme.text.primary }]}>{item.text}</Text>
        {when ? (
          <Text style={[styles.time, { color: mine ? "rgba(255,255,255,0.75)" : theme.text.muted }]}>
            {new Date(when).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </Text>
        ) : null}
      </GlassPressable>
    </View>
  );
}

export default function FilmClubDiscussionScreen({ navigation, route }) {
  const { groupId, roundId } = route?.params || {};
  const { theme } = useTheme();
  const { language } = useLanguage();
  const locale = intlLocaleOf(language);
  const copy = getFilmClubCopy(language);
  const sender = useClubSender();
  const [group, setGroup] = useState(null);
  const [round, setRound] = useState(undefined);
  const [comments, setComments] = useState(null);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const { inset, onLayout } = useKeyboardInset(true);

  const watched = hasWatched(round, sender.uid);
  const canManage = canManageGroup(group, sender.uid);

  useEffect(() => subscribeGroup(groupId, setGroup), [groupId]);
  useEffect(() => subscribeClubRound(groupId, roundId, setRound), [groupId, roundId]);
  useEffect(() => {
    if (!watched) {
      setComments(null);
      return undefined;
    }
    return subscribeDiscussion(groupId, roundId, setComments, () => setComments([]));
  }, [groupId, roundId, watched]);

  const data = useMemo(() => comments || [], [comments]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await postClubComment({ groupId, roundId, sender, text });
      setText("");
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      if (__DEV__) console.warn("club comment:", err?.message);
      toast.error(copy.errorGeneric);
    } finally {
      setSending(false);
    }
  };

  const remove = (item) =>
    appAlert(copy.deleteComment, item.text.slice(0, 120), [
      { text: copy.cancel, style: "cancel" },
      {
        text: copy.deleteComment,
        style: "destructive",
        onPress: () => deleteClubComment(groupId, roundId, item.id).catch(() => toast.error(copy.errorGeneric)),
      },
    ]);

  const title = round?.pick?.title || copy.discussion;

  if (round === undefined) {
    return (
      <GameScreenShell navigation={navigation} title={copy.discussion} scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={CLUB_ACCENT} />
        </View>
      </GameScreenShell>
    );
  }

  if (!watched) {
    return (
      <GameScreenShell navigation={navigation} title={copy.discussion} subtitle={title} scroll={false}>
        <View style={styles.center}>
          <View style={[styles.lockTile, { backgroundColor: theme.secondary }]}>
            <AppIcon family="Ionicons" name="lock-closed" size={30} color={CLUB_ACCENT} />
          </View>
          <Text style={[styles.lockTitle, { color: theme.text.primary }]}>{copy.lockedTitle}</Text>
          <Text style={[styles.lockBody, { color: theme.text.muted }]}>{copy.lockedBody}</Text>
        </View>
      </GameScreenShell>
    );
  }

  const ready = !!text.trim() && !sending;
  return (
    <GameScreenShell navigation={navigation} title={copy.discussion} subtitle={title} scroll={false}>
      <View style={[styles.board, { paddingBottom: inset }]} onLayout={onLayout}>
        <View style={[styles.banner, { backgroundColor: `${CLUB_ACCENT}1F` }]}>
          <AppIcon family="Ionicons" name="eye" size={14} color={CLUB_ACCENT} />
          <Text style={[styles.bannerText, { color: theme.text.secondary }]}>{copy.discussionHint}</Text>
        </View>
        {comments === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={CLUB_ACCENT} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={data}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const mine = item.senderId === sender.uid;
              return (
                <Comment
                  item={item}
                  mine={mine}
                  info={group?.memberInfo?.[item.senderId]}
                  canDelete={mine || canManage}
                  onDelete={() => remove(item)}
                  theme={theme}
                  copy={copy}
                  locale={locale}
                />
              );
            }}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: theme.text.muted }]}>{copy.discussionEmpty}</Text>
            }
          />
        )}
        <View style={styles.composer}>
          <GlassField
            height={46}
            focused={focused}
            accent={CLUB_ACCENT}
            fallbackStyle={[styles.inputBox, { backgroundColor: theme.secondary, borderColor: focused ? CLUB_ACCENT : theme.border }]}
            style={styles.inputField}
          >
            <TextInput
              testID="club-comment-input"
              style={[styles.input, { color: theme.text.primary }]}
              placeholder={copy.writePlaceholder}
              placeholderTextColor={theme.text.muted}
              value={text}
              onChangeText={setText}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              maxLength={CLUB_COMMENT_MAX}
              // GlassField cam modunda sabit yükseklikte bir hap: çok satırlı kutu kırpılırdı.
              returnKeyType="send"
              onSubmitEditing={send}
              blurOnSubmit={false}
            />
          </GlassField>
          <GlassPressable
            glass={false}
            testID="club-comment-send"
            accessibilityRole="button"
            accessibilityLabel={copy.send}
            accessibilityState={{ disabled: !ready }}
            disabled={!ready}
            onPress={send}
            style={({ pressed }) => [
              styles.send,
              { backgroundColor: ready ? CLUB_ACCENT : theme.secondary },
              pressed && styles.pressed,
            ]}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <AppIcon family="Ionicons" name="arrow-up" size={20} color={ready ? "#fff" : theme.text.muted} />
            )}
          </GlassPressable>
        </View>
      </View>
    </GameScreenShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 24 },
  lockTile: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  lockTitle: { fontSize: 19, fontWeight: "900", textAlign: "center" },
  lockBody: { fontSize: 13.5, fontWeight: "650", textAlign: "center", lineHeight: 19 },
  board: { flex: 1, gap: 10 },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  bannerText: { flex: 1, fontSize: 12, fontWeight: "700" },
  list: { flex: 1 },
  listContent: { gap: 10, paddingBottom: 8 },
  empty: { textAlign: "center", fontSize: 13, fontWeight: "700", paddingVertical: 40 },
  comment: { flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "88%" },
  commentMine: { alignSelf: "flex-end" },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, flexShrink: 1 },
  author: { fontSize: 11.5, fontWeight: "900", marginBottom: 2 },
  body: { fontSize: 14.5, fontWeight: "600", lineHeight: 20 },
  time: { fontSize: 10.5, fontWeight: "700", marginTop: 3, alignSelf: "flex-end" },
  composer: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 6 },
  inputField: { flex: 1, paddingHorizontal: 14, justifyContent: "center" },
  inputBox: { borderRadius: 22, borderWidth: 1 },
  input: { fontSize: 15, fontWeight: "600", paddingVertical: 0 },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.85 },
});
