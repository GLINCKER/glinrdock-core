import { useState } from 'preact/hooks'
import { Modal } from './ui/Modal'

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { name: string; description: string }) => void
}

export function CreateProjectModal({ isOpen, onClose, onSubmit }: CreateProjectModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required'
    } else if (formData.name.length < 2) {
      newErrors.name = 'Project name must be at least 2 characters'
    } else if (!/^[a-zA-Z0-9\-_\s]+$/.test(formData.name)) {
      newErrors.name = 'Project name can only contain letters, numbers, hyphens, underscores, and spaces'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setSubmitting(true)
    try {
      await onSubmit({
        name: formData.name.trim(),
        description: formData.description.trim()
      })
      
      // Reset form on success
      setFormData({ name: '', description: '' })
      setErrors({})
      onClose()
    } catch (error) {
      // Error handling is done by the parent component
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Project" size="md">
      <form onSubmit={handleSubmit} class="space-y-4">
        {/* Project Name */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Project Name <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', (e.target as HTMLInputElement).value)}
            placeholder="My Awesome Project"
            class={`input ${errors.name ? 'border-red-500' : ''}`}
            disabled={submitting}
          />
          {errors.name && (
            <p class="text-red-500 text-xs mt-1">{errors.name}</p>
          )}
          <p class="text-gray-500 text-xs mt-1">
            A unique name to identify your project
          </p>
        </div>

        {/* Description */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', (e.target as HTMLTextAreaElement).value)}
            placeholder="Brief description of your project..."
            rows={3}
            class="input resize-none"
            disabled={submitting}
          />
          <p class="text-gray-500 text-xs mt-1">
            Optional description to help identify this project
          </p>
        </div>

        {/* Form Actions */}
        <div class="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            class="btn btn-ghost"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={submitting || !formData.name.trim()}
          >
            {submitting ? (
              <span class="flex items-center">
                <span class="animate-spin mr-2">⟳</span>
                Creating...
              </span>
            ) : (
              'Create Project'
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}