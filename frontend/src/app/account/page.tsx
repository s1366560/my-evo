'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { User, Mail, Lock, Shield, Bell, Trash2, Save, Check, AlertCircle, Loader2, UserCircle, Key, Eye, EyeOff } from 'lucide-react';

interface UserProfile {
  id: number;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  accountAgeDays?: number;
  creatorLevel?: number;
  totalMaps?: number;
  recentActivity?: number;
  accountPlan?: string;
  totalEarnings?: number;
}

function StatBox({ label, value, color = 'text-white' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="font-medium text-gray-200">{label}</p>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-purple-600' : 'bg-gray-700'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

export default function AccountPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Profile form state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [bountyAlerts, setBountyAlerts] = useState(true);
  const [marketplaceUpdates, setMarketplaceUpdates] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');

  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) {
        setError('Authentication required. Please log in.');
        return;
      }
      const res = await fetch('/api/frontend/user/profile', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) {
          setError('Session expired. Please log in again.');
          return;
        }
        throw new Error('Failed to fetch profile');
      }
      const data = await res.json();
      const userData = data.user || data;
      setProfile(userData);
      setUsername(userData.username || '');
      setEmail(userData.email || '');
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError('Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const token = getToken();
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/frontend/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ username, email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update profile');
      }
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
      await fetchProfile();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return; }
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters'); return; }
    // Demo mode - show success
    setSuccess('Password changed successfully! (Demo mode)');
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    setShowPasswordForm(false);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleDeleteAccount = () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;
    alert('Account deletion requires confirmation. Please contact support.');
  };

  const getPlanColor = (plan?: string) => {
    switch (plan) {
      case 'pro': return 'text-purple-400';
      case 'team': return 'text-amber-400';
      default: return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-16 flex items-center justify-center">
          <div className="flex items-center gap-3 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading profile...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center justify-center">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Unable to Load Profile</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button onClick={fetchProfile}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Account Settings</h1>
          <p className="text-gray-400">Manage your profile, security, and preferences</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-red-400">{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span className="text-emerald-400">{success}</span>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-gray-900 border border-gray-800">
            <TabsTrigger value="profile" className="data-[state=active]:bg-gray-800">
              <User className="w-4 h-4 mr-2" />Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-gray-800">
              <Shield className="w-4 h-4 mr-2" />Security
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-gray-800">
              <Bell className="w-4 h-4 mr-2" />Notifications
            </TabsTrigger>
            <TabsTrigger value="danger" className="data-[state=active]:bg-gray-800">
              <AlertCircle className="w-4 h-4 mr-2" />Danger Zone
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <UserCircle className="w-5 h-5 mr-2" />
                  Profile Information
                </CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileUpdate} className="space-y-6">
                  {/* Avatar */}
                  <div className="flex items-center gap-4 pb-6 border-b border-gray-800">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-2xl font-bold">
                      {username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Profile Picture</p>
                      <p className="text-xs text-gray-500">Avatar is auto-generated from your username</p>
                    </div>
                  </div>

                  {/* Username */}
                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <User className="w-4 h-4 mr-2 text-gray-400" />
                      Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter your username"
                      required minLength={3} maxLength={30}
                    />
                    <p className="text-xs text-gray-500">3-30 characters. This is your public display name.</p>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <Mail className="w-4 h-4 mr-2 text-gray-400" />
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter your email"
                      required
                    />
                    <p className="text-xs text-gray-500">We&apos;ll send important updates to this email.</p>
                  </div>

                  {/* Account Stats */}
                  {profile && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-800">
                      <StatBox label="Account Age" value={`${profile.accountAgeDays || 0} days`} />
                      <StatBox label="Creator Level" value={`Level ${profile.creatorLevel || 0}`} color="text-amber-400" />
                      <StatBox label="Account Plan" value={profile.accountPlan || 'free'} color={getPlanColor(profile.accountPlan)} />
                      <StatBox label="Member Since" value={profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'} />
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                      ) : (
                        <><Save className="w-4 h-4 mr-2" />Save Changes</>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>


          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Security Settings
                </CardTitle>
                <CardDescription>Manage your password and account security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Password Change */}
                <div className="pb-6 border-b border-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <Key className="w-5 h-5 mr-3 text-gray-400" />
                      <div>
                        <p className="font-medium">Password</p>
                        <p className="text-sm text-gray-400">Last changed: Never</p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => setShowPasswordForm(!showPasswordForm)}>
                      {showPasswordForm ? 'Cancel' : 'Change Password'}
                    </Button>
                  </div>

                  {showPasswordForm && (
                    <form onSubmit={handlePasswordChange} className="mt-4 space-y-4 p-4 bg-gray-900/50 rounded-lg">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Current Password</label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 pr-10 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Enter current password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                          >
                            {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">New Password</label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 pr-10 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Enter new password"
                            required minLength={8}
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Confirm New Password</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Confirm new password"
                          required
                        />
                      </div>

                      {passwordError && (
                        <p className="text-sm text-red-400">{passwordError}</p>
                      )}

                      <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setShowPasswordForm(false)}>Cancel</Button>
                        <Button type="submit">Update Password</Button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Session Info */}
                <div>
                  <h3 className="font-medium mb-4 flex items-center">
                    <Shield className="w-4 h-4 mr-2 text-gray-400" />
                    Active Sessions
                  </h3>
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="font-medium">Current Session</p>
                          <p className="text-sm text-gray-400">Active now</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded">Active</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="w-5 h-5 mr-2" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>Choose how you want to be notified</CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-gray-800">
                <Toggle
                  checked={emailNotifications}
                  onChange={setEmailNotifications}
                  label="Email Notifications"
                  description="Receive important updates via email"
                />
                <Toggle
                  checked={bountyAlerts}
                  onChange={setBountyAlerts}
                  label="Bounty Alerts"
                  description="Get notified when new bounties match your skills"
                />
                <Toggle
                  checked={marketplaceUpdates}
                  onChange={setMarketplaceUpdates}
                  label="Marketplace Updates"
                  description="Updates about new assets and trending items"
                />
                <Toggle
                  checked={weeklyDigest}
                  onChange={setWeeklyDigest}
                  label="Weekly Digest"
                  description="A weekly summary of your activity and recommendations"
                />
              </CardContent>
              <CardFooter className="flex justify-end pt-4">
                <Button onClick={() => { setSuccess('Preferences saved!'); setTimeout(() => setSuccess(null), 3000); }}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Preferences
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Danger Zone Tab */}
          <TabsContent value="danger">
            <Card className="border-red-500/30">
              <CardHeader>
                <CardTitle className="flex items-center text-red-400">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  Danger Zone
                </CardTitle>
                <CardDescription>Irreversible actions - proceed with caution</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Delete Account */}
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Trash2 className="w-5 h-5 text-red-400" />
                      <div>
                        <p className="font-medium text-red-400">Delete Account</p>
                        <p className="text-sm text-gray-400">
                          Permanently delete your account and all associated data. This action cannot be undone.
                        </p>
                      </div>
                    </div>
                    <Button variant="destructive" onClick={handleDeleteAccount}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Account
                    </Button>
                  </div>
                </div>

                {/* Export Data */}
                <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium">Export Your Data</p>
                        <p className="text-sm text-gray-400">
                          Download a copy of all your account data
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => alert('Data export feature coming soon!')}>
                      Export Data
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Footer />
    </div>
  );
}
