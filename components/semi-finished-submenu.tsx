"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Factory, Wrench, Paintbrush, Box } from "lucide-react";
import { usePathname } from "next/navigation";

interface SemiFinishedSubmenuProps {
    userRole: string;
}

export function SemiFinishedSubmenu({ userRole }: SemiFinishedSubmenuProps) {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(pathname?.startsWith("/dashboard/semi-finished-production"));

    // WORKER rolü yarı mamül sayfalarını görmemeli
    if (userRole === "WORKER") {
        return null;
    }

    const allSubLinks = [
        { name: "Metal", href: "/dashboard/semi-finished-production/metal", icon: Wrench, color: "text-slate-400", roles: ["ADMIN", "PLANNER", "ENGINEER", "METAL"] },
        { name: "Konfeksiyon", href: "/dashboard/semi-finished-production/konfeksiyon", icon: Factory, color: "text-blue-400", roles: ["ADMIN", "PLANNER", "ENGINEER", "KONFEKSIYON"] },
        { name: "Ahşap Boya", href: "/dashboard/semi-finished-production/ahsap-boya", icon: Paintbrush, color: "text-amber-400", roles: ["ADMIN", "PLANNER", "ENGINEER", "AHSAP_BOYA"] },
        { name: "Ahşap İskelet", href: "/dashboard/semi-finished-production/ahsap-iskelet", icon: Box, color: "text-brown-400", roles: ["ADMIN", "PLANNER", "ENGINEER", "AHSAP_ISKELET"] },
    ];

    // Kullanıcının görebileceği kategorileri filtrele
    const subLinks = allSubLinks.filter(link => link.roles.includes(userRole));

    // Hiç kategori göremiyorsa menüyü gösterme
    if (subLinks.length === 0) {
        return null;
    }

    // Sadece 1 kategori varsa direkt link göster (dropdown olmadan)
    if (subLinks.length === 1) {
        const link = subLinks[0];
        const Icon = link.icon;
        const isActive = pathname === link.href;

        return (
            <Link
                href={link.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                        ? "bg-slate-800 text-white"
                        : "hover:bg-slate-800 text-slate-300"
                }`}
            >
                <Icon className={`w-5 h-5 ${link.color}`} />
                <span className="font-medium">{link.name}</span>
            </Link>
        );
    }

    // Birden fazla kategori varsa dropdown göster
    return (
        <div>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors w-full group"
            >
                <Factory className="w-5 h-5 text-slate-300" />
                <span className="font-medium flex-1 text-left">Yarı Mamül</span>
                {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
            </button>

            {isOpen && (
                <div className="ml-4 mt-1 space-y-1">
                    {subLinks.map((link) => {
                        const Icon = link.icon;
                        const isActive = pathname === link.href;

                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                                    isActive
                                        ? "bg-slate-800 text-white"
                                        : "hover:bg-slate-800/50 text-slate-300"
                                }`}
                            >
                                <Icon className={`w-4 h-4 ${link.color}`} />
                                <span className="text-sm">{link.name}</span>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
