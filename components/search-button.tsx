"use client";

import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useKeyboardShortcuts } from "@/components/keyboard-shortcut-provider";

export function SearchButton() {
    const { setOpenSearch } = useKeyboardShortcuts();

    return (
        <Button
            variant="outline"
            className="w-full justify-start text-slate-400 border-slate-700 bg-slate-800 hover:bg-slate-700 hover:text-white"
            onClick={() => setOpenSearch(true)}
        >
            <Search className="mr-2 h-4 w-4" />
            <span>Ara...</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-slate-600 bg-slate-700 px-1.5 font-mono text-[10px] font-medium text-slate-400">
                Ctrl+K
            </kbd>
        </Button>
    );
}
