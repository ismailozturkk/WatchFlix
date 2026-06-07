import React, { createContext, useContext, useMemo } from "react";
import { useSnowSettings } from "./AppSettingsContext";

const SnowContext = createContext();

export const SnowProvider = ({ children }) => {
  const { showSnow, changeShowSnow } = useSnowSettings();
  const value = useMemo(
    () => ({ showSnow, changeShowSnow }),
    [showSnow, changeShowSnow],
  );

  return (
    <SnowContext.Provider value={value}>
      {children}
    </SnowContext.Provider>
  );
};

export const useSnow = () => {
  const context = useContext(SnowContext);
  if (context === undefined) {
    throw new Error("useSnow must be used within a SnowProvider");
  }
  return context;
};
