import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Droplets } from "lucide-react";
import { SemiFinishedProductionTable } from "@/components/semi-finished-production-table";
import { MaterialRequestDialog } from "@/components/material-request-dialog";

export default async function SungerDokumProductionPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const role = (session.user as any).role;
    const userId = parseInt((session.user as any).id);
    if (!["ADMIN", "PLANNER", "KALITE", "YARİMAMUL", "SUNGER_DOKUM", "VIEWER"].includes(role)) {
        redirect("/dashboard");
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Droplets className="h-8 w-8 text-cyan-600" />
                        Sünger Döküm Üretim
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Sünger döküm aşamasındaki ürünler
                    </p>
                </div>
                {!["PLANNER", "KALITE"].includes(role) && (
                    <MaterialRequestDialog userId={userId} departmentName="Sünger Döküm Departmanı" />
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Sünger Döküm Üretim Listesi</CardTitle>
                    <CardDescription>Sünger döküm aşamasındaki ürünleri takip edin ve adet girişi yapın</CardDescription>
                </CardHeader>
                <CardContent>
                    <SemiFinishedProductionTable category="SUNGER_DOKUM" userRole={role} />
                </CardContent>
            </Card>
        </div>
    );
}
