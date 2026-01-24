"use client";

import { Button } from "@/components/ui/button";
import { Check, X, Trash2, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface BulkActionBarProps {
    selectedCount: number;
    onClearSelection: () => void;
    onBulkApprove?: () => Promise<{ success?: boolean; error?: string }>;
    onBulkReject?: (reason: string) => Promise<{ success?: boolean; error?: string }>;
    onBulkDelete?: () => Promise<{ success?: boolean; error?: string }>;
}

export function BulkActionBar({
    selectedCount,
    onClearSelection,
    onBulkApprove,
    onBulkReject,
    onBulkDelete,
}: BulkActionBarProps) {
    const [isPending, startTransition] = useTransition();
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [rejectReason, setRejectReason] = useState("");

    if (selectedCount === 0) return null;

    const handleApprove = () => {
        if (!onBulkApprove) return;
        startTransition(async () => {
            const result = await onBulkApprove();
            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success(`${selectedCount} ürün onaylandı`);
                onClearSelection();
            }
        });
    };

    const handleReject = () => {
        if (!onBulkReject || !rejectReason.trim()) return;
        startTransition(async () => {
            const result = await onBulkReject(rejectReason);
            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success(`${selectedCount} ürün reddedildi`);
                onClearSelection();
            }
            setShowRejectDialog(false);
            setRejectReason("");
        });
    };

    const handleDelete = () => {
        if (!onBulkDelete) return;
        startTransition(async () => {
            const result = await onBulkDelete();
            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success(`${selectedCount} ürün silindi`);
                onClearSelection();
            }
            setShowDeleteDialog(false);
        });
    };

    return (
        <>
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 animate-in slide-in-from-bottom-4">
                <span className="font-medium">{selectedCount} öğe seçili</span>
                <div className="h-6 w-px bg-slate-600" />
                <div className="flex items-center gap-2">
                    {onBulkApprove && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-400 hover:text-green-300 hover:bg-green-900/30"
                            onClick={handleApprove}
                            disabled={isPending}
                        >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                            Onayla
                        </Button>
                    )}
                    {onBulkReject && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/30"
                            onClick={() => setShowRejectDialog(true)}
                            disabled={isPending}
                        >
                            <X className="h-4 w-4 mr-1" />
                            Reddet
                        </Button>
                    )}
                    {onBulkDelete && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/30"
                            onClick={() => setShowDeleteDialog(true)}
                            disabled={isPending}
                        >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Sil
                        </Button>
                    )}
                </div>
                <div className="h-6 w-px bg-slate-600" />
                <Button
                    size="sm"
                    variant="ghost"
                    className="text-slate-400 hover:text-slate-300"
                    onClick={onClearSelection}
                    disabled={isPending}
                >
                    Seçimi Temizle
                </Button>
            </div>

            {/* Reject Dialog */}
            <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Toplu Reddetme</AlertDialogTitle>
                        <AlertDialogDescription>
                            {selectedCount} ürünü reddetmek üzeresiniz. Lütfen bir ret sebebi girin.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <Label htmlFor="reject-reason">Ret Sebebi</Label>
                        <Input
                            id="reject-reason"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Ret sebebini yazın..."
                            className="mt-2"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>İptal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleReject}
                            disabled={isPending || !rejectReason.trim()}
                            className="bg-yellow-600 hover:bg-yellow-700"
                        >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                            Reddet
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Toplu Silme</AlertDialogTitle>
                        <AlertDialogDescription>
                            {selectedCount} ürünü silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>İptal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isPending}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                            Sil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
