//Hoş Geldin Ben yazdım serdarmemed@mail.com '-_-'
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = 'force-dynamic'; // Her zaman dinamik - asla cache'lenmesin

export async function GET() {
    noStore(); // Cache'i devre dışı bırak - her zaman taze veri dönsün

    // KURAL: packagedQty > 0 olan VE depoya alınmamış ürünleri getir
    // - packagedQty > 0  → hâlâ paketlenmiş bekleyen adet var → LİSTEDE GÖZÜKSÜN
    // - packagedQty = 0  → tümü depoya alınmış → listede gözükmesin
    // - status SHIPPED   → sevk edilmiş → listede gözükmesin
    // - MANUAL-          → yarı mamül → listede gözükmesin
    const products = await prisma.product.findMany({
        where: {
            packagedQty: { gt: 0 },     // Paketlenmiş bekleyen adet var
            status: { not: 'SHIPPED' }, // Sevk edilmişleri gösterme
            NOT: [
                { sku: { startsWith: "MANUAL-" } } // Manuel yarı mamül hariç
            ]
        },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            name: true,
            model: true,
            systemCode: true,
            barcode: true,
            quantity: true,
            produced: true,
            foamQty: true,
            upholsteryQty: true,
            assemblyQty: true,
            packagedQty: true,
            storedQty: true,
            shippedQty: true,
            status: true,
            createdAt: true,
            terminDate: true,
            orderDate: true,
            material: true,
            description: true,
            imageUrl: true,
            footType: true,
            footMaterial: true,
            armType: true,
            backType: true,
            fabricType: true,
            aciklama1: true,
            aciklama2: true,
            aciklama3: true,
            aciklama4: true,
            dstAdi: true,
            inventory: {
                select: {
                    shelf: true,
                    quantity: true
                }
            },
            order: {
                select: {
                    company: true
                }
            }
        }
    });

    return NextResponse.json(products, {
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
        }
    });
}
