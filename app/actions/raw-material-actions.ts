'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { RawMaterialCategory, RequestStatus, PurchaseStatus } from "@prisma/client";
import { auth } from "@/lib/auth";

// --- RAW MATERIALS ---

export async function getRawMaterials() {
    try {
        const materials = await prisma.rawMaterial.findMany({
            orderBy: { name: 'asc' }
        });
        return { success: true, data: materials };
    } catch (error) {
        console.error("Error fetching raw materials:", error);
        return { success: false, error: "Hammadde listesi alınamadı." };
    }
}

export async function addRawMaterial(data: { name: string; category: RawMaterialCategory; quantity: number; minQuantity: number; maxQuantity?: number | null; unit: string; supplier?: string | null }) {
    try {
        const newMaterial = await prisma.rawMaterial.create({
            data
        });
        revalidatePath('/dashboard/raw-materials');
        return { success: true, data: newMaterial };
    } catch (error) {
        console.error("Error adding raw material:", error);
        return { success: false, error: "Hammadde eklenemedi." };
    }
}

export async function updateRawMaterial(id: number, data: { name?: string; category?: RawMaterialCategory; quantity?: number; minQuantity?: number; maxQuantity?: number | null; unit?: string; supplier?: string | null }) {
    try {
        const updatedMaterial = await prisma.rawMaterial.update({
            where: { id },
            data
        });
        revalidatePath('/dashboard/raw-materials');
        return { success: true, data: updatedMaterial };
    } catch (error) {
        console.error("Error updating raw material:", error);
        return { success: false, error: "Hammadde güncellenemedi." };
    }
}

export async function deleteRawMaterial(id: number) {
    try {
        await prisma.rawMaterial.delete({
            where: { id }
        });
        revalidatePath('/dashboard/raw-materials');
        return { success: true };
    } catch (error) {
        console.error("Error deleting raw material:", error);
        return { success: false, error: "Hammadde silinemedi." };
    }
}

// --- MATERIAL REQUESTS ---

