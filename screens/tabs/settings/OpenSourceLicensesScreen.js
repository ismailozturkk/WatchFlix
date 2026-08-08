// screens/tabs/settings/OpenSourceLicensesScreen.js
//
// Ayarlar > Açık Kaynak Lisansları. MIT/BSD/ISC gibi lisanslar, lisans metninin
// ve telif bildiriminin dağıtılan üründe yer almasını zorunlu kılar; Apache-2.0
// ayrıca NOTICE dosyasının iletilmesini ister. Bu ekran o yükümlülüğü karşılar.
//
// Veri kaynağı: assets/ossLicenses.json — `npm run licenses` ile node_modules'tan
// üretilir, elle düzenlenmez. Bağımlılık ekleyip/güncelledikten sonra yeniden
// üretilmelidir.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  InteractionManager,
  Linking,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import BottomSheetModal from "@components/common/BottomSheetModal";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import { SettingsSubScreen, buildUiColors } from "./settingsUi";

const ROW_HEIGHT = 60;

/** Lisans ailesine göre rozet rengi — SPDX ifadesindeki ilk kimliğe bakar. */
function licenseTone(license, C) {
  const id = String(license || "").toUpperCase();
  if (id.includes("APACHE")) return { fg: C.amber, bg: C.iconAmber };
  if (id.includes("BSD")) return { fg: C.purple, bg: C.iconPurple };
  if (id.includes("ISC")) return { fg: C.green, bg: C.iconGreen };
  if (id.includes("MIT")) return { fg: C.blue, bg: C.iconBlue };
  return { fg: C.muted, bg: C.borderMuted };
}

