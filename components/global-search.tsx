"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import { useKeyboardShortcuts, SHORTCUTS } from "@/components/keyboard-shortcut-provider";
import { Package, FileText, Users, Search, Keyboard, ArrowRight } from "lucide-react";
import { globalSearch } from "@/lib/search-actions";

interface SearchResult {
    id: number;
    type: "product" | "order" | "customer";
    title: string;
    subtitle?: string;
    href: string;
}

export function GlobalSearch() {
    const router = useRouter();
    const { openSearch, setOpenSearch } = useKeyboardShortcuts();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = useCallback(async (searchQuery: string) => {
        if (searchQuery.length < 2) {
            setResults([]);
            return;
        }

        setLoading(true);
        try {
            const data = await globalSearch(searchQuery);
            if ('results' in data) {
                setResults(data.results);
            }
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            handleSearch(query);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [query, handleSearch]);

    const handleSelect = (href: string) => {
        setOpenSearch(false);
        setQuery("");
        setResults([]);
        router.push(href);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case "product":
                return <Package className="mr-2 h-4 w-4" />;
            case "order":
                return <FileText className="mr-2 h-4 w-4" />;
            case "customer":
                return <Users className="mr-2 h-4 w-4" />;
            default:
                return <Search className="mr-2 h-4 w-4" />;
        }
    };

    const products = results.filter(r => r.type === "product");
    const orders = results.filter(r => r.type === "order");

    return (
        <CommandDialog open={openSearch} onOpenChange={setOpenSearch}>
            <CommandInput
                placeholder="Ara: Ürün, Sipariş, Müşteri..."
                value={query}
                onValueChange={setQuery}
            />
            <CommandList>
                {loading && (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                        Aranıyor...
                    </div>
                )}

                {!loading && query.length < 2 && (
                    <>
                        <CommandGroup heading="Hızlı Navigasyon">
                            {SHORTCUTS.map((shortcut) => (
                                <CommandItem
                                    key={shortcut.path}
                                    onSelect={() => handleSelect(shortcut.path)}
                                >
                                    <ArrowRight className="mr-2 h-4 w-4" />
                                    <span>{shortcut.label}</span>
                                    <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                                        Alt+{shortcut.key.toUpperCase()}
                                    </kbd>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup heading="Klavye Kısayolları">
                            <CommandItem disabled>
                                <Keyboard className="mr-2 h-4 w-4" />
                                <span>Ctrl+K</span>
                                <span className="ml-2 text-muted-foreground">Bu menüyü aç</span>
                            </CommandItem>
                        </CommandGroup>
                    </>
                )}

                {!loading && query.length >= 2 && results.length === 0 && (
                    <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
                )}

                {!loading && products.length > 0 && (
                    <CommandGroup heading="Ürünler">
                        {products.slice(0, 5).map((result) => (
                            <CommandItem
                                key={`product-${result.id}`}
                                onSelect={() => handleSelect(result.href)}
                            >
                                {getIcon(result.type)}
                                <div className="flex flex-col">
                                    <span>{result.title}</span>
                                    {result.subtitle && (
                                        <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                                    )}
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}

                {!loading && orders.length > 0 && (
                    <>
                        <CommandSeparator />
                        <CommandGroup heading="Siparişler">
                            {orders.slice(0, 5).map((result) => (
                                <CommandItem
                                    key={`order-${result.id}`}
                                    onSelect={() => handleSelect(result.href)}
                                >
                                    {getIcon(result.type)}
                                    <div className="flex flex-col">
                                        <span>{result.title}</span>
                                        {result.subtitle && (
                                            <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                                        )}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </>
                )}
            </CommandList>
        </CommandDialog>
    );
}
