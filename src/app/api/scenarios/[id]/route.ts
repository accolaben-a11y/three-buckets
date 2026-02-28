import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
  target_monthly_income_cents: z.number().int().optional(),
  bucket1_draw_cents: z.number().int().optional(),
  bucket2_draw_cents: z.number().int().optional(),
  bucket3_draw_cents: z.number().int().optional(),
  bridge_funding_source: z.enum(['bucket1', 'bucket2', 'bucket3']).nullable().optional(),
  ss_primary_claim_age: z.number().int().optional(),
  ss_spouse_claim_age: z.number().int().optional(),
  inflation_rate_bps: z.number().int().optional(),
  planning_horizon_age: z.number().int().optional(),
  notes: z.string().nullable().optional(),
  survivor_mode: z.boolean().optional(),
})

async function getScenarioWithAuth(id: string, userId: string, role: string) {
  const scenario = await prisma.scenario.findUnique({
    where: { id },
    include: { client: { select: { advisor_id: true } } },
  })
  if (!scenario) return null
  if (role !== 'admin' && scenario.client.advisor_id !== userId) return null
  return scenario
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scenario = await getScenarioWithAuth(id, session.user.id, session.user.role)
  if (!scenario) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // If setting active, deactivate others for this client
  if (parsed.data.is_active) {
    await prisma.scenario.updateMany({
      where: { client_id: scenario.client_id, id: { not: id } },
      data: { is_active: false },
    })
  }

  const updated = await prisma.scenario.update({ where: { id }, data: parsed.data })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scenario = await getScenarioWithAuth(id, session.user.id, session.user.role)
  if (!scenario) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.scenario.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

// Clone scenario
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scenario = await getScenarioWithAuth(id, session.user.id, session.user.role)
  if (!scenario) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id: _id, client: _client, created_at, updated_at, ...cloneData } = scenario

  const cloned = await prisma.scenario.create({
    data: {
      ...cloneData,
      name: `${scenario.name} (Copy)`,
      is_active: false,
    },
  })

  return NextResponse.json(cloned, { status: 201 })
}
