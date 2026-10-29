import React, { useCallback, useMemo } from "react";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { useAiChatRequest } from "@context/AiChatRequestContext";
import HubScreen from "@screens/tabs/HubScreen";
import LibraryScreen from "@screens/tabs/LibraryScreen";
import ProfileScreen from "@screens/tabs/ProfileScreen";
import DiscoverScreen from "@screens/tabs/DiscoverScreen";
import { CalendarProvider } from "@context/CalendarContext";
import AdaptiveTabShell from "../../components/navigation/AdaptiveTabShell";
import { TAB_DEFINITIONS } from "../../utils/tabBarModel";

export default function TabScreenNavigator({ navigation, route }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { requestAiChat } = useAiChatRequest();
  const tabs = useMemo(() => TAB_DEFINITIONS.map((tab) => ({ ...tab, label: t[tab.labelKey] || tab.name })), [t]);
  // Preserve the root-stack navigation prop and original provider ownership.
  // Film + Dizi tek sekme (DiscoverScreen); MovieProvider artık onun içinde, Film
  // bölümü kurulduğunda devreye girer.
  const screens = useMemo(() => ({
    discover: <DiscoverScreen navigation={navigation} />,
    share: <HubScreen navigation={navigation} />,
    // Ayarlar artık sekme değil: Profil'in dişli düğmesinden "SettingsScreen" olarak açılır.
    library: <LibraryScreen navigation={navigation} />,
    profile: <CalendarProvider><ProfileScreen navigation={navigation} /></CalendarProvider>,
  }), [navigation]);
  // Çubuğun yanındaki yuvarlak yapay zeka düğmesi: sohbeti düğmenin konumundan
  // büyüyerek açar (eskiden yüzen FAB'ın yaptığı iş).
  const openAiChat = useCallback((origin) => requestAiChat({ origin }), [requestAiChat]);
  return (
    <AdaptiveTabShell
      navigation={navigation} route={route} tabs={tabs} screens={screens} theme={theme}
      onAiPress={openAiChat}
    />
  );
}
