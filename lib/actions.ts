'use server';

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

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
    const code = formData.get("systemCode") as string;
    const material = formData.get("material") as string;
    const description = formData.get("description") as string;
    const shelf = formData.get("shelf") as string;
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
                systemCode: code,
                material,
                description,
                shelf: shelf || "",
                status: "PENDING",
                createdById: parseInt((session.user as any).id),
            },
        });

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

        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (e) {
        return { error: "İptal edilirken bir hata oluştu." };
    }
}
// ... (skip down to updateProduct) ...
export async function updateProduct(id: number, formData: FormData) {
    const session = await auth();
    // Allow ADMIN, PLANNER, and WORKER
    const role = (session?.user as any).role;
    if (!session || !["ADMIN", "PLANNER", "WORKER"].includes(role)) {
        return { error: "Yetkisiz işlem" };
    }

    const name = formData.get("name") as string;
    const model = formData.get("model") as string;
    const company = formData.get("company") as string;
    const terminDate = new Date(formData.get("terminDate") as string);
    const material = formData.get("material") as string;
    const description = formData.get("description") as string;
    const shelf = formData.get("shelf") as string;

    const updates: any = {};

    // Quantity update (Admin/Planner)
    const quantityStr = formData.get("quantity");
    if (quantityStr) {
        updates.quantity = parseInt(quantityStr as string);
    }

    // Produced update (Admin/Worker)
    const producedStr = formData.get("produced");
    if (producedStr) {
        const newProduced = parseInt(producedStr as string);
        updates.produced = newProduced;

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
        await prisma.product.update({
            where: { id },
            data: {
                name,
                model,
                company,
                terminDate,
                material,
                description,
                shelf,
                ...updates
            }
        });
        revalidatePath("/dashboard/warehouse");
        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (e) {
        return { error: "Güncelleme sırasında hata oluştu" };
    }
}

export async function approveProduct(id: number) {
    const session = await auth();
    if ((session?.user as any).role !== "ADMIN") return { error: "Yetkisiz işlem" };

    try {
        const timestamp = Date.now().toString().slice(-6);
        const barcode = `PROD-${id}-${timestamp}`;

        await prisma.product.update({
            where: { id },
            data: {
                status: "APPROVED",
                barcode: barcode
            }
        });

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
    if ((session?.user as any).role !== "ADMIN") return { error: "Yetkisiz işlem" };

    try {
        await prisma.product.update({
            where: { id },
            data: { status: 'REJECTED' }
        });
        revalidatePath("/dashboard/admin/approvals");
        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (error) {
        return { error: "Reddedilirken hata oluştu." };
    }
}

export async function createUser(prevState: any, formData: FormData) {
    const session = await auth();
    if ((session?.user as any).role !== "ADMIN") return { error: "Yetkisiz işlem" };

    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as string;

    if (!username || !password || !role) return { error: "Eksik alanlar" };

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) return { error: "Bu kullanıcı adı zaten kullanılıyor." };

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                role
            }
        });
        revalidatePath("/dashboard/admin/users");
        return { success: true };
    } catch (e) {
        return { error: "Kullanıcı oluşturulurken bir hata oluştu." };
    }
}

export async function deleteUser(id: number) {
    const session = await auth();
    if ((session?.user as any).role !== "ADMIN") return { error: "Yetkisiz işlem" };

    try {
        await prisma.user.delete({ where: { id } });
        revalidatePath("/dashboard/admin/users");
        return { success: true };
    } catch (e) {
        return { error: "Silinirken hata oluştu" };
    }
}


