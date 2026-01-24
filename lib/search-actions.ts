"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface SearchResult {
    id: number;
    type: "product" | "order" | "customer";
    title: string;
    subtitle?: string;
    href: string;
}

export async function globalSearch(query: string): Promise<{ results: SearchResult[] } | { error: string }> {
    const session = await auth();
    if (!session) {
        return { error: "Yetkisiz erişim" };
    }

    if (!query || query.length < 2) {
        return { results: [] };
    }

    const searchTerm = query.toLowerCase();

    try {
        const results: SearchResult[] = [];

        // Search Products
        const products = await prisma.product.findMany({
            where: {
                OR: [
                    { name: { contains: searchTerm } },
                    { systemCode: { contains: searchTerm } },
                    { barcode: { contains: searchTerm } },
                    { model: { contains: searchTerm } },
                ]
            },
            take: 10,
            select: {
                id: true,
                name: true,
                systemCode: true,
                model: true,
                status: true,
                order: {
                    select: {
                        company: true
                    }
                }
            }
        });

        for (const product of products) {
            results.push({
                id: product.id,
                type: "product",
                title: product.name,
                subtitle: `${product.systemCode} | ${product.model} | ${product.order?.company || ""}`,
                href: product.status === "PENDING"
                    ? "/dashboard/admin/approvals"
                    : "/dashboard/warehouse",
            });
        }

        // Search Orders
        const orders = await prisma.order.findMany({
            where: {
                OR: [
                    { company: { contains: searchTerm } },
                    { name: { contains: searchTerm } },
                ]
            },
            take: 5,
            select: {
                id: true,
                company: true,
                name: true,
                createdAt: true,
                _count: {
                    select: { products: true }
                }
            }
        });

        for (const order of orders) {
            results.push({
                id: order.id,
                type: "order",
                title: order.name || order.company,
                subtitle: `${order.company} | ${order._count.products} ürün`,
                href: "/dashboard/planning",
            });
        }

        return { results };
    } catch (e) {
        console.error("Search error:", e);
        return { error: "Arama sırasında bir hata oluştu" };
    }
}
