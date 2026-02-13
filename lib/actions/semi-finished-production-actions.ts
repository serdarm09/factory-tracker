"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Ürünleri yarı mamül üretime gönder
export async function sendToSemiFinishedProduction(data: {
    products: { id: number; quantity: number; description?: string }[];
    categories: string[]; // METAL, KONFEKSIYON, AHSAP_BOYA, AHSAP_ISKELET
}) {
    try {
        const { products, categories } = data;

        // Her ürün için seçilen kategorilere kayıt oluştur
        for (const product of products) {
            // Eğer açıklama varsa, Product'a kaydet
            if (product.description) {
                await prisma.product.update({
                    where: { id: product.id },
                    data: { description: product.description }
                });
            }

            for (const category of categories) {
                // Eğer zaten varsa güncelle, yoksa oluştur
                await prisma.semiFinishedProduction.upsert({
                    where: {
                        productId_category: {
                            productId: product.id,
                            category
                        }
                    },
                    update: {
                        targetQty: {
                            increment: product.quantity // Ürünün kendi miktarını ekle
                        }
                    },
                    create: {
                        productId: product.id,
                        category,
                        targetQty: product.quantity, // Ürünün kendi miktarını kullan
                        producedQty: 0,
                        status: "PENDING"
                    }
                });
            }
        }

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
                        aciklama1: true,
                        aciklama2: true,
                        aciklama3: true,
                        aciklama4: true,
                        order: {
                            select: {
                                name: true,
                                company: true
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
export async function updateSemiFinishedProductionQty(id: number, producedQty: number) {
    try {
        const item = await prisma.semiFinishedProduction.findUnique({
            where: { id }
        });

        if (!item) {
            return { error: "Kayıt bulunamadı" };
        }

        // Status güncelle
        let status = "PENDING";
        if (producedQty > 0 && producedQty < item.targetQty) {
            status = "IN_PROGRESS";
        } else if (producedQty >= item.targetQty) {
            status = "COMPLETED";
        }

        await prisma.semiFinishedProduction.update({
            where: { id },
            data: {
                producedQty,
                status,
                updatedAt: new Date()
            }
        });

        revalidatePath("/dashboard/semi-finished-production");
        return { success: true };
    } catch (error) {
        console.error("Error updating semi-finished production qty:", error);
        return { error: "Güncelleme sırasında hata oluştu" };
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
        const categories = ["METAL", "KONFEKSIYON", "AHSAP_BOYA", "AHSAP_ISKELET"];
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

// Admin'in ürün açıklamalarını güncellemesi (aciklama1-4)
export async function updateProductNotes(productId: number, data: {
    aciklama1?: string;
    aciklama2?: string;
    aciklama3?: string;
    aciklama4?: string;
}) {
    try {
        await prisma.product.update({
            where: { id: productId },
            data: {
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
