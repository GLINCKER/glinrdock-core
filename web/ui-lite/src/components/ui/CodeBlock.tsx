import { useState } from 'preact/hooks'
import { Copy, Check } from 'lucide-preact'

interface CodeBlockProps {
  code: string
  language?: string
  filename?: string
  showLineNumbers?: boolean
  className?: string
}

export function CodeBlock({ 
  code, 
  language = '', 
  filename,
  showLineNumbers = false,
  className = '' 
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  const lines = code.trim().split('\n')

  return (
    <div class={`relative group bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden my-6 ${className}`}>
      {/* Header with filename and language */}
      {(filename || language) && (
        <div class="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            {filename && (
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {filename}
              </span>
            )}
            {language && (
              <span class="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                {language}
              </span>
            )}
          </div>
          <button
            onClick={handleCopy}
            class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check class="w-4 h-4 text-green-500" />
            ) : (
              <Copy class="w-4 h-4" />
            )}
          </button>
        </div>
      )}

      {/* Code content */}
      <div class="relative">
        <pre class="overflow-x-auto">
          <code class={`block text-sm font-mono text-gray-800 dark:text-gray-200 p-4 ${language ? `language-${language}` : ''}`}>
            {showLineNumbers ? (
              <table class="w-full">
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={index}>
                      <td class="select-none w-8 pr-4 text-right text-gray-500 dark:text-gray-400 text-xs">
                        {index + 1}
                      </td>
                      <td class="w-full whitespace-pre-wrap">
                        {line || ' '}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div class="whitespace-pre-wrap">{code}</div>
            )}
          </code>
        </pre>

        {/* Copy button (when no header) */}
        {!filename && !language && (
          <button
            onClick={handleCopy}
            class="absolute top-2 right-2 p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors opacity-0 group-hover:opacity-100"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check class="w-4 h-4 text-green-500" />
            ) : (
              <Copy class="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}