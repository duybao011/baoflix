const fs = require('fs');
const path = require('path');

const root = process.cwd();

function filePath(rel) {
  return path.join(root, rel);
}

function read(rel) {
  const p = filePath(rel);
  if (!fs.existsSync(p)) {
    throw new Error(`Missing file: ${rel}`);
  }
  return fs.readFileSync(p, 'utf8');
}

function write(rel, content) {
  fs.writeFileSync(filePath(rel), content, 'utf8');
  console.log(`✓ ${rel}`);
}

function replaceOrThrow(content, search, replacement, label) {
  if (!content.includes(search)) {
    throw new Error(`Pattern not found for ${label}`);
  }
  return content.replace(search, replacement);
}

function addLeanLinkAndImageProps(rel) {
  let content = read(rel);

  content = content.replace(/<Link\b([^>]*?)>/g, (match, attrs) => {
    if (/\bprefetch\s*=/.test(attrs)) return match;
    return `<Link${attrs} prefetch={false}>`;
  });

  content = content.replace(/<img\b([^>]*?)>/g, (match, attrs) => {
    let extra = '';
    if (!/\bloading\s*=/.test(attrs)) extra += ' loading="lazy"';
    if (!/\bdecoding\s*=/.test(attrs)) extra += ' decoding="async"';
    if (!/\bfetchPriority\s*=/.test(attrs)) extra += ' fetchPriority="low"';
    return `<img${attrs}${extra}>`;
  });

  write(rel, content);
}

function patchTvPage() {
  const content = `import TvDashboard from "@/components/TvDashboard";
import TvModeSession from "@/components/TvModeSession";
import { getFilteredMovies } from "@/lib/kkphim";

export default async function TvPage() {
  const chineseSeriesResult = await getFilteredMovies({
    type: "phim-bo",
    country: "trung-quoc",
    page: 1,
    limit: 10,
  });

  return (
    <>
      <TvModeSession />
      <TvDashboard chineseSeries={chineseSeriesResult.items} />
    </>
  );
}
`;

  write('app/tv/page.tsx', content);
}

function patchPwaRegister() {
  const content = `"use client";

import { useEffect } from "react";

const TV_SESSION_KEY = "baoflix_tv_mode";

function getUserAgent() {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent.toLowerCase();
}

function isTvLikeRuntime() {
  if (typeof window === "undefined") return false;

  try {
    const searchParams = new URLSearchParams(window.location.search);

    if (searchParams.get("tv") === "1") return true;
    if (document.documentElement.dataset.baoflixTvMode === "1") return true;
    if (sessionStorage.getItem(TV_SESSION_KEY) === "1") return true;
  } catch {
    // Ignore blocked storage / URL access in strict WebViews.
  }

  return /baoflixtv|baoflix tv|baoflixwebview|baoflix-webview|android tv|google tv|smart-tv|smarttv|tizen|webos|appletv|aft|bravia|crkey|shield|netcast|viera|hisense|vidaa|roku/.test(
    getUserAgent()
  );
}

export default function PwaRegister() {
  useEffect(() => {
    if (isTvLikeRuntime()) return;
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  }, []);

  return null;
}
`;

  write('components/PwaRegister.tsx', content);
}

