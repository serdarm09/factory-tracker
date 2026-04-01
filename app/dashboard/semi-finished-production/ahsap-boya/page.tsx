import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Paintbrush } from "lucide-react";
import { SemiFinishedProductionTable } from "@/components/semi-finished-production-table";
import { MaterialRequestDialog } from "@/components/material-request-dialog";

export default async function AhsapBoyaProductionPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const role = (session.user as any).role;
    const userId = parseInt((session.user as any).id);
    // Ahşap Boya sayfasını görebilecek roller
    if (!["ADMIN", "PLANNER", "KALITE", "YARİMAMUL", "AHSAP_BOYA"].includes(role)) {
        redirect("/dashboard");
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Paintbrush className="h-8 w-8 text-amber-600" />
                        Ahşap Boya Üretim
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Ahşap boya aşamasındaki ürünler
                    </p>
                </div>
                {!["PLANNER", "KALITE"].includes(role) && (
                    <MaterialRequestDialog userId={userId} departmentName="Ahşap Boya Departmanı" />
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Ahşap Boya Üretim Listesi</CardTitle>
                    <CardDescription>Ahşap boya aşamasındaki ürünleri takip edin ve adet girişi yapın</CardDescription>
                </CardHeader>
                <CardContent>
                    <SemiFinishedProductionTable category="AHSAP_BOYA" userRole={role} />
                </CardContent>
            </Card>
        </div>
    );
}
