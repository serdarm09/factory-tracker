'use server';

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { writeFile } from "fs/promises";
import { join } from "path";
import fs from "fs";
import path from "path";
import { createAuditLog } from "./shared";
import { netSimClient } from "@/lib/netsim-client";

export async function createProduct(formData: FormData) {
    const session = await auth();
    if (!session || !["ADMIN", "PLANNER", "MARKETER"].includes((session.user as any).role)) {
        return { error: "Yetkisiz iÅŸlem" };
    }

    const name = formData.get("name") as string;
    const model = formData.get("model") as string;
    const company = formData.get("company") as string;
    const quantity = parseInt(formData.get("quantity") as string);
    const terminDateStr = formData.get("terminDate") as string;
    const terminDate = terminDateStr ? new Date(terminDateStr) : undefined;
    const orderDateStr = formData.get("orderDate") as string;
    const orderDate = orderDateStr ? new Date(orderDateStr) : new Date();
    const code = formData.get("systemCode") as string;
    const material = formData.get("material") as string;
    const description = formData.get("description") as string;
    // Shelf is removed from Product model
    const image = formData.get("image") as File | null;
    const existingImageUrl = formData.get("existingImageUrl") as string;

    // Catalog Product
    const catalogProductIdStr = formData.get("catalogProductId") as string;
    const catalogProductId = catalogProductIdStr ? parseInt(catalogProductIdStr) : null;

    // New Configuration Fields
    const footType = formData.get("footType") as string;
    const footMaterial = formData.get("footMaterial") as string;
    const armType = formData.get("armType") as string;
    const backType = formData.get("backType") as string;
    const fabricType = formData.get("fabricType") as string;

    if (!name || !model || !quantity || !code) {
        return { error: "Eksik alanlar" };
    }

    const userId = parseInt((session.user as any).id);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        return { error: "KullanÄ±cÄ± bulunamadÄ±." };
    }

    let imageUrl = null;
    if (image && image.size > 0) {
        try {
            const bytes = await image.arrayBuffer();
            const buffer = Buffer.from(bytes);

            // Standardize filename as per user request: [systemCode].png
            const filename = `${code}.png`;
            const publicDir = join(process.cwd(), "public");
            await writeFile(join(publicDir, filename), buffer);
            imageUrl = `/${filename}`;
        } catch (error) {
            console.error("Image upload failed:", error);
        }
    }

    try {
        await prisma.product.create({
            data: {
                name,
                model,
                quantity,
                terminDate: terminDate || null, // Fix type mismatch: undefined -> null
                orderDate,
                systemCode: code,
                material,
                description,
                // shelf removed
                imageUrl: imageUrl || `/${code}.png`, // Default to code.png
                status: "PENDING",
                footType: footType || null,
                footMaterial: footMaterial || null,
                armType: armType || null,
                backType: backType || null,
                fabricType: fabricType || null,
                catalogProductId: catalogProductId, // Katalog ürün ilişkisi
                createdById: userId,
            },
        });

        // Catalog sync logic...
        const saveToCatalog = formData.get("saveToCatalog") === "true";
        if (saveToCatalog) {
            try {
                await (prisma as any).productCatalog.upsert({
                    where: { code },
                    update: { name, imageUrl: `/${code}.png` },
                    create: { code, name, imageUrl: `/${code}.png` }
                });
            } catch (e) { }
        }

        await createAuditLog("CREATE", "Product", code, `Created product: ${name}`, userId);

        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (e) {
        console.error(e);
        return { error: "ÃœrÃ¼n oluÅŸturulurken bir hata oluÅŸtu." };
    }
}

export async function cancelProduct(id: number) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz işlem" };

    const role = (session.user as any).role;
    const userId = parseInt((session.user as any).id);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return { error: "BulunamadÄ±" };

    if (product.status === "APPROVED" && role !== "ADMIN") {
        return { error: "OnaylanmÄ±ÅŸ Ã¼rÃ¼nleri sadece YÃ¶netici iptal edebilir" };
    }

    try {
        await prisma.$transaction([
            prisma.productionLog.deleteMany({ where: { productId: id } }),
            prisma.inventory.deleteMany({ where: { productId: id } }), // Clear inventory
            prisma.product.delete({ where: { id } })
        ]);

        await createAuditLog("CANCEL", "Product", product.systemCode, `Cancelled product ID: ${id}`, userId);
        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (e) {
        return { error: "Ä°ptal edilirken bir hata oluÅŸtu." };
    }
}

export async function updateProduct(id: number, formData: FormData) {
    const session = await auth();
    const role = (session?.user as any).role;
    const userId = parseInt((session?.user as any).id);

    if (!session || !["ADMIN", "PLANNER", "WORKER"].includes(role)) {
        return { error: "Yetkisiz iÅŸlem" };
    }

    // önce ürün kontrol et - onaylanmÄ±ÅŸ ürünleri sadece admin düzenleyebilir
    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
        return { error: "Ürün bulunamadÄ±" };
    }

    const isApprovedOrCompleted = existingProduct.status === 'APPROVED' ||
        existingProduct.status === 'COMPLETED' ||
        existingProduct.status === 'IN_PRODUCTION';

    if (isApprovedOrCompleted && role !== 'ADMIN') {
        return { error: "OnaylanmÄ±ÅŸ ürünleri sadece YÃ¶netici dÃ¼zenleyebilir" };
    }

    const name = formData.get("name") as string;
    const model = formData.get("model") as string;
    const company = formData.get("company") as string;
    const terminDateStr = formData.get("terminDate") as string;
    const terminDate = terminDateStr ? new Date(terminDateStr) : undefined;
    const material = formData.get("material") as string;
    const description = formData.get("description") as string;

    // Catalog Product
    const catalogProductIdStr = formData.get("catalogProductId") as string;
    const catalogProductId = catalogProductIdStr ? parseInt(catalogProductIdStr) : null;

    // shelf removal

    const footType = formData.get("footType") as string;
    const footMaterial = formData.get("footMaterial") as string;
    const armType = formData.get("armType") as string;
    const backType = formData.get("backType") as string;
    const fabricType = formData.get("fabricType") as string;
    const master = formData.get("master") as string;

    // Fotoğraf yükleme
    const imageFile = formData.get("image") as File | null;
    let imageUrl: string | undefined;

    if (imageFile && imageFile.size > 0) {
        const bytes = await imageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // public/uploads klasörüne kaydet
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileName = `${Date.now()}-${imageFile.name}`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, buffer);
        imageUrl = `/uploads/${fileName}`;
    }

    const updates: any = {};
    let logDetails = "";

    const quantityStr = formData.get("quantity");
    if (quantityStr) {
        const q = parseInt(quantityStr as string);
        if (isNaN(q)) return { error: "Geçersiz miktar (Sayı giriniz)" };
        updates.quantity = q;
        logDetails += `Qty updated to ${updates.quantity}. `;
    }

    // Produced update logic removed/ignored as per comments

    // Status logic - existingProduct zaten yukarÄ±da Ã§ekildi
    if (existingProduct.status === 'REJECTED') {
        updates.status = 'PENDING';
        updates.rejectionReason = null;
    }

    try {
        const product = await prisma.product.update({
            where: { id },
            data: {
                name,
                model,
                // company field is on Order model, cannot update directly on Product without updating parent Order
                terminDate,
                material,
                description,
                footType: footType || null,
                footMaterial: footMaterial || null,
                armType: armType || null,
                backType: backType || null,
                fabricType: fabricType || null,
                master: master || null,
                catalogProductId: catalogProductId, // Katalog ürün ilişkisi güncelle
                ...(imageUrl && { imageUrl }), // Fotoğraf varsa güncelle
                ...updates
            }
        });

        await createAuditLog("UPDATE", "Product", product.systemCode, logDetails || "Updated details", userId);
        revalidatePath("/dashboard/warehouse");
        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (e) {
        console.error("Update Product Error:", e);
        return { error: "Güncelleme başarısız: " + (e as any).message };
    }
}

