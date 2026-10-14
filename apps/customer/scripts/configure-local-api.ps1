[CmdletBinding()]
param([switch]$PublicOnly)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$envPath = Join-Path $repoRoot 'apps/customer/.env.local'
$projectPath = Join-Path $repoRoot 'backend/src/EventPlatform.Api/EventPlatform.Api.csproj'
if (-not (Test-Path -LiteralPath $envPath)) { throw 'Create apps/customer/.env.local first.' }

$clientValues = @{}
foreach ($line in Get-Content -LiteralPath $envPath) {
    if ($line -match '^\s*(EXPO_PUBLIC_SUPABASE_URL|EXPO_PUBLIC_SUPABASE_ANON_KEY)\s*=\s*(.*?)\s*$') {
        $clientValues[$matches[1]] = $matches[2].Trim('"').Trim("'")
    }
}
$url = $clientValues['EXPO_PUBLIC_SUPABASE_URL']
$publicKey = $clientValues['EXPO_PUBLIC_SUPABASE_ANON_KEY']
if ([string]::IsNullOrWhiteSpace($url) -or [string]::IsNullOrWhiteSpace($publicKey)) {
    throw 'Customer Supabase URL and public key must be filled first.'
}
$supabaseUri = [Uri]$url
if ($supabaseUri.Scheme -notin @('https', 'http') -or -not $supabaseUri.Host) {
    throw 'Invalid Supabase URL.'
}

function Get-JwtRole([string]$value) {
    try {
        $parts = $value.Split('.')
        if ($parts.Count -ne 3) { return $null }
        $encoded = $parts[1].Replace('-', '+').Replace('_', '/')
        $encoded = $encoded.PadRight($encoded.Length + ((4 - $encoded.Length % 4) % 4), '=')
        $payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded)) | ConvertFrom-Json
        return $payload.role
    } catch { return $null }
}
if ($publicKey -notmatch '^sb_publishable_[A-Za-z0-9_-]+$' -and (Get-JwtRole $publicKey) -ne 'anon') {
    throw 'Customer must contain a publishable/anon key.'
}

[xml]$project = Get-Content -LiteralPath $projectPath -Raw
$idNode = $project.SelectSingleNode("//*[local-name()='UserSecretsId']")
if (-not $idNode -or [string]::IsNullOrWhiteSpace($idNode.InnerText)) {
    throw 'The API project has no UserSecretsId.'
}
$settings = [ordered]@{ 'Supabase:Url' = $url; 'Supabase:AnonKey' = $publicKey }
$secret = $null
$secureInput = $null
$pointer = [IntPtr]::Zero
try {
    if (-not $PublicOnly) {
        $secureInput = Read-Host 'Paste your Supabase backend secret key (input hidden)' -AsSecureString
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureInput)
        $secret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim()
        if ($secret -notmatch '^sb_secret_[A-Za-z0-9_-]+$' -and (Get-JwtRole $secret) -ne 'service_role') {
            throw 'Use a Supabase secret/service_role key from the same project. Public keys cannot start this backend.'
        }
        $settings['Supabase:ServiceRoleKey'] = $secret
    }
    # JSON goes through stdin, not command-line arguments or an intermediate file.
    $settings | ConvertTo-Json -Compress | & dotnet user-secrets --id $idNode.InnerText set
    if ($LASTEXITCODE -ne 0) { throw 'dotnet user-secrets could not save the configuration.' }
    if ($PublicOnly) {
        Write-Host 'Saved API Supabase URL and public key. Backend secret still needs to be configured.'
    } else {
        Write-Host 'Saved API configuration in this Windows account user-secrets. Run the API in another terminal.'
    }
} finally {
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    if ($secureInput) { $secureInput.Dispose() }
    $settings.Clear()
    $secret = $null
}
