// components/lists/ListManageSheet.js
//
// Özel bir listeye UZUN BASINCA açılan yönetim sayfası — profil rayı
// (ProfileLists) ve Listelerim ekranı (ListsViewScreen) ORTAK kullanır.
//
// Üç adım TEK modal içinde: menü → yeniden adlandır / sil. Ayrı modallar
// kullanılmıyor, çünkü biri kapanırken diğerini açmak iOS'ta sunum yarışına
// giriyor ve arada bir kare boş ekran görünüyordu; tek pencerede adım
// değiştirmek hem güvenli hem akıcı.
//
// Öntanımlı dört liste (favorites/watchList/watchedMovies/watchedTv) buraya
// hiç gelmez: adları bir alan adı değil, çeviriden gelen etiket.
//
// Yazma işleri burada toplanır (iki ekranda kopya akış = iki farklı davranış):
//   • ad değişimi  → renameCustomRootList (kök dokümanda anahtar taşıma)
//   • görünürlük   → moveListVisibility (Users/{uid}.listVisible bayrağı)
//   • silme        → FieldPath ile alan silme (noktalı adlar için ZORUNLU)

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { deleteField, doc, FieldPath, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import ModalBlurBackdrop from "../common/ModalBlurBackdrop";
import useSheetTransition from "@hooks/useSheetTransition";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { i18nText } from "@utils/i18nText";
import { describeRenameTarget, MAX_LIST_NAME_LENGTH } from "@utils/listShare";
import { getListAccent, getListIcon } from "@utils/listAppearance";
import { renameCustomRootList } from "@services/listItemsService";
import { moveListVisibility } from "@services/userService";

const DANGER = "#ef4444";

/**
 * @param {object} props
 * @param {string|null} props.listName   Açık liste; null/boş → sayfa kapalı.
 * @param {number} [props.itemCount]     Alt bilgi ve silme uyarısı için.
 * @param {string[]} [props.existingNames] Ad çakışmasını CANLI göstermek için.
 * @param {string} props.uid
 * @param {() => void} props.onClose
 * @param {(from: string, to: string) => void} [props.onRenamed]
 * @param {(name: string) => void} [props.onDeleted]
 */
export default function ListManageSheet({
  listName,
  itemCount = 0,
  existingNames = [],
  uid,
  onClose,
  onRenamed,
  onDeleted,
}) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [step, setStep] = useState("actions");
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);

  const visible = !!listName;

  // Kapanışta `listName` ANINDA null oluyor (ve sayaç 0'a düşüyor) ama sayfa
  // çıkış animasyonu boyunca 260 ms daha ekranda kalıyor. Başlık "0 içerik"e
  // dönmesin diye açıkken son değerler burada tutulur.
  const [shown, setShown] = useState({ name: null, count: 0 });
  useEffect(() => {
    if (listName) setShown({ name: listName, count: itemCount });
  }, [listName, itemCount]);

  const accent = getListAccent(shown.name);

  // Her açılış menü adımından başlar, ad kutusu güncel adla dolar.
  useEffect(() => {
    if (!listName) return;
    setStep("actions");
    setRenameValue(listName);
  }, [listName]);

  // Blur yerinde solar, sayfa kayar (bkz. hooks/useSheetTransition.js).
  const sheet = useSheetTransition(visible);

  const target = describeRenameTarget(shown.name, renameValue, existingNames);
  const hint = {
    empty: i18nText("autoI18n.liste_adi_bos_olamaz", "Liste adı boş olamaz"),
    taken: i18nText(
      "autoI18n.bu_isimde_bir_liste_zaten_var",
      "Bu isimde bir liste zaten var",
    ),
    reserved: i18nText("autoI18n.bu_ad_kullanilamaz", "Bu ad kullanılamaz"),
    tooLong: i18nText("autoI18n.liste_adi_cok_uzun", "Liste adı çok uzun"),
  }[target.status];

  const close = () => {
    if (busy) return;
    Keyboard.dismiss();
    onClose?.();
  };

  const submitRename = async () => {
    if (!uid || !listName || busy) return;
    if (target.status === "unchanged") {
      close();
      return;
    }
    if (!target.canSave) {
      Toast.show({ type: "warning", text1: hint });
      return;
    }
    const from = listName;
    const to = target.name;
    setBusy(true);
    try {
      const result = await renameCustomRootList(uid, from, to);
      if (result === "taken") {
        Toast.show({
          type: "warning",
          text1: i18nText(
            "autoI18n.bu_isimde_bir_liste_zaten_var",
            "Bu isimde bir liste zaten var",
          ),
        });
        return;
      }
      if (result === "missing") {
        Toast.show({
          type: "error",
          text1: i18nText("autoI18n.liste_bulunamadi", "Liste bulunamadı"),
        });
        return;
      }
      // Bayrak taşıma ikincil: hata verirse ad değişimi yine de başarılı.
      await moveListVisibility(uid, from, to).catch((e) => {
        if (__DEV__) console.warn("moveListVisibility:", e?.message);
      });
      Toast.show({
        type: "success",
        text1: i18nText("autoI18n.liste_adi_degistirildi", "Liste adı değiştirildi"),
      });
      onRenamed?.(from, to);
      Keyboard.dismiss();
      onClose?.();
    } catch (e) {
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.islem_basarisiz", "İşlem başarısız"),
      });
    } finally {
      setBusy(false);
    }
  };

  const submitDelete = async () => {
    if (!uid || !listName || busy) return;
    setBusy(true);
    try {
      // FieldPath: liste adında nokta varsa updateDoc'un string anahtarı
      // nested path'e çözülür ve yanlış alan silinirdi.
      await updateDoc(doc(db, "Lists", uid), new FieldPath(listName), deleteField());
      Toast.show({
        type: "success",
        text1: i18nText("autoI18n.liste_silindi", "Liste silindi"),
      });
      onDeleted?.(listName);
      onClose?.();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.silme_hatasi", "Silme hatası: ") + error,
      });
    } finally {
      setBusy(false);
    }
  };

  const StepHeader = ({ title }) => (
    <View style={styles.stepHeader}>
      <TouchableOpacity
        onPress={() => !busy && setStep("actions")}
        hitSlop={10}
        style={[styles.backChip, { backgroundColor: theme.secondary, borderColor: theme.border }]}
      >
        <Ionicons name="chevron-back" size={17} color={theme.text.primary} />
      </TouchableOpacity>
      <Text style={[styles.title, { color: theme.text.primary }]}>{title}</Text>
    </View>
  );

  return (
    <Modal
      animationType="none"
      transparent
      visible={sheet.mounted}
      onRequestClose={close}
      statusBarTranslucent
    >
      {/* onLayout: yeniden adlandırma kutusu açıkken sayfa klavyenin üstüne
          çıkar; ölçüm pencerenin kendisi küçüldüyse çift kaymayı engeller. */}
      <View style={styles.overlay} onLayout={sheet.onOverlayLayout}>
        {/* Blur YERİNDE solar — sayfayla birlikte kaymaz. */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: sheet.backdropOpacity }]}
        >
          <ModalBlurBackdrop intensity={30} />
        </Animated.View>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={close}
        />
        <Animated.View
          onLayout={sheet.onSheetLayout}
          style={[
            styles.sheet,
            { backgroundColor: theme.primary, borderColor: theme.border },
            sheet.sheetStyle,
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          {step === "actions" ? (
            <>
              <View style={styles.listHeader}>
                <View
                  style={[
                    styles.listIcon,
                    { backgroundColor: accent + "20", borderColor: accent + "40" },
                  ]}
                >
                  <Ionicons name={getListIcon(shown.name)} size={20} color={accent} />
                </View>
                <View style={styles.listHeaderText}>
                  <Text
                    numberOfLines={1}
                    style={[styles.title, { color: theme.text.primary }]}
                  >
                    {shown.name}
                  </Text>
                  <Text style={[styles.subtitle, { color: theme.text.muted }]}>
                    {i18nText("autoI18n.n_icerik", "{{n}} içerik", { n: shown.count })}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setStep("rename")}
                style={[
                  styles.row,
                  { backgroundColor: theme.secondary, borderColor: theme.border },
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: accent + "1f" }]}>
                  <Ionicons name="create-outline" size={17} color={accent} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: theme.text.primary }]}>
                    {i18nText("autoI18n.yeniden_adlandir", "Yeniden adlandır")}
                  </Text>
                  <Text style={[styles.rowHint, { color: theme.text.muted }]}>
                    {i18nText(
                      "autoI18n.liste_icerigi_aynen_kalir",
                      "Listenin içeriği aynen kalır.",
                    )}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setStep("delete")}
                style={[
                  styles.row,
                  { backgroundColor: theme.secondary, borderColor: DANGER + "35" },
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: DANGER + "1f" }]}>
                  <Ionicons name="trash-outline" size={17} color={DANGER} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: DANGER }]}>
                    {i18nText("autoI18n.listeyi_sil", "Listeyi Sil")}
                  </Text>
                  <Text style={[styles.rowHint, { color: theme.text.muted }]}>
                    {i18nText("autoI18n.bu_islem_geri_alinamaz", "Bu işlem geri alınamaz.")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={close}
                style={[styles.ghostBtn, { backgroundColor: theme.secondary }]}
              >
                <Text style={[styles.btnText, { color: theme.text.secondary }]}>
                  {t.cancel}
                </Text>
              </TouchableOpacity>
            </>
          ) : step === "rename" ? (
            <>
              <StepHeader
                title={i18nText("autoI18n.yeniden_adlandir", "Yeniden adlandır")}
              />
              <View
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: theme.secondary,
                    borderColor: hint ? DANGER + "80" : accent + "66",
                  },
                ]}
              >
                <Ionicons
                  name="pricetag-outline"
                  size={17}
                  color={hint ? DANGER : accent}
                />
                <TextInput
                  style={[styles.input, { color: theme.text.primary }]}
                  value={renameValue}
                  onChangeText={setRenameValue}
                  placeholder={i18nText("autoI18n.yeni_liste_adi", "Yeni liste adı...")}
                  placeholderTextColor={theme.text.muted}
                  maxLength={MAX_LIST_NAME_LENGTH}
                  autoFocus
                  selectTextOnFocus
                  returnKeyType="done"
                  onSubmitEditing={submitRename}
                />
                {renameValue.length > 0 ? (
                  <TouchableOpacity onPress={() => setRenameValue("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={17} color={theme.text.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.hintRow}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.hint,
                    { color: hint ? DANGER : theme.text.muted },
                  ]}
                >
                  {hint ||
                    i18nText(
                      "autoI18n.liste_icerigi_aynen_kalir",
                      "Listenin içeriği aynen kalır.",
                    )}
                </Text>
                <Text style={[styles.counter, { color: theme.text.muted }]}>
                  {renameValue.trim().length}/{MAX_LIST_NAME_LENGTH}
                </Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: theme.secondary }]}
                  onPress={close}
                  disabled={busy}
                >
                  <Text style={[styles.btnText, { color: theme.text.secondary }]}>
                    {t.cancel}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.btn,
                    {
                      backgroundColor: accent,
                      opacity: target.canSave && !busy ? 1 : 0.45,
                    },
                  ]}
                  onPress={submitRename}
                  disabled={!target.canSave || busy}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={16} color="#000" />
                      <Text style={[styles.btnText, { color: "#000" }]}>
                        {i18nText("autoI18n.kaydet", "Kaydet")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <StepHeader title={i18nText("autoI18n.listeyi_sil", "Listeyi Sil")} />
              <LinearGradient
                colors={["#f87171", DANGER]}
                style={styles.dangerIcon}
              >
                <Ionicons name="trash-outline" size={24} color="#fff" />
              </LinearGradient>
              <Text
                style={[styles.confirmTitle, { color: theme.text.primary }]}
                numberOfLines={2}
              >
                {i18nText("autoI18n.liste_silinsin_mi", '"{{name}}" silinsin mi?', {
                  name: shown.name,
                })}
              </Text>
              <Text style={[styles.confirmDesc, { color: theme.text.muted }]}>
                {i18nText(
                  "autoI18n.n_icerik_listeden_kaldirilacak",
                  "{{n}} içerik bu listeden kaldırılacak. Bu işlem geri alınamaz.",
                  { n: shown.count },
                )}
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: theme.secondary }]}
                  onPress={close}
                  disabled={busy}
                >
                  <Text style={[styles.btnText, { color: theme.text.secondary }]}>
                    {t.cancel}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.btn,
                    { backgroundColor: DANGER, opacity: busy ? 0.6 : 1 },
                  ]}
                  onPress={submitDelete}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={15} color="#fff" />
                      <Text style={[styles.btnText, { color: "#fff" }]}>
                        {i18nText("autoI18n.sil", "Sil")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 10,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    marginBottom: 8,
    opacity: 0.6,
  },

  // ── Menü adımı ────────────────────────────────────────────────────────────
  listHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  listIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listHeaderText: { flex: 1 },
  title: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  subtitle: { fontSize: 12.5, fontWeight: "600", marginTop: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 14.5, fontWeight: "700" },
  rowHint: { fontSize: 11.5, marginTop: 2 },
  ghostBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 2,
  },

  // ── Yeniden adlandırma adımı ──────────────────────────────────────────────
  stepHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  backChip: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 13,
    paddingVertical: 4,
  },
  input: { flex: 1, fontSize: 15, fontWeight: "600", paddingVertical: 10 },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 4,
  },
  hint: { flex: 1, fontSize: 12 },
  counter: { fontSize: 11, fontWeight: "700" },

  // ── Silme adımı ───────────────────────────────────────────────────────────
  dangerIcon: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  confirmDesc: { fontSize: 13, textAlign: "center", lineHeight: 19 },

  // ── Ortak ─────────────────────────────────────────────────────────────────
  actions: { flexDirection: "row", gap: 10, marginTop: 6 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnText: { fontSize: 14, fontWeight: "800" },
});
