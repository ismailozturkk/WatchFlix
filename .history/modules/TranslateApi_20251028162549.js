// Microsoft Translator API (Free Tier) kullanarak çeviri yapan fonksiyon

// ❗ ÖNEMLİ: Aşağıdaki bilgileri kendi Microsoft Azure hesabınızdan almalısınız.
const MS_TRANSLATOR_KEY = "YOUR_MICROSOFT_TRANSLATOR_API_KEY"; // Azure portalından aldığınız API anahtarı
const MS_TRANSLATOR_REGION = "YOUR_RESOURCE_REGION"; // Örn: "westeurope", Azure'da kaynağı oluşturduğunuz bölge

export const translateText = async (text, target = "en") => {
  console.log("text", text);

  if (MS_TRANSLATOR_KEY === "YOUR_MICROSOFT_TRANSLATOR_API_KEY") {
    console.error(
      "Microsoft Translator API anahtarı ayarlanmamış. Lütfen TranslateApi.js dosyasına anahtarınızı ekleyin."
    );
    return text; // Hata durumunda orijinal metni geri döndür
  }

  try {
    const response = await fetch(
      `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${target}`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": MS_TRANSLATOR_KEY,
          "Ocp-Apim-Subscription-Region": MS_TRANSLATOR_REGION,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify([{ Text: text }]),
      }
    );

    const data = await response.json();
    console.log("Microsoft Translator data", data);
    // Microsoft API'den gelen yanıt formatı: [{ "translations": [{ "text": "...", "to": "en" }] }]
    return data[0]?.translations[0]?.text;
  } catch (error) {
    console.warn("Çeviri hatası (Microsoft Translator):", error);
    return null;
  }
};
