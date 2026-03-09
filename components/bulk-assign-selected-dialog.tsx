'use client';

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { tr } from "date-fns/locale";
import { getMasters } from "@/lib/actions";
import { bulkUpdateSelectedProducts } from "@/lib/actions/order-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface BulkAssignSelectedDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    productIds: number[];
    companies: string[];
    onSuccess: () => void;
}

export function BulkAssignSelectedDialog({ open, onOpenChange, productIds, companies, onSuccess }: BulkAssignSelectedDialogProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [masters, setMasters] = useState<{ id: number; name: string }[]>([]);
    const [terminDate, setTerminDate] = useState<Date | undefined>(undefined);
    const [terminInput, setTerminInput] = useState("");
    const [master, setMaster] = useState("__none__");
    const [company, setCompany] = useState("");

    useEffect(() => {
        if (open) {
            getMasters().then(setMasters);
            setTerminDate(undefined);
            setTerminInput("");
            setMaster("__none__");
            setCompany("");
        }
    }, [open]);

    const handleSave = async () => {
        if (!terminDate && master === "__none__" && !company) {
            toast.error("En az bir alan doldurun");
            return;
        }

        setLoading(true);
        try {
            const result = await bulkUpdateSelectedProducts(productIds, {
                terminDate: terminDate ? format(terminDate, "yyyy-MM-dd") : undefined,
                master: master === "__none__" ? undefined : master,
                company: company.trim() !== "" ? company.trim() : undefined,
            });

            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success(`${productIds.length} ürün güncellendi`);
                onOpenChange(false);
                onSuccess();
                router.refresh();
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Toplu Atama</DialogTitle>
                    <p className="text-sm text-slate-500">{productIds.length} seçili ürüne uygulanacak</p>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Termin Tarihi</Label>
                        <div className="flex gap-2">
                            <Input
                                type="text"
                                placeholder="gg.aa.yyyy"
                                value={terminInput}
                                onChange={(e) => {
                                    setTerminInput(e.target.value);
                                    if (e.target.value === "") {
                                        setTerminDate(undefined);
                                        return;
                                    }
                                    const parsed = parse(e.target.value, "dd.MM.yyyy", new Date());
                                    if (isValid(parsed)) setTerminDate(parsed);
                                }}
                                className="flex-1"
                            />
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" type="button" size="icon">
                                        <CalendarIcon className="h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={terminDate}
                                        onSelect={(d) => {
                                            setTerminDate(d);
                                            setTerminInput(d ? format(d, "dd.MM.yyyy") : "");
                                        }}
                                        locale={tr}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Atanan Usta</Label>
                        <Select value={master} onValueChange={setMaster}>
                            <SelectTrigger>
                                <SelectValue placeholder="Usta seçiniz..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">-- Değiştirme --</SelectItem>
                                {masters.map(m => (
                                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Firma / Müşteri (Cari)</Label>
                        <Input
                            placeholder="Müşteri ara veya yeni yazın..."
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            list="bulk-companies"
                        />
                        <datalist id="bulk-companies">
                            {companies.map((c, i) => (
                                <option key={i} value={c} />
                            ))}
                        </datalist>
                        <p className="text-xs text-slate-500">Boş bırakılırsa siparişin mevcut carisi korunur</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        İptal
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Uygula
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
