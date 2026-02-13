'use client';

import { toast } from "sonner";
import { useState } from "react";
import { ExportButton } from "@/components/export-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateProduct, getMasters, shipProduct } from "@/lib/actions";
import { Pencil, Plus, Truck, Printer } from "lucide-react";
import { DateRangeFilter } from "./date-range-filter";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ProductImage } from "@/components/product-image";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect } from "react";
import { ProductTimelineDialog } from "@/components/product-timeline-dialog";
import { BarcodeLabelPrint } from "@/components/barcode-label-print";
import { Pagination } from "@/components/ui/pagination";


type Product = {
    id: number;
    name: string;
    model: string;
    company: string | null;
    quantity: number;
    produced: number;
    shipped?: number;
    available?: number;
    storedQty?: number; // Depodaki miktar
    shippedQty?: number; // Sevk edilen miktar
    systemCode: string;
    barcode: string | null;
    status: string;
    terminDate: Date;
    material?: string | null;
    description?: string | null;
    // shelf?: string | null; // Removed
    inventory: { shelf: string; quantity: number }[];
    createdAt: Date;
    creator?: { username: string };
    orderDate?: Date;
    footType?: string;
    footMaterial?: string;
    armType?: string;
    backType?: string;
    fabricType?: string;
    master?: string | null;
    imageUrl?: string | null;
    // NetSim Açıklamaları
    aciklama1?: string | null;
    aciklama2?: string | null;
    aciklama3?: string | null;
    aciklama4?: string | null;
};

