import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import prisma from './db'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        let user
        try {
          user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase() },
          })
        } catch (err) {
          console.error('[auth] DB error:', err)
          return null
        }

        if (!user || !user.is_active) {
          console.error('[auth] User not found or inactive:', credentials.email)
          return null
        }

        const passwordValid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!passwordValid) {
          console.error('[auth] Password invalid for:', credentials.email)
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.full_name,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as unknown as { role: string }).role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role: string; id: string }).role = token.role as string;
        (session.user as { role: string; id: string }).id = token.id as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
