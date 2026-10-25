import { z } from 'zod';

/**
 * Supported AI model providers
 */
export const ModelProviderSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'mistral',
  'cohere',
  'local',
  'custom'
]);

/**
 * Model configuration for an agent
 */
export const ModelConfigSchema = z.object({
  provider: ModelProviderSchema,
  model: z.string(),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  // Provider-specific options
  options: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Tool configuration for an agent
 */
export const ToolConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  type: z.enum(['function', 'mcp', 'builtin', 'custom']),
  // For function tools
  parameters: z.record(z.string(), z.unknown()).optional(),
  // For MCP tools
  mcpServer: z.string().optional(),
  // For builtin tools
  builtinName: z.string().optional(),
  // For custom tools
  handler: z.string().optional(), // Module path to handler
  enabled: z.boolean(),
});

/**
 * Skill configuration for an agent
 */
export const SkillConfigSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Memory configuration for an agent
 */
export const MemoryConfigSchema = z.object({
  type: z.enum(['none', 'short-term', 'long-term', 'vector', 'hybrid']),
  maxMessages: z.number().positive(),
  maxTokens: z.number().positive().optional(),
  vectorStore: z.object({
    provider: z.string(),
    collection: z.string(),
    embeddingModel: z.string(),
  }).optional(),
});

/**
 * Agent persona configuration
 */
export const PersonaConfigSchema = z.object({
  name: z.string(),
  role: z.string(),
  description: z.string(),
  instructions: z.string(),
  tone: z.enum(['professional', 'casual', 'technical', 'friendly', 'authoritative']).optional(),
  language: z.string(),
});

/**
 * Workflow step configuration
 */
export const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  agent: z.string(), // Reference to another agent by ID
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  condition: z.string().optional(), // Expression to evaluate
  retry: z.object({
    maxAttempts: z.number().positive(),
    backoffMs: z.number().positive(),
  }).optional(),
});

/**
 * Workflow configuration
 */
export const WorkflowConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  steps: z.array(WorkflowStepSchema),
  trigger: z.enum(['manual', 'schedule', 'event', 'webhook']),
  schedule: z.string().optional(), // Cron expression
  eventFilter: z.string().optional(), // Event filter expression
});

/**
 * Agent configuration schema
 */
export const AgentConfigSchema = z.object({
  // Required fields
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/), // Semantic versioning

  // Optional metadata
  description: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()),
  category: z.enum(['general', 'coding', 'analysis', 'creative', 'research', 'workflow', 'custom']),

  // Core configuration
  persona: PersonaConfigSchema,
  model: ModelConfigSchema,
  tools: z.array(ToolConfigSchema),
  skills: z.array(SkillConfigSchema),
  memory: MemoryConfigSchema,

  // Workflow configuration (optional)
  workflows: z.array(WorkflowConfigSchema),

  // Execution settings
  timeout: z.number().positive(),
  maxTurns: z.number().positive(),
  parallelExecution: z.boolean(),

  // Environment & secrets
  envVars: z.array(z.string()),
  requiredSecrets: z.array(z.string()),

  // Lifecycle hooks
  onStart: z.string().optional(), // Module path to hook
  onEnd: z.string().optional(),
  onError: z.string().optional(),

  // Metadata
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

/**
 * Agent directory configuration (for the manager itself)
 */
export const AgentDirectoryConfigSchema = z.object({
  version: z.string(),
  agentsDir: z.string(),
  registryFile: z.string(),
  autoDiscover: z.boolean(),
  validateOnLoad: z.boolean(),
  defaultModel: ModelConfigSchema.optional(),
});

/**
 * Registry entry for an agent
 */
export const AgentRegistryEntrySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  category: z.string(),
  tags: z.array(z.string()),
  configPath: z.string(), // Relative path to agent config file
  enabled: z.boolean(),
  registeredAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Full registry schema
 */
export const AgentRegistrySchema = z.object({
  version: z.string(),
  agents: z.array(AgentRegistryEntrySchema),
  lastUpdated: z.string().datetime(),
});

// Default values
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  temperature: 0.7,
};

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  type: 'short-term',
  maxMessages: 50,
};

export const DEFAULT_PERSONA_CONFIG: PersonaConfig = {
  name: 'Assistant',
  role: 'AI Assistant',
  description: 'A helpful AI assistant',
  instructions: 'You are a helpful AI assistant.',
  tone: 'friendly',
  language: 'en',
};

export const DEFAULT_AGENT_DIRECTORY_CONFIG: AgentDirectoryConfig = {
  version: '1.0.0',
  agentsDir: './agents',
  registryFile: 'registry.json',
  autoDiscover: true,
  validateOnLoad: true,
};

// Type exports
export type ModelProvider = z.infer<typeof ModelProviderSchema>;
export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type ToolConfig = z.infer<typeof ToolConfigSchema>;
export type SkillConfig = z.infer<typeof SkillConfigSchema>;
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;
export type PersonaConfig = z.infer<typeof PersonaConfigSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type AgentDirectoryConfig = z.infer<typeof AgentDirectoryConfigSchema>;
export type AgentRegistryEntry = z.infer<typeof AgentRegistryEntrySchema>;
export type AgentRegistry = z.infer<typeof AgentRegistrySchema>;

// Validation helpers
export function validateAgentConfig(config: unknown): AgentConfig {
  return AgentConfigSchema.parse(config);
}

export function validateAgentRegistry(registry: unknown): AgentRegistry {
  return AgentRegistrySchema.parse(registry);
}

export function safeValidateAgentConfig(config: unknown) {
  return AgentConfigSchema.safeParse(config);
}

export function safeValidateAgentRegistry(registry: unknown) {
  return AgentRegistrySchema.safeParse(registry);
}