import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SemiFinishedProductionPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const role = (session.user as any).role;

    // Rol bazlı yönlendirme
    if (role === "METAL") {
        redirect("/dashboard/semi-finished-production/metal");
    } else if (role === "KONFEKSIYON") {
        redirect("/dashboard/semi-finished-production/konfeksiyon");
    } else if (role === "AHSAP_BOYA") {
        redirect("/dashboard/semi-finished-production/ahsap-boya");
    } else if (role === "AHSAP_ISKELET") {
        redirect("/dashboard/semi-finished-production/ahsap-iskelet");
    } else if (["ADMIN", "PLANNER", "ENGINEER"].includes(role)) {
        // Diğer roller için Metal'e yönlendir (varsayılan)
        redirect("/dashboard/semi-finished-production/metal");
    } else {
        redirect("/dashboard");
    }
}
