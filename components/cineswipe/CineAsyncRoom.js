// components/cineswipe/CineAsyncRoom.js
//
// "Sırayla" (oturumlu) oda görünümleri — kurallar services/cineswipe/asyncRoom.js'te:
//   • CineAsyncInviteStrip: kartların üstünde, kimse katılmadıysa kod + "Davet gönder".
//   • CineAsyncDone: kendi seçimlerim bitti; davet bekleniyor ya da sıra arkadaşımda. Ekrandan
//     çıkmak odayı kapatmaz; sonuç sohbete ve bildirimlere düşer.
//   • CineAsyncRoomList: lobide süren odalarım (sıra sende / arkadaşında / sonuçlar hazır).
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import AppIcon from "../AppIcon";
import CineEmptyState from "./CineEmptyState";
import PressableScale from "./PressableScale";
import { alpha } from "../../theme/colors";
import { fillText } from "../../services/cineswipe/deckModel";
import { timeLeftParts } from "../../services/cineswipe/asyncRoom";

/** "18 sa" / "45 dk"; süre bilinmiyorsa boş. */
export function formatTimeLeft(ms, copy) {
  if (!Number.isFinite(ms)) return "";
  const { value, unit } = timeLeftParts(ms);
  return fillText(unit === "hour" ? copy.async.hours : copy.async.minutes, { n: value });
}

const formatCode = (code) => `${String(code).slice(0, 3)} ${String(code).slice(3)}`;

export function CineAsyncInviteStrip({ roomCode, timeLeft, onSendInvite, onCopy, copy, colors }) {
  const time = formatTimeLeft(timeLeft, copy);
  return (
    <View style={[styles.strip, { backgroundColor: alpha(colors.accent, 0.1), borderColor: alpha(colors.accent, 0.28) }]}>
      <View style={[styles.stripIcon, { backgroundColor: alpha(colors.accent, 0.16) }]}>
        <AppIcon family="Ionicons" name="time-outline" size={18} color={colors.accent} />
      </View>
      <View style={styles.stripCopy}>
        <Text style={[styles.stripTitle, { color: colors.text }]} numberOfLines={1}>
          {copy.async.inviteTitle}
        </Text>
        <PressableScale accessibilityRole="button" accessibilityLabel={copy.waiting.copy} onPress={onCopy} hitSlop={6}>
          <Text style={[styles.stripMeta, { color: colors.textSecondary }]} numberOfLines={1}>
            <Text style={[styles.stripCode, { color: colors.accent }]}>{formatCode(roomCode)}</Text>
            {time ? ` · ${fillText(copy.async.left, { time })}` : ""}
          </Text>
        </PressableScale>
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={copy.async.sendInvite}
        onPress={onSendInvite}
        style={[styles.stripButton, { backgroundColor: colors.accent }]}
      >
        <AppIcon family="Ionicons" name="paper-plane" size={15} color={colors.onAccent} />
        <Text style={[styles.stripButtonText, { color: colors.onAccent }]} numberOfLines={1}>
          {copy.async.sendInvite}
        </Text>
      </PressableScale>
    </View>
  );
}

/**
 * @param {"waitingGuest"|"partnerTurn"} stage
 * @param {boolean} canClose  Kurucu ve henüz kimse katılmadı: oda kapatılabilir.
 */
