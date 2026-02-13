"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { updateProductNotes } from "@/lib/actions/semi-finished-production-actions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EditProductNotesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    productId: number;
    productName: string;
    currentNotes: {
        aciklama1?: string | null;
        aciklama2?: string | null;
        aciklama3?: string | null;
        aciklama4?: string | null;
    };
    onSuccess: () => void;
}

export function EditProductNotesDialog({
    open,
    onOpenChange,
    productId,
    productName,
    currentNotes,
    onSuccess
}: EditProductNotesDialogProps) {
    const [loading, setLoading] = useState(false);
    const [notes, setNotes] = useState({
        aciklama1: currentNotes.aciklama1 || "",
        aciklama2: currentNotes.aciklama2 || "",
        aciklama3: currentNotes.aciklama3 || "",
        aciklama4: currentNotes.aciklama4 || ""
    });

    // Dialog açıldığında notları güncelle
    useEffect(() => {
        if (open) {
            setNotes({
                aciklama1: currentNotes.aciklama1 || "",
                aciklama2: currentNotes.aciklama2 || "",
                aciklama3: currentNotes.aciklama3 || "",
                aciklama4: currentNotes.aciklama4 || ""
            });
        }
    }, [open, currentNotes]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const result = await updateProductNotes(productId, notes);

        if (result.success) {
            toast.success("Açıklamalar güncellendi");
            onSuccess();
            onOpenChange(false);
        } else {
            toast.error(result.error || "Hata oluştu");
        }

        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Sipariş Notlarını Düzenle</DialogTitle>
                    <p className="text-sm text-slate-500 mt-1">{productName}</p>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="aciklama1">Açıklama 1</Label>
                            <Textarea
                                id="aciklama1"
                                value={notes.aciklama1}
                                onChange={(e) => setNotes({ ...notes, aciklama1: e.target.value })}
                                placeholder="İlk açıklama..."
                                rows={2}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="aciklama2">Açıklama 2</Label>
                            <Textarea
                                id="aciklama2"
                                value={notes.aciklama2}
                                onChange={(e) => setNotes({ ...notes, aciklama2: e.target.value })}
                                placeholder="İkinci açıklama..."
                                rows={2}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="aciklama3">Açıklama 3</Label>
                            <Textarea
                                id="aciklama3"
                                value={notes.aciklama3}
                                onChange={(e) => setNotes({ ...notes, aciklama3: e.target.value })}
                                placeholder="Üçüncü açıklama..."
                                rows={2}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="aciklama4">Açıklama 4</Label>
                            <Textarea
                                id="aciklama4"
                                value={notes.aciklama4}
                                onChange={(e) => setNotes({ ...notes, aciklama4: e.target.value })}
                                placeholder="Dördüncü açıklama..."
                                rows={2}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            İptal
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Kaydet
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
