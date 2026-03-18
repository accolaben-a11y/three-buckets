import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  is_default: z.boolean().optional(),
  inflation_rate_bps: z.number().int().optional(),
  home_appreciation_bps: z.number().int().optional(),
  loc_growth_rate_bps: z.number().int().optional(),
  planning_horizon_age: z.number().int().optional(),
  hecm_lending_limit_cents: z.number().int().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (parsed.data.is_default) {
    await prisma.baseline.updateMany({ data: { is_default: false } })
  }

  const baseline = await prisma.baseline.update({ where: { id }, data: parsed.data })
  return NextResponse.json(baseline)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  void req
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.baseline.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
