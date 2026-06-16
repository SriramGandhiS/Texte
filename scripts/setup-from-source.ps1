# Copy app files into D:\krs-question-paper-tool (run once)
$root = "D:\krs-question-paper-tool"
$src = "C:\Users\iamra\Documents\Codex\2026-06-16\files-mentioned-by-the-user-unit\outputs"

if (-not (Test-Path $src)) {
  Write-Error "Source folder not found: $src"
  exit 1
}

New-Item -ItemType Directory -Force -Path "$root\public", "$root\lib" | Out-Null

Copy-Item "$src\krs-question-paper-tool.html" "$root\public\index.html" -Force
Copy-Item "$src\krs-local-ai-server.js" "$root\lib\ai-core.js" -Force

$core = Get-Content "$root\lib\ai-core.js" -Raw
$core = $core.Replace(
  'const APP_FILE = path.join(__dirname, "krs-question-paper-tool.html");',
  'const APP_FILE = path.join(__dirname, "../public/index.html");'
)
Set-Content "$root\lib\ai-core.js" $core -NoNewline

Write-Host "OK: public\index.html"
Write-Host "OK: lib\ai-core.js"
Write-Host "Deploy folder ready: $root"
