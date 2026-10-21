param([Parameter(Mandatory = $true)][ValidateSet('Protect', 'Unprotect')][string]$Mode)
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Security
$inputText = [Console]::In.ReadToEnd()
if ($Mode -eq 'Protect') {
    $bytes = [Text.Encoding]::UTF8.GetBytes($inputText)
    $protected = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    [Console]::Out.Write([Convert]::ToBase64String($protected))
} else {
    $bytes = [Convert]::FromBase64String($inputText)
    $plain = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    [Console]::Out.Write([Text.Encoding]::UTF8.GetString($plain))
}
