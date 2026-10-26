# @event/agent-manager

A comprehensive AI agent configuration management system for the Event Platform monorepo.

## Features

- **Agent Configuration Schema**: Define agents with Zod-validated schemas including persona, model, tools, skills, memory, and workflows
- **Agent Registry**: Discover, register, and manage agent configurations from a directory structure
- **CLI Tools**: Command-line interface for listing, validating, and registering agents
- **TypeScript Support**: Full type safety with Zod schema validation
- **Multi-format Support**: JSON and YAML configuration files
- **Workflow Support**: Define multi-agent workflows with conditional steps

## Installation

```bash
# Already part of the monorepo
pnpm install
```

## Quick Start

### 1. Create an Agent Configuration

Create a JSON file in `agents/<category>/<name>-v<version>.json`:

```json
{
  "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  "name": "Code Reviewer",
  "version": "1.0.0",
  "description": "An AI agent specialized in reviewing code",
  "author": "Event Platform Team",
  "tags": ["code-review", "security", "typescript"],
  "category": "coding",
  "persona": {
    "name": "Code Reviewer",
    "role": "Senior Software Engineer",
    "description": "Expert code reviewer",
    "instructions": "Review code for quality, security, and best practices...",
    "tone": "professional",
    "language": "en"
  },
  "model": {
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "temperature": 0.3,
    "maxTokens": 8192
  },
  "tools": [
    {
      "name": "read_file",
      "description": "Read file contents",
      "type": "builtin",
      "builtinName": "read",
      "enabled": true
    }
  ],
  "skills": [
    {
      "name": "typescript-best-practices",
      "version": "1.0.0",
      "enabled": true
    }
  ],
  "memory": {
    "type": "short-term",
    "maxMessages": 30
  },
  "workflows": [],
  "timeout": 180000,
  "maxTurns": 20,
  "parallelExecution": false,
  "envVars": [],
  "requiredSecrets": ["GITHUB_TOKEN"]
}
```

### 2. Register Agents

The scripts live in this package: run them here, or from the repo root as
`pnpm --filter @event/agent-manager agent:<cmd> ...`. The project root defaults to the repo root (override with
`--root <dir>`), and `--file` is relative to that root. The CLI runs on Node's built-in type stripping (Node ≥ 22.18), so files it imports use `.ts` specifiers and
`import type` for types.

```bash
# Register all discovered agents
pnpm agent:register --all

# Register a specific agent
pnpm agent:register --file agents/coding/code-reviewer-v1.0.0.json
```

### 3. List Agents

```bash
# List all agents (table format)
pnpm agent:list

# List as JSON
pnpm agent:list --format json

# List as CSV
pnpm agent:list --format csv
```

### 4. Validate Agents

```bash
# Validate all registered agents
pnpm agent:validate --all

# Validate a specific file
pnpm agent:validate --file agents/coding/code-reviewer-v1.0.0.json

# Validate all discovered configs
pnpm agent:validate
```

## Directory Structure

```
agents/
├── general/
│   └── general-assistant-v1.0.0.json
├── coding/
│   └── code-reviewer-v1.0.0.json
├── analysis/
│   └── data-analyst-v1.0.0.json
├── creative/
├── research/
└── workflow/
    └── deployment-pipeline-v1.0.0.json
```

## Configuration Schema

### AgentConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Unique identifier (v4 UUID) |
| `name` | string | Yes | Human-readable name |
| `version` | string | Yes | Semantic version (x.y.z) |
| `description` | string | No | Description of the agent |
| `author` | string | No | Author name |
| `tags` | string[] | No | Tags for categorization |
| `category` | enum | No | general, coding, analysis, creative, research, workflow, custom |
| `persona` | PersonaConfig | Yes | Agent personality and instructions |
| `model` | ModelConfig | Yes | AI model configuration |
| `tools` | ToolConfig[] | No | Available tools |
| `skills` | SkillConfig[] | No | Enabled skills |
| `memory` | MemoryConfig | No | Memory configuration |
| `workflows` | WorkflowConfig[] | No | Multi-agent workflows |
| `timeout` | number | No | Execution timeout in ms (default: 300000) |
| `maxTurns` | number | No | Maximum conversation turns (default: 50) |
| `parallelExecution` | boolean | No | Enable parallel execution (default: false) |
| `envVars` | string[] | No | Required environment variables |
| `requiredSecrets` | string[] | No | Required secret names |
| `onStart` | string | No | Module path for start hook |
| `onEnd` | string | No | Module path for end hook |
| `onError` | string | No | Module path for error hook |

### PersonaConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Persona name |
| `role` | string | Yes | Role/title |
| `description` | string | Yes | Description |
| `instructions` | string | Yes | System instructions |
| `tone` | enum | No | professional, casual, technical, friendly, authoritative |
| `language` | string | No | Language code (default: en) |

### ModelConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | enum | Yes | openai, anthropic, google, mistral, cohere, local, custom |
| `model` | string | Yes | Model identifier |
| `temperature` | number | No | 0-2 (default: 0.7) |
| `maxTokens` | number | No | Maximum tokens |
| `topP` | number | No | 0-1 |
| `frequencyPenalty` | number | No | -2 to 2 |
| `presencePenalty` | number | No | -2 to 2 |
| `options` | object | No | Provider-specific options |

### ToolConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Tool name |
| `description` | string | Yes | Tool description |
| `type` | enum | Yes | function, mcp, builtin, custom |
| `parameters` | object | No | Function parameters schema |
| `mcpServer` | string | No | MCP server name |
| `builtinName` | string | No | Builtin tool name |
| `handler` | string | No | Custom handler module path |
| `enabled` | boolean | No | Enable/disable tool (default: true) |

### SkillConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Skill name |
| `version` | string | No | Skill version |
| `enabled` | boolean | No | Enable/disable (default: true) |
| `config` | object | No | Skill-specific configuration |

### MemoryConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | enum | Yes | none, short-term, long-term, vector, hybrid |
| `maxMessages` | number | No | Max messages in short-term memory (default: 50) |
| `maxTokens` | number | No | Max tokens in memory |
| `vectorStore` | object | No | Vector store configuration |

### WorkflowConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Workflow ID |
| `name` | string | Yes | Workflow name |
| `description` | string | Yes | Description |
| `steps` | WorkflowStep[] | Yes | Workflow steps |
| `trigger` | enum | No | manual, schedule, event, webhook |
| `schedule` | string | No | Cron expression for scheduled triggers |
| `eventFilter` | string | No | Event filter for event triggers |

### WorkflowStep

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Step ID |
| `name` | string | Yes | Step name |
| `description` | string | Yes | Description |
| `agent` | string | Yes | Agent ID to execute this step |
| `input` | object | No | Input parameters |
| `output` | object | No | Expected output schema |
| `condition` | string | No | Condition expression |
| `retry` | object | No | Retry configuration |

## Programmatic Usage

```typescript
import { createAgentRegistryManager, AgentConfig } from '@event/agent-manager';

// Create registry manager
const manager = createAgentRegistryManager('/path/to/project', {
  agentsDir: './agents',
  registryFile: 'registry.json',
  autoDiscover: true,
  validateOnLoad: true,
});

// Register all discovered agents
const entries = await manager.registerAllDiscovered();

// List agents
const agents = manager.listAgents({ enabledOnly: true, category: 'coding' });

// Load agent configuration
const config = await manager.loadAgent('agent-id');

// Create new agent
const configPath = await manager.createAgentConfig({
  name: 'My Agent',
  version: '1.0.0',
  category: 'coding',
  persona: { ... },
  model: { ... },
  // ...
});
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `pnpm agent:list` | List all registered agents |
| `pnpm agent:list --format json` | List as JSON |
| `pnpm agent:list --format csv` | List as CSV |
| `pnpm agent:validate` | Validate discovered configs |
| `pnpm agent:validate --all` | Validate registered agents |
| `pnpm agent:validate --file <path>` | Validate specific file |
| `pnpm agent:register --all` | Register all discovered agents |
| `pnpm agent:register --file <path>` | Register specific file |
| `pnpm agent:register --enable --id <id>` | Enable agent |
| `pnpm agent:register --disable --id <id>` | Disable agent |
| `pnpm agent:register --tags <tags> --id <id>` | Update agent tags |

## Export/Import Registry

```typescript
// Export registry with full configs
await manager.exportRegistry('./backup/registry-export.json');

// Import registry
const imported = await manager.importRegistry('./backup/registry-export.json');
```

## Integration with Other Packages

```typescript
// In other packages
import { AgentConfig, createAgentRegistryManager } from '@event/agent-manager';

const manager = createAgentRegistryManager();
const agent = await manager.loadAgent('code-reviewer-id');
// Use agent configuration for execution
```

## License

MIT