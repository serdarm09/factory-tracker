import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Box } from "lucide-react";
import { SemiFinishedProductionTable } from "@/components/semi-finished-production-table";

export default async function AhsapIskeletProductionPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const role = (session.user as any).role;
    // Ahşap İskelet sayfasını görebilecek roller
    if (!["ADMIN", "PLANNER", "ENGINEER", "AHSAP_ISKELET"].includes(role)) {
        redirect("/dashboard");
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Box className="h-8 w-8 text-brown-600" />
                    Ahşap İskelet Üretim
                </h1>
                <p className="text-slate-500 mt-1">
                    Ahşap iskelet aşamasındaki ürünler
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Ahşap İskelet Üretim Listesi</CardTitle>
                    <CardDescription>Ahşap iskelet aşamasındaki ürünleri takip edin ve adet girişi yapın</CardDescription>
                </CardHeader>
                <CardContent>
                    <SemiFinishedProductionTable category="AHSAP_ISKELET" userRole={role} />
                </CardContent>
            </Card>
        </div>
    );
}
