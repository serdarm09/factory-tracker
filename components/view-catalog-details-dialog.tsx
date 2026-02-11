
'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Eye, Loader2 } from "lucide-react";
import { getProductComponents } from "@/lib/catalog-actions";

interface ViewCatalogDetailsDialogProps {
    product: {
        id: number;
        code: string;
        name: string;
        imageUrl: string | null;
    };
}

export function ViewCatalogDetailsDialog({ product }: ViewCatalogDetailsDialogProps) {
    const [open, setOpen] = useState(false);
    const [components, setComponents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            setLoading(true);
            getProductComponents(product.name)
                .then(data => {
                    setComponents(data);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [open, product.name]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-blue-500 hover:text-blue-700 hover:bg-blue-50">
                    <Eye className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Ürün Detayı: {product.name}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-6">
                    {/* Görsel ve Temel Bilgiler */}
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                        <div className="w-full md:w-1/2 bg-slate-100 rounded-lg p-4 flex items-center justify-center border">
                            {product.imageUrl ? (
                                <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className="max-h-64 object-contain"
                                />
                            ) : (
                                <div className="h-64 flex items-center justify-center text-slate-400">
                                    Görsel Yok
                                </div>
                            )}
                        </div>
                        <div className="w-full md:w-1/2 space-y-4">
                            <div>
                                <h3 className="text-sm font-medium text-slate-500">Ürün Kodu</h3>
                                <p className="text-xl font-bold font-mono">{product.code}</p>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-slate-500">Ürün Adı</h3>
                                <p className="text-lg">{product.name}</p>
                            </div>
                        </div>
                    </div>

                    {/* Bileşenler Listesi */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-lg border-b pb-2">Yarı Mamül Bileşenleri</h3>

                        {loading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                            </div>
                        ) : components.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {components.map((comp) => (
                                    <div key={comp.id} className="flex justify-between items-center p-3 bg-slate-50 rounded border">
                                        <span className="text-sm font-medium text-slate-600">{comp.category}</span>
                                        <span className="text-sm font-bold text-slate-900">{comp.value}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded border border-dashed">
                                Bu ürün için bileşen verisi bulunamadı.
                                <p className="text-xs mt-1 text-slate-400">
                                    (Hiçbir siparişte bu isimle eşleşen ve bileşeni olan ürün yok)
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
