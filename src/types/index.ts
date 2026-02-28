// Extended session types
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: 'admin' | 'advisor'
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
  }
}

// Formatting helpers
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`
}

export function centsFromDollars(dollars: number): number {
  return Math.round(dollars * 100)
}

export function dollarsFromCents(cents: number): number {
  return cents / 100
}