export async function approveProduct(id: number) {
    const session = await auth();
    if (!session || !session.user || (session.user as any).role !== "ADMIN") return { error: "Yetkisiz iÅŸlem" };
    const userId = parseInt((session.user as any).id);

    try {
        const product = await prisma.product.findUnique({
            where: { id },
            include: { order: true }
        });
        if (!product) return { error: "Bulunamadı" };

        // Admin onayÄ± -> Pazarlamaya gÃ¶nder (barkod henÃ¼z atanmaz)
        await prisma.product.update({
            where: { id },
            data: {
                status: "MARKETING_REVIEW",
                rejectionReason: null
            }
        });

        await createAuditLog(
            "ADMIN_APPROVE",
            "Product",
            product.systemCode,
            `Admin approved. Sent to Marketing review.`,
            userId
        );
        revalidatePath("/dashboard/admin/approvals");
        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (e) {
        return { error: "OnaylanÄ±rken hata oluÅŸtu" };
    }
}

// Pazarlama onayı - Üretime gönder (MARKETING_REVIEW -> APPROVED, barkod atanır)
export async function marketingApproveProduct(id: number) {
    const session = await auth();
    if (!session || !session.user) return { error: "Yetkisiz işlem" };

    const role = (session.user as any).role;
    if (!["ADMIN", "MARKETING", "MARKETER"].includes(role)) {
        return { error: "Sadece Pazarlama veya Admin üretime gönderebilir" };
    }

    const userId = parseInt((session.user as any).id);

    try {
        const product = await prisma.product.findUnique({
            where: { id },
            include: { order: true }
        });
        if (!product) return { error: "Bulunamadı" };

        if (product.status !== "MARKETING_REVIEW") {
            return { error: "Bu ürün pazarlama incelemesinde değil" };
        }

        const barcode = product.systemCode;

        // Pazarlama onayÄ± -> Ãœretime gÃ¶nder (barkod atanÄ±r)
        await prisma.product.update({
            where: { id },
            data: {
                status: "APPROVED",
                barcode: barcode
            }
        });

        // NetSim'e termin tarihini yaz (eÄŸer sipariÅŸ NetSim'den geldiyse)
        let netSimResult = null;
        if (product.order?.externalId && product.terminDate) {
            try {
                // externalId format: "NETSIM-123456"
                const match = product.order.externalId.match(/NETSIM-(\d+)/);
                if (match) {
                    const alissatisNo = parseInt(match[1]);
                    netSimResult = await netSimClient.updateDeliveryDate(alissatisNo, product.terminDate);
                    if (netSimResult.success) {
                        console.log(`NetSim termin tarihi güncellendi: Order ${alissatisNo}`);
                    } else {
                        console.warn(`NetSim termin güncelleme hatası: ${netSimResult.error}`);
                    }
                }
            } catch (netSimErr) {
                console.warn("NetSim baÄŸlantÄ± hatasÄ±:", netSimErr);
            }
        }

        await createAuditLog(
            "MARKETING_APPROVE",
            "Product",
            product.systemCode,
            `Marketing approved. Sent to production. Barcode: ${barcode}${netSimResult?.success ? '. NetSim termin gÃ¼ncellendi.' : ''}`,
            userId
        );
        revalidatePath("/dashboard/planning");
        revalidatePath("/dashboard/warehouse");
        revalidatePath("/dashboard/production");
        return { success: true };
    } catch (e) {
        return { error: "Üretime gönderirken hata oluştu" };
    }
}

// Taslak ürün onaya gönder (DRAFT -> PENDING)
export async function sendToApproval(id: number) {
    const session = await auth();
    if (!session || !session.user) return { error: "Yetkisiz iÅŸlem" };

    const role = (session.user as any).role;
    if (!["ADMIN", "PLANNER"].includes(role)) {
        return { error: "Sadece Admin veya Planlama kullanÄ±cÄ±sÄ± onaya gÃ¶nderebilir" };
    }

    const userId = parseInt((session.user as any).id);

    try {
        const product = await prisma.product.findUnique({ where: { id } });
        if (!product) return { error: "ÃœrÃ¼n bulunamadÄ±" };

        if (product.status !== "DRAFT") {
            return { error: "Sadece taslak durumundaki Ã¼rÃ¼nler onaya gÃ¶nderilebilir" };
        }

        // Termin tarihi kontrolÃ¼
        if (!product.terminDate) {
            return { error: "Onaya gÃ¶ndermeden Ã¶nce termin tarihi girilmelidir" };
        }

        await prisma.product.update({
            where: { id },
            data: {
                status: "PENDING"
            }
        });

        await createAuditLog("SEND_TO_APPROVAL", "Product", product.systemCode, `Ürün onaya gönderildi`, userId);
        revalidatePath("/dashboard/planning");
        revalidatePath("/dashboard/admin/approvals");
        return { success: true };
    } catch (e) {
        console.error("Send to approval error:", e);
        return { error: "Onaya gönderirken hata oluştu" };
    }
}

// Üretime Gonder - Pazarlama kullanıcıs için
// Bu fonksiyon çağrıldığında:
// 1. Ürün durumu IN_PRODUCTION olur
// 2. NetSim siparişiyse termin tarihi NetSim'e yazılır
export async function sendToProduction(productId: number) {
    const session = await auth();
    if (!session || !session.user) return { error: "Yetkisiz işlem" };

    const role = (session.user as any).role;
    if (!["ADMIN", "MARKETER", "MARKETING"].includes(role)) {
        return { error: "Sadece Admin veya Pazarlama kullanıcısı üretime gönderebilir" };
    }

    const userId = parseInt((session.user as any).id);

    try {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: { order: true }
        });

        if (!product) {
            return { error: "Ürün bulunamadı" };
        }

        if (product.status !== "APPROVED") {
            return { error: "Sadece onaylanmıs ürünler üretime gönderilebilir" };
        }

        // Ürünü IN_PRODUCTION durumuna güncelle
        await prisma.product.update({
            where: { id: productId },
            data: { status: "IN_PRODUCTION" }
        });

        // NetSim entegrasyonu: EÄŸer sipariÅŸ NetSim'den geldiyse ve termin tarihi varsa, NetSim'e yaz
        let netSimUpdated = false;
        let netSimError = null;

        if (product.order?.externalId?.startsWith("NETSIM-") && product.terminDate) {
            const alissatisNo = parseInt(product.order.externalId.replace("NETSIM-", ""));
            if (!isNaN(alissatisNo)) {
                try {
                    // NetSim bağlantısını kontrol et
                    const status = await netSimClient.getStatus();
                    if (!status.isConnected) {
                        const connectResult = await netSimClient.connect("MARISITTEST.FDB", "SYSDBA", "masterkey");
                        if (!connectResult.isConnected) {
                            netSimError = "NetSim'e bağlanılamadı";
                        }
                    }

                    if (!netSimError) {
                        const result = await netSimClient.updateDeliveryDate(alissatisNo, product.terminDate);
                        if (result.success) {
                            netSimUpdated = true;
                            console.log(`NetSim termin tarihi güncellendi: Siparis ${alissatisNo}, Tarih: ${product.terminDate}`);
                        } else {
                            netSimError = result.error || "NetSim güncelleme başarısız";
                        }
                    }
                } catch (err) {
                    console.error("NetSim termin tarihi gÃ¼ncellenemedi:", err);
                    netSimError = err instanceof Error ? err.message : "NetSim baÄŸlantÄ± hatasÄ±";
                }
            }
        }

        await createAuditLog(
            "SEND_TO_PRODUCTION",
            "Product",
            product.systemCode,
            `Ürün üretime gönderildi${netSimUpdated ? ". NetSim termin tarihi güncellendi." : ""}${netSimError ? `. NetSim hatası: ${netSimError}` : ""}`,
            userId
        );

        revalidatePath("/dashboard/marketing");
        revalidatePath("/dashboard/production");
        revalidatePath("/dashboard/planning");

        return {
            success: true,
            netSimUpdated,
            netSimError,
            message: netSimUpdated
                ? `Ürün üretime gönderildi ve termin tarihi NetSim'e aktarıldı`
                : netSimError
                    ? `Ürün üretime gönderildi. NetSim hatası: ${netSimError}`
                    : "Ürün üretime gönderildi"
        };
    } catch (e) {
        console.error("Send to production error:", e);
        return { error: "Ãœretime gÃ¶nderilirken hata oluÅŸtu" };
    }
}

