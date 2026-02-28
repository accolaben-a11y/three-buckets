import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { z } from 'zod'

const itemSchema = z.object({
  client_id: z.string().uuid(),
  owner: z.enum(['primary', 'spouse', 'joint']),
  type: z.enum(['social_security', 'wage', 'commission', 'business', 'pension', 'other']),
  label: z.string().min(1),
  monthly_amount_cents: z.number().int(),
  start_age: z.number().int(),
  end_age: z.number().int().nullable().optional(),
  ss_age62_cents: z.number().int().nullable().optional(),
  ss_age67_cents: z.number().int().nullable().optional(),
  ss_age70_cents: z.number().int().nullable().optional(),
  ss_claim_age: z.number().int().nullable().optional(),
  pension_survivor_pct: z.number().int().nullable().optional(),
  sort_order: z.number().int().default(0),
})

async function clientBelongsToAdvisor(clientId: string, advisorId: string, role: string) {
  if (role === 'admin') return true
  const client = await prisma.client.findUnique({ where: { id: clientId } })
  return client?.advisor_id === advisorId
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = itemSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const allowed = await clientBelongsToAdvisor(parsed.data.client_id, session.user.id, session.user.role)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const item = await prisma.incomeItem.create({ data: parsed.data })
  return NextResponse.json(item, { status: 201 })
}
