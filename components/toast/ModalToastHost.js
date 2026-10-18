// components/toast/ModalToastHost.js
//
// Çıplak React Native <Modal> kullanan ekranlar için: Modal'ın İÇİNE, en alta ekle.
//
//   <Modal visible={visible} transparent onRequestClose={close}>
//     <View style={styles.overlay}>...</View>
//     <ModalToastHost visible={visible} />
//   </Modal>
//
// Neden: Modal ayrı bir pencere olduğu için kökteki toast onun arkasında kalır (bkz.
// ToastHost.js). BottomSheetModal bunu zaten kendisi yapar; ona ayrıca eklenmez.
// `visible` modalın açık olma NİYETİdir (kapanış animasyonu bitmeden düşer; toast o anda
// köke devredilir).

import React from "react";
import ToastHost from "./ToastHost";

export default function ModalToastHost({ visible = true, ...rest }) {
  return <ToastHost scoped enabled={!!visible} {...rest} />;
}
