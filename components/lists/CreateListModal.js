// components/lists/CreateListModal.js
//
// Yeni özel liste oluşturma — profil rayı (ProfileLists) ve Listelerim
// ekranı (ListsViewScreen) ORTAK kullanabilir. Ad doğrulaması
// describeRenameTarget ile paylaşılır: `currentName` boş geçildiğinde
// "unchanged" durumu hiç tetiklenmez, geri kalan kurallar (boş/çok
// uzun/rezerve/dolu) yeniden adlandırmayla BİREBİR aynı kalır.
//
// Yazma: ListsViewScreen.addNewList ile aynı iki adım — Lists/{uid}'e
// `{ [name]: [] }` (merge) ve Users/{uid}.listVisible'a `{ [name]: true }`.
// Çakışma kontrolü submit anında TAZE bir getDoc ile yapılır; `existingNames`
// prop'u yalnız canlı ipucu (hint) için, kesin doğruluk kaynağı değil.

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import BottomSheetModal from "@components/common/BottomSheetModal";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { db } from "../../firebase";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import { describeRenameTarget, MAX_LIST_NAME_LENGTH } from "@utils/listShare";
import { getListAccent, getListIcon } from "@utils/listAppearance";

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onClose
 * @param {string[]} [props.existingNames] Ad çakışmasını CANLI göstermek için.
 * @param {string} props.uid
 * @param {(name: string) => void} [props.onCreated]
 */
export default function CreateListModal({
  visible,
  onClose,
  existingNames = [],
  uid,
  onCreated,
}) {
  const { theme } = useTheme();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const accent = getListAccent(null, theme.secondary);

  useEffect(() => {
    if (visible) setName("");
  }, [visible]);

  const target = describeRenameTarget("", name, existingNames);
  const hint = {
    empty: null, // boşken hata gösterilmez, girdi bekleniyor.
    taken: i18nText(
      "autoI18n.bu_isimde_bir_liste_zaten_var",
      "Bu isimde bir liste zaten var",
    ),
    reserved: i18nText("autoI18n.bu_ad_kullanilamaz", "Bu ad kullanılamaz"),
    tooLong: i18nText("autoI18n.liste_adi_cok_uzun", "Liste adı çok uzun"),
  }[target.status];

  const close = () => {
    if (saving) return;
    onClose?.();
  };

  const handleSubmit = async () => {
    if (!uid || saving || !target.canSave) return;
    const finalName = target.name;
    setSaving(true);
    try {
      const listsRef = doc(db, "Lists", uid);
      const listsSnap = await getDoc(listsRef);
      if (listsSnap.exists() && listsSnap.data()[finalName]) {
        Toast.show({
          type: "warning",
          text1: i18nText(
            "autoI18n.bu_isimde_bir_liste_zaten_var",
            "Bu isimde bir liste zaten var",
          ),
        });
        return;
      }
      const batch = writeBatch(db);
      batch.set(listsRef, { [finalName]: [] }, { merge: true });
      batch.set(
        doc(db, "Users", uid),
        { listVisible: { [finalName]: true } },
        { merge: true },
      );
      await batch.commit();
      Toast.show({
        type: "success",
        text1: i18nText("autoI18n.liste_olusturuldu", "Liste oluşturuldu"),
      });
      onCreated?.(finalName);
      onClose?.();
    } catch (e) {
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.hata_olustu", "Hata oluştu"),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={close}
      sheetStyle={[
        styles.sheet,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      <View style={styles.headerRow}>
        <View style={[styles.headerIcon, { backgroundColor: accent + "20" }]}>
          <Ionicons name={getListIcon(null)} size={18} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            {i18nText("autoI18n.liste_olustur", "Liste Oluştur")}
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]}>
            {i18nText(
              "autoI18n.yeni_ozel_liste_aciklama",
              "İstediğin filmleri/dizileri toplayacağın yeni bir liste",
            )}
          </Text>
        </View>
        <TouchableOpacity
          onPress={close}
          style={[styles.closeBtn, { backgroundColor: theme.primary }]}
        >
          <Ionicons name="close" size={16} color={theme.text.muted} />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: theme.primary,
            borderColor: hint ? "#ef4444" + "80" : accent + "66",
          },
        ]}
      >
        <Ionicons
          name="pricetag-outline"
          size={16}
          color={hint ? "#ef4444" : accent}
        />
        <TextInput
          style={[styles.input, { color: theme.text.primary }]}
          placeholder={i18nText("autoI18n.liste_adi", "Liste adı...")}
          placeholderTextColor={theme.text.muted}
          value={name}
          onChangeText={setName}
          maxLength={MAX_LIST_NAME_LENGTH}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
        {name.length > 0 ? (
          <TouchableOpacity onPress={() => setName("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={theme.text.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {hint ? (
        <Text style={[styles.hint, { color: "#ef4444" }]}>{hint}</Text>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleSubmit}
        disabled={!target.canSave || saving}
        style={[
          styles.submitBtn,
          { backgroundColor: accent, opacity: target.canSave && !saving ? 1 : 0.45 },
        ]}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#000" />
        ) : (
          <Ionicons name="add" size={17} color="#000" />
        )}
        <Text style={styles.submitText}>
          {i18nText("autoI18n.listeyi_olustur", "Listeyi Oluştur")}
        </Text>
      </TouchableOpacity>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 17, fontWeight: "800" },
  subtitle: { fontSize: 11, marginTop: 2 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 11, fontSize: 14 },
  hint: { fontSize: 11.5, marginTop: 8, marginLeft: 4 },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 16,
  },
  submitText: { color: "#000", fontSize: 14, fontWeight: "800" },
});
