import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FeatureManager } from "./feature-manager";

export default async function FeaturesPage() {
    const session = await auth();
    const userRole = (session?.user as any)?.role;

    if (userRole !== "ADMIN" && userRole !== "PLANNER") {
        redirect("/dashboard");
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Ürün Özellikleri Yönetimi</h2>
                <p className="text-muted-foreground">
                    Planlama formunda kullanılacak seçenekleri (Ayak, Kol, Kumaş vb.) buradan yönetebilirsiniz.
                </p>
            </div>

            <FeatureManager userRole={userRole} />
        </div>
    );
}
