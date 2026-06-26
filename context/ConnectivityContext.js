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
      _online = online;
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
