// components/chat/ShareToChatSheet.js
//
// "Sohbete gönder" alıcı seçimi: arkadaş / grup listesi (NewConversationSheet) +
// seçimin ChatScreen'e taşınması. Liste ve CineMatch cevabı gibi zengin içerikler
// ortak kullanır (gövde için utils/chatShare.js).
//
// Gönderimi bu bileşen YAPMAZ: seçilen alıcının sohbetini `initialShare`
// parametresiyle açar, ChatScreen mesajı kendisi yazar (aynı atomik batch +
// bildirim yolu, film/dizi detayındaki "Gönder"in `initialMedia` kalıbıyla aynı).
//
// `onSent`: alıcı seçilip sayfa TAMAMEN kapandıktan sonra bir kez çağrılır. Bu
// bileşen başka bir Modal'ın (ör. CineMatch paneli) İÇİNDE durabilir; üst Modal'ı
// kapatma işi sayfanın çıkış animasyonu bittikten sonra yapılmalı — iOS kapanmakta
// olan bir Modal'ın üstüne ikincisini sunamaz (bkz. components/common/BottomSheetModal.js).

import React, { useCallback, useRef } from "react";
import { useNavigation } from "@react-navigation/native";
import NewConversationSheet from "./NewConversationSheet";
import { chatParamsForShare } from "../../utils/chatShare";
import { i18nText } from "../../utils/i18nText";

/**
 * @param {object}   props
 * @param {boolean}  props.visible
 * @param {object|null} props.share      utils/chatShare gövdesi (liste / ai).
 * @param {() => void} props.onClose
 * @param {() => void} [props.onSent]    Alıcı seçildi ve sayfa kapandı.
 */
export default function ShareToChatSheet({ visible, share, onClose, onSent }) {
  const navigation = useNavigation();
  const pickedRef = useRef(false);

  const handleSelect = useCallback(
    (recipient) => {
      const params = chatParamsForShare(recipient, share);
      if (!params) return;
      pickedRef.current = true;
      navigation.navigate("ChatScreen", params);
    },
    [navigation, share],
  );

  const handleDismissed = useCallback(() => {
    if (!pickedRef.current) return;
    pickedRef.current = false;
    onSent?.();
  }, [onSent]);

  return (
    <NewConversationSheet
      visible={visible}
      onClose={onClose}
      onSelect={handleSelect}
      onDismissed={handleDismissed}
      includeGroups
      title={i18nText("autoI18n.sohbete_gonder", "Sohbete gönder")}
      subtitle={i18nText(
        "autoI18n.gonderilecek_kisiyi_veya_grubu_sec",
        "Göndermek istediğin arkadaşını veya grubu seç",
      )}
    />
  );
}