export default function OpenSourceLicensesScreen() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const insets = useSafeAreaInsets();
  const isTr = language === "tr";

  // 850 KB'lık lisans verisi uygulama açılışında ayrıştırılmasın diye geçiş
  // animasyonu bittikten sonra tembel yüklenir.
  const [db, setDb] = useState(null);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setDb(require("@assets/ossLicenses.json"));
    });
    return () => task.cancel();
  }, []);

  const [query, setQuery] = useState("");
  const [licenseFilter, setLicenseFilter] = useState(null);
  const [selected, setSelected] = useState(null);
  const listRef = useRef(null);

  const packages = db?.packages || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && !licenseFilter) return packages;
    return packages.filter((p) => {
      if (licenseFilter && p.license !== licenseFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        String(p.license).toLowerCase().includes(q) ||
        String(p.publisher || "").toLowerCase().includes(q)
      );
    });
  }, [packages, query, licenseFilter]);

  // En çok kullanılan ilk 6 lisans türü hızlı filtre çipi olarak gösterilir.
  const topLicenses = useMemo(
    () => Object.entries(db?.summary || {}).slice(0, 6),
    [db],
  );

  const scrollTop = () =>
    listRef.current?.scrollToOffset?.({ offset: 0, animated: false });

  const title = i18nText("autoI18n.acikKaynakLisanslari", "Açık Kaynak Lisansları");

  if (!db) {
    return (
      <SettingsSubScreen title={title}>
        <View style={s.loading}>
          <ActivityIndicator size="small" color={C.accent} />
        </View>
      </SettingsSubScreen>
    );
  }

  const header = (
    <View>
      <View style={[s.intro, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={s.introTop}>
          <View style={[s.introIcon, { backgroundColor: C.iconTeal }]}>
            <AppIcon family="Ionicons" name="heart-outline" size={16} color={C.accent} />
          </View>
          <Text allowFontScaling={false} style={[s.introTitle, { color: C.text }]}>
            {isTr ? "Bu uygulama açık kaynakla çalışıyor" : "Built on open source"}
          </Text>
        </View>
        <Text allowFontScaling={false} style={[s.introBody, { color: C.muted }]}>
          {isTr
            ? "Seelogd, aşağıdaki açık kaynak kütüphaneleri kullanır. Her birinin lisans metni ve telif bildirimi lisans koşulları gereği burada yer alır. Bir paketin tam metnini görmek için üzerine dokunun."
            : "Seelogd uses the open source libraries listed below. Each license text and copyright notice is reproduced here as required by their terms. Tap a package to read its full license."}
        </Text>
        <Text allowFontScaling={false} style={[s.introMeta, { color: C.muted }]}>
          {isTr
            ? `${db.packageCount} paket · ${db.generatedAt} tarihinde oluşturuldu`
            : `${db.packageCount} packages · generated ${db.generatedAt}`}
        </Text>
      </View>

      <View style={[s.search, { backgroundColor: C.card, borderColor: C.border }]}>
        <AppIcon family="Ionicons" name="search" size={15} color={C.muted} />
        <TextInput
          value={query}
          maxLength={80}
          onChangeText={(v) => {
            setQuery(v);
            scrollTop();
          }}
          placeholder={isTr ? "Paket ara" : "Search packages"}
          placeholderTextColor={C.muted}
          allowFontScaling={false}
          autoCapitalize="none"
          autoCorrect={false}
          style={[s.searchInput, { color: C.text }]}
        />
        {query ? (
          <TouchableOpacity
            onPress={() => {
              setQuery("");
              scrollTop();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppIcon family="Ionicons" name="close-circle" size={16} color={C.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
        keyboardShouldPersistTaps="handled"
      >
        <Chip
          C={C}
          label={isTr ? "Tümü" : "All"}
          count={db.packageCount}
          active={!licenseFilter}
          onPress={() => {
            setLicenseFilter(null);
            scrollTop();
          }}
        />
        {topLicenses.map(([id, count]) => (
          <Chip
            key={id}
            C={C}
            label={id}
            count={count}
            active={licenseFilter === id}
            onPress={() => {
              setLicenseFilter(licenseFilter === id ? null : id);
              scrollTop();
            }}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SettingsSubScreen title={title} scrollable={false}>
      <FlatList
        ref={listRef}
        data={filtered}
        keyExtractor={(item) => `${item.name}@${item.version}`}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text allowFontScaling={false} style={[s.empty, { color: C.muted }]}>
            {isTr ? "Eşleşen paket yok." : "No matching packages."}
          </Text>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={14}
        windowSize={9}
        removeClippedSubviews
        renderItem={({ item }) => (
          <PackageRow C={C} item={item} onPress={() => setSelected(item)} />
        )}
      />

      <LicenseDetailModal
        C={C}
        isTr={isTr}
        db={db}
        item={selected}
        onClose={() => setSelected(null)}
      />
    </SettingsSubScreen>
  );
}

function Chip({ C, label, count, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        s.chip,
        {
          backgroundColor: active ? C.accentDim : C.card,
          borderColor: active ? C.accent : C.border,
        },
      ]}
    >
      <Text
        allowFontScaling={false}
        style={[s.chipText, { color: active ? C.accentStrong : C.muted }]}
      >
        {label} · {count}
      </Text>
    </TouchableOpacity>
  );
}

const PackageRow = React.memo(function PackageRow({ C, item, onPress }) {
  const tone = licenseTone(item.license, C);
  return (
    <TouchableOpacity
      activeOpacity={0.65}
      onPress={onPress}
      style={[s.row, { backgroundColor: C.card, borderColor: C.border }]}
    >
      <View style={s.rowTexts}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[s.rowTitle, { color: C.text }]}
        >
          {item.name}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[s.rowSub, { color: C.muted }]}
        >
          v{item.version}
          {item.publisher ? ` · ${item.publisher}` : ""}
        </Text>
      </View>
      <View style={[s.badge, { backgroundColor: tone.bg }]}>
        <Text allowFontScaling={false} style={[s.badgeText, { color: tone.fg }]}>
          {item.license}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

function LicenseDetailModal({ C, isTr, db, item, onClose }) {
  const insets = useSafeAreaInsets();
  if (!item) return null;

  const licenseText = item.textId ? db.texts[item.textId] : null;
  const noticeText = item.noticeId ? db.texts[item.noticeId] : null;
  const repo = item.repository;

  return (
    <BottomSheetModal
      visible
      onClose={onClose}
      intensity={35}
      dimColor="rgba(0,0,0,0.32)"
      sheetStyle={[
        s.sheet,
        { backgroundColor: C.card, borderColor: C.border, paddingBottom: insets.bottom + 12 },
      ]}
    >
          <View style={[s.handle, { backgroundColor: C.handle }]} />
          <View style={s.sheetHead}>
            <View style={{ flex: 1 }}>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[s.sheetTitle, { color: C.text }]}
              >
                {item.name}
              </Text>
              <Text allowFontScaling={false} style={[s.sheetSub, { color: C.muted }]}>
                v{item.version} · {item.license}
                {item.publisher ? ` · ${item.publisher}` : ""}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[s.close, { backgroundColor: C.closeBg }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppIcon family="Ionicons" name="close" size={16} color={C.text} />
            </TouchableOpacity>
          </View>

          {repo ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(repo).catch(() => {})}
              activeOpacity={0.7}
              style={[s.repo, { borderColor: C.borderMuted }]}
            >
              <AppIcon family="Ionicons" name="link-outline" size={14} color={C.accent} />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[s.repoText, { color: C.accent }]}
              >
                {repo}
              </Text>
            </TouchableOpacity>
          ) : null}

          <ScrollView
            style={s.textScroll}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {noticeText ? (
              <>
                <Text allowFontScaling={false} style={[s.blockLabel, { color: C.muted }]}>
                  NOTICE
                </Text>
                <Text allowFontScaling={false} style={[s.licenseText, { color: C.text }]}>
                  {noticeText}
                </Text>
                <Text allowFontScaling={false} style={[s.blockLabel, { color: C.muted }]}>
                  {isTr ? "LİSANS" : "LICENSE"}
                </Text>
              </>
            ) : null}
            {licenseText ? (
              <Text allowFontScaling={false} style={[s.licenseText, { color: C.text }]}>
                {licenseText}
              </Text>
            ) : (
              <Text allowFontScaling={false} style={[s.licenseText, { color: C.muted }]}>
                {isTr
                  ? `Bu paket lisans metnini kendi dağıtımına eklememiş. Beyan edilen lisans: ${item.license}. Tam metin için paketin kaynak deposuna bakın.`
                  : `This package ships no license file. Declared license: ${item.license}. See the package repository for the full text.`}
              </Text>
            )}
          </ScrollView>
    </BottomSheetModal>
  );
}

const s = StyleSheet.create({
  loading: { paddingTop: 60, alignItems: "center" },
  intro: { borderRadius: 18, borderWidth: 1, padding: 16, marginTop: 6 },
  introTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  introIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  introTitle: { flex: 1, fontSize: 14, fontWeight: "600" },
  introBody: { fontSize: 12, lineHeight: 18 },
  introMeta: { fontSize: 10.5, marginTop: 10 },

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
    marginTop: 12,
  },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },

  chips: { gap: 8, paddingVertical: 12, paddingRight: 4 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 11, fontWeight: "600" },

  row: {
    minHeight: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  rowTexts: { flex: 1 },
  rowTitle: { fontSize: 13.5, fontWeight: "500" },
  rowSub: { fontSize: 11, marginTop: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  empty: { fontSize: 12, textAlign: "center", paddingVertical: 30 },

  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    maxHeight: "85%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetTitle: { fontSize: 16, fontWeight: "700" },
  sheetSub: { fontSize: 11, marginTop: 3 },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  repo: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, borderBottomWidth: 1 },
  repoText: { flex: 1, fontSize: 11.5 },
  textScroll: { marginTop: 14 },
  blockLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1.1, marginBottom: 8, marginTop: 6 },
  licenseText: { fontSize: 11.5, lineHeight: 18 },
});
