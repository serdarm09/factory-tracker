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
import { Pencil, Lock } from "lucide-react";

interface EditProductDialogProps {
    product: any; // Using any for now to avoid complexity with Prisma types on client
    userRole?: string; // Kullanıcı rolü
}

export function EditProductDialog({ product, userRole }: EditProductDialogProps) {
    const [open, setOpen] = useState(false);

    // Onaylanmış veya tamamlanmış ürünler için sadece admin düzenleyebilir
    const isApprovedOrCompleted = product.status === 'APPROVED' || product.status === 'COMPLETED' || product.status === 'IN_PRODUCTION';
    const canEdit = userRole === 'ADMIN' || !isApprovedOrCompleted;

    if (!canEdit) {
        return (
            <Button variant="outline" size="sm" className="h-8 gap-1 opacity-50 cursor-not-allowed" disabled>
                <Lock className="h-3 w-3" />
                Kilitli
            </Button>
        );
    }

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
                        {isApprovedOrCompleted
                            ? "Bu ürün onaylanmış durumda. Yönetici olarak düzenleme yapabilirsiniz."
                            : "Reddedilen veya hatalı girilen planı buradan güncelleyebilirsiniz. Güncelleme sonrası ürün durumu tekrar değerlendirilecektir."
                        }
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
