import { createAgentRegistryManager } from '../registry/agent-registry.ts';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Default to the repo root (src/cli -> packages/agent-manager -> repo), since pnpm runs scripts in the package dir.
const DEFAULT_ROOT = resolve(import.meta.dirname, '../../../..');

interface CLIOptions {
  projectRoot?: string;
  file?: string;
  all?: boolean;
  enable?: boolean;
  disable?: boolean;
  tags?: string;
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--root' || arg === '-r') {
      options.projectRoot = args[++i];
    } else if (arg === '--file' || arg === '-f') {
      options.file = args[++i];
    } else if (arg === '--all' || arg === '-a') {
      options.all = true;
    } else if (arg === '--enable') {
      options.enable = true;
    } else if (arg === '--disable') {
      options.disable = true;
    } else if (arg === '--tags' || arg === '-t') {
      options.tags = args[++i];
    }
  }
  return options;
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  const projectRoot = options.projectRoot ? resolve(options.projectRoot) : DEFAULT_ROOT;
  const manager = createAgentRegistryManager(projectRoot);

  if (options.file) {
    // Register a specific file
    const filePath = resolve(projectRoot, options.file);
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }

    console.log(`Registering agent from: ${filePath}`);
    try {
      const entry = await manager.registerAgent(filePath);
      console.log('✓ Agent registered successfully:');
      console.log(`  ID: ${entry.id}`);
      console.log(`  Name: ${entry.name}`);
      console.log(`  Version: ${entry.version}`);
      console.log(`  Category: ${entry.category}`);
      console.log(`  Path: ${entry.configPath}`);
    } catch (error) {
      console.error('✗ Failed to register agent:', error);
      process.exit(1);
    }
  } else if (options.all) {
    // Register all discovered agents
    console.log('Discovering and registering all agents...\n');
    const entries = await manager.registerAllDiscovered();
    console.log(`\nRegistered ${entries.length} agent(s).`);
  } else if (options.enable) {
    // Enable an agent (requires --id)
    const idArg = args.find(a => a.startsWith('--id=')) || args.find(a => a === '--id');
    const agentId = idArg?.includes('=') ? idArg.split('=')[1] : args[args.indexOf('--id') + 1];
    if (!agentId) {
      console.error('Please provide --id <agent-id> to enable an agent');
      process.exit(1);
    }
    if (manager.setAgentEnabled(agentId, true)) {
      console.log(`✓ Agent ${agentId} enabled`);
    } else {
      console.error(`✗ Agent ${agentId} not found`);
      process.exit(1);
    }
  } else if (options.disable) {
    // Disable an agent (requires --id)
    const idArg = args.find(a => a.startsWith('--id=')) || args.find(a => a === '--id');
    const agentId = idArg?.includes('=') ? idArg.split('=')[1] : args[args.indexOf('--id') + 1];
    if (!agentId) {
      console.error('Please provide --id <agent-id> to disable an agent');
      process.exit(1);
    }
    if (manager.setAgentEnabled(agentId, false)) {
      console.log(`✓ Agent ${agentId} disabled`);
    } else {
      console.error(`✗ Agent ${agentId} not found`);
      process.exit(1);
    }
  } else if (options.tags) {
    // Update agent tags (requires --id)
    const idArg = args.find(a => a.startsWith('--id=')) || args.find(a => a === '--id');
    const agentId = idArg?.includes('=') ? idArg.split('=')[1] : args[args.indexOf('--id') + 1];
    if (!agentId) {
      console.error('Please provide --id <agent-id> to update tags');
      process.exit(1);
    }
    const tags = options.tags.split(',').map(t => t.trim());
    if (manager.updateAgentTags(agentId, tags)) {
      console.log(`✓ Agent ${agentId} tags updated: ${tags.join(', ')}`);
    } else {
      console.error(`✗ Agent ${agentId} not found`);
      process.exit(1);
    }
  } else {
    console.log('Usage:');
    console.log('  pnpm agent:register --file <path>     Register a specific agent config file');
    console.log('  pnpm agent:register --all             Register all discovered agents');
    console.log('  pnpm agent:register --enable --id <id>  Enable an agent');
    console.log('  pnpm agent:register --disable --id <id> Disable an agent');
    console.log('  pnpm agent:register --tags <tags> --id <id> Update agent tags (comma-separated)');
  }
}

main().catch(console.error);