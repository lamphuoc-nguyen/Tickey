import { ticketSchema, type Ticket } from '@event/core';

export interface TicketStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
export interface SavedTicket {
  ticket: Ticket;
  downloadedAt: string;
}
function databaseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(databaseKeys);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
        databaseKeys(item),
      ]),
    );
  return value;
}
/** Genuine server responses only; isolated by account. Cached status never proves gate validity. */
export class TicketCache {
  private activeAccount: string | null = null;
  private generation = 0;
  private writeQueue: Promise<void> = Promise.resolve();
  constructor(private readonly storage: TicketStorage) {}
  activate(userId: string | null) {
    if (this.activeAccount !== userId) {
      this.activeAccount = userId;
      this.generation++;
    }
  }
  private key(userId: string) {
    return `tickey:tickets:v1:${userId}`;
  }
  async list(userId: string): Promise<SavedTicket[]> {
    const raw = await this.storage.getItem(this.key(userId));
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((entry: unknown) => {
        if (
          !entry ||
          typeof entry !== 'object' ||
          !('ticket' in entry) ||
          !('downloadedAt' in entry) ||
          typeof entry.downloadedAt !== 'string'
        )
          return [];
        const result = ticketSchema.safeParse(databaseKeys(entry.ticket));
        return result.success ? [{ ticket: result.data, downloadedAt: entry.downloadedAt }] : [];
      });
    } catch {
      return [];
    }
  }
  save(userId: string, ticket: Ticket, downloadedAt: string): Promise<void> {
    const generation = this.generation;
    const operation = this.writeQueue.then(() => this.saveSnapshot(userId, ticket, downloadedAt, generation));
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }
  private async saveSnapshot(userId: string, ticket: Ticket, downloadedAt: string, generation: number) {
    if (this.generation !== generation) throw new Error('Tài khoản đã thay đổi.');
    if (this.activeAccount !== userId) throw new Error('Tài khoản đã thay đổi.');
    const existing = await this.list(userId);
    if (this.activeAccount !== userId || this.generation !== generation)
      throw new Error('Tài khoản đã thay đổi.');
    await this.storage.setItem(
      this.key(userId),
      JSON.stringify([...existing.filter((t) => t.ticket.id !== ticket.id), { ticket, downloadedAt }]),
    );
    await this.storage.setItem('tickey:tickets:last-account', userId);
    if (this.activeAccount !== userId || this.generation !== generation) {
      await this.clear(userId);
      throw new Error('Tài khoản đã thay đổi.');
    }
  }
  async lastAccount() {
    return this.storage.getItem('tickey:tickets:last-account');
  }
  async clear(userId: string) {
    if ((await this.lastAccount()) === userId) await this.storage.removeItem('tickey:tickets:last-account');
    await this.storage.removeItem(this.key(userId));
  }
}
