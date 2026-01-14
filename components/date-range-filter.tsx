"use client"

import * as React from "react"
import { CalendarIcon, X } from "lucide-react"
import { DateRange } from "react-day-picker"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangeFilterProps {
    date: DateRange | undefined;
    setDate: (date: DateRange | undefined) => void;
    className?: string;
}

export function DateRangeFilter({
    date,
    setDate,
    className,
}: DateRangeFilterProps) {
    return (
        <div className={cn("grid gap-2", className)}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-[260px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, "d MMM", { locale: tr })} -{" "}
                                    {format(date.to, "d MMM", { locale: tr })}
                                </>
                            ) : (
                                format(date.from, "d MMM", { locale: tr })
                            )
                        ) : (
                            <span>Tarih Aralığı Seç</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                        locale={tr}
                    />
                </PopoverContent>
            </Popover>
            {date?.from && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 -top-2 h-4 w-4 bg-white rounded-full border shadow-sm"
                    onClick={() => setDate(undefined)}
                >
                    <X className="h-3 w-3" />
                </Button>
            )}
        </div>
    )
}
