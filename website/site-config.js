/* site-config.js — landing sayfasının elle değiştirilen ayarları.
 *
 * MAĞAZA BAĞLANTILARI (stores):
 *   Boşken ("") düğmeler "Yakında" durumunda görünür ve tıklayınca bekleme
 *   listesi kutusuna götürür. Uygulama mağazada yayına girince ilgili adresi
 *   yaz — düğme otomatik gerçek bağlantıya döner:
 *     apple:  "https://apps.apple.com/app/id0000000000"
 *     google: "https://play.google.com/store/apps/details?id=com.smlztrk.seelogd"
 *   İkisi de doluysa bekleme listesi kutusu gizlenir; biri doluysa "Yayında"
 *   etiketi çıkar ama diğer mağaza "Yakında" kalır ve liste açık kalır.
 *   Resmî mağaza rozetleri (Apple/Google marka kuralları) yayın gününde
 *   index.html'deki .store düğmelerinin yerine konabilir; bkz. README.
 *
 * launchDate:
 *   Kesin tarih belliyse ISO biçiminde yaz ("2026-11-20T10:00:00+03:00"):
 *   hero'daki hap "… tarihinde yayında" der. Belli değilse null bırak.
 *   (Geri sayım sayacı kaldırıldı: geçmiş bir tarih "YAYINDA" yazdırıyordu.)
 *
 * firebaseConfig: bekleme listesi (waitlist) ve sayaç (meta/waitlist) için.
 *   null yapılırsa form tarayıcının localStorage'ında DEMO modunda çalışır.
 *   Firestore kuralı yalnızca { email, createdAt, source, queueNo } alanlarına
 *   izin verir — forma yeni alan eklersen firestore.rules'ı da güncelle.
 */
window.SITE_CONFIG = {
  stores: {
    apple: "",
    google: "",
  },
  launchDate: null,
  baseCount: 1071, // gösterilen sayı = baseCount + Firestore kayıt sayısı
  firebaseConfig: {
    apiKey: "AIzaSyDoooqZO4XPh8ExhpHsDap9GCW8jyGKvuI",
    authDomain: "movieandtv-2832a.firebaseapp.com",
    projectId: "movieandtv-2832a",
    storageBucket: "movieandtv-2832a.firebasestorage.app",
    messagingSenderId: "427087836931",
    appId: "1:427087836931:web:dbfa3ca10b4d725fe91b36",
    measurementId: "G-ML19ZRGCE4",
  },
};
