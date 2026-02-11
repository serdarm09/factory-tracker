//Hoş Geldin Ben yazdım serdarmemed@mail.com '-_-'
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    // Paketlenmiş ürünleri getir - depoya giriş için
    // packagedQty > 0 olan ürünler listede görünecek
    const products = await prisma.product.findMany({
        where: {
            packagedQty: { gt: 0 },
            status: { in: ['APPROVED', 'IN_PRODUCTION', 'COMPLETED'] }
        },
        orderBy: { createdAt: 'desc' },
        include: {
            inventory: true,
            order: {
                select: {
                    company: true
                }
            }
        }
    });

    return NextResponse.json(products);
}
