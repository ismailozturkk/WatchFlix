// screens/tabs/settings/AboutAppScreen.js
//
// Ayarlar > Hakkında > Uygulama Bilgisi, SSS ve Destek Ekranı.
// Uygulama hakkında kapsamlı bilgi, akordiyon tipi SSS (Sıkça Sorulan Sorular)
// ve doğrudan e-posta/destek erişim butonları sunar.

import { normalizeAppLanguage } from "../../../utils/appLanguages";
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
import Constants from "expo-constants";
import AppIcon from "@components/AppIcon";
import TmdbLogo from "@components/TmdbLogo";
import Toast from "@components/AppToast";
import { useNavigation } from "@react-navigation/native";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import { legalUrl, SUPPORT_EMAIL } from "@utils/legalLinks";
import { SettingsSubScreen, buildUiColors } from "./settingsUi";
import useAppLogo from "@hooks/useAppLogo";
import GlassTouchable from "../../../components/common/GlassTouchable";
import GlassBox from "../../../components/common/GlassBox";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Sürüm TEK KAYNAKTAN: app.json → expo.version. Buraya elle yazılan dize
// ("v1.21.1") gerçek sürümden kopmuştu ve destek e-postasının konusuna da
// yanlış sürüm giriyordu — kullanıcı hangi build'i kullandığını söyleyemiyordu.
const APP_VERSION = `v${Constants.expoConfig?.version ?? "1.4.5"}`;

