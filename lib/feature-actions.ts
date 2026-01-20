"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

export type FeatureCategory = 'FOOT_TYPE' | 'FOOT_MATERIAL' | 'ARM_TYPE' | 'BACK_TYPE' | 'FABRIC_TYPE' | 'MODEL' | 'MASTER' | 'MATERIAL';

export async function getFeatures(category: FeatureCategory) {
    return await prisma.productFeature.findMany({
        where: { category: category as any },
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
            where: { category: category as any, name: { equals: name.trim() } }
        });

        if (existing) return { error: "Bu özellik zaten mevcut" };

        await prisma.productFeature.create({
            data: {
                category: category as any,
                name: name.trim()
            }
        });

        // Log
        try {
            const userId = parseInt((session?.user as any).id);
            await prisma.auditLog.create({
                data: { action: "CREATE_FEATURE", entity: "Feature", entityId: name, userId, details: `Category: ${category}` }
            });
        } catch (e) { }

        revalidatePath("/dashboard/admin/features");
        revalidatePath("/dashboard/planning"); // Update planning form too
        return { success: true };
    } catch (e) {
        console.error("Add feature error:", e);
        return { error: "Ekleme sırasında hata oluştu" };
    }
}

export async function deleteFeature(category: FeatureCategory, id: number) {
    const session = await auth();
    const currentUserRole = (session?.user as any)?.role;
    const currentUserId = parseInt((session?.user as any).id);

    if (currentUserRole !== "ADMIN") {
        return { error: "Sadece yöneticiler silebilir" };
    }



    try {
        const feat = await prisma.productFeature.delete({ where: { id } });

        // Log
        try {
            await prisma.auditLog.create({
                data: { action: "DELETE_FEATURE", entity: "Feature", entityId: feat.name, userId: currentUserId, details: `Category: ${category}` }
            });
        } catch (e) { }

        revalidatePath("/dashboard/admin/features");
        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (e) {
        return { error: "Silme sırasında hata oluştu" };
    }
}
