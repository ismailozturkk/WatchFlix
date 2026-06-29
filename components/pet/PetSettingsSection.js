import React, { memo, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import AppIcon from "@components/AppIcon";
import SwitchToggle from "@components/SwitchToggle";
import SpritePet from "@components/pet/SpritePet";
import { usePet, PET_SIZES } from "@context/PetContext";
import { i18nText } from "@utils/i18nText";

// Kart ölçüleri (windowing / getItemLayout için sabit).
const PREVIEW_SIZE = 72; // sprite kare yüksekliği — küçük = daha hafif decode
const ITEM_W = 96;
const ITEM_SEP = 12;
const STRIDE = ITEM_W + ITEM_SEP;
const LIST_PAD = 14;

// byte → "1.8 MB" gibi okunur metin.
const formatBytes = (b) => {
  if (!b) return "0 MB";
  const mb = b / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
};

/**
 * Tek pet kartı. memo + statik sprite (playing=false) → seçim değişince
 * yalnızca ilgili kartlar yeniden çizilir, görsel decode'u liste pencerelemesiyle
 * sınırlanır (yalnız görünen kartlar mount edilir).
 *
 * Üç durum:
 *   - indiriliyor  → spinner
 *   - indirilmiş   → sprite önizleme; dokun=seç, çöp ikonu=önbellekten sil
 *   - indirilmemiş → indir rozeti; dokun=indir (bitince otomatik seçilir)
 */
const PetCard = memo(function PetCard({
  pet,
  selected,
  cached,
  downloading,
  source,
  sizeBytes,
  colors: C,
  onPress,
  onDelete,
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(pet)}
      disabled={downloading}
      style={[
        ps.petCard,
        {
          backgroundColor: selected ? C.accentDim : C.cardAlt,
          borderColor: selected ? C.accent : C.border,
        },
      ]}
    >
      {selected && cached && (
        <View style={[ps.selectedBadge, { backgroundColor: C.accent }]}>
          <AppIcon name="checkmark" size={11} color={C.white} />
        </View>
      )}

      {/* İndirilmiş petlerde önbellekten silme butonu (sol üst). */}
      {cached && !downloading && (
        <TouchableOpacity
          hitSlop={8}
          onPress={() => onDelete(pet.id)}
          style={[ps.trashBadge, { backgroundColor: C.card, borderColor: C.border }]}
        >
          <AppIcon name="trash-outline" size={12} color={C.muted} />
        </TouchableOpacity>
      )}

      <View style={[ps.previewBox, { backgroundColor: C.card }]}>
        {downloading ? (
          <ActivityIndicator size="small" color={C.accent} />
        ) : cached ? (
          // Statik (ilk kare). Animasyon yok → liste akıcı.
          <SpritePet source={source} state="idle" size={PREVIEW_SIZE} playing={false} />
        ) : (
          // İndirilmemiş: soluk pati + indir rozeti.
          <View style={ps.placeholder}>
            <AppIcon
              family="MaterialCommunityIcons"
              name="paw"
              size={26}
              color={C.muted}
            />
            <View style={[ps.downloadBadge, { backgroundColor: C.accent }]}>
              <AppIcon name="arrow-down" size={12} color={C.white} />
            </View>
          </View>
        )}
      </View>

      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[ps.petName, { color: selected && cached ? C.accentStrong : C.text }]}
      >
        {pet.name}
      </Text>

      {/* Alt satır: indirilmişse boyut, değilse "İndir". */}
      <Text allowFontScaling={false} style={[ps.petMeta, { color: C.muted }]}>
        {downloading
          ? i18nText("autoI18n.petIniyor", "İniyor…")
          : cached
            ? formatBytes(sizeBytes)
            : i18nText("autoI18n.petIndir", "İndir")}
      </Text>
    </TouchableOpacity>
  );
});

/**
 * Ayarlar ekranındaki "Pet" bölümü: ana açma/kapama anahtarı + pet seçme
 * (yatay pencereli liste) + boyut. `colors` = SettingsScreen'in C paleti.
 */
