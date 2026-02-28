import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET() {
  try {
    const users = await prisma.user.findMany({ select: { email: true, is_active: true, role: true } })
    return NextResponse.json({ ok: true, users })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
