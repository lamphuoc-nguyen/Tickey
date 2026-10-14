import { beforeEach, describe, expect, it, vi } from 'vitest';

const environment = vi.hoisted(() => ({ os: 'android', expoGo: true, imports: 0, rejectImport: true }));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return environment.os;
    },
  },
}));
vi.mock('expo', () => ({ isRunningInExpoGo: () => environment.expoGo }));

beforeEach(() => {
  vi.resetModules();
  environment.os = 'android';
  environment.expoGo = true;
  environment.imports = 0;
  environment.rejectImport = true;
  vi.doMock('expo-notifications', () => {
    environment.imports++;
    if (environment.rejectImport) throw new Error('Push registration cannot initialize here');
    return { DEFAULT_ACTION_IDENTIFIER: 'test-action' };
  });
});

describe('native notification loading', () => {
  it('does not evaluate the throwing SDK entry across repeated loads in Android Expo Go', async () => {
    const runtime = await import('./native-notifications');
    expect(runtime.deviceReminderUnavailableReason()).toContain('chưa được hỗ trợ');
    await expect(runtime.loadNativeNotifications()).resolves.toBeNull();
    await expect(runtime.loadNativeNotifications()).resolves.toBeNull();
    expect(environment.imports).toBe(0);
  });
  it('does not evaluate native notifications on web', async () => {
    environment.os = 'web';
    environment.expoGo = false;
    const runtime = await import('./native-notifications');
    await expect(runtime.loadNativeNotifications()).resolves.toBeNull();
    expect(environment.imports).toBe(0);
  });
  it('loads the SDK entry lazily once for a supported native runtime', async () => {
    environment.expoGo = false;
    environment.rejectImport = false;
    const runtime = await import('./native-notifications');
    expect(environment.imports).toBe(0);
    expect(runtime.deviceReminderUnavailableReason()).toBeNull();
    const [first, second] = await Promise.all([
      runtime.loadNativeNotifications(),
      runtime.loadNativeNotifications(),
    ]);
    expect(first).toBe(second);
    expect(environment.imports).toBe(1);
  });
  it('surfaces unexpected SDK load errors rather than reporting notification success', async () => {
    environment.expoGo = false;
    const runtime = await import('./native-notifications');
    await expect(runtime.loadNativeNotifications()).rejects.toThrow();
    expect(environment.imports).toBe(1);
  });
});
