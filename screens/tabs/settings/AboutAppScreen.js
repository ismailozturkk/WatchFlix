// screens/tabs/settings/AboutAppScreen.js
//
// Ayarlar > Hakkında > Uygulama Bilgisi, SSS ve Destek Ekranı.
// Uygulama hakkında kapsamlı bilgi, akordiyon tipi SSS (Sıkça Sorulan Sorular)
// ve doğrudan e-posta/destek erişim butonları sunar.

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
    StyleSheet,
  Linking,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import TmdbLogo from "@components/TmdbLogo";
import Toast from "react-native-toast-message";
import { useNavigation } from "@react-navigation/native";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import { legalUrl, SUPPORT_EMAIL } from "@utils/legalLinks";
import { SettingsSubScreen, buildUiColors } from "./settingsUi";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const APP_VERSION = "v1.21.1";

export default function AboutAppScreen() {
  const navigation = useNavigation();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const isTr = language === "tr";

  const [expandedFaq, setExpandedFaq] = useState(null);

  const toggleFaq = (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const handleSendEmail = async () => {
    const subject = encodeURIComponent(
      isTr
        ? `Seelogd Destek & Geri Bildirim (${APP_VERSION})`
        : `Seelogd Support & Feedback (${APP_VERSION})`
    );
    const body = encodeURIComponent(
      isTr
        ? "\n\n---\nCihaz Bilgisi: " + Platform.OS + " " + Platform.Version
        : "\n\n---\nDevice Info: " + Platform.OS + " " + Platform.Version
    );
    const mailUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

    try {
      const canOpen = await Linking.canOpenURL(mailUrl);
      if (canOpen) {
        await Linking.openURL(mailUrl);
      } else {
        copyEmailToClipboard();
      }
    } catch (e) {
      copyEmailToClipboard();
    }
  };

  /* Yasal sayfa iki dili tek dosyada tutuyor ve dili tarayıcıdan seçiyor.
     ?lang= ile uygulamanın dilini geçiyoruz; aksi halde Türkçe uygulamayı
     İngilizce cihazda kullanan biri metni İngilizce görürdü. */
  const openLegalPage = async (page) => {
    // URL kurulumu utils/legalLinks.js'te; buradaki açma yolu KALIYOR çünkü
    // panoya kopyalayan yedeği var (tarayıcı açılmazsa bağlantı kaybolmasın).
    const url = legalUrl(page, isTr ? "tr" : "en");
    try {
      await Linking.openURL(url);
    } catch (e) {
      // Tarayıcı yoksa/açılmazsa bağlantı en azından panoda kalsın.
      await Clipboard.setStringAsync(url);
      Toast.show({
        type: "info",
        text1: isTr ? "Bağlantı Kopyalandı" : "Link Copied",
        text2: url,
      });
    }
  };

  const copyEmailToClipboard = async () => {
    await Clipboard.setStringAsync(SUPPORT_EMAIL);
    Toast.show({
      type: "info",
      text1: isTr ? "E-Posta Kopyalandı" : "Email Copied",
      text2: isTr
        ? `${SUPPORT_EMAIL} adresi panoya kopyalandı.`
        : `${SUPPORT_EMAIL} has been copied to clipboard.`,
    });
  };

  const FAQS = [
    {
      q: isTr
        ? "Seelogd nedir ve nasıl kullanılır?"
        : "What is Seelogd and how does it work?",
      a: isTr
        ? "Seelogd, izlediğiniz film ve dizileri takip edebileceğiniz, özel listeler oluşturabileceğiniz, puan verip yorum yapabileceğiniz ve arkadaşlarınızla etkileşimde bulunabileceğiniz sosyal medya platformudur."
        : "Seelogd is a social media and tracking platform where you can log movies & TV shows, build custom lists, rate, review, and connect with friends.",
      icon: "film-outline",
    },
    {
      q: isTr
        ? "Film ve dizileri nasıl kaydederim?"
        : "How do I save movies and TV shows?",
      a: isTr
        ? "Arama sekmesini kullanarak istediğiniz yapımı aratın. Detay sayfasındaki 'Listelerime Ekle' veya durum butonlarını (İzledim, İzleyeceğim, Favoriler) kullanarak kaydınızı oluşturabilirsiniz."
        : "Use the Search tab to find any media. On the detail screen, press 'Add to Lists' or status buttons (Watched, Watchlist, Favorites) to save.",
      icon: "bookmark-outline",
    },
    {
      q: isTr
        ? "Seviye ve rozet sistemi nasıl çalışır?"
        : "How does the level and badge system work?",
      a: isTr
        ? "İçerik izledikçe, değerlendirme yaptıkça, serileri tamamladıkça XP (deneyim puanı) kazanırsınız. XP topladıkça seviyeniz yükselir ve profilinizde sergileyebileceğiniz özel rozetlerin kilidi açılır."
        : "You earn XP by logging media, leaving ratings, and completing franchises. As your XP increases, your level goes up and exclusive badges unlock.",
      icon: "trophy-outline",
    },
    {
      q: isTr
        ? "Seelogd Premium avantajları nelerdir?"
        : "What are Seelogd Premium benefits?",
      a: isTr
        ? "Premium üyeler; reklamsız deneyim, özel altın profil kartları, sınırsız AI SineKayıt önerileri, özel rozetler ve detaylı izleme analitiği elde eder."
        : "Premium members enjoy an ad-free experience, exclusive gold profile styling, unlimited AI recommendations, custom badges, and advanced analytics.",
      icon: "star-outline",
    },
    {
      q: isTr
        ? "Listelerimi arkadaşlarımla nasıl paylaşırım?"
        : "How do I share my lists with friends?",
      a: isTr
        ? "Herhangi bir listenizin veya detay kartının sağ üst köşesindeki 'Paylaş' butonuna basarak bağlantı linki veya hikaye görseli (Story Card) şeklinde paylaşım yapabilirsiniz."
        : "Tap the 'Share' icon on any list or detail card to share it as a direct link or a high-quality Story Card image.",
      icon: "share-social-outline",
    },
    {
      q: isTr
        ? "Bildirimler gelmiyor, ne yapmalıyım?"
        : "I'm not receiving notifications, what should I do?",
      a: isTr
        ? "Ayarlar > İzinler & Veriler menüsünden uygulama izinlerini kontrol edin. Ayrıca cihazınızın Pil Tasarrufu modunun Seelogd arka plan işlemlerini kısıtlamadığından emin olun."
        : "Check app permissions under Settings > Permissions & Data. Also ensure device battery optimization doesn't restrict background processes for Seelogd.",
      icon: "notifications-outline",
    },
    {
      q: isTr
        ? "Verilerim ve gizliliğim güvende mi?"
        : "Is my data and privacy secure?",
      a: isTr
        ? "Tüm verileriniz Firebase ve bulut sunucularımızda şifrelenmiş olarak saklanır. Kişisel bilgileriniz hiçbir şekilde 3. şahıslarla paylaşılmaz veya satılmaz."
        : "All your data is encrypted and stored on Firebase and cloud servers. Personal info is never shared or sold to third parties.",
      icon: "shield-checkmark-outline",
    },
  ];

  const LEGAL_ROWS = [
    {
      key: "privacy",
      title: isTr ? "Gizlilik Politikası" : "Privacy Policy",
      sub: isTr
        ? "Hangi verileri topluyoruz, nasıl kullanıyoruz"
        : "What data we collect and how we use it",
      icon: "shield-checkmark-outline",
      color: C.blue,
      bg: C.iconBlue,
      external: true,
      onPress: () => openLegalPage("privacy.html"),
    },
    {
      key: "terms",
      title: isTr ? "Kullanım Şartları" : "Terms of Use",
      sub: isTr
        ? "Hesap kuralları, içerik ve abonelik şartları"
        : "Account rules, content and subscription terms",
      icon: "reader-outline",
      color: C.purple,
      bg: C.iconPurple,
      external: true,
      onPress: () => openLegalPage("terms.html"),
    },
    {
      key: "oss",
      title: isTr ? "Açık Kaynak Lisansları" : "Open Source Licenses",
      sub: isTr
        ? "Kullanılan kütüphaneler ve lisans metinleri"
        : "Third-party libraries and open source terms",
      icon: "document-text-outline",
      color: C.teal,
      bg: C.iconTeal,
      external: false,
      onPress: () => navigation.navigate("OpenSourceLicensesScreen"),
    },
  ];

  const FEATURES = [
    {
      title: isTr ? "Akıllı Takip & Düzen" : "Smart Tracking",
      desc: isTr
        ? "Sezon ve bölüm bazlı otomatik izleme takibi"
        : "Automated season and episode progress tracking",
      icon: "tv-outline",
      color: C.blue,
      bg: C.iconBlue,
    },
    {
      title: isTr ? "Yapay Zeka Desteği" : "AI Recommendations",
      desc: isTr
        ? "Zevkinize özel AI CineCards öneri motoru"
        : "Personalized AI CineCards recommendation engine",
      icon: "sparkles-outline",
      color: C.purple,
      bg: C.iconPurple,
    },
    {
      title: isTr ? "Oyunlaştırma & Turnuva" : "Gamification & Cups",
      desc: isTr
        ? "Rozetler, seviyeler ve film turnuvaları"
        : "Badges, level progression, and movie brackets",
      icon: "ribbon-outline",
      color: C.amber,
      bg: C.iconAmber,
    },
    {
      title: isTr ? "Sosyal Etkileşim" : "Social & Community",
      desc: isTr
        ? "Gruplar, mesajlaşma, anketler ve ortak listeler"
        : "Groups, direct chat, polls, and shared lists",
      icon: "people-outline",
      color: C.green,
      bg: C.iconGreen,
    },
  ];

  return (
    <SettingsSubScreen
      title={isTr ? "Uygulama Bilgisi & SSS" : "App Info & FAQ"}
    >
      {/* 🚀 Hero Banner */}
      <View style={[styles.heroCard, { borderColor: C.border }]}>
        <LinearGradient
          colors={[C.cardAlt, C.card]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
          <View style={[styles.appIconWrap, { borderColor: C.border }]}>
            <Image
              source={require("../../../assets/android-icon-foreground.png")}
              style={{ width: 54, height: 54 }}
              contentFit="contain"
            />
          </View>
          <View style={styles.heroInfo}>
            <Text allowFontScaling={false} style={[styles.appName, { color: C.text }]}>
              Seelogd
            </Text>
            <Text allowFontScaling={false} style={[styles.appTagline, { color: C.muted }]}>
              {isTr
                ? "Film & Dizi Sosyal Takip ve Keşif Platformu"
                : "Movie & TV Social Tracking & Discovery"}
            </Text>
            <View style={styles.badgeRow}>
              <View style={[styles.verBadge, { backgroundColor: C.accentDim }]}>
                <Text style={[styles.verText, { color: C.accent }]}>
                  {APP_VERSION}
                </Text>
              </View>
              <View style={[styles.verBadge, { backgroundColor: C.iconGreen }]}>
                <Text style={[styles.verText, { color: C.green }]}>
                  {isTr ? "Güncel Sürüm" : "Latest Build"}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* ✉️ Destek ve İletişim */}
      <Text allowFontScaling={false} style={[styles.sectionHeader, { color: C.muted }]}>
        {isTr ? "DESTEK VE İLETİŞİM" : "SUPPORT & CONTACT"}
      </Text>
      <View
        style={[
          styles.supportCard,
          { backgroundColor: C.card, borderColor: C.border },
        ]}
      >
        <View style={styles.supportHeader}>
          <View style={[styles.supportIconWrap, { backgroundColor: C.iconBlue }]}>
            <AppIcon name="headset-outline" size={22} color={C.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              allowFontScaling={false}
              style={[styles.supportTitle, { color: C.text }]}
            >
              {isTr ? "Yardıma mı ihtiyacınız var?" : "Need Help or Have Ideas?"}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.supportSub, { color: C.muted }]}
            >
              {isTr
                ? "Sorularınız, hata bildirimleriniz ve önerileriniz için ekibimize e-posta atabilirsiniz."
                : "Contact our team for inquiries, bug reports, or feature requests."}
            </Text>
          </View>
        </View>

        <View style={styles.supportActions}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSendEmail}
            style={[styles.btnSupportPrimary, { backgroundColor: C.accent }]}
          >
            <AppIcon name="mail" size={16} color="#FFFFFF" />
            <Text allowFontScaling={false} style={styles.btnSupportPrimaryText}>
              {isTr ? "Destek Ekibine E-Posta At" : "Email Support Team"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={copyEmailToClipboard}
            style={[
              styles.btnSupportSecondary,
              { backgroundColor: C.cardAlt, borderColor: C.border },
            ]}
          >
            <AppIcon name="copy-outline" size={15} color={C.text} />
            <Text
              allowFontScaling={false}
              style={[styles.btnSupportSecondaryText, { color: C.text }]}
            >
              {SUPPORT_EMAIL}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 📄 Lisanslar & Yasal */}
      <Text allowFontScaling={false} style={[styles.sectionHeader, { color: C.muted }]}>
        {isTr ? "YASAL VE LİSANSLAR" : "LEGAL & LICENSES"}
      </Text>
      <View
        style={[
          styles.legalCard,
          { backgroundColor: C.card, borderColor: C.border },
        ]}
      >
        {LEGAL_ROWS.map((row, index) => {
          const isLast = index === LEGAL_ROWS.length - 1;
          return (
            <TouchableOpacity
              key={row.key}
              activeOpacity={0.7}
              onPress={row.onPress}
              style={[
                styles.legalRow,
                !isLast && {
                  borderBottomWidth: 1,
                  borderBottomColor: C.borderMuted,
                },
              ]}
            >
              <View style={[styles.legalIconWrap, { backgroundColor: row.bg }]}>
                <AppIcon name={row.icon} size={18} color={row.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  allowFontScaling={false}
                  style={[styles.legalTitle, { color: C.text }]}
                >
                  {row.title}
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[styles.legalSub, { color: C.muted }]}
                >
                  {row.sub}
                </Text>
              </View>
              {/* Tarayıcıda açılan satırlar ayrı ikon alır: kullanıcı
                  uygulamadan çıkacağını basmadan önce görsün. */}
              <AppIcon
                name={row.external ? "open-outline" : "chevron-forward"}
                size={16}
                color={C.muted}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ❓ Sıkça Sorulan Sorular (SSS) */}
      <Text allowFontScaling={false} style={[styles.sectionHeader, { color: C.muted }]}>
        {isTr ? "SIKÇA SORULAN SORULAR (SSS)" : "FREQUENTLY ASKED QUESTIONS"}
      </Text>
      <View
        style={[
          styles.faqContainer,
          { backgroundColor: C.card, borderColor: C.border },
        ]}
      >
        {FAQS.map((faq, index) => {
          const isOpen = expandedFaq === index;
          const isLast = index === FAQS.length - 1;
          return (
            <View
              key={index}
              style={[
                styles.faqItem,
                !isLast && { borderBottomWidth: 1, borderBottomColor: C.borderMuted },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => toggleFaq(index)}
                style={styles.faqHeader}
              >
                <View style={[styles.faqIconWrap, { backgroundColor: C.accentDim }]}>
                  <AppIcon name={faq.icon} size={16} color={C.accent} />
                </View>
                <Text
                  allowFontScaling={false}
                  style={[styles.faqQuestion, { color: C.text }]}
                >
                  {faq.q}
                </Text>
                <AppIcon
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={C.muted}
                />
              </TouchableOpacity>
              {isOpen && (
                <View style={styles.faqBody}>
                  <Text
                    allowFontScaling={false}
                    style={[styles.faqAnswer, { color: C.muted }]}
                  >
                    {faq.a}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* 📜 Telif & Atıflar */}
      <View style={styles.footerAttribution}>
        <TmdbLogo width={76} style={{ alignSelf: "center", marginBottom: 6 }} />
        <Text
          allowFontScaling={false}
          style={[styles.attributionText, { color: C.muted }]}
        >
          {isTr
            ? "Bu ürün TMDB API kullanır ancak TMDB tarafından onaylanmamış veya sertifikalandırılmamıştır."
            : "This product uses the TMDB API but is not endorsed or certified by TMDB."}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.attributionText, { marginTop: 4, color: C.muted }]}
        >
          Watch provider data powered by JustWatch
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.copyrightText, { color: C.muted }]}
        >
          {i18nText("autoI18n.created_by_with_app", "Oluşturan: İsmail Öztürk · © 2025 Seelogd")}
        </Text>
      </View>
    </SettingsSubScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 20,
  },
  heroGradient: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  appIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00000022",
  },
  heroInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  appTagline: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 15,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  verBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verText: {
    fontSize: 10,
    fontWeight: "700",
  },
  sectionHeader: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 12,
  },
  legalCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 4,
    marginBottom: 20,
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  legalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  legalTitle: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  legalSub: {
    fontSize: 11,
    marginTop: 2,
  },
  faqContainer: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 20,
  },
  faqItem: {
    paddingHorizontal: 14,
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 10,
  },
  faqIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  faqQuestion: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
  },
  faqBody: {
    paddingBottom: 14,
    paddingLeft: 38,
    paddingRight: 10,
  },
  faqAnswer: {
    fontSize: 12,
    lineHeight: 18,
  },
  supportCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  supportHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  supportIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  supportTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    marginBottom: 3,
  },
  supportSub: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  supportActions: {
    gap: 8,
  },
  btnSupportPrimary: {
    height: 42,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnSupportPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  btnSupportSecondary: {
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnSupportSecondaryText: {
    fontSize: 12,
    fontWeight: "600",
  },
  footerAttribution: {
    alignItems: "center",
    paddingBottom: 20,
  },
  attributionText: {
    fontSize: 9.5,
    textAlign: "center",
    lineHeight: 13,
    maxWidth: "85%",
  },
  copyrightText: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 12,
  },
});
