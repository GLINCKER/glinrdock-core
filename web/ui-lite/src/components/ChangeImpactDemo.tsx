/**
 * Demo component showing the Change Impact Classification system
 * This demonstrates how the pending changes panel would work
 */

import { useState } from "preact/hooks";
import { PendingChangesPanel } from "./PendingChangesPanel";
import { ImpactBadge, FieldImpactIndicator } from "./ImpactBadge";
import { getFieldImpact, PendingChange } from "../utils/changeImpact";

export function ChangeImpactDemo() {
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  // Demo data for different field types
  const demoChanges = [
    {
      field: 'environment',
      oldValue: { NODE_ENV: 'dev', PORT: '3000' },
      newValue: { NODE_ENV: 'prod', PORT: '3000', DATABASE_URL: 'postgres://...' },
      description: 'Added DATABASE_URL, changed NODE_ENV to prod'
    },
    {
      field: 'ports',
      oldValue: [{ host: 8080, container: 3000 }],
      newValue: [{ host: 8080, container: 3000 }, { host: 3001, container: 3001 }],
      description: 'Added new port mapping 3001:3001'
    },
    {
      field: 'volumes',
      oldValue: [],
      newValue: [{ host: '/data', container: '/app/data' }],
      description: 'Added volume mount /data:/app/data'
    },
    {
      field: 'image',
      oldValue: 'node:16',
      newValue: 'node:18',
      description: 'Updated base image to Node 18'
    }
  ];

  const addDemoChange = (demo: any) => {
    const impact = getFieldImpact(demo.field, demo.oldValue, demo.newValue);
    const change: PendingChange = {
      field: demo.field,
      oldValue: demo.oldValue,
      newValue: demo.newValue,
      impact,
      timestamp: new Date()
    };

    setPendingChanges(prev => {
      const filtered = prev.filter(c => c.field !== demo.field);
      return [...filtered, change];
    });
  };

  const removeChange = (field: string) => {
    setPendingChanges(prev => prev.filter(c => c.field !== field));
  };

  const applyChanges = async () => {
    setIsApplying(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setPendingChanges([]);
    setIsApplying(false);
    alert('Changes applied successfully! 🎉');
  };

  const cancelChanges = () => {
    setPendingChanges([]);
  };

  return (
    <div class="max-w-4xl mx-auto p-6 space-y-8">
      <div class="text-center">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🔄 Change Impact System Demo
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Click the buttons below to simulate configuration changes and see their impact classification
        </p>
      </div>

      {/* Impact Type Examples */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {demoChanges.map((demo) => {
          const impact = getFieldImpact(demo.field, demo.oldValue, demo.newValue);
          const isActive = pendingChanges.some(c => c.field === demo.field);
          
          return (
            <div 
              key={demo.field}
              class={`p-4 rounded-lg border-2 transition-all ${
                isActive 
                  ? `${impact.borderColor} ${impact.bgColor}` 
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              <div class="flex items-center justify-between mb-3">
                <h3 class="font-medium text-gray-900 dark:text-white capitalize">
                  {demo.field.replace('_', ' ')}
                </h3>
                <FieldImpactIndicator impact={impact} />
              </div>
              
              <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">
                {demo.description}
              </p>
              
              <ImpactBadge 
                impact={impact} 
                size="sm" 
                className="mb-3" 
              />
              
              <button
                onClick={() => isActive ? removeChange(demo.field) : addDemoChange(demo)}
                class={`w-full py-2 px-3 text-xs font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400'
                }`}
              >
                {isActive ? 'Remove Change' : 'Add Change'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Current Status */}
      <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 class="font-medium text-gray-900 dark:text-white mb-2">
          Current Status
        </h3>
        <div class="text-sm text-gray-600 dark:text-gray-400">
          {pendingChanges.length === 0 ? (
            <p>No pending changes. Add some changes above to see the impact system in action.</p>
          ) : (
            <p>
              {pendingChanges.length} pending change{pendingChanges.length !== 1 ? 's' : ''}.
              Scroll down to see the Pending Changes Panel appear at the bottom.
            </p>
          )}
        </div>
      </div>

      {/* Demo Content - Spacer */}
      <div class="h-96 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg flex items-center justify-center">
        <div class="text-center">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Demo Content Area
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            The Pending Changes Panel will appear at the bottom when you have changes
          </p>
        </div>
      </div>

      {/* Pending Changes Panel */}
      <PendingChangesPanel
        changes={pendingChanges}
        onApplyChanges={applyChanges}
        onCancelChanges={cancelChanges}
        onRemoveChange={removeChange}
        isApplying={isApplying}
        containerUptime="2d 14h 32m"
      />
    </div>
  );
}