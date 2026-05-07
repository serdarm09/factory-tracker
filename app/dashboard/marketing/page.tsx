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
            }
        },
        orderBy: { createdAt: "desc" }
    });

    // Onaylanmış ürünleri getir (APPROVED durumunda olanlar - üretime geçmemiş olanlar)
    const approvedProductsRaw = await prisma.product.findMany({
        where: {
            status: "APPROVED"
        },
        include: {
            order: true,
            creator: {
                select: { username: true }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    const approvedProducts = approvedProductsRaw.filter(p => {
        const stored = p.storedQty || 0;
        const shipped = p.shippedQty || 0;
        const produced = p.produced || 0;
        // Üretime geçmemiş olması için depo, sevk ve üretim adetlerinin sıfır olması gerekir
        return stored === 0 && shipped === 0 && produced === 0;
    });

    // Üretimde olan ürünleri getir (manuel eklenen yarı mamül ürünleri hariç tut)
    // Kısmi olarak depoya girmiş olanlar (COMPLETED) ama tamamlanmamış olanları da dahil et
    const rawInProduction = await prisma.product.findMany({
        where: {
            status: { in: ["IN_PRODUCTION", "COMPLETED"] },
            NOT: {
                sku: {
                    startsWith: "MANUAL-"
                }
            }
        },
        include: {
            order: true,
            creator: {
                select: { username: true }
            },
            inventory: true,
            shipmentItems: {
                include: { shipment: true }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    const inProductionProducts = rawInProduction.map(p => {
        const totalShipped = Math.max(
            p.shippedQty || 0,
            p.shipmentItems.reduce((sum, item) => sum + item.quantity, 0)
        );
        const totalInInventory = Math.max(
            p.storedQty || 0,
            p.inventory.reduce((sum, inv) => sum + inv.quantity, 0)
        );
        let displayStatus = p.status;
        const total = totalInInventory + totalShipped;
        if (total >= p.quantity) {
            displayStatus = "COMPLETED";
        } else if (total > 0 && displayStatus === "APPROVED") {
            displayStatus = "IN_PRODUCTION";
        }

        return {
            ...p,
            status: displayStatus,
            shipped: totalShipped,
            inStock: totalInInventory,
            storedQty: totalInInventory
        };
    }).filter(p => {
        if ((p.inStock + p.shipped) >= p.quantity) return false;
        if (p.status === "SHIPPED") return false;
        return true;
    });

    // Depoda olan ürünleri getir (Depoda stoğu bulunanlar)
    const completedProducts = await prisma.product.findMany({
        where: {
            storedQty: { gt: 0 },
            status: { not: "SHIPPED" },
            NOT: { sku: { startsWith: "MANUAL-" } }
        },
        include: {
            order: true,
            creator: {
                select: { username: true }
            },
            shipmentItems: true
        },
        orderBy: { createdAt: "desc" }
    });

    // Add shipped quantity and available quantity directly from product fields
    const completedWithShipped = completedProducts.map(p => {
        let displayStatus = p.status;
        const total = (p.storedQty || 0) + (p.shippedQty || 0);
        if (total >= p.quantity) {
            displayStatus = "COMPLETED";
        } else if (total > 0 && displayStatus === "APPROVED") {
            displayStatus = "IN_PRODUCTION";
        }

        return {
            ...p,
            status: displayStatus,
            shipped: p.shippedQty || 0,
            available: p.storedQty || 0
        };
    });

    // Sevk edilenler - TÜM sevk edilen ürünleri getir (shippedQty > 0)
    const shippedProducts = await prisma.product.findMany({
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
                            company: true,
                            driverName: true,
                            vehiclePlate: true,
                            exitDate: true,
                            status: true
                        }
                    }
                }
            }
        },
        orderBy: { createdAt: "desc" }
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
                shippedProducts={shippedProducts}
                userRole={role}
            />
        </div>
    );
}
