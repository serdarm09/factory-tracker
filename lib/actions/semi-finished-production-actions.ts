"use server";

/**
 * semi-finished-production-actions.ts — Yarı Mamül Üretim Action'ları
 *
 * Kategoriler: METAL | KONFEKSIYON | AHSAP_BOYA | AHSAP_ISKELET | PLASTIK | SUNGER_DOKUM
 *
 * Temel akış:
 *  1. sendToSemiFinishedProduction()  — Planlama'dan bir ürünü kategoriye atar
 *     (SemiFinishedProduction kaydı oluşturulur: productId + category benzersiz)
 *  2. updateSemiFinishedProductionQty() — İlgili bölüm kullanıcısı üretilen adedi girer
 *     • Target aşılırsa (Konfeksiyon hariç) fazlası KonfeksiyonMalFazlasi tablosuna yazar
 *     • Tamamlandığında status = COMPLETED, completedAt = now
 *  3. updateSemiFinishedProductionTarget() — Admin hedef miktarını değiştirir
 *  4. updateSemiFinishedSurplusQty()       — Konfeksiyon mal fazlası günceller
 *
 * OCC (Optimistic Concurrency Control):
 *   Her güncelleme fonksiyonu `expectedUpdatedAt` alabilir;
 *   DB'deki updatedAt ile eşleşmiyorsa DATA_MODIFIED hatası döner.
 */

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Belirtilen ürünlerin hangi kategorilere zaten gönderildiğini getir
export async function getExistingSemiFinishedCategories(productIds: number[]) {
    try {
        const existing = await prisma.semiFinishedProduction.findMany({
            where: { productId: { in: productIds } },
            select: { productId: true, category: true }
        });
        // { productId: [category, ...] } haritası döndür
        const map: Record<number, string[]> = {};
        existing.forEach(e => {
            if (!map[e.productId]) map[e.productId] = [];
            map[e.productId].push(e.category);
        });
        return map;
    } catch {
        return {};
    }
}

// Ürünleri yarı mamül üretime gönder
export async function sendToSemiFinishedProduction(data: {
    products: { id: number; quantity: number; description?: string }[];
    categories: string[]; // METAL, KONFEKSIYON, AHSAP_BOYA, AHSAP_ISKELET, PLASTIK, SUNGER_DOKUM
}) {
    try {
        const { products, categories } = data;

        // Fetch original quantities map once to avoid N queries
        const productRecords = await prisma.product.findMany({
            where: { id: { in: products.map(p => p.id) } },
            select: { id: true, quantity: true }
        });
        const qtyMap = new Map<number, number>();
        productRecords.forEach(p => qtyMap.set(p.id, p.quantity));

        // Use transaction to ensure connection efficiency
        await prisma.$transaction(async (tx) => {
            const updatePromises = products
                .filter(p => p.description)
                .map(p => tx.product.update({
                    where: { id: p.id },
                    data: { description: p.description }
                }));

            await Promise.all(updatePromises);

            const upsertPromises: Promise<any>[] = [];
            for (const product of products) {
                const originalQty = qtyMap.get(product.id) ?? product.quantity;

                for (const category of categories) {
                    upsertPromises.push(
                        tx.semiFinishedProduction.upsert({
                            where: {
                                productId_category: {
                                    productId: product.id,
                                    category
                                }
                            },
                            update: {
                                targetQty: originalQty
                            },
                            create: {
                                productId: product.id,
                                category,
                                targetQty: originalQty,
                                producedQty: 0,
                                status: "PENDING"
                            }
                        })
                    );
                }
            }

            await Promise.all(upsertPromises);
        });

        revalidatePath("/dashboard/semi-finished-production");
        revalidatePath("/dashboard/production-planning");

        return { success: true };
    } catch (error) {
        console.error("Error sending to semi-finished production:", error);
        return { error: "Yarı mamül üretime gönderilirken hata oluştu" };
    }
}

