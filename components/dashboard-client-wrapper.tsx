"use client";

import { ReactNode } from "react";
import { KeyboardShortcutProvider } from "@/components/keyboard-shortcut-provider";
import { GlobalSearch } from "@/components/global-search";

interface DashboardClientWrapperProps {
    children: ReactNode;
    userRole?: string;
}

export function DashboardClientWrapper({ children, userRole }: DashboardClientWrapperProps) {
    return (
        <KeyboardShortcutProvider userRole={userRole}>
            {children}
            <GlobalSearch />
        </KeyboardShortcutProvider>
    );
}
