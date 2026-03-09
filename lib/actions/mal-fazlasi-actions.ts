"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getMalFazlasiList(category?: string) {
    try {
        return await prisma.konfeksiyonMalFazlasi.findMany({
            where: category ? { category } : undefined,
            orderBy: { createdAt: "desc" }
        });
    } catch {
        return [];
    }
}

export async function addMalFazlasi(data: {
    productName: string;
    model?: string;
    company?: string;
    quantity: number;
    description?: string;
    master?: string;
    category?: string;
}) {
    try {
        await prisma.konfeksiyonMalFazlasi.create({
            data: {
                ...data,
                category: data.category || "KONFEKSIYON",
            }
        });
        revalidatePath("/dashboard/semi-finished-production");
        return { success: true };
    } catch (error) {
        console.error("Error adding mal fazlasi:", error);
        return { error: "Kayıt eklenirken hata oluştu" };
    }
}

export async function deleteMalFazlasi(id: number) {
    try {
        await prisma.konfeksiyonMalFazlasi.delete({ where: { id } });
        revalidatePath("/dashboard/semi-finished-production");
        return { success: true };
    } catch (error) {
        console.error("Error deleting mal fazlasi:", error);
        return { error: "Silme sırasında hata oluştu" };
    }
}

export async function updateMalFazlasiQty(id: number, quantity: number) {
    try {
        if (quantity <= 0) {
            await prisma.konfeksiyonMalFazlasi.delete({ where: { id } });
        } else {
            await prisma.konfeksiyonMalFazlasi.update({ where: { id }, data: { quantity } });
        }
        revalidatePath("/dashboard/semi-finished-production");
        return { success: true };
    } catch (error) {
        console.error("Error updating mal fazlasi qty:", error);
        return { error: "Güncelleme sırasında hata oluştu" };
    }
}
