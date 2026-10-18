// hooks/useKesifSignals.js
//
// KEŞİF rozetlerinin girdisini bağlamlardan toplar. Hesabın kendisi saf modülde
// (utils/kesifSignals.js); burası yalnız KAYNAKLARI okuyup `hazir` bayraklarını kurar.
//
// LISTENER SÖZLEŞMESİ: bu hook Firestore'a HİÇBİR yeni dinleyici/sorgu açmaz.
//   • Notlar, film/dizi notları, hatırlatıcılar, CineMatch geçmişi → yerel-öncelikli
//     motorun senkron görünümü (`useUserDataDomain`, ağa gitmez; zaten bu bağlamların
//     kendisi de aynı görünümü okuyor).
//   • Özel liste/favori/izleme listesi, ortak liste, arkadaş, profil → ilgili bağlamın
//     ZATEN açık dinleyicisi.
// PROVIDER SIRASI DEĞİŞTİRİLMEDİ: WatchProgressProvider ağaçta ProfileNotes/MediaNotes/
// Reminders'ın DIŞINDA (App.js). O yüzden onların bağlamı değil, aynı veriyi veren
// motor doğrudan okunur — bu, sağlayıcıları yer değiştirmekten çok daha az riskli.
//
// GİZLİLİK: yalnız SAYI ve boolean çıkar. Not içeriği, mesaj, kişi kimliği bu dosyadan
// dışarı çıkmaz; rozet defterine yalnız rozet id'si yazılır (yerel).
//
// HAZIR OLMA ölçütleri (yanlış "hazır" = eski kullanıcıya sahte kutlama, bkz. utils/
// kesifSignals.js YÜKLENME YARIŞI):
//   • domain'ler      view.ready (yerel kopya var ya da tek seferlik indirme bitti)
//   • arkadaşlar      !loading (üç dinleyicinin ilk anlık görüntüsü geldi)
//   • listeler        !loading && watchedTvLoaded — kök belge `loading`i erken
//                     kapatıyor, eksik listeler (favori/izleme listesi) sonradan iniyor;
//                     `watchedTvLoaded` o indirmenin bittiği anı işaretler
//   • ortak listeler  !loading
//   • profil          !loading && profile.uid === uid

import { useMemo, useRef } from "react";
import { useAuth } from "@context/AuthContext";
import { useFriends } from "@context/FriendsContext";
import { useListStatusContext } from "@context/ListStatusContext";
import { useSharedLists } from "@context/SharedListsContext";
import { useUserProfile } from "@context/UserProfileContext";
import useUserDataDomain from "@hooks/useUserDataDomain";
import {
  aiConversationsDomain,
  mediaNotesDomain,
  notesDomain,
  remindersDomain,
} from "@services/userData";
import { countFavorites, readProfileFavorites } from "@utils/fourFavorites";
import { bosKesif, kesifAyni, kesifSinyalleriHesapla } from "@utils/kesifSignals";

const BOS_NESNE = {};

export default function useKesifSignals() {
  const { user } = useAuth() || BOS_NESNE;
  const uid = user?.uid || null;

  const notlar = useUserDataDomain(notesDomain);
  const medyaNotlari = useUserDataDomain(mediaNotesDomain);
  const hatirlaticilar = useUserDataDomain(remindersDomain);
  const yapayZeka = useUserDataDomain(aiConversationsDomain);

  // Bağlam yoksa (test, ağaç dışı render) hazır DEĞİL sayılır — varsayılan "hazır, 0"
  // olsaydı kaynak yokken rozet `known`a yazılırdı.
  const arkadaslar = useFriends() || BOS_NESNE;
  const listeler = useListStatusContext() || BOS_NESNE;
  const ortak = useSharedLists() || BOS_NESNE;
  const profilBaglam = useUserProfile() || BOS_NESNE;
  const profil = profilBaglam.profile || null;

  const hesap = useMemo(() => {
    if (!uid) return bosKesif();
    return kesifSinyalleriHesapla({
      notlar: { hazir: !!notlar.ready, items: notlar.lists?.items },
      medyaNotlari: { hazir: !!medyaNotlari.ready, items: medyaNotlari.lists?.items },
      hatirlaticilar: {
        hazir: !!hatirlaticilar.ready,
        filmler: hatirlaticilar.lists?.movies,
        bolumler: hatirlaticilar.lists?.episodes,
      },
      listeler: {
        hazir: listeler.loading === false && listeler.watchedTvLoaded === true,
        ozelListe: listeler.otherListKeys?.length,
        favori: listeler.favoritesItems?.length,
        izlemeListesi: listeler.watchListItems?.length,
      },
      ortakListeler: {
        hazir: ortak.loading === false,
        adet: ortak.sharedLists?.length,
      },
      arkadaslar: {
        hazir: arkadaslar.loading === false,
        adet: arkadaslar.friends?.length,
      },
      profil: {
        hazir: !!profil && profil.uid === uid && profilBaglam.loading === false,
        gonderi: profil?.postsCount,
        dortFavori: profil ? countFavorites(readProfileFavorites(profil)) : 0,
        bio: profil?.bio,
      },
      yapayZeka: { hazir: !!yapayZeka.ready, items: yapayZeka.lists?.items },
    });
  }, [
    uid,
    notlar, medyaNotlari, hatirlaticilar, yapayZeka,
    arkadaslar.loading, arkadaslar.friends,
    listeler.loading, listeler.watchedTvLoaded,
    listeler.otherListKeys, listeler.favoritesItems, listeler.watchListItems,
    ortak.loading, ortak.sharedLists,
    profil, profilBaglam.loading,
  ]);

  // İçerik aynıysa ESKİ referans: not metnini düzenlemek ya da profildeki bir sayaç
  // değişmek `hesap`ı yeniden üretir ama çıktı aynıdır; yeni referans, rozet
  // listesinin yeniden kurulmasına ve tüm tüketicilerin yeniden çizilmesine yol açardı.
  const onceki = useRef(null);
  if (!kesifAyni(onceki.current, hesap)) onceki.current = hesap;
  return onceki.current;
}
