import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Factory, Warehouse } from "lucide-react";
import { SemiFinishedProductionTable } from "@/components/semi-finished-production-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KonfeksiyonStockTab } from "./_components/konfeksiyon-stock-tab";
import prisma from "@/lib/prisma";
import { MaterialRequestDialog } from "@/components/material-request-dialog";

export const dynamic = "force-dynamic";

export default async function KonfeksiyonProductionPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const role = (session.user as any).role;
    const userId = parseInt((session.user as any).id);
    // Konfeksiyon sayfasını görebilecek roller
    if (!["ADMIN", "PLANNER", "KALITE", "YARİMAMUL", "KONFEKSIYON", "VIEWER"].includes(role)) {
        redirect("/dashboard");
    }

    const stocks = await (prisma as any).konfeksiyonStock.findMany({
        orderBy: { name: "asc" }
    });

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Factory className="h-8 w-8 text-blue-600" />
                        Konfeksiyon Departmanı
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Üretim takibi ve kumaş/deri depo yönetimi
                    </p>
                </div>
                {!["PLANNER", "KALITE"].includes(role) && (
                    <MaterialRequestDialog userId={userId} departmentName="Konfeksiyon Departmanı" />
                )}
            </div>

            <Tabs defaultValue="production" className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="production" className="flex items-center gap-2">
                        <Factory className="w-4 h-4" /> Üretim Takibi
                    </TabsTrigger>
                    <TabsTrigger value="warehouse" className="flex items-center gap-2">
                        <Warehouse className="w-4 h-4" /> Kumaş/Deri Depo
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="production" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Konfeksiyon Üretim Listesi</CardTitle>
                            <CardDescription>Konfeksiyon aşamasındaki ürünleri takip edin ve adet girişi yapın</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SemiFinishedProductionTable category="KONFEKSIYON" userRole={role} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="warehouse" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Konfeksiyon Kumaş ve Deri Deposu</CardTitle>
                            <CardDescription>Konfeksiyon üretiminde kullanılan kumaş, deri vb. materyallerin stokları</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <KonfeksiyonStockTab stocks={stocks} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
