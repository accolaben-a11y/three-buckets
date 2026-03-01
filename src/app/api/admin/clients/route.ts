import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [deletedClients, allUsers] = await Promise.all([
    prisma.client.findMany({
      where: { deleted_at: { not: null } },
      include: { advisor: { select: { full_name: true } } },
      orderBy: { deleted_at: 'desc' },
    }),
    prisma.user.findMany({ select: { id: true, full_name: true } }),
  ])

  const userMap = Object.fromEntries(allUsers.map(u => [u.id, u.full_name]))

  const result = deletedClients.map(c => ({
    ...c,
    deleted_by_name: c.deleted_by ? (userMap[c.deleted_by] ?? c.deleted_by) : null,
  }))

  return NextResponse.json(result)
}
