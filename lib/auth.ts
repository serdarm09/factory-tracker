import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { authConfig } from "@/auth.config"

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" }
            },
            authorize: async (credentials) => {
                const username = credentials?.username as string
                const password = credentials?.password as string

                if (!username || !password) return null

                const user = await prisma.user.findUnique({
                    where: { username }
                })

                if (!user) return null

                const passwordsMatch = await bcrypt.compare(password, user.password)
                if (!passwordsMatch) return null

                return {
                    id: user.id.toString(),
                    name: user.username,
                    email: "user@factory.local",
                    role: user.role
                }
            }
        })
    ],
    trustHost: true,
    secret: process.env.AUTH_SECRET || "supersecret-dev-key-change-in-prod",
})