export async function getMaterialRequests() {
    try {
        const requests = await prisma.materialRequest.findMany({
            include: {
                rawMaterial: true,
                requester: { select: { username: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        return { success: true, data: requests };
    } catch (error) {
        console.error("Error fetching material requests:", error);
        return { success: false, error: "Malzeme talepleri alınamadı." };
    }
}

export async function createMaterialRequest(data: { rawMaterialId: number; quantity: number; requesterId: number; department: string; notes?: string }) {
    try {
        const newRequest = await prisma.materialRequest.create({
            data
        });
        revalidatePath('/dashboard/raw-materials');
        // İlgili departman sayfasını da revalidate etmek iyi olabilir (örn: /dashboard/iskelet)
        return { success: true, data: newRequest };
    } catch (error) {
        console.error("Error creating material request:", error);
        return { success: false, error: "Malzeme talebi oluşturulamadı." };
    }
}

export async function updateMaterialRequestStatus(id: number, status: RequestStatus, rawMaterialId?: number, quantityToDeduct?: number) {
    try {
        // Eğer talep onaylanıyorsa, stoktan düşelim.
        if (status === 'APPROVED' && rawMaterialId && quantityToDeduct) {
            
            const session = await auth();
            const userId = session?.user && (session.user as any).id ? parseInt((session.user as any).id) : 1;

            await prisma.$transaction([
                prisma.materialRequest.update({ where: { id }, data: { status } }),
                prisma.rawMaterial.update({
                    where: { id: rawMaterialId },
                    data: { quantity: { decrement: quantityToDeduct } }
                }),
                (prisma as any).rawMaterialLog.create({
                    data: {
                        rawMaterialId,
                        type: "OUT",
                        quantity: quantityToDeduct,
                        userId,
                        note: "Üretim Talebi Karşılandı"
                    }
                })
            ]);
        } else {
            // Sadece status güncellenecek
            await prisma.materialRequest.update({
                where: { id },
                data: { status }
            });
        }
        revalidatePath('/dashboard/raw-materials');
        return { success: true };
    } catch (error) {
        console.error("Error updating material request status:", error);
        return { success: false, error: "Talep durumu güncellenemedi." };
    }
}

// --- PURCHASE REQUESTS ---

// --- GİRDİ / ÇIKTI HAREKETLERİ (LOGS) ---

export async function addRawMaterialLog(data: { rawMaterialId: number; type: "IN" | "OUT"; quantity: number; note?: string }) {
    const session = await auth();
    if (!session) return { success: false, error: "Yetkisiz işlem." };

    const userId = parseInt((session.user as any).id);

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Log oluştur
            await (tx as any).rawMaterialLog.create({
                data: {
                    rawMaterialId: data.rawMaterialId,
                    type: data.type,
                    quantity: data.quantity,
                    userId,
                    note: data.note || (data.type === "IN" ? "Manuel Giriş" : "Manuel Çıkış")
                }
            });

            // 2. Stoğu güncelle
            const operation = data.type === "IN" ? { increment: data.quantity } : { decrement: data.quantity };
            await tx.rawMaterial.update({
                where: { id: data.rawMaterialId },
                data: { quantity: operation }
            });
        });

        revalidatePath('/dashboard/raw-materials');
        return { success: true };
    } catch (error) {
        console.error("Error adding raw material log:", error);
        return { success: false, error: "Stok hareketi kaydedilemedi." };
    }
}

export async function getRawMaterialLogs() {
    try {
        const logs = await (prisma as any).rawMaterialLog.findMany({
            include: {
                rawMaterial: true,
                user: { select: { username: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 500 // Son 500 hareketi göster
        });
        return { success: true, data: logs };
    } catch (error) {
        console.error("Error fetching logs:", error);
        return { success: false, error: "Hareket geçmişi alınamadı." };
    }
}

export async function getPurchaseRequests() {
    try {
        const purchases = await prisma.purchaseRequest.findMany({
            include: {
                creator: { select: { username: true } },
                items: {
                    include: { rawMaterial: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return { success: true, data: purchases };
    } catch (error) {
        console.error("Error fetching purchase requests:", error);
        return { success: false, error: "Satın alma talepleri alınamadı." };
    }
}

export async function createPurchaseRequest(creatorId: number, items: { rawMaterialId: number; quantity: number }[], priority: string = "NORMAL", notes?: string) {
    try {
        const newPurchase = await prisma.purchaseRequest.create({
            data: {
                creatorId,
                priority,
                notes,
                items: {
                    create: items
                }
            }
        });
        revalidatePath('/dashboard/raw-materials');
        return { success: true, data: newPurchase };
    } catch (error) {
        console.error("Error creating purchase request:", error);
        return { success: false, error: "Satın alma talebi oluşturulamadı." };
    }
}

export async function updatePurchaseRequestStatus(id: number, status: PurchaseStatus, itemsToReceive?: { rawMaterialId: number; quantity: number }[]) {
    try {
        // Eğer teslim alındıysa (DELIVERED), stoklara ekleyelim
        if (status === 'DELIVERED' && itemsToReceive && itemsToReceive.length > 0) {
            
            const session = await auth();
            const userId = session?.user && (session.user as any).id ? parseInt((session.user as any).id) : 1;

            const transactionOperations = itemsToReceive.map(item =>
                prisma.rawMaterial.update({
                    where: { id: item.rawMaterialId },
                    data: { quantity: { increment: item.quantity } }
                })
            );

            // Girdi loglarını da ekleyelim
            itemsToReceive.forEach(item => {
                transactionOperations.push(
                    (prisma as any).rawMaterialLog.create({
                        data: {
                            rawMaterialId: item.rawMaterialId,
                            type: "IN",
                            quantity: item.quantity,
                            userId,
                            note: "Satınalma Teslim Alındı"
                        }
                    })
                );
            });

            transactionOperations.push(
                prisma.purchaseRequest.update({ where: { id }, data: { status } }) as any
            );

            await prisma.$transaction(transactionOperations);
        } else {
            // Sadece status güncelle
            await prisma.purchaseRequest.update({
                where: { id },
                data: { status }
            });
        }

        revalidatePath('/dashboard/raw-materials');
        return { success: true };
    } catch (error) {
        console.error("Error updating purchase request status:", error);
        return { success: false, error: "Satın alma durumu güncellenemedi." };
    }
}

// Stok miktarı değiştirmeden sadece DELIVERED olarak kapat (RAW_MATERIAL depo kullanıcısı için)
export async function closePurchaseRequestDelivered(id: number) {
    try {
        await prisma.purchaseRequest.update({
            where: { id },
            data: { status: "DELIVERED" as PurchaseStatus }
        });
        revalidatePath('/dashboard/raw-materials');
        return { success: true };
    } catch (error) {
        console.error("Error closing purchase request:", error);
        return { success: false, error: "İşlem tamamlanamadı." };
    }
}

// --- EXCEL IMPORT (BULK SYNC) ---

export async function importRawMaterialsFromExcel(data: any[][], category: RawMaterialCategory) {
    if (!data || data.length < 2) return { success: false, error: "Dosya boş veya beklenen formatta değil." };

    try {
        // Hedera satırını bulalım (Genelde 'STOK ADI', 'ÜRÜN ADI', 'İSİM' gibi başlıklar içeren satır)
        let headerRowIndex = 0;
        let nameColIndex = -1;
        let qtyColIndex = -1;
        let minColIndex = -1;
        let maxColIndex = -1;
        let unitColIndex = -1;

        for (let i = 0; i < Math.min(10, data.length); i++) {
            const row = data[i];
            if (!Array.isArray(row)) continue;

            for (let j = 0; j < row.length; j++) {
                const cell = String(row[j] || "").toUpperCase().trim();

                // İsim Kolonu Eşleştirme
                if (cell.includes("STOK ADI") || cell.includes("ÜRÜN ADI") || cell.includes("ÜRÜN CİNSİ") || cell === "ADI" || cell === "İSİM" || cell === "CİNSİ") {
                    nameColIndex = j;
                    headerRowIndex = i;
                }

                // Miktar Eşleştirme (KALAN, KALAN STOK, MİKTAR vb.)
                if (cell === "KALAN" || cell === "KALAN STOK" || cell === "MİKTAR" || cell === "STOK MİKTARI") {
                    qtyColIndex = j;
                }

                // Min / Max Eşleştirme
                if (cell.includes("MİNİMUN") || cell.includes("MİNİMUM") || cell === "MİN") {
                    minColIndex = j;
                }
                if (cell.includes("MAKSİMUN") || cell.includes("MAXSİMUN") || cell.includes("MAKSİMUM")) {
                    maxColIndex = j;
                }

                // Birim Eşleştirme
                if (cell === "BİRİM" || cell.includes("br")) {
                    unitColIndex = j;
                }
            }

            if (nameColIndex !== -1 && qtyColIndex !== -1) {
                break; // Header bulundu, daha fazla aramaya gerek yok.
            }
        }

        if (nameColIndex === -1) {
            return { success: false, error: "Excel dosyasında 'STOK ADI' veya 'ÜRÜN ADI' kolonu bulunamadı." };
        }

        // Eğer QTY kolonu bulunamadıysa bile varsayılan bir tanesini Miktar olarak atayalım
        if (qtyColIndex === -1) {
            qtyColIndex = nameColIndex + 1; // Genelde isimden sonra gelir diye varsayıyoruz. 
        }

        let createdCount = 0;
        let updatedCount = 0;

        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i];
            if (!Array.isArray(row) || row.length === 0) continue;

            const rawName = String(row[nameColIndex] || "").trim();
            if (!rawName || rawName === "" || rawName === "-- --") continue; // Boş isimleri atla

            // Temizlik (Baştaki "ZZ." "H " vb takıları veya istenmeyenleri ayıklayabiliriz, ama şimdilik orijinali tutalım)
            const name = rawName;

            // Eğer string parse edilemezse fallback değerleri atayalım
            const parseNum = (val: any, fallback: number | null = 0) => {
                if (val === undefined || val === null || val === "") return fallback;
                const parsed = Number(val);
                return isNaN(parsed) ? fallback : parsed;
            };

            const quantity = parseNum(row[qtyColIndex], 0) as number;
            const minQuantity = minColIndex !== -1 ? (parseNum(row[minColIndex], 100) as number) : 100;
            const maxQuantity = maxColIndex !== -1 ? parseNum(row[maxColIndex], null) : null;

            // Birim bul
            let unit = "Adet";
            if (unitColIndex !== -1 && row[unitColIndex]) {
                unit = String(row[unitColIndex]).trim();
            } 
            
            // Kategoriye göre varsayılan / zorunlu birim atamaları
            if (category === "KUMAS" || category === "DERI") {
                unit = "Metre"; // Kumaş ve Deri kategorilerinde birim daima Metre olsun
            } else if (category === "SUNGER" && (!row[unitColIndex] || unit === "Adet")) {
                unit = "Plaka";
            }

            // DB'de var mı kontrol et
            const existing = await prisma.rawMaterial.findFirst({
                where: { name }
            });

            if (existing) {
                await prisma.rawMaterial.update({
                    where: { id: existing.id },
                    data: {
                        quantity,
                        minQuantity,
                        maxQuantity,
                        // Kategori ve Birimi de üzerine ezebiliriz ama kullanıcının atadığı kalsın diyorsak güncellemeyebiliriz.
                        // Biz şimdilik yenisiyle eziyoruz.
                        category,
                        unit
                    }
                });
                updatedCount++;
            } else {
                await prisma.rawMaterial.create({
                    data: {
                        name,
                        category,
                        quantity,
                        minQuantity,
                        maxQuantity,
                        unit
                    }
                });
                createdCount++;
            }
        }

        revalidatePath('/dashboard/raw-materials');
        return { success: true, created: createdCount, updated: updatedCount };
    } catch (error: any) {
        console.error("Error importing raw materials from excel:", error);
        return { success: false, error: error.message || "Excel içe aktarma sırasında hata oluştu." };
    }
}