// Toplu onaya gönder
export async function bulkSendToApproval(productIds: number[]) {
    const session = await auth();
    if (!session || !session.user) return { error: "Yetkisiz işlem" };

    const role = (session.user as any).role;
    if (!["ADMIN", "PLANNER"].includes(role)) {
        return { error: "Sadece Admin veya Planlama kullanıcısı onaya gönderilebilir" };
    }

    const userId = parseInt((session.user as any).id);

    try {
        const products = await prisma.product.findMany({
            where: {
                id: { in: productIds },
                status: "DRAFT",
                terminDate: { not: null } // Termin tarihi olanları al
            }
        });

        let successCount = 0;
        let skippedCount = 0;

        for (const product of products) {
            await prisma.product.update({
                where: { id: product.id },
                data: { status: "PENDING" }
            });
            await createAuditLog("BULK_SEND_TO_APPROVAL", "Product", product.systemCode, `Ürün toplu onaya gönderildi`, userId);
            successCount++;
        }

        skippedCount = productIds.length - successCount;

        revalidatePath("/dashboard/planning");
        revalidatePath("/dashboard/admin/approvals");
        return {
            success: true,
            count: successCount,
            skipped: skippedCount,
            message: skippedCount > 0 ? `${skippedCount} ürün atlandı (taslak veya termin tarihi yok)` : undefined
        };
    } catch (e) {
        console.error("Bulk send to approval error:", e);
        return { error: "Toplu onaya gönderme başarısız" };
    }
}

// Fix logProduction to remove shelf column usage
export async function logProduction(barcode: string, quantity: number, shelf: string) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz işlem" };

    const product = await prisma.product.findUnique({ where: { barcode }, include: { inventory: true } });
    if (!product) return { error: "Ürün bulunamadı" };

    const cleanShelf = shelf.trim().toUpperCase();
    if (!cleanShelf) {
        return { error: "Raf bilgisi girilmelidir." };
    }

    if (product.produced + quantity > product.quantity) {
        return { error: "Planlanandan fazla üretim girilemez" };
    }

    const newProduced = product.produced + quantity;
    // AI FIX: Üretim tamamlanmadıysa mevcut durumu koru (IN_PRODUCTION -> APPROVED gerilemesini önle)
    const newStatus = newProduced >= product.quantity ? "COMPLETED" : product.status;

    const userId = parseInt((session.user as any).id);

    try {
        await prisma.$transaction([
            // 1. Log the action
            prisma.productionLog.create({
                data: {
                    productId: product.id,
                    quantity,
                    shelf: cleanShelf,
                    userId: userId
                }
            }),
            // 2. Update Product totals (Shelf column is gone, so do not update it)
            prisma.product.update({
                where: { id: product.id },
                data: {
                    produced: newProduced,
                    status: newStatus,
                }
            }),
            // 3. Upsert Inventory
            prisma.inventory.upsert({
                where: {
                    productId_shelf: {
                        productId: product.id,
                        shelf: cleanShelf
                    }
                },
                update: {
                    quantity: { increment: quantity }
                },
                create: {
                    productId: product.id,
                    shelf: cleanShelf,
                    quantity: quantity
                }
            })
        ]);

        await createAuditLog("PRODUCE", "Product", product.systemCode, `Production logged: ${quantity} to ${cleanShelf}. New Total: ${newProduced}`, userId);

        revalidatePath("/dashboard/production");
        revalidatePath("/dashboard");
        revalidatePath("/dashboard/warehouse");
        return { success: true, product };
    } catch (e) {
        console.error(e);
        return { error: "Üretim kaydedilirken hata oluştu" };
    }
}

export async function getProductByBarcode(barcode: string) {
    const session = await auth();
    if (!session) return null;

    // Barkod okuyucu * karakterini - yerine okuyabilir (Code 39 formatı)
    // Her iki formatta da arama yap
    const normalizedBarcode = barcode.replace(/\*/g, '-');
    const originalBarcode = barcode;

    // Önce normalize edilmiş barkod ile ara
    let product = await prisma.product.findUnique({
        where: { barcode: normalizedBarcode },
        include: { inventory: true }
    });

    // Bulunamazsa orijinal barkod ile ara
    if (!product && normalizedBarcode !== originalBarcode) {
        product = await prisma.product.findUnique({
            where: { barcode: originalBarcode },
            include: { inventory: true }
        });
    }

    // Hala bulunamazsa systemCode ile ara
    if (!product) {
        product = await prisma.product.findFirst({
            where: {
                OR: [
                    { systemCode: normalizedBarcode },
                    { systemCode: originalBarcode }
                ]
            },
            include: { inventory: true }
        });
    }

    return product;
}

