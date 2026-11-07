// hooks/useInlineConfirm.js
//
// Açık bir Modal'ın İÇİNDEN soru sormak için `appAlert`in yerine geçer. İmza
// aynı (title, message, buttons, options) — mekanik değişim; fark, kutunun
// kökteki AppAlertHost penceresinde değil, çağıranın penceresinde çizilmesi.
// Neden gerekli: components/common/InlineConfirmSheet.js başlığı.
//
// KULLANIM:
//   const confirm = useInlineConfirm({ active: visible });
//   confirm.ask("Sil?", "Geri alınamaz.", [
//     { text: "Vazgeç", style: "cancel" },
//     { text: "Sil", style: "destructive", onPress: doDelete },
//   ]);
//   …
//   <Modal onRequestClose={() => { if (!confirm.dismiss()) onClose(); }}>
//     …içerik…
//     {confirm.element}        // pencerenin TAM ekran kökünün son çocuğu
//   </Modal>
//   // BottomSheetModal'da: <BottomSheetModal overlay={confirm.element} …>
//
// `active` false olunca (pencere kapanıyor) açık soru callback çalıştırmadan düşer;
// yeniden açılışta bayat kutu görünmez.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InlineConfirmSheet from "@components/common/InlineConfirmSheet";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import {
  ALERT_TYPES,
  alertButtonsToActions,
  backdropBehavior,
  resolveAlertType,
} from "@utils/alertPresentation";

/**
 * @param {{ active?: boolean, accent?: string }} [opts]
 * @returns {{ ask: Function, dismiss: () => boolean, isOpen: boolean, element: React.ReactNode }}
 */
export default function useInlineConfirm({ active = true, accent } = {}) {
  const { theme } = useTheme();
  const [prompt, setPrompt] = useState(null);
  const promptRef = useRef(null);

  const set = useCallback((next) => {
    promptRef.current = next;
    setPrompt(next);
  }, []);

  const ask = useCallback(
    (title, message, buttons, options) => {
      const actions = alertButtonsToActions(
        buttons,
        i18nText("autoI18n.tamam", "Tamam"),
      );
      set({
        title: title ?? "",
        message: message ?? "",
        actions,
        options: options || {},
        type: resolveAlertType(options, buttons),
      });
    },
    [set],
  );

  // Önce kutu kapanır, sonra callback: callback yeni bir soru sorabilir.
  const run = useCallback(
    (fn) => {
      set(null);
      if (typeof fn === "function") fn();
    },
    [set],
  );

  // Geri tuşu / boşluk. Kutu açıksa true döner (çağıran pencereyi kapatmasın).
  const dismiss = useCallback(() => {
    const current = promptRef.current;
    if (!current) return false;
    const behavior = backdropBehavior(current.actions, current.options);
    if (behavior) run(behavior.onPress);
    return true;
  }, [run]);

  useEffect(() => {
    if (!active && promptRef.current) set(null);
  }, [active, set]);

  const element = useMemo(() => {
    if (!prompt || !active) return null;
    const meta = ALERT_TYPES[prompt.type] || ALERT_TYPES.info;
    const accentColor = accent || theme.accent;
    return (
      <InlineConfirmSheet
        theme={theme}
        accent={accentColor}
        title={prompt.title}
        message={prompt.message}
        icon={meta.icon}
        iconGradient={
          prompt.type === "confirm" ? [accentColor, accentColor] : meta.gradient
        }
        actions={prompt.actions.map((a) => ({
          key: a.key,
          label: a.label,
          tone: a.tone,
          onPress: () => run(a.onPress),
        }))}
        onDismiss={dismiss}
      />
    );
  }, [prompt, active, accent, theme, run, dismiss]);

  return { ask, dismiss, isOpen: !!prompt, element };
}
