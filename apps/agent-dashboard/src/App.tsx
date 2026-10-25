import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  LayoutDashboard,
  Bot,
  Settings,
  Plus,
  Search,
  Download,
  Upload,
  Trash2,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Copy,
  Zap,
  Brain,
  GitBranch,
  Play,
  Pause,
  Terminal,
  Loader2,
} from 'lucide-react';
import {
  createAgentRegistryManager,
  AgentConfig,
  AgentRegistryEntry,
  AgentRegistry,
} from '@event/agent-manager';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'import' | 'settings'>('list');
  const [agents, setAgents] = useState<AgentRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [registry, setRegistry] = useState<AgentRegistry | null>(null);

  const manager = createAgentRegistryManager(resolve(__dirname, '../../..'), {
    agentsDir: './agents',
    registryFile: 'registry.json',
  });

  const showToast = (type: Toast['type'], message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  const loadAgents = async () => {
    setLoading(true);
    try {
      const entries = manager.listAgents({ enabledOnly: false });
      setAgents(entries);
      setRegistry(manager.getRegistry());
    } catch (error) {
      showToast('error', `Failed to load agents: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAgentConfig = async (agentId: string) => {
    try {
      const config = await manager.loadAgent(agentId);
      setSelectedAgent(config);
      setShowDetail(true);
    } catch (error) {
      showToast('error', `Failed to load agent config: ${error}`);
    }
  };

  const handleRegisterAll = async () => {
    try {
      const entries = await manager.registerAllDiscovered();
      showToast('success', `Registered ${entries.length} agent(s)`);
      loadAgents();
    } catch (error) {
      showToast('error', `Failed to register agents: ${error}`);
    }
  };

  const handleValidateAll = async () => {
    try {
      const agentsList = manager.listAgents({ enabledOnly: false });
      let valid = 0;
      let invalid = 0;
      for (const entry of agentsList) {
        const config = await manager.loadAgent(entry.id);
        if (config) valid++;
        else invalid++;
      }
      showToast('success', `Validation complete: ${valid} valid, ${invalid} invalid`);
    } catch (error) {
      showToast('error', `Validation failed: ${error}`);
    }
  };

  const handleExportRegistry = async () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `agent-registry-${timestamp}.json`;
      await manager.exportRegistry(resolve(__dirname, '../../..', filename));
      showToast('success', `Registry exported to ${filename}`);
    } catch (error) {
      showToast('error', `Export failed: ${error}`);
    }
  };

  const handleEnableAgent = async (agentId: string, enable: boolean) => {
    try {
      if (manager.setAgentEnabled(agentId, enable)) {
        showToast('success', `Agent ${enable ? 'enabled' : 'disabled'}`);
        loadAgents();
      } else {
        showToast('error', 'Agent not found');
      }
    } catch (error) {
      showToast('error', `Failed to update agent: ${error}`);
    }
  };

  const handleUnregisterAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to unregister this agent?')) return;
    try {
      if (manager.unregisterAgent(agentId)) {
        showToast('success', 'Agent unregistered');
        loadAgents();
      } else {
        showToast('error', 'Agent not found');
      }
    } catch (error) {
      showToast('error', `Failed to unregister agent: ${error}`);
    }
  };

  const handleCopyAgentId = (agentId: string) => {
    navigator.clipboard.writeText(agentId);
    showToast('info', 'Agent ID copied to clipboard');
  };

  const filteredAgents = agents.filter(agent => {
    const matchesCategory = filterCategory === 'all' || agent.category === filterCategory;
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const categories = ['all', ...new Set(agents.map(a => a.category))];

  useEffect(() => {
    loadAgents();
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'coding': return <Terminal className="w-4 h-4" />;
      case 'analysis': return <Brain className="w-4 h-4" />;
      case 'workflow': return <GitBranch className="w-4 h-4" />;
      case 'creative': return <Zap className="w-4 h-4" />;
      case 'research': return <Search className="w-4 h-4" />;
      default: return <Bot className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (enabled: boolean) => (
    <span className={`badge ${enabled ? 'badge-success' : 'badge-danger'}`}>
      {enabled ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  );

  // Sub-components defined inside App to access setActiveTab and other state
  function AgentListView() {
    if (loading) {
      return (
        <div className="card">
          <div className="loading">
            <div className="spinner" />
            Loading agents...
          </div>
        </div>
      );
    }

    if (filteredAgents.length === 0) {
      return (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <Bot className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="empty-state-title">No agents found</h3>
            <p className="empty-state-desc">Create your first agent or register existing configurations</p>
            <button className="btn btn-primary" onClick={() => setActiveTab('create')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Agent
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="card">
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[250px]">
            <label className="form-label">Search agents</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
              <input
                type="text"
                className="form-input pl-10"
                placeholder="Search by name, ID, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <label className="form-label">Category</label>
            <select
              className="form-input form-select min-w-[150px]"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              {categories.map((cat: string) => (
                <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
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
                <th style={{ width: '120px' }}>Actions</th>
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
                        onClick={() => loadAgentConfig(agent.id)}
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleEnableAgent(agent.id, !agent.enabled)}
                        title={agent.enabled ? 'Disable' : 'Enable'}
                      >
                        {agent.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleCopyAgentId(agent.id)}
                        title="Copy ID"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm text-danger"
                        onClick={() => handleUnregisterAgent(agent.id)}
                        title="Unregister"
                      >
                        <Trash2 className="w-4 h-4" />
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

  function CreateAgentView() {
    const [formData, setFormData] = useState({
      name: '',
      version: '1.0.0',
      description: '',
      author: '',
      category: 'general',
      tags: '',
      persona: {
        name: '',
        role: '',
        description: '',
        instructions: '',
        tone: 'friendly',
        language: 'en',
      },
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
      },
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        const mgr = createAgentRegistryManager(resolve(__dirname, '../../..'));
        const config: AgentConfig = {
          ...formData,
          tags: formData.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
          id: crypto.randomUUID(),
          category: formData.category as AgentConfig['category'],
          persona: {
            ...formData.persona,
            tone: formData.persona.tone as AgentConfig['persona']['tone'],
          },
          model: {
            ...formData.model,
            provider: formData.model.provider as AgentConfig['model']['provider'],
          },
          memory: { type: 'short-term', maxMessages: 50 },
          tools: [],
          skills: [],
          workflows: [],
          timeout: 300000,
          maxTurns: 50,
          parallelExecution: false,
          envVars: [],
          requiredSecrets: [],
        };
        await mgr.createAgentConfig(config);
        showToast('success', `Agent "${formData.name}" created successfully`);
        loadAgents();
        setFormData({
          name: '',
          version: '1.0.0',
          description: '',
          author: '',
          category: 'general',
          tags: '',
          persona: {
            name: '',
            role: '',
            description: '',
            instructions: '',
            tone: 'friendly',
            language: 'en',
          },
          model: {
            provider: 'openai',
            model: 'gpt-4o',
            temperature: 0.7,
          },
        });
      } catch (error) {
        showToast('error', `Failed to create agent: ${error}`);
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="card max-w-3xl">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="My Custom Agent"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Version *</label>
              <input
                type="text"
                className="form-input"
                placeholder="1.0.0"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group mb-4">
            <label className="form-label">Description</label>
            <textarea
              className="form-input form-textarea"
              placeholder="A brief description of this agent..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-input form-select"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="general">General</option>
                <option value="coding">Coding</option>
                <option value="analysis">Analysis</option>
                <option value="creative">Creative</option>
                <option value="research">Research</option>
                <option value="workflow">Workflow</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Author</label>
              <input
                type="text"
                className="form-input"
                placeholder="Your Name"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group mb-4">
            <label className="form-label">Tags (comma-separated)</label>
            <input
              type="text"
              className="form-input"
              placeholder="tag1, tag2, tag3"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            />
          </div>

          <div className="border-t border-border pt-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Persona</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="form-group">
                <label className="form-label">Persona Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.persona.name}
                  onChange={(e) => setFormData({ ...formData, persona: { ...formData.persona, name: e.target.value } })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.persona.role}
                  onChange={(e) => setFormData({ ...formData, persona: { ...formData.persona, role: e.target.value } })}
                  required
                />
              </div>
            </div>
            <div className="form-group mb-4">
              <label className="form-label">Description *</label>
              <textarea
                className="form-input form-textarea"
                value={formData.persona.description}
                onChange={(e) => setFormData({ ...formData, persona: { ...formData.persona, description: e.target.value } })}
                required
              />
            </div>
            <div className="form-group mb-4">
              <label className="form-label">Instructions *</label>
              <textarea
                className="form-input form-textarea"
                placeholder="System instructions for the agent..."
                value={formData.persona.instructions}
                onChange={(e) => setFormData({ ...formData, persona: { ...formData.persona, instructions: e.target.value } })}
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Tone</label>
                <select
                  className="form-input form-select"
                  value={formData.persona.tone}
                  onChange={(e) => setFormData({ ...formData, persona: { ...formData.persona, tone: e.target.value } })}
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="technical">Technical</option>
                  <option value="friendly">Friendly</option>
                  <option value="authoritative">Authoritative</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Language</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.persona.language}
                  onChange={(e) => setFormData({ ...formData, persona: { ...formData.persona, language: e.target.value } })}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Model Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="form-group">
                <label className="form-label">Provider *</label>
                <select
                  className="form-input form-select"
                  value={formData.model.provider}
                  onChange={(e) => setFormData({ ...formData, model: { ...formData.model, provider: e.target.value } })}
                  required
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="mistral">Mistral</option>
                  <option value="cohere">Cohere</option>
                  <option value="local">Local</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Model *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.model.model}
                  onChange={(e) => setFormData({ ...formData, model: { ...formData.model, model: e.target.value } })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Temperature</label>
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  max="2"
                  step="0.1"
                  value={formData.model.temperature}
                  onChange={(e) => setFormData({ ...formData, model: { ...formData.model, temperature: parseFloat(e.target.value) } })}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('list')}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <Loader2 className="w-4 h-4 animate-spin mr-2" style={{ display: submitting ? 'block' : 'none' }} />
              {submitting ? 'Creating...' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  function ImportRegistryView() {
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);

    const handleImport = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!file) return;
      setImporting(true);
      try {
        const mgr = createAgentRegistryManager(resolve(__dirname, '../../..'));
        const text = await file.text();
        const data = JSON.parse(text);
        const fs = await import('fs');
        const tempPath = resolve(__dirname, '../../..', `temp-import-${Date.now()}.json`);
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
        const count = await mgr.importRegistry(tempPath);
        fs.unlinkSync(tempPath);
        showToast('success', `Imported ${count} agent(s)`);
        loadAgents();
        setFile(null);
      } catch (error) {
        showToast('error', `Import failed: ${error}`);
      } finally {
        setImporting(false);
      }
    };

    return (
      <div className="card max-w-2xl">
        <form onSubmit={handleImport}>
          <div className="form-group">
            <label className="form-label">Registry Backup File</label>
            <input
              type="file"
              className="form-input"
              accept=".json"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
            <p className="text-sm text-fg-muted mt-1">Select a JSON file exported from the agent registry</p>
          </div>
          <div className="flex justify-end gap-3">
            <button type="submit" className="btn btn-primary" disabled={importing || !file}>
              <Loader2 className="w-4 h-4 animate-spin mr-2" style={{ display: importing ? 'block' : 'none' }} />
              {importing ? 'Importing...' : 'Import Registry'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  function SettingsView() {
    const [config, setConfig] = useState({
      agentsDir: './agents',
      registryFile: 'registry.json',
      autoDiscover: true,
      validateOnLoad: true,
    });

    const handleSave = async () => {
      try {
        showToast('success', 'Settings saved (config file update not implemented in demo)');
      } catch (error) {
        showToast('error', `Failed to save settings: ${error}`);
      }
    };

    return (
      <div className="card max-w-2xl">
        <div className="detail-section">
          <h3 className="detail-section-title">Directory Configuration</h3>
          <div className="form-group">
            <label className="form-label">Agents Directory</label>
            <input
              type="text"
              className="form-input"
              value={config.agentsDir}
              onChange={(e) => setConfig({ ...config, agentsDir: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Registry File</label>
            <input
              type="text"
              className="form-input"
              value={config.registryFile}
              onChange={(e) => setConfig({ ...config, registryFile: e.target.value })}
            />
          </div>
          <div className="form-check">
            <input
              type="checkbox"
              className="form-check-input"
              checked={config.autoDiscover}
              onChange={(e) => setConfig({ ...config, autoDiscover: e.target.checked })}
            />
            <label className="form-check-label">Auto-discover agents on startup</label>
          </div>
          <div className="form-check">
            <input
              type="checkbox"
              className="form-check-input"
              checked={config.validateOnLoad}
              onChange={(e) => setConfig({ ...config, validateOnLoad: e.target.checked })}
            />
            <label className="form-check-label">Validate configurations on load</label>
          </div>
        </div>

        <div className="detail-section">
          <h3 className="detail-section-title">Registry Stats</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{registry?.agents.length || 0}</div>
              <div className="stat-label">Total Agents</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{registry?.agents.filter((a: AgentRegistryEntry) => a.enabled).length || 0}</div>
              <div className="stat-label">Enabled</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{new Set(registry?.agents.map((a: AgentRegistryEntry) => a.category)).size || 0}</div>
              <div className="stat-label">Categories</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button className="btn btn-primary" onClick={handleSave}>
            <Settings className="w-4 h-4 mr-2" />
            Save Settings
          </button>
        </div>
      </div>
    );
  }

  function AgentDetailModal() {
    if (!selectedAgent) return null;

    return (
      <div className="modal-overlay" onClick={() => { setShowDetail(false); setSelectedAgent(null); }}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="flex items-center gap-3">
              <Bot className="w-8 h-8 text-accent" />
              <div>
                <h2 className="modal-title">{selectedAgent.name}</h2>
                <div className="text-sm text-fg-muted font-mono">{selectedAgent.id}</div>
              </div>
            </div>
            <button className="btn btn-ghost" onClick={() => { setShowDetail(false); setSelectedAgent(null); }}>
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <div className="modal-body">
            <div className="detail-grid mb-4">
              <div className="detail-item">
                <span className="detail-label">Version</span>
                <span className="detail-value"><code>{selectedAgent.version}</code></span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Category</span>
                <span className="detail-value"><span className="badge badge-primary">{selectedAgent.category}</span></span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Author</span>
                <span className="detail-value">{selectedAgent.author || 'Unknown'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Timeout</span>
                <span className="detail-value">{(selectedAgent.timeout / 1000).toFixed(0)}s</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Max Turns</span>
                <span className="detail-value">{selectedAgent.maxTurns}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Parallel Execution</span>
                <span className="detail-value">{selectedAgent.parallelExecution ? 'Yes' : 'No'}</span>
              </div>
            </div>

            {selectedAgent.description && (
              <div className="detail-section">
                <h3 className="detail-section-title">Description</h3>
                <p className="text-fg-secondary">{selectedAgent.description}</p>
              </div>
            )}

            <div className="detail-section">
              <h3 className="detail-section-title">Persona</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Name</span>
                  <span className="detail-value">{selectedAgent.persona.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Role</span>
                  <span className="detail-value">{selectedAgent.persona.role}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Tone</span>
                  <span className="detail-value"><span className="badge badge-neutral">{selectedAgent.persona.tone || 'friendly'}</span></span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Language</span>
                  <span className="detail-value">{selectedAgent.persona.language}</span>
                </div>
              </div>
              <div className="mt-4">
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-fg-secondary">{selectedAgent.persona.description}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Instructions</h4>
                <pre className="bg-bg-primary border border-border rounded p-3 text-sm overflow-x-auto max-h-64 text-fg-secondary whitespace-pre-wrap">{selectedAgent.persona.instructions}</pre>
              </div>
            </div>

            <div className="detail-section">
              <h3 className="detail-section-title">Model Configuration</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Provider</span>
                  <span className="detail-value"><span className="badge badge-primary">{selectedAgent.model.provider}</span></span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Model</span>
                  <span className="detail-value"><code>{selectedAgent.model.model}</code></span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Temperature</span>
                  <span className="detail-value">{selectedAgent.model.temperature}</span>
                </div>
                {selectedAgent.model.maxTokens && (
                  <div className="detail-item">
                    <span className="detail-label">Max Tokens</span>
                    <span className="detail-value">{selectedAgent.model.maxTokens.toLocaleString()}</span>
                  </div>
                )}
                {selectedAgent.model.topP && (
                  <div className="detail-item">
                    <span className="detail-label">Top P</span>
                    <span className="detail-value">{selectedAgent.model.topP}</span>
                  </div>
                )}
              </div>
            </div>

            {selectedAgent.tools.length > 0 && (
              <div className="detail-section">
                <h3 className="detail-section-title">Tools ({selectedAgent.tools.length})</h3>
                <div className="tools-list">
                  {selectedAgent.tools.map((tool: any, i: number) => (
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

            {selectedAgent.skills.length > 0 && (
              <div className="detail-section">
                <h3 className="detail-section-title">Skills ({selectedAgent.skills.length})</h3>
                <div className="skills-list">
                  {selectedAgent.skills.map((skill: any, i: number) => (
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

            {selectedAgent.workflows.length > 0 && (
              <div className="detail-section">
                <h3 className="detail-section-title">Workflows ({selectedAgent.workflows.length})</h3>
                <div className="workflows-list">
                  {selectedAgent.workflows.map((wf: any, i: number) => (
                    <div key={i} className="workflow-card">
                      <div className="skill-header">
                        <span className="skill-name">{wf.name}</span>
                        <span className="skill-version">{wf.trigger}</span>
                      </div>
                      <p className="skill-desc">{wf.description}</p>
                      <div className="workflow-steps">
                        {wf.steps.map((step: any, si: number) => (
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

            {selectedAgent.requiredSecrets.length > 0 && (
              <div className="detail-section">
                <h3 className="detail-section-title">Required Secrets</h3>
                <div className="tag-list">
                  {selectedAgent.requiredSecrets.map((secret: string) => (
                    <span key={secret} className="tag badge-warning">{secret}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => { setShowDetail(false); setSelectedAgent(null); }}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  function ToastContainer() {
    if (toasts.length === 0) return null;
    return (
      <div className="toast-container">
        {toasts.map((toast: Toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}>
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-bg-secondary/50 backdrop-blur sticky top-0 z-50">
        <div className="container">
          <nav className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Bot className="w-8 h-8 text-accent" />
              <h1 className="text-xl font-bold">Agent Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/" className={`tab ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Agents
              </Link>
              <Link to="/create" className={`tab ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>
                <Plus className="w-4 h-4 mr-2" />
                Create
              </Link>
              <Link to="/import" className={`tab ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}>
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Link>
              <Link to="/settings" className={`tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <main className="container">
        <div className="page-header">
          <div>
            <h2 className="page-title">
              {activeTab === 'list' ? 'Agents' : activeTab === 'create' ? 'Create Agent' : activeTab === 'import' ? 'Import Registry' : 'Settings'}
            </h2>
            <p className="text-fg-muted text-sm mt-1">
              {activeTab === 'list' && `Managing ${agents.filter(a => a.enabled).length} of ${agents.length} agents`}
              {activeTab === 'create' && 'Define a new AI agent configuration'}
              {activeTab === 'import' && 'Import agent registry from backup file'}
              {activeTab === 'settings' && 'Configure agent directory settings'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'list' && (
              <>
                <button className="btn btn-secondary" onClick={handleValidateAll}>
                  <CheckCircle className="w-4 h-4" />
                  Validate All
                </button>
                <button className="btn btn-secondary" onClick={handleExportRegistry}>
                  <Download className="w-4 h-4" />
                  Export Registry
                </button>
                <button className="btn btn-primary" onClick={handleRegisterAll}>
                  <RefreshCw className="w-4 h-4" />
                  Register All
                </button>
              </>
            )}
          </div>
        </div>

        {activeTab === 'list' && <AgentListView />}
        {activeTab === 'create' && <CreateAgentView />}
        {activeTab === 'import' && <ImportRegistryView />}
        {activeTab === 'settings' && <SettingsView />}

        {showDetail && <AgentDetailModal />}

        <ToastContainer />
      </main>
    </div>
  );
}

export default App;