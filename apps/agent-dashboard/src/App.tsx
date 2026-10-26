import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  Bot,
  Settings,
  Plus,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Copy,
  Zap,
  Brain,
  GitBranch,
  Terminal,
  Info,
  FileCode,
} from 'lucide-react';
import {
  safeValidateAgentRegistry,
  safeValidateAgentConfig,
  filterAgents,
  type AgentConfig,
  type AgentRegistryEntry,
  type AgentRegistry,
  type ToolConfig,
  type SkillConfig,
  type WorkflowConfig,
  type WorkflowStep,
} from '@event/agent-manager';

const registryModules = import.meta.glob<Record<string, unknown>>('../../../registry.json', {
  eager: true,
  import: 'default',
});

const agentModules = import.meta.glob<Record<string, unknown>>('../../../agents/**/*.json', {
  eager: true,
  import: 'default',
});

interface StaticData {
  registry: AgentRegistry | null;
  registryError: string | null;
  configsById: Map<string, AgentConfig>;
  configsByPath: Map<string, AgentConfig>;
  configErrors: string[];
}

function loadStaticData(): StaticData {
  let registry: AgentRegistry | null = null;
  let registryError: string | null = null;

  const rawRegistry = Object.values(registryModules)[0];
  if (!rawRegistry) {
    registryError = 'registry.json was not found in the project root.';
  } else {
    const parsed = safeValidateAgentRegistry(rawRegistry);
    if (parsed.success) {
      registry = parsed.data;
    } else {
      registryError = `Invalid registry.json format: ${parsed.error.message}`;
    }
  }

  const configsById = new Map<string, AgentConfig>();
  const configsByPath = new Map<string, AgentConfig>();
  const configErrors: string[] = [];

  for (const [key, rawConfig] of Object.entries(agentModules)) {
    const normalizedPath = key.replace(/^\.\.\/\.\.\/\.\.\//, '');
    const parsed = safeValidateAgentConfig(rawConfig);
    if (parsed.success) {
      configsById.set(parsed.data.id, parsed.data);
      configsByPath.set(normalizedPath, parsed.data);
    } else {
      configErrors.push(`${normalizedPath}: ${parsed.error.message}`);
    }
  }

  return { registry, registryError, configsById, configsByPath, configErrors };
}

const staticData = loadStaticData();

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString();
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'coding': return <Terminal className="w-4 h-4" />;
    case 'analysis': return <Brain className="w-4 h-4" />;
    case 'workflow': return <GitBranch className="w-4 h-4" />;
    case 'creative': return <Zap className="w-4 h-4" />;
    case 'research': return <Search className="w-4 h-4" />;
    default: return <Bot className="w-4 h-4" />;
  }
}

