[CmdletBinding()]
param(
    [string]$CloudName,
    [string]$PublicIdPrefix = 'tickey',
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$projectPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../src/EventPlatform.Api/EventPlatform.Api.csproj'))
[xml]$project = Get-Content -LiteralPath $projectPath -Raw
$idNode = $project.SelectSingleNode("//*[local-name()='UserSecretsId']")
if (-not $idNode -or [string]::IsNullOrWhiteSpace($idNode.InnerText)) { throw 'API UserSecretsId is missing.' }

if ($CheckOnly) {
    # Read only this project's store. Never print values or other Supabase/payment secrets.
    $store = Join-Path ([Environment]::GetFolderPath('ApplicationData')) "Microsoft/UserSecrets/$($idNode.InnerText)/secrets.json"
    $values = @{}
    if (Test-Path -LiteralPath $store) { $values = Get-Content -LiteralPath $store -Raw | ConvertFrom-Json }
    foreach ($name in @('MediaStorage:ImageProvider', 'Cloudinary:CloudName', 'Cloudinary:ApiKey', 'Cloudinary:ApiSecret', 'Cloudinary:PublicIdPrefix')) {
        $value = if ($values -is [System.Collections.IDictionary]) { $values[$name] } else { $values.PSObject.Properties[$name].Value }
        $configured = -not [string]::IsNullOrWhiteSpace([string]$value)
        Write-Host ("{0}: {1}" -f $name, $(if ($configured) { 'configured' } else { 'missing' }))
    }
    return
}

if ([string]::IsNullOrWhiteSpace($CloudName)) { $CloudName = Read-Host 'Cloudinary Cloud name' }
$CloudName = $CloudName.Trim()
if ($CloudName -notmatch '^[A-Za-z0-9_-]{1,100}$') { throw 'Enter the Cloud name, not a URL.' }
if ($PublicIdPrefix.Length -gt 100 -or $PublicIdPrefix -notmatch '^[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*$') {
    throw 'PublicIdPrefix must be a short slash-separated folder name, without spaces or traversal.'
}
$settings = [ordered]@{ 'MediaStorage:ImageProvider' = 'Cloudinary'; 'Cloudinary:CloudName' = $CloudName; 'Cloudinary:PublicIdPrefix' = $PublicIdPrefix }
$inputs = @()
$pointers = @()
try {
    foreach ($name in @('Cloudinary:ApiKey', 'Cloudinary:ApiSecret')) {
        $inputValue = Read-Host "$name (hidden; from Cloudinary API Keys)" -AsSecureString
        $inputs += $inputValue
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($inputValue)
        $pointers += $pointer
        $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim()
        if ([string]::IsNullOrWhiteSpace($value)) { throw "$name is required." }
        $settings[$name] = $value
    }
    # No secret in command arguments, public env files, temporary files or console output.
    $settings | ConvertTo-Json -Compress | & dotnet user-secrets --id $idNode.InnerText set
    if ($LASTEXITCODE -ne 0) { throw 'Could not save API user-secrets.' }
    Write-Host 'Saved Cloudinary settings for this Windows user. Restart EventPlatform.Api to apply.'
    Write-Host 'New JPEG/PNG/WebP uploads use Cloudinary; KYC/evidence are authenticated. PDFs and old objects remain on Supabase.'
} finally {
    foreach ($pointer in $pointers) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    foreach ($inputValue in $inputs) { $inputValue.Dispose() }
    $settings.Clear()
    $value = $null
}
