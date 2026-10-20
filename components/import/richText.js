// components/import/richText.js
//
// `**kalın**` işaretli çeviri metnini iç içe <Text> parçalarına böler (dosya adları gibi
// vurgulanacak kısımlar dilin kendi cümlesinde istediği yere konabilsin diye).
// Üst <Text>'in çocuğu olarak kullanılır: <Text>{renderRich(copy.x, { fontWeight: "700" })}</Text>

import React from "react";
import { Text } from "react-native";
import { splitRich } from "./importCopy";

export function renderRich(text, strongStyle) {
  return splitRich(text).map((part, index) =>
    part.strong ? (
      <Text key={index} style={strongStyle}>
        {part.text}
      </Text>
    ) : (
      <React.Fragment key={index}>{part.text}</React.Fragment>
    ),
  );
}
