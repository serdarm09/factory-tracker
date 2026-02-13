"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, Calendar, FileText, Building2 } from "lucide-react";

interface SemiFinishedProductDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: any;
}

export function SemiFinishedProductDetailDialog({
    open,
    onOpenChange,
    item
}: SemiFinishedProductDetailDialogProps) {
    if (!item) return null;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "COMPLETED":
                return <Badge className="bg-green-600">Tamamlandı</Badge>;
            case "IN_PROGRESS":
                return <Badge className="bg-blue-600">Devam Ediyor</Badge>;
            default:
                return <Badge variant="secondary">Bekliyor</Badge>;
        }
    };

    const progressPercentage = Math.min(100, (item.producedQty / item.targetQty) * 100);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="text-2xl flex items-center gap-3">
                        <Package className="h-6 w-6 text-blue-600" />
                        {item.product.name}
                    </DialogTitle>
                    <p className="text-sm text-slate-500 mt-1">{item.product.model}</p>
                </DialogHeader>

                <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
                    <div className="space-y-6">
                        {/* Üretim Durumu */}
                        <div className="bg-slate-50 p-4 rounded-lg border">
                            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <Package className="h-5 w-5 text-blue-600" />
                                Üretim Durumu
                            </h3>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">Durum:</span>
                                    {getStatusBadge(item.status)}
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-slate-600">İlerleme:</span>
                                        <span className="text-sm font-medium">{progressPercentage.toFixed(0)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-3">
                                        <div
                                            className="bg-blue-600 h-3 rounded-full transition-all"
                                            style={{ width: `${progressPercentage}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="bg-white p-3 rounded border text-center">
                                        <span className="text-xs text-slate-500 block uppercase tracking-wider">Hedef</span>
                                        <span className="text-2xl font-bold text-slate-900">{item.targetQty}</span>
                                    </div>
                                    <div className="bg-white p-3 rounded border text-center">
                                        <span className="text-xs text-green-600 block uppercase tracking-wider">Üretilen</span>
                                        <span className="text-2xl font-bold text-green-700">{item.producedQty}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sipariş Bilgileri */}
                        {(item.product.order?.name || item.product.order?.company) && (
                            <div className="bg-slate-50 p-4 rounded-lg border">
                                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-slate-600" />
                                    Sipariş Bilgileri
                                </h3>
                                <div className="space-y-3">
                                    {item.product.order?.name && (
                                        <div>
                                            <span className="text-xs text-slate-500 block">Sipariş Adı</span>
                                            <span className="font-medium">{item.product.order.name}</span>
                                        </div>
                                    )}
                                    {item.product.order?.company && (
                                        <div>
                                            <span className="text-xs text-slate-500 block">Firma</span>
                                            <span className="font-medium">{item.product.order.company}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Açıklama */}
                        {item.product.description && (
                            <div className="bg-slate-50 p-4 rounded-lg border">
                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-slate-600" />
                                    Açıklama
                                </h3>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                    {item.product.description}
                                </p>
                            </div>
                        )}

                        {/* Sipariş Notları (NetSim) */}
                        {(item.product.aciklama1 || item.product.aciklama2 || item.product.aciklama3 || item.product.aciklama4) && (
                            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                                <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-amber-600" />
                                    Sipariş Notları
                                </h3>
                                <div className="space-y-2">
                                    {item.product.aciklama1 && (
                                        <div className="bg-white p-3 rounded border border-amber-100">
                                            <span className="font-medium text-amber-700">1:</span> {item.product.aciklama1}
                                        </div>
                                    )}
                                    {item.product.aciklama2 && (
                                        <div className="bg-white p-3 rounded border border-amber-100">
                                            <span className="font-medium text-amber-700">2:</span> {item.product.aciklama2}
                                        </div>
                                    )}
                                    {item.product.aciklama3 && (
                                        <div className="bg-white p-3 rounded border border-amber-100">
                                            <span className="font-medium text-amber-700">3:</span> {item.product.aciklama3}
                                        </div>
                                    )}
                                    {item.product.aciklama4 && (
                                        <div className="bg-white p-3 rounded border border-amber-100">
                                            <span className="font-medium text-amber-700">4:</span> {item.product.aciklama4}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Tarihler */}
                        <div className="bg-slate-50 p-4 rounded-lg border">
                            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-slate-600" />
                                Tarihler
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-xs text-slate-500 block">Oluşturulma</span>
                                    <span className="font-medium text-sm">
                                        {new Date(item.createdAt).toLocaleDateString('tr-TR', {
                                            day: '2-digit',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-500 block">Son Güncelleme</span>
                                    <span className="font-medium text-sm">
                                        {new Date(item.updatedAt).toLocaleDateString('tr-TR', {
                                            day: '2-digit',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
