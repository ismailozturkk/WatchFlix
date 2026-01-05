// Tek seferde her yerde kullanabileceğin çeviri fonksiyonu
import axios from "axios";
import React from "react";
export const translateText = async (text, target = "en") => {
  console.log("text", text);
  try {
    const response = await axios("https://libretranslate.de/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "auto", // dili otomatik algılar
        target,
        format: "text",
      }),
    });

    const data = await response.json();
    return data.translatedText;
  } catch (error) {
    console.warn("Çeviri hatası:", error);
    return null;
  }
};
