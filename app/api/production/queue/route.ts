//Hoş Geldin Ben yazdım serdarmemed@mail.com '-_-'  
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    const products = await prisma.product.findMany({
        where: {
            status: 'APPROVED',
            barcode: { not: null }
        },
        orderBy: { createdAt: 'desc' },
        include: { inventory: true }
    });

    // Filter out if already fully produced (just in case status wasn't updated)
    const filtered = products.filter(p => p.produced < p.quantity);

    return NextResponse.json(filtered);
}
