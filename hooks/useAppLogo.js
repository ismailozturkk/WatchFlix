// hooks/useAppLogo.js
//
// Seçili uygulama simgesine göre logo kaynakları. Uygulama içindeki her marka
// logosu bunu kullanır; kullanıcı Ayarlar > Kişiselleştirme'den simgeyi
// değiştirince hepsi birlikte, yeniden başlatma olmadan değişir.
//
//   const { logo, icon } = useAppLogo();
//   <Image source={logo} />   // şeffaf zeminli "S" işareti
//   <Image source={icon} />   // arka planıyla tam simge
//
// Kaynakların kendisi için bkz. components/appLogoSources.js.

import { getAppLogoSources } from "../components/appLogoSources";
import { useAppIconId } from "../services/appIconStore";

export default function useAppLogo() {
  return getAppLogoSources(useAppIconId());
}
