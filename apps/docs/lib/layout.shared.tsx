import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "Prism"
    },
    searchToggle: {
      enabled: false
    },
    themeSwitch: {
      enabled: false
    },
    links: [
      {
        text: "GitHub",
        url: "https://github.com/synthesiseng/prism"
      },
      {
        text: "npm",
        url: "https://www.npmjs.com/package/@synthesisengineering/prism"
      }
    ]
  };
}
