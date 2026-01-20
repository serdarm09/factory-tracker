"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApproveButton } from "@/components/approve-button";
import { RejectButton } from "@/components/reject-button";
import { EditProductDialog } from "@/components/edit-product-dialog";
import { approveProduct, rejectProduct } from "@/lib/actions";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { translateStatus } from "@/lib/translations";

interface PendingApprovalsTableProps {
    pendingProducts: any[];
    userRole?: string;
}

export function PendingApprovalsTable({ pendingProducts, userRole }: PendingApprovalsTableProps) {
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [isOpen, setIsOpen] = useState(false);

    const handleRowClick = (product: any) => {
        setSelectedProduct(product);
        setIsOpen(true);
    };

    return (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Ürün</TableHead>
                        <TableHead>Planlayan</TableHead>
                        <TableHead>Malzeme</TableHead>
                        <TableHead>Not</TableHead>
                        <TableHead>Firma</TableHead>
                        <TableHead>Giriş Tarihi</TableHead>
                        <TableHead>Termin</TableHead>
                        <TableHead>Adet</TableHead>
                        <TableHead>İşlem</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {pendingProducts.map(p => (
                        <TableRow
                            key={p.id}
                            className="cursor-pointer hover:bg-slate-50 transition-colors"
                            onClick={() => handleRowClick(p)}
                        >
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    {p.imageUrl && (
                                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-slate-100">
                                            <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                                        </div>
                                    )}
                                    <div>
                                        <div className="font-bold">{p.name}</div>
                                        <div className="text-xs text-slate-500">{p.model}</div>
                                        <div className="text-xs text-slate-400">{p.systemCode}</div>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="text-sm font-medium text-blue-600">
                                {(p.creator as any)?.username || '-'}
                            </TableCell>
                            <TableCell className="text-sm">{p.material || '-'}</TableCell>
                            <TableCell className="max-w-[150px] truncate text-sm text-slate-500" title={p.description || ''}>
                                {p.description || '-'}
                            </TableCell>
                            <TableCell>{p.order?.company || p.company || '-'}</TableCell>
                            <TableCell>{new Date(p.createdAt).toLocaleDateString('tr-TR')}</TableCell>
                            <TableCell className="text-red-900 font-medium">{new Date(p.terminDate).toLocaleDateString('tr-TR')}</TableCell>
                            <TableCell>{p.quantity}</TableCell>
                            <TableCell>
                                <div onClick={(e) => e.stopPropagation()} className="flex">
                                    <ApproveButton
                                        action={approveProduct.bind(null, p.id)}
                                        label="Onayla"
                                    />
                                    <RejectButton action={rejectProduct.bind(null, p.id)} />
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                    {pendingProducts.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={9} className="text-center py-4 text-slate-500">Onay bekleyen ürün yok.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Ürün Detayları: {selectedProduct?.name}</DialogTitle>
                        <DialogDescription>
                            Kod: {selectedProduct?.systemCode} | Model: {selectedProduct?.model}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedProduct && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="col-span-full flex justify-center">
                                {selectedProduct.imageUrl && (
                                    <div className="relative h-64 w-full md:w-96 mb-4 rounded-lg overflow-hidden border bg-slate-100">
                                        {/* Using standard img tag for simplicity with local files, or Next Image if configured */}
                                        <img
                                            src={selectedProduct.imageUrl}
                                            alt={selectedProduct.name}
                                            className="object-contain w-full h-full"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <Section title="Temel Bilgiler">
                                    <Detail label="Firma / Müşteri" value={selectedProduct.order?.company || selectedProduct.company} />
                                    <Detail label="Adet" value={selectedProduct.quantity} />
                                    <Detail label="Durum" value={translateStatus(selectedProduct.status)} />
                                    <Detail label="Barkod" value={selectedProduct.barcode || '-'} />
                                </Section>

                                <Section title="Tarihler">
                                    <Detail label="Sipariş Tarihi" value={format(new Date(selectedProduct.orderDate || selectedProduct.createdAt), "PPP", { locale: tr })} />
                                    <Detail label="Termin Tarihi" value={format(new Date(selectedProduct.terminDate), "PPP", { locale: tr })} />
                                    <Detail label="Oluşturulma" value={format(new Date(selectedProduct.createdAt), "PPP HH:mm", { locale: tr })} />
                                </Section>
                            </div>

                            <div className="space-y-4">
                                <Section title="Özellikler">
                                    <Detail label="Ayak Modeli" value={selectedProduct.footType} />
                                    <Detail label="Ayak Özelliği" value={selectedProduct.footMaterial} />
                                    <Detail label="Kol Modeli" value={selectedProduct.armType} />
                                    <Detail label="Sırt Modeli" value={selectedProduct.backType} />
                                    <Detail label="Kumaş Türü" value={selectedProduct.fabricType} />
                                    <Detail label="Malzeme Detayı" value={selectedProduct.material} />
                                </Section>

                                <Section title="Personel">
                                    <Detail label="Planlayan" value={selectedProduct.creator?.username} />
                                    <Detail label="Atanan Usta" value={selectedProduct.master} />
                                </Section>
                            </div>

                            <div className="col-span-full border-t pt-4">
                                <h4 className="font-semibold mb-2">Açıklama / Notlar</h4>
                                <div className="p-3 bg-slate-50 rounded-md border text-sm min-h-[60px]">
                                    {selectedProduct.description || "Açıklama yok."}
                                </div>
                            </div>

                            <div className="col-span-full flex justify-end gap-2 border-t pt-4 mt-2">
                                <div onClick={() => setIsOpen(false)}>
                                    <EditProductDialog product={selectedProduct} userRole={userRole} />
                                </div>
                                <div onClick={() => setIsOpen(false)}>
                                    <RejectButton action={async (reason) => {
                                        await rejectProduct(selectedProduct.id, reason);
                                        setIsOpen(false);
                                    }} />
                                </div>
                                <div onClick={() => setIsOpen(false)}>
                                    <ApproveButton
                                        action={async () => {
                                            await approveProduct(selectedProduct.id);
                                            setIsOpen(false);
                                        }}
                                        label="Onayla & Barkod Üret"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
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
