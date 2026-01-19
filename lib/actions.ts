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
        return { error: "Onaylanmış ürünleri sadece Admin iptal edebilir" };
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

    const updates: any = {};
    let logDetails = "";

    const quantityStr = formData.get("quantity");
    if (quantityStr) {
        updates.quantity = parseInt(quantityStr as string);
        logDetails += `Qty updated to ${updates.quantity}. `;
    }

    // Produced update is handled via logProduction typically, but if manual edit:
    // We should probably NOT allow manual edit of 'produced' via this form anymore without adjusting Inventory.
    // But for simplicity letting it slide, but better to prevent data mismatch.
    // If worker updates 'produced', where does the extra stock go? Unknown shelf?
    // Let's Disable 'produced' update from this form for now to enforce 'logProduction'.
    // Or just update 'Product' and ignore Inventory mismatch (BAD).
    // I'll assume this specific update function is mostly for metadata now.

    const product = await prisma.product.findUnique({ where: { id } });

    // Status logic
    if (product && product.status === 'REJECTED') {
        updates.status = 'PENDING';
    }

    try {
        const product = await prisma.product.update({
            where: { id },
            data: {
                name,
                model,
                company,
                terminDate,
                material,
                description,
                footType: footType || null,
                footMaterial: footMaterial || null,
                armType: armType || null,
                backType: backType || null,
                fabricType: fabricType || null,
                ...updates
            }
        });

        await createAuditLog("UPDATE", "Product", product.systemCode, logDetails || "Updated details", userId);
        revalidatePath("/dashboard/warehouse");
        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (e) {
        return { error: "Güncelleme sırasında hata oluştu" };
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
        masterId?: number;
    }[];
}

export async function createOrder(data: CreateOrderData) {
    const session = await auth();
    if (!session) return { error: "Yetkisiz işlem" };
    const userId = parseInt((session.user as any).id);

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
                    masterId: item.masterId,
                    systemCode: systemCode,
                    imageUrl: `/${item.code}.png`,
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

// --- Helper Actions ---

export async function getAttributes(category: string) {
    return await prisma.productFeature.findMany({
        where: { category },
        orderBy: { name: 'asc' }
    });
}

export async function getMasters() {
    // Assuming WORKER role = Usta. Filtering by role.
    return await prisma.user.findMany({
        where: { role: 'WORKER' },
        select: { id: true, username: true } // username is Name
    });
}

export async function ensureAttributes() {
    // Seed basic attributes if empty
    const count = await prisma.productFeature.count();
    if (count === 0) {
        const defaults = [
            // Foot Model (Ayak Modeli)
            { category: 'Ayak', name: 'Lukens' },
            { category: 'Ayak', name: 'Piramit' },
            { category: 'Ayak', name: 'Koni' },

            // Foot Material (Ayak Materyali)
            { category: 'Ayak Materyali', name: 'Ahşap - Ceviz' },
            { category: 'Ayak Materyali', name: 'Ahşap - Meşe' },
            { category: 'Ayak Materyali', name: 'Metal - Krom' },
            { category: 'Ayak Materyali', name: 'Metal - Siyah' },
            { category: 'Ayak Materyali', name: 'Plastik' },

            // Arm
            { category: 'Kol', name: 'P-Kol' },
            { category: 'Kol', name: 'T-Kol' },
            { category: 'Kol', name: 'Ahşap Kol' },

            // Back
            { category: 'Sırt', name: 'Sabit' },
            { category: 'Sırt', name: 'Mekanizmalı' },
            { category: 'Sırt', name: 'Kapitone' },

            // Fabric
            { category: 'Kumaş', name: 'Kadife - Gri' },
            { category: 'Kumaş', name: 'Kadife - Bej' },
            { category: 'Kumaş', name: 'Keten - Antrasit' },
            { category: 'Kumaş', name: 'Deri - Siyah' },
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
    return products.map(p => {
        const shipped = p.shipmentItems.reduce((sum, item) => sum + item.quantity, 0);
        const available = p.produced - shipped;
        return {
            ...p,
            shipped,
            available
        };
    }).filter(p => p.available > 0);
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

        revalidatePath("/dashboard/shipment");
        return { success: true, shipmentId: shipment.id };
    } catch (e) {
        console.error(e);
        return { error: "Sevkiyat oluşturulurken hata oluştu." };
    }
}





