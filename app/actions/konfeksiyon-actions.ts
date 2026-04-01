"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function addKonfeksiyonStock({
    name,
    type,
    quantity,
    unit,
    colorCode,
    note
}: {
    name: string;
    type: "KUMAS" | "DERI" | "DIGER";
    quantity: number;
    unit: string;
    colorCode?: string;
    note?: string;
}) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz işlem" };

    try {
        await (prisma as any).konfeksiyonStock.create({
            data: {
                name,
                type,
                quantity,
                unit,
                colorCode: colorCode || null,
                note: note || null
            }
        });
        revalidatePath("/dashboard/semi-finished-production/konfeksiyon");
        return { success: true };
    } catch (error) {
        console.error("Kumaş/Deri ekleme hatası:", error);
        return { error: "Kayıt sırasında hata oluştu." };
    }
}

export async function updateKonfeksiyonStock(id: number, data: Partial<{
    name: string;
    type: "KUMAS" | "DERI" | "DIGER";
    quantity: number;
    unit: string;
    colorCode: string | null;
    note: string | null;
}>) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz işlem" };

    try {
        await (prisma as any).konfeksiyonStock.update({
            where: { id },
            data
        });
        revalidatePath("/dashboard/semi-finished-production/konfeksiyon");
        return { success: true };
    } catch (error) {
        console.error("Kumaş/Deri güncelleme hatası:", error);
        return { error: "Güncelleme sırasında hata oluştu." };
    }
}

export async function deleteKonfeksiyonStock(id: number) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz işlem" };

    // Konfeksiyon deposundan silme işlemini yetkiye bağlayabiliriz
    const role = (session.user as any).role;
    if (!["ADMIN", "PLANNER", "KONFEKSIYON"].includes(role)) {
        return { error: "Bu işlemi yapmaya yetkiniz yok." };
    }

    try {
        await (prisma as any).konfeksiyonStock.delete({
            where: { id }
        });
        revalidatePath("/dashboard/semi-finished-production/konfeksiyon");
        return { success: true };
    } catch (error) {
        console.error("Kumaş/Deri silme hatası:", error);
        return { error: "Silinirken hata oluştu." };
    }
}

export async function importKonfeksiyonStockFromExcel(data: any[][], type: "KUMAS" | "DERI" | "DIGER") {
    if (!data || data.length < 2) return { success: false, error: "Dosya boş veya format hatalı." };

    try {
        let headerRowIndex = 0;
        let nameColIndex = -1;
        let qtyColIndex = -1;
        let colorColIndex = -1;
        let unitColIndex = -1;

        // Header detection
        for (let i = 0; i < Math.min(10, data.length); i++) {
            const row = data[i];
            if (!Array.isArray(row)) continue;

            for (let j = 0; j < row.length; j++) {
                const cell = String(row[j] || "").toUpperCase().trim();
                
                if (cell.includes("STOK ADI") || cell.includes("ÜRÜN ADI") || cell.includes("KUMAŞ") || cell.includes("DERİ") || cell === "ADI" || cell === "İSİM" || cell.includes("CİNSİ")) {
                    nameColIndex = j;
                    headerRowIndex = i;
                }
                if (cell === "KALAN" || cell === "KALAN STOK" || cell === "MİKTAR" || cell === "STOK MİKTARI" || cell === "METRAJ") {
                    qtyColIndex = j;
                }
                if (cell.includes("RENK") || cell.includes("KOD") || cell.includes("PARTİ")) {
                    colorColIndex = j;
                }
                if (cell === "BİRİM" || cell.includes("BR")) {
                    unitColIndex = j;
                }
            }

            if (nameColIndex !== -1 && qtyColIndex !== -1) break;
        }

        if (nameColIndex === -1) {
            return { success: false, error: "Excel'de 'Adı/Cinsi/Stok Adı' kolonu bulunamadı." };
        }
        if (qtyColIndex === -1) {
            qtyColIndex = nameColIndex + 1; // Fallback
        }

        let createdCount = 0;
        let updatedCount = 0;

        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i];
            if (!Array.isArray(row) || row.length === 0) continue;

            const name = String(row[nameColIndex] || "").trim();
            if (!name || name === "" || name === "-- --") continue;

            const parseNum = (val: any) => {
                const parsed = Number(val);
                return isNaN(parsed) ? 0 : parsed;
            };

            const quantity = parseNum(row[qtyColIndex]);
            const colorCode = colorColIndex !== -1 ? String(row[colorColIndex] || "").trim() : null;
            let unit = "Metre";
            if (unitColIndex !== -1 && row[unitColIndex]) {
                unit = String(row[unitColIndex]).trim();
            } else if (type === "KUMAS" || type === "DERI") {
                unit = "Metre";
            } else {
                unit = "Adet";
            }

            const existing = await (prisma as any).konfeksiyonStock.findFirst({
                where: { name }
            });

            if (existing) {
                await (prisma as any).konfeksiyonStock.update({
                    where: { id: existing.id },
                    data: { quantity, type, unit, colorCode }
                });
                updatedCount++;
            } else {
                await (prisma as any).konfeksiyonStock.create({
                    data: { name, quantity, type, unit, colorCode }
                });
                createdCount++;
            }
        }

        revalidatePath("/dashboard/semi-finished-production/konfeksiyon");
        return { success: true, created: createdCount, updated: updatedCount };
    } catch (error: any) {
        console.error("Konfeksiyon Excel Import error:", error);
        return { success: false, error: "Hata oluştu: " + error.message };
    }
}