export function CineAsyncDone({
  stage,
  partnerName,
  partnerDone,
  total,
  timeLeft,
  roomCode,
  canClose,
  onSendInvite,
  onCopy,
  onLobby,
  onClose,
  copy,
  colors,
}) {
  const time = formatTimeLeft(timeLeft, copy);
  const waitingGuest = stage === "waitingGuest";
  const body = waitingGuest
    ? fillText(copy.async.doneWaitingGuest, { time: time || "24" })
    : fillText(copy.async.donePartnerTurn, {
        name: partnerName || copy.progress.partner,
        done: partnerDone,
        total,
      });
  const actions = [
    ...(waitingGuest
      ? [
          { key: "invite", icon: "paper-plane-outline", label: copy.async.sendInvite, onPress: onSendInvite },
          { key: "copy", icon: "copy-outline", label: copy.waiting.copy, variant: "secondary", onPress: onCopy },
        ]
      : []),
    {
      key: "lobby",
      icon: "albums-outline",
      label: copy.async.backToLobby,
      variant: waitingGuest ? "secondary" : undefined,
      onPress: onLobby,
    },
  ];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.doneContent} showsVerticalScrollIndicator={false}>
      <CineEmptyState
        icon={waitingGuest ? "hourglass-outline" : "checkmark-done-circle-outline"}
        tint={waitingGuest ? colors.accent : colors.like}
        title={copy.async.doneTitle}
        body={body}
        colors={colors}
        actions={actions}
      />
      {waitingGuest && roomCode ? (
        <Text style={[styles.doneCode, { color: colors.muted }]}>
          {copy.waiting.codeLabel} · {formatCode(roomCode)}
        </Text>
      ) : null}
      {canClose ? (
        <PressableScale accessibilityRole="button" accessibilityLabel={copy.async.closeRoom} onPress={onClose} style={styles.close}>
          <AppIcon family="Ionicons" name="close-circle-outline" size={17} color={colors.pass} />
          <Text style={[styles.closeText, { color: colors.pass }]}>{copy.async.closeRoom}</Text>
        </PressableScale>
      ) : null}
    </ScrollView>
  );
}

const STAGE_STYLE = {
  finished: { icon: "trophy", tone: "gold", label: "stageFinished" },
  yourTurn: { icon: "hand-left-outline", tone: "accent", label: "stageYourTurn" },
  partnerTurn: { icon: "hourglass-outline", tone: "like", label: "stagePartnerTurn" },
  waitingGuest: { icon: "mail-unread-outline", tone: "muted", label: "stageWaitingGuest" },
};

export function CineAsyncRoomList({ rooms = [], onOpen, copy, colors }) {
  if (!rooms.length) return null;
  return (
    <View style={styles.list}>
      <Text style={[styles.listTitle, { color: colors.muted }]}>{copy.async.activeTitle}</Text>
      {rooms.map((room) => {
        const stage = STAGE_STYLE[room.stage] || STAGE_STYLE.waitingGuest;
        const tint = colors[stage.tone] || colors.accent;
        const name = room.partnerName || copy.async.waitingPartner;
        const time = room.stage === "finished" ? "" : formatTimeLeft(room.timeLeft, copy);
        const meta = [
          copy.async[stage.label],
          room.stage === "yourTurn" ? fillText(copy.async.cards, { done: room.done, total: room.total }) : "",
          time ? fillText(copy.async.left, { time }) : "",
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <PressableScale
            key={room.roomId}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${meta}`}
            onPress={() => onOpen?.(room.roomId)}
            style={[styles.row, { backgroundColor: alpha(tint, 0.1), borderColor: alpha(tint, 0.32) }]}
          >
            <View style={[styles.rowIcon, { backgroundColor: alpha(tint, 0.18) }]}>
              <AppIcon family="Ionicons" name={stage.icon} size={17} color={tint} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                {name}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                {meta}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: alpha(colors.text, 0.07) }]}>
              <AppIcon family="Ionicons" name="time-outline" size={11} color={colors.muted} />
              <Text style={[styles.badgeText, { color: colors.muted }]}>{copy.async.badge}</Text>
            </View>
            <AppIcon family="Ionicons" name="chevron-forward" size={16} color={colors.muted} />
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 9,
    paddingLeft: 10,
    paddingRight: 9,
    borderRadius: 16,
    borderWidth: 1,
  },
  stripIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  stripCopy: {
    flex: 1,
    minWidth: 0,
  },
  stripTitle: {
    fontSize: 13.5,
    fontWeight: "900",
  },
  stripMeta: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },
  stripCode: {
    fontWeight: "900",
    letterSpacing: 1,
  },
  stripButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    flexShrink: 0,
  },
  stripButtonText: {
    fontSize: 12.5,
    fontWeight: "900",
  },
  doneContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  doneCode: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginTop: 4,
  },
  close: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    padding: 8,
  },
  closeText: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  list: {
    alignSelf: "stretch",
    marginTop: 22,
    gap: 8,
  },
  listTitle: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 14,
    fontWeight: "800",
  },
  rowMeta: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    height: 20,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
});
