import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Image,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AdaptiveBlurView from "@components/common/AdaptiveBlurView";
import Ionicons from "@expo/vector-icons/Ionicons";
import Feather from "@expo/vector-icons/Feather";
import Toast from "react-native-toast-message";
import * as Haptics from "@services/hapticsService";
import BackButton from "../../components/BackButton";
import PosterImage from "@components/PosterImage";
import SwitchToggle from "../../components/SwitchToggle";
import appAlert from "../../components/AppAlert";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { getAvatarSource } from "@utils/avatars";
import { i18nText } from "@utils/i18nText";
import CreateSharedListModal from "../../components/modals/CreateSharedListModal";
import {
  subscribeToSharedList,
  subscribeToSharedListItems,
  removeItemFromSharedList,
  removeSharedListMember,
  updateSharedListPermission,
  leaveSharedList,
  deleteSharedList,
  isSharedListOwner,
  canRemoveFromSharedList,
} from "@services/sharedListsService";

const { width, height } = Dimensions.get("window");
const ACCENT = "#38bdf8"; // ListsViewScreen'deki ortak liste vurgusuyla aynı
const GRID_SIDE_PADDING = 12;
const GRID_COLUMN_GAP = 8;
const POSTER_W = (width - GRID_SIDE_PADDING * 2 - GRID_COLUMN_GAP * 2) / 3;
const POSTER_H = POSTER_W * 1.52;

