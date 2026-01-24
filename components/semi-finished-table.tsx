"use client";

import { useState } from "react";
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
import { SemiFinishedDialog } from "./semi-finished-dialog";
import { SemiFinishedStockDialog } from "./semi-finished-stock-dialog";
import { Edit, ArrowUpCircle, ArrowDownCircle, Trash2 } from "lucide-react";
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
}

export function SemiFinishedTable({ items }: SemiFinishedTableProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 25;

    // Pagination
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const paginatedItems = items.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

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
            <div className="text-center py-8 text-muted-foreground">
                Henüz yarı mamül kaydı yok. Yeni eklemek için yukarıdaki butonu kullanın.
            </div>
        );
    }

    return (
        <>
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
