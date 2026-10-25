/** ISO → value of <input type="datetime-local"> in the venue's timezone (defaults to Vietnam time). */
export function toLocalInput(iso: string | null | undefined, timeZone = 'Asia/Ho_Chi_Minh'): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

/**
 * datetime-local value (interpreted in venue timezone) → ISO UTC string.
 * Empty → null so the RPC keeps / defaults the field.
 */
export function toIso(local: string | null | undefined, timeZone = 'Asia/Ho_Chi_Minh'): string | null {
  if (!local) return null;
  const match = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, m, d, h, min] = match.map(Number);
  const utcGuess = new Date(Date.UTC(y, m - 1, d, h, min));

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  // Step 1: initial offset calculation
  const parts1 = formatter.formatToParts(utcGuess);
  const map1 = Object.fromEntries(parts1.map((p) => [p.type, p.value]));
  const tzAsUtc1 = Date.UTC(Number(map1.year), Number(map1.month) - 1, Number(map1.day), Number(map1.hour), Number(map1.minute));
  const offsetMs1 = tzAsUtc1 - utcGuess.getTime();

  // Step 2: refine offset around DST transitions
  const refinedGuess = new Date(utcGuess.getTime() - offsetMs1);
  const parts2 = formatter.formatToParts(refinedGuess);
  const map2 = Object.fromEntries(parts2.map((p) => [p.type, p.value]));
  const tzAsUtc2 = Date.UTC(Number(map2.year), Number(map2.month) - 1, Number(map2.day), Number(map2.hour), Number(map2.minute));
  const offsetMs2 = tzAsUtc2 - refinedGuess.getTime();

  return new Date(utcGuess.getTime() - offsetMs2).toISOString();
}
