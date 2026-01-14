"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react"

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
import { FeatureCategory, getFeatures } from "@/lib/feature-actions"

interface FeatureComboboxProps {
    category: FeatureCategory;
    placeholder: string;
    onSelect: (value: string) => void;
    defaultValue?: string;
    disabled?: boolean;
}

export function FeatureCombobox({ category, placeholder, onSelect, defaultValue, disabled }: FeatureComboboxProps) {
    const [open, setOpen] = React.useState(false)
    const [value, setValue] = React.useState(defaultValue || "")
    const [items, setItems] = React.useState<{ id: number; name: string }[]>([])
    const [loading, setLoading] = React.useState(false)

    React.useEffect(() => {
        setValue(defaultValue || "")
    }, [defaultValue])

    React.useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const data = await getFeatures(category)
                setItems(data)
            } finally {
                setLoading(false)
            }
        }
        if (open) {
            load()
        }
    }, [open, category])

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        setValue("")
        onSelect("")
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
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
                    <CommandInput placeholder={`${placeholder} ara...`} />
                    <CommandList>
                        <CommandEmpty>
                            {loading ? "Yükleniyor..." : "Sonuç yok."}
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
