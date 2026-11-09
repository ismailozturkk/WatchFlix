import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import LensLoader from "../LensLoader";
import { collection, onSnapshot } from "firebase/firestore";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import { db } from "../../firebase";
import { useTheme } from "@context/ThemeContext";
import { useUserProfile } from "@context/UserProfileContext";
import {
  addGroupMember,
  removeGroupMember,
  setGroupAdminRole,
  setGroupAdminsOnlyMessages,
  updateGroupAvatar,
} from "@services/groupsService";
import {
  canManageGroup,
  groupRoleOf,
  isAdminsOnlyGroup,
  isGroupAdmin,
  isGroupCreator,
  sortMembersByRole,
} from "@utils/groupRoles";
import { MAX_GROUP_MEMBERS, groupSlotsLeft } from "@utils/groupLimits";
import { i18nText } from "@utils/i18nText";
import { getIsOnline } from "@context/ConnectivityContext";
import { waitForGroupMemberAction } from "@utils/groupMemberAction";
import { toast } from "@components/AppToast";
import GroupAvatar from "@components/chat/GroupAvatar";
import GroupAvatarGrid from "@components/chat/GroupAvatarGrid";
import LeaveSheet from "@components/modals/createPost/LeaveSheet";
import UserAvatar from "@components/common/UserAvatar";
import GlassTouchable from "../common/GlassTouchable";
import SwitchToggle from "@components/SwitchToggle";

const ACCENT = "#6C63FF";
const DANGER = "#FF6B6B";

