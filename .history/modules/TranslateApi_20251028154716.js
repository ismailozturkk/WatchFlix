// Uygulamada çeviri yapmak için tek bir modül
export const translateText = async (text, target = "en") => {
  try {
    const response = await fetch("https://libretranslate.de/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "auto", // Otomatik dil algılama
        target,
        format: "text",
      }),
    });

    const data = await response.json();
    return data.translatedText;
  } catch (error) {
    console.error("Çeviri hatası:", error);
    return text; // Hata durumunda orijinal metni döndür
  }
};
