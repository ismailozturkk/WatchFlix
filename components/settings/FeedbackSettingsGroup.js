// components/settings/FeedbackSettingsGroup.js
//
// Ayarlar ana ekranındaki "DESTEK VE GERİ BİLDİRİM" grubu: iki satır.
//   • Hata bildir   → Premium ve üstü   (utils/premiumFeatures.js → bug_report)
//   • Özellik iste  → yalnız Premium Max (feature_request)
// Plan yetmiyorsa satır kilitli çizilir (sağda plan hapı) ve dokunmak yükseltme
// sayfasını açar; yetiyorsa FeedbackScreen'e gider. Free'de e-posta desteği
// Hakkında ekranında açık kalır.

import React, { useMemo } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import PremiumPill from "@components/premium/PremiumPill";
import { useLanguage } from "@context/LanguageContext";
import { usePremiumGate } from "@hooks/usePremiumGate";
import { intlLocaleOf } from "@utils/appLanguages";
import { getPremiumPlanDisplayName } from "@utils/premium";
import { getFeature } from "@utils/premiumFeatures";
import { Chevron, SectionLabel, SettingRow, ui } from "../../screens/tabs/settings/settingsUi";
import { getFeedbackCopy } from "../../screens/tabs/settings/feedbackCopy";

export default function FeedbackSettingsGroup({ C }) {
  const navigation = useNavigation();
  const { language } = useLanguage();
  const copy = useMemo(() => getFeedbackCopy(language), [language]);
  const bugGate = usePremiumGate("bug_report");
  const featureGate = usePremiumGate("feature_request");

  const open = (gate, kind) => () => {
    if (gate.allows(0)) navigation.navigate("FeedbackScreen", { kind });
    else gate.showUpsell();
  };

  // Kilitliyken sağda hangi planın açtığı; açıkken ok.
  const right = (gate, color) =>
    gate.allows(0) ? (
      <Chevron color={C.muted} />
    ) : (
      <PremiumPill
        label={getPremiumPlanDisplayName(getFeature(gate.featureId)?.minPlan)}
        color={color}
      />
    );

  return (
    <>
      <SectionLabel color={C.muted}>{copy.group.label.toLocaleUpperCase(intlLocaleOf(language))}</SectionLabel>
      <View style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <SettingRow
          colors={C}
          iconBg={C.iconAmber}
          iconColor={C.amber}
          iconName="bug-outline"
          title={copy.group.bugTitle}
          subtitle={copy.group.bugSub}
          onPress={open(bugGate, "bug")}
          right={right(bugGate, C.amber)}
        />
        <SettingRow
          colors={C}
          iconBg={C.iconPurple}
          iconColor={C.purple}
          iconName="bulb-outline"
          title={copy.group.featureTitle}
          subtitle={copy.group.featureSub}
          onPress={open(featureGate, "feature")}
          right={right(featureGate, C.purple)}
          last
        />
      </View>
    </>
  );
}
