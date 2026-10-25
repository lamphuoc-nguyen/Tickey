import { AgentRegistryEntry } from '../schemas/agent-config.js';

/**
 * Options for filtering registry entries
 */
export interface AgentListOptions {
  enabledOnly?: boolean;
  category?: string;
  tag?: string;
}

/**
 * Filter registry entries. Pure: safe to use in the browser on a statically loaded registry.json.
 */
export function filterAgents(agents: AgentRegistryEntry[], options?: AgentListOptions): AgentRegistryEntry[] {
  let result = agents;

  if (options?.enabledOnly) {
    result = result.filter(a => a.enabled);
  }
  if (options?.category) {
    result = result.filter(a => a.category === options.category);
  }
  if (options?.tag) {
    const tag = options.tag;
    result = result.filter(a => a.tags.includes(tag));
  }

  return result;
}

/**
 * Registry config paths are stored with forward slashes so they resolve the same on every OS
 * and match the keys of `import.meta.glob`.
 */
export function toPosixPath(path: string): string {
  return path.replace(/\\/g, '/');
}
