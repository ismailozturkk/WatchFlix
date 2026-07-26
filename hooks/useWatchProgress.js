// hooks/useWatchProgress.js
//
// İzleme puanı (Kare), Perde ve 81 rozetin TEK giriş noktası.
//
// Katalog üstünde ÜÇ ödül katmanı daha buradan birleşir:
//   • KOLEKSİYON (badgeSets.js)   — girdisi rozetlerin kendisi
//   • DÖNEM MÜHRÜ (seasonSeals.js) — girdisi sahtelenemez işaretleme günleri
//   • PRESTİJ (katalogdaki AILE_PRESTIJ) — aile zirvesinin ötesi, kart değil sayaç
// Üçü de deftere normal rozet gibi yazılır; kalıcılık ve kutlama oradan gelir.
//
// LISTENER SÖZLEŞMESİ: bu hook Firestore'a HİÇBİR yeni onSnapshot açmaz.
// İzleme verisini ProfileStatsContext'in zaten açık olan üç listener'ından
// (Lists kökü, watchedMovies, watchedTv) türetir. Puan sistemi bir veri kaynağı
// değil, var olan verinin bir GÖRÜNÜMÜdür — bu yüzden yeni bir abonelik
// eklemek sözleşmeyi bozar. Tek istisna oyun seviyesidir: `cift_kariyer` rozeti
// için tek seferlik bir doküman okuması yapılır (getDoc, listener değil) ve
// başarısız olursa sistem sessizce onsuz çalışır.
//
// TEK useMemo: 81 rozetin hiçbiri listeyi ayrıca taramaz; hepsi
// computeWatchScore'un tek geçişinden çıkan `stats` objesini okur. 512 film +
// 3.400 bölümde tek geçiş node'da ~30 ms (bkz. __tests__/watchScoring.test.js).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@context/AuthContext";
import { useProfileStats } from "@context/ProfileStatsContext";
import { loadGameData } from "@services/sceneGameService";
import { computePerde, computeWatchScore, hesapYasiYil } from "@utils/watchScoring";
import { kanonikTur } from "@utils/genreCanon";
import {
  evaluateWatchBadges,
  gruplaAileler,
  prestijIdleri,
  WATCH_BADGE_IDS,
} from "@components/badges/watchBadgeCatalog";
import { BADGE_SET_IDS, evaluateBadgeSets } from "@components/badges/badgeSets";
import { muhurIdleri, muhurleriHesapla } from "@components/badges/seasonSeals";
import { kutlanacaklar, loadLedger, markCelebrated, reconcileLedger } from "@utils/watchBadgeLedger";
import { serileriHesapla } from "@utils/watchActivity";

const BOS_ROZETLER = [];

// Defteri diske yazmadan önce hesabın durulmasını bekleme süresi (ms).
// Açılışta ve eski format göçü sırasında imza üst üste değişir; yalnızca
// DURULMUŞ imza yazılır. Bkz. mutabakat effect'indeki uzun açıklama.
const YERLESME_MS = 1500;

