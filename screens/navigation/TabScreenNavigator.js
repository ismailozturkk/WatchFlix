import React, { useCallback, useMemo } from "react";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import HubScreen from "@screens/tabs/HubScreen";
import SettingsScreen from "@screens/tabs/SettingsScreen";
import ProfileScreen from "@screens/tabs/ProfileScreen";
import MovieScreen from "@screens/tabs/MovieScreen";
import TvShowScreen from "@screens/tabs/TvShowScreen";
import { MovieProvider } from "@context/MovieContex";
import { CalendarProvider } from "@context/CalendarContext";
import PetCompanion from "@components/pet/PetCompanion";
import AdaptiveTabShell from "../../components/navigation/AdaptiveTabShell";
import { TAB_DEFINITIONS } from "../../utils/tabBarModel";

export default function TabScreenNavigator({ navigation, route }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const tabs = useMemo(() => TAB_DEFINITIONS.map((tab) => ({ ...tab, label: t[tab.labelKey] || tab.name })), [t]);
  // Preserve the root-stack navigation prop and original provider ownership.
  const screens = useMemo(() => ({
    tvshows: <TvShowScreen navigation={navigation} />,
    movies: <MovieProvider><MovieScreen navigation={navigation} /></MovieProvider>,
    share: <HubScreen navigation={navigation} />,
    settings: <SettingsScreen navigation={navigation} />,
    profile: <CalendarProvider><ProfileScreen navigation={navigation} /></CalendarProvider>,
  }), [navigation]);
  const renderCompanion = useCallback((layout) => <PetCompanion fabRight={layout.fabRight} fabBottom={layout.fabBottom} />, []);
  return <AdaptiveTabShell navigation={navigation} route={route} tabs={tabs} screens={screens} theme={theme} renderCompanion={renderCompanion} />;
}
