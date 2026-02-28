import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { z } from 'zod'

const scenarioSchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(1),
  is_active: z.boolean().default(false),
  target_monthly_income_cents: z.number().int().default(0),
  bucket1_draw_cents: z.number().int().default(0),
  bucket2_draw_cents: z.number().int().default(0),
  bucket3_draw_cents: z.number().int().default(0),
  bridge_funding_source: z.enum(['bucket1', 'bucket2', 'bucket3']).nullable().optional(),
  ss_primary_claim_age: z.number().int().default(67),
  ss_spouse_claim_age: z.number().int().default(67),
  inflation_rate_bps: z.number().int().default(300),
  planning_horizon_age: z.number().int().default(90),
  notes: z.string().nullable().optional(),
  survivor_mode: z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = scenarioSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (session.user.role !== 'admin') {
    const client = await prisma.client.findUnique({ where: { id: parsed.data.client_id } })
    if (client?.advisor_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // If setting active, deactivate others
  if (parsed.data.is_active) {
    await prisma.scenario.updateMany({
      where: { client_id: parsed.data.client_id },
      data: { is_active: false },
    })
  }

  const scenario = await prisma.scenario.create({ data: parsed.data })
  return NextResponse.json(scenario, { status: 201 })
}
