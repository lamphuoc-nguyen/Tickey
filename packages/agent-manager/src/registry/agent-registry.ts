import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  AgentConfig,
  AgentConfigSchema,
  AgentRegistry,
  AgentRegistryEntry,
  AgentRegistrySchema,
  AgentDirectoryConfig,
  AgentDirectoryConfigSchema,
  validateAgentConfig,
  validateAgentRegistry,
  safeValidateAgentConfig,
  safeValidateAgentRegistry,
  ModelConfig,
  DEFAULT_MODEL_CONFIG,
  DEFAULT_MEMORY_CONFIG,
  DEFAULT_PERSONA_CONFIG,
  DEFAULT_AGENT_DIRECTORY_CONFIG,
} from '../schemas/agent-config.js';
import { generateUUID } from '../utils/id.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Default configuration for the agent directory manager
 */
const DEFAULT_CONFIG: AgentDirectoryConfig = DEFAULT_AGENT_DIRECTORY_CONFIG;

/**
 * Agent Registry Manager
 * Handles discovery, loading, validation, and registration of agent configurations
 */
export class AgentRegistryManager {
  private config: AgentDirectoryConfig;
  private registry: AgentRegistry;
  private projectRoot: string;
  private agentsDir: string;
  private registryPath: string;

  constructor(projectRoot: string, config?: Partial<AgentDirectoryConfig>) {
    this.projectRoot = resolve(projectRoot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.agentsDir = resolve(this.projectRoot, this.config.agentsDir);
    this.registryPath = resolve(this.projectRoot, this.config.registryFile);

    // Initialize or load registry
    this.registry = this.loadRegistry();
  }

  /**
   * Load registry from file or create new one
   */
  private loadRegistry(): AgentRegistry {
    if (existsSync(this.registryPath)) {
      try {
        const content = readFileSync(this.registryPath, 'utf-8');
        const parsed = JSON.parse(content);
        const result = safeValidateAgentRegistry(parsed);
        if (result.success) {
          return result.data;
        }
        console.warn('Registry validation failed, creating new registry:', result.error.message);
      } catch (error) {
        console.warn('Failed to load registry, creating new one:', error);
      }
    }

    // Create new registry
    return {
      version: '1.0.0',
      agents: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Save registry to file
   */
  private saveRegistry(): void {
    this.registry.lastUpdated = new Date().toISOString();
    const dir = dirname(this.registryPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.registryPath, JSON.stringify(this.registry, null, 2));
  }

  /**
   * Discover agent configuration files in the agents directory
   */
  discoverAgents(): string[] {
    const configFiles: string[] = [];

    if (!existsSync(this.agentsDir)) {
      return configFiles;
    }

    const scanDir = (dir: string): void => {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.json') || entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
          configFiles.push(fullPath);
        }
      }
    };

    scanDir(this.agentsDir);
    return configFiles;
  }

  /**
   * Load and validate an agent configuration from a file
   */
  async loadAgentConfig(filePath: string): Promise<AgentConfig> {
    const content = readFileSync(filePath, 'utf-8');
    let parsed: unknown;

    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      // Dynamic import for yaml to avoid requiring it if not used
      const yaml = await import('yaml');
      parsed = yaml.parse(content);
    } else {
      parsed = JSON.parse(content);
    }

    if (this.config.validateOnLoad) {
      return validateAgentConfig(parsed);
    }

    const result = safeValidateAgentConfig(parsed);
    if (!result.success) {
      throw new Error(`Invalid agent config in ${filePath}: ${result.error.message}`);
    }
    return result.data;
  }

  /**
   * Register an agent from a configuration file
   */
  async registerAgent(configPath: string): Promise<AgentRegistryEntry> {
    const absolutePath = resolve(this.projectRoot, configPath);
    const config = await this.loadAgentConfig(absolutePath);

    // Check if agent already exists
    const existingIndex = this.registry.agents.findIndex(a => a.id === config.id);
    const relativePath = relative(this.projectRoot, absolutePath);
    const existingEntry = existingIndex >= 0 ? this.registry.agents[existingIndex] : null;

    const entry: AgentRegistryEntry = {
      id: config.id,
      name: config.name,
      version: config.version,
      description: config.description,
      category: config.category ?? 'general',
      tags: config.tags,
      configPath: relativePath,
      enabled: true,
      registeredAt: existingEntry?.registeredAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      this.registry.agents[existingIndex] = entry;
    } else {
      this.registry.agents.push(entry);
    }

    this.saveRegistry();
    return entry;
  }