// Kategori bazında ürünleri getir
export async function getSemiFinishedProductionByCategory(category: string) {
    try {
        const items = await prisma.semiFinishedProduction.findMany({
            where: { category },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        model: true,
                        description: true,
                        dstAdi: true,
                        master: true, // Usta bilgisi
                        aciklama1: true,
                        aciklama2: true,
                        aciklama3: true,
                        aciklama4: true,
                        terminDate: true,
                        order: {
                            select: {
                                name: true,
                                company: true,
                                customerName: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return items;
    } catch (error) {
        console.error("Error fetching semi-finished production:", error);
        return [];
    }
}

// Worker'ın üretim miktarını güncelle
export async function updateSemiFinishedProductionQty(id: number, producedQty: number, expectedUpdatedAt?: Date) {
    try {
        const item = await prisma.semiFinishedProduction.findUnique({
            where: { id }
        });

        if (!item) {
            return { error: "Kayıt bulunamadı" };
        }

        // Optimistic Concurrency Control Check
        if (expectedUpdatedAt && item.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
            return { error: "DATA_MODIFIED", message: "Bu kayıt başka bir kullanıcı tarafından değiştirildi. Lütfen sayfayı yenileyin." };
        }

        let status = "PENDING";
        let completedAt = null;
        let finalProducedQty = producedQty;
        let additionalSurplus = 0;

        // Otomatik mal fazlası hesaplama (Konfeksiyon hariç)
        if (item.category !== "KONFEKSIYON" && producedQty > item.targetQty) {
            additionalSurplus = producedQty - item.targetQty;
            finalProducedQty = item.targetQty;
        }

        if (finalProducedQty > 0 && finalProducedQty < item.targetQty) {
            status = "IN_PROGRESS";
        } else if (finalProducedQty >= item.targetQty) {
            status = "COMPLETED";
            completedAt = new Date();
        }

        await prisma.$transaction(async (tx) => {
            // Asıl tabloyu güncelle
            await tx.semiFinishedProduction.update({
                where: { id },
                data: {
                    producedQty: finalProducedQty,
                    status,
                    ...(completedAt ? { completedAt } : {}),
                    updatedAt: new Date()
                }
            });

            // Fazlalık varsa "Mal Fazlası" tablosuna ayrı bir kayıt at
            if (additionalSurplus > 0) {
                // Ekstra ürün bilgilerini almak için
                const product = await tx.product.findUnique({
                    where: { id: item.productId },
                    select: { name: true, model: true, master: true, order: { select: { company: true } } }
                });

                if (product) {
                    await tx.konfeksiyonMalFazlasi.create({
                        data: {
                            productName: product.name,
                            model: product.model,
                            company: product.order?.company,
                            quantity: additionalSurplus,
                            category: item.category,
                            master: product.master,
                            description: "Otomatik üretim fazlası"
                        }
                    });
                }
            }
        });

        // Yarı mamül tamamlandıysa ve ürünün storedQty'si varsa:
        // producedQty <= storedQty ise storedQty'yi üzerine yaz (ekleme, set yap)
        // producedQty > storedQty ise dokunma
        if (status === "COMPLETED") {
            const product = await prisma.product.findUnique({
                where: { id: item.productId },
                select: { storedQty: true }
            });
            const currentStoredQty = product?.storedQty ?? 0;

            if (currentStoredQty > 0 && producedQty <= currentStoredQty) {
                await prisma.product.update({
                    where: { id: item.productId },
                    data: { storedQty: producedQty }
                });
            }
            // producedQty > currentStoredQty ise dokunma
        }

        revalidatePath("/dashboard/semi-finished-production");
        return { success: true };
    } catch (error) {
        console.error("Error updating semi-finished production qty:", error);
        return { error: "Güncelleme sırasında hata oluştu" };
    }
}

// Admin'in hedef miktarını güncelle
export async function updateSemiFinishedProductionTarget(id: number, targetQty: number, expectedUpdatedAt?: Date) {
    try {
        const item = await prisma.semiFinishedProduction.findUnique({
            where: { id }
        });

        if (!item) {
            return { error: "Kayıt bulunamadı" };
        }

        // Optimistic Concurrency Control Check
        if (expectedUpdatedAt && item.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
            return { error: "DATA_MODIFIED", message: "Bu kayıt başka bir kullanıcı tarafından değiştirildi. Lütfen sayfayı yenileyin." };
        }

        if (targetQty < item.producedQty) {
            return { error: "Hedef miktar, üretilen miktardan az olamaz" };
        }

        // Status güncelle
        let status = "PENDING";
        let completedAt = null;
        if (item.producedQty > 0 && item.producedQty < targetQty) {
            status = "IN_PROGRESS";
        } else if (item.producedQty >= targetQty) {
            status = "COMPLETED";
            completedAt = new Date();
        }

        await prisma.semiFinishedProduction.update({
            where: { id },
            data: {
                targetQty,
                status,
                ...(completedAt ? { completedAt } : {}),
                updatedAt: new Date()
            }
        });

        revalidatePath("/dashboard/semi-finished-production");
        return { success: true };
    } catch (error) {
        console.error("Error updating semi-finished production target:", error);
        return { error: "Hedef güncelleme sırasında hata oluştu" };
    }
}

// Mal fazlası miktarını güncelle (sadece konfeksiyon için)
export async function updateSemiFinishedSurplusQty(id: number, surplusQty: number) {
    try {
        if (surplusQty < 0) {
            return { error: "Mal fazlası miktarı negatif olamaz" };
        }

        await prisma.semiFinishedProduction.update({
            where: { id },
            data: { surplusQty, updatedAt: new Date() }
        });

        revalidatePath("/dashboard/semi-finished-production");
        return { success: true };
    } catch (error) {
        console.error("Error updating surplus qty:", error);
        return { error: "Mal fazlası güncellenirken hata oluştu" };
    }
}

// Admin'in üretimden kaldırması
export async function removeSemiFinishedProduction(id: number) {
    try {
        await prisma.semiFinishedProduction.delete({
            where: { id }
        });

        revalidatePath("/dashboard/semi-finished-production");
        return { success: true };
    } catch (error) {
        console.error("Error removing semi-finished production:", error);
        return { error: "Silme sırasında hata oluştu" };
    }
}

// Tüm kategoriler için özet
export async function getSemiFinishedProductionSummary() {
    try {
        const categories = ["METAL", "KONFEKSIYON", "AHSAP_BOYA", "AHSAP_ISKELET", "PLASTIK", "SUNGER_DOKUM"];
        const summary = await Promise.all(
            categories.map(async (category) => {
                const items = await prisma.semiFinishedProduction.findMany({
                    where: { category }
                });

                const total = items.length;
                const completed = items.filter(i => i.status === "COMPLETED").length;
                const inProgress = items.filter(i => i.status === "IN_PROGRESS").length;
                const pending = items.filter(i => i.status === "PENDING").length;

                return {
                    category,
                    total,
                    completed,
                    inProgress,
                    pending
                };
            })
        );

        return summary;
    } catch (error) {
        console.error("Error fetching summary:", error);
        return [];
    }
}

// Manuel ürün ekleme (yarı mamül üretim için)
export async function addManualSemiFinishedProduction(data: {
    productName: string;
    model: string;
    orderName?: string;
    company?: string;
    description?: string;
    category: string;
    targetQty: number;
}) {
    try {
        const { productName, model, orderName, company, description, category, targetQty } = data;

        // Önce Product oluştur (order olmadan)
        const product = await prisma.product.create({
            data: {
                name: productName,
                model,
                sku: `MANUAL-${Date.now()}`,
                quantity: targetQty,
                systemCode: `MAN-${Date.now()}`,
                status: "IN_PRODUCTION",
                orderDate: new Date(),
                // Açıklama alanını kullan
                description: description || (orderName || company ? `Sipariş: ${orderName || '-'} | Firma: ${company || '-'}` : undefined)
            }
        });

        // Yarı mamül üretime ekle
        await prisma.semiFinishedProduction.create({
            data: {
                productId: product.id,
                category,
                targetQty,
                producedQty: 0,
                status: "PENDING"
            }
        });

        revalidatePath("/dashboard/semi-finished-production");
        return { success: true };
    } catch (error) {
        console.error("Error adding manual semi-finished production:", error);
        return { error: "Manuel ekleme sırasında hata oluştu" };
    }
}

// Admin'in ürün açıklamalarını güncellemesi (aciklama1-4 ve description)
export async function updateProductNotes(productId: number, data: {
    description?: string;
    aciklama1?: string;
    aciklama2?: string;
    aciklama3?: string;
    aciklama4?: string;
}) {
    try {
        await prisma.product.update({
            where: { id: productId },
            data: {
                description: data.description || null,
                aciklama1: data.aciklama1 || null,
                aciklama2: data.aciklama2 || null,
                aciklama3: data.aciklama3 || null,
                aciklama4: data.aciklama4 || null,
            }
        });

        revalidatePath("/dashboard/semi-finished-production");
        return { success: true };
    } catch (error) {
        console.error("Error updating product notes:", error);
        return { error: "Açıklama güncelleme sırasında hata oluştu" };
    }
}
