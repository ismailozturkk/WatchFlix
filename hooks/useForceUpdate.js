// hooks/useForceUpdate.js
//
// Yüklü sürüm `AppConfig/minVersion`'dan eskiyse { required: true, … } döner; App.js o zaman
// gezgin ve doğrulama kapısı yerine ForceUpdateScreen çizer. Açılışta ve uygulama öne her
// döndüğünde denetler (okuma services/forceUpdate.js'te saatlik önbellekli).

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import { fetchMinVersionConfig } from "../services/forceUpdate";
import { isUpdateRequired, requiredVersionFor, storeLinksFor } from "../utils/forceUpdate";

const NOT_REQUIRED = Object.freeze({ required: false });

/** Yüklü sürüm. runtimeVersion = appVersion olduğundan OTA güncellemesinde de native sürümle aynı. */
export const installedAppVersion = () => Constants.expoConfig?.version ?? null;

export default function useForceUpdate() {
  const [state, setState] = useState(NOT_REQUIRED);
  const mounted = useRef(true);

  const evaluate = useCallback(async () => {
    const config = await fetchMinVersionConfig();
    if (!mounted.current) return;
    const platform = Platform.OS;
    const current = installedAppVersion();
    if (!isUpdateRequired(current, config, platform)) {
      setState((prev) => (prev.required ? NOT_REQUIRED : prev));
      return;
    }
    setState({
      required: true,
      current,
      minimum: requiredVersionFor(config, platform),
      links: storeLinksFor(config, platform),
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    evaluate();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") evaluate();
    });
    return () => {
      mounted.current = false;
      sub.remove();
    };
  }, [evaluate]);

  return state;
}
