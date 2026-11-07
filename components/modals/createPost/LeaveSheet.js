// components/modals/createPost/LeaveSheet.js
//
// "Paylaşımı bırak?" / "Değişiklikleri iptal et?" onayı — CreatePostModal
// penceresinin İÇİNDE çizilen katman. Çizimin kendisi ortak
// components/common/InlineConfirmSheet.js'te (neden appAlert değil: oranın başlığı
// ve memory/ios-modal-sequencing.md). Burada yalnız besteci görünüşü sabitlenir:
// tip renginden ikon degradesi, besteci kırmızısı, düğmeler hep alt alta.
//
// Boşluğa dokunmak `onDismiss` (= "Vazgeç") çağırır; donanım geri tuşunu
// CreatePostModal'ın `requestClose`u yönlendirir.

import React from "react";
import InlineConfirmSheet from "../../common/InlineConfirmSheet";
import { alpha } from "../../../theme/colors";
import { DANGER } from "./ComposerParts";

/**
 * @param {object} props
 * @param {object} props.theme
 * @param {string} props.accent                         Birincil düğme / ikon rengi.
 * @param {string} props.title
 * @param {string} [props.message]
 * @param {Array<{key:string,label:string,icon?:string,tone?:"primary"|"danger"|"neutral",onPress:()=>void}>} props.actions
 * @param {() => void} props.onDismiss
 */
export default function LeaveSheet({ theme, accent, title, message, actions, onDismiss }) {
  return (
    <InlineConfirmSheet
      theme={theme}
      accent={accent}
      title={title}
      message={message}
      icon="help-circle-outline"
      iconGradient={[accent, alpha(accent, 0.75)]}
      dangerColor={DANGER}
      stacked
      actions={actions}
      onDismiss={onDismiss}
    />
  );
}
