import { TouchableOpacity, View } from "react-native";
import React from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "../context/ThemeContext";
import Toast from "@components/AppToast";
import { useAuth } from "../context/AuthContext";
import useUserDataDomain from "../hooks/useUserDataDomain";
import { remindersActions, remindersDomain } from "../services/userData";
import { episodeKey } from "../services/userData/domains";
import { useDeviceNotifications } from "../context/DeviceNotificationsContext";
import { i18nText } from "../utils/i18nText";
import useReminderGate from "../hooks/useReminderGate";


export default function Reminder({
  showId,
  showName,
  seasonNumber,
  episodeNumber,
  episodeName,
  airDate,
  stillPath,
  seasonPosterPath,
  episodeMinutes,
  showPosterPath,
  type,
  episodeId,
  releaseDate,
  movieMinutes,
  movieName,
  posterPath,
  movieId,
  onLimitReached,
  // Zilin boyutu. Bölüm/sezon satırlarında küçük (18); detaydaki eylem satırında (ListViewTv
  // `watchedOverride`) yanındaki İzleme Listesi / Favori simgeleriyle AYNI boyut verilir.
  size = 18,
  // Zil küçük bir dairenin içinde durduğunda (SeasonItem) dokunma alanını
  // dairenin tamamına yaymak için.
  hitSlop,
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { primeNotificationPermission } = useDeviceNotifications();
  const reminderGate = useReminderGate();
  const uid = user?.uid;

  const formatDateSave = (timestamp) => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    const day   = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year  = date.getFullYear();
    return `${year}-${month}-${day}`;
  };

  const epId = String(episodeId || `${showId}-${seasonNumber}-${episodeNumber}`);

  // ── Durum ──────────────────────────────────────────────────────────────────
  // YEREL KOPYADAN, senkron. Eskiden her çan simgesi mount'ta buluttan 1-2
  // `getDoc` yapıyordu (bölüm listesinde N satır = N okuma, her açılışta).
  // Görünüm yalnız hatırlatıcılar değiştiğinde yeniden çizilir.
  const remindersView = useUserDataDomain(remindersDomain);
  const isReminderSet =
    type === "tv"
      ? remindersView.has("episodes", episodeKey(showId, epId))
      : remindersView.has("movies", movieId);

  // ── Add / Remove ──────────────────────────────────────────────────────────
  const addReminder = async () => {
    try {
      if (!uid) return;

      // Kaldırmak her zaman serbest; yalnız YENİ film/dizi hak harcar.
      if (!isReminderSet) {
        const target = { type: type === "tv" ? "tv" : "movie", showId };
        if (!reminderGate.canAdd(target)) {
          // Açık bir Modal'ın içindeysek (hızlı işlemler sayfası) yükseltme
          // sayfasını üst katman açar: iki Modal aynı anda sunulamaz.
          if (onLimitReached) onLimitReached(target);
          else reminderGate.checkAdd(target);
          return;
        }
      }

      // Yerel kopyaya + kalıcı günlüğe ANINDA yazılır; buluta arka planda gider
      // (çevrimdışıyken de çalışır). Dizi belgesi (tvShows/{id}) ilk bölümde
      // eklenir, son bölümde silinir — okuma gerekmeden yerel sayımdan türetilir.
      if (type === "tv") {
        if (!showId) return;
        remindersActions.toggleEpisode(uid, {
          episodeId:      epId,
          episodeNumber:  episodeNumber  || 0,
          episodeName:    episodeName    || "",
          airDate:        airDate        || "",
          stillPath:      stillPath      || null,
          episodeMinutes: episodeMinutes || 0,
          showId,
          showName:       showName       || "",
          showPosterPath: showPosterPath  || "",
          seasonNumber:   seasonNumber   || 0,
          seasonPosterPath: seasonPosterPath || null,
          createdAt: formatDateSave(new Date()),
        });
      } else {
        if (movieId == null || movieId === "") return;
        remindersActions.toggleMovie(uid, {
          movieId,
          movieName:    movieName    || "",
          releaseDate:  releaseDate  || "",
          movieMinutes: movieMinutes || 0,
          posterPath:   posterPath   || null,
          type:         "movie",
          createdAt:    formatDateSave(new Date()),
        });
      }

      const eklendi = !isReminderSet;
      Toast.show({
        type:  isReminderSet ? "error" : "success",
        text1: isReminderSet ? i18nText("autoI18n.hatirlatma_kaldirildi", "Hatırlatma kaldırıldı") : i18nText("autoI18n.hatirlatma_basariyla_eklendi", "Hatırlatma başarıyla eklendi"),
      });
      // Hatırlatma kuruldu ama OS izni yoksa bildirim ASLA düşmez. İzin
      // sayfasını tam da burada açıyoruz: kullanıcı ne istediğini yeni söyledi.
      if (eklendi) primeNotificationPermission();
    } catch (error) {
      console.error("Error adding reminder:", error);
      Toast.show({ type: "error", text1: i18nText("autoI18n.hatirlatma_eklenirken_bir_hata_olustu", "Hatırlatma eklenirken bir hata oluştu") });
    }
  };

  return (
    <View>
      <TouchableOpacity onPress={addReminder} hitSlop={hitSlop}>
        <MaterialCommunityIcons
          name={isReminderSet ? "bell-ring" : "bell-ring-outline"}
          size={size}
          color={theme.colors.orange}
        />
      </TouchableOpacity>
    </View>
  );
}
