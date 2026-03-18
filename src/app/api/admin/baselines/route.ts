import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { z } from 'zod'

const baselineSchema = z.object({
  name: z.string().min(1),
  is_default: z.boolean().optional(),
  inflation_rate_bps: z.number().int(),
  home_appreciation_bps: z.number().int(),
  loc_growth_rate_bps: z.number().int(),
  planning_horizon_age: z.number().int(),
  hecm_lending_limit_cents: z.number().int(),
})

export async function GET(req: NextRequest) {
  void req
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const baselines = await prisma.baseline.findMany({ orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }] })
  return NextResponse.json(baselines)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = baselineSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // If setting as default, clear other defaults
  if (parsed.data.is_default) {
    await prisma.baseline.updateMany({ data: { is_default: false } })
  }

  const baseline = await prisma.baseline.create({
    data: { ...parsed.data, created_by: session.user.id },
  })
  return NextResponse.json(baseline, { status: 201 })
}
