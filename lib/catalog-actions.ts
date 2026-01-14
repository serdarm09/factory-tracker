"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";

export async function getCatalog() {
    return await (prisma as any).productCatalog.findMany({
        orderBy: { name: 'asc' }
    });
}

export async function addToCatalog(code: string, name: string) {
    const session = await auth();
    const role = (session?.user as any)?.role;

    // Allow ADMIN and PLANNER
    if (role !== "ADMIN" && role !== "PLANNER") {
        return { error: "Yetkisiz işlem" };
    }

    if (!code || code.trim().length === 0) return { error: "Ürün kodu boş olamaz" };
    if (!name || name.trim().length === 0) return { error: "Ürün adı boş olamaz" };

    try {
        const existing = await (prisma as any).productCatalog.findUnique({
            where: { code: code.trim() }
        });

        if (existing) return { error: "Bu ürün kodu zaten kayıtlı" };

        await (prisma as any).productCatalog.create({
            data: {
                code: code.trim(),
                name: name.trim()
            }
        });

        revalidatePath("/dashboard/admin/features");
        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (e) {
        console.error("Add catalog error:", e);
        return { error: "Ekleme sırasında hata oluştu" };
    }
}

export async function deleteFromCatalog(id: number) {
    const session = await auth();
    if ((session?.user as any)?.role !== "ADMIN") {
        return { error: "Sadece yöneticiler silebilir" };
    }

    try {
        await (prisma as any).productCatalog.delete({ where: { id } });
        revalidatePath("/dashboard/admin/features");
        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (e) {
        return { error: "Silme sırasında hata oluştu" };
    }
}