// Diziyi 3'lük satırlara böl (ListsScreen'deki elle grid deseni — Android'de
// dinamik numColumns çökmesine karşı).
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export default function SharedListScreen({ route, navigation }) {
  const { listId } = route.params || {};
  const { theme } = useTheme();
  const { user } = useAuth();
  const uid = user?.uid;

  const [list, setList] = useState(undefined); // undefined=yükleniyor, null=yok/erişim yok
  const [items, setItems] = useState([]);
  const [membersVisible, setMembersVisible] = useState(false);
  const [addMemberVisible, setAddMemberVisible] = useState(false);

  useEffect(() => {
    const unsubList = subscribeToSharedList(listId, setList);
    const unsubItems = subscribeToSharedListItems(listId, setItems);
    return () => {
      unsubList();
      unsubItems();
    };
  }, [listId]);

  const isOwner = isSharedListOwner(list, uid);

  // Üyeler: kurucu en üstte, kalanlar eklenme sırasına göre.
  const memberRows = useMemo(() => {
    if (!list?.members) return [];
    return Object.entries(list.members)
      .map(([mUid, m]) => ({ uid: mUid, ...m }))
      .sort((a, b) => {
        if (a.uid === list.ownerId) return -1;
        if (b.uid === list.ownerId) return 1;
        return (a.addedAt || 0) - (b.addedAt || 0);
      });
  }, [list]);

  const gridRows = useMemo(() => chunk(items, 3), [items]);

  // ── Eylemler ────────────────────────────────────────────────────────────────

  const confirmRemoveItem = (item) => {
    if (!canRemoveFromSharedList(list, uid, item)) {
      Toast.show({
        type: "warning",
        text1: i18nText(
          "autoI18n.silme_yetkin_yok",
          "Bu öğeyi silme yetkin yok",
        ),
      });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    appAlert(
      i18nText("autoI18n.listeden_kaldir", "Listeden kaldır"),
      i18nText(
        "autoI18n.listeden_kaldir_onay",
        '"{{name}}" listeden kaldırılsın mı?',
        { name: item.name },
      ),
      [
        { text: i18nText("autoI18n.iptal", "İptal"), style: "cancel" },
        {
          text: i18nText("autoI18n.kaldir", "Kaldır"),
          style: "destructive",
          onPress: () =>
            removeItemFromSharedList(listId, item.type, item.id).catch((e) =>
              Toast.show({ type: "error", text1: e.message }),
            ),
        },
      ],
    );
  };

  const confirmRemoveMember = (member) => {
    appAlert(
      i18nText("autoI18n.uyeyi_cikar", "Üyeyi çıkar"),
      i18nText(
        "autoI18n.uyeyi_listeden_cikar_onay",
        "{{name}} listeden çıkarılsın mı?",
        { name: member.name || member.username },
      ),
      [
        { text: i18nText("autoI18n.iptal", "İptal"), style: "cancel" },
        {
          text: i18nText("autoI18n.cikar", "Çıkar"),
          style: "destructive",
          onPress: () =>
            removeSharedListMember(listId, member.uid).catch((e) =>
              Toast.show({ type: "error", text1: e.message }),
            ),
        },
      ],
    );
  };

  const confirmLeave = () => {
    appAlert(
      i18nText("autoI18n.listeden_ayril", "Listeden ayrıl"),
      i18nText(
        "autoI18n.listeden_ayril_onay",
        "Bu ortak listeden ayrılmak istiyor musun?",
      ),
      [
        { text: i18nText("autoI18n.iptal", "İptal"), style: "cancel" },
        {
          text: i18nText("autoI18n.ayril", "Ayrıl"),
          style: "destructive",
          onPress: async () => {
            try {
              await leaveSharedList(listId, uid);
              navigation.goBack();
            } catch (e) {
              Toast.show({ type: "error", text1: e.message });
            }
          },
        },
      ],
    );
  };

  const confirmDeleteList = () => {
    appAlert(
      i18nText("autoI18n.listeyi_sil", "Listeyi Sil"),
      i18nText(
        "autoI18n.ortak_liste_sil_onay",
        '"{{name}}" ortak listesi tüm üyeler için silinecek. Emin misin?',
        { name: list?.name },
      ),
      [
        { text: i18nText("autoI18n.iptal", "İptal"), style: "cancel" },
        {
          text: i18nText("autoI18n.sil", "Sil"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSharedList(listId);
              Toast.show({
                type: "success",
                text1: i18nText("autoI18n.liste_silindi", "Liste silindi"),
              });
              navigation.goBack();
            } catch (e) {
              Toast.show({ type: "error", text1: e.message });
            }
          },
        },
      ],
    );
  };

  const togglePermission = (member, key) => {
    updateSharedListPermission(listId, member.uid, {
      [key]: !member[key],
    }).catch((e) => Toast.show({ type: "error", text1: e.message }));
  };

  // ── Durumlar ───────────────────────────────────────────────────────────────

  if (list === undefined) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          styles.center,
          { backgroundColor: theme.primary },
        ]}
      >
        <ActivityIndicator size="large" color={ACCENT} />
      </SafeAreaView>
    );
  }

  if (list === null) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          styles.center,
          { backgroundColor: theme.primary },
        ]}
      >
        <Ionicons name="lock-closed-outline" size={40} color={theme.text.muted} />
        <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
          {i18nText(
            "autoI18n.liste_bulunamadi_veya_erisim_yok",
            "Liste bulunamadı veya erişimin kaldırıldı.",
          )}
        </Text>
        <BackButton />
      </SafeAreaView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const renderPoster = (item) => (
    <TouchableOpacity
      key={item.key}
      activeOpacity={0.85}
      onPress={() =>
        navigation.navigate(
          item.type === "movie" ? "MovieDetails" : "TvShowsDetails",
          { id: item.id },
        )
      }
      onLongPress={() => confirmRemoveItem(item)}
      style={styles.posterItem}
    >
      <View style={styles.posterWrap}>
        <PosterImage
          path={item.imagePath}
          type={item.type}
          size={200}
          style={styles.poster}
        />
        {/* Tür rozeti */}
        <Text
          style={[
            styles.typeBadge,
            {
              backgroundColor:
                item.type === "movie"
                  ? theme.notesColor?.blueBackground ?? "#138df040"
                  : theme.notesColor?.greenBackground ?? "#29b86440",
            },
          ]}
        >
          {item.type === "movie"
            ? i18nText("autoI18n.film", "Film")
            : i18nText("autoI18n.dizi", "Dizi")}
        </Text>
        {/* Ekleyen kullanıcı çipi */}
        <View style={styles.addedByChip}>
          <Image
            source={getAvatarSource(item.addedByAvatarIndex)}
            style={styles.addedByAvatar}
          />
          <Text numberOfLines={1} style={styles.addedByName}>
            {item.addedBy === uid
              ? i18nText("autoI18n.sen", "Sen")
              : item.addedByName ||
                i18nText("autoI18n.uye", "Üye")}
          </Text>
        </View>
      </View>
      <Text
        numberOfLines={1}
        style={[styles.posterTitle, { color: theme.text.secondary }]}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      {/* ── Başlık ── */}
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.headerTopRow}>
            <Ionicons name="people" size={13} color={ACCENT} />
            <Text style={[styles.headerSub, { color: ACCENT }]}>
              {i18nText("autoI18n.ortak_liste", "ORTAK LİSTE")}
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={[styles.headerTitle, { color: theme.text.primary }]}
          >
            {list.name}
          </Text>
        </View>

        {/* Üyeler butonu — avatar destesi + sayı */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setMembersVisible(true)}
          style={[
            styles.membersBtn,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <View style={styles.avatarStack}>
            {memberRows.slice(0, 3).map((m, i) => (
              <Image
                key={m.uid}
                source={getAvatarSource(m.avatarIndex)}
                style={[
                  styles.stackAvatar,
                  { marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.membersBtnText, { color: theme.text.primary }]}>
            {memberRows.length}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── İçerik ── */}
      {items.length === 0 ? (
        <View style={[styles.center, { flex: 1 }]}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.secondary }]}>
            <Ionicons name="film-outline" size={30} color={theme.text.muted} />
          </View>
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            {i18nText("autoI18n.bu_liste_bos", "Bu liste boş.")}
          </Text>
          <Text style={[styles.emptyHint, { color: theme.text.muted }]}>
            {i18nText(
              "autoI18n.ortak_liste_bos_ipucu",
              "Film/dizi detayındaki \"Diğerleri\" menüsünden ekleyebilirsiniz",
            )}
          </Text>
        </View>
      ) : (
        <FlatList
          data={gridRows}
          keyExtractor={(row, i) => `${row[0]?.key ?? "r"}-${i}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: GRID_SIDE_PADDING, paddingBottom: 40 }}
          initialNumToRender={8}
          windowSize={7}
          renderItem={({ item: row }) => (
            <View style={styles.gridRow}>
              {row.map(renderPoster)}
              {row.length < 3
                ? Array.from({ length: 3 - row.length }).map((_, i) => (
                    <View key={`sp-${i}`} style={styles.posterItem} />
                  ))
                : null}
            </View>
          )}
        />
      )}

      {/* ── Üyeler modalı ── */}
      <Modal
        transparent
        visible={membersVisible}
        animationType="slide"
        onRequestClose={() => setMembersVisible(false)}
      >
        <View style={styles.overlay}>
          <AdaptiveBlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setMembersVisible(false)}
          />
          <View
            style={[
              styles.sheet,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: theme.border }]} />

            <View style={styles.sheetHeaderRow}>
              <View style={[styles.sheetHeaderIcon, { backgroundColor: ACCENT + "20" }]}>
                <Ionicons name="people" size={18} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: theme.text.primary }]}>
                  {i18nText("autoI18n.uyeler", "Üyeler")}
                </Text>
                <Text style={[styles.sheetSub, { color: theme.text.muted }]}>
                  {isOwner
                    ? i18nText(
                        "autoI18n.uye_yetki_aciklama",
                        "Ekleme ve silme yetkilerini yönetebilirsin",
                      )
                    : i18nText(
                        "autoI18n.uye_listesi",
                        "Bu listeyi paylaşan kişiler",
                      )}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setMembersVisible(false)}
                style={[styles.closeBtn, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="close" size={16} color={theme.text.muted} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={memberRows}
              keyExtractor={(m) => m.uid}
              style={{ maxHeight: 360 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
              renderItem={({ item: m }) => {
                const memberIsOwner = m.uid === list.ownerId;
                return (
                  <View
                    style={[
                      styles.memberRow,
                      { backgroundColor: theme.primary, borderColor: theme.border },
                    ]}
                  >
                    <Image
                      source={getAvatarSource(m.avatarIndex)}
                      style={styles.memberAvatar}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text
                          numberOfLines={1}
                          style={[styles.memberName, { color: theme.text.primary }]}
                        >
                          {m.uid === uid
                            ? i18nText("autoI18n.sen", "Sen")
                            : m.name || m.username}
                        </Text>
                        {memberIsOwner && (
                          <View style={[styles.ownerChip, { backgroundColor: "#fbbf2422" }]}>
                            <Ionicons name="key" size={9} color="#fbbf24" />
                            <Text style={styles.ownerChipText}>
                              {i18nText("autoI18n.kurucu", "Kurucu")}
                            </Text>
                          </View>
                        )}
                      </View>
                      {!!m.username && (
                        <Text
                          numberOfLines={1}
                          style={[styles.memberUsername, { color: theme.text.muted }]}
                        >
                          @{m.username}
                        </Text>
                      )}
                      {/* Yetki satırı */}
                      {!memberIsOwner &&
                        (isOwner ? (
                          <View style={styles.permRow}>
                            <View style={styles.permItem}>
                              <Text style={[styles.permLabel, { color: theme.text.muted }]}>
                                {i18nText("autoI18n.ekleme", "Ekleme")}
                              </Text>
                              <SwitchToggle
                                value={!!m.canAdd}
                                onValueChange={() => togglePermission(m, "canAdd")}
                                size={20}
                                onColor={theme.colors?.green ?? "#29b864"}
                                offColor={theme.border || "#555"}
                              />
                            </View>
                            <View style={styles.permItem}>
                              <Text style={[styles.permLabel, { color: theme.text.muted }]}>
                                {i18nText("autoI18n.silme", "Silme")}
                              </Text>
                              <SwitchToggle
                                value={!!m.canRemove}
                                onValueChange={() => togglePermission(m, "canRemove")}
                                size={20}
                                onColor={theme.colors?.red ?? "#e33"}
                                offColor={theme.border || "#555"}
                              />
                            </View>
                          </View>
                        ) : (
                          <View style={styles.permRow}>
                            <View
                              style={[
                                styles.permBadge,
                                {
                                  backgroundColor: m.canAdd
                                    ? (theme.colors?.green ?? "#29b864") + "18"
                                    : theme.secondary,
                                },
                              ]}
                            >
                              <Ionicons
                                name={m.canAdd ? "add-circle" : "eye"}
                                size={10}
                                color={
                                  m.canAdd
                                    ? theme.colors?.green ?? "#29b864"
                                    : theme.text.muted
                                }
                              />
                              <Text
                                style={[
                                  styles.permBadgeText,
                                  {
                                    color: m.canAdd
                                      ? theme.colors?.green ?? "#29b864"
                                      : theme.text.muted,
                                  },
                                ]}
                              >
                                {m.canAdd
                                  ? i18nText("autoI18n.ekleyebilir", "Ekleyebilir")
                                  : i18nText("autoI18n.sadece_gorur", "Sadece görür")}
                              </Text>
                            </View>
                          </View>
                        ))}
                    </View>

                    {/* Kurucu: üye çıkar */}
                    {isOwner && !memberIsOwner && (
                      <TouchableOpacity
                        onPress={() => confirmRemoveMember(m)}
                        hitSlop={8}
                        style={[styles.removeMemberBtn, { backgroundColor: "#f8717118" }]}
                      >
                        <Feather name="user-minus" size={15} color="#f87171" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />

            {/* Alt eylemler */}
            <View style={styles.sheetActions}>
              {isOwner ? (
                <>
                  <TouchableOpacity
                    style={[styles.sheetActionBtn, { backgroundColor: "#f8717115", borderColor: "#f8717144" }]}
                    onPress={() => {
                      setMembersVisible(false);
                      confirmDeleteList();
                    }}
                  >
                    <Ionicons name="trash-outline" size={15} color="#f87171" />
                    <Text style={[styles.sheetActionText, { color: "#f87171" }]}>
                      {i18nText("autoI18n.listeyi_sil", "Listeyi Sil")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sheetActionBtn, { backgroundColor: ACCENT }]}
                    onPress={() => {
                      setMembersVisible(false);
                      setAddMemberVisible(true);
                    }}
                  >
                    <Ionicons name="person-add" size={15} color="#000" />
                    <Text style={[styles.sheetActionText, { color: "#000" }]}>
                      {i18nText("autoI18n.uye_ekle", "Üye Ekle")}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.sheetActionBtn, { backgroundColor: "#f8717115", borderColor: "#f8717144" }]}
                  onPress={() => {
                    setMembersVisible(false);
                    confirmLeave();
                  }}
                >
                  <Ionicons name="exit-outline" size={15} color="#f87171" />
                  <Text style={[styles.sheetActionText, { color: "#f87171" }]}>
                    {i18nText("autoI18n.listeden_ayril", "Listeden Ayrıl")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Üye ekleme (kurucu) ── */}
      <CreateSharedListModal
        visible={addMemberVisible}
        onClose={() => setAddMemberVisible(false)}
        addToList={{ id: listId, memberIds: list.memberIds || [] }}
      />

      <BackButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center", gap: 10 },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 3,
  },
  headerSub: { fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  headerTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  membersBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 2,
  },
  avatarStack: { flexDirection: "row", alignItems: "center" },
  stackAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.4)",
  },
  membersBtnText: { fontSize: 13, fontWeight: "800" },

  // ── Grid ──
  gridRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: GRID_COLUMN_GAP,
    marginBottom: 14,
  },
  posterItem: { width: POSTER_W },
  posterWrap: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 12,
    overflow: "hidden",
  },
  poster: { width: "100%", height: "100%", borderRadius: 12 },
  typeBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  addedByChip: {
    position: "absolute",
    left: 5,
    right: 5,
    bottom: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 5,
  },
  addedByAvatar: { width: 16, height: 16, borderRadius: 8 },
  addedByName: {
    flex: 1,
    color: "#fff",
    fontSize: 9.5,
    fontWeight: "700",
  },
  posterTitle: { fontSize: 11, fontWeight: "600", marginTop: 5 },

  // ── Boş durum ──
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  emptyHint: {
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 40,
  },

  // ── Üyeler modalı ──
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 30,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    marginBottom: 14,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  sheetHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetTitle: { fontSize: 17, fontWeight: "800" },
  sheetSub: { fontSize: 11, marginTop: 2 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  memberAvatar: { width: 38, height: 38, borderRadius: 19 },
  memberName: { fontSize: 13, fontWeight: "700", flexShrink: 1 },
  memberUsername: { fontSize: 11, marginTop: 1 },
  ownerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  ownerChipText: { color: "#fbbf24", fontSize: 9, fontWeight: "800" },
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 6,
  },
  permItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  permLabel: { fontSize: 11, fontWeight: "600" },
  permBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  permBadgeText: { fontSize: 10, fontWeight: "700" },
  removeMemberBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  sheetActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  sheetActionText: { fontSize: 13, fontWeight: "800" },
});
