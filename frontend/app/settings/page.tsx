'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function Settings() {
  const [activeSection, setActiveSection] = useState('general')

  const sections = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'security', label: 'Security', icon: '🔒' },
    { id: 'api', label: 'API Keys', icon: '🔑' },
    { id: 'appearance', label: 'Appearance', icon: '🎨' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 bg-white rounded-xl p-4 shadow-sm h-fit">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition ${
                activeSection === section.id
                  ? 'bg-purple-100 text-purple-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              <span>{section.icon}</span>
              <span>{section.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-xl p-6 shadow-sm">
          {activeSection === 'general' && <GeneralSettings />}
          {activeSection === 'notifications' && <NotificationSettings />}
          {activeSection === 'security' && <SecuritySettings />}
          {activeSection === 'api' && <ApiSettings />}
          {activeSection === 'appearance' && <AppearanceSettings />}
        </div>
      </div>
    </div>
  )
}

function GeneralSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">General Settings</h2>
        <p className="text-gray-500 mb-6">Manage your account general settings.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
          <input
            type="text"
            defaultValue="openclaw-test"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input
            type="email"
            defaultValue="admin@example.com"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
          <select className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
            <option>UTC</option>
            <option>America/New_York</option>
            <option>Europe/London</option>
            <option>Asia/Shanghai</option>
          </select>
        </div>

        <div className="pt-4">
          <Button>Save Changes</Button>
        </div>
      </div>
    </div>
  )
}

function NotificationSettings() {
  const [email, setEmail] = useState(true)
  const [push, setPush] = useState(true)
  const [weekly, setWeekly] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Notification Preferences</h2>
        <p className="text-gray-500 mb-6">Choose how you want to be notified.</p>
      </div>

      <div className="space-y-4">
        <Toggle label="Email Notifications" description="Receive notifications via email" checked={email} onChange={setEmail} />
        <Toggle label="Push Notifications" description="Receive push notifications in browser" checked={push} onChange={setPush} />
        <Toggle label="Weekly Digest" description="Receive a weekly summary" checked={weekly} onChange={setWeekly} />
      </div>

      <div className="pt-4">
        <Button>Save Preferences</Button>
      </div>
    </div>
  )
}

function SecuritySettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Security Settings</h2>
        <p className="text-gray-500 mb-6">Manage your account security.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
          <input
            type="password"
            placeholder="••••••••"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
          <input
            type="password"
            placeholder="••••••••"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
          <input
            type="password"
            placeholder="••••••••"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>

        <div className="pt-4">
          <Button>Update Password</Button>
        </div>
      </div>

      <div className="border-t pt-6 mt-6">
        <h3 className="font-medium mb-4">Two-Factor Authentication</h3>
        <p className="text-sm text-gray-500 mb-4">Add an extra layer of security to your account.</p>
        <Button variant="outline">Enable 2FA</Button>
      </div>
    </div>
  )
}

function ApiSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">API Keys</h2>
        <p className="text-gray-500 mb-6">Manage your API keys for programmatic access.</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-mono text-sm">node_secret_••••••••••••••••••••••••••••••••••</span>
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Active</span>
        </div>
        <p className="text-sm text-gray-500">Created: 2026-03-01</p>
      </div>

      <div className="pt-4">
        <Button variant="outline">Generate New Key</Button>
      </div>

      <div className="border-t pt-6 mt-6">
        <h3 className="font-medium mb-4">API Usage</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">1,234</p>
            <p className="text-sm text-gray-500">Requests Today</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">45,678</p>
            <p className="text-sm text-gray-500">Requests This Month</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">99.9%</p>
            <p className="text-sm text-gray-500">Uptime</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AppearanceSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Appearance</h2>
        <p className="text-gray-500 mb-6">Customize how EvoMap looks.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-4">Theme</label>
        <div className="grid grid-cols-3 gap-4">
          <button className="p-4 border-2 border-purple-600 rounded-xl bg-white">
            <div className="w-full h-16 bg-white border rounded mb-2"></div>
            <p className="font-medium">Light</p>
          </button>
          <button className="p-4 border-2 border-gray-200 rounded-xl bg-white hover:border-gray-300">
            <div className="w-full h-16 bg-gray-800 rounded mb-2"></div>
            <p className="font-medium">Dark</p>
          </button>
          <button className="p-4 border-2 border-gray-200 rounded-xl bg-white hover:border-gray-300">
            <div className="w-full h-16 bg-gradient-to-r from-white to-gray-800 rounded mb-2"></div>
            <p className="font-medium">System</p>
          </button>
        </div>
      </div>

      <div className="pt-4">
        <Button>Save Preferences</Button>
      </div>
    </div>
  )
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-12 h-6 rounded-full transition ${
          checked ? 'bg-purple-600' : 'bg-gray-300'
        }`}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full shadow transition transform ${
            checked ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
