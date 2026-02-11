import * as React from "react"
import { Check, ChevronsUpDown, Image as ImageIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { searchCatalog } from "@/lib/catalog-actions"

interface ProductComboboxProps {
    onSelect: (product: { code: string; name: string; model?: string; systemCode?: string; imageUrl?: string | null }) => void;
    placeholder?: string;
    disabled?: boolean;
}

export function ProductCombobox({ onSelect, placeholder = "Ürün ara (Kod veya İsim)...", disabled = false }: ProductComboboxProps) {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [results, setResults] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(false)

    React.useEffect(() => {
        if (query.length < 2) {
            setResults([])
            return
        }

        const timer = setTimeout(async () => {
            setLoading(true)
            try {
                const data = await searchCatalog(query)
                setResults(data)
            } finally {
                setLoading(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [query])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    type="button"
                    aria-expanded={open}
                    disabled={disabled}
                    className="w-full justify-between"
                >
                    {query ? query : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput placeholder="Ürün kodu veya adı ara..." value={query} onValueChange={setQuery} />
                    <CommandList>
                        <CommandEmpty>
                            {loading ? (
                                "Aranıyor..."
                            ) : (
                                <div className="py-6 text-center text-sm">
                                    <p className="font-semibold text-slate-700">Ürün bulunamadı.</p>
                                    <p className="text-slate-500 mt-1">Eğer yeni bir ürün ise, bilgileri manuel girerek ekleyebilirsiniz.</p>
                                </div>
                            )}
                        </CommandEmpty>
                        <CommandGroup heading="Sonuçlar">
                            {results.map((product) => (
                                <CommandItem
                                    key={product.id}
                                    value={product.code}
                                    onSelect={() => {
                                        onSelect(product)
                                        setOpen(false)
                                        setQuery(product.name)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            query === product.name ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex items-center gap-3 overflow-hidden w-full">
                                        <div className="h-8 w-8 shrink-0 rounded border bg-slate-100 overflow-hidden flex items-center justify-center">
                                            {product.imageUrl ? (
                                                <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <ImageIcon className="h-4 w-4 text-slate-400 opacity-50" />
                                            )}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="truncate font-medium">{product.name}</span>
                                            <span className="text-xs text-muted-foreground truncate">{product.code}</span>
                                        </div>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
