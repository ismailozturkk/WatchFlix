// components/chat/MessageBubble.js
//
// Sohbet/grup mesaj balonu (screens/chat/ChatScreen.js'ten ayrıldı). Gövde
// türleri: düz metin, tekli medya kartı, çoklu içerik listesi, anket ve sohbete
// gönderilen liste / CineMatch cevabı / Hub gönderisi / turnuva / CineSwipe daveti
// (utils/chatShare.js). Şekil/renk
// kararları utils/chatBubbleStyle.js'te, giriş (sekme) animasyonu BounceIn'de.

import React, { memo, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import UserAvatar from "../common/UserAvatar";
import { memberColor } from "@services/groupsService";
import { readableOn } from "@utils/colorUtils";
import { i18nText } from "@utils/i18nText";
import { readShare, shareRoute } from "@utils/chatShare";
import { countEmojiClusters, isEmojiOnly } from "@utils/emojiText";
import {
  bubbleRadii,
  outgoingGradient,
  shouldInlineMeta,
} from "@utils/chatBubbleStyle";
import BounceIn from "./BounceIn";
import MessageReplyPreview from "./MessageReplyPreview";
import PollMessage from "./PollMessage";
import SharedAiMessage from "./SharedAiMessage";
import SharedCineRoomMessage from "./SharedCineRoomMessage";
import SharedChallengeMessage from "./SharedChallengeMessage";
import SharedDuelResultMessage from "./SharedDuelResultMessage";
import SharedListMessage from "./SharedListMessage";
import SharedMediaCollection from "./SharedMediaCollection";
import SharedMediaMessage from "./SharedMediaMessage";
import SharedPostMessage from "./SharedPostMessage";
import SharedSettingsMessage from "./SharedSettingsMessage";
import SharedTasteMatchMessage from "./SharedTasteMatchMessage";
import SharedTournamentMessage from "./SharedTournamentMessage";
import SwipeReplyContainer from "./SwipeReplyContainer";

const ACCENT = "#6C63FF";
const SEEN_COLOR = "#5EE8A0";


// Bir media öğesini (tekli veya koleksiyon içindeki) detay ekranına yönlendir.
export const openMediaDetail = (navigation, m) => {
  if (!m) return;
  const route =
    m.media_type === "movie"
      ? "MovieDetails"
      : m.media_type === "tv"
        ? "TvShowsDetails"
        : "ActorViewScreen";
  const params = m.media_type === "person" ? { personId: m.id } : { id: m.id };
  navigation.push(route, params);
};

// Hedefi olan paylaşımlar (gönderi, turnuva, CineSwipe daveti) kendi ekranına gider. CineSwipe
// davetinde `inviteChat` bu sohbettir: oda bitince ortak eşleşmeler buraya yazılır.
const openShareTarget = (navigation, share, inviteChat) => {
  const route = shareRoute(share, { inviteChat });
  if (route) navigation.push(route.name, route.params);
};

const formatClock = (ts) => {
  if (!ts) return "";
  const date = ts.toDate?.() || new Date(ts);
  return (
    date.getHours().toString().padStart(2, "0") +
    ":" +
    date.getMinutes().toString().padStart(2, "0")
  );
};

// ─── Mesaj balonu ────────────────────────────────────────────────────────────
// Dört gövde türü: düz metin (kısa metinde saat yanında; 1–3 emoji balonsuz
// büyük), tekli medya kartı, çoklu içerik listesi, anket. Şekil/renk kararları
// utils/chatBubbleStyle.js'te; giriş (sekme) animasyonu BounceIn'de ve yalnız
// `entrance` verilen (yeni gelen/giden) balonda çalışır.
const MessageBubble = memo(
  ({
    item,
    currentUser,
    theme,
    navigation,
    getTmdbUrl,
    onLongPress,
    renderMessageText,
    onOpenTrailer,
    groupTop,
    groupBottom,
    dateLabel,
    isGroup,
    avatars,
    memberInfo,
    onVote,
    onSaveList,
    onOpenList,
    onReply,
    onJumpToMessage,
    chatTarget,
    onAcceptInvite,
    highlighted,
    entrance,
  }) => {
    const isMe = item.senderId === currentUser.uid;
    const hasItems = Array.isArray(item.items) && item.items.length > 0;
    const hasPoll = item.kind === "poll" && !!item.poll;
    // Sohbete gönderilen liste / CineMatch cevabı; bozuk kayıt null → düz metne düşer.
    const share = useMemo(() => readShare(item), [item.kind, item.share]);
    const isRich = !!item.media || hasItems || hasPoll || !!share;
    const bodyText = typeof item.text === "string" ? item.text : "";
    // 1–3 emoji (yanıt alıntısı yoksa): balon yok, büyük emoji.
    const emojiOnly = !isRich && !item.replyTo && isEmojiOnly(bodyText);
    const emojiCount = emojiOnly ? countEmojiClusters(bodyText) : 0;
    const inlineMeta = !isRich && !emojiOnly && shouldInlineMeta(bodyText);
    // Grupta gelen mesajda gönderen rengi (baloncuk + ad tutarlı renkte).
    const senderColor = isGroup && !isMe ? memberColor(item.senderId) : null;
    // Gönderen ad/avatarı CANLI grup memberInfo'dan çöz (profil değişince eski
    // mesajlar da güncel görünür); üye gruptan ayrıldıysa mesajdaki donmuş değere düş.
    const minfo = isGroup ? memberInfo?.[item.senderId] : null;
    const senderName = minfo?.name || item.senderName || "";
    const senderAvatarIndex =
      typeof minfo?.avatarIndex === "number" ? minfo.avatarIndex : item.senderAvatarIndex;
    const senderPhotoURL = minfo?.photoURL || item.senderPhotoURL || null;
    // Gönderen başlığı yalnızca ardışık bloğun İLK mesajında (groupTop yokken).
    const showSenderHeader = isGroup && !isMe && !groupTop;

    // Balon zemini: giden = tema vurgusu (+ hafif degrade), gelen = ikincil yüzey.
    // Balonsuz emojide yüzey yok → saat/ikon renkleri sayfa zeminine göre.
    const onAccent = isMe && !emojiOnly;
    const gradient = onAccent ? outgoingGradient(theme?.accent) : null;
    const radii = bubbleRadii({ isMe, groupTop, groupBottom });
    const metaColor = onAccent
      ? "rgba(255,255,255,0.75)"
      : (theme?.text?.muted ?? "rgba(255,255,255,0.45)");

    const getStatusIcon = () => {
      if (item.status === "sending")
        return <Ionicons name="time-outline" size={12} color={metaColor} />;
      if (item.status === "seen")
        return <Ionicons name="checkmark-done" size={13} color={SEEN_COLOR} />;
      if (item.status === "delivered")
        return <Ionicons name="checkmark-done" size={13} color={metaColor} />;
      return <Ionicons name="checkmark" size={13} color={metaColor} />;
    };

    const meta = (
      <View
        style={[
          styles.msgMeta,
          inlineMeta
            ? styles.msgMetaInline
            : [
                styles.msgMetaBelow,
                isRich && styles.msgMetaRich,
                { justifyContent: isMe ? "flex-end" : "flex-start" },
              ],
        ]}
      >
        {item.edited && (
          <Text style={[styles.editedTag, { color: metaColor }]}>
            {i18nText("autoI18n.duzenlendi", "düzenlendi")}
          </Text>
        )}
        <Text style={[styles.timestamp, { color: metaColor }]}>
          {formatClock(item.timestamp)}
        </Text>
        {isMe && getStatusIcon()}
      </View>
    );

    return (
      <View>
        {dateLabel ? (
          <View style={styles.dateSep}>
            <View style={[styles.dateSepLine, { backgroundColor: theme?.border ?? "rgba(255,255,255,0.12)" }]} />
            <Text
              allowFontScaling={false}
              style={[
                styles.dateSepText,
                {
                  color: theme?.text?.muted ?? "rgba(255,255,255,0.6)",
                  backgroundColor: theme?.between ?? "rgba(255,255,255,0.07)",
                },
              ]}
            >
              {dateLabel}
            </Text>
            <View style={[styles.dateSepLine, { backgroundColor: theme?.border ?? "rgba(255,255,255,0.12)" }]} />
          </View>
        ) : null}
        <SwipeReplyContainer onReply={() => onReply(item)}>
        <BounceIn
          kind={entrance}
          isMe={isMe}
          style={[
            isMe ? styles.myMsgWrapper : styles.friendMsgWrapper,
            // Ardışık aynı-gönderici mesajlarda araları sıkılaştır.
            groupTop && styles.groupedTop,
            groupBottom && styles.groupedBottom,
          ]}
        >
        {/* Grupta gönderen başlığı (avatar + ad) */}
        {showSenderHeader && (
          <View style={styles.senderHeader}>
            <UserAvatar
              avatarIndex={senderAvatarIndex}
              photoURL={senderPhotoURL}
              isCustomPhoto
              size={20}
            />
            <Text
              // Üye rengi açık temada (ör. sarı) zeminde kayboluyordu: tonu koru, okunurluğa çek.
              style={[
                styles.senderName,
                { color: theme?.primary ? readableOn(senderColor, theme.primary) : senderColor },
              ]}
              numberOfLines={1}
            >
              {senderName || i18nText("autoI18n.uye", "Üye")}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[
            styles.message,
            isRich ? styles.richMessage : styles.textMessage,
            emojiOnly
              ? styles.emojiMessage
              : isMe
                ? { backgroundColor: theme?.accent ?? "#17245c" }
                : [
                    styles.friendMsg,
                    {
                      backgroundColor: theme?.secondary ?? "rgba(68, 68, 68, 1)",
                      borderColor: theme?.border ?? "rgba(255,255,255,0.2)",
                    },
                  ],
            radii,
            // Grupta gelen baloncukta gönderen renginde ince çerçeve.
            senderColor && !emojiOnly && { borderColor: senderColor + "66" },
            item.status === "sending" && styles.sendingMessage,
            highlighted && styles.highlightedMessage,
          ]}
          onLongPress={() => onLongPress(item)}
          activeOpacity={0.8}
          onPress={() =>
            item.media ? openMediaDetail(navigation, item.media) : null
          }
        >
          {gradient ? (
            <LinearGradient
              pointerEvents="none"
              colors={gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, radii]}
            />
          ) : null}
          <MessageReplyPreview
            reply={item.replyTo}
            isOutgoing={onAccent}
            isSelf={Boolean(item.replyTo?.senderId) && item.replyTo.senderId === currentUser.uid}
            accentColor={isGroup && item.replyTo?.senderId ? memberColor(item.replyTo.senderId) : null}
            getTmdbUrl={getTmdbUrl}
            onPress={item.replyTo?.messageId ? () => onJumpToMessage(item.replyTo.messageId) : undefined}
          />
          {/* ── Anket ── */}
          {hasPoll ? (
            <PollMessage
              poll={item.poll}
              currentUid={currentUser.uid}
              accent={theme?.accent ?? ACCENT}
              getTmdbUrl={getTmdbUrl}
              theme={theme}
              isOutgoing={isMe}
              onVote={(optionId) => onVote?.(item, optionId)}
            />
          ) : share?.type === "list" ? (
            <SharedListMessage
              share={share}
              accent={theme?.accent ?? ACCENT}
              getTmdbUrl={getTmdbUrl}
              isOutgoing={isMe}
              onOpenItem={(it) => openMediaDetail(navigation, it)}
              onOpenList={onOpenList ? () => onOpenList(item, share) : undefined}
              onSave={onSaveList ? () => onSaveList(item, share) : undefined}
            />
          ) : share?.type === "ai" ? (
            <SharedAiMessage
              share={share}
              accent={theme?.accent ?? ACCENT}
              getTmdbUrl={getTmdbUrl}
              isOutgoing={isMe}
              onOpenItem={(it) => openMediaDetail(navigation, it)}
            />
          ) : share?.type === "post" ? (
            <SharedPostMessage
              share={share}
              getTmdbUrl={getTmdbUrl}
              isOutgoing={isMe}
              onOpenPost={() => openShareTarget(navigation, share)}
              onOpenItem={(it) => openMediaDetail(navigation, it)}
            />
          ) : share?.type === "tournament" ? (
            <SharedTournamentMessage
              share={share}
              getTmdbUrl={getTmdbUrl}
              isOutgoing={isMe}
              onOpen={() => openShareTarget(navigation, share)}
            />
          ) : share?.type === "cineRoom" ? (
            <SharedCineRoomMessage
              share={share}
              isOutgoing={isMe}
              onOpen={() => {
                onAcceptInvite?.(share, item.senderId);
                openShareTarget(navigation, share, chatTarget);
              }}
            />
          ) : share?.type === "tasteMatch" ? (
            <SharedTasteMatchMessage share={share} isOutgoing={isMe} getTmdbUrl={getTmdbUrl} />
          ) : share?.type === "challenge" ? (
            <SharedChallengeMessage
              share={share}
              isOutgoing={isMe}
              senderUid={item.senderId}
              chatTarget={chatTarget}
              accepts={item.accepts}
              onAccepted={onAcceptInvite ? () => onAcceptInvite(share, item.senderId, item.id) : undefined}
            />
          ) : share?.type === "duelResult" ? (
            <SharedDuelResultMessage
              share={share}
              isOutgoing={isMe}
              senderUid={item.senderId}
              senderName={senderName}
            />
          ) : share?.type === "settings" ? (
            <SharedSettingsMessage share={share} isOutgoing={isMe} />
          ) : hasItems ? (
            <SharedMediaCollection
              items={item.items}
              listTitle={item.listTitle}
              accent={theme?.accent ?? ACCENT}
              getTmdbUrl={getTmdbUrl}
              isOutgoing={isMe}
              onOpenItem={(it) => openMediaDetail(navigation, it)}
            />
          ) : item.media ? (
            /* ── Tekli media kartı ── */
            <SharedMediaMessage
              item={item}
              media={item.media}
              text={item.text}
              accent={theme?.accent ?? ACCENT}
              getTmdbUrl={getTmdbUrl}
              onOpenTrailer={() => onOpenTrailer?.(item.media)}
              isOutgoing={isMe}
            />
          ) : emojiOnly ? (
            /* ── 1–3 emoji: balonsuz, büyük ── */
            <Text
              allowFontScaling={false}
              style={[styles.bigEmoji, { fontSize: emojiCount === 1 ? 46 : 36 }]}
            >
              {bodyText.trim()}
            </Text>
          ) : inlineMeta ? (
            /* ── Kısa metin: saat metnin yanında ── */
            <View style={styles.inlineRow}>
              <Text style={styles.inlineText}>{renderMessageText(bodyText, isMe)}</Text>
              {meta}
            </View>
          ) : (
            /* ── Düz metin ── */
            <Text>{renderMessageText(bodyText, isMe)}</Text>
          )}

          {/* ── Alt meta (kısa metinde yanda) ── */}
          {inlineMeta ? null : meta}
        </TouchableOpacity>
        </BounceIn>
        </SwipeReplyContainer>
      </View>
    );
  },
);

export default MessageBubble;

const styles = StyleSheet.create({
  // wrapper — hizalama için. Ardışık aynı-gönderici mesajlar blok gibi sıkı
  // (1+1=2px), bloklar arası ferah (4+4=8px).
  myMsgWrapper: { alignItems: "flex-end", marginVertical: 4 },
  friendMsgWrapper: { alignItems: "flex-start", marginVertical: 4 },

  // grup: gönderen başlığı
  senderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 8,
    marginBottom: 3,
  },
  senderName: { fontSize: 11.5, fontWeight: "800", maxWidth: 180 },
  groupedTop: { marginTop: 1 },
  groupedBottom: { marginBottom: 1 },

  // gün ayracı (yatay çizgi + ortada tarih)
  dateSep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 14,
    paddingHorizontal: 8,
  },
  dateSepLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.12)" },
  dateSepText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },

  // Köşe yarıçapları utils/chatBubbleStyle.js bubbleRadii'den gelir (komşuya
  // değen köşe küçük, dışa bakan yuvarlak); burada yalnız gölge + ölçü var.
  message: {
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  textMessage: {
    maxWidth: "80%",
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  // Poster / liste / anket: içerik kartı balonu daha geniş, ince dolgulu.
  richMessage: {
    maxWidth: "90%",
    padding: 10,
  },
  // 1–3 emoji: balon yok.
  emojiMessage: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    backgroundColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
  bigEmoji: { lineHeight: 54 },
  friendMsg: {
    borderWidth: 1,
  },
  // Gönderiliyor: sunucu onayına dek hafif soluk.
  sendingMessage: { opacity: 0.86 },
  inlineRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  inlineText: { flexShrink: 1 },

  highlightedMessage: {
    borderColor: "#FFD166",
    borderWidth: 1.5,
    shadowColor: "#FFD166",
    shadowOpacity: 0.34,
  },

  msgMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  msgMetaBelow: { marginTop: 3 },
  msgMetaRich: { marginTop: 8 },
  msgMetaInline: { flexShrink: 0, paddingBottom: 2 },
  timestamp: { fontSize: 10.5, color: "rgba(255,255,255,0.38)" },
  editedTag: {
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
    fontStyle: "italic",
    marginRight: 2,
  },
});
