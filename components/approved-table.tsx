'use client';

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ExportButton } from "@/components/export-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpDown, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import BarcodeDisplay from "@/components/barcode-display";
import { revokeApproval } from "@/lib/actions";
import { DateRangeFilter } from "./date-range-filter";
import { DateRange } from "react-day-picker";

type Product = {
    id: number;
    name: string;
    model: string;
    company: string | null;
    quantity: number;
    produced: number;
    status: string;
    systemCode: string;
    barcode: string | null;
    createdAt: Date;
    terminDate: Date;
    material?: string | null;
    description?: string | null;
};

export function ApprovedTable({ products }: { products: Product[] }) {
    const [sortConfig, setSortConfig] = useState<{ key: keyof Product | null; direction: 'asc' | 'desc' }>({
        key: 'createdAt',
        direction: 'desc',
    });
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

    const filteredProducts = products.filter(p => {
        if (dateRange?.from) {
            const from = new Date(dateRange.from);
            from.setHours(0, 0, 0, 0);

            const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
            to.setHours(23, 59, 59, 999);

            const current = new Date(p.terminDate); // Filtering Approval list by Termin Date as well, or maybe CreatedAt? Let's use Termin for consistency
            // User might want to see approved items by Approval Date (createdAt usually tracks entry in this system).
            // But usually "when is it due" is more important. Let's stick to Termin Date for now unless requested otherwise.
            // Actually for "Approved" list, usually we care about "When was it approved?". But currently `createdAt` is creation date. 
            // In Approvals page, these are "Active Approved". 
            // Let's filter by TERMIN DATE.
            return current >= from && current <= to;
        }
        return true;
    });

    const sortedProducts = [...filteredProducts].sort((a, b) => {
        if (!sortConfig.key) return 0;

        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    const requestSort = (key: keyof Product) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const SortHead = ({ label, sortKey }: { label: string, sortKey: keyof Product }) => (
        <TableHead>
            <Button variant="ghost" onClick={() => requestSort(sortKey)} className="hover:bg-transparent px-0 font-bold">
                {label}
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        </TableHead>
    );

    return (
        <div className="space-y-4">
            <div className="flex justify-end gap-2">
                <div className="relative">
                    <DateRangeFilter date={dateRange} setDate={setDateRange} />
                    {dateRange?.from && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -right-2 -top-2 h-5 w-5 bg-slate-100 rounded-full border shadow-sm hover:bg-red-100 hover:text-red-600"
                            onClick={() => setDateRange(undefined)}
                        >
                            <span className="sr-only">Temizle</span>
                            <span className="text-xs">✕</span>
                        </Button>
                    )}
                </div>
                <ExportButton
                    data={sortedProducts.map(p => ({
                        "Ürün Adı": p.name,
                        "Model": p.model,
                        "Firma": p.company,
                        "Malzeme": p.material,
                        "Açıklama": p.description,
                        "Giriş Tarihi": new Date(p.createdAt).toLocaleDateString('tr-TR'),
                        "Termin Tarihi": new Date(p.terminDate).toLocaleDateString('tr-TR'),
                        "Kullanılan Barkod": p.barcode,
                        "Durum": p.status
                    }))}
                    filename="onaylanan-urunler"
                    label="Listeyi İndir"
                />
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <SortHead label="Ürün" sortKey="name" />
                        <SortHead label="Model" sortKey="model" />
                        <TableHead>Malzeme</TableHead>
                        <TableHead>Not</TableHead>
                        <SortHead label="Firma" sortKey="company" />
                        <SortHead label="Giriş / Onay" sortKey="createdAt" />
                        <SortHead label="Termin" sortKey="terminDate" />
                        <SortHead label="Barkod" sortKey="barcode" />
                        <TableHead className="text-right">İşlem</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedProducts.map(p => (
                        <TableRow key={p.id} className="h-8">
                            <TableCell className="py-2">
                                <div className="flex justify-center">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${p.status === 'COMPLETED' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="font-medium py-2">{p.name}</TableCell>
                            <TableCell className="py-2">{p.model}</TableCell>
                            <TableCell className="py-2 text-sm">{p.material || '-'}</TableCell>
                            <TableCell className="py-2 max-w-[150px] truncate text-sm text-slate-500" title={p.description || ''}>
                                {p.description || '-'}
                            </TableCell>
                            <TableCell className="py-2">{p.company || '-'}</TableCell>
                            <TableCell className="py-2 text-slate-500">{new Date(p.createdAt).toLocaleDateString('tr-TR')}</TableCell>
                            <TableCell className="py-2 text-red-900 font-medium">{new Date(p.terminDate).toLocaleDateString('tr-TR')}</TableCell>
                            <TableCell className="py-2">
                                {p.barcode ? (
                                    <div className="max-w-[150px] overflow-hidden">
                                        <BarcodeDisplay value={p.barcode} />
                                    </div>
                                ) : (
                                    <span className="font-mono text-slate-400">-</span>
                                )}
                            </TableCell>
                            <TableCell className="text-right py-2">
                                <CancelButton id={p.id} status={p.status} />
                            </TableCell>
                        </TableRow>
                    ))}
                    {sortedProducts.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={9} className="text-center py-4 text-slate-500">Henüz onaylanan ürün yok.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

function CancelButton({ id, status }: { id: number, status: string }) {
    const [isPending, startTransition] = useTransition();

    const handleCancel = () => {
        if (!confirm("Bu onayı iptal etmek istediğinize emin misiniz? Barkod silinecek.")) return;

        startTransition(async () => {
            const res = await revokeApproval(id);
            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success("Onay iptal edildi (Barkod silindi)");
            }
        });
    };

    return (
        <Button
            variant="destructive"
            size="sm"
            className="h-8 px-2 text-xs"
            disabled={status === 'COMPLETED' || isPending}
            onClick={handleCancel}
        >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
            İptal
        </Button>
    );
}
