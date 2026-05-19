import ProfileSettings from '@/components/settings/ProfileSettings'

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">My Settings</h1>
        <p className="text-xs text-gray-500 mt-0.5">Manage your profile, avatar and email signature</p>
      </div>
      <ProfileSettings />
    </div>
  )
}
