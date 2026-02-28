import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { z } from 'zod'

async function getClientWithAuth(clientId: string, userId: string, role: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) return null
  if (role !== 'admin' && client.advisor_id !== userId) return null
  return client
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      income_items: { orderBy: { sort_order: 'asc' } },
      nest_egg_accounts: { orderBy: { sort_order: 'asc' } },
      home_equity: true,
      scenarios: { orderBy: { created_at: 'asc' } },
      advisor: { select: { full_name: true, contact_info: true } },
    },
  })

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.user.role !== 'admin' && client.advisor_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(client)
}

const updateSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  age: z.number().int().optional(),
  spouse_name: z.string().nullable().optional(),
  spouse_age: z.number().int().nullable().optional(),
  marital_status: z.enum(['single', 'married', 'partnered']).optional(),
  state: z.string().length(2).optional(),
  target_retirement_age: z.number().int().optional(),
  planning_horizon_age: z.number().int().optional(),
  model_survivor: z.boolean().optional(),
  survivor_spouse: z.enum(['primary', 'spouse']).nullable().optional(),
  survivor_event_age: z.number().int().nullable().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await getClientWithAuth(clientId, session.user.id, session.user.role)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updated = await prisma.client.update({
    where: { id: clientId },
    data: parsed.data,
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await getClientWithAuth(clientId, session.user.id, session.user.role)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.client.delete({ where: { id: clientId } })
  return NextResponse.json({ success: true })
}
