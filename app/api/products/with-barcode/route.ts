import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    const products = await prisma.product.findMany({
        where: {
            barcode: { not: null }
        },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            name: true,
            model: true,
            systemCode: true,
            barcode: true,
            quantity: true,
            status: true,
            terminDate: true,
            aciklama1: true,
            aciklama2: true,
            aciklama3: true,
            aciklama4: true,
            order: {
                select: {
                    company: true
                }
            }
        }
    });

    // Flatten the company field
    const result = products.map(p => ({
        ...p,
        company: p.order?.company || null,
        order: undefined
    }));

    return NextResponse.json(result);
}
