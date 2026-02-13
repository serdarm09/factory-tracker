import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wrench } from "lucide-react";
import { SemiFinishedProductionTable } from "@/components/semi-finished-production-table";
import { getSemiFinishedProductionByCategory } from "@/lib/actions/semi-finished-production-actions";

export default async function MetalProductionPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const role = (session.user as any).role;
    // Metal sayfasını görebilecek roller
    if (!["ADMIN", "PLANNER", "ENGINEER", "METAL"].includes(role)) {
        redirect("/dashboard");
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Wrench className="h-8 w-8 text-slate-600" />
                    Metal Üretim
                </h1>
                <p className="text-slate-500 mt-1">
                    Metal işleme aşamasındaki ürünler
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Metal Üretim Listesi</CardTitle>
                    <CardDescription>Metal işleme aşamasındaki ürünleri takip edin ve adet girişi yapın</CardDescription>
                </CardHeader>
                <CardContent>
                    <SemiFinishedProductionTable category="METAL" userRole={role} />
                </CardContent>
            </Card>
        </div>
    );
}
