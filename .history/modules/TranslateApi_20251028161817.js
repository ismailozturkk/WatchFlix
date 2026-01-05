// Tek seferde her yerde kullanabileceğin çeviri fonksiyonu
export const translateText = async (text, target = "en") => {
  console.log("text", text);
  try {
    const response = await fetch("https://libretranslate.com/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "auto",
        target,
        format: "text",
      }),
    });

    const data = await response.json();
    console.log("data", data);
    return data.translatedText;
  } catch (error) {
    console.warn("Çeviri hatası:", error);
    return null;
  }
};
