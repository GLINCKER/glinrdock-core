import { SettingsLayout } from '../components/layouts/SettingsLayout'

export function Settings() {
  return (
    <SettingsLayout 
      currentPage="system" 
      title="System Settings"
      description="System configuration and emergency controls"
    >
      <div class="p-6">
        <h1>System Settings</h1>
        <p>This is a test settings page.</p>
      </div>
    </SettingsLayout>
  )
}