'use server';

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "./shared";

export async function getReadyToShipProducts() {
    const products = await prisma.product.findMany({
        where: {
            storedQty: { gt: 0 } // Depoda ürünü olanları getir
        },
        include: {
            order: true,
            shipmentItems: true
        },
        orderBy: { createdAt: 'desc' }
    });

    // Filter available from storedQty
    return products.map((p: any) => {
        const shipped = p.shippedQty || 0;
        const available = p.storedQty || 0;
        return {
            ...p,
            shipped,
            available
        };
    }).filter((p: any) => p.available > 0);
}

export async function createShipment(data: {
    company: string;
    driverName: string;
    vehiclePlate: string;
    estimatedDate: Date;
    items: { productId: number; quantity: number }[]
}) {
    if (!data.company || !data.estimatedDate || data.items.length === 0) {
        return { error: "Eksik bilgi" };
    }

    const session = await auth();
    if (!session) return { error: "Yetkisiz işlem" };

    try {
        // AI FIX: Sevkiyat oluşturulurken storedQty ve shippedQty güncellemesi eklendi
        // Önceki haliyle sadece shipment kaydı oluşturuluyordu, stok güncellenmiyordu (hayalet stok)
        const shipment = await prisma.shipment.create({
            data: {
                company: data.company,
                driverName: data.driverName,
                vehiclePlate: data.vehiclePlate,
                estimatedDate: data.estimatedDate,
                status: 'PLANNED',
                items: {
                    create: data.items.map(item => ({
                        productId: item.productId,
                        quantity: item.quantity
                    }))
                }
            }
        });

        // Ürünlerin storedQty ve shippedQty değerlerini güncelle
        for (const item of data.items) {
            await prisma.product.update({
                where: { id: item.productId },
                data: {
                    storedQty: { decrement: item.quantity },
                    shippedQty: { increment: item.quantity }
                }
            });
        }

        await createAuditLog(
            "CREATE_SHIPMENT",
            "Shipment",
            shipment.id.toString(),
            `Shipment created for ${data.company}. Driver: ${data.driverName}`,
            parseInt((session.user as any).id)
        );

        revalidatePath("/dashboard/shipment");
        return { success: true, shipmentId: shipment.id };
    } catch (e) {
        console.error(e);
        return { error: "Sevkiyat oluşturulurken hata oluştu." };
    }
}

// Quick shipment for a single product
export async function shipProduct(data: {
    productId: number;
    quantity: number;
    company: string;
    driverName?: string;
    vehiclePlate?: string;
    note?: string;
}) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz işlem" };

    const role = (session.user as any).role;
    if (!["ADMIN", "MARKETER", "WAREHOUSE", "WORKER"].includes(role)) {
        return { error: "Bu işlem için yetkiniz yok" };
    }

    try {
        // Get product and check available quantity
        const product = await prisma.product.findUnique({
            where: { id: data.productId },
            include: {
                shipmentItems: true,
                order: true
            }
        });

        if (!product) {
            return { error: "Ürün bulunamadı" };
        }

        // Depodaki miktar kontrol (storedQty)
        const storedQty = product.storedQty || 0;

        if (data.quantity > storedQty) {
            return { error: `Yetersiz stok. Depoda mevcut: ${storedQty}` };
        }

        if (data.quantity <= 0) {
            return { error: "Geçerli bir miktar girin" };
        }

        // Create shipment with single item and update storedQty/shippedQty
        const [shipment] = await prisma.$transaction([
            prisma.shipment.create({
                data: {
                    company: data.company || product.order?.company || "Belirtilmedi",
                    driverName: data.driverName || null,
                    vehiclePlate: data.vehiclePlate || null,
                    exitDate: new Date(),
                    status: "SHIPPED",
                    items: {
                        create: [{
                            productId: data.productId,
                            quantity: data.quantity
                        }]
                    }
                }
            }),
            // Depodaki miktarı azalt, sevk edileni artır
            prisma.product.update({
                where: { id: data.productId },
                data: {
                    storedQty: { decrement: data.quantity },
                    shippedQty: { increment: data.quantity }
                }
            })
        ]);

        await createAuditLog(
            "SHIP_PRODUCT",
            "Shipment",
            shipment.id.toString(),
            `${product.name} - ${data.quantity} adet sevk edildi. Firma: ${data.company}. Depoda kalan: ${storedQty - data.quantity}`,
            parseInt((session.user as any).id)
        );

        revalidatePath("/dashboard/warehouse");
        revalidatePath("/dashboard/marketing");
        revalidatePath("/dashboard/shipment");
        revalidatePath("/dashboard/production-planning");

        return { success: true, shipmentId: shipment.id };
    } catch (e) {
        console.error("Ship Product Error:", e);
        return { error: "Sevkiyat oluşturulurken hata oluştu" };
    }
}

// Get all shipments with product details
export async function getShipments() {
    const shipments = await prisma.shipment.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            items: {
                include: {
                    product: {
                        include: {
                            order: true,
                            creator: {
                                select: { username: true }
                            }
                        }
                    }
                }
            }
        }
    });

    return shipments;
}

// Get shipped products (for marketing view)
export async function getShippedProducts() {
    const shipmentItems = await prisma.shipmentItem.findMany({
        include: {
            shipment: true,
            product: {
                include: {
                    order: true,
                    creator: {
                        select: { username: true }
                    }
                }
            }
        },
        orderBy: {
            shipment: {
                createdAt: "desc"
            }
        }
    });

    return shipmentItems;
}

// Update shipment status
export async function updateShipmentStatus(shipmentId: number, status: string) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz işlem" };

    try {
        await prisma.shipment.update({
            where: { id: shipmentId },
            data: {
                status,
                exitDate: status === "SHIPPED" ? new Date() : undefined
            }
        });

        revalidatePath("/dashboard/shipment");
        revalidatePath("/dashboard/marketing");

        return { success: true };
    } catch (e) {
        console.error("Update Shipment Status Error:", e);
        return { error: "Durum güncellenirken hata oluştu" };
    }
}
