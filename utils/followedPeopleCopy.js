// utils/followedPeopleCopy.js
//
// "Oyuncu / yönetmen takibi" metinleri (tr / en / es). Saf veri: RN içe aktarması yok,
// jest ile doğrudan test edilebilir. Bkz. utils/favoritesCopy.js — aynı desen.
// __tests__/copyTablesSpanish.test.js üç dilin aynı şekle ve gerçek çeviriye sahip olduğunu denetler.

import { copyLanguage } from "./appLanguages";

export const FOLLOWED_PEOPLE_COPY = {
  tr: {
    button: {
      follow: "Takip et",
      following: "Takipte",
      followHint: "Yeni projeleri Film ve Dizi sekmesinde görürsün",
      unfollowHint: "Takibi bırakmak için dokun",
      // Etiketin kişiyi söylemesi için (ekran okuyucu): "Tom Hanks'i takip et".
      followLabel: (name) => `${name} adlı kişiyi takip et`,
      unfollowLabel: (name) => `${name} adlı kişiyi takipten çıkar`,
    },
    toast: {
      followed: (name) => `${name} takibe alındı`,
      followedHint: "Yaklaşan işleri Film ve Dizi sekmesinde göreceksin",
      unfollowed: (name) => `${name} takipten çıkarıldı`,
      limit: (max) => `En fazla ${max} kişi takip edebilirsin`,
      limitHint: "Yer açmak için birini takipten çıkar",
    },
    rail: {
      title: "Takip ettiklerinin yaklaşanları",
      more: (count) => `+${count}`,
      manage: "Takip ettiklerim",
      addToCalendar: (title) => `${title} yayın gününü telefon takvimine ekle`,
      removeFromCalendar: (title) => `${title} yayın gününü telefon takviminden kaldır`,
      addAll: "Yaklaşanların hepsini telefon takvimine ekle",
      // Takip var ama yaklaşan yok: küçük bilgi satırı (yönetim kapısı kaybolmasın).
      quietTitle: "Takip ettiklerinden yaklaşan yok",
      quietBody: (count) => (count === 1 ? "1 kişiyi takip ediyorsun" : `${count} kişiyi takip ediyorsun`),
    },
    sheet: {
      title: "Takip ettiklerim",
      count: (count, max) => `${count}/${max}`,
      empty: "Henüz kimseyi takip etmiyorsun",
      emptyHint: "Bir oyuncu ya da yönetmenin sayfasında “Takip et”e dokun; yeni projeleri burada toplanır.",
      unfollowLabel: (name) => `${name} adlı kişiyi takipten çıkar`,
      open: (name) => `${name} sayfasını aç`,
      departments: {
        Acting: "Oyuncu",
        Directing: "Yönetmen",
        Writing: "Yazar",
        Production: "Yapımcı",
        other: "Kişi",
      },
      close: "Kapat",
    },
  },
  en: {
    button: {
      follow: "Follow",
      following: "Following",
      followHint: "You'll see their upcoming projects on the Movies & Shows tab",
      unfollowHint: "Tap to unfollow",
      followLabel: (name) => `Follow ${name}`,
      unfollowLabel: (name) => `Unfollow ${name}`,
    },
    toast: {
      followed: (name) => `Following ${name}`,
      followedHint: "Their upcoming work will show on the Movies & Shows tab",
      unfollowed: (name) => `Unfollowed ${name}`,
      limit: (max) => `You can follow up to ${max} people`,
      limitHint: "Unfollow someone to make room",
    },
    rail: {
      title: "Upcoming from people you follow",
      more: (count) => `+${count}`,
      manage: "People I follow",
      addToCalendar: (title) => `Add ${title} release day to your phone calendar`,
      removeFromCalendar: (title) => `Remove ${title} release day from your phone calendar`,
      addAll: "Add all upcoming to your phone calendar",
      quietTitle: "Nothing upcoming from people you follow",
      quietBody: (count) => (count === 1 ? "You follow 1 person" : `You follow ${count} people`),
    },
    sheet: {
      title: "People I follow",
      count: (count, max) => `${count}/${max}`,
      empty: "You're not following anyone yet",
      emptyHint: "Tap “Follow” on an actor's or director's page and their new projects collect here.",
      unfollowLabel: (name) => `Unfollow ${name}`,
      open: (name) => `Open ${name}'s page`,
      departments: {
        Acting: "Actor",
        Directing: "Director",
        Writing: "Writer",
        Production: "Producer",
        other: "Person",
      },
      close: "Close",
    },
  },
  es: {
    button: {
      follow: "Seguir",
      following: "Siguiendo",
      followHint: "Verás sus próximos proyectos en la pestaña de Películas y Series",
      unfollowHint: "Toca para dejar de seguir",
      followLabel: (name) => `Seguir a ${name}`,
      unfollowLabel: (name) => `Dejar de seguir a ${name}`,
    },
    toast: {
      followed: (name) => `Ahora sigues a ${name}`,
      followedHint: "Sus próximos trabajos aparecerán en Películas y Series",
      unfollowed: (name) => `Dejaste de seguir a ${name}`,
      limit: (max) => `Puedes seguir hasta ${max} personas`,
      limitHint: "Deja de seguir a alguien para hacer sitio",
    },
    rail: {
      title: "Próximos de quienes sigues",
      more: (count) => `+${count}`,
      manage: "Personas que sigo",
      addToCalendar: (title) => `Añadir el día de estreno de ${title} al calendario del teléfono`,
      removeFromCalendar: (title) => `Quitar el día de estreno de ${title} del calendario del teléfono`,
      addAll: "Añadir todos los próximos al calendario del teléfono",
      quietTitle: "Nada próximo de quienes sigues",
      quietBody: (count) => (count === 1 ? "Sigues a 1 persona" : `Sigues a ${count} personas`),
    },
    sheet: {
      title: "Personas que sigo",
      count: (count, max) => `${count}/${max}`,
      empty: "Aún no sigues a nadie",
      emptyHint: "Toca “Seguir” en la página de un actor o director y sus nuevos proyectos se reúnen aquí.",
      unfollowLabel: (name) => `Dejar de seguir a ${name}`,
      open: (name) => `Abrir la página de ${name}`,
      departments: {
        Acting: "Actor",
        Directing: "Director",
        Writing: "Guionista",
        Production: "Productor",
        other: "Persona",
      },
      close: "Cerrar",
    },
  },
  pt: {
    button: {
      follow: "Seguir",
      following: "Seguindo",
      followHint: "Você verá os próximos projetos dessa pessoa na aba de Filmes e Séries",
      unfollowHint: "Toque para deixar de seguir",
      followLabel: (name) => `Seguir ${name}`,
      unfollowLabel: (name) => `Deixar de seguir ${name}`,
    },
    toast: {
      followed: (name) => `Agora você segue ${name}`,
      followedHint: "Os próximos trabalhos aparecerão em Filmes e Séries",
      unfollowed: (name) => `Você deixou de seguir ${name}`,
      limit: (max) => `Você pode seguir até ${max} pessoas`,
      limitHint: "Deixe de seguir alguém para abrir espaço",
    },
    rail: {
      title: "Próximos de quem você segue",
      more: (count) => `+${count}`,
      manage: "Pessoas que sigo",
      addToCalendar: (title) => `Adicionar o dia de estreia de ${title} ao calendário do celular`,
      removeFromCalendar: (title) => `Remover o dia de estreia de ${title} do calendário do celular`,
      addAll: "Adicionar todos os próximos ao calendário do celular",
      quietTitle: "Nada próximo de quem você segue",
      quietBody: (count) => (count === 1 ? "Você segue 1 pessoa" : `Você segue ${count} pessoas`),
    },
    sheet: {
      title: "Pessoas que sigo",
      count: (count, max) => `${count}/${max}`,
      empty: "Você ainda não segue ninguém",
      emptyHint: "Toque em “Seguir” na página de um ator ou diretor e os novos projetos dessa pessoa se reúnem aqui.",
      unfollowLabel: (name) => `Deixar de seguir ${name}`,
      open: (name) => `Abrir a página de ${name}`,
      departments: {
        Acting: "Ator",
        Directing: "Diretor",
        Writing: "Roteirista",
        Production: "Produtor",
        other: "Pessoa",
      },
      close: "Fechar",
    },
  },
};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getFollowedPeopleCopy = (language) =>
  FOLLOWED_PEOPLE_COPY[copyLanguage(language, Object.keys(FOLLOWED_PEOPLE_COPY))];

/** TMDB `known_for_department` → etiket (bilinmeyen bölüm "Kişi"). */
export const departmentLabel = (copy, department) =>
  copy.sheet.departments[department] ?? copy.sheet.departments.other;
