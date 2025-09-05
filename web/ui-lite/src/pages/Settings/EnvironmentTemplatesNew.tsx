import { useState, useEffect } from 'preact/hooks';
import { Breadcrumb } from "../../components/Breadcrumb";
import { usePageTitle } from "../../hooks/usePageTitle";
import { apiClient as api } from "../../api";
import { Home, Plus, Package, Settings, Copy, Trash2, Edit3, Database, Layers } from "lucide-preact";

interface Template {
  id: string;
  name: string;
  description: string;
  variables: { [key: string]: string };
  created_at: string;
  updated_at?: string;
}

export function EnvironmentTemplatesNew() {
  usePageTitle("Environment Templates");
  
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateData, setTemplateData] = useState({
    name: '',
    description: '',
    variables: {} as { [key: string]: string }
  });
  const [newVariableKey, setNewVariableKey] = useState('');
  const [newVariableValue, setNewVariableValue] = useState('');

  // Mock data for demonstration since backend API is commented out
  const mockTemplates: Template[] = [
    {
      id: 'spring-boot',
      name: 'Spring Boot Application',
      description: 'Standard configuration for Spring Boot applications with database connection',
      variables: {
        'SPRING_PROFILES_ACTIVE': 'production',
        'DATABASE_URL': 'jdbc:postgresql://localhost:5432/myapp',
        'DATABASE_USERNAME': 'app_user',
        'DATABASE_PASSWORD': '${DB_PASSWORD}',
        'LOGGING_LEVEL_ROOT': 'INFO',
        'SERVER_PORT': '8080'
      },
      created_at: '2025-01-01T10:00:00Z'
    },
    {
      id: 'nodejs-api',
      name: 'Node.js API Server',
      description: 'Environment configuration for Node.js REST API applications',
      variables: {
        'NODE_ENV': 'production',
        'PORT': '3000',
        'DATABASE_URL': 'mongodb://localhost:27017/myapp',
        'JWT_SECRET': '${JWT_SECRET}',
        'CORS_ORIGIN': 'https://myapp.example.com',
        'LOG_LEVEL': 'info'
      },
      created_at: '2025-01-02T14:30:00Z'
    },
    {
      id: 'react-app',
      name: 'React Frontend',
      description: 'Configuration for React applications with API integration',
      variables: {
        'REACT_APP_API_URL': 'https://api.example.com',
        'REACT_APP_AUTH_DOMAIN': 'auth.example.com',
        'REACT_APP_ENVIRONMENT': 'production',
        'PUBLIC_URL': 'https://app.example.com',
        'GENERATE_SOURCEMAP': 'false'
      },
      created_at: '2025-01-03T09:15:00Z'
    }
  ];

  useEffect(() => {
    // Since the backend API for environment templates is commented out,
    // we'll use mock data for now
    setTemplates(mockTemplates);
  }, []);

  const resetForm = () => {
    setTemplateData({ name: '', description: '', variables: {} });
    setNewVariableKey('');
    setNewVariableValue('');
    setEditingTemplate(null);
    setShowCreateForm(false);
    setError('');
  };

  const handleCreateTemplate = () => {
    if (!templateData.name.trim()) {
      setError('Template name is required');
      return;
    }

    const newTemplate: Template = {
      id: `custom-${Date.now()}`,
      name: templateData.name,
      description: templateData.description,
      variables: { ...templateData.variables },
      created_at: new Date().toISOString()
    };

    setTemplates([...templates, newTemplate]);
    resetForm();
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setTemplateData({
      name: template.name,
      description: template.description,
      variables: { ...template.variables }
    });
    setShowCreateForm(true);
  };

  const handleUpdateTemplate = () => {
    if (!editingTemplate || !templateData.name.trim()) {
      setError('Template name is required');
      return;
    }

    const updatedTemplates = templates.map(t => 
      t.id === editingTemplate.id 
        ? {
            ...t,
            name: templateData.name,
            description: templateData.description,
            variables: { ...templateData.variables },
            updated_at: new Date().toISOString()
          }
        : t
    );

    setTemplates(updatedTemplates);
    resetForm();
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
      return;
    }

    setTemplates(templates.filter(t => t.id !== templateId));
  };

  const handleAddVariable = () => {
    if (!newVariableKey.trim() || newVariableKey in templateData.variables) {
      setError('Variable key is required and must be unique');
      return;
    }

    setTemplateData({
      ...templateData,
      variables: {
        ...templateData.variables,
        [newVariableKey]: newVariableValue
      }
    });
    setNewVariableKey('');
    setNewVariableValue('');
    setError('');
  };

  const handleRemoveVariable = (key: string) => {
    const { [key]: removed, ...rest } = templateData.variables;
    setTemplateData({ ...templateData, variables: rest });
  };

  const handleCopyTemplate = (template: Template) => {
    const configText = Object.entries(template.variables)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    navigator.clipboard.writeText(configText).then(() => {
      // Simple notification - in a real app this would use a toast system
      alert('Template configuration copied to clipboard!');
    });
  };

  return (
    <div class="min-h-screen">
      <div class="relative z-10 p-3 sm:p-6 max-w-7xl mx-auto space-y-6 fade-in">
        {/* Breadcrumb */}
        <Breadcrumb 
          items={[
            { icon: Home, label: "Home", href: "/" },
            { label: "Settings", href: "/settings" },
            { label: "Environment Templates", href: "/settings/environment-templates" }
          ]} 
        />

        {/* Header */}
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold mb-3">
              <span class="bg-gradient-to-r from-[#9c40ff] via-[#e94057] to-[#8b008b] bg-clip-text text-transparent">
                Environment Templates
              </span>
            </h1>
            <p class="text-gray-600 dark:text-gray-300 text-sm mt-1">
              Configure and manage environment templates for deployments
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#9c40ff] to-[#8b008b] text-white rounded-lg hover:from-[#8a39e6] hover:to-[#7a0078] transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Plus class="w-4 h-4 mr-2" />
            Create Template
          </button>
        </div>

        {error && (
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg p-4">
            <p class="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* API Notice */}
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <Database class="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 class="font-medium text-blue-900 dark:text-blue-100">Demo Mode</h3>
          </div>
          <p class="text-blue-800 dark:text-blue-200 text-sm">
            Environment Templates API is currently in development. This interface shows the planned functionality with sample data.
          </p>
        </div>

        {/* Create/Edit Template Form */}
        {showCreateForm && (
          <div class="bg-white dark:bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </h2>
            
            <div class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={templateData.name}
                    onInput={(e) => setTemplateData({ ...templateData, name: (e.target as HTMLInputElement).value })}
                    placeholder="e.g., Spring Boot Application"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={templateData.description}
                    onInput={(e) => setTemplateData({ ...templateData, description: (e.target as HTMLInputElement).value })}
                    placeholder="Brief description of the template"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Environment Variables */}
              <div>
                <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Environment Variables</h3>
                
                {/* Add Variable Form */}
                <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                  <input
                    type="text"
                    value={newVariableKey}
                    onInput={(e) => setNewVariableKey((e.target as HTMLInputElement).value)}
                    placeholder="Variable name (e.g., DATABASE_URL)"
                    class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={newVariableValue}
                    onInput={(e) => setNewVariableValue((e.target as HTMLInputElement).value)}
                    placeholder="Default value"
                    class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleAddVariable}
                    class="inline-flex items-center justify-center px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <Plus class="w-4 h-4" />
                  </button>
                </div>

                {/* Variables List */}
                <div class="space-y-2 max-h-60 overflow-y-auto">
                  {Object.entries(templateData.variables).map(([key, value]) => (
                    <div key={key} class="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <span class="font-mono text-sm text-blue-600 dark:text-blue-400 flex-shrink-0">{key}</span>
                      <span class="text-gray-500 flex-shrink-0">=</span>
                      <span class="font-mono text-sm text-gray-900 dark:text-white truncate flex-1">{value}</span>
                      <button
                        onClick={() => handleRemoveVariable(key)}
                        class="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors flex-shrink-0"
                      >
                        <Trash2 class="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {Object.keys(templateData.variables).length === 0 && (
                    <p class="text-gray-500 dark:text-gray-400 text-sm italic py-4 text-center">
                      No environment variables defined
                    </p>
                  )}
                </div>
              </div>

              <div class="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                  class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200"
                >
                  <Package class="w-4 h-4 mr-2" />
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
                <button
                  onClick={resetForm}
                  class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Templates List */}
        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div key={template.id} class="bg-white dark:bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-6">
              <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-gradient-to-br from-[#9c40ff]/20 to-[#8b008b]/20 rounded-lg flex items-center justify-center">
                    <Layers class="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 class="font-medium text-gray-900 dark:text-white">{template.name}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400">{template.description}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyTemplate(template)}
                    class="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Copy configuration"
                  >
                    <Copy class="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEditTemplate(template)}
                    class="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    title="Edit template"
                  >
                    <Edit3 class="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    class="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete template"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-500 dark:text-gray-400">Variables</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    {Object.keys(template.variables).length}
                  </span>
                </div>
                
                <div class="max-h-32 overflow-y-auto space-y-1">
                  {Object.entries(template.variables).slice(0, 5).map(([key, value]) => (
                    <div key={key} class="flex items-center gap-2 text-xs">
                      <span class="font-mono text-blue-600 dark:text-blue-400 truncate max-w-20">{key}</span>
                      <span class="text-gray-400">=</span>
                      <span class="font-mono text-gray-600 dark:text-gray-300 truncate flex-1">{value}</span>
                    </div>
                  ))}
                  {Object.keys(template.variables).length > 5 && (
                    <p class="text-xs text-gray-500 dark:text-gray-400 italic">
                      +{Object.keys(template.variables).length - 5} more variables
                    </p>
                  )}
                </div>

                <div class="pt-3 border-t border-gray-200 dark:border-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
                  Created: {new Date(template.created_at).toLocaleDateString()}
                  {template.updated_at && (
                    <span> • Updated: {new Date(template.updated_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {templates.length === 0 && !loading && (
          <div class="text-center py-12">
            <Package class="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Environment Templates
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              Create your first environment template to streamline deployments
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#9c40ff] to-[#8b008b] text-white rounded-lg hover:from-[#8a39e6] hover:to-[#7a0078] transition-all duration-200"
            >
              <Plus class="w-4 h-4 mr-2" />
              Create First Template
            </button>
          </div>
        )}
      </div>
    </div>
  );
}