import { ServiceConfig } from "../../../api";
import { PortsEditor } from "../../../components/PortsEditor";
import { ImpactBadge } from "../../../components/ImpactBadge";
import { IMPACT_TYPES } from "../../../utils/changeImpact";
import { ExternalLink, Info, AlertTriangle, Zap } from "lucide-preact";

interface PortsTabProps {
  config: ServiceConfig;
  canDeploy: boolean;
  updateConfig: (field: keyof ServiceConfig, value: any) => void;
}

export function PortsTab({
  config,
  canDeploy,
  updateConfig,
}: PortsTabProps) {
  const hasPortMappings = config.ports && config.ports.length > 0;
  const containerRestartImpact = IMPACT_TYPES.container_restart;
  
  // Generate access examples
  const generateAccessExamples = () => {
    if (!hasPortMappings) return [];
    
    return config.ports.slice(0, 3).map(port => {
      const isHTTP = [80, 8080, 3000, 8000, 5000].includes(port.host);
      const isHTTPS = [443, 8443].includes(port.host);
      const isDatabase = [5432, 3306, 27017].includes(port.host);
      
      let protocol = 'TCP';
      let example = `localhost:${port.host}`;
      let description = 'Generic TCP connection';
      
      if (isHTTP) {
        protocol = 'HTTP';
        example = `http://localhost:${port.host}`;
        description = 'Web application';
      } else if (isHTTPS) {
        protocol = 'HTTPS';
        example = `https://localhost:${port.host}`;
        description = 'Secure web application';
      } else if (isDatabase) {
        protocol = 'DB';
        example = `localhost:${port.host}`;
        description = 'Database connection';
      }
      
      return { ...port, protocol, example, description };
    });
  };
  
  const accessExamples = generateAccessExamples();

  return (
    <div class="space-y-6">
      {/* Header with Impact Warning */}
      <div class="bg-gradient-to-r from-orange-50/90 via-yellow-50/80 to-red-50/90 dark:from-orange-900/20 dark:via-yellow-900/20 dark:to-red-900/20 rounded-xl p-5 border border-orange-200/50 dark:border-orange-700/50">
        <div class="flex items-start justify-between">
          <div class="flex items-start space-x-3">
            <div class="flex-shrink-0">
              <AlertTriangle class="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Port Configuration
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Port changes require a container restart and will cause brief downtime. 
                Configure external access to your containerized services.
              </p>
              <ImpactBadge impact={containerRestartImpact} showTooltip />
            </div>
          </div>
        </div>
      </div>

      {/* Port Editor */}
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <PortsEditor
          value={config.ports}
          onChange={(ports) => updateConfig("ports", ports)}
          disabled={!canDeploy}
        />
      </div>

      {/* Access Examples */}
      {hasPortMappings && (
        <div class="bg-blue-50/90 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200/50 dark:border-blue-700/50">
          <div class="flex items-center space-x-2 mb-4">
            <ExternalLink class="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h4 class="text-md font-semibold text-gray-900 dark:text-white">
              Service Access
            </h4>
          </div>
          
          <div class="space-y-3">
            {accessExamples.map((port, index) => (
              <div key={index} class="flex items-center justify-between p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                <div class="flex items-center space-x-3">
                  <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                    {port.protocol}
                  </span>
                  <div>
                    <code class="text-sm font-mono text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {port.example}
                    </code>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {port.description} • Container port {port.container} → Host port {port.host}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(port.example)}
                  class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Copy to clipboard"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Port Insights & Best Practices */}
      <div class="bg-gray-50/90 dark:bg-gray-800/90 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div class="flex items-center space-x-2 mb-4">
          <Info class="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h4 class="text-md font-semibold text-gray-900 dark:text-white">
            Port Configuration Guide
          </h4>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Common Ports */}
          <div class="space-y-3">
            <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Common Port Types
            </h5>
            <div class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <div class="flex justify-between">
                <span>Web (HTTP):</span>
                <code class="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">80, 8080, 3000</code>
              </div>
              <div class="flex justify-between">
                <span>Web (HTTPS):</span>
                <code class="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">443, 8443</code>
              </div>
              <div class="flex justify-between">
                <span>Database:</span>
                <code class="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">5432, 3306, 27017</code>
              </div>
              <div class="flex justify-between">
                <span>Cache/Redis:</span>
                <code class="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">6379</code>
              </div>
            </div>
          </div>

          {/* Best Practices */}
          <div class="space-y-3">
            <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Best Practices
            </h5>
            <ul class="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <li class="flex items-start">
                <Zap class="w-3 h-3 text-green-500 mr-1.5 mt-0.5 flex-shrink-0" />
                Use ports above 1024 to avoid privilege requirements
              </li>
              <li class="flex items-start">
                <Zap class="w-3 h-3 text-blue-500 mr-1.5 mt-0.5 flex-shrink-0" />
                Avoid common system ports (22, 25, 53, etc.)
              </li>
              <li class="flex items-start">
                <Zap class="w-3 h-3 text-orange-500 mr-1.5 mt-0.5 flex-shrink-0" />
                Use consistent port ranges per environment
              </li>
              <li class="flex items-start">
                <Zap class="w-3 h-3 text-purple-500 mr-1.5 mt-0.5 flex-shrink-0" />
                Document port purposes in service descriptions
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Security Warning for Sensitive Ports */}
      {config.ports?.some(port => [22, 21, 23, 25, 53, 80, 443, 993, 995].includes(port.host)) && (
        <div class="bg-red-50/90 dark:bg-red-900/20 rounded-xl p-4 border border-red-200/50 dark:border-red-700/50">
          <div class="flex items-start space-x-2">
            <AlertTriangle class="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <h5 class="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                Security Notice
              </h5>
              <p class="text-xs text-red-700 dark:text-red-300">
                You're using system or well-known ports. Ensure proper security measures 
                and firewall configuration to prevent unauthorized access.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}