function EditProductDialog({ product, role }: { product: Product, role: string }) {
    const [open, setOpen] = useState(false);
    const [masters, setMasters] = useState<{ id: number; name: string }[]>([]);
    const [selectedMaster, setSelectedMaster] = useState(product.master || '');

    useEffect(() => {
        if (open) {
            getMasters().then(data => {
                setMasters(data);
            });
        }
    }, [open]);

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
                    {product.barcode && (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-blue-700">Barkod:</span>
                                <span className="text-lg font-bold text-blue-900 font-mono">{product.barcode}</span>
                            </div>
                        </div>
                    )}
                </DialogHeader>
                <form action={clientAction} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Ürün Adı</Label>
                            <Input name="name" defaultValue={product.name} required readOnly={isWorker} className={isWorker ? "bg-slate-100" : ""} maxLength={100} />
                        </div>
                        <div className="space-y-2">
                            <Label>Model</Label>
                            <Input name="model" defaultValue={product.model} required readOnly={isWorker} className={isWorker ? "bg-slate-100" : ""} maxLength={50} />
                        </div>
                        <div className="space-y-2">
                            <Label>Firma</Label>
                            <Input name="company" defaultValue={product.company || ''} readOnly={isWorker} className={isWorker ? "bg-slate-100" : ""} maxLength={100} />
                        </div>
                        <div className="space-y-2">
                            <Label>Termin Tarihi</Label>
                            <Input name="terminDate" type="date" defaultValue={new Date(product.terminDate).toISOString().split('T')[0]} required readOnly={isWorker} className={isWorker ? "bg-slate-100" : ""} />
                        </div>
                        <div className="space-y-2">
                            <Label>Malzeme</Label>
                            <Input name="material" defaultValue={product.material || ''} readOnly={isWorker} className={isWorker ? "bg-slate-100" : ""} maxLength={100} />
                        </div>

                        <div className="space-y-2">
                            <Label>Atanan Usta</Label>
                            <input type="hidden" name="master" value={selectedMaster} />
                            <Select value={selectedMaster} onValueChange={setSelectedMaster} disabled={isWorker}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seçiniz..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {masters.map(m => (
                                        <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Admin or Planner can edit Planned Quantity */}
                        {(isAdmin || isPlanner) && (
                            <div className="space-y-2">
                                <Label>Planlanan Adet</Label>
                                <Input name="quantity" type="number" defaultValue={product.quantity} required min="1" max="100000" />
                            </div>
                        )}

                        {/* Admin or Worker can edit Produced Quantity */}
                        {(isAdmin || isWorker) && (
                            <div className="space-y-2">
                                <Label>Üretim / Stok {isWorker ? '(Düzenleme)' : ''}</Label>
                                <Input name="produced" type="number" defaultValue={product.produced} required min="0" max={product.quantity} />
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label>Not / Açıklama</Label>
                        <Textarea name="description" defaultValue={product.description || ''} readOnly={isWorker} className={isWorker ? "bg-slate-100" : ""} maxLength={500} />
                    </div>
                    <Button type="submit" className="w-full">Kaydet</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// Ship Product Dialog - for warehouse users to ship products
function ShipProductDialog({ product, role }: { product: Product, role: string }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [quantity, setQuantity] = useState("");
    const [company, setCompany] = useState(product.company || "");
    const [driverName, setDriverName] = useState("");
    const [vehiclePlate, setVehiclePlate] = useState("");

    // Calculate available quantity for shipping from storedQty (depodaki miktar)
    const storedQty = (product as any).storedQty || 0;
    const available = storedQty;

    // Only show for roles that can ship (not ENGINEER - they only view)
    if (!["ADMIN", "MARKETER", "WAREHOUSE", "WORKER"].includes(role)) {
        return null;
    }

    // Don't show if nothing available to ship
    if (available <= 0) {
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const result = await shipProduct({
            productId: product.id,
            quantity: parseInt(quantity),
            company: company,
            driverName: driverName || undefined,
            vehiclePlate: vehiclePlate || undefined
        });

        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success(`${quantity} adet sevk edildi!`);
            setOpen(false);
            setQuantity("");
            setDriverName("");
            setVehiclePlate("");
        }
        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="default" size="sm" className="h-8 gap-1 bg-green-600 hover:bg-green-700">
                    <Truck className="h-4 w-4" />
                    Sevk
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-green-600" />
                        Ürün Sevk Et
                    </DialogTitle>
                    <DialogDescription>
                        {product.name} - Depoda mevcut: <span className="font-bold text-green-600">{available}</span> adet
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Sevk Adedi *</Label>
                        <Input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            min={1}
                            max={available}
                            required
                            placeholder={`Max: ${available}`}
                            className="text-lg font-bold"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Firma / Müşteri *</Label>
                        <Input
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            required
                            placeholder="Firma adı"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Sürücü Adı</Label>
                            <Input
                                value={driverName}
                                onChange={(e) => setDriverName(e.target.value)}
                                placeholder="Opsiyonel"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Araç Plakası</Label>
                            <Input
                                value={vehiclePlate}
                                onChange={(e) => setVehiclePlate(e.target.value)}
                                placeholder="Opsiyonel"
                            />
                        </div>
                    </div>
                    <div className="pt-4 border-t">
                        <Button
                            type="submit"
                            className="w-full bg-green-600 hover:bg-green-700"
                            disabled={loading || !quantity || parseInt(quantity) <= 0}
                        >
                            {loading ? "Sevk ediliyor..." : `${quantity || 0} Adet Sevk Et`}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// Print Barcode Label Button
function PrintLabelButton({ product }: { product: Product }) {
    const [open, setOpen] = useState(false);

    // Sadece barkodu olan ürünler için göster
    if (!product.barcode) {
        return null;
    }

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setOpen(true)}
            >
                <Printer className="h-4 w-4" />
            </Button>
            <BarcodeLabelPrint
                open={open}
                onOpenChange={setOpen}
                product={{
                    barcode: product.barcode,
                    name: product.name,
                    model: product.model,
                    company: product.company
                }}
            />
        </>
    );
}

export function WarehouseTable({ products, role }: { products: Product[], role: string }) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [sortColumn, setSortColumn] = useState<keyof Product | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 25;

    // Detail View State
    const [viewProduct, setViewProduct] = useState<Product | null>(null);
    const [viewOpen, setViewOpen] = useState(false);

    const handleRowClick = (product: Product) => {
        setViewProduct(product);
        setViewOpen(true);
    };

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
        const dateObj = new Date(p.terminDate);
        const dateString = dateObj.toLocaleDateString('tr-TR');
        const matchesSearch =
            p.name.toLowerCase().includes(term) ||
            p.systemCode.toLowerCase().includes(term) ||
            (p.barcode && p.barcode.toLowerCase().includes(term)) ||
            (p.company && p.company.toLowerCase().includes(term)) ||
            (p.description && p.description.toLowerCase().includes(term)) ||
            (p.description && p.description.toLowerCase().includes(term)) ||
            (p.inventory?.some(i => i.shelf.toLowerCase().includes(term))) ||
            dateString.includes(term);

        const matchesStatus = statusFilter === "ALL" ? true : p.status === statusFilter;

        let matchesDateRequest = true;
        if (dateRange?.from) {
            const from = new Date(dateRange.from);
            from.setHours(0, 0, 0, 0);

            const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
            to.setHours(23, 59, 59, 999);

            // Filter on Termin Date by default as it's the deadline
            const current = new Date(p.terminDate);
            matchesDateRequest = current >= from && current <= to;
        }

        return matchesSearch && matchesStatus && matchesDateRequest;
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

    // Pagination
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginatedProducts = filtered.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset page when filters change
    const handleSearchChange = (value: string) => {
        setSearch(value);
        setCurrentPage(1);
    };

    const handleStatusFilterChange = (value: string) => {
        setStatusFilter(value);
        setCurrentPage(1);
    };

    const handleDateRangeChange = (range: DateRange | undefined) => {
        setDateRange(range);
        setCurrentPage(1);
    };

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
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="max-w-sm"
                />
                <select
                    value={statusFilter}
                    onChange={(e) => handleStatusFilterChange(e.target.value)}
                    className="h-10 w-[180px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <option value="ALL">Tümü</option>
                    <option value="APPROVED">Onaylananlar</option>
                    <option value="COMPLETED">Tamamlananlar</option>
                </select>
                <div className="relative">
                    <DateRangeFilter date={dateRange} setDate={handleDateRangeChange} />
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
                <div className="ml-auto">
                    <ExportButton
                        data={filtered.map(p => ({
                            "Ürün Kodu": p.systemCode,
                            "Ürün Adı": p.name,
                            "Model": p.model,
                            "Firma": p.company,
                            "Malzeme": p.material,
                            "Açıklama": p.description,
                            "Raf": p.inventory?.map(i => i.shelf).join(", "),
                            "Planlanan": p.quantity,
                            "Üretilen": p.produced,
                            "Termin": new Date(p.terminDate).toLocaleDateString('tr-TR'),
                            "Durum": p.status === 'COMPLETED' ? 'Tamamlandı' :
                                p.status === 'APPROVED' ? 'Onaylandı' :
                                    p.status === 'PENDING' ? 'Bekliyor' :
                                        p.status === 'REJECTED' ? 'Reddedildi' : p.status,
                            "Barkod": p.barcode
                        }))}
                        filename="depo-listesi"
                    />
                </div>
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
                            <TableHead className="cursor-pointer hover:bg-slate-50">
                                Raf
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
                            <TableHead>Sevk</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedProducts.map((p) => (
                            <TableRow
                                key={p.id}
                                className={`cursor-pointer transition-colors ${new Date(p.terminDate) < new Date(new Date().setHours(0, 0, 0, 0)) && p.status !== 'COMPLETED' ? 'bg-red-50 hover:bg-red-100' :
                                    new Date(p.terminDate) <= new Date(new Date().setDate(new Date().getDate() + 3)) && p.status !== 'COMPLETED' ? 'bg-amber-50 hover:bg-amber-100' :
                                        'hover:bg-slate-50'
                                    }`}
                                onClick={() => handleRowClick(p)}
                            >
                                <TableCell className="font-mono">{p.systemCode}</TableCell>
                                <TableCell>
                                    <div className="font-semibold">{p.name}</div>
                                    <div className="text-xs text-slate-500">{p.model}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded inline-block font-mono font-bold text-xs">
                                        {p.inventory?.map(i => i.shelf).join(", ") || '-'}
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm">{p.material || '-'}</TableCell>
                                <TableCell className="max-w-[150px] truncate text-sm text-slate-500" title={p.description || ''}>
                                    {p.description || '-'}
                                </TableCell>
                                <TableCell>{p.company || "-"}</TableCell>
                                <TableCell className="text-xs font-mono">
                                    <span className={`${new Date(p.terminDate) < new Date(new Date().setHours(0, 0, 0, 0)) ? 'text-red-600 font-bold' :
                                        new Date(p.terminDate) <= new Date(new Date().setDate(new Date().getDate() + 3)) ? 'text-amber-600 font-bold' :
                                            'text-slate-500'
                                        }`}>
                                        {new Date(p.terminDate).toLocaleDateString('tr-TR')}
                                    </span>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{p.barcode || "-"}</TableCell>
                                <TableCell>
                                    <div onClick={e => e.stopPropagation()}>
                                        <ProductTimelineDialog
                                            productId={p.id}
                                            productName={p.name}
                                            trigger={
                                                <span className={`cursor-pointer hover:ring-2 hover:ring-offset-1 px-2 py-1 rounded text-xs font-bold ${p.produced >= p.quantity
                                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                                    : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                                    }`}>
                                                    {p.produced >= p.quantity ? 'TAMAMLANDI' : 'EKSİK / KISMİ'}
                                                </span>
                                            }
                                        />
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className={`font-bold ${p.produced >= p.quantity ? 'text-blue-600' : 'text-yellow-600'}`}>
                                        {p.produced} / {p.quantity} ({Math.round((p.produced / p.quantity) * 100)}%)
                                    </div>
                                    <div className="text-xs mt-1">
                                        <span className="text-green-600 font-medium">Depoda: {p.storedQty || 0}</span>
                                        {(p.shipped || 0) > 0 && (
                                            <span className="text-slate-500 ml-2">| Sevk: {p.shipped}</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div onClick={(e) => e.stopPropagation()}>
                                        <ShipProductDialog product={p} role={role} />
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {role !== 'VIEWER' && role !== 'ENGINEER' && (
                                        <div onClick={(e) => e.stopPropagation()} className="flex gap-2">
                                            <EditProductDialog product={p} role={role} />
                                            <PrintLabelButton product={p} />
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {paginatedProducts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={12} className="text-center py-8 text-slate-500">
                                    Kayıt bulunamadı.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    itemsPerPage={itemsPerPage}
                    totalItems={filtered.length}
                />
            </div>

            {/* View Product Details Dialog */}
            <Dialog open={viewOpen} onOpenChange={setViewOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Ürün Detayları: {viewProduct?.name}</DialogTitle>
                        <DialogDescription>
                            Kod: {viewProduct?.systemCode} | Model: {viewProduct?.model}
                        </DialogDescription>
                    </DialogHeader>

                    {viewProduct && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="col-span-full flex justify-center">
                                <div className="relative h-64 w-full md:w-96 mb-4 rounded-lg overflow-hidden border bg-slate-100 flex items-center justify-center">
                                    <ProductImage
                                        src={viewProduct.imageUrl || `/${viewProduct.systemCode}.png`}
                                        alt={viewProduct.name}
                                        className="object-contain w-full h-full"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Section title="Temel Bilgiler">
                                    <Detail label="Firma / Müşteri" value={viewProduct.company} />
                                    <Detail label="Planlanan Adet" value={viewProduct.quantity} />
                                    <Detail label="Üretilen / Stok" value={viewProduct.produced} />
                                    <Detail label="Depoda Mevcut" value={viewProduct.storedQty || 0} />
                                    <Detail label="Sevk Edilen" value={viewProduct.shippedQty || 0} />
                                    <Detail label="Raf" value={viewProduct.inventory?.map(i => `${i.shelf} (${i.quantity})`).join(", ")} />
                                    <Detail label="Durum" value={viewProduct.status} />
                                    <Detail label="Barkod" value={viewProduct.barcode || '-'} />
                                </Section>

                                <Section title="Tarihler">
                                    {viewProduct.orderDate && (
                                        <Detail label="Sipariş Tarihi" value={format(new Date(viewProduct.orderDate), "PPP", { locale: tr })} />
                                    )}
                                    <Detail label="Termin Tarihi" value={format(new Date(viewProduct.terminDate), "PPP", { locale: tr })} />
                                    <Detail label="Oluşturulma" value={format(new Date(viewProduct.createdAt), "PPP HH:mm", { locale: tr })} />
                                </Section>
                            </div>

                            <div className="space-y-4">
                                <Section title="Özellikler">
                                    <Detail label="Ayak Modeli" value={viewProduct.footType} />
                                    <Detail label="Ayak Özelliği" value={viewProduct.footMaterial} />
                                    <Detail label="Kol Modeli" value={viewProduct.armType} />
                                    <Detail label="Sünger" value={viewProduct.backType} />
                                    <Detail label="Kumaş Türü" value={viewProduct.fabricType} />
                                    <Detail label="Malzeme Detayı" value={viewProduct.material} />
                                </Section>

                                {(viewProduct.creator || viewProduct.master) && (
                                    <Section title="Personel">
                                        {viewProduct.creator && <Detail label="Planlayan" value={viewProduct.creator.username} />}
                                        <Detail label="Atanan Usta" value={viewProduct.master} />
                                    </Section>
                                )}
                            </div>

                            <div className="col-span-full border-t pt-4">
                                <h4 className="font-semibold mb-2">Açıklama / Notlar</h4>
                                <div className="p-3 bg-slate-50 rounded-md border text-sm min-h-[60px]">
                                    {viewProduct.description || "Açıklama yok."}
                                </div>
                            </div>

                            {/* NetSim Açıklamaları */}
                            {(viewProduct.aciklama1 || viewProduct.aciklama2 || viewProduct.aciklama3 || viewProduct.aciklama4) && (
                                <div className="col-span-full border-t pt-4">
                                    <h4 className="font-semibold mb-2 text-amber-700">NetSim Açıklamaları</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {viewProduct.aciklama1 && (
                                            <div className="p-2 bg-amber-50 rounded-md border border-amber-200 text-sm">
                                                <span className="font-medium text-amber-800">Açıklama 1:</span> {viewProduct.aciklama1}
                                            </div>
                                        )}
                                        {viewProduct.aciklama2 && (
                                            <div className="p-2 bg-amber-50 rounded-md border border-amber-200 text-sm">
                                                <span className="font-medium text-amber-800">Açıklama 2:</span> {viewProduct.aciklama2}
                                            </div>
                                        )}
                                        {viewProduct.aciklama3 && (
                                            <div className="p-2 bg-amber-50 rounded-md border border-amber-200 text-sm">
                                                <span className="font-medium text-amber-800">Açıklama 3:</span> {viewProduct.aciklama3}
                                            </div>
                                        )}
                                        {viewProduct.aciklama4 && (
                                            <div className="p-2 bg-amber-50 rounded-md border border-amber-200 text-sm">
                                                <span className="font-medium text-amber-800">Açıklama 4:</span> {viewProduct.aciklama4}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <div className="border rounded-md p-3">
            <h4 className="font-semibold text-sm text-slate-900 border-b pb-1 mb-2 bg-slate-50 -mx-3 -mt-3 px-3 pt-2 rounded-t-md">{title}</h4>
            <div className="space-y-2">
                {children}
            </div>
        </div>
    );
}

function Detail({ label, value }: { label: string, value: any }) {
    if (!value) return null;
    return (
        <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{label}:</span>
            <span className="font-medium">{value}</span>
        </div>
    );
}
