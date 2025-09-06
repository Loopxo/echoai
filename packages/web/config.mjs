const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production"
    ? "https://echo-ai.dev"
    : `https://${stage}.echo-ai.dev`,
  console: stage === "production"
    ? "https://echo-ai.dev/auth"
    : `https://${stage}.echo-ai.dev/auth`,
  email: "contact@echo-ai.dev",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/vijeet-shah/echo-ai-cli",
  discord: "https://echo-ai.dev/discord",
  headerLinks: [
    { name: "Home", url: "/" },
    { name: "Docs", url: "/docs/" },
  ],
}
