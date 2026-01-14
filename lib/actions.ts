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

export async function createProduct(formData: FormData) {
    const session = await auth();
    if (!session || !["ADMIN", "PLANNER"].includes((session.user as any).role)) {
        return { error: "Yetkisiz işlem" };
    }

    const name = formData.get("name") as string;
    const model = formData.get("model") as string;
    const company = formData.get("company") as string;
    const quantity = parseInt(formData.get("quantity") as string);
    const terminDate = new Date(formData.get("terminDate") as string);
    const orderDateStr = formData.get("orderDate") as string;
    const orderDate = orderDateStr ? new Date(orderDateStr) : new Date();
    const code = formData.get("systemCode") as string;
    const material = formData.get("material") as string;
    const description = formData.get("description") as string;
    const shelf = formData.get("shelf") as string;

    // New Configuration Fields
    const footType = formData.get("footType") as string;
    const footMaterial = formData.get("footMaterial") as string;
    const armType = formData.get("armType") as string;
    const backType = formData.get("backType") as string;
    const fabricType = formData.get("fabricType") as string;

    // Shelf is optional now for Planner

    if (!name || !model || !quantity || !terminDate || !code) {
        return { error: "Eksik alanlar" };
    }

    const userId = parseInt((session.user as any).id);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        return { error: "Kullanıcı bulunamadı. Lütfen tekrar giriş yapın." };
    }

    try {
        await prisma.product.create({
            data: {
                name,
                model,
                company,
                quantity,
                terminDate,
                orderDate,
                systemCode: code,
                material,
                description,
                shelf: shelf || "",
                status: "PENDING",
                footType: footType || null,
                footMaterial: footMaterial || null,
                armType: armType || null,
                backType: backType || null,
                fabricType: fabricType || null,
                createdById: parseInt((session.user as any).id),
            },
        });

        // Save to Catalog if requested
        const saveToCatalog = formData.get("saveToCatalog") === "true";
        if (saveToCatalog) {
            try {
                // Check if exists first to avoid unique constraint error
                const existing = await (prisma as any).productCatalog.findUnique({ where: { code } });
                if (!existing) {
                    await (prisma as any).productCatalog.create({
                        data: {
                            code,
                            name
                        }
                    });
                    await createAuditLog("CATALOG_ADD", "ProductCatalog", code, `Added to catalog via planning: ${name}`, userId);
                }
            } catch (e) {
                console.error("Failed to save to catalog:", e);
                // Non-blocking error, just log it
            }
        }

        await createAuditLog("CREATE", "Product", code, `Created product: ${name}, Qty: ${quantity}`, userId);

        revalidatePath("/dashboard/planning");
        revalidatePath("/dashboard/admin/approvals");
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
        // Delete logs first to avoid FK constraint error
        await prisma.$transaction([
            prisma.productionLog.deleteMany({ where: { productId: id } }),
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
    // Allow ADMIN, PLANNER, and WORKER
    const role = (session?.user as any).role;
    const userId = parseInt((session?.user as any).id);

    if (!session || !["ADMIN", "PLANNER", "WORKER"].includes(role)) {
        return { error: "Yetkisiz işlem" };
    }

    // Fix implicit type errors
    if (!prisma) {
        return { error: "Database connection failed" };
    }

    const name = formData.get("name") as string;
    const model = formData.get("model") as string;
    const company = formData.get("company") as string;
    const terminDate = new Date(formData.get("terminDate") as string);
    const material = formData.get("material") as string;
    const description = formData.get("description") as string;
    const shelf = formData.get("shelf") as string;

    const footType = formData.get("footType") as string;
    const footMaterial = formData.get("footMaterial") as string;
    const armType = formData.get("armType") as string;
    const backType = formData.get("backType") as string;
    const fabricType = formData.get("fabricType") as string;

    const updates: any = {};
    let logDetails = "";

    // Quantity update (Admin/Planner)
    const quantityStr = formData.get("quantity");
    if (quantityStr) {
        updates.quantity = parseInt(quantityStr as string);
        logDetails += `Qty updated to ${updates.quantity}. `;
    }

    // Produced update (Admin/Worker)
    const producedStr = formData.get("produced");
    if (producedStr) {
        const newProduced = parseInt(producedStr as string);
        updates.produced = newProduced;
        logDetails += `Produced updated to ${newProduced}. `;

        // Recalculate status based on new produced amount
        const product = await prisma.product.findUnique({ where: { id } });
        if (product) {
            const targetQuantity = updates.quantity || product.quantity;
            if (newProduced >= targetQuantity) {
                updates.status = "COMPLETED";
            } else {
                if (product.status === 'COMPLETED') {
                    updates.status = "APPROVED";
                }
            }
        }
    }

    if (!shelf) {
        return { error: "Eksik alanlar" };
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
                shelf,
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
        const timestamp = Date.now().toString().slice(-6);
        const barcode = `PROD-${id}-${timestamp}`;

        const product = await prisma.product.update({
            where: { id },
            data: {
                status: "APPROVED",
                barcode: barcode
            }
        });

        await createAuditLog("APPROVE", "Product", product.systemCode, `Product approved. Barcode: ${barcode}`, userId);

        revalidatePath("/dashboard/admin/approvals");
        return { success: true };
    } catch (e) {
        return { error: "Onaylanırken hata oluştu" };
    }
}

export async function logProduction(barcode: string, quantity: number, shelf: string) {
    const session = await auth();
    if (!session) return { error: "Unauthorized" };

    const product = await prisma.product.findUnique({ where: { barcode } });
    if (!product) return { error: "Ürün bulunamadı" };

    // Check if shelf matches
    if (product.shelf && shelf !== product.shelf) {
        return { error: `Bu ürün sadece '${product.shelf}' rafına kabul edilebilir.` };
    }

    if (product.produced + quantity > product.quantity) {
        return { error: "Planlanandan fazla üretim girilemez" };
    }

    const newProduced = product.produced + quantity;
    const newStatus = newProduced >= product.quantity ? "COMPLETED" : "APPROVED";

    const userId = parseInt((session.user as any).id);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { error: "Kullanıcı bulunamadı. Lütfen tekrar giriş yapın." };

    try {
        await prisma.$transaction([
            prisma.productionLog.create({
                data: {
                    productId: product.id,
                    quantity,
                    shelf,
                    userId: userId
                }
            }),
            prisma.product.update({
                where: { id: product.id },
                data: {
                    produced: newProduced,
                    status: newStatus
                }
            })
        ]);

        await createAuditLog("PRODUCE", "Product", product.systemCode, `Production logged: ${quantity}. New Total: ${newProduced}`, userId);

        revalidatePath("/dashboard/production");
        revalidatePath("/dashboard"); // Marketing
        return { success: true, product };
    } catch (e) {
        return { error: "Üretim kaydedilirken hata oluştu" };
    }
}

export async function getProductByBarcode(barcode: string) {
    const session = await auth();
    if (!session) return null;
    return await prisma.product.findUnique({ where: { barcode } });
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

export async function rejectProduct(id: number) {
    const session = await auth();
    if (!session || !session.user || (session.user as any).role !== "ADMIN") return { error: "Yetkisiz işlem" };
    const userId = parseInt((session.user as any).id);

    try {
        // Need fetching product to log systemCode? Optimistically update.
        const product = await prisma.product.update({
            where: { id },
            data: { status: 'REJECTED' }
        });

        await createAuditLog("REJECT", "Product", product.systemCode, "Product rejected", userId);

        revalidatePath("/dashboard/admin/approvals");
        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (error) {
        return { error: "Reddedilirken hata oluştu." };
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

    try {
        const userToDelete = await prisma.user.findUnique({ where: { id } });
        await prisma.user.delete({ where: { id } });

        if (userToDelete) {
            await createAuditLog("DELETE", "User", userToDelete.username, `User deleted ID: ${id}`, parseInt((session.user as any).id));
        }

        revalidatePath("/dashboard/admin/users");
        return { success: true };
    } catch (e) {
        return { error: "Silinirken hata oluştu" };
    }
}



export async function searchCatalog(query: string) {
    if (!query || query.length < 2) return [];

    const results = await (prisma as any).productCatalog.findMany({
        where: {
            OR: [
                { name: { contains: query } },
                { code: { contains: query } }
            ]
        },
        take: 20
    });
    return results;
}
