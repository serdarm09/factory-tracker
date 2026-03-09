import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { ProductionCalendar } from "@/components/production-calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AutoRefresh } from "@/components/auto-refresh";

export default async function ProductionCalendarPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const role = (session.user as any).role;
    const allowedRoles = ["ADMIN", "PLANNER"];
    if (!allowedRoles.includes(role)) {
        redirect("/dashboard");
    }

    // Onaylanmış, üretimdeki ürünler - tamamı depodaysa gösterme
    // Manuel eklenen yarı mamül ürünleri (MANUAL-) hariç tut
    const allProducts = await prisma.product.findMany({
        where: {
            status: {
                in: ["APPROVED", "IN_PRODUCTION", "COMPLETED", "SHIPPED"]
            },
            NOT: {
                sku: {
                    startsWith: "MANUAL-"
                }
            }
        },
        select: {
            id: true,
            name: true,
            model: true,
            systemCode: true,
            quantity: true,
            produced: true,
            status: true,
            subStatus: true,
            terminDate: true,
            productionDate: true,
            orderDate: true,
            foamQty: true,
            upholsteryQty: true,
            assemblyQty: true,
            packagedQty: true,
            storedQty: true,
            storedDate: true,
            shippedQty: true,
            unitPrice: true,
            totalPrice: true,
            engineerNote: true,
            material: true,
            master: true,
            footType: true,
            footMaterial: true,
            armType: true,
            backType: true,
            fabricType: true,
            description: true,
            aciklama1: true,
            aciklama2: true,
            aciklama3: true,
            aciklama4: true,
            dstAdi: true,
            marketingDescription: true,
            order: {
                select: {
                    company: true,
                    name: true,
                    customerName: true,
                    deliveryDate: true,
                    totalAmount: true,
                    currency: true,
                    externalId: true
                }
            },
            shipmentItems: {
                select: {
                    quantity: true,
                    shipment: {
                        select: {
                            exitDate: true,
                            estimatedDate: true
                        }
                    }
                }
            }
        },
        orderBy: {
            terminDate: 'asc'
        }
    });

    // Sevk tarihini en son shipmentItem'dan hesapla
    const products = allProducts.map(p => {
        const shipmentDates = (p as any).shipmentItems
            ?.map((item: any) => item.shipment?.exitDate || item.shipment?.estimatedDate)
            .filter(Boolean);
        const latestShipDate = shipmentDates?.length > 0
            ? shipmentDates.sort((a: Date, b: Date) => new Date(b).getTime() - new Date(a).getTime())[0]
            : null;
        const { shipmentItems: _si, ...rest } = p as any;
        return { ...rest, shippedDate: latestShipDate };
    });

    return (
        <div className="p-6 space-y-6">
            <AutoRefresh intervalMs={30000} />

            <div>
                <h1 className="text-2xl font-bold text-slate-900">Üretim Takvimi</h1>
                <p className="text-slate-500">
                    Bekleyen ürünleri usta bazlı seçerek üretime gönderin
                </p>
            </div>

            <ProductionCalendar
                products={products}
                userRole={role}
            />
        </div>
    );
}
