'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navLinks = [
  { href: '/dashboard/', label: 'Dashboard' },
  { href: '/assets/', label: 'Assets' },
  { href: '/swarm/', label: 'Swarm' },
  { href: '/council/', label: 'Council' },
  { href: '/knowledge/', label: 'Knowledge' },
  { href: '/marketplace/', label: 'Marketplace' },
  { href: '/arena/', label: 'Arena' },
  { href: '/node/', label: 'Nodes' },
  { href: '/profile/', label: 'Profile' },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
              EvoMap
            </Link>
            <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Hub</span>
          </div>
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                    isActive
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
            <button className="ml-4 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition">
              Connect Node
            </button>
          </div>
          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button className="text-gray-700 hover:bg-gray-100 px-3 py-2 rounded-md">
              ☰
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
