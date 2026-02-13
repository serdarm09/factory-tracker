"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SemiFinishedDialog } from "./semi-finished-dialog";
import { SemiFinishedStockDialog } from "./semi-finished-stock-dialog";
import { Edit, ArrowUpCircle, ArrowDownCircle, Trash2, Search, X, Filter } from "lucide-react";
import { deleteSemiFinished } from "@/lib/actions";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/pagination";

interface SemiFinished {
    id: number;
    name: string;
    code: string;
    description: string | null;
    quantity: number;
    minStock: number;
    unit: string;
    category: string | null;
    location: string | null;
    createdAt: Date;
    updatedAt: Date;
    logs: {
        id: number;
        type: string;
        quantity: number;
        note: string | null;
        createdAt: Date;
    }[];
}

interface SemiFinishedTableProps {
    items: SemiFinished[];
    categories: string[];
    locations: string[];
    currentFilters: {
        search: string;
        category: string;
        location: string;
        status: string;
    };
}

export function SemiFinishedTable({ items, categories, locations, currentFilters }: SemiFinishedTableProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [currentPage, setCurrentPage] = useState(1);
    const [searchInput, setSearchInput] = useState(currentFilters.search);
    const [showFilters, setShowFilters] = useState(false);
    const itemsPerPage = 25;

    // Pagination
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const paginatedItems = items.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const updateFilter = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value && value !== 'all') {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        router.push(`?${params.toString()}`);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        updateFilter('q', searchInput);
    };

    const clearFilters = () => {
        setSearchInput('');
        router.push('/dashboard/semi-finished');
    };

    const hasActiveFilters = currentFilters.search || currentFilters.category || currentFilters.location || currentFilters.status;

    const handleDelete = async (id: number, name: string) => {
        if (!confirm(`"${name}" yarı mamülünü silmek istediğinize emin misiniz?`)) {
            return;
        }

        const result = await deleteSemiFinished(id);
        if (result.success) {
            toast.success("Yarı mamül silindi");
        } else {
            toast.error(result.error || "Silme işlemi başarısız");
        }
    };

    if (items.length === 0) {
        return (
            <>
                {/* Filtreleme Bölümü */}
                <div className="space-y-4 mb-6">
                    {/* Arama Çubuğu */}
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="İsim, kod veya açıklama ile ara..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Button type="submit" variant="secondary">
                            Ara
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <Filter className="h-4 w-4 mr-2" />
                            Filtreler
                        </Button>
                        {hasActiveFilters && (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={clearFilters}
                            >
                                <X className="h-4 w-4 mr-2" />
                                Temizle
                            </Button>
                        )}
                    </form>

                    {/* Genişletilmiş Filtreler */}
                    {showFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Kategori</label>
                                <Select
                                    value={currentFilters.category}
                                    onValueChange={(value) => updateFilter('category', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tümü" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Tümü</SelectItem>
                                        {categories.map(cat => (
                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Lokasyon</label>
                                <Select
                                    value={currentFilters.location}
                                    onValueChange={(value) => updateFilter('location', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tümü" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Tümü</SelectItem>
                                        {locations.map(loc => (
                                            <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Stok Durumu</label>
                                <Select
                                    value={currentFilters.status}
                                    onValueChange={(value) => updateFilter('status', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tümü" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Tümü</SelectItem>
                                        <SelectItem value="normal">Normal</SelectItem>
                                        <SelectItem value="low-stock">Düşük Stok</SelectItem>
                                        <SelectItem value="out-of-stock">Stokta Yok</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </div>

                <div className="text-center py-8 text-muted-foreground border rounded-lg bg-slate-50">
                    {hasActiveFilters ? (
                        <>
                            <p className="text-lg font-medium mb-2">Filtreye uygun sonuç bulunamadı</p>
                            <Button onClick={clearFilters} variant="outline" size="sm">
                                Filtreleri Temizle
                            </Button>
                        </>
                    ) : (
                        <p>Henüz yarı mamül kaydı yok. Yeni eklemek için yukarıdaki butonu kullanın.</p>
                    )}
                </div>
            </>
        );
    }

    return (
        <>
            {/* Filtreleme Bölümü */}
            <div className="space-y-4 mb-6">
                {/* Arama Çubuğu */}
                <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="İsim, kod veya açıklama ile ara..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Button type="submit" variant="secondary">
                        Ara
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter className="h-4 w-4 mr-2" />
                        Filtreler
                        {hasActiveFilters && (
                            <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full">
                                !
                            </Badge>
                        )}
                    </Button>
                    {hasActiveFilters && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={clearFilters}
                        >
                            <X className="h-4 w-4 mr-2" />
                            Temizle
                        </Button>
                    )}
                </form>

                {/* Genişletilmiş Filtreler */}
                {showFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Kategori</label>
                            <Select
                                value={currentFilters.category}
                                onValueChange={(value) => updateFilter('category', value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Tümü" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tümü</SelectItem>
                                    {categories.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Lokasyon</label>
                            <Select
                                value={currentFilters.location}
                                onValueChange={(value) => updateFilter('location', value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Tümü" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tümü</SelectItem>
                                    {locations.map(loc => (
                                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Stok Durumu</label>
                            <Select
                                value={currentFilters.status}
                                onValueChange={(value) => updateFilter('status', value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Tümü" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tümü</SelectItem>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="low-stock">Düşük Stok</SelectItem>
                                    <SelectItem value="out-of-stock">Stokta Yok</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
            </div>

            {/* Tablo */}
            {/* Sonuç Bilgisi */}
            <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">
                    {hasActiveFilters ? (
                        <>
                            <span className="font-semibold text-slate-900">{items.length}</span> sonuç bulundu
                        </>
                    ) : (
                        <>
                            Toplam <span className="font-semibold text-slate-900">{items.length}</span> yarı mamül
                        </>
                    )}
                </p>
                <p className="text-xs text-muted-foreground">
                    Sayfa {currentPage} / {totalPages}
                </p>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Kod</TableHead>
                        <TableHead>Ad</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Lokasyon</TableHead>
                        <TableHead className="text-center">Stok</TableHead>
                        <TableHead className="text-center">Min. Stok</TableHead>
                        <TableHead className="text-center">Durum</TableHead>
                        <TableHead className="text-right">İşlemler</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {paginatedItems.map((item) => {
                    const isLowStock = item.quantity <= item.minStock;
                    const isOutOfStock = item.quantity === 0;

                    return (
                        <TableRow key={item.id} className={isOutOfStock ? "bg-red-50" : isLowStock ? "bg-amber-50" : ""}>
                            <TableCell className="font-mono text-sm">{item.code}</TableCell>
                            <TableCell>
                                <div>
                                    <div className="font-medium">{item.name}</div>
                                    {item.description && (
                                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                            {item.description}
                                        </div>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                {item.category ? (
                                    <Badge variant="outline">{item.category}</Badge>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            <TableCell>
                                {item.location || <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="text-center">
                                <span className={`font-bold ${isOutOfStock ? "text-red-600" : isLowStock ? "text-amber-600" : "text-green-600"}`}>
                                    {item.quantity}
                                </span>
                                <span className="text-muted-foreground text-xs ml-1">{item.unit}</span>
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                                {item.minStock} {item.unit}
                            </TableCell>
                            <TableCell className="text-center">
                                {isOutOfStock ? (
                                    <Badge variant="destructive">Stokta Yok</Badge>
                                ) : isLowStock ? (
                                    <Badge variant="secondary" className="bg-amber-100 text-amber-800">Düşük</Badge>
                                ) : (
                                    <Badge variant="secondary" className="bg-green-100 text-green-800">Normal</Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                    <SemiFinishedStockDialog item={item} type="IN">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50">
                                            <ArrowUpCircle className="h-4 w-4" />
                                        </Button>
                                    </SemiFinishedStockDialog>

                                    <SemiFinishedStockDialog item={item} type="OUT">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                                            <ArrowDownCircle className="h-4 w-4" />
                                        </Button>
                                    </SemiFinishedStockDialog>

                                    <SemiFinishedDialog mode="edit" item={item}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </SemiFinishedDialog>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => handleDelete(item.id, item.name)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    );
                })}
                </TableBody>
            </Table>
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                totalItems={items.length}
            />
        </>
    );
}
