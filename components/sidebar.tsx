import Link from "next/link";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { LayoutDashboard, CalendarDays, CheckCircle, Package, Users, LogOut, ClipboardList, Boxes, Settings2, LifeBuoy, Layers, Search, Database, Megaphone, Truck, Wrench, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth"; // We need a server action for signOut to work in server components usually, or client. using client for signout button usually best.
// Actually, calling signOut from server component is not direct. We need a client component for the signout button.

// We will make Sidebar a Server Component to fetch session, but the SignOut button needs client.
import { SignOutButton } from "./sign-out-button";
import { SupportTicketDialog } from "./support-dialog";
import { SearchButton } from "./search-button";
import { NotificationDropdown } from "./notification-dropdown";

export async function Sidebar() {
    const session = await auth();
    const role = (session?.user as any)?.role || "VIEWER";

    let pendingCount = 0;
    let unreadNotificationCount = 0;

    try {
        pendingCount = await prisma.product.count({
            where: { status: 'PENDING' }
        });
    } catch (e) {
        console.error("Sidebar pending count fetch failed:", e);
    }

    // Admin için okunmamış bildirim sayısını çek
    if (role === "ADMIN") {
        try {
            unreadNotificationCount = await (prisma as any).notification.count({
                where: { isRead: false }
            });
        } catch (e) {
            // Tablo yoksa veya hata olursa 0 döner
        }
    }

    const links = [
        { name: "Panel", href: "/dashboard", icon: LayoutDashboard, roles: ["ADMIN", "PLANNER", "WORKER", "VIEWER", "MARKETER", "ENGINEER"], shortcut: "D" },
        { name: "NetSim Siparisler", href: "/dashboard/netsim", icon: Database, roles: ["ADMIN", "PLANNER"], shortcut: "N" },
        { name: "Siparis Planlama", href: "/dashboard/planning", icon: CalendarDays, roles: ["ADMIN", "PLANNER"], shortcut: "P" },
        { name: "Uretim", href: "/dashboard/production-planning", icon: Wrench, roles: ["ADMIN", "PLANNER", "ENGINEER"], shortcut: "E" },
        { name: "Uretim Takvimi", href: "/dashboard/production-calendar", icon: Calendar, roles: ["ADMIN"], shortcut: "K" },
        { name: "Pazarlama", href: "/dashboard/marketing", icon: Megaphone, roles: ["ADMIN", "MARKETER"], shortcut: "M" },
        { name: "Yari Mamul", href: "/dashboard/semi-finished", icon: Layers, roles: ["ADMIN", "PLANNER", "ENGINEER"], shortcut: "S" },
        { name: "Depo Listesi", href: "/dashboard/warehouse", icon: Boxes, roles: ["ADMIN", "PLANNER", "WORKER", "VIEWER", "WAREHOUSE", "ENGINEER"], shortcut: "W" },
        { name: "Sevk Edilenler", href: "/dashboard/shipped", icon: Truck, roles: ["ADMIN", "MARKETER", "WAREHOUSE", "WORKER", "ENGINEER"], shortcut: "T" },
        {
            name: "Onaylar",
            href: "/dashboard/admin/approvals",
            icon: CheckCircle,
            roles: ["ADMIN"],
            badge: pendingCount > 0,
            shortcut: "A"
        },
        { name: "Urun girisi", href: "/dashboard/production", icon: Package, roles: ["ADMIN"], shortcut: "U" },
        { name: "Kullanicilar", href: "/dashboard/admin/users", icon: Users, roles: ["ADMIN"] },
        { name: "Katalog", href: "/dashboard/admin/catalog", icon: ClipboardList, roles: ["ADMIN"] },
        { name: "Ozellik Yonetimi", href: "/dashboard/admin/features", icon: Settings2, roles: ["ADMIN", "PLANNER"] },
        { name: "Destek Talepleri", href: "/dashboard/admin/support", icon: LifeBuoy, roles: ["ADMIN"] },
        { name: "Kayitlar (Log)", href: "/dashboard/admin/logs", icon: ClipboardList, roles: ["ADMIN"] },
    ];

    return (
        <div className="flex bg-slate-900 text-white w-64 h-screen flex-col">

            <div className="p-6 flex-shrink-0">
                <div className="mb-2">
                    <Image src="/image.png" alt="Marisit Logo" width={180} height={60} className="object-contain" priority />
                </div>
                <p className="text-xs text-slate-400 mt-1">Rol: {role}</p>
            </div>

            <div className="px-4 mb-2 flex-shrink-0">
                <SearchButton />
            </div>

            <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
                {links.map((link) => {
                    if (!link.roles.includes(role)) return null;
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors relative group"
                            title={(link as any).shortcut ? `Alt+${(link as any).shortcut}` : undefined}
                        >
                            <link.icon className="w-5 h-5 text-slate-300" />
                            <span className="font-medium">{link.name}</span>
                            {(link as any).shortcut && (
                                <kbd className="ml-auto hidden group-hover:inline-flex h-5 select-none items-center rounded border border-slate-600 bg-slate-800 px-1.5 font-mono text-[10px] text-slate-400">
                                    Alt+{(link as any).shortcut}
                                </kbd>
                            )}
                            {(link as any).badge && (
                                <span className="absolute right-2 top-3 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                            )}
                        </Link>
                    )
                })}
            </nav>

            <div className="flex-shrink-0">
                {/* Admin icin bildirim dropdown */}
                {role === "ADMIN" && (
                    <div className="px-4 mb-2">
                        <NotificationDropdown initialCount={unreadNotificationCount} />
                    </div>
                )}

                <div className="px-4 mb-2">
                    <SupportTicketDialog />
                </div>

                <div className="p-4 border-t border-slate-800">
                    <SignOutButton />
                </div>
            </div>
        </div>
    );
}
