import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import Toast from "react-native-toast-message";

export const useNetworkStatus = () => {
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected !== connected) {
        setConnected(state.isConnected);

        if (!state.isConnected) {
          Toast.show({
            type: "error",
            text1: "Bağlantı kesildi",
            visibilityTime: 2000,
          });
        } else {
          Toast.show({
            type: "success",
            text1: "Bağlandı",
            visibilityTime: 2000,
          });
        }
      }
    });

    return () => unsub();
  }, [connected]);

  return connected;
};
