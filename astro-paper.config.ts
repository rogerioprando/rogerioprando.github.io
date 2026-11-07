import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://rogerioprando.github.io/",
    title: "rogerioprando",
    description:
      "Engenheiro de software na Atlassian, com experiência em migrações para a nuvem, ferramentas, automação e inteligência artificial aplicada.",
    author: "Rogério Luiz Prando",
    profile: "https://www.linkedin.com/in/rogerio-luiz-prando",
    ogImage: "default-og.jpg",
    lang: "pt-br",
    timezone: "America/Sao_Paulo",
    dir: "ltr",
  },
  posts: {
    perPage: 4,
    perIndex: 4,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: true,
      url: "https://github.com/rogerioprando/rogerioprando.github.io/edit/master/src/content/posts/",
    },
    search: "pagefind",
    toc: true,
  },
  socials: [
    { name: "github", url: "https://github.com/rogerioprando" },
    {
      name: "linkedin",
      url: "https://www.linkedin.com/in/rogerio-luiz-prando",
    },
    { name: "mail", url: "mailto:rogprando@gmail.com" },
  ],
  shareLinks: [
    { name: "whatsapp", url: "https://wa.me/?text=" },
    { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" },
    { name: "x",        url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "pinterest", url: "https://pinterest.com/pin/create/button/?url=" },
    { name: "mail",     url: "mailto:?subject=Leia%20este%20artigo&body=" },
  ],
});