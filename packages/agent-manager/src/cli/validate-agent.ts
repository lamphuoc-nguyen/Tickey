import { createAgentRegistryManager } from '../registry/agent-registry.js';
import { validateAgentConfig, safeValidateAgentConfig } from '../schemas/agent-config.js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

interface CLIOptions {
  projectRoot?: string;
  file?: string;
  all?: boolean;
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
    }
  }
  return options;
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  const projectRoot = options.projectRoot || process.cwd();
  const manager = createAgentRegistryManager(projectRoot);

  let hasErrors = false;

  if (options.file) {
    // Validate a specific file
    const filePath = resolve(projectRoot, options.file);
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }

    console.log(`Validating: ${filePath}`);
    const result = safeValidateAgentConfig(JSON.parse(readFileSync(filePath, 'utf-8')));

    if (result.success) {
      console.log('✓ Valid agent configuration');
      console.log(`  ID: ${result.data.id}`);
      console.log(`  Name: ${result.data.name}`);
      console.log(`  Version: ${result.data.version}`);
      console.log(`  Category: ${result.data.category}`);
    } else {
      console.error('✗ Invalid agent configuration:');
      for (const issue of result.error.issues) {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      }
      hasErrors = true;
    }
  } else if (options.all) {
    // Validate all registered agents
    console.log('Validating all registered agents...\n');
    const agents = manager.listAgents();

    for (const entry of agents) {
      const config = await manager.loadAgent(entry.id);
      if (!config) {
        console.error(`✗ ${entry.name} (${entry.id}): Failed to load config`);
        hasErrors = true;
        continue;
      }

      const result = safeValidateAgentConfig(config);
      if (result.success) {
        console.log(`✓ ${entry.name} (${entry.id}) v${entry.version}`);
      } else {
        console.error(`✗ ${entry.name} (${entry.id}):`);
        for (const issue of result.error.issues) {
          console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
        }
        hasErrors = true;
      }
    }

    console.log(`\nValidation complete. ${hasErrors ? 'Some agents have errors.' : 'All agents valid.'}`);
  } else {
    // Validate discovered agents
    console.log('Discovering and validating agents...\n');
    const configFiles = manager.discoverAgents();

    if (configFiles.length === 0) {
      console.log('No agent configuration files found.');
      return;
    }

    for (const file of configFiles) {
      try {
        const config = await manager.loadAgentConfig(file);
        const result = safeValidateAgentConfig(config);
        if (result.success) {
          console.log(`✓ ${config.name} (${config.id}) v${config.version} - ${file}`);
        } else {
          console.error(`✗ ${file}:`);
          for (const issue of result.error.issues) {
            console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
          }
          hasErrors = true;
        }
      } catch (error) {
        console.error(`✗ ${file}: ${error}`);
        hasErrors = true;
      }
    }

    console.log(`\nValidation complete. ${hasErrors ? 'Some configs have errors.' : 'All configs valid.'}`);
  }

  process.exit(hasErrors ? 1 : 0);
}

main().catch(console.error);