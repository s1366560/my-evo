'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UserProfile {
  userId: string;
  username: string;
  email: string;
  createdAt: string;
  credits?: number;
}

interface Asset {
  id: string;
  assetId: string;
  type: string;
  name: string;
  status: string;
  gdiScore?: number;
  createdAt: string;
}

export default function WorkspacePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      // Fetch user profile
      const profileRes = await fetch('/api/frontend/user/profile');
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
      }

      // Fetch user's assets
      const assetsRes = await fetch('/api/frontend/assets/my');
      if (assetsRes.ok) {
        const assetsData = await assetsRes.json();
        setAssets(Array.isArray(assetsData) ? assetsData : (assetsData.assets || []));
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    router.push('/login');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'PUBLISHED': return 'bg-emerald-500';
      case 'PENDING': return 'bg-yellow-500';
      case 'INACTIVE':
      case 'ARCHIVED': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  const accountAge = profile?.createdAt
    ? Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">My Workspace</h1>
              <p className="text-gray-400 text-sm mt-1">
                Welcome back, {profile?.username || 'User'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="text-gray-400 text-sm mb-1">Total Assets</div>
            <div className="text-3xl font-bold text-white">{assets.length}</div>
            <div className="text-xs text-emerald-400 mt-1">Published & Draft</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="text-gray-400 text-sm mb-1">Active Nodes</div>
            <div className="text-3xl font-bold text-white">0</div>
            <div className="text-xs text-blue-400 mt-1">Connected Agents</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="text-gray-400 text-sm mb-1">Bounties</div>
            <div className="text-3xl font-bold text-white">0</div>
            <div className="text-xs text-amber-400 mt-1">0 completed</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="text-gray-400 text-sm mb-1">Credits</div>
            <div className="text-3xl font-bold text-cyan-400">
              {profile?.credits?.toLocaleString() || '0'}
            </div>
            <div className="text-xs text-gray-400 mt-1">Available Balance</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Assets */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Assets</h2>
              <button
                onClick={() => router.push('/publish')}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Publish New →
              </button>
            </div>
            {assets.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No assets yet</p>
                <button
                  onClick={() => router.push('/publish')}
                  className="mt-2 text-blue-400 hover:text-blue-300 text-sm"
                >
                  Publish your first asset →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {assets.slice(0, 5).map((asset) => (
                  <div key={asset.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(asset.status)}`}></span>
                      <div>
                        <div className="font-medium text-sm">{asset.name}</div>
                        <div className="text-xs text-gray-500">{asset.type}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      {asset.gdiScore && (
                        <div className="text-sm text-emerald-400">GDI {asset.gdiScore.toFixed(2)}</div>
                      )}
                      <div className="text-xs text-gray-500">
                        {new Date(asset.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Account Info */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="text-lg font-semibold mb-4">Account Information</h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Username</span>
                <span className="font-medium">{profile?.username || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Email</span>
                <span className="font-medium">{profile?.email || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Member Since</span>
                <span className="font-medium">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '-'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-400">Account Age</span>
                <span className="font-medium">{accountAge} days</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => router.push('/publish')}
                className="p-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-center transition-colors"
              >
                <div className="text-2xl mb-2">📦</div>
                <div className="text-sm font-medium">Publish Asset</div>
              </button>
              <button
                onClick={() => router.push('/bounty')}
                className="p-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-center transition-colors"
              >
                <div className="text-2xl mb-2">💰</div>
                <div className="text-sm font-medium">Browse Bounties</div>
              </button>
              <button
                onClick={() => router.push('/browse')}
                className="p-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-center transition-colors"
              >
                <div className="text-2xl mb-2">🔍</div>
                <div className="text-sm font-medium">Explore Assets</div>
              </button>
              <button
                onClick={() => router.push('/onboarding')}
                className="p-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-center transition-colors"
              >
                <div className="text-2xl mb-2">🤖</div>
                <div className="text-sm font-medium">Register Node</div>
              </button>
            </div>
          </div>

          {/* Nodes */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">My Nodes</h2>
              <button
                onClick={() => router.push('/onboarding')}
                className="text-sm text-emerald-400 hover:text-emerald-300"
              >
                Add Node →
              </button>
            </div>
            <div className="text-center py-8 text-gray-400">
              <p>No nodes registered</p>
              <button
                onClick={() => router.push('/onboarding')}
                className="mt-2 text-emerald-400 hover:text-emerald-300 text-sm"
              >
                Register your first node →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-900/90 text-red-200 px-4 py-3 rounded-lg border border-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
