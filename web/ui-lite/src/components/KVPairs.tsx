import { useState } from 'preact/hooks'

interface KVPair {
  key: string
  value: string
}

interface KVPairsProps {
  value: Record<string, string>
  onChange: (value: Record<string, string>) => void
  placeholder?: {
    key?: string
    value?: string
  }
  disabled?: boolean
}

export function KVPairs({ value, onChange, placeholder = {}, disabled = false }: KVPairsProps) {
  // Convert object to array for editing
  const [pairs, setPairs] = useState<KVPair[]>(() => {
    const entries = Object.entries(value || {})
    return entries.length > 0 
      ? entries.map(([key, value]) => ({ key, value }))
      : [{ key: '', value: '' }]
  })

  const updateValue = (newPairs: KVPair[]) => {
    setPairs(newPairs)
    
    // Convert back to object, filtering out empty keys
    const obj: Record<string, string> = {}
    newPairs.forEach(pair => {
      if (pair.key.trim()) {
        obj[pair.key.trim()] = pair.value
      }
    })
    
    onChange(obj)
  }

  const handlePairChange = (index: number, field: 'key' | 'value', newValue: string) => {
    const newPairs = [...pairs]
    newPairs[index] = { ...newPairs[index], [field]: newValue }
    updateValue(newPairs)
  }

  const addPair = () => {
    updateValue([...pairs, { key: '', value: '' }])
  }

  const removePair = (index: number) => {
    if (pairs.length > 1) {
      const newPairs = pairs.filter((_, i) => i !== index)
      updateValue(newPairs)
    }
  }

  return (
    <div class="space-y-3">
      {pairs.map((pair, index) => (
        <div key={index} class="flex items-center space-x-2">
          <input
            type="text"
            value={pair.key}
            onInput={(e) => handlePairChange(index, 'key', (e.target as HTMLInputElement).value)}
            placeholder={placeholder.key || 'Key'}
            class="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-[#9c40ff] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={disabled}
          />
          <span class="text-gray-500 dark:text-gray-400">=</span>
          <input
            type="text"
            value={pair.value}
            onInput={(e) => handlePairChange(index, 'value', (e.target as HTMLInputElement).value)}
            placeholder={placeholder.value || 'Value'}
            class="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-[#9c40ff] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={disabled}
          />
          <div class="flex items-center space-x-1">
            {pairs.length > 1 && (
              <button
                type="button"
                onClick={() => removePair(index)}
                disabled={disabled}
                class="p-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Remove"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      ))}
      
      {!disabled && (
        <button
          type="button"
          onClick={addPair}
          class="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Variable</span>
        </button>
      )}
    </div>
  )
}