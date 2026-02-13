

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AutoRefresh } from "@/components/auto-refresh";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PlanningProductList } from "@/components/planning-product-list";

export default async function PlanningPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const role = (session.user as any).role;
    // Sadece ADMIN ve PLANNER erişebilir
    if (!["ADMIN", "PLANNER"].includes(role)) {
        redirect("/dashboard");
    }

    // Fetch Orders that have products (or all?).
    // We want to show Active orders (not completed/cancelled maybe? or all).
    // Let's show all for now, ordered by date.
    const orders = await prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        where: {
            products: {
                some: {} // Sadece en az 1 ürünü olan siparişleri getir
            }
        },
        include: {
            products: {
                include: {
                    order: true, // Product içinden order'a erişebilmek için
                    catalogProduct: true // Katalog ürünü bilgisi
                }
            },
            marketingBy: true
        }
    });

    // Also fetch legacy products that might not have an Order?
    // If strict migration, all products should have orderId?
    // Old products have orderId = null.
    // We should display them too in a "Legacy / Unassigned" group.
    // Exclude TEMPLATE status products (catalog component templates)
    const legacyProducts = await prisma.product.findMany({
        where: {
            orderId: null,
            status: { not: 'TEMPLATE' }  // Template kayıtları hariç tut
        },
        orderBy: { createdAt: 'desc' },
        include: {
            order: true,
            catalogProduct: true // Katalog ürünü bilgisi
        }
    });

    // Separating Rejected Products for Alert (Only if I want to keep that alert logic)
    // Actually, Admin approves here. Marketing views elsewhere?
    // User said: "admin onay verirse üretime geçilecek".
    // So this page is for Admin/Planner.

    const isViewer = role === 'VIEWER';
    const isAdmin = role === 'ADMIN';

    return (
        <div className="space-y-8">
            <AutoRefresh />

            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Planlama ve Onay</h1>
                {!isViewer && (
                    <Link href="/dashboard/planning/new-order">
                        <Button className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="mr-2 h-4 w-4" /> Yeni Sipariş Oluştur
                        </Button>
                    </Link>
                )}
            </div>

            <PlanningProductList
                orders={orders}
                legacyProducts={legacyProducts}
                userRole={role}
            />
        </div>
    );
}