export async function revokeApproval(id: number) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return { error: "Ürün bulunamadı" };
    const session = await auth();
    const userId = parseInt((session?.user as any).id);

    if (product.status === 'COMPLETED') {
        return { error: "Tamamlanmış ürünün onayını iptal edilemez." };
    }

    try {
        await prisma.product.update({
            where: { id },
            data: {
                status: 'PENDING',
                barcode: null,
            }
        });

        await createAuditLog("REVOKE", "Product", product.systemCode, "Approval revoked", userId);

        revalidatePath('/dashboard/admin/approvals');
        revalidatePath('/dashboard/warehouse');
        revalidatePath('/dashboard/production');
        return { success: true };
    } catch (e) {
        return { error: "Ä°ptal edilirken hata oluÅŸtu." };
    }
}

export async function rejectProduct(id: number, reason: string) {
    const session = await auth();
    if (!session || !session.user || (session.user as any).role !== "ADMIN") return { error: "Yetkisiz iÅŸlem" };
    const userId = parseInt((session.user as any).id);

    try {
        await prisma.product.update({
            where: { id },
            data: {
                status: 'REJECTED',
                rejectionReason: reason
            }
        });

        const product = await prisma.product.findUnique({ where: { id } });
        if (product) {
            await createAuditLog("REJECT_PRODUCT", "Product", product.name, `Product rejected. Reason: ${reason}`, userId);
        }

        revalidatePath("/dashboard/admin/approvals");
        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (e) {
        console.error(e);
        return { error: "Ä°ÅŸlem baÅŸarÄ±sÄ±z" };
    }
}

// Pazarlama iptal - Ã¼rÃ¼nÃ¼ Admin onayÄ±na geri gÃ¶nder (MARKETING_REVIEW -> PENDING)
export async function marketingRejectProduct(id: number, reason: string) {
    const session = await auth();
    if (!session || !session.user) return { error: "Yetkisiz iÅŸlem" };

    const role = (session.user as any).role;
    if (!["ADMIN", "MARKETING", "MARKETER"].includes(role)) {
        return { error: "Sadece Pazarlama veya Admin bu iÅŸlemi yapabilir" };
    }

    const userId = parseInt((session.user as any).id);
    const username = (session.user as any).name || (session.user as any).username || "Pazarlama";

    try {
        const product = await prisma.product.findUnique({
            where: { id },
            include: { order: true }
        });
        if (!product) return { error: "Ürün bulunamadı" };

        const rejectReason = reason || "Pazarlama tarafından iptal edildi";

        // Pazarlama iptal ederse -> PENDING'e döner (Admin tekrar değerlendirmesini yapabilir)
        await prisma.product.update({
            where: { id },
            data: {
                status: 'PENDING',
                rejectionReason: rejectReason
            }
        });

        // Admin'e bildirim oluÅŸtur
        await (prisma as any).notification.create({
            data: {
                type: "MARKETING_REJECT",
                title: "Pazarlamadan Red Geldi",
                message: `${product.name} (${product.systemCode}) ürününü pazarlama tarafından reddedildi.\n\nRed Nedeni: ${rejectReason}\n\nFirma: ${product.order?.company || "-"}`,
                productId: product.id,
                productName: product.name,
                systemCode: product.systemCode,
                createdBy: username
            }
        });

        await createAuditLog(
            "MARKETING_REJECT",
            "Product",
            product.systemCode,
            `Marketing rejected. Sent back to Admin. Reason: ${rejectReason}`,
            userId
        );

        revalidatePath("/dashboard/admin/approvals");
        revalidatePath("/dashboard/planning");
        revalidatePath("/dashboard/marketing");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (e) {
        console.error(e);
        return { error: "İptal işlemi başarısız" };
    }
}

export async function deleteProduct(id: number) {
    const session = await auth();
    if (!session || !session.user || !['ADMIN', 'PLANNER'].includes((session.user as any).role)) {
        return { error: "Yetkisiz iÅŸlem: Sadece Admin ve Planlama yetkilisi silebilir." };
    }
    const userId = parseInt((session.user as any).id);

    try {
        const product = await prisma.product.findUnique({ where: { id } });
        if (!product) return { error: "Ürün bulunamadı" };

        await prisma.product.delete({ where: { id } });

        await createAuditLog(
            "DELETE",
            "Product",
            product.systemCode,
            `Product deleted by ${session.user.name}. Name: ${product.name}, Status: ${product.status}`,
            userId
        );

        revalidatePath("/dashboard/planning");
        revalidatePath("/dashboard/warehouse");
        return { success: true };
    } catch (e) {
        console.error("Delete Product Error:", e);
        return { error: "Silme işlemi başarısız: " + (e as any).message };
    }
}

// Bulk Actions
export async function bulkApprove(productIds: number[]) {
    const session = await auth();
    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
        return { error: "Yetkisiz işlem" };
    }
    const userId = parseInt((session.user as any).id);

    try {
        const products = await prisma.product.findMany({
            where: { id: { in: productIds }, status: "PENDING" }
        });

        for (const product of products) {
            // Admin toplu onay -> Pazarlamaya gider (barkod henüz atanmaz)
            await prisma.product.update({
                where: { id: product.id },
                data: {
                    status: "MARKETING_REVIEW",
                    rejectionReason: null
                }
            });
            await createAuditLog("BULK_ADMIN_APPROVE", "Product", product.systemCode, `Admin approved in bulk. Sent to Marketing.`, userId);
        }

        revalidatePath("/dashboard/admin/approvals");
        revalidatePath("/dashboard/planning");
        revalidatePath("/dashboard/marketing");
        return { success: true, count: products.length };
    } catch (e) {
        console.error("Bulk Approve Error:", e);
        return { error: "Toplu onaylama baÅŸarÄ±sÄ±z" };
    }
}

export async function bulkReject(productIds: number[], reason: string) {
    const session = await auth();
    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
        return { error: "Yetkisiz iÅŸlem" };
    }
    const userId = parseInt((session.user as any).id);

    if (!reason || !reason.trim()) {
        return { error: "Ret sebebi gereklidir" };
    }

    try {
        const products = await prisma.product.findMany({
            where: { id: { in: productIds }, status: "PENDING" }
        });

        for (const product of products) {
            await prisma.product.update({
                where: { id: product.id },
                data: {
                    status: "REJECTED",
                    rejectionReason: reason
                }
            });
            await createAuditLog("BULK_REJECT", "Product", product.systemCode, `Product rejected in bulk. Reason: ${reason}`, userId);
        }

        revalidatePath("/dashboard/admin/approvals");
        revalidatePath("/dashboard/planning");
        return { success: true, count: products.length };
    } catch (e) {
        console.error("Bulk Reject Error:", e);
        return { error: "Toplu reddetme baÅŸarÄ±sÄ±z" };
    }
}