export default function GroupInfoModal({
  visible,
  onClose,
  groupId,
  groupData,
  currentUid,
  onOpenProfile,
  onOpenClub,
}) {
  const { theme } = useTheme();
  const { profile } = useUserProfile();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("members");
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [busyUid, setBusyUid] = useState(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingSendPolicy, setSavingSendPolicy] = useState(false);
  // Üye çıkar / yönetici yap onayı: { title, message, actions } | null.
  // `appAlert` KULLANMA: bu sayfa açıkken o, köke bağlı ikinci bir native Modal
  // ister; iOS sunamaz, uyarı hiç görünmez ve AppAlertHost takılı kalır →
  // uygulama donmuş gibi davranır. Onay bu pencerenin içinde çizilir.
  const [confirm, setConfirm] = useState(null);

  const isCreator = isGroupCreator(groupData, currentUid);
  const isAdmin = isGroupAdmin(groupData, currentUid);
  const canManage = canManageGroup(groupData, currentUid);
  const memberIds = groupData?.members || [];
  const adminsOnly = isAdminsOnlyGroup(groupData);

  useEffect(() => {
    if (!visible) {
      setTab("members");
      setConfirm(null);
    }
  }, [visible]);

  // Geri tuşu / dışarı dokunuş önce açık onayı kapatır, sonra sayfayı.
  const handleClose = useCallback(() => {
    if (confirm) setConfirm(null);
    else onClose?.();
  }, [confirm, onClose]);

  useEffect(() => {
    if (!visible || !canManage || !currentUid) return undefined;
    setLoadingFriends(true);
    return onSnapshot(
      collection(db, "Users", currentUid, "friends"),
      (snap) => {
        setFriends(
          snap.docs.map((item) => {
            const data = item.data();
            return {
              uid: data.friendUid || item.id,
              displayName: data.friendName || "",
              username: data.friendUsername || "",
              avatarIndex: data.friendAvatarIndex ?? 0,
              photoURL: data.friendPhotoURL || null,
            };
          })
        );
        setLoadingFriends(false);
      },
      () => setLoadingFriends(false)
    );
  }, [visible, canManage, currentUid]);

  const members = useMemo(
    () =>
      sortMembersByRole(
        memberIds.map((uid) => {
          const isMe = uid === currentUid;
          const minfo = groupData?.memberInfo?.[uid];
          return {
            uid,
            displayName: isMe
              ? profile?.displayName || minfo?.name || i18nText("autoI18n.sen", "Sen")
              : minfo?.name || i18nText("autoI18n.isimsiz_kullanici", "İsimsiz kullanıcı"),
            username: isMe
              ? profile?.username || minfo?.username || ""
              : minfo?.username || "",
            avatarIndex: isMe
              ? typeof profile?.avatarIndex === "number"
                ? profile.avatarIndex
                : minfo?.avatarIndex ?? 0
              : minfo?.avatarIndex ?? 0,
            photoURL: isMe
              ? profile?.photoURL || minfo?.photoURL || null
              : minfo?.photoURL || null,
          };
        }),
        groupData
      ),
    [memberIds, groupData, currentUid, profile]
  );

  const memberSections = useMemo(() => {
    const creators = members.filter((item) => groupRoleOf(groupData, item.uid) === "creator");
    const admins = members.filter((item) => groupRoleOf(groupData, item.uid) === "admin");
    const regularMembers = members.filter((item) => groupRoleOf(groupData, item.uid) === "member");
    return [
      {
        key: "creator",
        title: i18nText("autoI18n.grup_kurucusu", "Grup Kurucusu"),
        icon: "diamond-outline",
        data: creators,
      },
      {
        key: "admins",
        title: i18nText("autoI18n.yoneticiler", "Yöneticiler"),
        icon: "shield-checkmark-outline",
        data: admins,
      },
      {
        key: "members",
        title: i18nText("autoI18n.uyeler", "Üyeler"),
        icon: "people-outline",
        data: regularMembers,
      },
    ].filter((section) => section.data.length > 0);
  }, [members, groupData]);

  const availableFriends = useMemo(
    () => friends.filter((friend) => !memberIds.includes(friend.uid)),
    [friends, memberIds]
  );

  const runMemberAction = useCallback(
    (member, action, successText, failureText, logLabel) => {
      // Firestore writes do not resolve while offline. Do not turn the whole
      // member row into an endless loader in that case.
      if (busyUid) return;
      if (!getIsOnline()) {
        toast.warning(
          i18nText("autoI18n.cevrimdisi", "Çevrimdışı"),
          i18nText(
            "autoI18n.kutuphane_cevrimdisi",
            "İnternet bağlantısı yok. Bağlanınca tekrar dene.",
          ),
        );
        return;
      }

      setBusyUid(member.uid);
      // Intentionally do not return this promise: the confirm callback stays
      // synchronous and this sheet owns the complete operation lifecycle.
      void waitForGroupMemberAction(action)
        .then(() => toast.success(successText))
        .catch((error) => {
          console.error(`${logLabel}:`, error);
          if (error?.code === "timeout") {
            toast.warning(
              i18nText(
                "autoI18n.islem_tamamlanamadi",
                "İşlem tamamlanamadı",
              ),
              i18nText("autoI18n.tekrar_dene", "Tekrar dene"),
            );
            return;
          }
          toast.error(
            i18nText("autoI18n.hata", "Hata"),
            failureText,
          );
        })
        .finally(() => {
          setBusyUid((current) => (current === member.uid ? null : current));
        });
    },
    [busyUid],
  );

  const addMember = useCallback(
    async (friend) => {
      if (busyUid) return;
      // Üye tavanı (utils/groupLimits.js); kural da aynı sayıyı uygular.
      if (groupSlotsLeft(memberIds.length) === 0) {
        toast.warning(
          i18nText("autoI18n.grup_dolu", "Grup dolu"),
          i18nText("autoI18n.grup_uye_siniri", "Bir grupta en fazla {{n}} kişi olabilir", {
            n: MAX_GROUP_MEMBERS,
          }),
        );
        return;
      }
      setBusyUid(friend.uid);
      try {
        await addGroupMember(groupId, friend);
        toast.success(
          i18nText("autoI18n.uye_eklendi", "Üye eklendi"),
          i18nText("autoI18n.gruba_eklendi", "{{name}} gruba eklendi", {
            name: friend.displayName,
          })
        );
      } catch (error) {
        console.error("addGroupMember:", error);
        toast.error(
          i18nText("autoI18n.hata", "Hata"),
          i18nText("autoI18n.uye_eklenemedi", "Üye eklenemedi")
        );
      } finally {
        setBusyUid(null);
      }
    },
    [busyUid, groupId, memberIds.length]
  );

  const confirmRemove = useCallback(
    (member) => {
      setConfirm({
        title: i18nText("autoI18n.uyeyi_cikar", "Üyeyi çıkar"),
        message: i18nText(
          "autoI18n.uyeyi_cikar_onay",
          "{{name}} gruptan çıkarılsın mı?",
          { name: member.displayName }
        ),
        actions: [
          {
            key: "remove",
            label: i18nText("autoI18n.cikar", "Çıkar"),
            icon: "person-remove-outline",
            tone: "danger",
            onPress: () => {
              setConfirm(null);
              runMemberAction(
                member,
                () => removeGroupMember(groupId, member.uid),
                i18nText("autoI18n.uye_cikarildi", "Üye çıkarıldı"),
                i18nText("autoI18n.uye_cikarilamadi", "Üye çıkarılamadı"),
                "removeGroupMember",
              );
            },
          },
          {
            key: "cancel",
            label: i18nText("autoI18n.iptal", "İptal"),
            onPress: () => setConfirm(null),
          },
        ],
      });
    },
    [groupId, runMemberAction]
  );

  const changeAvatar = useCallback(
    async (avatarIndex) => {
      if (savingAvatar || avatarIndex === groupData?.avatarIndex) return;
      setSavingAvatar(true);
      try {
        await updateGroupAvatar(groupId, avatarIndex);
        toast.success(
          i18nText("autoI18n.avatar_guncellendi", "Avatar güncellendi")
        );
      } catch (error) {
        console.error("updateGroupAvatar:", error);
        toast.error(
          i18nText("autoI18n.hata", "Hata"),
          i18nText("autoI18n.avatar_guncellenemedi", "Avatar güncellenemedi")
        );
      } finally {
        setSavingAvatar(false);
      }
    },
    [savingAvatar, groupData?.avatarIndex, groupId]
  );

  const toggleAdminsOnly = useCallback(
    async (enabled) => {
      if (savingSendPolicy || !canManage) return;
      if (!getIsOnline()) {
        toast.warning(
          i18nText("autoI18n.cevrimdisi", "Çevrimdışı"),
          i18nText(
            "autoI18n.kutuphane_cevrimdisi",
            "İnternet bağlantısı yok. Bağlanınca tekrar dene.",
          ),
        );
        return;
      }
      setSavingSendPolicy(true);
      try {
        await waitForGroupMemberAction(() => setGroupAdminsOnlyMessages(groupId, enabled));
        toast.success(
          enabled
            ? i18nText("autoI18n.yalniz_yoneticiler_acildi", "Artık yalnız yöneticiler mesaj gönderebilir")
            : i18nText("autoI18n.herkes_yazabilir_acildi", "Artık tüm üyeler mesaj gönderebilir"),
        );
      } catch (error) {
        console.error("setGroupAdminsOnlyMessages:", error);
        toast.error(
          i18nText("autoI18n.hata", "Hata"),
          i18nText("autoI18n.ayar_kaydedilemedi", "Ayar kaydedilemedi"),
        );
      } finally {
        setSavingSendPolicy(false);
      }
    },
    [savingSendPolicy, canManage, groupId],
  );

  const confirmAdminRole = useCallback(
    (member, shouldBeAdmin) => {
      const title = shouldBeAdmin
        ? i18nText("autoI18n.yonetici_yap", "Yönetici yap")
        : i18nText("autoI18n.yoneticilikten_al", "Yöneticilikten al");
      const message = shouldBeAdmin
        ? i18nText("autoI18n.yonetici_yap_onay", "{{name}} grup yöneticisi yapılsın mı?", { name: member.displayName })
        : i18nText("autoI18n.yoneticilikten_al_onay", "{{name}} yöneticilikten alınsın mı?", { name: member.displayName });
      setConfirm({
        title,
        message,
        actions: [
          {
            key: "confirm",
            label: i18nText("autoI18n.onayla", "Onayla"),
            icon: shouldBeAdmin ? "shield-checkmark-outline" : "shield-outline",
            tone: "primary",
            onPress: () => {
              setConfirm(null);
              runMemberAction(
                member,
                () => setGroupAdminRole(groupId, member.uid, shouldBeAdmin),
                shouldBeAdmin
                  ? i18nText("autoI18n.yonetici_yapildi", "Yönetici atandı")
                  : i18nText("autoI18n.yoneticilik_kaldirildi", "Yöneticilik kaldırıldı"),
                i18nText("autoI18n.rol_guncellenemedi", "Rol güncellenemedi"),
                "setGroupAdminRole",
              );
            },
          },
          {
            key: "cancel",
            label: i18nText("autoI18n.iptal", "İptal"),
            onPress: () => setConfirm(null),
          },
        ],
      });
    },
    [groupId, runMemberAction],
  );

  const renderRow = ({ item, adding = false }) => {
    const itemRole = groupRoleOf(groupData, item.uid);
    const itemIsCreator = itemRole === "creator";
    const itemIsAdmin = itemRole === "admin";
    const canToggleAdmin = isCreator && item.uid !== currentUid && !itemIsCreator;
    const canRemove =
      item.uid !== currentUid &&
      !itemIsCreator &&
      (isCreator || (isAdmin && !itemIsAdmin));
    const loading = busyUid === item.uid;
    return (
      <TouchableOpacity
        activeOpacity={item.uid === currentUid ? 1 : 0.75}
        disabled={item.uid === currentUid}
        onPress={() => onOpenProfile?.(item.uid, item.displayName)}
        style={[
          styles.memberRow,
          { borderBottomColor: theme.border || "rgba(255,255,255,0.08)" },
        ]}
      >
        <UserAvatar
          avatarIndex={item.avatarIndex}
          photoURL={item.photoURL}
          isCustomPhoto
          size={43}
        />
        <View style={styles.memberCopy}>
          <View style={styles.nameRow}>
            <Text
              numberOfLines={1}
              style={[
                styles.memberName,
                { color: theme.text?.primary || "#fff" },
              ]}
            >
              {item.displayName}
            </Text>
            {itemIsCreator && (
              <View
                style={[
                  styles.roleBadge,
                  { backgroundColor: (groupData?.color || ACCENT) + "22" },
                ]}
              >
                <Ionicons name="diamond" size={9} color={groupData?.color || ACCENT} />
                <Text
                  style={[
                    styles.roleText,
                    { color: groupData?.color || ACCENT },
                  ]}
                >
                  {i18nText("autoI18n.kurucu", "Kurucu")}
                </Text>
              </View>
            )}
            {itemIsAdmin && (
              <View style={[styles.roleBadge, styles.adminBadge]}>
                <Ionicons name="shield-checkmark" size={9} color="#72D6A0" />
                <Text style={[styles.roleText, { color: "#72D6A0" }]}>
                  {i18nText("autoI18n.yonetici", "Yönetici")}
                </Text>
              </View>
            )}
          </View>
          <Text
            numberOfLines={1}
            style={[styles.memberMeta, { color: theme.text?.muted || "#888" }]}
          >
            {adding
              ? item.username
                ? `@${item.username}`
                : i18nText("autoI18n.arkadas", "Arkadaş")
              : item.username
                ? `@${item.username}`
                : item.uid === currentUid
                  ? i18nText("autoI18n.bu_sensin", "Bu sensin")
                  : i18nText("autoI18n.profili_gor", "Profili gör")}
          </Text>
        </View>
        {loading ? (
          <LensLoader size="small" color={groupData?.color || ACCENT} />
        ) : adding ? (
          <TouchableOpacity
            onPress={(event) => {
              event.stopPropagation();
              addMember(item);
            }}
            style={[
              styles.smallAction,
              { backgroundColor: (groupData?.color || ACCENT) + "22" },
            ]}
          >
            <Ionicons
              name="person-add"
              size={16}
              color={groupData?.color || ACCENT}
            />
            <Text
              style={[
                styles.smallActionText,
                { color: groupData?.color || ACCENT },
              ]}
            >
              {i18nText("autoI18n.ekle", "Ekle")}
            </Text>
          </TouchableOpacity>
        ) : canToggleAdmin || canRemove ? (
          <View style={styles.memberActions}>
            {canToggleAdmin && (
              <TouchableOpacity
                onPress={(event) => {
                  event.stopPropagation();
                  confirmAdminRole(item, !itemIsAdmin);
                }}
                style={[
                  styles.iconAction,
                  { backgroundColor: itemIsAdmin ? "rgba(255,193,7,0.12)" : "rgba(114,214,160,0.12)" },
                ]}
                accessibilityLabel={
                  itemIsAdmin
                    ? i18nText("autoI18n.yoneticilikten_al", "Yöneticilikten al")
                    : i18nText("autoI18n.yonetici_yap", "Yönetici yap")
                }
              >
                <Ionicons
                  name={itemIsAdmin ? "shield-outline" : "shield-checkmark-outline"}
                  size={18}
                  color={itemIsAdmin ? "#FFD166" : "#72D6A0"}
                />
              </TouchableOpacity>
            )}
            {canRemove && (
              <TouchableOpacity
                onPress={(event) => {
                  event.stopPropagation();
                  confirmRemove(item);
                }}
                style={[styles.iconAction, { backgroundColor: DANGER + "18" }]}
              >
                <Ionicons name="person-remove-outline" size={18} color={DANGER} />
              </TouchableOpacity>
            )}
          </View>
        ) : item.uid !== currentUid ? (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.text?.muted || "#666"}
          />
        ) : null}
      </TouchableOpacity>
    );
  };

  const emptyText =
    tab === "add"
      ? i18nText(
          "autoI18n.eklenebilecek_arkadas_yok",
          "Eklenebilecek başka arkadaşın yok"
        )
      : i18nText("autoI18n.uye_bulunamadi", "Üye bulunamadı");

  return (
    <BottomSheetModal
      visible={visible}
      onClose={handleClose}
      intensity={35}
      dimColor="rgba(0,0,0,0.42)"
      overlay={
        confirm ? (
          <LeaveSheet
            theme={theme}
            accent={groupData?.color || ACCENT}
            title={confirm.title}
            message={confirm.message}
            actions={confirm.actions}
            onDismiss={() => setConfirm(null)}
          />
        ) : null
      }
      sheetStyle={[
        styles.sheet,
        {
          backgroundColor: theme.secondary || "#171727",
          borderColor: theme.border || "rgba(255,255,255,0.08)",
          paddingBottom: Math.max(insets.bottom, 18),
        },
      ]}
    >
          <View
            style={[
              styles.handle,
              { backgroundColor: theme.border || "rgba(255,255,255,0.18)" },
            ]}
          />
          <View style={styles.sheetHeader}>
            <TouchableOpacity
              activeOpacity={canManage ? 0.75 : 1}
              disabled={!canManage}
              onPress={() => setTab("avatar")}
              style={styles.groupAvatarButton}
              accessibilityLabel={
                canManage
                  ? i18nText(
                      "autoI18n.grup_avatarini_degistir",
                      "Grup avatarını değiştir"
                    )
                  : undefined
              }
            >
              <GroupAvatar
                avatarIndex={groupData?.avatarIndex}
                color={groupData?.color || ACCENT}
                size={46}
                borderRadius={16}
                iconSize={32}
              />
              {canManage && (
                <View
                  style={[
                    styles.avatarEditBadge,
                    { backgroundColor: groupData?.color || ACCENT },
                  ]}
                >
                  <Ionicons name="pencil" size={8} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.groupCopy}>
              <Text
                numberOfLines={1}
                style={[
                  styles.groupName,
                  { color: theme.text?.primary || "#fff" },
                ]}
              >
                {groupData?.name || i18nText("autoI18n.grup", "Grup")}
              </Text>
              <Text
                style={[
                  styles.groupCount,
                  { color: theme.text?.muted || "#888" },
                ]}
              >
                {i18nText("autoI18n.n_uye", "{{n}} üye", {
                  n: memberIds.length,
                })}
              </Text>
            </View>
            <GlassCloseButton
              size={36}
              fallbackRadius={18}
              iconSize={21}
              color={theme.text?.primary || "#fff"}
              backgroundColor={theme.primary || "rgba(255,255,255,0.06)"}
              onPress={onClose}
            />
          </View>

          {onOpenClub ? (
            <GlassTouchable
              onPress={onOpenClub}
              testID="group-open-club"
              accessibilityRole="button"
              style={[
                styles.clubRow,
                {
                  backgroundColor: theme.primary || "rgba(0,0,0,0.18)",
                  borderColor: theme.border || "rgba(255,255,255,0.08)",
                },
              ]}
            >
              <View style={styles.clubIcon}>
                <Ionicons name="ticket" size={17} color="#E8A33D" />
              </View>
              <View style={styles.groupCopy}>
                <Text style={[styles.clubTitle, { color: theme.text?.primary || "#fff" }]}>
                  {i18nText("autoI18n.film_kulubu", "Film Kulübü")}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.groupCount, { color: theme.text?.muted || "#888" }]}
                >
                  {groupData?.club?.enabled
                    ? i18nText("autoI18n.film_kulubu_acik", "Oylama, izleme turu ve tartışma")
                    : i18nText("autoI18n.film_kulubu_kapali", "Grubunla düzenli film gecesi kur")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.text?.muted || "#888"} />
            </GlassTouchable>
          ) : null}

          {/* Mesaj gönderme izni: kurucu/yönetici açıp kapatır; sıradan üye
              yalnız açıkken bilgi satırını görür. */}
          {canManage || adminsOnly ? (
            <View
              testID="group-send-policy"
              style={[
                styles.clubRow,
                {
                  backgroundColor: theme.primary || "rgba(0,0,0,0.18)",
                  borderColor: theme.border || "rgba(255,255,255,0.08)",
                },
              ]}
            >
              <View style={[styles.clubIcon, styles.sendPolicyIcon]}>
                <Ionicons name="megaphone-outline" size={17} color="#72D6A0" />
              </View>
              <View style={styles.groupCopy}>
                <Text style={[styles.clubTitle, { color: theme.text?.primary || "#fff" }]}>
                  {i18nText(
                    "autoI18n.yalniz_yoneticiler_mesaj_gonderebilir",
                    "Yalnız yöneticiler mesaj gönderebilir",
                  )}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[styles.groupCount, { color: theme.text?.muted || "#888" }]}
                >
                  {canManage
                    ? i18nText(
                        "autoI18n.yalniz_yoneticiler_aciklama_yonetici",
                        "Açıkken üyeler okur, oy verir; yalnız kurucu ve yöneticiler yazar",
                      )
                    : i18nText(
                        "autoI18n.yalniz_yoneticiler_yazabilir_aciklama",
                        "Bu grupta yalnız kurucu ve yöneticiler mesaj gönderebilir",
                      )}
                </Text>
              </View>
              {canManage ? (
                savingSendPolicy ? (
                  <LensLoader size="small" color={groupData?.color || ACCENT} />
                ) : (
                  <SwitchToggle
                    value={adminsOnly}
                    onValueChange={toggleAdminsOnly}
                    size={36}
                  />
                )
              ) : (
                <Ionicons name="lock-closed" size={16} color={theme.text?.muted || "#888"} />
              )}
            </View>
          ) : null}

          <View
            style={[
              styles.tabs,
              (onOpenClub || canManage || adminsOnly) && styles.tabsAfterClub,
              { backgroundColor: theme.primary || "rgba(0,0,0,0.18)" },
            ]}
          >
            <GlassTouchable
              onPress={() => setTab("members")}
              style={[
                styles.tab,
                tab === "members" && {
                  backgroundColor: groupData?.color || ACCENT,
                },
              ]}
            >
              <Ionicons
                name="people-outline"
                size={16}
                color={tab === "members" ? "#fff" : theme.text?.muted || "#888"}
              />
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      tab === "members" ? "#fff" : theme.text?.muted || "#888",
                  },
                ]}
              >
                {i18nText("autoI18n.uyeler", "Üyeler")}
              </Text>
            </GlassTouchable>
            {canManage && (
              <>
                <GlassTouchable
                  onPress={() => setTab("add")}
                  style={[
                    styles.tab,
                    tab === "add" && {
                      backgroundColor: groupData?.color || ACCENT,
                    },
                  ]}
                >
                  <Ionicons
                    name="person-add-outline"
                    size={15}
                    color={tab === "add" ? "#fff" : theme.text?.muted || "#888"}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color:
                          tab === "add" ? "#fff" : theme.text?.muted || "#888",
                      },
                    ]}
                  >
                    {i18nText("autoI18n.kisi_ekle", "Kişi ekle")}
                  </Text>
                </GlassTouchable>
                <GlassTouchable
                  onPress={() => setTab("avatar")}
                  style={[
                    styles.tab,
                    tab === "avatar" && {
                      backgroundColor: groupData?.color || ACCENT,
                    },
                  ]}
                >
                  <Ionicons
                    name="images-outline"
                    size={15}
                    color={
                      tab === "avatar" ? "#fff" : theme.text?.muted || "#888"
                    }
                  />
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color:
                          tab === "avatar"
                            ? "#fff"
                            : theme.text?.muted || "#888",
                      },
                    ]}
                  >
                    {i18nText("autoI18n.avatar", "Avatar")}
                  </Text>
                </GlassTouchable>
              </>
            )}
          </View>

          {tab === "avatar" ? (
            <View style={styles.avatarGridWrap}>
              <GroupAvatarGrid
                selectedIndex={groupData?.avatarIndex}
                color={groupData?.color || ACCENT}
                onSelect={changeAvatar}
                style={styles.avatarGrid}
              />
              {savingAvatar && (
                <View style={styles.avatarSavingOverlay}>
                  <LensLoader color={groupData?.color || ACCENT} />
                </View>
              )}
            </View>
          ) : tab === "add" && loadingFriends ? (
            <View style={styles.loadingBox}>
              <LensLoader color={groupData?.color || ACCENT} />
            </View>
          ) : tab === "members" ? (
            <SectionList
              sections={memberSections}
              keyExtractor={(item) => item.uid}
              renderItem={(props) => renderRow({ ...props, adding: false })}
              renderSectionHeader={({ section }) => (
                <View
                  style={[
                    styles.sectionHeader,
                    { backgroundColor: theme.secondary || "#171727" },
                  ]}
                >
                  <Ionicons
                    name={section.icon}
                    size={13}
                    color={section.key === "creator" ? groupData?.color || ACCENT : theme.text?.muted || "#888"}
                  />
                  <Text
                    style={[
                      styles.sectionHeaderText,
                      { color: section.key === "creator" ? groupData?.color || ACCENT : theme.text?.muted || "#888" },
                    ]}
                  >
                    {section.title}
                  </Text>
                  <View style={styles.sectionCount}>
                    <Text style={styles.sectionCountText}>{section.data.length}</Text>
                  </View>
                </View>
              )}
              stickySectionHeadersEnabled={false}
              style={styles.list}
              contentContainerStyle={!members.length ? styles.emptyList : undefined}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="people-outline" size={34} color={theme.text?.muted || "#555"} />
                  <Text style={[styles.emptyText, { color: theme.text?.muted || "#888" }]}>{emptyText}</Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={availableFriends}
              keyExtractor={(item) => item.uid}
              renderItem={(props) => renderRow({ ...props, adding: true })}
              style={styles.list}
              contentContainerStyle={
                !availableFriends.length ? styles.emptyList : undefined
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons
                    name="person-add-outline"
                    size={34}
                    color={theme.text?.muted || "#555"}
                  />
                  <Text
                    style={[
                      styles.emptyText,
                      { color: theme.text?.muted || "#888" },
                    ]}
                  >
                    {emptyText}
                  </Text>
                </View>
              }
            />
          )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "82%",
    minHeight: 430,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 14,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  groupAvatarButton: { position: "relative" },
  avatarEditBadge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  groupCopy: { flex: 1 },
  groupName: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  groupCount: { fontSize: 12, marginTop: 2, fontWeight: "600" },
  tabs: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 14,
    marginTop: 18,
    marginBottom: 8,
  },
  tabsAfterClub: { marginTop: 12 },
  tab: {
    flex: 1,
    minHeight: 38,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tabText: { fontSize: 13, fontWeight: "700" },
  avatarGridWrap: { height: 310, position: "relative" },
  avatarGrid: { flex: 1 },
  avatarSavingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,10,18,0.48)",
    borderRadius: 16,
  },
  list: { minHeight: 250 },
  clubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
  },
  clubIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(232,163,61,0.16)",
  },
  clubTitle: { fontSize: 15, fontWeight: "800" },
  sendPolicyIcon: { backgroundColor: "rgba(114,214,160,0.14)" },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 68,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberCopy: { flex: 1, marginLeft: 11, marginRight: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  memberName: { flexShrink: 1, fontSize: 14.5, fontWeight: "700" },
  memberMeta: { fontSize: 11.5, fontWeight: "500", marginTop: 3 },
  roleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  adminBadge: { backgroundColor: "rgba(114,214,160,0.12)" },
  roleText: { fontSize: 9.5, fontWeight: "800" },
  memberActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  smallAction: {
    height: 34,
    borderRadius: 11,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  smallActionText: { fontSize: 12, fontWeight: "800" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    paddingTop: 7,
  },
  sectionHeaderText: { fontSize: 10.5, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
  sectionCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)" },
  sectionCountText: { color: "rgba(255,255,255,0.45)", fontSize: 9.5, fontWeight: "800" },
  loadingBox: {
    minHeight: 250,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyList: { flexGrow: 1 },
  empty: {
    flex: 1,
    minHeight: 230,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 30,
  },
  emptyText: { fontSize: 13, fontWeight: "600", textAlign: "center" },
});
