'use server';

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

// Helper to create audit logs
async function createAuditLog(action: string, entity: string, entityId: string, details: string, userId: number) {
    try {
        await (prisma as any).auditLog.create({
            data: {
                action,
                entity,
                entityId,
                details,
                userId
            }
        });
    } catch (e) {
        console.error("Audit log creation failed:", e);
    }
}

import { writeFile } from "fs/promises";
import { join } from "path";

export async function createProduct(formData: FormData) {
    const session = await auth();
    if (!session || !["ADMIN", "PLANNER", "MARKETER"].includes((session.user as any).role)) {
        return { error: "Yetkisiz işlem" };
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
        return { error: "Kullanıcı bulunamadı." };
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
                company: company || null,
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
        return { error: "Ürün oluşturulurken bir hata oluştu." };
    }
}

export async function cancelProduct(id: number) {
    const session = await auth();
    const role = (session?.user as any).role;
    const userId = parseInt((session?.user as any).id);

    if (!session) return { error: "Yetkisiz işlem" };

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return { error: "Bulunamadı" };

    if (product.status === "APPROVED" && role !== "ADMIN") {
        return { error: "Onaylanmış ürünleri sadece Yönetici iptal edebilir" };
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
        return { error: "İptal edilirken bir hata oluştu." };
    }
}

export async function updateProduct(id: number, formData: FormData) {
    const session = await auth();
    const role = (session?.user as any).role;
    const userId = parseInt((session?.user as any).id);

    if (!session || !["ADMIN", "PLANNER", "WORKER"].includes(role)) {
        return { error: "Yetkisiz işlem" };
    }

    // Önce ürünü kontrol et - onaylanmış ürünleri sadece admin düzenleyebilir
    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
        return { error: "Ürün bulunamadı" };
    }

    const isApprovedOrCompleted = existingProduct.status === 'APPROVED' ||
        existingProduct.status === 'COMPLETED' ||
        existingProduct.status === 'IN_PRODUCTION';

    if (isApprovedOrCompleted && role !== 'ADMIN') {
        return { error: "Onaylanmış ürünleri sadece Yönetici düzenleyebilir" };
    }

    const name = formData.get("name") as string;
    const model = formData.get("model") as string;
    const company = formData.get("company") as string;
    const terminDateStr = formData.get("terminDate") as string;
    const terminDate = terminDateStr ? new Date(terminDateStr) : undefined;
    const material = formData.get("material") as string;
    const description = formData.get("description") as string;

    // shelf removal

    const footType = formData.get("footType") as string;
    const footMaterial = formData.get("footMaterial") as string;
    const armType = formData.get("armType") as string;
    const backType = formData.get("backType") as string;
    const fabricType = formData.get("fabricType") as string;
    const master = formData.get("master") as string;

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

    // Status logic - existingProduct zaten yukarıda çekildi
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
    if (!session || !session.user || (session.user as any).role !== "ADMIN") return { error: "Yetkisiz işlem" };
    const userId = parseInt((session.user as any).id);

    try {
        const product = await prisma.product.findUnique({ where: { id } });
        if (!product) return { error: "Bulunamadı" };

        const barcode = product.systemCode;

        await prisma.product.update({
            where: { id },
            data: {
                status: "APPROVED",
                barcode: barcode,
                rejectionReason: null
            }
        });

        await createAuditLog("APPROVE", "Product", product.systemCode, `Product approved. Barcode set to: ${barcode}`, userId);
        revalidatePath("/dashboard/admin/approvals");
        return { success: true };
    } catch (e) {
        return { error: "Onaylanırken hata oluştu" };
    }
}

// Fix logProduction to remove shelf column usage
export async function logProduction(barcode: string, quantity: number, shelf: string) {
    const session = await auth();
    if (!session) return { error: "Unauthorized" };

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
    const newStatus = newProduced >= product.quantity ? "COMPLETED" : "APPROVED";

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
    return await prisma.product.findUnique({
        where: { barcode },
        include: { inventory: true }
    });
}