export async function bulkDelete(productIds: number[]) {
    const session = await auth();
    if (!session || !session.user || !['ADMIN', 'PLANNER'].includes((session.user as any).role)) {
        return { error: "Yetkisiz iÅŸlem" };
    }
    const userId = parseInt((session.user as any).id);

    try {
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } }
        });

        for (const product of products) {
            await prisma.product.delete({ where: { id: product.id } });
            await createAuditLog("BULK_DELETE", "Product", product.systemCode, `Product deleted in bulk operation`, userId);
        }

        revalidatePath("/dashboard/planning");
        revalidatePath("/dashboard/warehouse");
        revalidatePath("/dashboard/admin/approvals");
        return { success: true, count: products.length };
    } catch (e) {
        console.error("Bulk Delete Error:", e);
        return { error: "Toplu silme baÅŸarÄ±sÄ±z" };
    }
}

export async function getProductTimeline(productId: number) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz" };

    const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
            // @ts-ignore
            creator: true,
            // @ts-ignore
            order: true
        }
    }) as any;

    if (!product) return { error: "ÃœrÃ¼n bulunamadÄ±" };

    // 1. Audit Logs (Status Changes, Updates)
    const auditLogs = await prisma.auditLog.findMany({
        where: {
            entity: 'Product',
            entityId: product.systemCode
        },
        include: { user: true }
    });

    // 2. Production Logs (Manufacturing Steps)
    // @ts-ignore
    const productionLogs = await prisma.productionLog.findMany({
        where: { productId },
        include: { user: true }
    });

    // 3. Shipment Logs
    // @ts-ignore
    const shipmentItems = await (prisma as any).shipmentItem.findMany({
        where: { productId },
        include: { shipment: true }
    });

    // Combine and Sort
    const timeline = [
        // Creation Event
        {
            id: `create-${product.id}`,
            date: product.createdAt,
            type: 'CREATED',
            title: 'SipariÅŸ OluÅŸturuldu',
            description: `SipariÅŸ: ${product.order?.name || '-'} | Kod: ${product.systemCode}`,
            user: product.creator?.username || 'Sistem'
        },
        ...auditLogs.map((l: any) => ({
            id: `audit-${l.id}`,
            date: l.createdAt,
            type: l.action, // UPDATE, APPROVE, REJECT
            title: translateAction(l.action),
            description: l.details,
            user: l.user?.username
        })),
        ...productionLogs.map((l: any) => ({
            id: `prod-${l.id}`,
            date: l.createdAt,
            type: 'PRODUCTION',
            title: 'Ãœretim GiriÅŸi',
            description: `${l.quantity} adet Ã¼retildi. ${l.shelf ? `Raf: ${l.shelf}` : ''}`,
            user: l.user?.username
        })),
        ...shipmentItems.map((s: any) => ({
            id: `ship-${s.id}`,
            date: s.shipment.createdAt,
            type: 'SHIPMENT',
            title: 'Sevkiyat PlanlandÄ±',
            description: `Sevkiyat ID: ${s.shipment.id} | Plaka: ${s.shipment.vehiclePlate || '-'}`,
            user: '-'
        }))
    ];

    // Sort descending (newest first)
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { timeline };
}

function translateAction(action: string) {
    switch (action) {
        case 'CREATE_ORDER': return 'SipariÅŸ Girildi';
        case 'UPDATE': return 'GÃ¼ncelleme YapÄ±ldÄ±';
        case 'APPROVE': return 'OnaylandÄ± (Ãœretime HazÄ±r)';
        case 'REJECT': return 'Reddedildi';
        case 'CANCEL': return 'Ä°ptal Edildi';
        case 'CREATE_FEATURE': return 'Ã–zellik Eklendi';
        default: return action;
    }
}

// GeÃ§miÅŸe DÃ¶nÃ¼k Ãœretim Verileri
export async function getHistoricalProductionData(weeksCount: number = 4) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz" };

    try {
        const today = new Date();
        const dayOfWeek = today.getDay();
        // Pazartesi baÅŸlangÄ±cÄ± (0 = Pazar, 1 = Pazartesi)
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

        const weeks: {
            week: string;
            label: string;
            total: number;
            dailyData: { day: string; count: number }[];
        }[] = [];

        const dayNames = ['Paz', 'Pzt', 'Sal', 'Ã‡ar', 'Per', 'Cum', 'Cmt'];

        for (let w = 0; w < weeksCount; w++) {
            // Her hafta iÃ§in baÅŸlangÄ±Ã§ ve bitiÅŸ tarihi
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() + mondayOffset - (w * 7));
            weekStart.setHours(0, 0, 0, 0);

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);
            weekEnd.setHours(0, 0, 0, 0);

            // Bu haftanÄ±n Ã¼retim loglarÄ±nÄ± Ã§ek
            const logs = await prisma.productionLog.findMany({
                where: {
                    createdAt: {
                        gte: weekStart,
                        lt: weekEnd
                    }
                }
            });

            // GÃ¼nlÃ¼k daÄŸÄ±lÄ±m
            const dailyData: { day: string; count: number }[] = [];
            for (let d = 0; d < 7; d++) {
                const dayDate = new Date(weekStart);
                dayDate.setDate(weekStart.getDate() + d);

                const dayLogs = logs.filter(log => {
                    const logDate = new Date(log.createdAt);
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
        console.error("Historical data fetch error:", e);
        return { error: "Veri Ã§ekilirken hata oluÅŸtu" };
    }
}

// ÃœrÃ¼n durumunu gÃ¼ncelle (APPROVED, IN_PRODUCTION, COMPLETED, etc.)
export async function updateProductStatus(productId: number, status: string) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz iÅŸlem" };

    const role = (session.user as any).role;
    // ADMIN, PLANNER (view only), ENGINEER can update status
    if (!["ADMIN", "ENGINEER"].includes(role)) {
        return { error: "Bu işlem için yetkiniz yok. Sadece Admin veya Üretim Mühendisi güncelleyebilir." };
    }

    const userId = parseInt((session.user as any).id);

    // Valid status values
    const validStatuses = [
        "APPROVED",
        "IN_PRODUCTION",
        "COMPLETED",
        "MARKETING_REVIEW"
    ];

    if (!validStatuses.includes(status)) {
        return { error: "Geçersiz durum değeri" };
    }

    try {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: { order: true }
        });

        if (!product) {
            return { error: "Ürün bulunamadı" };
        }

        const oldStatus = product.status;

        await prisma.product.update({
            where: { id: productId },
            data: {
                status,
                // Reset subStatus when main status changes
                subStatus: null
            }
        });

        await createAuditLog(
            "UPDATE_STATUS",
            "Product",
            product.systemCode,
            `Durum güncellendi: ${oldStatus} -> ${status}`,
            userId
        );

        revalidatePath("/dashboard/production-planning");
        revalidatePath("/dashboard/warehouse");
        revalidatePath("/dashboard/marketing");
        return { success: true };
    } catch (e) {
        console.error("Update product status error:", e);
        return { error: "Durum güncellenirken hata oluştu" };
    }
}

