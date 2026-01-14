'use client';

import { toast } from "sonner";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateProduct } from "@/lib/actions";
import { Pencil } from "lucide-react";


type Product = {
    id: number;
    name: string;
    model: string;
    company: string | null;
    quantity: number;
    produced: number;
    systemCode: string;
    barcode: string | null;
    status: string;
    terminDate: Date;
    material?: string | null;
    description?: string | null;
    shelf?: string | null;
};

function EditProductDialog({ product, role }: { product: Product, role: string }) {
    const [open, setOpen] = useState(false);

    // Permission Check
    const isWorker = role === 'WORKER';
    const isPlanner = role === 'PLANNER';
    const isAdmin = role === 'ADMIN';

    // Disable if planner and already approved
    if (isPlanner && product.status !== 'PENDING') {
        return null; // Cannot edit
    }

    // Determine readOnly state for fields
    // WORKER can only edit Name(No), Model(No), Shelf(Yes), Quantity(Yes)
    // Actually prompt says "only shelf and adeti". So others readOnly.

    async function clientAction(formData: FormData) {
        const res = await updateProduct(product.id, formData);
        if (res?.error) {
            toast.error(res.error);
        } else {
            toast.success("Ürün başarıyla güncellendi");
            setOpen(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Ürün Düzenle: {product.name}</DialogTitle>
                </DialogHeader>
                <form action={clientAction} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Ürün Adı</Label>
                            <Input name="name" defaultValue={product.name} required readOnly={isWorker} className={isWorker ? "bg-slate-100" : ""} />
                        </div>
                        <div className="space-y-2">
                            <Label>Model</Label>
                            <Input name="model" defaultValue={product.model} required readOnly={isWorker} className={isWorker ? "bg-slate-100" : ""} />
                        </div>
                        <div className="space-y-2">
                            <Label>Firma</Label>
                            <Input name="company" defaultValue={product.company || ''} readOnly={isWorker} className={isWorker ? "bg-slate-100" : ""} />
                        </div>
                        <div className="space-y-2">
                            <Label>Termin Tarihi</Label>
                            <Input name="terminDate" type="date" defaultValue={new Date(product.terminDate).toISOString().split('T')[0]} required readOnly={isWorker} className={isWorker ? "bg-slate-100" : ""} />
                        </div>
                        <div className="space-y-2">
                            <Label>Raf Kodu</Label>
                            <Input name="shelf" defaultValue={product.shelf || ''} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Malzeme</Label>
                            <Input name="material" defaultValue={product.material || ''} readOnly={isWorker} className={isWorker ? "bg-slate-100" : ""} />
                        </div>

                        {/* Admin or Planner can edit Planned Quantity */}
                        {(isAdmin || isPlanner) && (
                            <div className="space-y-2">
                                <Label>Planlanan Adet</Label>
                                <Input name="quantity" type="number" defaultValue={product.quantity} required />
                            </div>
                        )}

                        {/* Admin or Worker can edit Produced Quantity */}
                        {(isAdmin || isWorker) && (
                            <div className="space-y-2">
                                <Label>Üretim / Stok {isWorker ? '(Düzenleme)' : ''}</Label>
                                <Input name="produced" type="number" defaultValue={product.produced} required />
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label>Not / Açıklama</Label>
                        <Textarea name="description" defaultValue={product.description || ''} readOnly={isWorker} className={isWorker ? "bg-slate-100" : ""} />
                    </div>
                    <Button type="submit" className="w-full">Kaydet</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function WarehouseTable({ products, role }: { products: Product[], role: string }) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [sortColumn, setSortColumn] = useState<keyof Product | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const handleSort = (column: keyof Product) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const filtered = products.filter(p => {
        const term = search.toLowerCase();
        const dateString = new Date(p.terminDate).toLocaleDateString('tr-TR');
        const matchesSearch =
            p.name.toLowerCase().includes(term) ||
            p.systemCode.toLowerCase().includes(term) ||
            (p.barcode && p.barcode.toLowerCase().includes(term)) ||
            (p.company && p.company.toLowerCase().includes(term)) ||
            (p.description && p.description.toLowerCase().includes(term)) ||
            (p.shelf && p.shelf.toLowerCase().includes(term)) ||
            dateString.includes(term);

        const matchesStatus = statusFilter === "ALL" ? true : p.status === statusFilter;
        return matchesSearch && matchesStatus;
    }).sort((a, b) => {
        if (!sortColumn) return 0;

        const aValue = a[sortColumn];
        const bValue = b[sortColumn];

        if (aValue === bValue) return 0;

        // Handle nulls
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        const direction = sortDirection === 'asc' ? 1 : -1;

        if (aValue < bValue) return -1 * direction;
        if (aValue > bValue) return 1 * direction;
        return 0;
    });

    const SortIcon = ({ column }: { column: keyof Product }) => {
        if (sortColumn !== column) return <span className="ml-1 text-slate-300">↕</span>;
        return <span className="ml-1 text-blue-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-4">
                <Input
                    placeholder="Ara: Ürün, Kod, Barkod veya Raf..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm"
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-10 w-[180px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <option value="ALL">Tümü</option>
                    <option value="APPROVED">Onaylananlar</option>
                    <option value="COMPLETED">Tamamlananlar</option>
                </select>
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('systemCode')}>
                                Sistem Kodu <SortIcon column="systemCode" />
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('name')}>
                                Ürün <SortIcon column="name" />
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('shelf')}>
                                Raf <SortIcon column="shelf" />
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('material')}>
                                Malzeme <SortIcon column="material" />
                            </TableHead>
                            <TableHead>Not</TableHead>
                            <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('company')}>
                                Firma <SortIcon column="company" />
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('terminDate')}>
                                Termin <SortIcon column="terminDate" />
                            </TableHead>
                            <TableHead>Barkod</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead className="text-right cursor-pointer hover:bg-slate-50" onClick={() => handleSort('produced')}>
                                İlerleme <SortIcon column="produced" />
                            </TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.map((p) => (
                            <TableRow key={p.id}>
                                <TableCell className="font-mono">{p.systemCode}</TableCell>
                                <TableCell>
                                    <div className="font-semibold">{p.name}</div>
                                    <div className="text-xs text-slate-500">{p.model}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded inline-block font-mono font-bold text-xs">
                                        {p.shelf || '-'}
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm">{p.material || '-'}</TableCell>
                                <TableCell className="max-w-[150px] truncate text-sm text-slate-500" title={p.description || ''}>
                                    {p.description || '-'}
                                </TableCell>
                                <TableCell>{p.company || "-"}</TableCell>
                                <TableCell className="text-xs text-slate-500 font-mono">
                                    {new Date(p.terminDate).toLocaleDateString('tr-TR')}
                                </TableCell>
                                <TableCell className="font-mono text-xs">{p.barcode || "-"}</TableCell>
                                <TableCell>
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${p.produced >= p.quantity
                                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                        : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                        }`}>
                                        {p.produced >= p.quantity ? 'TAMAMLANDI' : 'EKSİK / KISMİ'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className={`font-bold ${p.produced >= p.quantity ? 'text-blue-600' : 'text-yellow-600'}`}>
                                        {p.produced} / {p.quantity} ({Math.round((p.produced / p.quantity) * 100)}%)
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {role !== 'VIEWER' && (
                                        <EditProductDialog product={p} role={role} />
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={11} className="text-center py-8 text-slate-500">
                                    Kayıt bulunamadı.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
