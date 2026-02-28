import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { z } from 'zod'

const settingsSchema = z.object({
  inflation_rate_bps: z.number().int().optional(),
  home_appreciation_bps: z.number().int().optional(),
  loc_growth_rate_bps: z.number().int().optional(),
  planning_horizon_age: z.number().int().optional(),
  hecm_lending_limit_cents: z.number().int().optional(),
  session_timeout_minutes: z.number().int().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await prisma.globalSettings.findUnique({ where: { id: 'global' } })
  if (!settings) {
    const created = await prisma.globalSettings.create({
      data: { id: 'global' },
    })
    return NextResponse.json(created)
  }

  return NextResponse.json(settings)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const settings = await prisma.globalSettings.upsert({
    where: { id: 'global' },
    update: parsed.data,
    create: { id: 'global', ...parsed.data },
  })

  return NextResponse.json(settings)
}
