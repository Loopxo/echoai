// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import solidJs from "@astrojs/solid-js";

export default defineConfig({
  integrations: [
    starlight({
      title: "Echo AI",
      description: "The AI coding agent built for the terminal",
      social: [
        {
          icon: 'github',
          label: 'GitHub', 
          href: 'https://github.com/Loopxo/echoai'
        },
        {
          icon: 'discord',
          label: 'Discord',
          href: 'https://discord.gg/echoai'
        }
      ],
      head: [],
      customCss: [],
      pagefind: true,
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Installation", link: "/installation/" },
            { label: "Quick Start", link: "/quickstart/" },
            { label: "CLI Reference", link: "/cli/" },
          ],
        },
        {
          label: "Core Features",
          items: [
            { label: "Agents", link: "/agents/" },
            { label: "Commands", link: "/commands/" },
            { label: "Configuration", link: "/config/" },
          ],
        },
        {
          label: "Advanced",
          items: [
            { label: "Enterprise", link: "/enterprise/" },
            { label: "API Reference", link: "/api/" },
            { label: "Plugins", link: "/plugins/" },
          ],
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/Loopxo/echoai/edit/main/packages/web/',
      },
      lastUpdated: true,
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 4,
      },
    }),
    solidJs(),
  ],
  devToolbar: {
    enabled: false,
  },
  server: {
    host: "0.0.0.0",
    port: 4321,
  },
});