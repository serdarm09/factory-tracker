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
    if (role !== "ADMIN") {
        redirect("/dashboard");
    }

    // Onaylanmış, üretimdeki ve tamamlanmış ürünler (PENDING hariç)
    const products = await prisma.product.findMany({
        where: {
            status: {
                in: ["APPROVED", "IN_PRODUCTION", "COMPLETED"]
            },
            terminDate: {
                not: null
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
            shippedQty: true,
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
            order: {
                select: {
                    company: true,
                    name: true
                }
            }
        },
        orderBy: {
            terminDate: 'asc'
        }
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
