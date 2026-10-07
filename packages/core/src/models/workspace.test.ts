import { describe, expect, it } from 'vitest';
import { readActiveWorkspace } from './workspace';

const token = (claims: object) => `h.${btoa(JSON.stringify(claims)).replace(/=+$/, '')}.s`;

describe('readActiveWorkspace', () => {
  it('reads the claim written by custom_access_token_hook', () => {
    const ws = readActiveWorkspace(
      token({ active_workspace: { kind: 'ORG', org_id: 'o1', roles: ['OWNER'] } }),
    );
    expect(ws).toEqual({ kind: 'ORG', orgId: 'o1', roles: ['OWNER'] });
  });

  it('falls back to CUSTOMER without a usable claim', () => {
    expect(readActiveWorkspace(undefined).kind).toBe('CUSTOMER');
    expect(readActiveWorkspace(token({})).kind).toBe('CUSTOMER');
    expect(readActiveWorkspace('not-a-jwt').kind).toBe('CUSTOMER');
  });
});
