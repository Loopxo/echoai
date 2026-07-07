const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production"
    ? "https://echoai.dev"
    : `https://${stage}.echoai.dev`,
  console: stage === "production"
    ? "https://echoai.dev/auth"
    : `https://${stage}.echoai.dev/auth`,
  email: "contact@echoai.dev",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/vijeet-shah/echoai",
  discord: "https://echoai.dev/discord",
  headerLinks: [
    { name: "Home", url: "/" },
    { name: "Docs", url: "/docs/" },
  ],
}
