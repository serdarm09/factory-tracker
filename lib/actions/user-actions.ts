'use server';

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { createAuditLog } from "./shared";

export async function createUser(prevState: any, formData: FormData) {
    const session = await auth();
    if (!session || !session.user || (session.user as any).role !== "ADMIN") return { error: "Yetkisiz işlem" };

    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as string;

    if (!username || !password || !role) return { error: "Eksik alanlar" };

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) return { error: "Bu kullanıcı adı zaten kullanılıyor." };

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const newUser = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                role
            }
        });

        await createAuditLog("CREATE", "User", username, `User created with role: ${role}`, parseInt((session.user as any).id));

        revalidatePath("/dashboard/admin/users");
        return { success: true };
    } catch (e) {
        return { error: "Kullanıcı oluşturulurken bir hata oluştu." };
    }
}

export async function deleteUser(id: number) {
    const session = await auth();
    if (!session || !session.user || (session.user as any).role !== "ADMIN") return { error: "Yetkisiz işlem" };

    const currentUserId = parseInt((session.user as any).id);
    if (currentUserId === id) {
        return { error: "Kendi hesabınızı silemezsiniz." };
    }

    try {
        const userToDelete = await prisma.user.findUnique({ where: { id } });
        if (!userToDelete) {
            return { error: "Kullanıcı bulunamadı" };
        }

        // Kullanıcıyı silme yerine pasif yap (foreign key sorunlarını önlemek için)
        const timestamp = Date.now();
        await prisma.user.update({
            where: { id },
            data: {
                username: `_deleted_${timestamp}_${id}`,
                password: 'DELETED_USER_NO_ACCESS_' + timestamp
            }
        });

        await createAuditLog("DELETE", "User", userToDelete.username, `User deactivated`, currentUserId);

        revalidatePath("/dashboard/admin/users");
        return { success: true };
    } catch (e) {
        console.error("User delete error:", e);
        return { error: "Silinirken hata oluştu." };
    }
}

export async function changeUserPassword(userId: number, newPassword: string) {
    const session = await auth();
    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
        return { error: "Yetkisiz işlem" };
    }

    if (!newPassword || newPassword.length < 4) {
        return { error: "Şifre en az 4 karakter olmalıdır" };
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const user = await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        const currentUserId = parseInt((session.user as any).id);
        await createAuditLog("UPDATE", "User", user.username, `Password changed by admin`, currentUserId);

        revalidatePath("/dashboard/admin/users");
        return { success: true };
    } catch (e) {
        return { error: "Şifre değiştirilirken hata oluştu" };
    }
}
