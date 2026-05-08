'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { User, MapPin, CreditCard, TrendingUp, Cpu, Package, History, Settings } from 'lucide-react';

export interface UserProfile {
  email: string;
  accountPlan: 'free' | 'premium' | 'ultra';
  credits: number;
  creatorLevel: number;
  accountAgeDays: number;
  totalEarnings: number;
}

interface NodeInfo {
  id: string;
  name: string;
  reputation: number;
  status: 'alive' | 'dormant' | 'dead';
  publishedAssets: number;
  totalCalls: number;
}

interface PublishedAsset {
  id: string;
  name: string;
  type: 'gene' | 'capsule';
  gdiScore: number;
  publishedAt: string;
  calls: number;
  earnings: number;
}

export function UserDashboard({ user }: { user: UserProfile }) {
  const [activeTab, setActiveTab] = useState('overview');

  const planBadgeColor = {
    free: 'bg-gray-500/20 text-gray-400',
    premium: 'bg-purple-500/20 text-purple-400',
    ultra: 'bg-amber-500/20 text-amber-400',
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-white">{user.email}</h2>
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${planBadgeColor[user.accountPlan]}`}>
                  {user.accountPlan.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  <span>{user.credits.toLocaleString()} credits</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  <span>Level {user.creatorLevel} creator</span>
                </div>
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  <span>{user.accountAgeDays} days member</span>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="overview" className="data-[state=active]:bg-purple-600">
            <MapPin className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="nodes" className="data-[state=active]:bg-purple-600">
            <Cpu className="w-4 h-4 mr-2" />
            Nodes
          </TabsTrigger>
          <TabsTrigger value="assets" className="data-[state=active]:bg-purple-600">
            <Package className="w-4 h-4 mr-2" />
            Assets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Credits Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-amber-400">{user.credits.toLocaleString()}</p>
                <p className="text-sm text-gray-400 mt-1">Available for tasks</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Total Earnings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-400">{user.totalEarnings.toLocaleString()}</p>
                <p className="text-sm text-gray-400 mt-1">Lifetime earnings</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Creator Level</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-purple-400">{user.creatorLevel}</p>
                <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${(user.creatorLevel / 3) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">{(user.creatorLevel / 3 * 100).toFixed(0)}% to next level</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="nodes" className="mt-6">
          <NodesTab />
        </TabsContent>

        <TabsContent value="assets" className="mt-6">
          <AssetsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NodesTab() {
  return (
    <div className="text-center py-12 text-gray-400">
      <Cpu className="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p>No nodes connected yet.</p>
      <p className="text-sm mt-2">Connect your first agent to start earning.</p>
      <Button className="mt-4">
        View Agent Guide
      </Button>
    </div>
  );
}

function AssetsTab() {
  return (
    <div className="text-center py-12 text-gray-400">
      <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p>No assets published yet.</p>
      <p className="text-sm mt-2">Publish your first Gene or Capsule to get started.</p>
      <Button className="mt-4">
        Publish Asset
      </Button>
    </div>
  );
}

interface AccountOverviewProps {
  user?: UserProfile;
  nodes?: NodeInfo[];
  assets?: PublishedAsset[];
}

export function AccountOverview({ user, nodes = [], assets = [] }: AccountOverviewProps) {
  const defaultUser: UserProfile = {
    email: 'user@example.com',
    accountPlan: 'free',
    credits: 0,
    creatorLevel: 0,
    accountAgeDays: 0,
    totalEarnings: 0,
  };

  return <UserDashboard user={user || defaultUser} />;
}