// Ürün alt durumunu güncelle (Döşemede, Montajda, Sevk Bekliyor, etc.)
export async function updateProductSubStatus(productId: number, subStatus: string | null) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz işlem" };

    const role = (session.user as any).role;
    // ADMIN and ENGINEER can update sub-status
    if (!["ADMIN", "ENGINEER"].includes(role)) {
        return { error: "Bu işlem için yetkiniz yok. Sadece Admin veya Üretim Mühendisi güncelleyebilir." };
    }

    const userId = parseInt((session.user as any).id);

    try {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: { order: true }
        });

        if (!product) {
            return { error: "ÃœrÃ¼n bulunamadÄ±" };
        }

        const oldSubStatus = product.subStatus;

        await prisma.product.update({
            where: { id: productId },
            data: { subStatus: subStatus || null }
        });

        await createAuditLog(
            "UPDATE_SUB_STATUS",
            "Product",
            product.systemCode,
            `Alt durum gÃ¼ncellendi: ${oldSubStatus || '-'} -> ${subStatus || '-'}`,
            userId
        );

        revalidatePath("/dashboard/production-planning");
        revalidatePath("/dashboard/warehouse");
        return { success: true };
    } catch (e) {
        console.error("Update product sub-status error:", e);
        return { error: "Alt durum gÃ¼ncellenirken hata oluÅŸtu" };
    }
}

// Toplu durum gÃ¼ncelleme
export async function bulkUpdateProductStatus(productIds: number[], status: string) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz iÅŸlem" };

    const role = (session.user as any).role;
    if (!["ADMIN", "ENGINEER"].includes(role)) {
        return { error: "Bu iÅŸlem iÃ§in yetkiniz yok" };
    }

    const userId = parseInt((session.user as any).id);

    try {
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } }
        });

        for (const product of products) {
            await prisma.product.update({
                where: { id: product.id },
                data: {
                    status,
                    subStatus: null
                }
            });
            await createAuditLog(
                "BULK_UPDATE_STATUS",
                "Product",
                product.systemCode,
                `Toplu durum gÃ¼ncelleme: ${status}`,
                userId
            );
        }

        revalidatePath("/dashboard/production-planning");
        revalidatePath("/dashboard/warehouse");
        return { success: true, count: products.length };
    } catch (e) {
        console.error("Bulk update status error:", e);
        return { error: "Toplu gÃ¼ncelleme baÅŸarÄ±sÄ±z" };
    }
}

// Toplu alt durum gÃ¼ncelleme
export async function bulkUpdateProductSubStatus(productIds: number[], subStatus: string) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz iÅŸlem" };

    const role = (session.user as any).role;
    if (!["ADMIN", "ENGINEER"].includes(role)) {
        return { error: "Bu iÅŸlem iÃ§in yetkiniz yok" };
    }

    const userId = parseInt((session.user as any).id);

    try {
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } }
        });

        for (const product of products) {
            await prisma.product.update({
                where: { id: product.id },
                data: { subStatus }
            });
            await createAuditLog(
                "BULK_UPDATE_SUB_STATUS",
                "Product",
                product.systemCode,
                `Toplu alt durum gÃ¼ncelleme: ${subStatus}`,
                userId
            );
        }

        revalidatePath("/dashboard/production-planning");
        revalidatePath("/dashboard/warehouse");
        return { success: true, count: products.length };
    } catch (e) {
        console.error("Bulk update sub-status error:", e);
        return { error: "Toplu gÃ¼ncelleme baÅŸarÄ±sÄ±z" };
    }
}

// Muhendis notu guncelleme
export async function updateEngineerNote(productId: number, note: string) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz iÅŸlem" };

    const role = (session.user as any).role;
    if (!["ADMIN", "ENGINEER"].includes(role)) {
        return { error: "Bu iÅŸlem iÃ§in yetkiniz yok" };
    }

    const userId = parseInt((session.user as any).id);

    try {
        const product = await prisma.product.findUnique({
            where: { id: productId }
        });

        if (!product) {
            return { error: "ÃœrÃ¼n bulunamadÄ±" };
        }

        await prisma.product.update({
            where: { id: productId },
            data: { engineerNote: note || null }
        });

        await createAuditLog(
            "UPDATE_ENGINEER_NOTE",
            "Product",
            product.systemCode,
            `MÃ¼hendis notu gÃ¼ncellendi`,
            userId
        );

        revalidatePath("/dashboard/production-planning");
        return { success: true };
    } catch (e) {
        console.error("Update engineer note error:", e);
        return { error: "Not gÃ¼ncellenirken hata oluÅŸtu" };
    }
}

// Uretim asamasi miktar guncelleme
export async function updateProductionStageQuantity(
    productId: number,
    stage: 'cut' | 'upholstery' | 'assembly' | 'quality' | 'packaged',
    quantity: number
) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz iÅŸlem" };

    const role = (session.user as any).role;
    if (!["ADMIN", "ENGINEER"].includes(role)) {
        return { error: "Bu iÅŸlem iÃ§in yetkiniz yok" };
    }

    const userId = parseInt((session.user as any).id);

    try {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: { inventory: true }
        });

        if (!product) {
            return { error: "ÃœrÃ¼n bulunamadÄ±" };
        }

        // Miktar kontrolu
        if (quantity < 0) {
            return { error: "Miktar 0'dan kÃ¼Ã§Ã¼k olamaz" };
        }

        if (quantity > product.quantity) {
            return { error: `Miktar planlanan adetten (${product.quantity}) fazla olamaz` };
        }

        const stageFieldMap: Record<string, string> = {
            'cut': 'cutQuantity',
            'upholstery': 'upholsteryQty',
            'assembly': 'assemblyQty',
            'quality': 'qualityQty',
            'packaged': 'packagedQty'
        };

        const stageNameMap: Record<string, string> = {
            'cut': 'Kesim',
            'upholstery': 'DÃ¶ÅŸeme',
            'assembly': 'Montaj',
            'quality': 'Kalite Kontrol',
            'packaged': 'Paketleme'
        };

        const updateData: any = {
            [stageFieldMap[stage]]: quantity
        };

        // Eger paketleme ise ve miktar uretilen miktara esitse, durumu guncelle
        if (stage === 'packaged') {
            // Paketlenen miktar uretilen miktara esit veya buyukse COMPLETED yap
            if (quantity >= product.produced && product.produced > 0) {
                updateData.subStatus = 'Paketlendi';
                // Eger tum uretim tamamlandiysa COMPLETED yap
                if (product.produced >= product.quantity) {
                    updateData.status = 'COMPLETED';
                }
            }
        }

        await prisma.product.update({
            where: { id: productId },
            data: updateData
        });

        await createAuditLog(
            "UPDATE_STAGE_QUANTITY",
            "Product",
            product.systemCode,
            `${stageNameMap[stage]} miktarÄ± gÃ¼ncellendi: ${quantity} adet`,
            userId
        );

        revalidatePath("/dashboard/production-planning");
        revalidatePath("/dashboard/warehouse");
        return { success: true };
    } catch (e) {
        console.error("Update stage quantity error:", e);
        return { error: "Miktar gÃ¼ncellenirken hata oluÅŸtu" };
    }
}


