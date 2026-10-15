// context/ConnectivityContext.js
//
// Cihazın internet durumunu (NetInfo) tek yerden sağlar. Offline-first katmanı
// "online mıyız?" sorusunu hem React tarafında (useConnectivity) hem de
// React-dışı servislerde (getIsOnline) buradan okur.

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import NetInfo from "@react-native-community/netinfo";

// React-dışı kod (servisler, cachedRead) için senkron erişim.
let _online = true;
export const getIsOnline = () => _online;

// "Bağlantı geri geldi" haberi (React dışı kod için): yerel-öncelikli veri
// katmanı bekleyen yazımlarını buna bakarak hemen boşaltır. Yalnız çevrimdışı →
// çevrimiçi geçişte tetiklenir (ağ türü değişimi gürültü olmasın).
const onlineListeners = new Set();
export const subscribeOnline = (listener) => {
  onlineListeners.add(listener);
  return () => onlineListeners.delete(listener);
};

const ConnectivityContext = createContext({
  isOnline: true,
  isInternetReachable: true,
});

export const useConnectivity = () => useContext(ConnectivityContext);

export const ConnectivityProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);

  useEffect(() => {
    const apply = (state) => {
      // isInternetReachable null olabilir (henüz bilinmiyor) → online say.
      const reachable = state?.isInternetReachable !== false;
      const online = !!state?.isConnected && reachable;
      const wasOnline = _online;
      _online = online;
      if (online && !wasOnline) {
        for (const fn of Array.from(onlineListeners)) {
          try {
            fn();
          } catch {
            // dinleyici hatası bağlantı durumunu bozmasın
          }
        }
      }
      setIsOnline(online);
      setIsInternetReachable(reachable);
    };

    NetInfo.fetch().then(apply).catch(() => {});
    const unsubscribe = NetInfo.addEventListener(apply);
    return () => unsubscribe();
  }, []);

  const value = useMemo(
    () => ({ isOnline, isInternetReachable }),
    [isOnline, isInternetReachable],
  );

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
};