export default function AboutAppScreen() {
  // Marka logosu seçili uygulama simgesini izler (hooks/useAppLogo.js).
  const { logo: appLogo } = useAppLogo();
  const navigation = useNavigation();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const isTr = language === "tr";
  const es = normalizeAppLanguage(language) === "es";
  const pt = normalizeAppLanguage(language) === "pt";

  const [expandedFaq, setExpandedFaq] = useState(null);

  const toggleFaq = (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const handleSendEmail = async () => {
    const subject = encodeURIComponent(
      isTr ? `Seelogd Destek & Geri Bildirim (${APP_VERSION})` : es ? `Soporte y comentarios de Seelogd (${APP_VERSION})` : pt ? `Suporte e feedback do Seelogd (${APP_VERSION})` : `Seelogd Support & Feedback (${APP_VERSION})`
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
    const url = legalUrl(page, language);
    try {
      await Linking.openURL(url);
    } catch (e) {
      // Tarayıcı yoksa/açılmazsa bağlantı en azından panoda kalsın.
      await Clipboard.setStringAsync(url);
      Toast.show({
        type: "info",
        text1: isTr ? "Bağlantı Kopyalandı" : es ? "Enlace copiado" : pt ? "Link copiado" : "Link Copied",
        text2: url,
      });
    }
  };

  const copyEmailToClipboard = async () => {
    await Clipboard.setStringAsync(SUPPORT_EMAIL);
    Toast.show({
      type: "info",
      text1: isTr ? "E-Posta Kopyalandı" : es ? "Correo copiado" : pt ? "E-mail copiado" : "Email Copied",
      text2: isTr ? `${SUPPORT_EMAIL} adresi panoya kopyalandı.` : es ? `${SUPPORT_EMAIL} se ha copiado al portapapeles.` : pt ? `${SUPPORT_EMAIL} foi copiado para a área de transferência.` : `${SUPPORT_EMAIL} has been copied to clipboard.`,
    });
  };

  const FAQS = [
    {
      q: isTr ? "Seelogd nedir ve nasıl kullanılır?" : es ? "¿Qué es Seelogd y cómo funciona?" : pt ? "O que é o Seelogd e como funciona?" : "What is Seelogd and how does it work?",
      a: isTr ? "Seelogd, izlediğiniz film ve dizileri takip edebileceğiniz, özel listeler oluşturabileceğiniz, puan verip yorum yapabileceğiniz ve arkadaşlarınızla etkileşimde bulunabileceğiniz sosyal medya platformudur." : es ? "Seelogd es una plataforma social de seguimiento donde puedes registrar películas y series, crear listas personalizadas, puntuar, reseñar y conectar con amigos." : pt ? "O Seelogd é uma plataforma social de acompanhamento onde você pode registrar filmes e séries, criar listas personalizadas, dar notas, escrever avaliações e se conectar com amigos." : "Seelogd is a social media and tracking platform where you can log movies & TV shows, build custom lists, rate, review, and connect with friends.",
      icon: "film-outline",
    },
    {
      q: isTr ? "Film ve dizileri nasıl kaydederim?" : es ? "¿Cómo guardo películas y series?" : pt ? "Como salvo filmes e séries?" : "How do I save movies and TV shows?",
      a: isTr ? "Arama sekmesini kullanarak istediğiniz yapımı aratın. Detay sayfasındaki 'Listelerime Ekle' veya durum butonlarını (İzledim, İzleyeceğim, Favoriler) kullanarak kaydınızı oluşturabilirsiniz." : es ? "Usa la pestaña Buscar para encontrar cualquier título. En la pantalla de detalles, pulsa «Añadir a la lista» o los botones de estado (Visto, Lista de seguimiento, Favoritos) para guardarlo." : pt ? "Use a aba Buscar para encontrar qualquer título. Na tela de detalhes, toque em «Adicionar à lista» ou nos botões de status (Assistido, Lista para assistir, Favoritos) para salvá-lo." : "Use the Search tab to find any media. On the detail screen, press 'Add to Lists' or status buttons (Watched, Watchlist, Favorites) to save.",
      icon: "bookmark-outline",
    },
    {
      q: isTr ? "Seviye ve rozet sistemi nasıl çalışır?" : es ? "¿Cómo funcionan los niveles y las insignias?" : pt ? "Como funcionam os níveis e os emblemas?" : "How does the level and badge system work?",
      a: isTr ? "İçerik izledikçe, değerlendirme yaptıkça, serileri tamamladıkça XP (deneyim puanı) kazanırsınız. XP topladıkça seviyeniz yükselir ve profilinizde sergileyebileceğiniz özel rozetlerin kilidi açılır." : es ? "Ganas XP al registrar títulos, dejar puntuaciones y completar sagas. A medida que tu XP aumenta, subes de nivel y se desbloquean insignias exclusivas." : pt ? "Você ganha XP ao registrar títulos, dar notas e completar sagas. Conforme seu XP aumenta, você sobe de nível e desbloqueia emblemas exclusivos." : "You earn XP by logging media, leaving ratings, and completing franchises. As your XP increases, your level goes up and exclusive badges unlock.",
      icon: "trophy-outline",
    },
    {
      q: isTr ? "Seelogd Premium avantajları nelerdir?" : es ? "¿Qué ventajas tiene Seelogd Premium?" : pt ? "Quais são as vantagens do Seelogd Premium?" : "What are Seelogd Premium benefits?",
      a: isTr ? "Free plan; günde 3 / ayda 30 CineMatch AI mesajı, 2 arkadaş, 1 sohbet grubu, dört hazır liste ve 1 özel liste, 5 not, 5 yapılacak, 20 film ve 20 dizi notu, 10 film ve 20 dizi hatırlatması sunar; turnuvayı izleyebilir, Wrapped arşivinde yalnız bu yılı görürsün. Premium; günde 20 / ayda 300 AI mesajı, arkadaşlarının da gördüğü kimlik rozeti, çok daha yüksek liste, arkadaş, grup, not ve hatırlatma limitleri, oyunlar, CineSwipe, turnuvada oy kullanma, kendi temanı oluşturma, tüm yazı tipleri, uygulama simgesi, kar efekti, ikon arka planı, pet, Wrapped arşivinde son 5 yıl, uygulama içinden hata bildirimi ve 100 başlığa kadar platform bildirimi sunar. Premium Max günde 50 / ayda 900 AI mesajı, efsanevi rozet, Wrapped'ta tüm yıllar, özellik isteği gönderme ve sınırsız liste, arkadaş, grup, not, hatırlatma ve oyun ekler. Ne kadarını kullandığını Ayarlar > Kullanım ve haklar ekranında, tüm limitleri Premium ekranındaki karşılaştırmada görebilirsin." : es ? "El plan Gratis incluye 3 mensajes de IA de CineMatch al día / 30 al mes, 2 amigos, 1 chat de grupo, las cuatro listas integradas más 1 lista personalizada, 5 notas, 5 listas de tareas, 20 notas de películas y 20 de series, y 10 recordatorios de películas y 20 de series; puedes seguir el torneo y solo ves este año en Wrapped. Premium añade 20 mensajes de IA al día / 300 al mes, una insignia de identidad que ven tus amigos, límites mucho más altos de listas, amigos, grupos, notas y recordatorios, juegos, CineSwipe, votación en el torneo, tus propios temas, todas las fuentes, el selector de icono de la app, nieve, fondo de iconos, la mascota en pantalla, el archivo de Wrapped de los últimos 5 años, informes de errores desde la app y avisos de streaming para hasta 100 títulos. Premium Max añade 50 mensajes de IA al día / 900 al mes, una insignia legendaria, todos los años de Wrapped, solicitudes de funciones y listas, amigos, grupos, notas, recordatorios y juegos ilimitados. Consulta tu uso en Ajustes > Uso y límites, y todos los límites en la comparación de la pantalla Premium." : pt ? "O plano Grátis inclui 3 mensagens de IA do CineMatch por dia / 30 por mês, 2 amigos, 1 conversa em grupo, as quatro listas integradas mais 1 lista personalizada, 5 notas, 5 listas de tarefas, 20 notas de filmes e 20 de séries, e 10 lembretes de filmes e 20 de séries; você pode acompanhar o torneio e vê só o ano atual no Wrapped. O Premium acrescenta 20 mensagens de IA por dia / 300 por mês, um emblema de identidade que seus amigos veem, limites muito maiores de listas, amigos, grupos, notas e lembretes, jogos, CineSwipe, votação no torneio, seus próprios temas, todas as fontes, o seletor de ícone do app, neve, fundo de ícones, o pet na tela, o arquivo do Wrapped dos últimos 5 anos, relatos de erros pelo app e avisos de streaming para até 100 títulos. O Premium Max acrescenta 50 mensagens de IA por dia / 900 por mês, um emblema lendário, todos os anos do Wrapped, pedidos de recursos e listas, amigos, grupos, notas, lembretes e jogos ilimitados. Veja seu uso em Configurações > Uso e limites, e todos os limites na comparação da tela Premium." : "The Free plan includes 3 CineMatch AI messages per day / 30 per month, 2 friends, 1 group chat, the four built-in lists plus 1 custom list, 5 notes, 5 to-do lists, 20 movie and 20 show notes, and 10 movie and 20 show reminders; you can watch the tournament and see only this year in Wrapped. Premium adds 20 AI messages per day / 300 per month, an identity badge your friends can see, much higher list, friend, group, note and reminder limits, games, CineSwipe, tournament voting, your own themes, every font, the app icon picker, snowfall, icon background, the on-screen pet, the Wrapped archive for the last 5 years, in-app bug reports and streaming alerts for up to 100 titles. Premium Max adds 50 AI messages per day / 900 per month, a legendary badge, every Wrapped year, feature requests and unlimited lists, friends, groups, notes, reminders and games. See your usage under Settings > Usage & limits, and every limit in the comparison on the Premium screen.",
      icon: "star-outline",
    },
    {
      q: isTr ? "Listelerimi arkadaşlarımla nasıl paylaşırım?" : es ? "¿Cómo comparto mis listas con mis amigos?" : pt ? "Como compartilho minhas listas com meus amigos?" : "How do I share my lists with friends?",
      a: isTr ? "Herhangi bir listenizin veya detay kartının sağ üst köşesindeki 'Paylaş' butonuna basarak bağlantı linki veya hikaye görseli (Story Card) şeklinde paylaşım yapabilirsiniz." : es ? "Toca el icono «Compartir» en cualquier lista o ficha de detalles para compartirla como enlace directo o como imagen de tarjeta de historia en alta calidad." : pt ? "Toque no ícone «Compartilhar» em qualquer lista ou card de detalhes para compartilhá-lo como link direto ou como imagem de card de story em alta qualidade." : "Tap the 'Share' icon on any list or detail card to share it as a direct link or a high-quality Story Card image.",
      icon: "share-social-outline",
    },
    {
      q: isTr ? "Bildirimler gelmiyor, ne yapmalıyım?" : es ? "No me llegan las notificaciones, ¿qué hago?" : pt ? "As notificações não estão chegando. O que devo fazer?" : "I'm not receiving notifications, what should I do?",
      a: isTr ? "Ayarlar > İzinler & Veriler menüsünden uygulama izinlerini kontrol edin. Ayrıca cihazınızın Pil Tasarrufu modunun Seelogd arka plan işlemlerini kısıtlamadığından emin olun." : es ? "Revisa los permisos de la app en Ajustes > Permisos y datos. Comprueba también que la optimización de batería del dispositivo no restrinja los procesos en segundo plano de Seelogd." : pt ? "Confira as permissões do app em Configurações > Permissões e dados. Verifique também se a otimização de bateria do dispositivo não restringe os processos em segundo plano do Seelogd." : "Check app permissions under Settings > Permissions & Data. Also ensure device battery optimization doesn't restrict background processes for Seelogd.",
      icon: "notifications-outline",
    },
    {
      q: isTr ? "Verilerim ve gizliliğim güvende mi?" : es ? "¿Están seguros mis datos y mi privacidad?" : pt ? "Meus dados e minha privacidade estão seguros?" : "Is my data and privacy secure?",
      a: isTr ? "Verileriniz Google Firebase'de saklanır ve aktarım sırasında şifrelenir. Verilerinizi satmıyoruz ve reklam için kullanmıyoruz. Hizmeti çalıştırmak için gereken sağlayıcılar (Firebase, Sentry, RevenueCat, Google Gemini, TMDB gibi) verinin ilgili kısmını işler; hangi verinin kimde olduğu, ne kadar saklandığı ve haklarınız Gizlilik Politikası'nda yazıyor. Gönderiler, yorumlar ve profil bilgileri gibi paylaştıklarınız tasarım gereği diğer kullanıcılara görünür." : es ? "Tus datos se almacenan en Google Firebase y se cifran en tránsito. No vendemos tus datos ni los usamos para publicidad. Los proveedores necesarios para operar el servicio (Firebase, Sentry, RevenueCat, Google Gemini, TMDB, etc.) tratan la parte correspondiente; qué datos tiene cada uno, cuánto tiempo se conservan y tus derechos figuran en la Política de privacidad. Lo que compartes, como publicaciones, comentarios y datos de perfil, es visible para otros usuarios por diseño." : pt ? "Seus dados ficam armazenados no Google Firebase e são criptografados em trânsito. Não vendemos seus dados nem os usamos para publicidade. Os provedores necessários para operar o serviço (Firebase, Sentry, RevenueCat, Google Gemini, TMDB etc.) tratam a parte correspondente; quais dados cada um tem, por quanto tempo são mantidos e os seus direitos constam na Política de Privacidade. O que você compartilha, como publicações, comentários e dados de perfil, fica visível para outros usuários por design." : "Your data is stored on Google Firebase and encrypted in transit. We don't sell your data or use it for advertising. The providers needed to run the service (Firebase, Sentry, RevenueCat, Google Gemini, TMDB and others) process the relevant part of it; which data each one gets, how long it is kept and your rights are set out in the Privacy Policy. What you share, such as posts, comments and profile details, is visible to other users by design.",
      icon: "shield-checkmark-outline",
    },
  ];

  const LEGAL_ROWS = [
    {
      key: "privacy",
      title: isTr ? "Gizlilik Politikası" : es ? "Política de privacidad" : pt ? "Política de Privacidade" : "Privacy Policy",
      sub: isTr ? "Hangi verileri topluyoruz, nasıl kullanıyoruz" : es ? "Qué datos recopilamos y cómo los usamos" : pt ? "Quais dados coletamos e como os usamos" : "What data we collect and how we use it",
      icon: "shield-checkmark-outline",
      color: C.blue,
      bg: C.iconBlue,
      external: true,
      onPress: () => openLegalPage("privacy.html"),
    },
    {
      key: "terms",
      title: isTr ? "Kullanım Şartları" : es ? "Condiciones de uso" : pt ? "Termos de Uso" : "Terms of Use",
      sub: isTr ? "Hesap kuralları, içerik ve abonelik şartları" : es ? "Normas de la cuenta, contenido y condiciones de suscripción" : pt ? "Regras da conta, do conteúdo e condições da assinatura" : "Account rules, content and subscription terms",
      icon: "reader-outline",
      color: C.purple,
      bg: C.iconPurple,
      external: true,
      onPress: () => openLegalPage("terms.html"),
    },
    {
      key: "oss",
      title: isTr ? "Açık Kaynak Lisansları" : es ? "Licencias de código abierto" : pt ? "Licenças de código aberto" : "Open Source Licenses",
      sub: isTr ? "Kullanılan kütüphaneler ve lisans metinleri" : es ? "Bibliotecas de terceros y condiciones de código abierto" : pt ? "Bibliotecas de terceiros e termos de código aberto" : "Third-party libraries and open source terms",
      icon: "document-text-outline",
      color: C.teal,
      bg: C.iconTeal,
      external: false,
      onPress: () => navigation.navigate("OpenSourceLicensesScreen"),
    },
  ];


  return (
    <SettingsSubScreen
      title={isTr ? "Uygulama Bilgisi & SSS" : es ? "Información de la app y preguntas frecuentes" : pt ? "Informações do app e perguntas frequentes" : "App Info & FAQ"}
    >
      {/* 🚀 Hero Banner */}
      <GlassBox role="card" style={[styles.heroCard, { borderColor: C.border }]}>
        <LinearGradient
          colors={[C.cardAlt, C.card]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
          <View style={[styles.appIconWrap, { borderColor: C.border }]}>
            <Image
              source={appLogo}
              style={{ width: 54, height: 54 }}
              contentFit="contain"
            />
          </View>
          <View style={styles.heroInfo}>
            <Text allowFontScaling={false} style={[styles.appName, { color: C.text }]}>
              Seelogd
            </Text>
            <Text allowFontScaling={false} style={[styles.appTagline, { color: C.muted }]}>
              {isTr ? "Film & Dizi Sosyal Takip ve Keşif Platformu" : es ? "Seguimiento social y descubrimiento de películas y series" : pt ? "Acompanhamento social e descoberta de filmes e séries" : "Movie & TV Social Tracking & Discovery"}
            </Text>
            <View style={styles.badgeRow}>
              <View style={[styles.verBadge, { backgroundColor: C.accentDim }]}>
                <Text style={[styles.verText, { color: C.accent }]}>
                  {APP_VERSION}
                </Text>
              </View>
              <View style={[styles.verBadge, { backgroundColor: C.iconGreen }]}>
                <Text style={[styles.verText, { color: C.green }]}>
                  {isTr ? "Güncel Sürüm" : es ? "Última versión" : pt ? "Última versão" : "Latest Build"}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </GlassBox>

      {/* ✉️ Destek ve İletişim */}
      <Text allowFontScaling={false} style={[styles.sectionHeader, { color: C.muted }]}>
        {isTr ? "DESTEK VE İLETİŞİM" : es ? "SOPORTE Y CONTACTO" : pt ? "SUPORTE E CONTATO" : "SUPPORT & CONTACT"}
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
              {isTr ? "Yardıma mı ihtiyacınız var?" : es ? "¿Necesitas ayuda o tienes ideas?" : pt ? "Precisa de ajuda ou tem ideias?" : "Need Help or Have Ideas?"}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.supportSub, { color: C.muted }]}
            >
              {isTr ? "Sorularınız, hata bildirimleriniz ve önerileriniz için ekibimize e-posta atabilirsiniz." : es ? "Escribe a nuestro equipo para consultas, informes de errores o solicitudes de funciones." : pt ? "Escreva para nossa equipe com dúvidas, relatos de erros ou pedidos de recursos." : "Contact our team for inquiries, bug reports, or feature requests."}
            </Text>
          </View>
        </View>

        <View style={styles.supportActions}>
          <GlassTouchable
            activeOpacity={0.8}
            onPress={handleSendEmail}
            style={[styles.btnSupportPrimary, { backgroundColor: C.accent }]}
          >
            <AppIcon name="mail" size={16} color="#FFFFFF" />
            <Text allowFontScaling={false} style={styles.btnSupportPrimaryText}>
              {isTr ? "Destek Ekibine E-Posta At" : es ? "Escribir al equipo de soporte" : pt ? "Escrever para a equipe de suporte" : "Email Support Team"}
            </Text>
          </GlassTouchable>

          <GlassTouchable
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
          </GlassTouchable>
        </View>
      </View>

      {/* 📄 Lisanslar & Yasal */}
      <Text allowFontScaling={false} style={[styles.sectionHeader, { color: C.muted }]}>
        {isTr ? "YASAL VE LİSANSLAR" : es ? "LEGAL Y LICENCIAS" : pt ? "JURÍDICO E LICENÇAS" : "LEGAL & LICENSES"}
      </Text>
      <GlassBox role="card"
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
      </GlassBox>

      {/* ❓ Sıkça Sorulan Sorular (SSS) */}
      <Text allowFontScaling={false} style={[styles.sectionHeader, { color: C.muted }]}>
        {isTr ? "SIKÇA SORULAN SORULAR (SSS)" : es ? "PREGUNTAS FRECUENTES" : pt ? "PERGUNTAS FREQUENTES" : "FREQUENTLY ASKED QUESTIONS"}
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
          {isTr ? "Bu ürün TMDB API kullanır ancak TMDB tarafından onaylanmamış veya sertifikalandırılmamıştır." : es ? "Este producto utiliza la API de TMDB, pero no está respaldado ni certificado por TMDB." : pt ? "Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB." : "This product uses the TMDB API but is not endorsed or certified by TMDB."}
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
