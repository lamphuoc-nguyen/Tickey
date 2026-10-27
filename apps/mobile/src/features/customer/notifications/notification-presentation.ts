export function notificationDay(
  createdAt: string,
  now = new Date(),
): 'Hôm nay' | 'Hôm qua' | 'Trước đó' | 'Chưa rõ thời gian' {
  const date = new Date(createdAt);
  if (!Number.isFinite(date.getTime())) return 'Chưa rõ thời gian';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Hôm nay';
  if (date.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  return 'Trước đó';
}

export function notificationTime(createdAt: string, now = new Date()): string {
  const date = new Date(createdAt);
  if (!Number.isFinite(date.getTime())) return 'Chưa có thời gian';
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (notificationDay(createdAt, now) === 'Hôm nay') return time;
  return `${date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}) })} · ${time}`;
}
