"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, X, Plus } from "lucide-react"

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
import { FeatureCategory, getFeatures, addFeature } from "@/lib/feature-actions"
import { toast } from "sonner"

interface FeatureComboboxProps {
    category: FeatureCategory;
    placeholder: string;
    onSelect: (value: string) => void;
    defaultValue?: string;
    disabled?: boolean;
    initialValue?: string;
}

export function FeatureCombobox({ category, placeholder, onSelect, defaultValue, disabled, initialValue }: FeatureComboboxProps) {
    const [open, setOpen] = React.useState(false)
    const [value, setValue] = React.useState(initialValue || defaultValue || "")
    const [items, setItems] = React.useState<{ id: number; name: string }[]>([])
    const [loading, setLoading] = React.useState(false)
    const [searchTerm, setSearchTerm] = React.useState("")
    const [creating, setCreating] = React.useState(false)

    React.useEffect(() => {
        if (initialValue) {
            setValue(initialValue)
        } else if (defaultValue) {
            setValue(defaultValue)
        }
    }, [defaultValue, initialValue])

    // Effect to clear value if external initialValue becomes empty (for form reset)
    React.useEffect(() => {
        if (initialValue === "") {
            setValue("")
        }
    }, [initialValue])

    const load = React.useCallback(async () => {
        setLoading(true)
        try {
            const data = await getFeatures(category)
            setItems(data)
        } finally {
            setLoading(false)
        }
    }, [category]);

    React.useEffect(() => {
        if (open) {
            load()
        }
    }, [open, load])

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        setValue("")
        onSelect("")
    }

    const handleCreate = async () => {
        if (!searchTerm || searchTerm.trim().length === 0) return;

        setCreating(true);
        try {
            const res = await addFeature(category, searchTerm);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Yeni özellik eklendi");
                await load(); // Reload list
                setValue(searchTerm);
                onSelect(searchTerm);
                setOpen(false);
            }
        } catch (e) {
            toast.error("Ekleme başarısız");
        } finally {
            setCreating(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    type="button"
                    disabled={disabled}
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {value ? (
                        <div className="flex items-center justify-between w-full">
                            <span>{value}</span>
                            <div className="flex items-center">
                                <X
                                    className="mr-2 h-4 w-4 opacity-50 hover:opacity-100 cursor-pointer text-red-500"
                                    onClick={handleClear}
                                />
                                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                            </div>
                        </div>
                    ) : (
                        <>
                            <span className="text-muted-foreground">{placeholder}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command>
                    <CommandInput
                        placeholder={`${placeholder} ara...`}
                        onValueChange={setSearchTerm}
                    />
                    <CommandList>
                        <CommandEmpty className="p-2">
                            {loading ? (
                                <div className="flex items-center justify-center p-2 text-sm text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Yükleniyor...
                                </div>
                            ) : (
                                searchTerm && !items.some(i => i.name.toLowerCase() === searchTerm.toLowerCase()) ? (
                                    <Button
                                        variant="ghost"
                                        type="button"
                                        className="w-full justify-start text-sm h-auto py-2 px-2"
                                        onClick={handleCreate}
                                        disabled={creating}
                                    >
                                        {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                        "{searchTerm}" Ekle
                                    </Button>
                                ) : (
                                    <div className="text-center py-2 text-sm text-muted-foreground">Sonuç yok.</div>
                                )
                            )}
                        </CommandEmpty>
                        <CommandGroup>
                            {!loading && items.map((item) => (
                                <CommandItem
                                    key={item.id}
                                    value={item.name}
                                    onSelect={(currentValue) => {
                                        setValue(item.name) // Use original name for display
                                        onSelect(item.name)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === item.name ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {item.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
