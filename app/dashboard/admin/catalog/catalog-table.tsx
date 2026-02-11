'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { EditCatalogDialog } from "@/components/edit-catalog-dialog";
import { ViewCatalogDetailsDialog } from "@/components/view-catalog-details-dialog";
import { deleteFromCatalog } from "@/lib/catalog-actions";
import { toast } from "sonner";

interface CatalogTableProps {
    products: {
        id: number;
        code: string;
        name: string;
        imageUrl: string | null;
        updatedAt: Date;
    }[];
}

export function CatalogTable({ products }: CatalogTableProps) {
    if (products.length === 0) {
        return <div className="text-center py-10 text-slate-500">Katalogda ürün bulunamadı.</div>;
    }

    async function handleDelete(id: number) {
        if (!confirm("Bu ürünü katalogdan silmek istediğinize emin misiniz?")) return;

        const { success, error } = await deleteFromCatalog(id);
        if (error) {
            toast.error(error);
        } else {
            toast.success("Ürün silindi.");
        }
    }

    return (
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">Görsel</TableHead>
                        <TableHead>Kod</TableHead>
                        <TableHead>İsim</TableHead>
                        <TableHead>Son Güncelleme</TableHead>
                        <TableHead className="text-right">İşlemler</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {products.map((product) => (
                        <TableRow key={product.id}>
                            <TableCell>
                                {product.imageUrl ? (
                                    <div className="h-12 w-12 rounded overflow-hidden bg-slate-100 border relative group">
                                        <img
                                            src={product.imageUrl}
                                            alt={product.code}
                                            className="h-full w-full object-cover transition-transform group-hover:scale-110"
                                        />
                                    </div>
                                ) : (
                                    <div className="h-12 w-12 rounded bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                                        Yok
                                    </div>
                                )}
                            </TableCell>
                            <TableCell className="font-mono font-medium">{product.code}</TableCell>
                            <TableCell>{product.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                                {new Date(product.updatedAt).toLocaleDateString('tr-TR')}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <ViewCatalogDetailsDialog product={product} />
                                    <EditCatalogDialog product={product} />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => handleDelete(product.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