  /**
   * Register multiple agents from discovered configs
   */
  async registerAllDiscovered(): Promise<AgentRegistryEntry[]> {
    const configFiles = this.discoverAgents();
    const results: AgentRegistryEntry[] = [];

    for (const file of configFiles) {
      try {
        const entry = await this.registerAgent(file);
        results.push(entry);
        console.log(`Registered agent: ${entry.name} (${entry.id})`);
      } catch (error) {
        console.error(`Failed to register agent from ${file}:`, error);
      }
    }

    return results;
  }

  /**
   * Unregister an agent by ID
   */
  unregisterAgent(agentId: string): boolean {
    const index = this.registry.agents.findIndex(a => a.id === agentId);
    if (index >= 0) {
      this.registry.agents.splice(index, 1);
      this.saveRegistry();
      return true;
    }
    return false;
  }

  /**
   * Get an agent registry entry by ID
   */
  getAgent(agentId: string): AgentRegistryEntry | undefined {
    return this.registry.agents.find(a => a.id === agentId);
  }

  /**
   * Get an agent registry entry by name
   */
  getAgentByName(name: string): AgentRegistryEntry | undefined {
    return this.registry.agents.find(a => a.name === name);
  }

  /**
   * List all registered agents
   */
  listAgents(options?: { enabledOnly?: boolean; category?: string; tag?: string }): AgentRegistryEntry[] {
    let agents = this.registry.agents;

    if (options?.enabledOnly) {
      agents = agents.filter(a => a.enabled);
    }
    if (options?.category) {
      agents = agents.filter(a => a.category === options.category);
    }
    if (options?.tag) {
      agents = agents.filter(a => a.tags.includes(options.tag!));
    }

    return agents;
  }

  /**
   * Load full agent configuration by ID
   */
  async loadAgent(agentId: string): Promise<AgentConfig | null> {
    const entry = this.getAgent(agentId);
    if (!entry) {
      return null;
    }

    const configPath = resolve(this.projectRoot, entry.configPath);
    return this.loadAgentConfig(configPath);
  }

  /**
   * Enable or disable an agent
   */
  setAgentEnabled(agentId: string, enabled: boolean): boolean {
    const entry = this.getAgent(agentId);
    if (!entry) {
      return false;
    }
    entry.enabled = enabled;
    entry.updatedAt = new Date().toISOString();
    this.saveRegistry();
    return true;
  }

  /**
   * Update agent tags
   */
  updateAgentTags(agentId: string, tags: string[]): boolean {
    const entry = this.getAgent(agentId);
    if (!entry) {
      return false;
    }
    entry.tags = tags;
    entry.updatedAt = new Date().toISOString();
    this.saveRegistry();
    return true;
  }

  /**
   * Create a new agent configuration file
   */
  async createAgentConfig(config: Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<string> {
    const agentConfig: AgentConfig = {
      ...config,
      id: config.id || generateUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Validate
    validateAgentConfig(agentConfig);

    // Determine file path
    const fileName = `${agentConfig.name.toLowerCase().replace(/\s+/g, '-')}-v${agentConfig.version}.json`;
    const categoryDir = join(this.agentsDir, agentConfig.category);
    if (!existsSync(categoryDir)) {
      mkdirSync(categoryDir, { recursive: true });
    }
    const filePath = join(categoryDir, fileName);

    // Write config file
    writeFileSync(filePath, JSON.stringify(agentConfig, null, 2));

    // Register
    await this.registerAgent(filePath);

    return filePath;
  }

  /**
   * Get the registry object
   */
  getRegistry(): AgentRegistry {
    return { ...this.registry };
  }

  /**
   * Get configuration
   */
  getConfig(): AgentDirectoryConfig {
    return { ...this.config };
  }

  /**
   * Export registry to a portable format
   */
  async exportRegistry(outputPath: string): Promise<void> {
    const agents = await Promise.all(
      this.registry.agents.map(async (entry) => {
        const config = await this.loadAgent(entry.id);
        return { entry, config };
      })
    );
    const exportData = {
      exportedAt: new Date().toISOString(),
      registry: this.registry,
      agents,
    };
    writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
  }

  /**
   * Import registry from a portable format
   */
  async importRegistry(inputPath: string): Promise<number> {
    const content = readFileSync(inputPath, 'utf-8');
    const data = JSON.parse(content);

    let imported = 0;
    for (const { entry, config } of data.agents) {
      if (config) {
        // Write config file
        const filePath = resolve(this.projectRoot, entry.configPath);
        const dir = dirname(filePath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(filePath, JSON.stringify(config, null, 2));

        // Register
        await this.registerAgent(entry.configPath);
        imported++;
      }
    }

    return imported;
  }
}

/**
 * Create a default agent registry manager for the project
 */
export function createAgentRegistryManager(projectRoot?: string, config?: Partial<AgentDirectoryConfig>): AgentRegistryManager {
  const root = projectRoot || process.cwd();
  return new AgentRegistryManager(root, config);
}