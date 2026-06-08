$ErrorActionPreference = "Stop"

$root = Get-Location
$headerPath = Join-Path $root "components\Header.tsx"
$tvPath = Join-Path $root "components\TvDashboard.tsx"

function Save-Utf8NoBom($Path, $Text) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

if (Test-Path $headerPath) {
  $header = Get-Content -Raw -Encoding UTF8 $headerPath

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

    $header = $header.Replace("function readSearchHistory()", $helper + "function readSearchHistory()")
  }

  # Wrap nav arrays with uniqueNavItems so duplicate settings links never create duplicate keys.
  $header = [regex]::Replace(
    $header,
    'const desktopNavItems = isTvMode\s*\?\s*tvModeNavItems\s*:\s*\[\.\.\.mainNavItems,\s*\.\.\.quickNavItems\];',
    'const desktopNavItems = uniqueNavItems(isTvMode ? tvModeNavItems : [...mainNavItems, ...quickNavItems]);'
  )

  $header = [regex]::Replace(
    $header,
    'const desktopNavItems = uniqueNavItems\(uniqueNavItems\((.*?)\)\);',
    'const desktopNavItems = uniqueNavItems($1);'
  )

  $header = [regex]::Replace(
    $header,
    'const mobileMainItems = isTvMode\s*\?\s*tvModeNavItems\s*:\s*mainNavItems;',
    'const mobileMainItems = uniqueNavItems(isTvMode ? tvModeNavItems : mainNavItems);'
  )

  $header = [regex]::Replace(
    $header,
    'const mobileMainItems = uniqueNavItems\(uniqueNavItems\((.*?)\)\);',
    'const mobileMainItems = uniqueNavItems($1);'
  )

  $header = [regex]::Replace(
    $header,
    'const mobileQuickItems = isTvMode\s*\?\s*quickNavItems\.slice\(0,\s*8\)\s*:\s*quickNavItems;',
    'const mobileQuickItems = uniqueNavItems(isTvMode ? quickNavItems.slice(0, 8) : quickNavItems);'
  )

  $header = [regex]::Replace(
    $header,
    'const mobileQuickItems = uniqueNavItems\(uniqueNavItems\((.*?)\)\);',
    'const mobileQuickItems = uniqueNavItems($1);'
  )

  # If settings link is missing completely, add an ASCII-safe escaped label to quick and TV nav.
  # "\u0043\u00E0\u0069 \u0111\u1EB7\u0074" renders as "Cai dat" with Vietnamese marks in JS.
  if ($header -notmatch 'href:\s*"/cai-dat"') {
    $settingsItem = '  { label: "\u0043\u00E0\u0069 \u0111\u1EB7\u0074", href: "/cai-dat" },'

    $header = $header.Replace(
      '  { label: "TV Mode", href: "/tv" },' + [Environment]::NewLine + '];',
      '  { label: "TV Mode", href: "/tv" },' + [Environment]::NewLine + $settingsItem + [Environment]::NewLine + '];'
    )

    $header = $header.Replace(
      '  { label: "Phim riêng", href: "/ca-nhan" },' + [Environment]::NewLine + '];',
      '  { label: "Phim riêng", href: "/ca-nhan" },' + [Environment]::NewLine + $settingsItem + [Environment]::NewLine + '];'
    )
  }

  Save-Utf8NoBom $headerPath $header
  Write-Host "Fixed Header.tsx nav dedupe." -ForegroundColor Green
} else {
  Write-Host "Header.tsx not found, skipped." -ForegroundColor Yellow
}

if (Test-Path $tvPath) {
  $tv = Get-Content -Raw -Encoding UTF8 $tvPath

  if ($tv -notmatch "function uniqueShortcutItems") {
    $helper = @'
function uniqueShortcutItems<T extends { href: string }>(items: T[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.href)) {
      return false;
    }

    seen.add(item.href);
    return true;
  });
}

'@

    $tv = $tv.Replace("function readFavorites()", $helper + "function readFavorites()")
  }

  # Add settings shortcut if it is missing.
  if ($tv -notmatch 'href:\s*"/cai-dat"') {
    $settingsShortcut = @'
  {
    label: "\u0043\u00E0\u0069 \u0111\u1EB7\u0074",
    desc: "Reload app va tuy chon PWA",
    href: "/cai-dat",
  },
'@
    $tv = $tv.Replace("];" + [Environment]::NewLine + [Environment]::NewLine + "function readFavorites()", $settingsShortcut + "];" + [Environment]::NewLine + [Environment]::NewLine + "function readFavorites()")
  }

  $tv = $tv.Replace("{tvShortcuts.map((item) => (", "{uniqueShortcutItems(tvShortcuts).map((item) => (")
  $tv = $tv.Replace("{uniqueShortcutItems(uniqueShortcutItems(tvShortcuts)).map((item) => (", "{uniqueShortcutItems(tvShortcuts).map((item) => (")

  Save-Utf8NoBom $tvPath $tv
  Write-Host "Fixed TvDashboard.tsx shortcuts dedupe." -ForegroundColor Green
} else {
  Write-Host "TvDashboard.tsx not found, skipped." -ForegroundColor Yellow
}

Write-Host "Done. Run npm run dev again." -ForegroundColor Cyan
