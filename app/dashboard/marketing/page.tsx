import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { MarketingProductList } from "@/components/marketing-product-list";
import { Card, CardContent } from "@/components/ui/card";
import { Package, AlertCircle } from "lucide-react";

export default async function MarketingPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const role = (session.user as any).role;
    if (!["ADMIN", "MARKETER", "MARKETING"].includes(role)) {
        redirect("/dashboard");
    }

    // Pazarlama incelemesi bekleyen ürünler (Admin onayladı, pazarlamaya düştü)
    const marketingReviewProducts = await prisma.product.findMany({
        where: {
            status: "MARKETING_REVIEW"
        },
        include: {
            order: true,
            creator: {
                select: { username: true }
            },
            components: true
        },
        orderBy: { createdAt: "desc" }
    });

    // Onaylanmış ürünleri getir (APPROVED durumunda olanlar - üretime geçmiş)
    const approvedProducts = await prisma.product.findMany({
        where: {
            status: "APPROVED"
        },
        include: {
            order: true,
            creator: {
                select: { username: true }
            },
            components: true
        },
        orderBy: { createdAt: "desc" }
    });

    // Üretimde olan ürünleri getir
    const inProductionProducts = await prisma.product.findMany({
        where: {
            status: "IN_PRODUCTION"
        },
        include: {
            order: true,
            creator: {
                select: { username: true }
            },
            components: true
        },
        orderBy: { createdAt: "desc" }
    });

    // Depoda olan ürünleri getir (COMPLETED durumunda olanlar)
    const completedProducts = await prisma.product.findMany({
        where: {
            status: "COMPLETED"
        },
        include: {
            order: true,
            creator: {
                select: { username: true }
            },
            shipmentItems: true,
            components: true
        },
        orderBy: { createdAt: "desc" }
    });

    // Add shipped quantity to completed products
    const completedWithShipped = completedProducts.map(p => {
        const shipped = p.shipmentItems.reduce((sum, item) => sum + item.quantity, 0);
        return {
            ...p,
            shipped,
            available: p.produced - shipped
        };
    });

    // Sevk edilenler - get shipment items with details
    const shippedItems = await prisma.shipmentItem.findMany({
        include: {
            shipment: true,
            product: {
                include: {
                    order: true,
                    creator: {
                        select: { username: true }
                    },
                    components: true
                }
            }
        },
        orderBy: {
            shipment: {
                createdAt: "desc"
            }
        }
    });

    const newProductCount = marketingReviewProducts.length;

    return (
        <div className="p-6 space-y-6">
            {/* Yeni urun uyarisi */}
            {newProductCount > 0 && (
                <Card className="border-2 border-red-400 bg-red-50">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-4">
                            <div className="flex-shrink-0 p-3 bg-red-100 rounded-full">
                                <Package className="h-6 w-6 text-red-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-red-800 flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5" />
                                    {newProductCount} Yeni Urun Bekleniyor!
                                </h3>
                                <p className="text-red-600">
                                    Admin tarafindan onaylanan urunler uretime gonderilmeyi bekliyor.
                                </p>
                            </div>
                            <div className="flex-shrink-0">
                                <span className="inline-flex items-center justify-center w-12 h-12 text-2xl font-bold text-white bg-red-500 rounded-full animate-pulse">
                                    {newProductCount}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Pazarlama</h1>
                    <p className="text-slate-500">Admin onayindan gecen urunleri uretime gonderin</p>
                </div>
            </div>

            <MarketingProductList
                marketingReviewProducts={marketingReviewProducts}
                approvedProducts={approvedProducts}
                inProductionProducts={inProductionProducts}
                completedProducts={completedWithShipped}
                shippedItems={shippedItems}
                userRole={role}
            />
        </div>
    );
}
