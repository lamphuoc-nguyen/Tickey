[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../src/EventPlatform.Api/EventPlatform.Api.csproj'))
[xml]$project = Get-Content -LiteralPath $projectPath -Raw
$idNode = $project.SelectSingleNode("//*[local-name()='UserSecretsId']")
if (-not $idNode) { throw 'API UserSecretsId is missing.' }
$store = Join-Path ([Environment]::GetFolderPath('ApplicationData')) "Microsoft/UserSecrets/$($idNode.InnerText)/secrets.json"
$settings = @{}
if (Test-Path -LiteralPath $store) { $settings = Get-Content -LiteralPath $store -Raw | ConvertFrom-Json }
function Setting([string]$name) {
    $fromEnvironment = [Environment]::GetEnvironmentVariable($name.Replace(':', '__'))
    if (-not [string]::IsNullOrWhiteSpace($fromEnvironment)) { return $fromEnvironment }
    if ($settings -is [System.Collections.IDictionary]) { return $settings[$name] }
    return $settings.PSObject.Properties[$name].Value
}
$cloudName = Setting 'Cloudinary:CloudName'
$apiKey = Setting 'Cloudinary:ApiKey'
$apiSecret = Setting 'Cloudinary:ApiSecret'
if ($cloudName -notmatch '^[A-Za-z0-9_-]{1,100}$' -or [string]::IsNullOrWhiteSpace($apiKey) -or [string]::IsNullOrWhiteSpace($apiSecret)) {
    throw 'Cloudinary configuration is missing. Run backend/scripts/configure-cloudinary.ps1 first in this Windows account.'
}
$headers = @{}
try {
    $headers.Authorization = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${apiKey}:${apiSecret}"))
    $result = Invoke-RestMethod -Method Get -Uri "https://api.cloudinary.com/v1_1/$cloudName/ping" -Headers $headers -TimeoutSec 20
    if ($result.status -ne 'ok') { throw 'Unexpected ping response.' }
    Write-Host "Cloudinary authentication OK for $cloudName. Read-only ping; no assets uploaded or deleted."
} catch {
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'network/invalid response' }
    Write-Host "Cloudinary ping failed (HTTP $status). Check credentials, key permissions and network."
    exit 1
} finally {
    $headers.Clear()
    $apiKey = $null
    $apiSecret = $null
    $settings = $null
}
