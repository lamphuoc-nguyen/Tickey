import { createAgentRegistryManager } from '../registry/agent-registry.ts';
import { AgentConfigSchema } from '../schemas/agent-config.ts';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Default to the repo root (src/cli -> packages/agent-manager -> repo), since pnpm runs scripts in the package dir.
const DEFAULT_ROOT = resolve(import.meta.dirname, '../../../..');

interface CLIOptions {
  projectRoot?: string;
  config?: string;
  format?: 'table' | 'json' | 'csv';
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--root' || arg === '-r') {
      options.projectRoot = args[++i];
    } else if (arg === '--config' || arg === '-c') {
      options.config = args[++i];
    } else if (arg === '--format' || arg === '-f') {
      options.format = args[++i] as CLIOptions['format'];
    }
  }
  return options;
}

function formatTable(agents: any[], columns: string[]): string {
  if (agents.length === 0) {
    return 'No agents found.';
  }

  // Calculate column widths
  const widths: Record<string, number> = {};
  for (const col of columns) {
    widths[col] = col.length;
  }
  for (const agent of agents) {
    for (const col of columns) {
      const val = String(agent[col as keyof typeof agent] ?? '');
      const currentWidth = widths[col] ?? 0;
      widths[col] = Math.max(currentWidth, val.length);
    }
  }

  // Build header
  const header = columns.map(col => col.padEnd(widths[col] ?? 0)).join(' | ');
  const separator = columns.map(col => '-'.repeat(widths[col] ?? 0)).join('-+-');

  // Build rows
  const rows = agents.map(agent =>
    columns.map(col => String(agent[col as keyof typeof agent] ?? '').padEnd(widths[col] ?? 0)).join(' | ')
  );

  return [header, separator, ...rows].join('\n');
}

function formatJSON(agents: any[]): string {
  return JSON.stringify(agents, null, 2);
}

function formatCSV(agents: any[], columns: string[]): string {
  const header = columns.join(',');
  const rows = agents.map(agent =>
    columns.map(col => {
      const val = agent[col as keyof typeof agent] ?? '';
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  const projectRoot = options.projectRoot ? resolve(options.projectRoot) : DEFAULT_ROOT;
  const manager = createAgentRegistryManager(projectRoot);

  const agents = manager.listAgents({ enabledOnly: true });
  const columns = ['id', 'name', 'version', 'category', 'tags'];

  let output: string;
  switch (options.format) {
    case 'json':
      output = formatJSON(agents);
      break;
    case 'csv':
      output = formatCSV(agents, columns);
      break;
    case 'table':
    default:
      output = formatTable(agents, columns);
      break;
  }

  console.log(output);
  console.log(`\nTotal: ${agents.length} agent(s)`);
}

main().catch(console.error);