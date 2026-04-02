// =====================================================================
// Cypher Calculator Configuration (Default / Opensource)
// Copy this file to config.js and customize for your site.
// =====================================================================

var CALC_CONFIG = {

  // --- Branding ---
  siteName: "Cypher Calculator",                              // logo text
  siteTitle: "Cypher Calculator — Gematria",                  // browser tab title
  logoColor: "hsl(148, 60%, 45%)",                            // green (match code rain)
  logoGlow: "0 0 8px rgba(0,255,65,0.3), 0 0 16px rgba(0,255,65,0.15)",
  logoHoverMatrix: true,                                      // flip letters to matrix font on hover
  faviconUrl: "res/favicon.png",

  // --- Messages ---
  welcomeMessage: "loading cypher database...",
  loadedMessage: "{count} entries × {ciphers} cyphers ready",

  // --- Links ---
  siteUrl: "",
  githubUrl: "https://github.com/malonehunter/hyperdope-gematria",
  aboutLinks: [
    // Add your own links here:
    // { text: "My Site", url: "https://example.com" },
    { text: "GitHub", url: "https://github.com/malonehunter/hyperdope-gematria" },
  ],

  // --- Credits ---
  credits: [
    { name: "Saun-Virroco", role: "Original Gematro creator" },
    { name: "NetVoid", url: "https://cyphers.news/", role: "Preserved codebase & database" },
    { name: "Alektryon", url: "https://github.com/Alektryon", role: "Cipher contributions" },
    { name: "Hyperdope", url: "https://hyperdope.com", role: "Database overhaul & v2 architecture" },
  ],

  // --- Database ---
  databaseMode: "auto",           // "auto" tries db.json then db.txt | "json" | "txt"
  databaseJsonUrl: "db.json",
  databaseTxtUrl: "db.txt",

  // --- Defaults ---
  autoMatchDesktop: true,
  autoMatchMobile: false,
  resultsPerPage: 12,
  newPhrasesOnTop: true,

  // --- Custom Cipher Categories ---
  // Group ciphers into custom menu sections. Ciphers are referenced by
  // their exact name from ciphers.js. They still appear in their original
  // category too — custom categories are convenience shortcuts.
  customCategories: [
    // Example: CCRU section for Anglossic Qabbala research
    // {
    //   name: "CCRU",
    //   ciphers: ["Alphanumeric Qabbala", "Synx", "Keypad"]
    // },
  ],
};