export default function useWatchProgress() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  // Kıdem rozetlerinin ölçütü. AuthContext ham Firebase Auth nesnesini sakladığı
  // için `metadata.creationTime` doğrudan elimizde — yeni Firestore alanı, yeni
  // okuma ve yeni listener GEREKMEZ (sistemin temel sözleşmesi). Değeri sunucu
  // yazdığı için katalogdaki tek sahtelenemez ölçüt budur.
  const hesapYili = hesapYasiYil(user?.metadata?.creationTime);
  const {
    listItems, listItemsTv, loadingTv, loadingMovies,
    isloadingShowInfo, isloadingMovieInfo,
  } = useProfileStats() || {};

  // Son mutabakat imzası. Diğer state'lerle birlikte yukarıda durur çünkü
  // hesap değişimi effect'i de onu sıfırlıyor (aşağıda).
  const sonImza = useRef("");
  const [perdeFloor, setPerdeFloor] = useState(1);
  const [makaraFloor, setMakaraFloor] = useState(0);
  const [kazanilmis, setKazanilmis] = useState(BOS_ROZETLER);
  const [oyunSeviye, setOyunSeviye] = useState(0);
  const [defter, setDefter] = useState(null);
  // Aktiflik serileri defterden gelir, izleme verisinden DEĞİL: ölçüt cihaz
  // saatiyle gerçek işaretleme anı (utils/watchActivity.js).
  const [seriler, setSeriler] = useState(null);
  // Mühürlerin ham girdisi: aynı sahtelenemez gün listesi. `seriler` yalnız
  // seri sayılarını taşıyor; mühür dönem bazında GÜN saydığı için listenin
  // kendisi gerekiyor.
  const [aktifGunler, setAktifGunler] = useState(BOS_ROZETLER);
  const [kutlama, setKutlama] = useState(null);   // { rozetler[], perdeAtladi, oncekiPerde, yeniPerde }
  const [ilkTohum, setIlkTohum] = useState(false);
  const [tohumRozetSayisi, setTohumRozetSayisi] = useState(0);

  // ProfileStatsContext listener'ları useStartupGate(3200) ile erteleniyor; ilk
  // ~3,2 saniye veri YOKTUR. Bu pencerede "0 Kare / Perde 1" göstermek hem
  // yanlış bilgidir hem de defter diff'ini bozup sahte bir kutlama tetikler.
  //
  // DÖRT BAYRAK ŞART. İzleme verisi ÜÇ ayrı kaynaktan bağımsız gelir ve sırası
  // garanti değildir:
  //   • Lists/{uid}/watchedMovies  → loadingMovies
  //   • Lists/{uid}/watchedTv      → loadingTv
  //   • Lists/{uid} KÖK dokümanı   → isloadingShowInfo / isloadingMovieInfo
  //     (henüz alt koleksiyona taşınmamış ESKİ FORMAT `watchedTv[]` dizisi
  //      buradan geliyor — ProfileStatsContext.js `const oldShows = data?.watchedTv`)
  //
  // Boş bir alt koleksiyon sorgusu, MB'lık kök dokümandan neredeyse her zaman
  // önce döner. Kök bayraklarını beklemezsek, eski format verisi olan bir
  // kullanıcıda sistem SIFIR diziyle hesap yapıp defteri eksik tohumlar; kök
  // doküman gelince de yıllardır sahip olduğu rozetler "yeni kazandın" diye
  // kutlanır. Tohumlama BİR KEZ yapıldığı için bu hata kalıcıdır.
  const veriHazir = Array.isArray(listItems) && Array.isArray(listItemsTv)
    && !loadingTv && !loadingMovies && !isloadingShowInfo && !isloadingMovieInfo;

  // ── Defter OKUMASI — gecikmesiz ────────────────────────────────────────────
  // Yazma 1,5 sn geciktirilir (aşağıda) çünkü tohumlama GERİ ALINAMAZ. Okuma
  // ise idempotent ve geri alınabilir; onu da geciktirmek görünür bir hataydı:
  // perdeFloor/kazanilmis başlangıç değerleriyle (1 ve []) hesaplanan kart
  // ekrana basılıyor, 1,5 sn sonra defter gelince "Perde 8 → Perde 12"ye ve
  // "22/46 → 31/46"ya zıplıyordu. Yani "Perde ve rozet düşmez" sözü her
  // açılışta gözle görülür biçimde ihlal ediliyordu — üstelik snapshot'lar
  // 1,5 sn'den sık düşerse yazma hiç çalışmayıp DÜŞÜK Perde tüm oturum boyunca
  // kalıyordu.
  useEffect(() => {
    let iptal = false;
    if (!uid) return undefined;
    loadLedger(uid).then((l) => {
      if (iptal) return;
      setDefter(l);
      setPerdeFloor(l.earned.perdeFloor);
      setMakaraFloor(l.earned.makaraFloor);
      setKazanilmis(l.earned.badgeIds);
      setTohumRozetSayisi(l.baseline?.badgeIds.length || 0);
      setSeriler(serileriHesapla(l.aktiflik.gunler, l.aktiflik));
      setAktifGunler(l.aktiflik.gunler);
    }).catch(() => {});
    return () => { iptal = true; };
  }, [uid]);

  // Oyun seviyesi — tek seferlik okuma, listener değil.
  useEffect(() => {
    let iptal = false;
    if (!uid) { setOyunSeviye(0); return undefined; }
    loadGameData(uid)
      .then((d) => { if (!iptal) setOyunSeviye(Number(d?.level) || 0); })
      .catch(() => { if (!iptal) setOyunSeviye(0); });
    return () => { iptal = true; };
  }, [uid]);

  // Hesap değişiminde önceki kullanıcının defteri sızmasın.
  useEffect(() => {
    // İmza da sıfırlanmalı: A hesabından B hesabına geçildiğinde imzalar
    // çakışırsa (ikisi de yeni hesap, aynı boş rozet kümesi) mutabakat "zaten
    // yapıldı" deyip B için HİÇ çalışmaz ve B'nin defteri hiç tohumlanmaz.
    sonImza.current = "";
    setPerdeFloor(1);
    setMakaraFloor(0);
    setKazanilmis(BOS_ROZETLER);
    setDefter(null);
    setSeriler(null);
    setAktifGunler(BOS_ROZETLER);
    setKutlama(null);
    setIlkTohum(false);
    setTohumRozetSayisi(0);
  }, [uid]);

  // ── TEK HESAP ──────────────────────────────────────────────────────────────
  const sonuc = useMemo(() => {
    if (!veriHazir) return null;
    const { toplam, kirilim, stats } = computeWatchScore({
      movies: listItems, shows: listItemsTv, kanonikTur,
    });
    const perde = computePerde(toplam, perdeFloor, makaraFloor);
    // seri_* rozetleri artık `rekorHaftaSerisi`den besleniyor, `enUzunSeri`den
    // DEĞİL. Gerekçe utils/watchActivity.js'te: eski ölçüt kullanıcının seçtiği
    // izleme tarihinden türüyordu ve geriye dönük tamir edilebiliyordu.
    // PUAN FORMÜLÜ DEĞİŞMEDİ — `enUzunSeri` hâlâ SERI_KILOMETRE'yi besliyor.
    // Değiştirseydik herkesin Kare'si oynar, kimsenin Perde'si düşmese bile
    // (perdeFloor) kart geri sarardı; puan geçmişi ölçer, rozet katılımı.
    const zenginStats = {
      ...stats,
      perde: perde.perde, oyunSeviye, hesapYili,
      rekorHaftaSerisi: seriler?.rekorHafta || 0,
      rekorGunSerisi: seriler?.rekorGun || 0,
    };
    const rozetler = evaluateWatchBadges(zenginStats, kazanilmis);
    const aileKartlari = gruplaAileler(rozetler);
    // ── Katalog üstü ödüller ─────────────────────────────────────────────────
    // Üçü de rozet ŞEKLİNDE üretilir (aynı alanlar) → ekran, kart bileşeni ve
    // defter tek satır değişmeden çalışır.
    //   • Koleksiyon: girdisi stats değil ROZETLERİN kendisi
    //   • Mühür: girdisi sahtelenemez gerçek işaretleme günleri
    //   • Prestij: aile zirvesinin ötesi — kart değil, kartın üstünde sayaç
    const setler = evaluateBadgeSets(rozetler, kazanilmis);
    const muhurler = muhurleriHesapla(aktifGunler, { kazanilmis });
    return {
      kare: toplam,
      kirilim,
      stats: zenginStats,
      perde,
      rozetler,
      setler,
      muhurler,
      // Sıra ekranda BOLUM_SIRA ile kuruluyor; burada yalnız birleştiriliyor.
      kartlar: [...aileKartlari, ...muhurler, ...setler],
      tahmini: stats.tahminiEser > 0,
    };
    // detectAnomalies BİLİNÇLİ olarak çağrılmıyor: sistem tamamen kişisel
    // (hiçbir sosyal yüzeyde, hiçbir sıralamada görünmüyor), dolayısıyla kendi
    // kartına "doğrulanmamış" etiketi basmanın kimseye faydası yok. Fonksiyon
    // utils/watchScoring.js'te duruyor çünkü sunucu tarafına geçildiğinde
    // (docs §8.4) orada gerçek bir tüketicisi olacak.
  }, [veriHazir, listItems, listItemsTv, perdeFloor, makaraFloor, oyunSeviye, hesapYili, seriler, aktifGunler, kazanilmis]);

  // ── Defter mutabakatı ──────────────────────────────────────────────────────
  // Yalnızca açık rozet kümesi ya da Perde gerçekten değiştiğinde çalışır;
  // imza karşılaştırması her render'da AsyncStorage'a gitmeyi önler.
  useEffect(() => {
    if (!uid || !sonuc) return;
    // Defter üç yeni ödül türünü de normal rozet gibi taşır — kalıcılık
    // (rozet düşmez) ve kutlama böylece bedava gelir.
    const prestijAcik = prestijIdleri(sonuc.kartlar);
    const acikIds = [
      ...sonuc.rozetler.filter((b) => b.acik).map((b) => b.id),
      ...sonuc.setler.filter((s) => s.acik).map((s) => s.id),
      ...sonuc.muhurler.filter((m) => m.acik).map((m) => m.id),
      ...prestijAcik,
    ];
    // `tumIds` = defterin "var olduğunu bildiği" id'ler. Bir ödül ilk kez
    // BURADA görünüp aynı turda kazanılırsa sessizce emilir (kutlama oynamaz) —
    // bu, katalog genişlemesi için doğru davranış. Ama mühür ve prestij için
    // yanlış olurdu: ikisi de doğaları gereği kazanıldıkları anda ilk kez
    // ortaya çıkar. O yüzden güncel dönem mührü kazanılmadan ÖNCE, prestijin
    // bir SONRAKİ basamağı da ulaşılmadan önce listeye yazılır.
    const tumIds = [
      ...WATCH_BADGE_IDS,
      ...BADGE_SET_IDS,
      ...muhurIdleri({ kazanilmis }),
      ...prestijIdleri(sonuc.kartlar, { sonraki: 1 }),
    ];
    // İÇERİK SAYISI İMZAYA DAHİL OLMAK ZORUNDA. Aktiflik damgası "toplam eser
    // adedi arttı mı" sinyalinden türüyor; imza yalnızca Perde+rozetten
    // oluşsaydı, hiçbir rozeti açmayan sıradan bir işaretleme (ki neredeyse
    // hepsi öyle) mutabakatı hiç tetiklemez ve o gün SERİYE HİÇ YAZILMAZDI.
    const icerikSayisi = sonuc.stats.filmSayisi + sonuc.stats.bolumSayisi;
    const imza = `${sonuc.perde.perde}.${sonuc.perde.makara}|${icerikSayisi}|${acikIds.join(",")}`;
    if (imza === sonImza.current) return;
    sonImza.current = imza;

    let iptal = false;
    let yerlesti = false;

    // YERLEŞME GECİKMESİ. Tohumlama GERİ ALINAMAZ (bir kez yapılır) ve yanlış
    // anda yapılırsa kullanıcının yıllardır sahip olduğu rozetler "yeni
    // kazanıldı" diye kutlanır. Açılışta ise imza birkaç kez üst üste değişir:
    // üç listener bağımsız düşer, ListStatusContext eski format listeleri alt
    // koleksiyonlara TAŞIR (her yazma yeni bir snapshot) ve `veriHazir`
    // bayrakları bu taşımayı göremez — filmler artık kök dokümandan hiç
    // okunmuyor, dolayısıyla boş bir subcollection "yüklendi" sayılıyor.
    // Yazmadan önce imzanın durulmasını beklemek bu yarışların TAMAMINI kapatır
    // ve hiçbir şeyi geciktirmez: mutabakatın tek görünür çıktısı kutlama ve
    // Perde tabanıdır, ikisi de anlık değildir.
    const zamanlayici = setTimeout(() => {
      if (iptal) return;
      reconcileLedger(uid, {
        badgeIds: acikIds,
        // KATALOG GENİŞLEME KORUMASI: defter, katalogda hangi id'lerin var
        // olduğunu bilmeli. Bilmediği bir id ilk kez göründüğünde ve kullanıcı
        // onu zaten hak ediyorsa rozet sessizce sahiplenilir — güncelleme sonrası
        // "15 rozet birden kazandın" seli tam olarak böyle önlenir.
        tumIds,
        icerikSayisi,
        perde: sonuc.perde.perde, makara: sonuc.perde.makara, kare: sonuc.kare,
      })
      .then((r) => {
        yerlesti = true;
        if (iptal) return;
        setDefter(r.ledger);
        setIlkTohum(r.ilkTohum);
        setTohumRozetSayisi(r.tohumRozetSayisi);
        // Rekor yükseldiyse bu, hesabı yeniden koşturur (seriler memo'nun
        // bağımlılığı) ve seri rozeti AYNI oturumda açılır.
        //
        // Değişmediyse ÖNCEKİ REFERANS döner: `seriler` bir memo bağımlılığı
        // olduğu için her mutabakatta yeni nesne yazmak, hiçbir şey değişmese
        // bile tüm hesabı (512 film + 3.400 bölüm) yeniden koştururdu.
        if (r.seriler) {
          setSeriler((o) => (
            o && o.gunSerisi === r.seriler.gunSerisi && o.haftaSerisi === r.seriler.haftaSerisi
              && o.rekorGun === r.seriler.rekorGun && o.rekorHafta === r.seriler.rekorHafta
              && o.bugunAktif === r.seriler.bugunAktif
              ? o : r.seriler
          ));
        }
        // Gün listesi de aynı gerekçeyle referans korur: her mutabakatta yeni
        // dizi yazmak tüm hesabı (512 film + 3.400 bölüm) yeniden koştururdu.
        // SON GÜN de karşılaştırılmalı: pencere 400'e dolduğunda yeni bir gün
        // eskisini düşürür ve UZUNLUK DEĞİŞMEZ — tek başına uzunluğa bakmak o
        // andan sonra mühür ilerlemesini donduruyordu.
        const yeniGunler = r.ledger.aktiflik.gunler;
        setAktifGunler((o) => (
          o.length === yeniGunler.length && o[o.length - 1] === yeniGunler[yeniGunler.length - 1]
            ? o
            : yeniGunler
        ));
        if (r.perdeFloor !== perdeFloor) setPerdeFloor(r.perdeFloor);
        if (r.makaraFloor !== makaraFloor) setMakaraFloor(r.makaraFloor);
        const ledgerIds = r.ledger.earned.badgeIds;
        // Defterdeki küme hesaplanandan genişse (veri silinmiş ama rozet
        // korunuyor) state'i güncelle ki bir sonraki hesap onları açık saysın.
        // Uzunluk DEĞİL içerik karşılaştırılır: aynı sayıda ama farklı id'ler
        // (bir rozet düşüp başkası açıldığında) uzunluk kontrolünden kaçardı.
        if (ledgerIds.join(",") !== kazanilmis.join(",")) setKazanilmis(ledgerIds);
        // KUTLANACAKLAR DEFTERDEN TÜRETİLİR, bu turun diff'inden DEĞİL.
        // Diff'e bakmak kalıcı kayıp üretiyordu: mutabakat defteri diske yazdıktan
        // sonra iptal edilirse (yeni snapshot düşer, effect temizlenir) tekrar
        // denenir ama rozet artık `earned` içindedir, dolayısıyla `yeniRozetler`
        // boş döner ve o rozetin kutlaması BİR DAHA ASLA gösterilemez.
        // `seen` kümesi tam olarak bunun için var: kazanılmış ama gösterilmemiş.
        // Tohumlamada her şey `seen`e yazıldığı için bu küme doğal olarak boştur.
        const bekleyen = kutlanacaklar(r.ledger);
        if (!r.ilkTohum && (bekleyen.length || r.perdeAtladi || r.makaraAtladi)) {
          setKutlama({
            rozetler: bekleyen,
            perdeAtladi: r.perdeAtladi,
            makaraAtladi: r.makaraAtladi,
            oncekiPerde: r.oncekiPerde,
            yeniPerde: r.yeniPerde,
            yeniMakara: r.yeniMakara,
          });
        }
      })
        .catch(() => { yerlesti = true; sonImza.current = ""; });
    }, YERLESME_MS);

    // İPTAL EDİLEN MUTABAKAT TEKRAR DENENMELİ. İmza, işlem başlamadan önce
    // "yapıldı" diye yazılıyor (eşzamanlı ikinci bir çağrıyı engellemek için).
    // AsyncStorage I/O sürerken listener yeni bir dizi referansı üretirse effect
    // temizlenir ve `.then` gövdesi atlanır — ama defter DİSKE ZATEN YAZILMIŞTIR.
    // İmzayı sıfırlamazsak bir sonraki çalışmada "aynı imza" deyip erken döner
    // ve perdeFloor/kazanilmis/defter state'i kalıcı olarak boş kalır: o turda
    // kazanılan rozetin kutlaması bir daha gösterilemez ve "Perde düşmez"
    // güvencesi tam da koruması gereken anda devre dışı kalır.
    // reconcileLedger monoton birleştirdiği için tekrar çalıştırmak güvenlidir.
    return () => {
      iptal = true;
      clearTimeout(zamanlayici);
      if (!yerlesti) sonImza.current = "";
    };
    // perdeFloor/kazanilmis kasıtlı olarak bağımlılık DEĞİL: ikisini de bu
    // effect yazıyor, listeye eklemek sonsuz döngü kurar. İmza kontrolü
    // tekrarlı çalışmayı zaten engelliyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, sonuc]);

  const kutlamayiKapat = useCallback(async () => {
    const ids = kutlama?.rozetler || [];
    setKutlama(null);
    if (uid && defter && ids.length) {
      const sonraki = await markCelebrated(uid, defter, ids);
      setDefter(sonraki);
    }
  }, [uid, defter, kutlama]);

  // Dönüş MUTLAKA memoize edilmeli: her render'da yeni bir nesne dönmek,
  // tüketicilerdeki React.memo'yu (WatchLevelCard) tamamen etkisiz kılar —
  // ProfileScreen bir sekme olduğu için sık render alır.
  return useMemo(() => ({
    loading: !sonuc,
    kare: sonuc?.kare ?? 0,
    kirilim: sonuc?.kirilim ?? null,
    stats: sonuc?.stats ?? null,
    perde: sonuc?.perde ?? null,
    rozetler: sonuc?.rozetler ?? BOS_ROZETLER,
    setler: sonuc?.setler ?? BOS_ROZETLER,
    muhurler: sonuc?.muhurler ?? BOS_ROZETLER,
    kartlar: sonuc?.kartlar ?? BOS_ROZETLER,
    tahmini: sonuc?.tahmini ?? false,
    // Sayaç KATALOG rozetlerini sayar; koleksiyon/mühür/prestij dahil edilseydi
    // payda her dönem başında büyür ve kullanıcı hiçbir şey yapmadan "42/95"ten
    // "42/96"ya düşmüş görünürdü.
    acikSayisi: sonuc ? sonuc.rozetler.filter((b) => b.acik).length : 0,
    toplamRozet: sonuc?.rozetler.length ?? 0,
    ilkTohum,
    tohumRozetSayisi,
    // MEVCUT seri bozulabilir (canlılık göstergesi), REKOR bozulamaz (rozet
    // kaynağı). İkisinin ayrı olması "Perde ve rozet düşmez" sözleşmesini
    // korurken seriye gereken gerilimi ekleyen şeydir.
    seriler,
    kutlama,
    kutlamayiKapat,
  }), [sonuc, ilkTohum, tohumRozetSayisi, seriler, kutlama, kutlamayiKapat]);
}
