// Browser-safe entry: no Node built-ins (fs, path, url) may be imported from here.
// Schemas
export * from './schemas/agent-config.js';

// Registry queries (pure). The file-backed AgentRegistryManager lives in '@event/agent-manager/node'.
export { filterAgents, toPosixPath } from './registry/registry-query.js';
export type { AgentListOptions } from './registry/registry-query.js';

// Utilities
export {
  generateUUID,
  isValidUUID,
  generateShortId,
  slugify,
} from './utils/id.js';

// Types re-exported for convenience
export type {
  ModelProvider,
  ModelConfig,
  ToolConfig,
  SkillConfig,
  MemoryConfig,
  PersonaConfig,
  WorkflowStep,
  WorkflowConfig,
  AgentConfig,
  AgentDirectoryConfig,
  AgentRegistryEntry,
  AgentRegistry,
} from './schemas/agent-config.js';