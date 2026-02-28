import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const updateSchema = z.object({
  full_name: z.string().min(1).optional(),
  contact_info: z.string().optional(),
  is_active: z.boolean().optional(),
  password: z.string().min(8).optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.password) {
    data.password_hash = await bcrypt.hash(parsed.data.password, 12)
    delete data.password
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, full_name: true, role: true, is_active: true },
  })

  return NextResponse.json(user)
}
