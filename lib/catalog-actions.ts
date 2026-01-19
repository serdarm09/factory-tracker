"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";

const ITEMS_PER_PAGE = 50;

export async function getCatalog(page: number = 1, query: string = "") {
    const skip = (page - 1) * ITEMS_PER_PAGE;

    const where: any = {};
    if (query) {
        where.OR = [
            { name: { contains: query } },
            { code: { contains: query } }
        ];
    }

    const [items, total] = await Promise.all([
        (prisma as any).productCatalog.findMany({
            where,
            orderBy: { name: 'asc' },
            take: ITEMS_PER_PAGE,
            skip
        }),
        (prisma as any).productCatalog.count({ where })
    ]);

    return { items, total, totalPages: Math.ceil(total / ITEMS_PER_PAGE) };
}

export async function searchCatalog(query: string) {
    if (!query || query.length < 2) return [];

    const items = await (prisma as any).productCatalog.findMany({
        where: {
            OR: [
                { name: { contains: query } },
                { code: { contains: query } }
            ]
        },
        take: 20,
        orderBy: { name: 'asc' }
    });

    return items;
}

import { writeFile } from "fs/promises";
import { join } from "path";

export async function addToCatalog(formData: FormData) {
    const session = await auth();
    const role = (session?.user as any)?.role;

    // Allow ADMIN and PLANNER
    if (role !== "ADMIN" && role !== "PLANNER") {
        return { error: "Yetkisiz işlem" };
    }

    const code = formData.get("code") as string;
    const name = formData.get("name") as string;
    const image = formData.get("image") as File | null;

    if (!code || code.trim().length === 0) return { error: "Ürün kodu boş olamaz" };
    if (!name || name.trim().length === 0) return { error: "Ürün adı boş olamaz" };

    // Mandatory Image Check
    if (!image || image.size === 0) {
        return { error: "Ürün resmi zorunludur" };
    }

    let imageUrl = null;
    try {
        const bytes = await image.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Save to public/uploads
        const uploadDir = join(process.cwd(), "public", "uploads");
        const timestamp = Date.now();
        // Sanitize filename
        const originalName = image.name.replace(/[^a-zA-Z0-9.-]/g, "").toLowerCase();
        const filename = `${timestamp}-${originalName}`;

        await writeFile(join(uploadDir, filename), buffer);
        imageUrl = `/uploads/${filename}`;

    } catch (e) {
        console.error("Image upload failed:", e);
        return { error: "Resim yüklenirken hata oluştu" };
    }

    try {
        const existing = await (prisma as any).productCatalog.findUnique({
            where: { code: code.trim() }
        });

        if (existing) return { error: "Bu ürün kodu zaten kayıtlı" };

        await (prisma as any).productCatalog.create({
            data: {
                code: code.trim(),
                name: name.trim(),
                imageUrl: imageUrl
            }
        });

        revalidatePath("/dashboard/admin/features");
        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (e) {
        console.error("Add catalog error:", e);
        return { error: "Ekleme sırasında hata oluştu" };
    }
}

export async function deleteFromCatalog(id: number) {
    const session = await auth();
    if ((session?.user as any)?.role !== "ADMIN") {
        return { error: "Sadece yöneticiler silebilir" };
    }

    try {
        await (prisma as any).productCatalog.delete({ where: { id } });
        revalidatePath("/dashboard/admin/features");
        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (e) {
        return { error: "Silme sırasında hata oluştu" };
    }
}

export async function updateCatalogItem(id: number, formData: FormData) {
    const session = await auth();
    const role = (session?.user as any)?.role;

    if (role !== "ADMIN" && role !== "PLANNER") {
        return { error: "Yetkisiz işlem" };
    }

    const code = formData.get("code") as string;
    const name = formData.get("name") as string;
    const image = formData.get("image") as File | null;

    if (!code || code.trim().length === 0) return { error: "Kod boş olamaz" };
    if (!name || name.trim().length === 0) return { error: "İsim boş olamaz" };

    let updates: any = {
        code: code.trim(),
        name: name.trim()
    };

    if (image && image.size > 0) {
        try {
            const bytes = await image.arrayBuffer();
            const buffer = Buffer.from(bytes);

            const uploadDir = join(process.cwd(), "public", "uploads");
            const timestamp = Date.now();
            const originalName = image.name.replace(/[^a-zA-Z0-9.-]/g, "").toLowerCase();
            const filename = `${timestamp}-${originalName}`;

            await writeFile(join(uploadDir, filename), buffer);
            updates.imageUrl = `/uploads/${filename}`;
        } catch (e) {
            console.error("Image upload update failed:", e);
            return { error: "Resim güncellenirken hata oluştu" };
        }
    }

    try {
        // Check uniqueness of code if changed
        const current = await (prisma as any).productCatalog.findUnique({ where: { id } });
        if (current && current.code !== code) {
            const existing = await (prisma as any).productCatalog.findUnique({ where: { code: code.trim() } });
            if (existing) return { error: "Bu kod başka bir üründe kullanılıyor" };
        }

        await (prisma as any).productCatalog.update({
            where: { id },
            data: updates
        });

        revalidatePath("/dashboard/admin/features");
        revalidatePath("/dashboard/planning");
        return { success: true };
    } catch (e) {
        console.error("Update catalog error:", e);
        return { error: "Güncelleme sırasında hata oluştu" };
    }
}

export async function importCatalogItems(items: { code: string; name: string }[]) {
    const session = await auth();
    const role = (session?.user as any)?.role;

    if (role !== "ADMIN" && role !== "PLANNER") {
        return { error: "Yetkisiz işlem" };
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        return { error: "İçe aktarılacak veri yok" };
    }

    let successCount = 0;
    let failedCount = 0;

    try {
        for (const item of items) {
            if (!item.code || !item.name) {
                failedCount++;
                continue;
            }

            try {
                await (prisma as any).productCatalog.upsert({
                    where: { code: item.code.trim() },
                    update: { name: item.name.trim() },
                    create: {
                        code: item.code.trim(),
                        name: item.name.trim()
                    }
                });
                successCount++;
            } catch (e) {
                console.error(`Failed to import ${item.code}`, e);
                failedCount++;
            }
        }

        revalidatePath("/dashboard/admin/features");
        revalidatePath("/dashboard/planning");
        revalidatePath("/dashboard/admin/catalog");
        return { success: true, count: successCount, failed: failedCount };
    } catch (e) {
        console.error("Import error:", e);
        return { error: "İçe aktarma sırasında bir hata oluştu" };
    }
}

export async function deleteAllCatalogItems() {
    const session = await auth();
    if ((session?.user as any)?.role !== "ADMIN") {
        return { error: "Sadece yöneticiler tüm kataloğu silebilir" };
    }

    try {
        await (prisma as any).productCatalog.deleteMany({});
        revalidatePath("/dashboard/admin/features");
        revalidatePath("/dashboard/planning");
        revalidatePath("/dashboard/admin/catalog");
        return { success: true };
    } catch (e) {
        console.error("Delete all error:", e);
        return { error: "Silme işlemi sırasında hata oluştu" };
    }
}
