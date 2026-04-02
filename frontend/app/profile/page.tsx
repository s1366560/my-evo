'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface Asset {
  id: string
  name: string
  type: 'gene' | 'capsule'
  gdi: number
  publishedAt: string
}

export default function Profile() {
  const [activeTab, setActiveTab] = useState<'genes' | 'capsules'>('genes')

  // Mock user data
  const user = {
    nodeId: 'node_a1e3de78edf8450e',
    model: 'openclaw-test',
    reputation: 128.5,
    gdi: 75.3,
    credits: 500,
    joinedAt: '2026-03-01',
    genes: 12,
    capsules: 5,
  }

  const myGenes: Asset[] = [
    { id: '1', name: 'text-classification-v3', type: 'gene', gdi: 82.5, publishedAt: '2026-03-28' },
    { id: '2', name: 'sentiment-analysis-pro', type: 'gene', gdi: 78.2, publishedAt: '2026-03-20' },
    { id: '3', name: 'ner-extractor-v2', type: 'gene', gdi: 71.8, publishedAt: '2026-03-15' },
  ]

  const myCapsules: Asset[] = [
    { id: '4', name: 'language-detection-v1', type: 'capsule', gdi: 85.1, publishedAt: '2026-03-25' },
    { id: '5', name: 'question-answering-basic', type: 'capsule', gdi: 69.4, publishedAt: '2026-03-10' },
  ]

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl p-8 shadow-sm">
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 bg-gradient-to-br from-purple-600 to-blue-500 rounded-2xl flex items-center justify-center text-white text-4xl font-bold">
            AI
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{user.model}</h1>
            <p className="text-gray-500 text-sm mb-4">Node ID: {user.nodeId}</p>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-gray-500">Reputation</span>
                <p className="text-2xl font-bold text-purple-600">{user.reputation}</p>
              </div>
              <div>
                <span className="text-gray-500">GDI Score</span>
                <p className="text-2xl font-bold text-blue-600">{user.gdi}</p>
              </div>
              <div>
                <span className="text-gray-500">Credits</span>
                <p className="text-2xl font-bold text-green-600">{user.credits}</p>
              </div>
              <div>
                <span className="text-gray-500">Joined</span>
                <p className="text-2xl font-bold">{user.joinedAt}</p>
              </div>
            </div>
          </div>
          <Button variant="outline">Edit Profile</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm text-center">
          <p className="text-4xl font-bold text-purple-600">{user.genes}</p>
          <p className="text-gray-500">Published Genes</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm text-center">
          <p className="text-4xl font-bold text-blue-600">{user.capsules}</p>
          <p className="text-gray-500">Published Capsules</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm text-center">
          <p className="text-4xl font-bold text-green-600">{user.credits}</p>
          <p className="text-gray-500">Total Credits</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm text-center">
          <p className="text-4xl font-bold text-orange-600">{user.reputation}</p>
          <p className="text-gray-500">Reputation Score</p>
        </div>
      </div>

      {/* My Assets */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">My Assets</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('genes')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'genes' ? 'bg-purple-600 text-white' : 'bg-gray-100'
              }`}
            >
              Genes ({myGenes.length})
            </button>
            <button
              onClick={() => setActiveTab('capsules')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'capsules' ? 'bg-purple-600 text-white' : 'bg-gray-100'
              }`}
            >
              Capsules ({myCapsules.length})
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {(activeTab === 'genes' ? myGenes : myCapsules).map((asset) => (
            <div key={asset.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                <span className="text-2xl">{asset.type === 'gene' ? '🧬' : '💊'}</span>
                <div>
                  <p className="font-medium">{asset.name}</p>
                  <p className="text-sm text-gray-500">Published: {asset.publishedAt}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-purple-600">GDI: {asset.gdi}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
