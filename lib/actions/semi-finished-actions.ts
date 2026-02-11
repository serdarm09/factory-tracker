'use server';

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "./shared";

export async function createSemiFinished(formData: FormData) {
    const session = await auth();
    if (!session || !["ADMIN", "PLANNER"].includes((session.user as any).role)) {
        return { error: "Yetkisiz işlem" };
    }

    const code = formData.get("code") as string;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const quantity = parseInt(formData.get("quantity") as string) || 0;
    const minStock = parseInt(formData.get("minStock") as string) || 10;
    const unit = (formData.get("unit") as string) || "adet";
    const category = formData.get("category") as string;
    const location = formData.get("location") as string;

    if (!code || !name) {
        return { error: "Kod ve ad zorunludur" };
    }

    try {
        await (prisma as any).semiFinished.create({
            data: {
                code,
                name,
                description: description || null,
                quantity,
                minStock,
                unit,
                category: category || null,
                location: location || null
            }
        });

        const userId = parseInt((session.user as any).id);
        await createAuditLog("CREATE", "SemiFinished", code, `Yarı mamül oluşturuldu: ${name}`, userId);

        revalidatePath("/dashboard/semi-finished");
        return { success: true };
    } catch (e: any) {
        if (e.code === 'P2002') {
            return { error: "Bu kod zaten kullanılıyor" };
        }
        console.error(e);
        return { error: "Oluşturulurken hata oluştu" };
    }
}

export async function updateSemiFinished(id: number, formData: FormData) {
    const session = await auth();
    if (!session || !["ADMIN", "PLANNER"].includes((session.user as any).role)) {
        return { error: "Yetkisiz işlem" };
    }

    const code = formData.get("code") as string;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const quantity = parseInt(formData.get("quantity") as string) || 0;
    const minStock = parseInt(formData.get("minStock") as string) || 10;
    const unit = (formData.get("unit") as string) || "adet";
    const category = formData.get("category") as string;
    const location = formData.get("location") as string;

    if (!code || !name) {
        return { error: "Kod ve ad zorunludur" };
    }

    try {
        await (prisma as any).semiFinished.update({
            where: { id },
            data: {
                code,
                name,
                description: description || null,
                quantity,
                minStock,
                unit,
                category: category || null,
                location: location || null
            }
        });

        const userId = parseInt((session.user as any).id);
        await createAuditLog("UPDATE", "SemiFinished", code, `Yarı mamül güncellendi: ${name}`, userId);

        revalidatePath("/dashboard/semi-finished");
        return { success: true };
    } catch (e: any) {
        if (e.code === 'P2002') {
            return { error: "Bu kod zaten kullanılıyor" };
        }
        console.error(e);
        return { error: "Güncellenirken hata oluştu" };
    }
}

export async function deleteSemiFinished(id: number) {
    const session = await auth();
    if (!session || !["ADMIN"].includes((session.user as any).role)) {
        return { error: "Yetkisiz işlem" };
    }

    try {
        const item = await (prisma as any).semiFinished.findUnique({ where: { id } });
        if (!item) return { error: "Bulunamadı" };

        // İlgili logları sil
        await (prisma as any).semiFinishedLog.deleteMany({ where: { semiFinishedId: id } });
        await (prisma as any).semiFinished.delete({ where: { id } });

        const userId = parseInt((session.user as any).id);
        await createAuditLog("DELETE", "SemiFinished", item.code, `Yarı mamül silindi: ${item.name}`, userId);

        revalidatePath("/dashboard/semi-finished");
        return { success: true };
    } catch (e) {
        console.error(e);
        return { error: "Silinirken hata oluştu" };
    }
}

export async function updateSemiFinishedStock(
    id: number,
    type: "IN" | "OUT",
    quantity: number,
    note?: string
) {
    const session = await auth();
    if (!session || !["ADMIN", "PLANNER", "WORKER"].includes((session.user as any).role)) {
        return { error: "Yetkisiz işlem" };
    }

    if (quantity <= 0) {
        return { error: "Miktar 0'dan büyük olmalı" };
    }

    try {
        const item = await (prisma as any).semiFinished.findUnique({ where: { id } });
        if (!item) return { error: "Bulunamadı" };

        if (type === "OUT" && quantity > item.quantity) {
            return { error: `Stokta yeterli miktar yok. Mevcut: ${item.quantity}` };
        }

        const newQuantity = type === "IN" ? item.quantity + quantity : item.quantity - quantity;

        await (prisma as any).$transaction([
            (prisma as any).semiFinished.update({
                where: { id },
                data: { quantity: newQuantity }
            }),
            (prisma as any).semiFinishedLog.create({
                data: {
                    semiFinishedId: id,
                    type,
                    quantity,
                    note: note || null
                }
            })
        ]);

        const userId = parseInt((session.user as any).id);
        const actionType = type === "IN" ? "STOCK_IN" : "STOCK_OUT";
        await createAuditLog(
            actionType,
            "SemiFinished",
            item.code,
            `${type === "IN" ? "Giriş" : "Çıkış"}: ${quantity} ${item.unit}. Yeni stok: ${newQuantity}`,
            userId
        );

        revalidatePath("/dashboard/semi-finished");
        return { success: true };
    } catch (e) {
        console.error(e);
        return { error: "İşlem sırasında hata oluştu" };
    }
}
