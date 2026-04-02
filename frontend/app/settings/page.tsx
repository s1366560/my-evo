"use client";

import { useState } from "react";
import {
  Settings,
  Bell,
  Shield,
  Palette,
  Database,
  Globe,
  Key,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    nodeName: "my-evo-node",
    apiUrl: "http://localhost:3332",
    notifications: true,
    darkMode: true,
    autoHeartbeat: true,
    heartbeatInterval: 5,
    logLevel: "info",
    maxRetries: 3,
  });

  const [nodeSecret, setNodeSecret] = useState("************************");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-[var(--font-title)] text-3xl font-bold tracking-tight">
            Settings
          </h1>
          <p className="text-muted-foreground">
            Configure your EvoMap node and preferences
          </p>
        </div>
        <Button className="gap-2" onClick={handleSave} disabled={saving}>
          <Save className="size-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Globe className="size-5" />
            General
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Node Name</label>
              <Input
                value={settings.nodeName}
                onChange={(e) =>
                  setSettings({ ...settings, nodeName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">API URL</label>
              <Input
                value={settings.apiUrl}
                onChange={(e) =>
                  setSettings({ ...settings, apiUrl: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Bell className="size-5" />
            Notifications
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Push Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Receive alerts for important events
                </p>
              </div>
              <button
                className={`relative size-12 rounded-full transition-colors ${
                  settings.notifications ? "bg-primary" : "bg-secondary"
                }`}
                onClick={() =>
                  setSettings({ ...settings, notifications: !settings.notifications })
                }
              >
                <span
                  className={`absolute top-1 size-5 rounded-full bg-white transition-transform ${
                    settings.notifications ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto Heartbeat</p>
                <p className="text-sm text-muted-foreground">
                  Automatically send heartbeats to maintain connection
                </p>
              </div>
              <button
                className={`relative size-12 rounded-full transition-colors ${
                  settings.autoHeartbeat ? "bg-primary" : "bg-secondary"
                }`}
                onClick={() =>
                  setSettings({ ...settings, autoHeartbeat: !settings.autoHeartbeat })
                }
              >
                <span
                  className={`absolute top-1 size-5 rounded-full bg-white transition-transform ${
                    settings.autoHeartbeat ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {settings.autoHeartbeat && (
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Heartbeat Interval (minutes)
                </label>
                <Input
                  type="number"
                  value={settings.heartbeatInterval}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      heartbeatInterval: parseInt(e.target.value) || 5,
                    })
                  }
                  className="w-32"
                />
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Palette className="size-5" />
            Appearance
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Dark Mode</p>
                <p className="text-sm text-muted-foreground">
                  Use dark color scheme
                </p>
              </div>
              <button
                className={`relative size-12 rounded-full transition-colors ${
                  settings.darkMode ? "bg-primary" : "bg-secondary"
                }`}
                onClick={() =>
                  setSettings({ ...settings, darkMode: !settings.darkMode })
                }
              >
                <span
                  className={`absolute top-1 size-5 rounded-full bg-white transition-transform ${
                    settings.darkMode ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Database className="size-5" />
            Advanced
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Log Level</label>
              <select
                value={settings.logLevel}
                onChange={(e) =>
                  setSettings({ ...settings, logLevel: e.target.value })
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2"
              >
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Max Retries</label>
              <Input
                type="number"
                value={settings.maxRetries}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxRetries: parseInt(e.target.value) || 3,
                  })
                }
                className="w-32"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Shield className="size-5" />
            Security
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Node Secret</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showSecret ? "text" : "password"}
                    value={showSecret ? "abc123def456..." : nodeSecret}
                    disabled
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <Button variant="outline">Regenerate</Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Keep your node secret secure. It is used to authenticate API requests.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-destructive">
            <Key className="size-5" />
            Danger Zone
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Reset All Settings</p>
                <p className="text-sm text-muted-foreground">
                  Reset all settings to their default values
                </p>
              </div>
              <Button variant="destructive">Reset</Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete Node</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this node and all associated data
                </p>
              </div>
              <Button variant="destructive">Delete Node</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
