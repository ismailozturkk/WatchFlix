// Bildirim izni ön-açıklaması: sayfa ne zaman açılır?
//
// Kilitlenen davranışlar:
//   1. Sayfa TEK SEFERLİK — bir kez sonuçlandıktan sonra kendiliğinden geri
//      gelmez (Android'de ilk ret kalıcı değil, aksi hâlde her hatırlatıcıda
//      tekrar açılırdı).
//   2. `canAskAgain` false iken HİÇ açılmaz — "İzin ver" düğmesi ölü olurdu.
//   3. Sistem diyaloğu yalnız kullanıcı "İzin ver" dedikten sonra açılabilsin
//      diye karar bu saf fonksiyondan geçer; çağrı yerlerinde tekrar edilmez.

import { shouldPrimeNotifications } from "../utils/notificationPriming";

// Sayfanın açılması gereken temel durum; testler bunun üstüne tek alan bozar.
const acilmali = {
  status: "undetermined",
  canAskAgain: true,
  alreadyPrimed: false,
  notificationsEnabled: true,
};

describe("shouldPrimeNotifications", () => {
  test("izin hiç sorulmamışsa açılır", () => {
    expect(shouldPrimeNotifications(acilmali)).toBe(true);
  });

  test("Android 13+ 'denied' ama tekrar sorulabiliyorsa açılır", () => {
    // Android'de izin HİÇ istenmemişken de status 'denied' döner; ikisini
    // ayıran tek şey canAskAgain (bkz. pushNotificationsService.getPermissionInfo).
    expect(
      shouldPrimeNotifications({ ...acilmali, status: "denied" }),
    ).toBe(true);
  });

  test("izin zaten verilmişse açılmaz", () => {
    expect(
      shouldPrimeNotifications({ ...acilmali, status: "granted" }),
    ).toBe(false);
  });

  test("sistem bir daha sormayacaksa açılmaz", () => {
    expect(
      shouldPrimeNotifications({ ...acilmali, canAskAgain: false }),
    ).toBe(false);
  });

  test("canAskAgain bilinmiyorsa açılmaz", () => {
    // Ölü düğme riskini almaktansa hiç sormamak yeğ.
    expect(
      shouldPrimeNotifications({ ...acilmali, canAskAgain: undefined }),
    ).toBe(false);
  });

  test("daha önce gösterildiyse açılmaz", () => {
    expect(
      shouldPrimeNotifications({ ...acilmali, alreadyPrimed: true }),
    ).toBe(false);
  });

  test("'Şimdi değil' izin verilmemişken bile kalıcıdır", () => {
    // Kullanıcı sayfada "Şimdi değil" dedi: izin hâlâ yok ve sistem hâlâ
    // sorabiliyor ama sayfa bir daha kendiliğinden gelmemeli.
    expect(
      shouldPrimeNotifications({
        status: "denied",
        canAskAgain: true,
        alreadyPrimed: true,
        notificationsEnabled: true,
      }),
    ).toBe(false);
  });

  test("uygulama içi ana anahtar kapalıysa açılmaz", () => {
    expect(
      shouldPrimeNotifications({ ...acilmali, notificationsEnabled: false }),
    ).toBe(false);
  });

  test("ayarlar henüz yüklenmemişken (undefined) açılır", () => {
    // Ana anahtar varsayılan olarak AÇIK; undefined'ı kapalı saymak sayfayı
    // ilk saniyelerde sessizce yutardı.
    expect(
      shouldPrimeNotifications({ ...acilmali, notificationsEnabled: undefined }),
    ).toBe(true);
  });

  test("argümansız çağrı patlamaz", () => {
    expect(shouldPrimeNotifications()).toBe(false);
  });
});
