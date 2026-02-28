import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { z } from 'zod'

const heSchema = z.object({
  current_home_value_cents: z.number().int().min(0),
  existing_mortgage_balance_cents: z.number().int().min(0).default(0),
  existing_mortgage_payment_cents: z.number().int().min(0).default(0),
  home_appreciation_rate_bps: z.number().int().default(400),
  hecm_expected_rate_bps: z.number().int().default(550),
  hecm_payout_type: z.enum(['none', 'lump_sum', 'loc', 'tenure']).default('none'),
  hecm_tenure_monthly_cents: z.number().int().default(0),
  hecm_loc_growth_rate_bps: z.number().int().default(600),
  hecm_payoff_mortgage: z.boolean().default(false),
})

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

  const client = await getClientWithAuth(clientId, session.user.id, session.user.role)
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const he = await prisma.homeEquity.findUnique({ where: { client_id: clientId } })
  return NextResponse.json(he)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getClientWithAuth(clientId, session.user.id, session.user.role)
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = heSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const he = await prisma.homeEquity.upsert({
    where: { client_id: clientId },
    update: parsed.data,
    create: { ...parsed.data, client_id: clientId },
  })

  return NextResponse.json(he)
}
