import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

async function requireAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') return null
  return session
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      full_name: true,
      role: true,
      contact_info: true,
      is_active: true,
      created_at: true,
      _count: { select: { clients: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json(users)
}

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1),
  contact_info: z.string().optional(),
  role: z.enum(['admin', 'advisor']).default('advisor'),
})

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } })
  if (exists) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })

  const hash = await bcrypt.hash(parsed.data.password, 12)
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      password_hash: hash,
      full_name: parsed.data.full_name,
      contact_info: parsed.data.contact_info,
      role: parsed.data.role,
    },
    select: { id: true, email: true, full_name: true, role: true, is_active: true, created_at: true },
  })

  return NextResponse.json(user, { status: 201 })
}
