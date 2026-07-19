import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useUserProfile } from "../context/UserProfileContext";
import { useSharedLists } from "../context/SharedListsContext";
import {
  getSharedListItem,
  addItemToSharedList,
  removeItemFromSharedList,
  canAddToSharedList,
  canRemoveFromSharedList,
} from "../services/sharedListsService";
import { i18nText } from "../utils/i18nText";

const ACCENT = "#38bdf8";

/**
 * Detay ekranı "Diğer Listeler" modalındaki ORTAK LİSTELER bölümü.
 * ListView (film) ve ListViewTv (dizi) ortak kullanır.
 *
 * Props:
 *  - sharedItem : { id, type:'movie'|'tv', name, imagePath, minutes, genres }
 *  - visible    : modal açık mı — üyelik durumu modal açılınca çekilir
 *                 (global items aboneliği yerine hedefli getDoc'lar)
 */
export default function SharedListsSection({ sharedItem, visible }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { displayName, avatarIndex } = useUserProfile();
  const { sharedLists } = useSharedLists();

  // listId → item verisi | null (bu içerik listede mi + kim eklemiş)
  const [states, setStates] = useState({});
  const [busy, setBusy] = useState({});

  useEffect(() => {
    if (!visible || sharedItem?.id == null || sharedLists.length === 0) return;
    let cancelled = false;
    (async () => {
      const next = {};
      await Promise.all(
        sharedLists.map(async (l) => {
          try {
            next[l.id] = await getSharedListItem(
              l.id,
              sharedItem.type,
              sharedItem.id,
            );
          } catch {
            next[l.id] = null;
          }
        }),
      );
      if (!cancelled) setStates(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sharedItem?.id, sharedItem?.type, sharedLists]);

  if (!sharedItem || sharedLists.length === 0) return null;

  const uid = user?.uid;

  const toggle = async (list) => {
    if (busy[list.id]) return;
    const existing = states[list.id];

    if (existing) {
      if (!canRemoveFromSharedList(list, uid, existing)) {
        Toast.show({
          type: "warning",
          text1: i18nText(
            "autoI18n.silme_yetkin_yok",
            "Bu öğeyi silme yetkin yok",
          ),
        });
        return;
      }
      setBusy((b) => ({ ...b, [list.id]: true }));
      setStates((s) => ({ ...s, [list.id]: null })); // optimistik
      try {
        await removeItemFromSharedList(list.id, sharedItem.type, sharedItem.id);
      } catch (e) {
        setStates((s) => ({ ...s, [list.id]: existing })); // geri al
        Toast.show({ type: "error", text1: e.message });
      } finally {
        setBusy((b) => ({ ...b, [list.id]: false }));
      }
      return;
    }

    if (!canAddToSharedList(list, uid)) {
      Toast.show({
        type: "warning",
        text1: i18nText(
          "autoI18n.ekleme_yetkin_yok",
          "Bu listeye ekleme yetkin yok",
        ),
      });
      return;
    }
    const optimistic = { addedBy: uid, addedByName: displayName };
    setBusy((b) => ({ ...b, [list.id]: true }));
    setStates((s) => ({ ...s, [list.id]: optimistic }));
    try {
      await addItemToSharedList({
        listId: list.id,
        user: { uid, displayName, avatarIndex },
        item: sharedItem,
      });
    } catch (e) {
      setStates((s) => ({ ...s, [list.id]: null }));
      Toast.show({ type: "error", text1: e.message });
    } finally {
      setBusy((b) => ({ ...b, [list.id]: false }));
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Ionicons name="people" size={12} color={ACCENT} />
        <Text style={[styles.headerText, { color: theme.text.muted }]}>
          {i18nText("autoI18n.ortak_listeler", "ORTAK LİSTELER")}
        </Text>
      </View>
      <View style={styles.grid}>
        {sharedLists.map((list) => {
          const inList = !!states[list.id];
          const locked = !inList && !canAddToSharedList(list, uid);
          const green = theme.colors?.green ?? "#29b864";
          return (
            <TouchableOpacity
              key={list.id}
              activeOpacity={0.85}
              onPress={() => toggle(list)}
              style={[
                styles.card,
                {
                  backgroundColor: inList ? green + "15" : theme.primary,
                  borderColor: inList ? green + "60" : theme.border,
                  opacity: locked ? 0.55 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.cardIcon,
                  {
                    backgroundColor: inList ? green + "25" : ACCENT + "18",
                  },
                ]}
              >
                <Ionicons
                  name={
                    inList
                      ? "checkmark-circle"
                      : locked
                        ? "lock-closed"
                        : "people"
                  }
                  size={22}
                  color={inList ? green : locked ? theme.text.muted : ACCENT}
                />
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={2}
                style={[
                  styles.cardLabel,
                  { color: inList ? green : theme.text.secondary },
                ]}
              >
                {list.name}
              </Text>
              {/* Listedeyse kim eklemiş */}
              {inList && (
                <Text
                  numberOfLines={1}
                  style={[styles.addedBy, { color: theme.text.muted }]}
                >
                  {states[list.id]?.addedBy === uid
                    ? i18nText("autoI18n.sen_ekledin", "sen ekledin")
                    : states[list.id]?.addedByName || ""}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 4, marginBottom: 4 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  headerText: { fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  card: {
    width: "31%",
    flexGrow: 1,
    maxWidth: "32%",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    gap: 6,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  addedBy: { fontSize: 9, fontWeight: "600" },
});
