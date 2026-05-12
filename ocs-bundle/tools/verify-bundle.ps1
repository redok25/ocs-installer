param(
  [string]$BundleRoot
)

if (-not $BundleRoot) {
  $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
  $BundleRoot = Split-Path -Parent $scriptRoot
}

$required = @(
  'README.md',
  '.gitignore',
  'hermes-bundle-manifest.json',
  'opencode.json',
  'oh-my-opencode.json',
  'ocs-compression.json',
  'configs',
  'skills',
  'plugins',
  'tools/sync-from-opencode.ps1',
  'tools/verify-bundle.ps1',
  'tools/sync-from-opencode.sh',
  'tools/verify-bundle.sh'
)

foreach ($item in $required) {
  $path = Join-Path $BundleRoot $item
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Missing required bundle item: $item"
  }
}

$blockedPatterns = @(
  'cocoindex[\\/]\.env$',
  '\.bak$',
  '\.tmp$',
  '[\\/]node_modules[\\/]'
)

$matches = Get-ChildItem -LiteralPath $BundleRoot -Force -Recurse -File | Where-Object {
  $full = $_.FullName
  foreach ($pattern in $blockedPatterns) {
    if ($full -match $pattern) { return $true }
  }
  return $false
}

if ($matches) {
  $matches | ForEach-Object { $_.FullName }
  throw 'Bundle contains blocked files'
}

'Bundle verification passed.'