function PetSettingsSection({ colors: C, showLabel = true }) {
  const {
    catalog,
    petEnabled,
    changePetEnabled,
    selectedPetId,
    selectPet,
    petSize,
    changePetSize,
    cachedPets,
    downloadingPets,
    petSizes,
    totalCacheBytes,
    downloadPet,
    removePet,
    clearAllPets,
    getPetSource,
  } = usePet();

  const cachedCount = Object.keys(cachedPets).length;
  const downloadingCount = Object.keys(downloadingPets).length;

  // İndirilmiş petler başta gösterilir; geri kalanlar katalog sırasında.
  const orderedCatalog = useMemo(() => {
    const cached = [];
    const rest = [];
    for (const pet of catalog) {
      (cachedPets[pet.id] ? cached : rest).push(pet);
    }
    return [...cached, ...rest];
  }, [catalog, cachedPets]);

  const keyExtractor = useCallback((item) => item.id, []);

  const getItemLayout = useCallback(
    (_data, index) => ({
      length: STRIDE,
      offset: LIST_PAD + STRIDE * index,
      index,
    }),
    [],
  );

  // Karta dokunma: indirilmişse seç, değilse indir (bitince otomatik seç).
  const handleCardPress = useCallback(
    async (pet) => {
      if (cachedPets[pet.id]) {
        selectPet(pet.id);
      } else {
        await downloadPet(pet.id);
        selectPet(pet.id);
      }
    },
    [cachedPets, downloadPet, selectPet],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <PetCard
        pet={item}
        selected={item.id === selectedPetId}
        cached={!!cachedPets[item.id]}
        downloading={!!downloadingPets[item.id]}
        source={getPetSource(item.id)}
        sizeBytes={petSizes[item.id] || 0}
        colors={C}
        onPress={handleCardPress}
        onDelete={removePet}
      />
    ),
    [
      selectedPetId,
      cachedPets,
      downloadingPets,
      petSizes,
      getPetSource,
      handleCardPress,
      removePet,
      C,
    ],
  );

  return (
    <>
      {showLabel && (
        <Text allowFontScaling={false} style={[ps.sectionLabel, { color: C.muted }]}>
          {i18nText("autoI18n.petBolum", "PET / DOST").toUpperCase()}
        </Text>
      )}

      <View style={[ps.card, { backgroundColor: C.card, borderColor: C.border }]}>
        {/* Ana açma/kapama */}
        <View
          style={[
            ps.toggleRow,
            { borderBottomColor: C.borderMuted },
            !petEnabled && ps.toggleRowCollapsed,
          ]}
        >
          <View style={ps.toggleLeft}>
            <View style={[ps.iconWrap, { backgroundColor: C.iconAmber }]}>
              <AppIcon family="MaterialCommunityIcons" name="paw" size={16} color={C.amber} />
            </View>
            <View style={{ flex: 1 }}>
              <Text allowFontScaling={false} style={[ps.title, { color: C.text }]}>
                {i18nText("autoI18n.petGoster", "Pet'i göster")}
              </Text>
              <Text allowFontScaling={false} style={[ps.sub, { color: C.muted }]}>
                {i18nText(
                  "autoI18n.petGosterAlt2",
                  "Sürükle taşı · dokun durum · basılı tut AI",
                )}
              </Text>
            </View>
          </View>
          <SwitchToggle value={petEnabled} onValueChange={changePetEnabled} size={36} />
        </View>

        {/* "Pet'i göster" kapalıyken aşağıdaki kısım gizlenir */}
        {petEnabled && (
          <>
            {/* Pet seçme — yatay, pencereli (yalnız görünen kartlar render edilir) */}
            <FlatList
              data={orderedCatalog}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              getItemLayout={getItemLayout}
              extraData={`${selectedPetId}|${cachedCount}|${downloadingCount}`}
              contentContainerStyle={ps.grid}
              initialNumToRender={5}
              maxToRenderPerBatch={4}
              windowSize={5}
              removeClippedSubviews
            />

            {/* Önbellek özeti: toplam indirilen boyut + tümünü temizle */}
            {cachedCount > 0 && (
              <View style={[ps.cacheRow, { borderTopColor: C.borderMuted }]}>
                <View style={ps.cacheInfo}>
                  <View style={[ps.iconWrap, { backgroundColor: C.iconBlue }]}>
                    <AppIcon
                      family="MaterialCommunityIcons"
                      name="cloud-download-outline"
                      size={16}
                      color={C.blue}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text allowFontScaling={false} style={[ps.title, { color: C.text }]}>
                      {i18nText("autoI18n.petOnbellek", "İndirilen petler")}
                    </Text>
                    <Text allowFontScaling={false} style={[ps.sub, { color: C.muted }]}>
                      {cachedCount} {i18nText("autoI18n.petAdet", "adet")} ·{" "}
                      {formatBytes(totalCacheBytes)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={clearAllPets}
                  style={[ps.clearBtn, { borderColor: C.border }]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[ps.clearBtnText, { color: C.muted }]}
                  >
                    {i18nText("autoI18n.petTumunuTemizle", "Tümünü temizle")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Boyut seçimi */}
            <View style={[ps.sizeRow, { borderTopColor: C.borderMuted }]}>
              <View style={ps.sizeHeader}>
                <View style={[ps.iconWrap, { backgroundColor: C.iconBlue }]}>
                  <AppIcon
                    family="MaterialCommunityIcons"
                    name="resize"
                    size={16}
                    color={C.blue}
                  />
                </View>
                <Text allowFontScaling={false} style={[ps.title, { color: C.text }]}>
                  {i18nText("autoI18n.petBoyut", "Boyut")}
                </Text>
              </View>
              <View
                style={[
                  ps.segment,
                  { backgroundColor: C.cardAlt, borderColor: C.border },
                ]}
              >
                {PET_SIZES.map((sz) => {
                  const active = petSize === sz.value;
                  return (
                    <TouchableOpacity
                      key={sz.key}
                      style={[ps.segOpt, active && { backgroundColor: C.accent }]}
                      onPress={() => changePetSize(sz.value)}
                      activeOpacity={0.7}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[
                          ps.segText,
                          {
                            color: active ? C.white : C.muted,
                            fontWeight: active ? "700" : "500",
                          },
                        ]}
                      >
                        {sz.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </View>
    </>
  );
}

const ps = StyleSheet.create({
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 22,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  toggleRowCollapsed: {
    borderBottomWidth: 0,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: "500",
  },
  sub: {
    fontSize: 11,
    marginTop: 2,
  },
  grid: {
    paddingHorizontal: LIST_PAD,
    paddingVertical: 14,
  },
  petCard: {
    width: ITEM_W,
    marginRight: ITEM_SEP,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 8,
  },
  selectedBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  previewBox: {
    width: "100%",
    height: 78,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  petName: {
    fontSize: 12.5,
    fontWeight: "700",
    maxWidth: "100%",
  },
  petMeta: {
    fontSize: 10.5,
    fontWeight: "600",
    marginTop: 1,
  },
  trashBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  downloadBadge: {
    position: "absolute",
    bottom: -4,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cacheRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  cacheInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  clearBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sizeRow: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
  },
  sizeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    paddingLeft: 2,
  },
  segment: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 2,
  },
  segOpt: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 9,
  },
  segText: {
    fontSize: 12,
    textAlign: "center",
  },
});

export default PetSettingsSection;
