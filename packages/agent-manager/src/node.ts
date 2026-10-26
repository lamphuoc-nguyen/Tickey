// Node entry: everything from the browser-safe entry plus the file-backed registry (fs/path).
export * from './index.js';

export {
  AgentRegistryManager,
  createAgentRegistryManager,
} from './registry/agent-registry.js';
