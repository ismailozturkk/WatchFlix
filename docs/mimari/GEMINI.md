# Seelogd – Gemini Integration

Gemini, bu proje başlatıldığında otomatik olarak `/memory-bank/` klasörünü okuyacaktır.  
Bu dosyalar, sistemin tam bağlamını oluşturur.

## 🔄 Memory Bank Yükleme Sırası

1. projectbrief.md
2. productContext.md
3. systemPatterns.md
4. techContext.md
5. activeContext.md
6. progress.md

## 💡 Talimatlar

- Yeni değişikliklerden sonra “update memory bank” komutu kullanılmalıdır.
- Gemini, her oturum başında bu dosyaları analiz ederek bağlamı yeniden kurar.
- Öneriler ve kararlar bu belgelerdeki bilgilerle uyumlu olmalıdır.
