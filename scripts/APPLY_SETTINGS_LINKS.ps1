
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$label = -join @('C', [char]0x00E0, 'i ', [char]0x0111, [char]0x1EB7, 't')
$settingLine = '  { label: "' + $label + '", href: "/cai-dat" },'

function Save-Utf8($path, $content) {
  Set-Content -Path $path -Value $content -Encoding UTF8
}

$headerPath = Join-Path $root "components/Header.tsx"
if (Test-Path $headerPath) {
  $header = Get-Content -Path $headerPath -Raw -Encoding UTF8

  if ($header -notmatch 'href:\s*"/cai-dat"') {
    $header = [regex]::Replace(
      $header,
      '(\s*\{ label: "[^"]+", href: "/ca-nhan/them" \},)',
      { param($m) $m.Value + "`r`n" + $settingLine },
      1
    )

    $header = [regex]::Replace(
      $header,
      '(\s*\{ label: "[^"]+", href: "/ca-nhan" \},)',
      { param($m) $m.Value + "`r`n" + $settingLine }
    )

    Save-Utf8 $headerPath $header
    Write-Host "Updated components/Header.tsx"
  } else {
    Write-Host "components/Header.tsx already has /cai-dat"
  }
} else {
  Write-Host "Skip Header: components/Header.tsx not found"
}

$tvPath = Join-Path $root "components/TvDashboard.tsx"
if (Test-Path $tvPath) {
  $tv = Get-Content -Path $tvPath -Raw -Encoding UTF8

  if ($tv -notmatch 'href:\s*"/cai-dat"') {
    $shortcut = '  {' + "`r`n" +
      '    label: "' + $label + '",' + "`r`n" +
      '    desc: "Tai lai app va TV mode",' + "`r`n" +
      '    href: "/cai-dat",' + "`r`n" +
      '  },'

    $tv = [regex]::Replace(
      $tv,
      '(\s*href: "/ca-nhan",\s*\},)',
      { param($m) $m.Value + "`r`n" + $shortcut },
      1
    )

    Save-Utf8 $tvPath $tv
    Write-Host "Updated components/TvDashboard.tsx"
  } else {
    Write-Host "components/TvDashboard.tsx already has /cai-dat"
  }
} else {
  Write-Host "Skip TV dashboard: components/TvDashboard.tsx not found"
}

Write-Host "Done. Now run: npm run dev"