export async function revokeApproval(id: number) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return { error: "Ürün bulunamadı" };
    const session = await auth();
    const userId = parseInt((session?.user as any).id);

    if (product.status === 'COMPLETED') {
        return { error: "Tamamlanmış ürünün onayı iptal edilemez." };
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
        return { error: "İptal edilirken hata oluştu." };
    }
}

export async function rejectProduct(id: number, reason: string) {
    const session = await auth();
    if (!session || !session.user || (session.user as any).role !== "ADMIN") return { error: "Yetkisiz işlem" };
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
        return { error: "İşlem başarısız" };
    }
}

export async function createUser(prevState: any, formData: FormData) {
    const session = await auth();
    if (!session || !session.user || (session.user as any).role !== "ADMIN") return { error: "Yetkisiz işlem" };

    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as string;

    if (!username || !password || !role) return { error: "Eksik alanlar" };

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) return { error: "Bu kullanıcı adı zaten kullanılıyor." };

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const newUser = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                role
            }
        });

        await createAuditLog("CREATE", "User", username, `User created with role: ${role}`, parseInt((session.user as any).id));

        revalidatePath("/dashboard/admin/users");
        return { success: true };
    } catch (e) {
        return { error: "Kullanıcı oluşturulurken bir hata oluştu." };
    }
}

export async function deleteUser(id: number) {
    const session = await auth();
    if (!session || !session.user || (session.user as any).role !== "ADMIN") return { error: "Yetkisiz işlem" };

    const currentUserId = parseInt((session.user as any).id);
    if (currentUserId === id) {
        return { error: "Kendi hesabınızı silemezsiniz." };
    }

    try {
        const userToDelete = await prisma.user.findUnique({ where: { id } });
        await prisma.user.delete({ where: { id } });

        if (userToDelete) {
            await createAuditLog("DELETE", "User", userToDelete.username, `User deleted ID: ${id}`, currentUserId);
        }

        revalidatePath("/dashboard/admin/users");
        return { success: true };
    } catch (e) {
        return { error: "Silinirken hata oluştu" };
    }
}

// --- Order & Planning Actions ---

