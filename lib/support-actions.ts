"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";

export async function createSupportTicket(formData: FormData) {
    const session = await auth();
    if (!session?.user) {
        return { error: "Oturum açmanız gerekiyor" };
    }

    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const priority = formData.get("priority") as string;

    if (!title || title.trim().length === 0) return { error: "Başlık gerekli" };
    if (!description || description.trim().length === 0) return { error: "Açıklama gerekli" };

    try {
        await (prisma as any).supportTicket.create({
            data: {
                title: title.trim(),
                description: description.trim(),
                priority: priority || "NORMAL",
                userId: parseInt((session.user as any).id)
            }
        });

        revalidatePath("/dashboard/support");
        revalidatePath("/dashboard/admin/support");
        return { success: true };
    } catch (e) {
        console.error("Create ticket error:", e);
        return { error: "Talep oluşturulurken hata oluştu" };
    }
}

export async function updateTicketStatus(id: number, status: string) {
    const session = await auth();
    if ((session?.user as any)?.role !== "ADMIN") {
        return { error: "Yetkisiz işlem" };
    }

    try {
        await (prisma as any).supportTicket.update({
            where: { id },
            data: { status }
        });

        revalidatePath("/dashboard/support");
        revalidatePath("/dashboard/admin/support");
        return { success: true };
    } catch (e) {
        return { error: "Güncelleme hatası" };
    }
}

export async function deleteTicket(id: number) {
    const session = await auth();
    if ((session?.user as any)?.role !== "ADMIN") {
        return { error: "Yetkisiz işlem" };
    }

    try {
        await (prisma as any).supportTicket.delete({ where: { id } });
        revalidatePath("/dashboard/support");
        revalidatePath("/dashboard/admin/support");
        revalidatePath("/dashboard/admin/users");
        return { success: true };
    } catch (e) {
        return { error: "Silme hatası" };
    }
}
