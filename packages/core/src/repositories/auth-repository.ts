import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ApiError } from '../errors';
import { readActiveWorkspace } from '../models/workspace';
import { authError } from '../api/auth-error';

export interface AuthSession {
  userId: string;
  email: string;
  workspace: ReturnType<typeof readActiveWorkspace>;
}
const emailSchema = z.email();
const passwordSchema = z.string().min(8);
export class SupabaseAuthRepository {
  private readonly client: SupabaseClient;
  constructor(client: SupabaseClient) {
    this.client = client;
  }
  private snapshot(
    session: {
      access_token: string;
      user: { id: string; email?: string; email_confirmed_at?: string | null };
    } | null,
  ): AuthSession | null {
    // Keep cached/event sessions out of app routing until Auth has confirmed the email.
    // Supabase's Confirm Email setting remains responsible for enforcing this on the server.
    return session?.user.email_confirmed_at
      ? {
          userId: session.user.id,
          email: session.user.email ?? '',
          workspace: readActiveWorkspace(session.access_token),
        }
      : null;
  }
  async session(): Promise<AuthSession | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw authError(error);
    return this.snapshot(data.session);
  }
  subscribe(listener: (session: AuthSession | null, event: string) => void) {
    const { data } = this.client.auth.onAuthStateChange((event, session) =>
      listener(this.snapshot(session), event),
    );
    return () => data.subscription.unsubscribe();
  }
  async login(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: emailSchema.parse(email.trim()),
      password: z.string().min(1).parse(password),
    });
    if (error) throw authError(error);
    if (!data.user.email_confirmed_at) {
      await this.client.auth.signOut({ scope: 'local' });
      throw new ApiError('UNAUTHENTICATED', { reason: 'EMAIL_NOT_CONFIRMED' });
    }
  }
  async register(email: string, password: string, name: string, redirectTo: string) {
    const { data, error } = await this.client.auth.signUp({
      email: emailSchema.parse(email.trim()),
      password: passwordSchema.parse(password),
      options: {
        data: { full_name: z.string().trim().min(1).parse(name) },
        emailRedirectTo: z.url().parse(redirectTo),
      },
    });
    if (error) throw authError(error);
    if (data.session && !data.session.user.email_confirmed_at) {
      await this.client.auth.signOut({ scope: 'local' });
      return false;
    }
    return Boolean(data.session);
  }
  async logout() {
    const { error } = await this.client.auth.signOut();
    if (error) throw new ApiError('NETWORK');
  }
  async sendOtp(email: string) {
    const { error } = await this.client.auth.signInWithOtp({
      email: emailSchema.parse(email),
      options: { shouldCreateUser: false },
    });
    if (error) throw authError(error);
  }
  async resendSignup(email: string, redirectTo?: string) {
    const { error } = await this.client.auth.resend({
      type: 'signup',
      email: emailSchema.parse(email.trim()),
      ...(redirectTo ? { options: { emailRedirectTo: z.url().parse(redirectTo) } } : {}),
    });
    if (error) throw authError(error);
  }
  async verifyOtp(email: string, token: string, type: 'email' | 'signup' = 'email') {
    const { error } = await this.client.auth.verifyOtp({
      email: emailSchema.parse(email.trim()),
      token: z.string().trim().regex(/^\d{6,10}$/).parse(token),
      type: type === 'signup' ? 'email' : type,
    });
    if (error) throw authError(error);
  }
  async forgotPassword(email: string, redirectTo: string) {
    const { error } = await this.client.auth.resetPasswordForEmail(emailSchema.parse(email), { redirectTo });
    if (error) throw authError(error);
  }
  async resetPassword(password: string) {
    const { error } = await this.client.auth.updateUser({ password: passwordSchema.parse(password) });
    if (error) throw authError(error);
  }
  async acceptCallback(params: {
    code?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenHash?: string;
    type?: 'recovery' | 'signup' | 'email';
  }) {
    if (params.code) {
      const { error } = await this.client.auth.exchangeCodeForSession(params.code);
      if (error) throw authError(error);
    } else if (params.accessToken && params.refreshToken) {
      const { error } = await this.client.auth.setSession({
        access_token: params.accessToken,
        refresh_token: params.refreshToken,
      });
      if (error) throw authError(error);
    } else if (params.tokenHash && params.type) {
      const { error } = await this.client.auth.verifyOtp({
        token_hash: params.tokenHash,
        type: params.type === 'signup' ? 'email' : params.type,
      });
      if (error) throw authError(error);
    } else throw new ApiError('VALIDATION_FAILED', {}, 'Liên kết xác thực không đầy đủ.');
  }
  setForeground(active: boolean) {
    if (active) this.client.auth.startAutoRefresh();
    else this.client.auth.stopAutoRefresh();
  }
}
