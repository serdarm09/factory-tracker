// Üretim takviminden direkt sevkiyat
// Not: storedQty düşümü frontend'de yapılıyor, bu endpoint sadece Shipment kaydı oluşturur
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/actions/shared";

export async function POST(request: Request) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Yetkisiz işlem" }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (!["ADMIN", "PLANNER"].includes(role)) {
        return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { productId, quantity, company, driverName, vehiclePlate, note } = body;

        if (!productId || !quantity || quantity <= 0) {
            return NextResponse.json({ error: "Geçersiz veriler" }, { status: 400 });
        }

        // Ürünü bul
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: { order: true }
        });

        if (!product) {
            return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
        }

        // Shipment kaydı oluştur
        const shipment = await prisma.shipment.create({
            data: {
                company: company || product.order?.company || "Belirtilmedi",
                driverName: driverName || null,
                vehiclePlate: vehiclePlate || null,
                exitDate: new Date(),
                status: "SHIPPED",
                items: {
                    create: [{
                        productId: productId,
                        quantity: quantity
                    }]
                }
            }
        });

        // Audit log
        await createAuditLog(
            "CREATE_SHIPMENT_DIRECT",
            "Shipment",
            shipment.id.toString(),
            `${product.name} - ${quantity} adet sevk edildi. ${note || 'Üretim takviminden otomatik sevk'}. Firma: ${company || "Belirtilmedi"}`,
            parseInt((session.user as any).id)
        );

        return NextResponse.json({ success: true, shipmentId: shipment.id });
    } catch (error) {
        console.error("Direct shipment error:", error);
        return NextResponse.json({ error: "Sevkiyat oluşturulurken hata oluştu" }, { status: 500 });
    }
}
