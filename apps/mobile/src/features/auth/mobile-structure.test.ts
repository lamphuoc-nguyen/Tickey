import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const mobile = fileURLToPath(new URL('../../../', import.meta.url));
const repo = join(mobile, '../..');
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)],
  );
}
const routes = files(join(mobile, 'src/app')).filter(
  (path) => path.endsWith('.tsx') && !path.endsWith('_layout.tsx'),
);
const urls = routes.map(
  (path) =>
    '/' +
    relative(join(mobile, 'src/app'), path)
      .replaceAll('\\', '/')
      .split('/')
      .filter((part) => !/^\(.+\)$/.test(part))
      .join('/')
      .replace(/\.tsx$/, '')
      .replace(/(?:^|\/)index$/, ''),
);

describe('single mobile app migration contracts', () => {
  it('has one Expo package/config and retains the established callback/store identity', () => {
    const expoApps = readdirSync(join(repo, 'apps')).filter((app) =>
      existsSync(join(repo, 'apps', app, 'app.json')),
    );
    expect(expoApps).toEqual(['mobile']);
    const config = JSON.parse(readFileSync(join(mobile, 'app.json'), 'utf-8')).expo;
    expect(config.scheme).toBe('eventcustomer');
    expect(config.android.package).toBe('vn.eventplatform.customer');
    expect(config.ios.bundleIdentifier).toBe('vn.eventplatform.customer');
    expect(JSON.parse(readFileSync(join(mobile, 'package.json'), 'utf-8')).name).toBe('@event/mobile');
  });
  it('shares one Auth/Query provider and isolates Staff under a real URL segment and guard', () => {
    const layouts = files(join(mobile, 'src/app'))
      .filter((path) => path.endsWith('_layout.tsx'))
      .map((path) => readFileSync(path, 'utf-8'))
      .join('\n');
    expect(layouts.match(/<AuthProvider(?:\s|>)/g)).toHaveLength(1);
    expect(layouts.match(/<QueryClientProvider(?:\s|>)/g)).toHaveLength(1);
    expect(readFileSync(join(mobile, 'src/app/_layout.tsx'), 'utf-8')).toContain(
      "initialRouteName: '(customer)'",
    );
    expect(readFileSync(join(mobile, 'src/app/(staff)/_layout.tsx'), 'utf-8')).toContain('<StaffGate>');
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toEqual(
      expect.arrayContaining([
        '/',
        '/auth/login',
        '/auth/callback',
        '/payment-result',
        '/staff',
        '/staff/workspaces',
      ]),
    );
  });
  it('retains all 79 Figma frame mappings with valid routes after group migration', () => {
    const matrix = readFileSync(join(repo, 'docs/CUSTOMER_FRAME_MATRIX.md'), 'utf-8');
    const rows = matrix.split('\n').filter((row) => /^\| \[\d+:\d+ ·/.test(row));
    expect(rows).toHaveLength(79);
    expect(new Set(rows.map((row) => row.match(/^\| \[(\d+:\d+)/)![1])).size).toBe(79);
    for (const row of rows) {
      const cell = row.match(/`([^`]+)`/)![1];
      const targets = cell.match(/\/[\w/\[\]-]*/g) ?? [];
      for (const target of targets) expect(urls, row).toContain(target);
    }
  });
  it('keeps every static local asset require resolvable from the migrated source', () => {
    for (const file of files(join(mobile, 'src')).filter((path) => /\.(tsx?|mts)$/.test(path))) {
      const source = readFileSync(file, 'utf-8');
      for (const match of source.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
        expect(existsSync(join(dirname(file), match[1])), `${relative(mobile, file)} → ${match[1]}`).toBe(
          true,
        );
      }
    }
  });
  it('removes prototype role switches and uses role resolution after authentication', () => {
    const profile = readFileSync(join(mobile, 'src/features/customer/account/screens/profile-screen.tsx'), 'utf-8');
    const staff = readFileSync(join(mobile, 'src/features/staff/screens/staff-entry-screen.tsx'), 'utf-8');
    expect(profile).not.toContain("router.push('/staff')");
    expect(profile).not.toContain("router.push('/workspaces')");
    expect(staff).not.toContain("router.replace('/')");
    expect(readFileSync(join(mobile, 'src/features/auth/screens/auth-screen.tsx'), 'utf-8')).toContain("pathname: '/workspaces'");
    expect(readFileSync(join(mobile, 'src/features/auth/hooks/use-auth-callback.ts'), 'utf-8')).toContain("'/auth/reset' : '/workspaces'");
  });
});
