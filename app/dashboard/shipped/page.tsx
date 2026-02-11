import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { ShippedProductsTable } from "@/components/shipped-products-table";

export default async function ShippedPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const role = (session.user as any).role;

    // Get all shipments with their items and product details
    const shipments = await prisma.shipment.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            items: {
                include: {
                    product: {
                        include: {
                            order: true,
                            creator: {
                                select: { username: true }
                            }
                        }
                    }
                }
            }
        }
    });

    // Flatten shipment items for table display
    const shippedItems = shipments.flatMap(shipment =>
        shipment.items.map(item => ({
            id: item.id,
            shipmentId: shipment.id,
            shipmentDate: shipment.createdAt,
            exitDate: shipment.exitDate,
            estimatedDate: shipment.estimatedDate,
            company: shipment.company,
            driverName: shipment.driverName,
            vehiclePlate: shipment.vehiclePlate,
            shipmentStatus: shipment.status,
            quantity: item.quantity,
            product: item.product
        }))
    );

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Sevk Edilenler</h1>
                    <p className="text-slate-500">Tüm sevkiyat kayıtları ve detayları</p>
                </div>
            </div>

            <ShippedProductsTable
                shippedItems={shippedItems}
                userRole={role}
            />
        </div>
    );
}
