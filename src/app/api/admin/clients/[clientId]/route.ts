import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client || client.deleted_at === null) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.client.update({
    where: { id: clientId },
    data: { deleted_at: null, deleted_by: null },
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client || client.deleted_at === null) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.client.delete({ where: { id: clientId } })
  return NextResponse.json({ success: true })
}