function patchHeaderLeanTvMode() {
  let content = read('components/Header.tsx');

  content = replaceOrThrow(
    content,
    'const SEARCH_HISTORY_KEY = "baoflix_search_history";\n',
    `const SEARCH_HISTORY_KEY = "baoflix_search_history";\nconst TV_SESSION_KEY = "baoflix_tv_mode";\n\nfunction getUserAgent() {\n  if (typeof navigator === "undefined") return "";\n  return navigator.userAgent.toLowerCase();\n}\n\nfunction isTvUserAgent() {\n  return /baoflixtv|baoflix tv|baoflixwebview|baoflix-webview|android tv|google tv|smart-tv|smarttv|tizen|webos|appletv|aft|bravia|crkey|shield|netcast|viera|hisense|vidaa|roku/.test(\n    getUserAgent()\n  );\n}\n\nfunction readTvModeRuntime() {\n  try {\n    if (document.documentElement.dataset.baoflixTvMode === "1") return true;\n    if (sessionStorage.getItem(TV_SESSION_KEY) === "1") return true;\n  } catch {\n    // Ignore blocked storage.\n  }\n\n  return isTvUserAgent();\n}\n\nfunction isLeanTvPath(pathname: string) {\n  return (\n    pathname === "/tv" ||\n    pathname.startsWith("/xem") ||\n    /^\\/ca-nhan\\/[^/]+\\/xem/.test(pathname)\n  );\n}\n`,
    'Header TV helpers'
  );

  content = replaceOrThrow(
    content,
    '  const [menuOpen, setMenuOpen] = useState(false);\n  const [searchOpen, setSearchOpen] = useState(false);\n',
    `  const [menuOpen, setMenuOpen] = useState(false);\n  const [searchOpen, setSearchOpen] = useState(false);\n  const [leanTvChrome, setLeanTvChrome] = useState(false);\n\n  useEffect(() => {\n    function refreshLeanTvChrome() {\n      setLeanTvChrome(readTvModeRuntime());\n    }\n\n    refreshLeanTvChrome();\n    window.addEventListener("baoflix-tv-mode-change", refreshLeanTvChrome);\n    window.addEventListener("storage", refreshLeanTvChrome);\n    window.addEventListener("focus", refreshLeanTvChrome);\n\n    return () => {\n      window.removeEventListener("baoflix-tv-mode-change", refreshLeanTvChrome);\n      window.removeEventListener("storage", refreshLeanTvChrome);\n      window.removeEventListener("focus", refreshLeanTvChrome);\n    };\n  }, []);\n`,
    'Header lean TV state'
  );

  content = replaceOrThrow(
    content,
    '  const currentKeyword =\n    searchParams.get("q") || searchParams.get("keyword") || "";\n',
    `  if (isLeanTvPath(pathname) || leanTvChrome) {\n    return null;\n  }\n\n  const currentKeyword =\n    searchParams.get("q") || searchParams.get("keyword") || "";\n`,
    'Header early return'
  );

  write('components/Header.tsx', content);
}

function patchGlobals() {
  let content = read('app/globals.css');

  const marker = '/* =========================\n   BảoFlix TV Lean Performance\n========================= */';
  if (content.includes(marker)) {
    console.log('• app/globals.css already has TV Lean Performance block');
    return;
  }

  content += `\n\n${marker}\n\nhtml[data-baoflix-tv-mode="1"] {\n  scroll-behavior: auto;\n}\n\nhtml[data-baoflix-tv-mode="1"] body {\n  background: #05070d;\n}\n\nhtml[data-baoflix-tv-mode="1"] .backdrop-blur,\nhtml[data-baoflix-tv-mode="1"] .backdrop-blur-sm,\nhtml[data-baoflix-tv-mode="1"] .backdrop-blur-md,\nhtml[data-baoflix-tv-mode="1"] .backdrop-blur-lg,\nhtml[data-baoflix-tv-mode="1"] .backdrop-blur-xl,\nhtml[data-baoflix-tv-mode="1"] .backdrop-blur-2xl {\n  -webkit-backdrop-filter: none !important;\n  backdrop-filter: none !important;\n}\n\nhtml[data-baoflix-tv-mode="1"] [data-tv-scope] a,\nhtml[data-baoflix-tv-mode="1"] [data-tv-scope] button,\nhtml[data-baoflix-tv-mode="1"] [data-tv-scope] input,\nhtml[data-baoflix-tv-mode="1"] [data-tv-scope] select {\n  transition-duration: 80ms !important;\n}\n\nhtml[data-baoflix-tv-mode="1"] .baoflix-tv-page {\n  text-rendering: optimizeSpeed;\n}\n\nhtml[data-baoflix-tv-mode="1"] img {\n  content-visibility: auto;\n}\n`;

  write('app/globals.css', content);
}

function patchMain() {
  patchTvPage();
  patchPwaRegister();
  patchHeaderLeanTvMode();

  const leanTargets = [
    'components/TvDashboard.tsx',
    'components/TvSearchBox.tsx',
    'components/FilterPanel.tsx',
    'components/MovieGrid.tsx',
    'components/MovieCard.tsx',
    'components/Pagination.tsx',
    'components/TvMovieDetailShell.tsx',
    'app/ca-nhan/[slug]/page.tsx',
    'app/tv/page.tsx',
  ];

  leanTargets.forEach((rel) => {
    if (fs.existsSync(filePath(rel))) {
      addLeanLinkAndImageProps(rel);
    }
  });

  // Keep TV Home light: fewer posters rendered on first screen.
  let tvDashboard = read('components/TvDashboard.tsx');
  tvDashboard = tvDashboard
    .replace('const otherHistory = history.slice(1, 7);', 'const otherHistory = history.slice(1, 5);')
    .replace('chineseSeries.slice(0, 14)', 'chineseSeries.slice(0, 10)')
    .replace('customMovies.slice(0, 7)', 'customMovies.slice(0, 6)')
    .replace('favorites.slice(0, 7)', 'favorites.slice(0, 6)');
  write('components/TvDashboard.tsx', tvDashboard);

  patchGlobals();

  console.log('\nDone. Run: npm run lint && npm run build');
}

patchMain();
