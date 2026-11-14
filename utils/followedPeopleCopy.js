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
  de: {
    button: {
      follow: "Folgen",
      following: "Folge ich",
      followHint: "Du siehst ihre kommenden Projekte im Tab „Filme & Serien“",
      unfollowHint: "Tippen zum Entfolgen",
      followLabel: (name) => `${name} folgen`,
      unfollowLabel: (name) => `${name} entfolgen`,
    },
    toast: {
      followed: (name) => `Du folgst ${name}`,
      followedHint: "Ihre kommenden Arbeiten erscheinen im Tab „Filme & Serien“",
      unfollowed: (name) => `${name} entfolgt`,
      limit: (max) => `Du kannst bis zu ${max} Personen folgen`,
      limitHint: "Entfolge jemandem, um Platz zu schaffen",
    },
    rail: {
      title: "Anstehendes von Personen, denen du folgst",
      more: (count) => `+${count}`,
      manage: "Personen, denen ich folge",
      addToCalendar: (title) => `Erscheinungstag von ${title} zum Telefonkalender hinzufügen`,
      removeFromCalendar: (title) => `Erscheinungstag von ${title} aus dem Telefonkalender entfernen`,
      addAll: "Alle anstehenden Termine zum Telefonkalender hinzufügen",
      quietTitle: "Nichts Anstehendes von Personen, denen du folgst",
      quietBody: (count) => (count === 1 ? "Du folgst 1 Person" : `Du folgst ${count} Personen`),
    },
    sheet: {
      title: "Personen, denen ich folge",
      count: (count, max) => `${count}/${max}`,
      empty: "Du folgst noch niemandem",
      emptyHint: "Tippe auf der Seite eines Schauspielers oder Regisseurs auf „Folgen“, dann sammeln sich seine neuen Projekte hier.",
      unfollowLabel: (name) => `${name} entfolgen`,
      open: (name) => `Seite von ${name} öffnen`,
      departments: {
        Acting: "Schauspieler",
        Directing: "Regie",
        Writing: "Drehbuch",
        Production: "Produktion",
        other: "Person",
      },
      close: "Schließen",
    },
  },

  it: {
  button: {
    follow: "Segui",
    following: "Successivo",
    followHint: "Vedrai i loro prossimi progetti nella scheda Film e programmi",
    unfollowHint: "Tocca per smettere di seguire",
    followLabel: name => `Segui ${name}`,
    unfollowLabel: name => `Smetti di seguire ${name}`
  },
  toast: {
    followed: name => `Segui ${name}`,
    followedHint: "I loro prossimi lavori verranno visualizzati nella scheda Film e programmi",
    unfollowed: name => `Non seguiti ${name}`,
    limit: max => `Puoi seguire fino a ${max} persone`,
    limitHint: "Smetti di seguire qualcuno per fare spazio"
  },
  rail: {
    title: "Prossimi dalle persone che segui",
    more: count => `+${count}`,
    manage: "Persone che seguo",
    addToCalendar: title => `Aggiungi ${title} giorno di uscita al calendario del tuo telefono`,
    removeFromCalendar: title => `Rimuovi ${title} giorno di uscita dal calendario del tuo telefono`,
    addAll: "Aggiungi tutte le imminenti al calendario del tuo telefono",
    quietTitle: "Niente in arrivo dalle persone che segui",
    quietBody: count => count === 1 ? "Segui 1 persona" : `Segui ${count} persone`
  },
  sheet: {
    title: "Persone che seguo",
    count: (count, max) => `${count}/${max}`,
    empty: "Non stai ancora seguendo nessuno",
    emptyHint: "Tocca \"Segui\" sulla pagina di un attore o regista e i suoi nuovi progetti verranno raccolti qui.",
    unfollowLabel: name => `Smetti di seguire ${name}`,
    open: name => `Apri la pagina di ${name}`,
    departments: {
      Acting: "Attore",
      Directing: "Direttore",
      Writing: "Scrittore",
      Production: "Produttore",
      other: "Persona"
    },
    close: "Chiudi"
  }
},
  fr: {
    button: {
      follow: "Suivre",
      following: "Abonnements",
      followHint: "Tu verras ses prochains projets dans l'onglet Films et séries",
      unfollowHint: "Touche pour ne plus suivre",
      followLabel: (name) => `Suivre ${name}`,
      unfollowLabel: (name) => `Ne plus suivre ${name}`,
    },
    toast: {
      followed: (name) => `Tu suis ${name}`,
      followedHint: "Ses prochains projets s'afficheront dans l'onglet Films et séries",
      unfollowed: (name) => `Tu ne suis plus ${name}`,
      limit: (max) => `Tu peux suivre jusqu'à ${max} personnes`,
      limitHint: "Arrête de suivre quelqu'un pour faire de la place",
    },
    rail: {
      title: "À venir des personnes que tu suis",
      more: (count) => `+${count}`,
      manage: "Personnes que je suis",
      addToCalendar: (title) => `Ajouter la date de sortie de ${title} au calendrier du téléphone`,
      removeFromCalendar: (title) => `Retirer la date de sortie de ${title} du calendrier du téléphone`,
      addAll: "Ajouter toutes les sorties à venir au calendrier du téléphone",
      quietTitle: "Rien à venir des personnes que tu suis",
      quietBody: (count) => (count === 1 ? "Tu suis 1 personne" : `Tu suis ${count} personnes`),
    },
    sheet: {
      title: "Personnes que je suis",
      count: (count, max) => `${count}/${max}`,
      empty: "Tu ne suis encore personne",
      emptyHint: "Touche « Suivre » sur la page d'un acteur ou d'un réalisateur et ses nouveaux projets s'accumuleront ici.",
      unfollowLabel: (name) => `Ne plus suivre ${name}`,
      open: (name) => `Ouvrir la page de ${name}`,
      departments: {
        Acting: "Acteur",
        Directing: "Réalisateur",
        Writing: "Scénariste",
        Production: "Producteur",
        other: "Personne",
      },
      close: "Fermer",
    },
  },
  ja: {
    button: {
      follow: "フォロー",
      following: "フォロー中",
      followHint: "映画&番組タブで今後の作品が表示されます",
      unfollowHint: "タップでフォロー解除",
      followLabel: (name) => `${name}をフォロー`,
      unfollowLabel: (name) => `${name}のフォローを解除`,
    },
    toast: {
      followed: (name) => `${name}をフォロー中`,
      followedHint: "今後の作品が映画&番組タブに表示されます",
      unfollowed: (name) => `${name}のフォローを解除しました`,
      limit: (max) => `フォローできるのは最大${max}人です`,
      limitHint: "誰かのフォローを解除して枠を空けてください",
    },
    rail: {
      title: "フォロー中の人の新作予定",
      more: (count) => `+${count}`,
      manage: "フォロー中の人",
      addToCalendar: (title) => `${title}の公開日をスマホのカレンダーに追加`,
      removeFromCalendar: (title) => `${title}の公開日をスマホのカレンダーから削除`,
      addAll: "今後の予定をすべてスマホのカレンダーに追加",
      quietTitle: "フォロー中の人の新作予定はありません",
      quietBody: (count) => (count === 1 ? "1人をフォロー中" : `${count}人をフォロー中`),
    },
    sheet: {
      title: "フォロー中の人",
      count: (count, max) => `${count}/${max}`,
      empty: "まだ誰もフォローしていません",
      emptyHint: "俳優や監督のページで「フォロー」をタップすると、新しい作品がここに集まります。",
      unfollowLabel: (name) => `${name}のフォローを解除`,
      open: (name) => `${name}のページを開く`,
      departments: {
        Acting: "俳優",
        Directing: "監督",
        Writing: "脚本",
        Production: "製作",
        other: "人物",
      },
      close: "閉じる",
    },
  }};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getFollowedPeopleCopy = (language) =>
  FOLLOWED_PEOPLE_COPY[copyLanguage(language, Object.keys(FOLLOWED_PEOPLE_COPY))];

/** TMDB `known_for_department` → etiket (bilinmeyen bölüm "Kişi"). */
export const departmentLabel = (copy, department) =>
  copy.sheet.departments[department] ?? copy.sheet.departments.other;
