"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface KeyboardShortcutContextType {
    openSearch: boolean;
    setOpenSearch: (open: boolean) => void;
}

const KeyboardShortcutContext = createContext<KeyboardShortcutContextType | null>(null);

export function useKeyboardShortcuts() {
    const context = useContext(KeyboardShortcutContext);
    if (!context) {
        throw new Error("useKeyboardShortcuts must be used within KeyboardShortcutProvider");
    }
    return context;
}

interface KeyboardShortcutProviderProps {
    children: ReactNode;
    userRole?: string;
}

const SHORTCUTS = [
    { key: "d", alt: true, path: "/dashboard", label: "Dashboard" },
    { key: "p", alt: true, path: "/dashboard/planning", label: "Planlama" },
    { key: "u", alt: true, path: "/dashboard/production", label: "Üretim" },
    { key: "w", alt: true, path: "/dashboard/warehouse", label: "Depo" },
    { key: "s", alt: true, path: "/dashboard/semi-finished", label: "Yarı Mamul" },
    { key: "a", alt: true, path: "/dashboard/admin/approvals", label: "Onaylar", adminOnly: true },
    { key: "n", alt: true, path: "/dashboard/planning/new-order", label: "Yeni Sipariş" },
];

export function KeyboardShortcutProvider({ children, userRole }: KeyboardShortcutProviderProps) {
    const router = useRouter();
    const [openSearch, setOpenSearch] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            const target = e.target as HTMLElement;
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
                return;
            }

            // Ctrl + K for global search
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setOpenSearch(true);
                return;
            }

            // Escape to close dialogs
            if (e.key === "Escape") {
                setOpenSearch(false);
                return;
            }

            // Alt + Key shortcuts for navigation
            if (e.altKey) {
                const shortcut = SHORTCUTS.find(s => s.key === e.key.toLowerCase());
                if (shortcut) {
                    // Check admin-only shortcuts
                    if (shortcut.adminOnly && userRole !== "ADMIN") {
                        return;
                    }
                    e.preventDefault();
                    router.push(shortcut.path);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [router, userRole]);

    return (
        <KeyboardShortcutContext.Provider value={{ openSearch, setOpenSearch }}>
            {children}
        </KeyboardShortcutContext.Provider>
    );
}

// Export shortcuts for use in UI hints
export { SHORTCUTS };
