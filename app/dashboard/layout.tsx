import { Sidebar } from "@/components/sidebar";
import { DashboardClientWrapper } from "@/components/dashboard-client-wrapper";
import { MobileSidebarWrapper } from "@/components/mobile-sidebar-wrapper";
import { auth } from "@/lib/auth";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    const userRole = (session?.user as any)?.role;

    return (
        <DashboardClientWrapper userRole={userRole}>
            <div className="flex h-screen overflow-hidden">
                <MobileSidebarWrapper>
                    <Sidebar />
                </MobileSidebarWrapper>
                <main className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8 pt-16 md:pt-8">
                    {children}
                </main>
            </div>
        </DashboardClientWrapper>
    );
}
