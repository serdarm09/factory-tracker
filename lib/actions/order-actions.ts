'use server';

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "./shared";

export type CreateOrderData = {
    company: string;
    name: string; // Order Ref / Name
    items: {
        code: string; // from Catalog
        name: string;
        quantity: number;
        terminDate?: Date | string;
        material?: string;
        description?: string;
        // Configs
        footType?: string;
        footMaterial?: string;
        armType?: string;
        backType?: string;
        fabricType?: string;
        master?: string;
        imageUrl?: string;
    }[];
}

export async function createOrder(data: CreateOrderData) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz işlem" };
    const userId = parseInt((session.user as any).id);

    // Verify user exists to prevent FK error if user was deleted
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
        return { error: "Kullanıcı oturumu geçersiz. Lütfen tekrar giriş yapın." };
    }

    if (!data.company || !data.name || data.items.length === 0) {
        return { error: "Eksik bilgi" };
    }

    try {
        // 1. Create Order
        const order = await prisma.order.create({
            data: {
                company: data.company,
                name: data.name,
                status: 'REQUESTED',
                marketingById: userId
            }
        });

        // 2. Create Products with Unique SystemCodes
        // SystemCode format: {order.id}-{code}-{index}
        // This ensures uniqueness even if same item appears twice or in other orders.
        // ImageUrl: /{code}.png (Shared sku image)

        for (let i = 0; i < data.items.length; i++) {
            const item = data.items[i];
            const systemCode = `${order.id}-${item.code}-${i + 1}`;

            // Handle Date conversion with validation
            let tDate: Date | null = null;
            if (item.terminDate) {
                const parsedDate = typeof item.terminDate === 'string' ? new Date(item.terminDate) : item.terminDate;

                // Validate date is reasonable (between 2020 and 2100)
                if (!isNaN(parsedDate.getTime())) {
                    const year = parsedDate.getFullYear();
                    if (year >= 2020 && year <= 2100) {
                        tDate = parsedDate;
                    } else {
                        return { error: `Geçersiz termin tarihi: ${item.name} için yıl ${year}. Lütfen geçerli bir tarih girin.` };
                    }
                } else {
                    return { error: `Geçersiz tarih formatı: ${item.name}` };
                }
            }

            // Fetch image from Catalog to ensure consistency
            let validImageUrl = item.imageUrl;
            try {
                const catalogItem = await prisma.productCatalog.findUnique({
                    where: { code: item.code }
                });
                if (catalogItem?.imageUrl) {
                    validImageUrl = catalogItem.imageUrl;
                }
            } catch (e) {
                // Ignore catalog fetch error, fallback to item.imageUrl
            }

            await prisma.product.create({
                data: {
                    orderId: order.id,
                    name: item.name,
                    model: item.code,
                    quantity: item.quantity,
                    produced: 0,
                    terminDate: tDate,
                    material: item.material,
                    description: item.description,
                    footType: item.footType,
                    footMaterial: item.footMaterial,
                    armType: item.armType,
                    backType: item.backType,
                    fabricType: item.fabricType,
                    master: item.master,
                    systemCode: systemCode,
                    imageUrl: validImageUrl,
                    status: 'PENDING',
                    createdById: userId,
                    barcode: null
                }
            });
        }

        await createAuditLog("CREATE_ORDER", "Order", data.name, `Order created with ${data.items.length} items.`, userId);

        revalidatePath("/dashboard/planning");
        revalidatePath("/dashboard");
        return { success: true, orderId: order.id };
    } catch (e) {
        console.error(e);
        return { error: "Sipariş oluşturulurken hata oluştu." };
    }
}

export async function getOrderForClone(orderId: number) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz işlem" };

    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                products: {
                    select: {
                        name: true,
                        model: true,
                        quantity: true,
                        material: true,
                        description: true,
                        footType: true,
                        footMaterial: true,
                        armType: true,
                        backType: true,
                        fabricType: true,
                        master: true,
                        imageUrl: true,
                    }
                }
            }
        });

        if (!order) {
            return { error: "Sipariş bulunamadı" };
        }

        // Transform to the format expected by new-order page
        const cloneData = {
            company: order.company,
            orderName: order.name || "",
            items: order.products.map(p => ({
                code: p.model,
                name: p.name,
                quantity: p.quantity,
                material: p.material || "",
                description: p.description || "",
                terminDate: null, // User should set new termin dates
                footType: p.footType || "",
                footMaterial: p.footMaterial || "",
                armType: p.armType || "",
                backType: p.backType || "",
                fabricType: p.fabricType || "",
                master: p.master || "",
                imageUrl: p.imageUrl || "",
            }))
        };

        return { success: true, data: cloneData };
    } catch (e) {
        console.error("Clone order error:", e);
        return { error: "Sipariş bilgileri alınamadı" };
    }
}

export async function bulkUpdateOrderProducts(orderId: number, data: {
    terminDate?: string;
    master?: string;
}) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz işlem" };

    try {
        const updateData: any = {};
        if (data.terminDate) updateData.terminDate = new Date(data.terminDate);
        if (data.master !== undefined) updateData.master = data.master || null;

        await prisma.product.updateMany({
            where: { orderId },
            data: updateData
        });

        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (e) {
        console.error("Bulk update error:", e);
        return { error: "Toplu güncelleme sırasında hata oluştu" };
    }
}

export async function bulkUpdateSelectedProducts(productIds: number[], data: {
    terminDate?: string;
    master?: string;
    company?: string;
}) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz işlem" };

    const userId = parseInt((session.user as any).id);

    try {
        const updateData: any = {};
        if (data.terminDate) updateData.terminDate = new Date(data.terminDate);
        if (data.master !== undefined) updateData.master = data.master || null;

        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, status: true, systemCode: true, orderId: true }
        });

        // Update the Order's company if provided
        if (data.company) {
            const orderIds = Array.from(new Set(products.map(p => p.orderId).filter(id => id !== null)));
            if (orderIds.length > 0) {
                await prisma.order.updateMany({
                    where: { id: { in: orderIds as number[] } },
                    data: { company: data.company, customerName: data.company }
                });
            }
        }

        const draftProductIds = products.filter(p => p.status === "DRAFT").map(p => p.id);
        const nonDraftProductIds = products.filter(p => p.status !== "DRAFT").map(p => p.id);

        if (draftProductIds.length > 0) {
            await prisma.product.updateMany({
                where: { id: { in: draftProductIds } },
                data: { ...updateData, status: "PENDING" }
            });
            for (const product of products.filter(p => p.status === "DRAFT")) {
                await createAuditLog("BULK_SEND_TO_APPROVAL", "Product", product.systemCode, `Ürün toplu atama ile onaya gönderildi`, userId);
            }
        }

        if (nonDraftProductIds.length > 0) {
            await prisma.product.updateMany({
                where: { id: { in: nonDraftProductIds } },
                data: updateData
            });
        }

        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (e) {
        console.error("Bulk update selected error:", e);
        return { error: "Toplu güncelleme sırasında hata oluştu" };
    }
}
