'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { PlanningForm } from "./planning-form";
import { Pencil } from "lucide-react";

interface EditProductDialogProps {
    product: any; // Using any for now to avoid complexity with Prisma types on client
}

export function EditProductDialog({ product }: EditProductDialogProps) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                    <Pencil className="h-3 w-3" />
                    Düzenle
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Mevcut Planı Düzenle</DialogTitle>
                    <DialogDescription>
                        Reddedilen veya hatalı girilen planı buradan güncelleyebilirsiniz.
                        Güncelleme sonrası ürün durumu tekrar değerlendirilecektir.
                    </DialogDescription>
                </DialogHeader>

                {product.status === 'REJECTED' && product.rejectionReason && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded">
                        <div className="flex">
                            <div className="flex-1">
                                <p className="text-sm text-red-700 font-bold">
                                    REDDEDİLDİ
                                </p>
                                <p className="text-sm text-red-600 mt-1">
                                    {product.rejectionReason}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <PlanningForm key={product.id} product={product} onSuccess={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}
