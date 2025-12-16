'use client'

import { UserButton } from "@clerk/nextjs"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from 'next/image'
import logo from '../app/_template/images/logo.png'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const navigation = [
    { name: 'Reports', href: '/', icon: '📊' },
    { name: 'Locations', href: '/locations', icon: '📍' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center">
                <Image src={'/logo1.png'} alt="Xtock" width={40} height={40} className="object-contain" />
                <span className="text-2xl font-bold text-gray-800 bg-clip-text mt-1">tock</span>
              </Link>

              {/* Navigation */}
              <nav className="hidden md:flex space-x-1">
                {navigation.map((item) => {
                  const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-gray-200 text-blue-800'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span className="mr-2">{item.icon}</span>
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
            </div>

            {/* User Button */}
            <div className="flex items-center gap-4">
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: "size-9",
                  },
                }}
              />
            </div>
          </div>

          {/* Mobile Navigation */}
          <nav className="md:hidden pb-4 flex space-x-1">
            {navigation.map((item) => {
              const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all text-center ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
