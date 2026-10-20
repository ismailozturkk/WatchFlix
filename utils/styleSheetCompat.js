// utils/styleSheetCompat.js
//
// React Native 0.85, `StyleSheet.absoluteFillObject`'i KALDIRDI (0.86.2'de
// Libraries/StyleSheet/StyleSheetExports.js artık yalnızca `absoluteFill`
// dışa aktarıyor). Projenin kendi kodundaki 50 kullanım SDK 57 geçişinde
// `absoluteFill`'e çevrildi, ancak GÜNCELLENMEYEN ÜÇÜNCÜ PARTİ paketler hâlâ
// eski alanı okuyor:
//
//   react-native-circular-progress-indicator@4.4.2  (son yayın: Ara 2022)
//     circularProgressBase/index.js ve circularProgress/index.js:
//       style: [StyleSheet.absoluteFillObject, styles(styleProps).valueContainer]
//     Alan `undefined` olunca kapsayıcı `position:absolute` niteliğini
//     kaybediyor, `flex:1` ile normal akışa düşüyor ve içindeki çocuklar
//     halkanın üstüne bindirileceğine ALTINA kayıyor. Profil ekranındaki
//     avatar çevresindeki iç/dış ilerleme halkalarının kayması buydu.
//
//   react-native-calendars/src/timeline/TimelineHours.js
//     <View style={StyleSheet.absoluteFillObject} /> — Timeline bileşeni
//     bugün kullanılmıyor ama ileride açılırsa aynı şekilde bozulurdu.
//
// Her iki paket de alanı MODÜL YÜKLENİRKEN değil RENDER SIRASINDA okuyor;
// bu yüzden index.js'te, ilk render'dan önce yamalamak yeterli.
//
// Yama birebir sadık: RN 0.81.5 kaynağında `absoluteFillObject: absoluteFill`
// yazıyordu, yani ikisi zaten AYNI nesneydi.
//
// Bu dosya bilinçli olarak `react-native` import ETMİYOR — StyleSheet dışarıdan
// veriliyor ki saf bir birim testi yazılabilsin (jest yapılandırması RN'i
// dönüştürmüyor, bkz. jest.config.js).

/**
 * Eksikse `absoluteFillObject`'i `absoluteFill`'e eşitler.
 *
 * @param {object} styleSheet - react-native'in StyleSheet nesnesi
 * @returns {boolean} yama uygulandıysa true
 */
export function applyStyleSheetCompat(styleSheet) {
  if (!styleSheet || typeof styleSheet !== "object") return false;
  // Zaten varsa (eski RN veya başka bir yama) dokunma.
  if (styleSheet.absoluteFillObject != null) return false;
  const fill = styleSheet.absoluteFill;
  if (fill == null) return false;
  try {
    styleSheet.absoluteFillObject = fill;
  } catch {
    // Nesne ileride donarsa açılışta çökmektense yamasız devam et.
    return false;
  }
  // Atamanın gerçekten tuttuğunu DOĞRULA: donmuş nesneye yazma katı modda
  // TypeError atarken sloppy modda sessizce başarısız olur. Yalnızca catch'e
  // güvenmek, yama uygulanmadığı hâlde `true` döndürürdü.
  return styleSheet.absoluteFillObject === fill;
}

export default applyStyleSheetCompat;
