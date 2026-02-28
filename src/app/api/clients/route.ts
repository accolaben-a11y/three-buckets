import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { z } from 'zod'

const clientSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  age: z.number().int().min(18).max(110),
  spouse_name: z.string().nullable().optional(),
  spouse_age: z.number().int().min(18).max(110).nullable().optional(),
  marital_status: z.enum(['single', 'married', 'partnered']),
  state: z.string().length(2),
  target_retirement_age: z.number().int().default(62),
  planning_horizon_age: z.number().int().default(90),
  model_survivor: z.boolean().default(false),
  survivor_spouse: z.enum(['primary', 'spouse']).nullable().optional(),
  survivor_event_age: z.number().int().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const advisorFilter = searchParams.get('advisor_id')

  const where = session.user.role === 'admin'
    ? (advisorFilter ? { advisor_id: advisorFilter } : {})
    : { advisor_id: session.user.id }

  const clients = await prisma.client.findMany({
    where,
    include: {
      advisor: { select: { full_name: true, email: true } },
      scenarios: { where: { is_active: true }, select: { name: true } },
    },
    orderBy: { updated_at: 'desc' },
  })

  return NextResponse.json(clients)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = clientSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const client = await prisma.client.create({
    data: {
      ...parsed.data,
      advisor_id: session.user.id,
    },
  })

  // Create default scenario
  await prisma.scenario.create({
    data: {
      client_id: client.id,
      name: 'Base Scenario',
      is_active: true,
      target_monthly_income_cents: 0,
    },
  })

  return NextResponse.json(client, { status: 201 })
}