function getStatusBadge(enabled: boolean) {
  return (
    <span className={`badge ${enabled ? 'badge-success' : 'badge-danger'}`}>
      {enabled ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span className="toast-message">{toast.message}</span>
          <button className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="Close toast">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

interface AgentListViewProps {
  filteredAgents: AgentRegistryEntry[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterCategory: string;
  setFilterCategory: (category: string) => void;
  categories: string[];
  onSelectAgent: (agentId: string) => void;
  onCopyId: (agentId: string) => void;
  onGoToCreate: () => void;
}

function AgentListView({
  filteredAgents,
  searchQuery,
  setSearchQuery,
  filterCategory,
  setFilterCategory,
  categories,
  onSelectAgent,
  onCopyId,
  onGoToCreate,
}: AgentListViewProps) {
  if (filteredAgents.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">
            <Bot className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="empty-state-title">No agents found</h3>
          <p className="empty-state-desc">No agents match your search or filter criteria</p>
          <button className="btn btn-primary" onClick={onGoToCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Create Agent Instructions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex-1 min-w-[250px]">
          <label className="form-label" htmlFor="agent-search-input">Search agents</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
            <input
              id="agent-search-input"
              type="text"
              className="form-input pl-10"
              placeholder="Search by name, ID, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="form-label" htmlFor="agent-category-select">Category</label>
            <select
              id="agent-category-select"
              className="form-input form-select min-w-[150px]"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              {categories.map((cat: string) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>Agent</th>
              <th>Version</th>
              <th>Category</th>
              <th>Tags</th>
              <th>Status</th>
              <th>Updated</th>
              <th style={{ width: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAgents.map((agent: AgentRegistryEntry) => (
              <tr key={agent.id}>
                <td>
                  {getCategoryIcon(agent.category)}
                </td>
                <td>
                  <div className="font-medium">{agent.name}</div>
                  <div className="text-xs text-fg-muted font-mono">{agent.id.slice(0, 8)}...</div>
                </td>
                <td><code>{agent.version}</code></td>
                <td>
                  <span className="badge badge-primary">{agent.category}</span>
                </td>
                <td>
                  <div className="tag-list">
                    {agent.tags.slice(0, 3).map((tag: string) => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                    {agent.tags.length > 3 && (
                      <span className="tag text-fg-muted">+{agent.tags.length - 3}</span>
                    )}
                  </div>
                </td>
                <td>{getStatusBadge(agent.enabled)}</td>
                <td className="text-sm text-fg-muted">{formatDate(agent.updatedAt)}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onSelectAgent(agent.id)}
                      title="View details"
                      aria-label={`View details for ${agent.name}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onCopyId(agent.id)}
                      title="Copy ID"
                      aria-label={`Copy ID for ${agent.name}`}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface CreateAgentViewProps {
  onCancel: () => void;
  showToast: (type: Toast['type'], message: string) => void;
}

const SAMPLE_AGENT_CONFIG = `{
  "id": "a0000000-0000-0000-0000-000000000001",
  "name": "My Custom Agent",
  "version": "1.0.0",
  "description": "A brief description of this agent",
  "category": "coding",
  "tags": ["coding", "review"],
  "persona": {
    "name": "Code Expert",
    "role": "Software Engineer",
    "description": "Expert in software engineering",
    "instructions": "You are a software engineering assistant.",
    "tone": "technical",
    "language": "en"
  },
  "model": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.7
  },
  "tools": [],
  "skills": [],
  "memory": {
    "type": "short-term",
    "maxMessages": 50
  },
  "workflows": [],
  "timeout": 300000,
  "maxTurns": 50,
  "parallelExecution": false,
  "envVars": [],
  "requiredSecrets": []
}`;

function CreateAgentView({ onCancel, showToast }: CreateAgentViewProps) {
  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(SAMPLE_AGENT_CONFIG);
    showToast('info', 'Sample configuration copied to clipboard');
  };

  return (
    <div className="card max-w-3xl">
      <div className="detail-section">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-5 h-5 text-accent" />
          <h3 className="text-lg font-semibold">Creating Agents via CLI</h3>
        </div>
        <p className="text-fg-secondary text-sm mb-4">
          The Agent Dashboard is running in read-only mode in the browser. Agent configurations are stored as JSON files and registered via the CLI.
        </p>

        <h4 className="font-medium text-sm mb-2">Step 1: Create a configuration file</h4>
        <p className="text-fg-secondary text-xs mb-2">
          Save your agent JSON under <code>agents/&lt;category&gt;/&lt;agent-slug&gt;-v&lt;version&gt;.json</code>.
        </p>
        <div className="relative mb-4">
          <pre className="bg-bg-primary border border-border rounded p-3 text-xs overflow-x-auto max-h-72 text-fg-secondary">
            <code>{SAMPLE_AGENT_CONFIG}</code>
          </pre>
          <button
            type="button"
            className="btn btn-secondary btn-sm absolute top-2 right-2"
            onClick={handleCopyTemplate}
          >
            <Copy className="w-3.5 h-3.5 mr-1" />
            Copy Template
          </button>
        </div>

        <h4 className="font-medium text-sm mb-2">Step 2: Register the agent</h4>
        <p className="text-fg-secondary text-xs mb-2">
          Run the registration command using the CLI:
        </p>
        <pre className="bg-bg-primary border border-border rounded p-3 text-xs font-mono text-fg-secondary mb-4">
          pnpm --filter @event/agent-manager agent:register --file agents/coding/my-custom-agent-v1.0.0.json
        </pre>

        <p className="text-fg-secondary text-xs mb-2">
          Or register all discovered agents in the <code>agents/</code> directory:
        </p>
        <pre className="bg-bg-primary border border-border rounded p-3 text-xs font-mono text-fg-secondary mb-4">
          pnpm --filter @event/agent-manager agent:register --all
        </pre>
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Back to Agents
        </button>
      </div>
    </div>
  );
}

function ImportRegistryView() {
  return (
    <div className="card max-w-2xl">
      <div className="detail-section">
        <div className="flex items-center gap-2 mb-3">
          <FileCode className="w-5 h-5 text-accent" />
          <h3 className="text-lg font-semibold">Registry Import & Management</h3>
        </div>
        <p className="text-fg-secondary text-sm mb-4">
          Agent registry import, registration, and file management are handled directly via CLI scripts to ensure file system safety.
        </p>

        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm mb-1">Register All Discovered Agents</h4>
            <p className="text-fg-muted text-xs mb-2">Scans the <code>agents/</code> directory and registers all valid agent JSON files into <code>registry.json</code>:</p>
            <pre className="bg-bg-primary border border-border rounded p-3 text-xs font-mono text-fg-secondary">
              pnpm --filter @event/agent-manager agent:register --all
            </pre>
          </div>

          <div>
            <h4 className="font-medium text-sm mb-1">Validate All Agent Files</h4>
            <p className="text-fg-muted text-xs mb-2">Validates all agent configurations against the schema without modifying the registry:</p>
            <pre className="bg-bg-primary border border-border rounded p-3 text-xs font-mono text-fg-secondary">
              pnpm --filter @event/agent-manager agent:validate --all
            </pre>
          </div>

          <div>
            <h4 className="font-medium text-sm mb-1">List Registered Agents via CLI</h4>
            <p className="text-fg-muted text-xs mb-2">Lists all agents registered in <code>registry.json</code>:</p>
            <pre className="bg-bg-primary border border-border rounded p-3 text-xs font-mono text-fg-secondary">
              pnpm --filter @event/agent-manager agent:list
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SettingsViewProps {
  registry: AgentRegistry | null;
}

function SettingsView({ registry }: SettingsViewProps) {
  return (
    <div className="card max-w-2xl">
      <div className="detail-section">
        <h3 className="detail-section-title">Directory Configuration</h3>
        <p className="text-fg-muted text-xs mb-4">
          The dashboard is running in static read-only mode in the browser. Values are loaded from <code>registry.json</code>.
        </p>
        <div className="form-group mb-3">
          <label className="form-label" htmlFor="settings-agents-dir">Agents Directory</label>
          <input
            id="settings-agents-dir"
            type="text"
            className="form-input"
            value="./agents"
            readOnly
            disabled
          />
        </div>
        <div className="form-group mb-3">
          <label className="form-label" htmlFor="settings-registry-file">Registry File</label>
          <input
            id="settings-registry-file"
            type="text"
            className="form-input"
            value="registry.json"
            readOnly
            disabled
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="settings-registry-version">Registry Version</label>
          <input
            id="settings-registry-version"
            type="text"
            className="form-input"
            value={registry?.version ?? '1.0.0'}
            readOnly
            disabled
          />
        </div>
      </div>

      <div className="detail-section">
        <h3 className="detail-section-title">Registry Stats</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{registry?.agents.length ?? 0}</div>
            <div className="stat-label">Total Agents</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{registry?.agents.filter((a: AgentRegistryEntry) => a.enabled).length ?? 0}</div>
            <div className="stat-label">Enabled</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{new Set(registry?.agents.map((a: AgentRegistryEntry) => a.category)).size}</div>
            <div className="stat-label">Categories</div>
          </div>
        </div>
        {registry?.lastUpdated && (
          <p className="text-fg-muted text-xs mt-3">Last updated: {formatDate(registry.lastUpdated)}</p>
        )}
      </div>
    </div>
  );
}

interface AgentDetailModalProps {
  agent: AgentConfig;
  onClose: () => void;
}

function AgentDetailModal({ agent, onClose }: AgentDetailModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <Bot className="w-8 h-8 text-accent" />
            <div>
              <h2 className="modal-title">{agent.name}</h2>
              <div className="text-sm text-fg-muted font-mono">{agent.id}</div>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close modal">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body">
          <div className="detail-grid mb-4">
            <div className="detail-item">
              <span className="detail-label">Version</span>
              <span className="detail-value"><code>{agent.version}</code></span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Category</span>
              <span className="detail-value"><span className="badge badge-primary">{agent.category}</span></span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Author</span>
              <span className="detail-value">{agent.author || 'Unknown'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Timeout</span>
              <span className="detail-value">{(agent.timeout / 1000).toFixed(0)}s</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Max Turns</span>
              <span className="detail-value">{agent.maxTurns}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Parallel Execution</span>
              <span className="detail-value">{agent.parallelExecution ? 'Yes' : 'No'}</span>
            </div>
          </div>

          {agent.description && (
            <div className="detail-section">
              <h3 className="detail-section-title">Description</h3>
              <p className="text-fg-secondary">{agent.description}</p>
            </div>
          )}

          <div className="detail-section">
            <h3 className="detail-section-title">Persona</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Name</span>
                <span className="detail-value">{agent.persona.name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Role</span>
                <span className="detail-value">{agent.persona.role}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Tone</span>
                <span className="detail-value"><span className="badge badge-neutral">{agent.persona.tone || 'friendly'}</span></span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Language</span>
                <span className="detail-value">{agent.persona.language}</span>
              </div>
            </div>
            <div className="mt-4">
              <h4 className="font-medium mb-2">Description</h4>
              <p className="text-fg-secondary">{agent.persona.description}</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Instructions</h4>
              <pre className="bg-bg-primary border border-border rounded p-3 text-sm overflow-x-auto max-h-64 text-fg-secondary whitespace-pre-wrap">{agent.persona.instructions}</pre>
            </div>
          </div>

          <div className="detail-section">
            <h3 className="detail-section-title">Model Configuration</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Provider</span>
                <span className="detail-value"><span className="badge badge-primary">{agent.model.provider}</span></span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Model</span>
                <span className="detail-value"><code>{agent.model.model}</code></span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Temperature</span>
                <span className="detail-value">{agent.model.temperature}</span>
              </div>
              {agent.model.maxTokens && (
                <div className="detail-item">
                  <span className="detail-label">Max Tokens</span>
                  <span className="detail-value">{agent.model.maxTokens.toLocaleString()}</span>
                </div>
              )}
              {agent.model.topP && (
                <div className="detail-item">
                  <span className="detail-label">Top P</span>
                  <span className="detail-value">{agent.model.topP}</span>
                </div>
              )}
            </div>
          </div>

          {agent.tools.length > 0 && (
            <div className="detail-section">
              <h3 className="detail-section-title">Tools ({agent.tools.length})</h3>
              <div className="tools-list">
                {agent.tools.map((tool: ToolConfig, i: number) => (
                  <div key={i} className="tool-card">
                    <div className="tool-header">
                      <span className="tool-name">{tool.name}</span>
                      <span className="tool-type">{tool.type}</span>
                    </div>
                    <p className="tool-desc">{tool.description}</p>
                    {tool.type === 'function' && tool.parameters && (
                      <pre className="mt-2 bg-bg-primary border border-border rounded p-2 text-xs overflow-x-auto"><code>{JSON.stringify(tool.parameters, null, 2)}</code></pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {agent.skills.length > 0 && (
            <div className="detail-section">
              <h3 className="detail-section-title">Skills ({agent.skills.length})</h3>
              <div className="skills-list">
                {agent.skills.map((skill: SkillConfig, i: number) => (
                  <div key={i} className="skill-card">
                    <div className="skill-header">
                      <span className="skill-name">{skill.name}</span>
                      {skill.version && <span className="skill-version">v{skill.version}</span>}
                    </div>
                    <p className="skill-desc">Enabled: {skill.enabled ? 'Yes' : 'No'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {agent.workflows.length > 0 && (
            <div className="detail-section">
              <h3 className="detail-section-title">Workflows ({agent.workflows.length})</h3>
              <div className="workflows-list">
                {agent.workflows.map((wf: WorkflowConfig, i: number) => (
                  <div key={i} className="workflow-card">
                    <div className="skill-header">
                      <span className="skill-name">{wf.name}</span>
                      <span className="skill-version">{wf.trigger}</span>
                    </div>
                    <p className="skill-desc">{wf.description}</p>
                    <div className="workflow-steps">
                      {wf.steps.map((step: WorkflowStep, si: number) => (
                        <div key={si} className="workflow-step">
                          <div className="workflow-step-name">{step.name}</div>
                          <div className="workflow-step-agent">Agent: {step.agent}</div>
                          {step.condition && <div className="workflow-step-agent text-warning">Condition: {step.condition}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {agent.requiredSecrets.length > 0 && (
            <div className="detail-section">
              <h3 className="detail-section-title">Required Secrets</h3>
              <div className="tag-list">
                {agent.requiredSecrets.map((secret: string) => (
                  <span key={secret} className="tag badge-warning">{secret}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'import' | 'settings'>('list');
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const toastIdRef = useRef(0);

  const showToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const handleDismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const agents = useMemo(() => staticData.registry?.agents ?? [], []);

  const filteredAgents = useMemo(() => {
    const categoryFiltered = filterAgents(agents, {
      category: filterCategory === 'all' ? undefined : filterCategory,
    });
    if (!searchQuery.trim()) return categoryFiltered;
    const q = searchQuery.toLowerCase();
    return categoryFiltered.filter(agent =>
      agent.name.toLowerCase().includes(q) ||
      agent.id.toLowerCase().includes(q) ||
      agent.tags.some(tag => tag.toLowerCase().includes(q))
    );
  }, [agents, filterCategory, searchQuery]);

  const categories = useMemo(() => ['all', ...new Set(agents.map(a => a.category))], [agents]);

  const handleSelectAgent = useCallback((agentId: string) => {
    const agentEntry = agents.find(a => a.id === agentId);
    const config = staticData.configsById.get(agentId) ?? (agentEntry ? staticData.configsByPath.get(agentEntry.configPath) : undefined);
    if (config) {
      setSelectedAgent(config);
      setShowDetail(true);
    } else {
      showToast('error', `Agent configuration not found for "${agentEntry?.name ?? agentId}"`);
    }
  }, [agents, showToast]);

  const handleCopyAgentId = useCallback((agentId: string) => {
    navigator.clipboard.writeText(agentId);
    showToast('info', 'Agent ID copied to clipboard');
  }, [showToast]);

  const handleValidateAll = useCallback(() => {
    const { configsById, configErrors, registry, registryError } = staticData;
    const valid = configsById.size + (registry ? 1 : 0);
    const invalid = configErrors.length + (registryError ? 1 : 0);

    if (invalid > 0) {
      showToast('error', `Validation complete: ${valid} valid, ${invalid} invalid`);
    } else {
      showToast('success', `Validation complete: ${valid} valid configurations, 0 invalid`);
    }
  }, [showToast]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-bg-secondary/50 backdrop-blur sticky top-0 z-50">
        <div className="container">
          <nav className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Bot className="w-8 h-8 text-accent" />
              <h1 className="text-xl font-bold">Agent Dashboard</h1>
              <span className="badge badge-neutral text-xs">Read-Only</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                className={`tab ${activeTab === 'list' ? 'active' : ''}`}
                onClick={() => setActiveTab('list')}
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Agents
              </button>
              <button
                type="button"
                className={`tab ${activeTab === 'create' ? 'active' : ''}`}
                onClick={() => setActiveTab('create')}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create
              </button>
              <button
                type="button"
                className={`tab ${activeTab === 'import' ? 'active' : ''}`}
                onClick={() => setActiveTab('import')}
              >
                <FileCode className="w-4 h-4 mr-2" />
                Import
              </button>
              <button
                type="button"
                className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main className="container">
        {staticData.registryError && (
          <div className="card mb-4" style={{ borderColor: 'var(--danger)' }}>
            <div className="flex items-center gap-2" style={{ color: 'var(--danger)' }}>
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <div className="font-semibold">Registry Load Error</div>
                <div className="text-sm">{staticData.registryError}</div>
              </div>
            </div>
          </div>
        )}

        <div className="page-header">
          <div>
            <h2 className="page-title">
              {activeTab === 'list' ? 'Agents' : activeTab === 'create' ? 'Create Agent' : activeTab === 'import' ? 'Import Registry' : 'Settings'}
            </h2>
            <p className="text-fg-muted text-sm mt-1">
              {activeTab === 'list' && `Viewing ${agents.filter(a => a.enabled).length} enabled of ${agents.length} registered agents`}
              {activeTab === 'create' && 'Instructions for defining and registering new AI agents'}
              {activeTab === 'import' && 'Synchronize and validate agents using the CLI'}
              {activeTab === 'settings' && 'View agent directory configuration and stats'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'list' && (
              <button type="button" className="btn btn-secondary" onClick={handleValidateAll}>
                <CheckCircle className="w-4 h-4" />
                Validate All
              </button>
            )}
          </div>
        </div>

        {activeTab === 'list' && (
          <AgentListView
            filteredAgents={filteredAgents}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}
            categories={categories}
            onSelectAgent={handleSelectAgent}
            onCopyId={handleCopyAgentId}
            onGoToCreate={() => setActiveTab('create')}
          />
        )}
        {activeTab === 'create' && (
          <CreateAgentView
            onCancel={() => setActiveTab('list')}
            showToast={showToast}
          />
        )}
        {activeTab === 'import' && (
          <ImportRegistryView />
        )}
        {activeTab === 'settings' && (
          <SettingsView
            registry={staticData.registry}
          />
        )}

        {showDetail && selectedAgent && (
          <AgentDetailModal
            agent={selectedAgent}
            onClose={() => {
              setShowDetail(false);
              setSelectedAgent(null);
            }}
          />
        )}

        <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
      </main>
    </div>
  );
}

export default App;