export async function updateProductStages(
    id: number,
    stages: {
        foam?: number;
        upholstery?: number;
        assembly?: number;
        packaged?: number;
        stored?: number;
        shipped?: number;
        engineerNote?: string;
    }
) {
    const session = await auth();
    if (!session || !session.user) return { error: "Yetkisiz işlem" };

    const role = (session.user as any).role;
    if (!["ADMIN", "PLANNER", "MARKETING", "MARKETER", "WORKER", "ENGINEER"].includes(role)) {
        return { error: "Yetkisiz işlem" };
    }
    const userId = parseInt((session.user as any).id);

    try {
        const product = await prisma.product.findUnique({ where: { id } });
        if (!product) return { error: "Ürün bulunamadı" };

        const f = stages.foam ?? product.foamQty ?? 0;
        const u = stages.upholstery ?? product.upholsteryQty;
        const a = stages.assembly ?? product.assemblyQty;
        const p = stages.packaged ?? product.packagedQty;
        const st = stages.stored ?? product.storedQty ?? 0;
        const s = stages.shipped ?? product.shippedQty;
        const note = stages.engineerNote ?? product.engineerNote;

        const totalInStages = f + u + a + p + st + s;
        if (totalInStages > product.quantity) {
            return { error: `Toplam aşama adedi (${totalInStages}) ürün adedini (${product.quantity}) geçemez` };
        }

        let newStatus = product.status;
        if (s === product.quantity) {
            newStatus = "SHIPPED";
        } else if (st + s === product.quantity) {
            // If everything is stored or shipped (implied finished), user wanted "Bitti/Depoda" logic.
            // If completely stored, it is effectively COMPLETED from production view.
            newStatus = "COMPLETED";
        } else if (p + st + s === product.quantity) {
            newStatus = "COMPLETED"; // Packaged is also "finished" production
        } else if (totalInStages > 0) {
            newStatus = "IN_PRODUCTION";
        }

        await prisma.product.update({
            where: { id },
            data: {
                foamQty: f,
                upholsteryQty: u,
                assemblyQty: a,
                packagedQty: p,
                storedQty: st,
                shippedQty: s,
                engineerNote: note,
                status: newStatus
            }
        });

        await createAuditLog(
            "UPDATE_STAGES",
            "Product",
            product.systemCode,
            `Stages updated: Upholstery=${u}, Assembly=${a}, Packaged=${p}, Shipped=${s}. Status: ${newStatus}`,
            userId
        );

        revalidatePath("/dashboard/planning");
        revalidatePath("/dashboard/production");
        revalidatePath("/dashboard/warehouse");

        return { success: true };

    } catch (e) {
        console.error("Update stages error:", e);
        return { error: "AÅŸama gÃ¼ncellenirken hata oluÅŸtu" };
    }
}

export async function clearAllProductionData() {
    const session = await auth();
    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
        return { error: "Yetkisiz iÅŸlem - Sadece admin yapabilir" };
    }

    try {
        // SÄ±rayla baÄŸÄ±mlÄ± tablolarÄ± temizle
        await prisma.shipmentItem.deleteMany({});
        await prisma.shipment.deleteMany({});
        await prisma.productionLog.deleteMany({});
        await prisma.inventory.deleteMany({});
        await prisma.bomItem.deleteMany({});
        await prisma.product.deleteMany({});
        await prisma.order.deleteMany({});

        const currentUserId = parseInt((session.user as any).id);
        await createAuditLog("DELETE", "System", "ALL", "TÃ¼m Ã¼retim verileri temizlendi", currentUserId);

        revalidatePath("/dashboard");
        revalidatePath("/dashboard/planning");
        revalidatePath("/dashboard/production");
        revalidatePath("/dashboard/warehouse");

        return { success: true, message: "Tüm veriler temizlendi" };
    } catch (e) {
        console.error("Veri temizleme hatası:", e);
        return { error: "Veriler temizlenirken hata oluştu" };
    }
}

// Depoya giriş - Paketlenmiş üründen depoya aktarım
// packagedQty azalır, storedQty artar
export async function transferToWarehouse(data: {
    productId: number;
    quantity: number;
    shelf?: string;
}) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz işlem" };

    const role = (session.user as any).role;
    if (!["ADMIN", "WORKER", "WAREHOUSE", "PLANNER"].includes(role)) {
        return { error: "Bu işlem için yetkiniz yok" };
    }

    const userId = parseInt((session.user as any).id);

    try {
        const product = await prisma.product.findUnique({
            where: { id: data.productId }
        });

        if (!product) {
            return { error: "Ürün bulunamadı" };
        }

        const packagedQty = product.packagedQty || 0;

        if (data.quantity <= 0) {
            return { error: "Geçerli bir miktar girin" };
        }

        if (data.quantity > packagedQty) {
            return { error: `Yetersiz paketlenmiş ürün. Paketlenen: ${packagedQty}` };
        }

        // Transaction ile packagedQty azalt, storedQty artır
        await prisma.$transaction(async (tx) => {
            // Ürünü güncelle
            await tx.product.update({
                where: { id: data.productId },
                data: {
                    packagedQty: { decrement: data.quantity },
                    storedQty: { increment: data.quantity },
                    status: "COMPLETED" // Depoya girince completed olur
                }
            });

            // Eğer raf belirtildiyse inventory'ye ekle
            if (data.shelf) {
                const existingInventory = await tx.inventory.findFirst({
                    where: {
                        productId: data.productId,
                        shelf: data.shelf
                    }
                });

                if (existingInventory) {
                    await tx.inventory.update({
                        where: { id: existingInventory.id },
                        data: { quantity: { increment: data.quantity } }
                    });
                } else {
                    await tx.inventory.create({
                        data: {
                            productId: data.productId,
                            shelf: data.shelf,
                            quantity: data.quantity
                        }
                    });
                }
            }

            // Production log oluştur
            await tx.productionLog.create({
                data: {
                    productId: data.productId,
                    quantity: data.quantity,
                    shelf: data.shelf || null,
                    userId: userId
                }
            });
        });

        await createAuditLog(
            "TRANSFER_TO_WAREHOUSE",
            "Product",
            product.systemCode,
            `${data.quantity} adet depoya alındı. Raf: ${data.shelf || "Belirtilmedi"}. Kalan paketlenmiş: ${packagedQty - data.quantity}`,
            userId
        );

        revalidatePath("/dashboard/production");
        revalidatePath("/dashboard/production-planning");
        revalidatePath("/dashboard/warehouse");

        return { success: true };
    } catch (e) {
        console.error("Transfer to warehouse error:", e);
        return { error: "Depoya giriş sırasında hata oluştu" };
    }
}

