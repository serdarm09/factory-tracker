import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { ShippedProductsTable } from "@/components/shipped-products-table";

export default async function ShippedPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const role = (session.user as any).role;

    // KALİTE rolü bu sayfayi gorememeli
    if (role === "KALITE") {
        redirect("/dashboard/production-planning");
    }

    // TÜM sevk edilmiş ürünleri getir (shippedQty > 0)
    const allShippedProducts = await prisma.product.findMany({
        where: {
            shippedQty: { gt: 0 },
            NOT: { sku: { startsWith: "MANUAL-" } }
        },
        include: {
            order: true,
            creator: {
                select: { username: true }
            },
            shipmentItems: {
                include: {
                    shipment: {
                        select: {
                            id: true,
                            company: true,
                            driverName: true,
                            vehiclePlate: true,
                            exitDate: true,
                            estimatedDate: true,
                            status: true,
                            createdAt: true
                        }
                    }
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Sevk Edilenler</h1>
                    <p className="text-slate-500">Tüm sevkiyat kayıtları ve detayları</p>
                </div>
            </div>

            <ShippedProductsTable
                shippedProducts={allShippedProducts}
                userRole={role}
            />
        </div>
    );
}
