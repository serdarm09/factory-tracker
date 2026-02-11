'use server';

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getNotifications() {
    const session = await auth();
    if (!session) return [];

    const role = (session.user as any).role;
    // Sadece admin bildirimleri görebilir
    if (role !== "ADMIN") return [];

    try {
        const notifications = await (prisma as any).notification.findMany({
            orderBy: { createdAt: "desc" },
            take: 50
        });
        return notifications;
    } catch (e) {
        console.error("Get notifications error:", e);
        return [];
    }
}

export async function getUnreadNotificationCount() {
    const session = await auth();
    if (!session) return 0;

    const role = (session.user as any).role;
    if (role !== "ADMIN") return 0;

    try {
        const count = await (prisma as any).notification.count({
            where: { isRead: false }
        });
        return count;
    } catch (e) {
        console.error("Get unread count error:", e);
        return 0;
    }
}

export async function markNotificationAsRead(id: number) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz" };

    try {
        await (prisma as any).notification.update({
            where: { id },
            data: { isRead: true }
        });
        revalidatePath("/dashboard");
        return { success: true };
    } catch (e) {
        return { error: "İşlem başarısız" };
    }
}

export async function markAllNotificationsAsRead() {
    const session = await auth();
    if (!session) return { error: "Yetkisiz" };

    try {
        await (prisma as any).notification.updateMany({
            where: { isRead: false },
            data: { isRead: true }
        });
        revalidatePath("/dashboard");
        return { success: true };
    } catch (e) {
        return { error: "İşlem başarısız" };
    }
}

export async function deleteNotification(id: number) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz" };

    try {
        await (prisma as any).notification.delete({
            where: { id }
        });
        revalidatePath("/dashboard");
        return { success: true };
    } catch (e) {
        return { error: "İşlem başarısız" };
    }
}