// Ürünleri üretime gönder (PENDING -> IN_PRODUCTION)
export async function sendProductsToProduction(productIds: number[], productionDate?: Date) {
    const session = await auth();
    if (!session || (session.user as any).role !== "ADMIN") {
        return { error: "Yetkisiz işlem. Sadece admin ürünleri üretime gönderebilir." };
    }

    if (!productIds || productIds.length === 0) {
        return { error: "Lütfen en az bir ürün seçin" };
    }

    try {
        const userId = parseInt((session.user as any).id);

        // Seçili ürünleri kontrol et - PENDING veya APPROVED olanları kabul et
        const products = await prisma.product.findMany({
            where: {
                id: { in: productIds },
                status: {
                    in: ["PENDING", "APPROVED"]
                }
            }
        });

        if (products.length === 0) {
            return { error: "Seçili ürünlerin tümü zaten üretime gönderilmiş veya farklı bir durumda." };
        }

        // Ürünleri IN_PRODUCTION yap ve productionDate set et
        await prisma.product.updateMany({
            where: {
                id: { in: products.map(p => p.id) }
            },
            data: {
                status: "IN_PRODUCTION",
                productionDate: productionDate || new Date()
            }
        });

        // Audit log kaydet
        for (const product of products) {
            await createAuditLog(
                "SEND_TO_PRODUCTION",
                "Product",
                product.systemCode,
                `Ürün üretime gönderildi. Üretim tarihi: ${productionDate ? productionDate.toLocaleDateString('tr-TR') : 'Bugün'}`,
                userId
            );
        }

        revalidatePath("/dashboard/production-calendar");
        revalidatePath("/dashboard/production-planning");
        revalidatePath("/dashboard");

        // Mesaj: Kaç tane aktarıldı, kaç tanesi zaten üretimdeydi
        const alreadyInProduction = productIds.length - products.length;
        let message = `${products.length} ürün üretime gönderildi`;
        if (alreadyInProduction > 0) {
            message += `. ${alreadyInProduction} ürün zaten üretimde olduğu için atlandı.`;
        }

        return { success: true, count: products.length, message };
    } catch (e) {
        console.error("Send to production error:", e);
        return { error: "Üretime gönderme sırasında hata oluştu" };
    }
}

// Ürünün productionDate'ini güncelle
export async function updateProductionDate(productId: number, productionDate: Date | null) {
    const session = await auth();
    if (!session || !["ADMIN", "PLANNER"].includes((session.user as any).role)) {
        return { error: "Yetkisiz işlem" };
    }

    try {
        const userId = parseInt((session.user as any).id);

        const product = await prisma.product.findUnique({
            where: { id: productId }
        });

        if (!product) {
            return { error: "Ürün bulunamadı" };
        }

        await prisma.product.update({
            where: { id: productId },
            data: { productionDate }
        });

        await createAuditLog(
            "UPDATE_PRODUCTION_DATE",
            "Product",
            product.systemCode,
            `Üretim tarihi güncellendi: ${productionDate ? productionDate.toLocaleDateString('tr-TR') : 'Kaldırıldı'}`,
            userId
        );

        revalidatePath("/dashboard/production-calendar");
        revalidatePath("/dashboard/production-planning");

        return { success: true };
    } catch (e) {
        console.error("Update production date error:", e);
        return { error: "Üretim tarihi güncellenemedi" };
    }
}

// Ürün bilgilerini güncelleme (takvim sayfası için - tüm alanlar)
export async function updateProductFields(
    productId: number,
    updates: {
        productionDate?: Date | null;
        terminDate?: Date | null;
        master?: string | null;
        description?: string | null;
        material?: string | null;
        footType?: string | null;
        footMaterial?: string | null;
        armType?: string | null;
        backType?: string | null;
        fabricType?: string | null;
        engineerNote?: string | null;
        foamQty?: number;
        upholsteryQty?: number;
        assemblyQty?: number;
        packagedQty?: number;
        storedQty?: number;
        shippedQty?: number;
    }
) {
    const session = await auth();
    if (!session || (session.user as any).role !== "ADMIN") {
        return { error: "Yetkisiz işlem" };
    }

    try {
        const userId = parseInt((session.user as any).id);

        const product = await prisma.product.findUnique({
            where: { id: productId }
        });

        if (!product) {
            return { error: "Ürün bulunamadı" };
        }

        // Sadece gönderilen alanları güncelle (undefined olanları atla)
        const data: Record<string, any> = {};
        const changes: string[] = [];

        if (updates.productionDate !== undefined) {
            data.productionDate = updates.productionDate;
            changes.push(`Üretim tarihi: ${updates.productionDate ? updates.productionDate.toLocaleDateString('tr-TR') : 'Kaldırıldı'}`);
        }
        if (updates.terminDate !== undefined) {
            data.terminDate = updates.terminDate;
            changes.push(`Termin tarihi: ${updates.terminDate ? updates.terminDate.toLocaleDateString('tr-TR') : 'Kaldırıldı'}`);
        }
        if (updates.master !== undefined) {
            data.master = updates.master;
            changes.push(`Usta: ${updates.master || 'Kaldırıldı'}`);
        }
        if (updates.description !== undefined) {
            data.description = updates.description;
            changes.push(`Açıklama güncellendi`);
        }
        if (updates.material !== undefined) { data.material = updates.material; changes.push(`Malzeme: ${updates.material || '-'}`); }
        if (updates.footType !== undefined) { data.footType = updates.footType; changes.push(`Ayak Tipi: ${updates.footType || '-'}`); }
        if (updates.footMaterial !== undefined) { data.footMaterial = updates.footMaterial; changes.push(`Ayak Malzeme: ${updates.footMaterial || '-'}`); }
        if (updates.armType !== undefined) { data.armType = updates.armType; changes.push(`Kol Tipi: ${updates.armType || '-'}`); }
        if (updates.backType !== undefined) { data.backType = updates.backType; changes.push(`Sırt Tipi: ${updates.backType || '-'}`); }
        if (updates.fabricType !== undefined) { data.fabricType = updates.fabricType; changes.push(`Kumaş Tipi: ${updates.fabricType || '-'}`); }
        if (updates.engineerNote !== undefined) { data.engineerNote = updates.engineerNote; changes.push(`Mühendis notu güncellendi`); }

        // Üretim aşama miktarları
        if (updates.foamQty !== undefined) { data.foamQty = updates.foamQty; changes.push(`Sünger: ${updates.foamQty}`); }
        if (updates.upholsteryQty !== undefined) { data.upholsteryQty = updates.upholsteryQty; changes.push(`Döşeme: ${updates.upholsteryQty}`); }
        if (updates.assemblyQty !== undefined) { data.assemblyQty = updates.assemblyQty; changes.push(`Montaj: ${updates.assemblyQty}`); }
        if (updates.packagedQty !== undefined) { data.packagedQty = updates.packagedQty; changes.push(`Paket: ${updates.packagedQty}`); }
        if (updates.storedQty !== undefined) { data.storedQty = updates.storedQty; changes.push(`Depo: ${updates.storedQty}`); }
        if (updates.shippedQty !== undefined) { data.shippedQty = updates.shippedQty; changes.push(`Sevk: ${updates.shippedQty}`); }

        await prisma.product.update({
            where: { id: productId },
            data
        });

        await createAuditLog(
            "UPDATE",
            "Product",
            product.systemCode,
            changes.join(', '),
            userId
        );

        revalidatePath("/dashboard/production-calendar");
        revalidatePath("/dashboard/production-planning");

        return { success: true };
    } catch (e) {
        console.error("Update product error:", e);
        return { error: "Ürün güncellenemedi" };
    }
}
