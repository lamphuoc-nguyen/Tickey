import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

function transform(mode, input) {
  if (process.platform !== 'win32')
    throw new Error('Demo credentials cần Windows DPAPI cho tài khoản hiện tại.');
  try {
    return execFileSync(
      join(
        process.env.SystemRoot ?? 'C:\\Windows',
        'System32',
        'WindowsPowerShell',
        'v1.0',
        'powershell.exe',
      ),
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-File',
        fileURLToPath(new URL('./demo-state-protection.ps1', import.meta.url)),
        '-Mode',
        mode,
      ],
      {
        input,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 15_000,
        maxBuffer: 8 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    ).replace(/^\uFEFF/, '');
  } catch {
    throw new Error(
      'Không bảo vệ/giải mã được nhật ký DEMO bằng Windows DPAPI; dừng, không ghi credential dạng văn bản.',
    );
  }
}

export function protectDemoState(journal) {
  return (
    JSON.stringify(
      {
        formatVersion: 1,
        protection: 'WindowsCurrentUserDPAPI',
        payload: transform('Protect', JSON.stringify(journal)),
      },
      null,
      2,
    ) + '\n'
  );
}

export function readDemoState(text) {
  const value = JSON.parse(text.replace(/^\uFEFF/, ''));
  return value.protection === 'WindowsCurrentUserDPAPI'
    ? JSON.parse(transform('Unprotect', value.payload))
    : value;
}
