import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { z } from 'zod'

const accountSchema = z.object({
  client_id: z.string().uuid(),
  label: z.string().min(1),
  account_type: z.enum(['qualified', 'non_qualified']),
  current_balance_cents: z.number().int().min(0),
  monthly_contribution_cents: z.number().int().min(0).default(0),
  rate_of_return_bps: z.number().int().min(0),
  monthly_draw_cents: z.number().int().min(0).default(0),
  sort_order: z.number().int().default(0),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = accountSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (session.user.role !== 'admin') {
    const client = await prisma.client.findUnique({ where: { id: parsed.data.client_id } })
    if (client?.advisor_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const account = await prisma.nestEggAccount.create({ data: parsed.data })
  return NextResponse.json(account, { status: 201 })
}
