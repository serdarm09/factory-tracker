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
        // AI FIX: Replace sequential updates with a transaction wrapper.
        // It's still necessary to iterate map since each product has a specific quantity,
        // but executing them via Promise.all within tx minimizes connection time.
        const shipment = await prisma.$transaction(async (tx) => {
            const newShipment = await tx.shipment.create({
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
            await Promise.all(data.items.map(item =>
                tx.product.update({
                    where: { id: item.productId },
                    data: {
                        storedQty: { decrement: item.quantity },
                        shippedQty: { increment: item.quantity }
                    }
                })
            ));

            return newShipment;
        });

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
    partsShipped?: string; // EVET | HAYIR | DAHA_SONRA
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
                            quantity: data.quantity,
                            partsShipped: data.partsShipped || null
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
        revalidatePath("/dashboard/planning");
        revalidatePath("/dashboard/production");

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

// Geçmişe Dönük Sevkiyat Verileri
export async function getHistoricalShipmentData(weeksCount: number = 4) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz" };

    try {
        const today = new Date();
        const dayOfWeek = today.getDay();
        // Pazartesi başlangıcı (0 = Pazar, 1 = Pazartesi)
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

        const weeks: {
            week: string;
            label: string;
            total: number;
            dailyData: { day: string; count: number }[];
        }[] = [];

        const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

        for (let w = 0; w < weeksCount; w++) {
            // Her hafta için başlangıç ve bitiş tarihi
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() + mondayOffset - (w * 7));
            weekStart.setHours(0, 0, 0, 0);

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);
            weekEnd.setHours(0, 0, 0, 0);

            // Bu haftanın sevkiyat loglarını çek
            const logs = await prisma.shipmentItem.findMany({
                where: {
                    shipment: {
                        createdAt: {
                            gte: weekStart,
                            lt: weekEnd
                        }
                    }
                },
                include: {
                    shipment: true
                }
            });

            // Günlük dağılım
            const dailyData: { day: string; count: number }[] = [];
            for (let d = 0; d < 7; d++) {
                const dayDate = new Date(weekStart);
                dayDate.setDate(weekStart.getDate() + d);

                const dayLogs = logs.filter(log => {
                    const logDate = new Date(log.shipment.createdAt);
                    return logDate.getDate() === dayDate.getDate() &&
                        logDate.getMonth() === dayDate.getMonth() &&
                        logDate.getFullYear() === dayDate.getFullYear();
                });

                const dayTotal = dayLogs.reduce((sum, log) => sum + log.quantity, 0);
                dailyData.push({
                    day: dayNames[dayDate.getDay()],
                    count: dayTotal
                });
            }

            // Toplam
            const total = logs.reduce((sum, log) => sum + log.quantity, 0);

            // Hafta etiketi
            let label = "";
            if (w === 0) {
                label = "Bu Hafta";
            } else if (w === 1) {
                label = "Geçen Hafta";
            } else {
                label = `${w} Hafta Önce`;
            }

            // Tarih aralığı
            const weekEndDisplay = new Date(weekEnd);
            weekEndDisplay.setDate(weekEndDisplay.getDate() - 1);
            const dateRange = `${weekStart.getDate()}/${weekStart.getMonth() + 1} - ${weekEndDisplay.getDate()}/${weekEndDisplay.getMonth() + 1}`;

            weeks.push({
                week: dateRange,
                label,
                total,
                dailyData
            });
        }

        return { data: weeks };
    } catch (e) {
        console.error("Historical shipment data fetch error:", e);
        return { error: "Veri çekilirken hata oluştu" };
    }
}
