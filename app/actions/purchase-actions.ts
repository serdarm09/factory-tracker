"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { PurchaseStatus } from "@prisma/client";
import { auth } from "@/lib/auth";

export async function getPurchaseRequests() {
    try {
        return await prisma.purchaseRequest.findMany({
            include: {
                creator: { select: { username: true } },
                items: {
                    include: { rawMaterial: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    } catch (error: any) {
        console.error("Error fetching purchase requests:", error);
        return [];
    }
}

export async function updatePurchaseStatus(id: number, status: PurchaseStatus, extra?: { termDate?: string; orderNotes?: string; supplierToApply?: string }) {
    try {
        const session = await auth();
        const user = session?.user as any;
        
        if (!user || (user.role !== "ADMIN" && user.role !== "PURCHASING" && user.role !== "RAW_MATERIAL")) {
            return { success: false, error: "Yetkisiz işlem." };
        }

        const request = await prisma.purchaseRequest.findUnique({
            where: { id },
            include: { items: { include: { rawMaterial: true } } }
        });

        if (!request) return { success: false, error: "Satın alma talebi bulunamadı." };

        // ORDERED a geçerken termin tarihi zorunlu
        if (status === PurchaseStatus.ORDERED && !extra?.termDate) {
            return { success: false, error: "Sipariş geçebilmek için termin tarihi zorunludur." };
        }

        await prisma.$transaction(async (tx) => {
            // 1. Durum + ek alanları güncelle
            const updateData: any = { status };
            if (status === PurchaseStatus.ORDERED && extra?.termDate) {
                updateData.termDate = new Date(extra.termDate);
                updateData.orderNotes = extra.orderNotes || null;
            }

            await tx.purchaseRequest.update({
                where: { id },
                data: updateData
            });

            // 2. DELIVERED ise stoka ekle ve IN log oluştur
            if (status === PurchaseStatus.DELIVERED && request.status !== PurchaseStatus.DELIVERED) {
                for (const item of request.items) {
                    const isFabricOrLeather = item.rawMaterial.category === "KUMAS" || item.rawMaterial.category === "DERI";
                    const applySupplier = extra?.supplierToApply && isFabricOrLeather;

                    await tx.rawMaterial.update({
                        where: { id: item.rawMaterialId },
                        data: { 
                            quantity: { increment: item.quantity },
                            ...(applySupplier ? { supplier: extra.supplierToApply } : {})
                        }
                    });

                    const noteText = applySupplier 
                        ? `Satın alma teslimatı (Talep ID: ${id}) - Tedarikçi: ${extra.supplierToApply}`
                        : `Satın alma teslimatı (Talep ID: ${id})`;

                    await (tx as any).rawMaterialLog.create({
                        data: {
                            rawMaterialId: item.rawMaterialId,
                            type: "IN",
                            quantity: item.quantity,
                            userId: parseInt(user.id) || 1,
                            note: noteText
                        }
                    });
                }
            }
        });

        revalidatePath("/dashboard/purchases");
        revalidatePath("/dashboard/raw-materials");
        return { success: true };
    } catch (error: any) {
        console.error("Error updating purchase status:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Satın Alma sayfasından manuel olarak yeni PurchaseRequest oluşturur.
 */
export async function createManualPurchaseRequest(data: {
    creatorId: number;
    priority: string;
    notes?: string;
    items: { rawMaterialId: number; quantity: number }[]
}) {
    try {
        if (!data.items || data.items.length === 0) {
            return { success: false, error: "En az 1 kalem eklemelisiniz." };
        }

        const request = await prisma.purchaseRequest.create({
            data: {
                creatorId: data.creatorId,
                priority: data.priority,
                notes: data.notes || null,
                items: {
                    create: data.items.map(i => ({
                        rawMaterialId: i.rawMaterialId,
                        quantity: i.quantity
                    }))
                }
            }
        });

        revalidatePath("/dashboard/purchases");
        revalidatePath("/dashboard/raw-materials");
        return { success: true, data: request };
    } catch (error: any) {
        console.error("Error creating manual purchase request:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Satın alma talebinin termin tarihini (ve notunu) günceller.
 */
export async function updatePurchaseTermDate(id: number, termDate: string, orderNotes?: string) {
    try {
        const session = await auth();
        const user = session?.user as any;
        
        if (!user || (user.role !== "ADMIN" && user.role !== "PURCHASING" && user.role !== "RAW_MATERIAL")) {
            return { success: false, error: "Yetkisiz işlem." };
        }

        const data: any = { termDate: new Date(termDate) };
        if (orderNotes !== undefined) data.orderNotes = orderNotes;

        await prisma.purchaseRequest.update({
            where: { id },
            data
        });

        revalidatePath("/dashboard/purchases");
        revalidatePath("/dashboard/raw-materials");
        return { success: true };
    } catch (error: any) {
        console.error("Error updating purchase term date:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Satın alma talebini iptal eder ve iptal nedenini kaydeder.
 */
export async function cancelPurchaseRequest(id: number, cancelReason: string) {
    try {
        const session = await auth();
        const user = session?.user as any;
        
        if (!user || (user.role !== "ADMIN" && user.role !== "PURCHASING" && user.role !== "RAW_MATERIAL")) {
            return { success: false, error: "Yetkisiz işlem." };
        }

        if (!cancelReason || cancelReason.trim().length === 0) {
            return { success: false, error: "İptal nedeni zorunludur." };
        }

        await prisma.purchaseRequest.update({
            where: { id },
            data: {
                status: PurchaseStatus.CANCELLED,
                cancelReason
            }
        });

        revalidatePath("/dashboard/purchases");
        revalidatePath("/dashboard/raw-materials");
        return { success: true };
    } catch (error: any) {
        console.error("Error cancelling purchase:", error);
        return { success: false, error: error.message };
    }
}
