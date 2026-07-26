import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { InteractionManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as petCache from "../services/petCache";
import { toast } from "../components/AppToast";
import { i18nText } from "../utils/i18nText";

// Petler. Hepsi aynı 1536x1872 / 9 satır sprite düzeni.
// Sprite sheet'ler bundle'da DEĞİL — Cloudflare R2'de (/pets/<id>.webp) barınır,
// istek üzerine indirilip cihaz önbelleğinde tutulur (bkz. services/petCache.js).
// YENİ PET EKLEMEK: <id>.webp'yi R2 /pets/ klasörüne yükle ve buraya tek satır ekle.
export const PET_CATALOG = [
  { id: "astro", name: "Astro" },
  { id: "asterix", name: "Asteriks" },
  { id: "bubbles", name: "Bubbles" },
  { id: "bumblebee", name: "Bumblebee" },
  { id: "cat", name: "Kedi" },
  { id: "darvin", name: "Darwin" },
  { id: "dobby", name: "Dobby" },
  { id: "doraemon", name: "Doraemon" },
  { id: "eren", name: "Eren" },
  { id: "goku", name: "Goku" },
  { id: "grogu", name: "Grogu" },
  { id: "homelander", name: "Homelander" },
  { id: "johnsnow", name: "Jon Snow" },
  { id: "kleopatra", name: "Kleopatra" },
  { id: "levi", name: "Levi" },
  { id: "naruto", name: "Naruto" },
  { id: "neo", name: "Neo" },
  { id: "nightking", name: "Night King" },
  { id: "oburix", name: "Oburiks" },
  { id: "optimus-prime", name: "Optimus Prime" },
  { id: "patric", name: "Patrick" },
  { id: "rick", name: "Rick" },
  { id: "sonik", name: "Sonic" },
  { id: "wall-e", name: "Wall-E" },
  { id: "walterwhite", name: "Walter White" },
  { id: "zoku", name: "Zoku" },
];

const PET_IDS = PET_CATALOG.map((p) => p.id);

// Kilit kaldırıldı: tüm petler varsayılan olarak açık ve seçilebilir.
const DEFAULT_OWNED = Object.fromEntries(PET_CATALOG.map((p) => [p.id, true]));
const DEFAULT_SELECTED = "astro";

// Pet boyut ön ayarları (kare yüksekliği px). Ayarlardan seçilir.
export const PET_SIZES = [
  { key: "xs", labelKey: "autoI18n.pet_boy_minik", label: "Minik", value: 72 },
  { key: "s", labelKey: "autoI18n.pet_boy_kucuk", label: "Küçük", value: 96 },
  { key: "m", labelKey: "autoI18n.pet_boy_orta", label: "Orta", value: 124 },
  { key: "l", labelKey: "autoI18n.pet_boy_buyuk", label: "Büyük", value: 152 },
];
const DEFAULT_SIZE = 124;

// Pet'e basılı tutunca yayınlanan event — ChatModal bunu dinleyip AI sohbetini açar.
export const AI_CHAT_EVENT = "pet:openAiChat";

const STORAGE_KEYS = {
  enabled: "pet_enabled",
  owned: "pet_owned",
  selected: "pet_selected",
  position: "pet_position",
  size: "pet_size",
};

const PetContext = createContext(undefined);

export const PetProvider = ({ children }) => {
  // Yeni kurulumlarda pet kapalıdır; daha önce seçim yapan kullanıcıların
  // AsyncStorage'daki tercihi açılışta aşağıda geri yüklenir.
  const [petEnabled, setPetEnabled] = useState(false);
  const [ownedPets, setOwnedPets] = useState(DEFAULT_OWNED);
  const [selectedPetId, setSelectedPetId] = useState(DEFAULT_SELECTED);
  const [petState, setPetState] = useState("idle"); // runtime, kalıcı değil
  const [position, setPosition] = useState(null); // {x,y} | null = varsayılan konum
  const [petSize, setPetSize] = useState(DEFAULT_SIZE);

  // İndirme/önbellek durumu (R2'den indirilen petler cihaz önbelleğinde tutulur).
  const [cachedPets, setCachedPets] = useState({});     // { id: true } — indirilmiş
  const [downloadingPets, setDownloadingPets] = useState({}); // { id: true } — indiriliyor
  const [petSizes, setPetSizes] = useState({});         // { id: bytes }
  // Önbellek taraması bitti mi? Bitmeden otomatik indirme tetiklenmemeli
  // (aksi halde zaten diskte olan pet gereksiz yere yeniden indirilir).
  const [cacheReady, setCacheReady] = useState(false);

  // Açılışta ayarları oku + önbelleği tara — ERTELENMİŞ: scanCached her pet için
  // senkron dosya sistemi çağrısı yapar (26 pet × exists/size); splash sonrası
  // donma penceresinde çalışmasın diye etkileşimler bitince + kısa gecikmeyle koşar.
  // Ayarlar ve tarama aynı görevde uygulanır ki pet, kayıtlı konum/boyutuyla
  // birlikte tek seferde görünsün.
  useEffect(() => {
    let cancelled = false;
    let timer = null;
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(async () => {
        try {
          const [[, en], [, owned], [, sel], [, pos], [, sz]] =
            await AsyncStorage.multiGet([
              STORAGE_KEYS.enabled,
              STORAGE_KEYS.owned,
              STORAGE_KEYS.selected,
              STORAGE_KEYS.position,
              STORAGE_KEYS.size,
            ]);
          if (cancelled) return;
          if (en !== null) setPetEnabled(JSON.parse(en));
          if (owned !== null)
            setOwnedPets({ ...DEFAULT_OWNED, ...JSON.parse(owned) });
          if (sel !== null) setSelectedPetId(sel);
          if (pos !== null) setPosition(JSON.parse(pos));
          if (sz !== null) setPetSize(JSON.parse(sz));
        } catch {
          // sessizce varsayılanlarla devam
        }
        if (cancelled) return;
        const { cached, sizes } = petCache.scanCached(PET_IDS);
        if (cancelled) return;
        setCachedPets(cached);
        setPetSizes(sizes);
        setCacheReady(true);
      }, 1600);
    });
    return () => {
      cancelled = true;
      task.cancel?.();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Bir peti R2'den indir (önbelleğe al). Zaten varsa/iniyorsa hiçbir şey yapmaz.
  const downloadPet = useCallback(
    async (id) => {
      if (cachedPets[id] || downloadingPets[id]) return;
      setDownloadingPets((c) => ({ ...c, [id]: true }));
      try {
        await petCache.downloadPet(id);
        setCachedPets((c) => ({ ...c, [id]: true }));
        setPetSizes((c) => ({ ...c, [id]: petCache.getPetSize(id) }));
        return true;
      } catch (e) {
        // Hatayı YÜZEYE ÇIKAR — sessizce geçilince APK'da "hiçbir şey olmuyor"
        // gibi görünüyordu; gerçek sebep (ağ/izin/depolama) artık görülebilir.
        console.warn(
          "pet download failed:",
          id,
          e?.message || e,
          e?.cause?.code ? `(cause: ${e.cause.code})` : "",
        );
        // Jenerik mesaj yerine GERÇEK sebebi göster (HTTP hatası / boş yanıt /
        // geçersiz içerik). Böylece sorun teşhis edilebilir.
        toast.error(
          i18nText("autoI18n.indirilemedi", "Pet indirilemedi"),
          e?.message ||
            i18nText(
              "autoI18n.pet_indirilemedi_kontrol",
              "İnternet bağlantını kontrol edip tekrar dene.",
            ),
        );
        return false;
      } finally {
        setDownloadingPets((c) => {
          const next = { ...c };
          delete next[id];
          return next;
        });
      }
    },
    [cachedPets, downloadingPets],
  );

  // Bir peti önbellekten sil.
  const removePet = useCallback((id) => {
    petCache.deletePet(id);
    setCachedPets((c) => {
      const next = { ...c };
      delete next[id];
      return next;
    });
    setPetSizes((c) => {
      const next = { ...c };
      delete next[id];
      return next;
    });
  }, []);

  // Tüm indirilen petleri sil.
  const clearAllPets = useCallback(() => {
    petCache.clearAllPets();
    setCachedPets({});
    setPetSizes({});
  }, []);

  // Render için pet source: indirilmişse { uri }, değilse null.
  const getPetSource = useCallback(
    (id) => (cachedPets[id] ? { uri: petCache.petUriFor(id) } : null),
    [cachedPets],
  );

  // Toplam önbellek boyutu (byte).
  const totalCacheBytes = useMemo(
    () => Object.values(petSizes).reduce((a, b) => a + (b || 0), 0),
    [petSizes],
  );

  const changePetEnabled = useCallback((value) => {
    setPetEnabled(value);
    AsyncStorage.setItem(STORAGE_KEYS.enabled, JSON.stringify(value)).catch(
      () => {},
    );
  }, []);

  // Bir peti "aç" (kilidini kaldır).
  const openPet = useCallback((id) => {
    setOwnedPets((current) => {
      if (current[id]) return current;
      const next = { ...current, [id]: true };
      AsyncStorage.setItem(STORAGE_KEYS.owned, JSON.stringify(next)).catch(
        () => {},
      );
      return next;
    });
  }, []);

  // Aktif peti seç (yalnızca açık olanlar seçilebilir).
  const selectPet = useCallback((id) => {
    setSelectedPetId(id);
    AsyncStorage.setItem(STORAGE_KEYS.selected, id).catch(() => {});
  }, []);

  const setPetPosition = useCallback((pos) => {
    setPosition(pos);
    AsyncStorage.setItem(STORAGE_KEYS.position, JSON.stringify(pos)).catch(
      () => {},
    );
  }, []);

  const changePetSize = useCallback((size) => {
    setPetSize(size);
    AsyncStorage.setItem(STORAGE_KEYS.size, JSON.stringify(size)).catch(
      () => {},
    );
  }, []);

  const value = useMemo(
    () => ({
      catalog: PET_CATALOG,
      petEnabled,
      changePetEnabled,
      ownedPets,
      openPet,
      selectedPetId,
      selectPet,
      petState,
      setPetState,
      position,
      setPetPosition,
      petSize,
      changePetSize,
      // İndirme / önbellek
      cacheReady,
      cachedPets,
      downloadingPets,
      petSizes,
      totalCacheBytes,
      downloadPet,
      removePet,
      clearAllPets,
      getPetSource,
    }),
    [
      petEnabled,
      changePetEnabled,
      ownedPets,
      openPet,
      selectedPetId,
      selectPet,
      petState,
      position,
      setPetPosition,
      petSize,
      changePetSize,
      cacheReady,
      cachedPets,
      downloadingPets,
      petSizes,
      totalCacheBytes,
      downloadPet,
      removePet,
      clearAllPets,
      getPetSource,
    ],
  );

  return <PetContext.Provider value={value}>{children}</PetContext.Provider>;
};

export const usePet = () => {
  const context = useContext(PetContext);
  if (context === undefined) {
    throw new Error("usePet must be used within a PetProvider");
  }
  return context;
};