export async function searchCatalog(query: string) {
    const session = await auth();
    if (!session) return [];

    if (!query || query.length < 2) return [];
    return await prisma.productCatalog.findMany({
        where: {
            OR: [
                { code: { contains: query } },
                { name: { contains: query } }
            ]
        },
        take: 20
    });
}

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
        // SystemCode format: ORD{order.id}-{code}-{index}
        // This ensures uniqueness even if same item appears twice or in other orders.
        // ImageUrl: /{code}.png (Shared sku image)

        for (let i = 0; i < data.items.length; i++) {
            const item = data.items[i];
            const systemCode = `ORD${order.id}-${item.code}-${i + 1}`;

            // Handle Date conversion
            let tDate: Date | null = null;
            if (item.terminDate) {
                tDate = typeof item.terminDate === 'string' ? new Date(item.terminDate) : item.terminDate;
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
            orderName: order.orderName || order.name || "",
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

// --- Helper Actions ---

export async function getAttributes(category: string) {
    return await prisma.productFeature.findMany({
        where: { category },
        orderBy: { name: 'asc' }
    });
}

export async function getMasters() {
    return await getAttributes('MASTER');
}

export async function ensureAttributes() {
    // Seed basic attributes if empty
    const count = await prisma.productFeature.count();
    if (count === 0) {
        const defaults = [
            // Foot Model (Ayak Modeli)
            { category: 'FOOT_TYPE', name: 'Lukens' },
            { category: 'FOOT_TYPE', name: 'Piramit' },
            { category: 'FOOT_TYPE', name: 'Koni' },

            // Foot Material (Ayak Materyali)
            { category: 'FOOT_MATERIAL', name: 'Ahşap - Ceviz' },
            { category: 'FOOT_MATERIAL', name: 'Ahşap - Meşe' },
            { category: 'FOOT_MATERIAL', name: 'Metal - Krom' },
            { category: 'FOOT_MATERIAL', name: 'Metal - Siyah' },
            { category: 'FOOT_MATERIAL', name: 'Plastik' },

            // Arm
            { category: 'ARM_TYPE', name: 'P-Kol' },
            { category: 'ARM_TYPE', name: 'T-Kol' },
            { category: 'ARM_TYPE', name: 'Ahşap Kol' },

            // Back
            { category: 'BACK_TYPE', name: 'Sabit' },
            { category: 'BACK_TYPE', name: 'Mekanizmalı' },
            { category: 'BACK_TYPE', name: 'Kapitone' },

            // Fabric
            { category: 'FABRIC_TYPE', name: 'Kadife - Gri' },
            { category: 'FABRIC_TYPE', name: 'Kadife - Bej' },
            { category: 'FABRIC_TYPE', name: 'Keten - Antrasit' },
            { category: 'FABRIC_TYPE', name: 'Deri - Siyah' },
        ];
        for (const d of defaults) {
            await prisma.productFeature.create({ data: d });
        }
    }
}



export async function getReadyToShipProducts() {
    const products = await prisma.product.findMany({
        where: {
            produced: { gt: 0 }
        },
        include: {
            order: true,
            shipmentItems: true
        },
        orderBy: { createdAt: 'desc' }
    });

    // Filter available
    return products.map((p: any) => {
        const shipped = p.shipmentItems.reduce((sum: any, item: any) => sum + item.quantity, 0);
        const available = p.produced - shipped;
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

    if (!product) return { error: "Ürün bulunamadı" };

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
            title: 'Sipariş Oluşturuldu',
            description: `Sipariş: ${product.order?.name || '-'} | Kod: ${product.systemCode}`,
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
            title: 'Üretim Girişi',
            description: `${l.quantity} adet üretildi. ${l.shelf ? `Raf: ${l.shelf}` : ''}`,
            user: l.user?.username
        })),
        ...shipmentItems.map((s: any) => ({
            id: `ship-${s.id}`,
            date: s.shipment.createdAt,
            type: 'SHIPMENT',
            title: 'Sevkiyat Planlandı',
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
        case 'CREATE_ORDER': return 'Sipariş Girildi';
        case 'UPDATE': return 'Güncelleme Yapıldı';
        case 'APPROVE': return 'Onaylandı (Üretime Hazır)';
        case 'REJECT': return 'Reddedildi';
        case 'CANCEL': return 'İptal Edildi';
        case 'CREATE_FEATURE': return 'Özellik Eklendi';
        default: return action;
    }
}

// --- Yarı Mamül Actions ---

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

// --- Geçmişe Dönük Üretim Verileri ---

export async function getHistoricalProductionData(weeksCount: number = 4) {
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

            // Bu haftanın üretim loglarını çek
            const logs = await prisma.productionLog.findMany({
                where: {
                    createdAt: {
                        gte: weekStart,
                        lt: weekEnd
                    }
                }
            });

            // Günlük dağılım
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
        return { error: "Veri çekilirken hata oluştu" };
    }
}

export async function deleteProduct(id: number) {
    const session = await auth();
    if (!session || !session.user || !['ADMIN', 'PLANNER'].includes((session.user as any).role)) {
        return { error: "Yetkisiz işlem: Sadece Admin ve Planlama yetkilisi silebilir." };
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
            await prisma.product.update({
                where: { id: product.id },
                data: {
                    status: "APPROVED",
                    barcode: product.systemCode,
                    rejectionReason: null
                }
            });
            await createAuditLog("BULK_APPROVE", "Product", product.systemCode, `Product approved in bulk operation`, userId);
        }

        revalidatePath("/dashboard/admin/approvals");
        revalidatePath("/dashboard/planning");
        return { success: true, count: products.length };
    } catch (e) {
        console.error("Bulk Approve Error:", e);
        return { error: "Toplu onaylama başarısız" };
    }
}

export async function bulkReject(productIds: number[], reason: string) {
    const session = await auth();
    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
        return { error: "Yetkisiz işlem" };
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
        return { error: "Toplu reddetme başarısız" };
    }
}

export async function bulkDelete(productIds: number[]) {
    const session = await auth();
    if (!session || !session.user || !['ADMIN', 'PLANNER'].includes((session.user as any).role)) {
        return { error: "Yetkisiz işlem" };
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
        return { error: "Toplu silme başarısız" };
    }
}
