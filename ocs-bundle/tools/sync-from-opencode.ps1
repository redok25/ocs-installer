param(
  [string]$SourceRoot,
  [string]$TargetRoot
)

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $TargetRoot) {
  $TargetRoot = Split-Path -Parent $scriptRoot
}

if (-not $SourceRoot) {
  if ($env:OPENCODE_CONFIG_HOME) {
    $SourceRoot = $env:OPENCODE_CONFIG_HOME
  }
  elseif ($IsWindows) {
    $SourceRoot = Join-Path (Join-Path $env:USERPROFILE '.config') 'opencode'
  }
  else {
    $SourceRoot = Join-Path (Join-Path $HOME '.config') 'opencode'
  }
}

$items = @(
  'plugins',
  'skills',
  'configs',
  'scripts',
  'cocoindex',
  'extensions',
  'bin',
  'antigravity.json',
  'BUILD_PROVENANCE.json',
  'compression-routing.json',
  'dcp.jsonc',
  'ocs-compression.json',
  'oh-my-openagent.json',
  'oh-my-opencode.json',
  'opencode.json',
  'package.json',
  'PLUGIN_CHANGELOG.md',
  'resource-mode.json',
  'SHA256SUMS'
)

foreach ($item in $items) {
  $src = Join-Path $SourceRoot $item
  $dst = Join-Path $TargetRoot $item
  if (Test-Path -LiteralPath $src) {
    Copy-Item -LiteralPath $src -Destination $dst -Recurse -Force
  }
}

$envFile = Join-Path (Join-Path $TargetRoot 'cocoindex') '.env'
if (Test-Path -LiteralPath $envFile) {
  Remove-Item -LiteralPath $envFile -Force
}

$envExample = Join-Path (Join-Path $TargetRoot 'cocoindex') '.env.example'
if (-not (Test-Path -LiteralPath $envExample)) {
  $exampleLines = @(
    '# Copy to .env for local CocoIndex usage.',
    '# Do not commit real credentials.',
    '',
    'POSTGRES_HOST=localhost',
    'POSTGRES_PORT=5432',
    'POSTGRES_DB=cocoindex',
    'POSTGRES_USER=cocoindex',
    'POSTGRES_PASSWORD=change-me'
  )
  Set-Content -LiteralPath $envExample -Value $exampleLines -Encoding utf8
}

& (Join-Path (Join-Path $TargetRoot 'tools') 'verify-bundle.ps1') -BundleRoot $TargetRoot
