import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Factory } from "lucide-react";
import { SemiFinishedProductionTable } from "@/components/semi-finished-production-table";

export default async function KonfeksiyonProductionPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const role = (session.user as any).role;
    // Konfeksiyon sayfasını görebilecek roller
    if (!["ADMIN", "PLANNER", "ENGINEER", "KONFEKSIYON"].includes(role)) {
        redirect("/dashboard");
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Factory className="h-8 w-8 text-blue-600" />
                    Konfeksiyon Üretim
                </h1>
                <p className="text-slate-500 mt-1">
                    Konfeksiyon aşamasındaki ürünler
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Konfeksiyon Üretim Listesi</CardTitle>
                    <CardDescription>Konfeksiyon aşamasındaki ürünleri takip edin ve adet girişi yapın</CardDescription>
                </CardHeader>
                <CardContent>
                    <SemiFinishedProductionTable category="KONFEKSIYON" userRole={role} />
                </CardContent>
            </Card>
        </div>
    );
}
