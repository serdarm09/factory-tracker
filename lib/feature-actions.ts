"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";

export type FeatureCategory = 'FOOT_TYPE' | 'FOOT_MATERIAL' | 'ARM_TYPE' | 'BACK_TYPE' | 'FABRIC_TYPE';

export async function getFeatures(category: FeatureCategory) {
    return await prisma.productFeature.findMany({
        where: { category },
        orderBy: { name: 'asc' }
    });
}

export async function addFeature(category: FeatureCategory, name: string) {
    const session = await auth();
    // Allow ADMIN and PLANNER to add features
    const role = (session?.user as any)?.role;
    if (role !== "ADMIN" && role !== "PLANNER") {
        return { error: "Yetkisiz işlem" };
    }

    if (!name || name.trim().length === 0) return { error: "İsim boş olamaz" };

    try {
        const existing = await prisma.productFeature.findFirst({
            where: { category, name: { equals: name.trim() } } // SQLite case sensitivity might vary, but basic check
        });

        if (existing) return { error: "Bu özellik zaten mevcut" };

        await prisma.productFeature.create({
            data: {
                category,
                name: name.trim()
            }
        });

        revalidatePath("/dashboard/admin/features");
        revalidatePath("/dashboard/planning"); // Update planning form too
        return { success: true };
    } catch (e) {
        console.error("Add feature error:", e);
        return { error: "Ekleme sırasında hata oluştu" };
    }
}

export async function deleteFeature(id: number) {
    const session = await auth();
    if ((session?.user as any)?.role !== "ADMIN") {
        return { error: "Sadece yöneticiler silebilir" };
    }

    try {
        await prisma.productFeature.delete({ where: { id } });
        revalidatePath("/dashboard/admin/features");
        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (e) {
        return { error: "Silme sırasında hata oluştu" };
    }
}
