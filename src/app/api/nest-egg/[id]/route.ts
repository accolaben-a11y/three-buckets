import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  label: z.string().min(1).optional(),
  account_type: z.enum(['qualified', 'non_qualified']).optional(),
  current_balance_cents: z.number().int().min(0).optional(),
  monthly_contribution_cents: z.number().int().min(0).optional(),
  rate_of_return_bps: z.number().int().min(0).optional(),
  monthly_draw_cents: z.number().int().min(0).optional(),
  sort_order: z.number().int().optional(),
})

async function getAccountWithAuth(id: string, userId: string, role: string) {
  const account = await prisma.nestEggAccount.findUnique({
    where: { id },
    include: { client: { select: { advisor_id: true } } },
  })
  if (!account) return null
  if (role !== 'admin' && account.client.advisor_id !== userId) return null
  return account
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = await getAccountWithAuth(id, session.user.id, session.user.role)
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updated = await prisma.nestEggAccount.update({ where: { id }, data: parsed.data })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = await getAccountWithAuth(id, session.user.id, session.user.role)
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.nestEggAccount.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
