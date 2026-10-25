import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentConfigSchema, validateAgentConfig, safeValidateAgentConfig } from './schemas/agent-config.js';
import { createAgentRegistryManager } from './registry/agent-registry.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { generateUUID } from './utils/id.js';

describe('Agent Config Schema', () => {
  const createValidConfig = (overrides: Partial<typeof validConfig> = {}) => ({
    ...validConfig,
    ...overrides,
    id: generateUUID(),
  });

  const validConfig = {
    id: generateUUID(),
    name: 'Test Agent',
    version: '1.0.0',
    description: 'A test agent',
    author: 'Test Author',
    tags: ['test', 'demo'],
    category: 'general',
    persona: {
      name: 'Test Agent',
      role: 'Tester',
      description: 'A test agent for unit tests',
      instructions: 'Test instructions',
      tone: 'friendly' as const,
      language: 'en',
    },
    model: {
      provider: 'openai' as const,
      model: 'gpt-4o',
      temperature: 0.7,
    },
    tools: [],
    skills: [],
    memory: {
      type: 'short-term' as const,
      maxMessages: 50,
    },
    workflows: [],
    timeout: 120000,
    maxTurns: 30,
    parallelExecution: false,
    envVars: [],
    requiredSecrets: [],
  };

  it('should validate a valid agent config', () => {
    const result = safeValidateAgentConfig(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Test Agent');
      expect(result.data.version).toBe('1.0.0');
    }
  });

  it('should reject config with invalid UUID', () => {
    const invalidConfig = { ...validConfig, id: 'not-a-uuid' };
    const result = safeValidateAgentConfig(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('should reject config with missing required fields', () => {
    const invalidConfig = { ...validConfig };
    delete (invalidConfig as any).name;
    const result = safeValidateAgentConfig(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('should reject config with invalid version format', () => {
    const invalidConfig = { ...validConfig, version: '1.0' };
    const result = safeValidateAgentConfig(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('should reject config with invalid category', () => {
    const invalidConfig = { ...validConfig, category: 'invalid-category' as any };
    const result = safeValidateAgentConfig(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('should reject config with invalid temperature', () => {
    const invalidConfig = {
      ...validConfig,
      model: { ...validConfig.model, temperature: 3.0 },
    };
    const result = safeValidateAgentConfig(invalidConfig);
    expect(result.success).toBe(false);
  });
});

describe('Agent Registry Manager', () => {
  let testDir: string;
  let agentsDir: string;
  let registryPath: string;

  const createValidConfig = (overrides: Partial<typeof validConfig> = {}) => ({
    ...validConfig,
    ...overrides,
    id: generateUUID(),
  });

  const validConfig = {
    id: generateUUID(),
    name: 'Test Agent',
    version: '1.0.0',
    description: 'A test agent',
    author: 'Test Author',
    tags: ['test', 'demo'],
    category: 'general',
    persona: {
      name: 'Test Agent',
      role: 'Tester',
      description: 'A test agent for unit tests',
      instructions: 'Test instructions',
      tone: 'friendly' as const,
      language: 'en',
    },
    model: {
      provider: 'openai' as const,
      model: 'gpt-4o',
      temperature: 0.7,
    },
    tools: [],
    skills: [],
    memory: {
      type: 'short-term' as const,
      maxMessages: 50,
    },
    workflows: [],
    timeout: 120000,
    maxTurns: 30,
    parallelExecution: false,
    envVars: [],
    requiredSecrets: [],
  };

  beforeEach(() => {
    testDir = join(tmpdir(), `agent-manager-test-${Date.now()}`);
    agentsDir = join(testDir, 'agents');
    registryPath = join(testDir, 'registry.json');
    mkdirSync(agentsDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create a new registry manager', () => {
    const manager = createAgentRegistryManager(testDir, {
      agentsDir: './agents',
      registryFile: 'registry.json',
    });
    expect(manager).toBeDefined();
    expect(manager.getConfig().agentsDir).toBe('./agents');
  });

  it('should register an agent from config file', async () => {
    const manager = createAgentRegistryManager(testDir, {
      agentsDir: './agents',
      registryFile: 'registry.json',
    });

    const config = createValidConfig();
    const configPath = join(agentsDir, 'test-agent.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const entry = await manager.registerAgent('./agents/test-agent.json');
    expect(entry.id).toBe(config.id);
    expect(entry.name).toBe('Test Agent');
    expect(entry.enabled).toBe(true);
  });

  it('should list registered agents', async () => {
    const manager = createAgentRegistryManager(testDir, {
      agentsDir: './agents',
      registryFile: 'registry.json',
    });

    const config = createValidConfig();
    const configPath = join(agentsDir, 'test-agent.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    await manager.registerAgent('./agents/test-agent.json');

    const agents = manager.listAgents();
    expect(agents.length).toBe(1);
    expect(agents[0]?.name).toBe('Test Agent');
  });

  it('should filter agents by category', async () => {
    const manager = createAgentRegistryManager(testDir, {
      agentsDir: './agents',
      registryFile: 'registry.json',
    });

    const config1 = createValidConfig({ category: 'coding' });
    const config2 = createValidConfig({ category: 'general' });

    writeFileSync(join(agentsDir, 'coding-agent.json'), JSON.stringify(config1, null, 2));
    writeFileSync(join(agentsDir, 'general-agent.json'), JSON.stringify(config2, null, 2));

    await manager.registerAgent('./agents/coding-agent.json');
    await manager.registerAgent('./agents/general-agent.json');

    const codingAgents = manager.listAgents({ category: 'coding' });
    expect(codingAgents.length).toBe(1);
    expect(codingAgents[0]?.category).toBe('coding');
  });

  it('should enable and disable agents', async () => {
    const manager = createAgentRegistryManager(testDir, {
      agentsDir: './agents',
      registryFile: 'registry.json',
    });

    const config = createValidConfig();
    const configPath = join(agentsDir, 'test-agent.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    await manager.registerAgent('./agents/test-agent.json');
    const agentId = config.id;

    expect(manager.setAgentEnabled(agentId, false)).toBe(true);
    expect(manager.getAgent(agentId)?.enabled).toBe(false);

    expect(manager.setAgentEnabled(agentId, true)).toBe(true);
    expect(manager.getAgent(agentId)?.enabled).toBe(true);
  });

  it('should load agent configuration', async () => {
    const manager = createAgentRegistryManager(testDir, {
      agentsDir: './agents',
      registryFile: 'registry.json',
    });

    const config = createValidConfig();
    const configPath = join(agentsDir, 'test-agent.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    await manager.registerAgent('./agents/test-agent.json');
    const agentId = config.id;

    const loadedConfig = await manager.loadAgent(agentId);
    expect(loadedConfig).not.toBeNull();
    expect(loadedConfig?.name).toBe('Test Agent');
  });
});

describe('Utility Functions', () => {
  it('should generate valid UUIDs', () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should generate unique UUIDs', () => {
    const uuids = new Set();
    for (let i = 0; i < 100; i++) {
      uuids.add(generateUUID());
    }
    expect(uuids.size).toBe(100);
  });
});