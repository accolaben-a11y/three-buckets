import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  owner: z.enum(['primary', 'spouse', 'joint']).optional(),
  type: z.enum(['social_security', 'wage', 'commission', 'business', 'pension', 'other']).optional(),
  label: z.string().min(1).optional(),
  monthly_amount_cents: z.number().int().optional(),
  start_age: z.number().int().optional(),
  end_age: z.number().int().nullable().optional(),
  ss_age62_cents: z.number().int().nullable().optional(),
  ss_age67_cents: z.number().int().nullable().optional(),
  ss_age70_cents: z.number().int().nullable().optional(),
  ss_claim_age: z.number().int().nullable().optional(),
  pension_survivor_pct: z.number().int().nullable().optional(),
  sort_order: z.number().int().optional(),
})

async function getItemWithAuth(id: string, userId: string, role: string) {
  const item = await prisma.incomeItem.findUnique({
    where: { id },
    include: { client: { select: { advisor_id: true } } },
  })
  if (!item) return null
  if (role !== 'admin' && item.client.advisor_id !== userId) return null
  return item
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const item = await getItemWithAuth(id, session.user.id, session.user.role)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updated = await prisma.incomeItem.update({ where: { id }, data: parsed.data })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const item = await getItemWithAuth(id, session.user.id, session.user.role)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.incomeItem.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
