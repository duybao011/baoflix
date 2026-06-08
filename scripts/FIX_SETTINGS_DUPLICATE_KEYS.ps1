# Fix duplicate nav keys after adding Cai dat link.
# Run from Baoflix web project root: powershell -ExecutionPolicy Bypass -File .\scripts\FIX_SETTINGS_DUPLICATE_KEYS.ps1

$ErrorActionPreference = "Stop"

$headerPath = Join-Path (Get-Location) "components\Header.tsx"

if (!(Test-Path $headerPath)) {
  throw "Không tìm thấy components\Header.tsx. Hãy chạy script ở root project Baoflix web."
}

$header = Get-Content -Raw -Encoding UTF8 $headerPath

# 1) Add helper to dedupe nav items by href+label, idempotent.
if ($header -notmatch "function uniqueNavItems") {
  $helper = @'

function uniqueNavItems(items: NavItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${item.href}-${item.label}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
'@

  $header = $header -replace "(?s)(function NavButton\([\s\S]*?\n\})\r?\n\r?\nexport default function Header", ('$1' + $helper + "`r`nexport default function Header")
}

# 2) Dedupe desktop nav list where mainNavItems + quickNavItems are merged.
$oldDesktopBlock = @'
  const desktopNavItems = isTvMode
    ? tvModeNavItems
    : [...mainNavItems, ...quickNavItems];
'@
$newDesktopBlock = @'
  const desktopNavItems = uniqueNavItems(
    isTvMode ? tvModeNavItems : [...mainNavItems, ...quickNavItems]
  );
'@
$header = $header.Replace($oldDesktopBlock, $newDesktopBlock)

# 3) Dedupe mobile arrays too, harmless and keeps menu clean if Cai dat was inserted twice.
$oldMobileMain = '  const mobileMainItems = isTvMode ? tvModeNavItems : mainNavItems;'
$newMobileMain = '  const mobileMainItems = uniqueNavItems(isTvMode ? tvModeNavItems : mainNavItems);'
$header = $header.Replace($oldMobileMain, $newMobileMain)

$oldMobileQuick = '  const mobileQuickItems = isTvMode ? quickNavItems.slice(0, 8) : quickNavItems;'
$newMobileQuick = '  const mobileQuickItems = uniqueNavItems(isTvMode ? quickNavItems.slice(0, 8) : quickNavItems);'
$header = $header.Replace($oldMobileQuick, $newMobileQuick)

# 4) Make desktop key extra-safe. This also prevents warnings if future links duplicate accidentally.
$header = $header.Replace(
  '{desktopNavItems.map((item) => (',
  '{desktopNavItems.map((item, index) => ('
)
$header = $header.Replace(
  'key={`${item.href}-${item.label}`}',
  'key={`desktop-${item.href}-${item.label}-${index}`}'
)

# 5) Optional cleanup: if exact duplicate Cai dat lines sit next to each other, collapse them.
$header = $header -replace '(?m)^\s*\{ label: "Cài đặt", href: "/cai-dat" \},\r?\n\s*\{ label: "Cài đặt", href: "/cai-dat" \},', '  { label: "Cài đặt", href: "/cai-dat" },'

Set-Content -Path $headerPath -Value $header -Encoding UTF8

Write-Host "Done: Fixed duplicate Cai dat nav keys in components/Header.tsx" -ForegroundColor Green
