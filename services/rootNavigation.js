// services/rootNavigation.js
//
// Kök NavigationContainer'ın ref'i. Ekran olmayan yerlerden (context'ler,
// modal içindeki paneller, premium limit uyarısı) yönlendirme yapabilmek için
// App.js bu ref'i kullanır.
import { createNavigationContainerRef } from "@react-navigation/native";

export const rootNavigationRef = createNavigationContainerRef();

/** Navigasyon hazırsa yönlendirir; hazır değilse sessizce false döner. */
export function navigateRoot(name, params) {
  if (!rootNavigationRef.isReady()) return false;
  rootNavigationRef.navigate(name, params);
  return true;
}
