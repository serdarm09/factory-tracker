import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Layers } from "lucide-react";
import { SemiFinishedProductionTable } from "@/components/semi-finished-production-table";
import { MaterialRequestDialog } from "@/components/material-request-dialog";

export default async function PlastikProductionPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const role = (session.user as any).role;
    const userId = parseInt((session.user as any).id);
    if (!["ADMIN", "PLANNER", "KALITE", "YARİMAMUL", "PLASTIK"].includes(role)) {
        redirect("/dashboard");
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Layers className="h-8 w-8 text-purple-600" />
                        Plastik Üretim
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Plastik işleme aşamasındaki ürünler
                    </p>
                </div>
                {!["PLANNER", "KALITE"].includes(role) && (
                    <MaterialRequestDialog userId={userId} departmentName="Plastik Departmanı" />
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Plastik Üretim Listesi</CardTitle>
                    <CardDescription>Plastik işleme aşamasındaki ürünleri takip edin ve adet girişi yapın</CardDescription>
                </CardHeader>
                <CardContent>
                    <SemiFinishedProductionTable category="PLASTIK" userRole={role} />
                </CardContent>
            </Card>
        </div>
    );
}
