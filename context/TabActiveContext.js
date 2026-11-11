// context/TabActiveContext.js
//
// Kök sekmeler (Keşfet, Hub, Kütüphane, Profil) AYNI kök rotanın içinde
// yaşar: React Navigation açısından sekmeler arası geçiş bir "blur" değildir,
// `navigation.isFocused()` gizli sekmede de true döner. AdaptiveTabShell her
// sekmenin alt ağacını bu bağlamla sarar; useScreenFocused ikisini birleştirir.
//
// Varsayılan true: sekme kabuğu dışındaki her ekran (yığın ekranları, modallar)
// davranış değiştirmez.

import { createContext, useContext } from "react";

export const TabActiveContext = createContext(true);

export function useTabActive() {
  return useContext(TabActiveContext);
}
