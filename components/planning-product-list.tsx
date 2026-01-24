'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Info, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductImage } from "@/components/product-image";
import { translateStatus } from "@/lib/translations";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import * as XLSX from "xlsx";
import { EditProductDialog } from "@/components/edit-product-dialog";
import { ApprovalButton } from "@/components/approval-button";
import { RejectionDialog } from "@/components/rejection-dialog";
import { ProductTimelineDialog } from "@/components/product-timeline-dialog";
import { DeleteProductButton } from "@/components/delete-product-button";
import { useRouter } from "next/navigation";
import { getOrderForClone } from "@/lib/actions";
import { toast } from "sonner";

interface SectionProps {
    title: string;
    children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
    return (
        <div className="space-y-2">
            <h3 className="font-semibold text-slate-900 border-b pb-1">{title}</h3>
            <div className="space-y-1">
                {children}
            </div>
        </div>
    );
}

interface DetailProps {
    label: string;
    value: React.ReactNode;
}

function Detail({ label, value }: DetailProps) {
    return (
        <div className="flex justify-between text-sm">
            <span className="text-slate-500">{label}:</span>
            <span className="font-medium text-slate-900 text-right">{value || '-'}</span>
        </div>
    );
}

interface PlanningProductListProps {
    orders: any[];
    legacyProducts: any[];
    userRole: string;
}

export function PlanningProductList({ orders, legacyProducts, userRole }: PlanningProductListProps) {
    const isViewer = userRole === 'VIEWER';
    const isAdmin = userRole === 'ADMIN';
    const isPlanner = userRole === 'PLANNER';
    const router = useRouter();

    // Detail View State
    const [viewProduct, setViewProduct] = useState<any>(null);
    const [viewOpen, setViewOpen] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [cloneLoading, setCloneLoading] = useState<number | null>(null);

    const handleRowClick = (product: any) => {
        setViewProduct(product);
        setViewOpen(true);
    };

    const handleCloneOrder = async (orderId: number) => {
        setCloneLoading(orderId);
        try {
            const result = await getOrderForClone(orderId);
            if (result.error) {
                toast.error(result.error);
                return;
            }
            if (result.data) {
                // Store clone data in sessionStorage and redirect
                sessionStorage.setItem('cloneOrderData', JSON.stringify(result.data));
                router.push('/dashboard/planning/new-order?clone=true');
            }
        } catch (error) {
            toast.error("Klonlama işlemi başarısız");
        } finally {
            setCloneLoading(null);
        }
    };

    const handleExport = () => {
        setExportLoading(true);
        try {
            const allProducts: any[] = [];

            // Helper to process product for export
            const processProduct = (p: any, orderName: string) => ({
                "Sipariş": orderName,
                "Firma": p.order?.company || p.company || '-',
                "Ürün Kodu": p.systemCode,
                "Model": p.model,
                "Ürün Adı": p.name,
                "Malzeme": p.material || '-',
                "Sipariş Tarihi": p.orderDate ? new Date(p.orderDate).toLocaleDateString('tr-TR') : '-',
                "Termin Tarihi": new Date(p.terminDate).toLocaleDateString('tr-TR'),
                "Adet": p.quantity,
                "Durum": translateStatus(p.status),
                "Açıklama": p.description || '-',
                "Barkod": p.barcode || '-'
            });

            // Add Order Products
            orders.forEach(order => {
                order.products.forEach((p: any) => {
                    allProducts.push(processProduct(p, order.name));
                });
            });

            // Add Legacy Products
            legacyProducts.forEach(p => {
                allProducts.push(processProduct(p, "Siparişsiz / Eski"));
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(allProducts);
            XLSX.utils.book_append_sheet(wb, ws, "Planlama Listesi");
            XLSX.writeFile(wb, `Planlama_Listesi_${new Date().toISOString().split('T')[0]}.xlsx`);

        } catch (error) {
            console.error(error);
            alert("Excel oluşturulurken hata oluştu.");
        } finally {
            setExportLoading(false);
        }
    };

    const ProductTable = ({ products }: { products: any[] }) => (
        <div className="rounded-md border bg-white">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[120px]">Kod / Görsel</TableHead>
                        <TableHead>Ürün</TableHead>
                        <TableHead>Malzeme</TableHead>
                        <TableHead>Not</TableHead>
                        <TableHead>Adet</TableHead>
                        <TableHead>Tarih</TableHead>
                        <TableHead>Durum</TableHead>
                        {!isViewer && <TableHead>İşlem</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {products.map((p) => (
                        <TableRow
                            key={p.id}
                            className="cursor-pointer hover:bg-slate-50 transition-colors"
                            onClick={() => handleRowClick(p)}
                        >
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                    {p.imageUrl && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={p.imageUrl} alt="" className="w-8 h-8 object-contain rounded border bg-white" />
                                    )}
                                    <span className="text-xs">{p.systemCode}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="font-semibold">{p.name}</div>
                                <div className="text-xs text-slate-500">{p.model}</div>
                            </TableCell>
                            <TableCell className="text-sm">{p.material || '-'}</TableCell>
                            <TableCell className="max-w-[150px] truncate text-sm text-slate-500" title={p.description || ''}>
                                {p.description || '-'}
                            </TableCell>
                            <TableCell className="font-bold">{p.quantity}</TableCell>
                            <TableCell>
                                {p.terminDate ? new Date(p.terminDate).toLocaleDateString('tr-TR') : '-'}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                                <ProductTimelineDialog
                                    productId={p.id}
                                    productName={p.name}
                                    trigger={
                                        <span className={`cursor-pointer hover:ring-2 hover:ring-offset-1 px-2 py-1 rounded text-xs font-bold ${p.status === 'PENDING' ? 'bg-orange-100 text-orange-600' :
                                            p.status === 'APPROVED' ? 'bg-blue-100 text-blue-600' :
                                                p.status === 'REJECTED' ? 'bg-red-100 text-red-600' :
                                                    p.status === 'COMPLETED' ? 'bg-green-100 text-green-600' :
                                                        'bg-gray-100 text-gray-600'
                                            }`}>
                                            {translateStatus(p.status).toUpperCase()}
                                        </span>
                                    }
                                />
                                {p.status === 'REJECTED' && p.rejectionReason && (
                                    <div className="group relative inline-block ml-2 align-middle">
                                        <Info className="h-4 w-4 text-red-400 cursor-help" />
                                        <div className="hidden group-hover:block absolute z-10 w-64 p-2 mt-1 -ml-2 text-xs text-white bg-slate-800 rounded shadow-lg">
                                            Red Nedeni: {p.rejectionReason}
                                        </div>
                                    </div>
                                )}
                            </TableCell>
                            {!isViewer && (
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                    <div className="flex gap-1 items-center">
                                        {/* Edit Dialog */}
                                        <EditProductDialog product={p} userRole={userRole} />

                                        {/* Admin Actions */}
                                        {isAdmin && p.status === 'PENDING' && (
                                            <>
                                                <ApprovalButton productId={p.id} />
                                                <RejectionDialog productId={p.id} productName={p.name} />
                                            </>
                                        )}

                                        {/* Delete Action - Admin & Planner */}
                                        {(isAdmin || isPlanner) && (
                                            <DeleteProductButton productId={p.id} productName={p.name} />
                                        )}
                                    </div>
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={exportLoading}
                    className="gap-2 bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800"
                >
                    {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Excel İndir
                </Button>
            </div>

            {/* Legacy Products Section (if any) */}
            {legacyProducts.length > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                    <CardHeader>
                        <CardTitle className="text-orange-900">Eski / Siparişsiz Planlar</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ProductTable products={legacyProducts} />
                    </CardContent>
                </Card>
            )}

            {/* Orders List */}
            {orders.map(order => (
                <Card key={order.id} className="overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b pb-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2">
                                    <CardTitle className="text-xl">{order.company}</CardTitle>
                                    <span className="text-sm text-slate-500 bg-white px-2 py-1 rounded border">
                                        {order.name}
                                    </span>
                                </div>
                                <div className="text-sm text-slate-500 mt-1">
                                    Pazarlamacı: {order.marketingBy?.username || '-'} | Tarih: {new Date(order.createdAt).toLocaleDateString('tr-TR')}
                                </div>
                            </div>
                            <div className="text-right flex items-center gap-2">
                                {(isAdmin || isPlanner) && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleCloneOrder(order.id)}
                                        disabled={cloneLoading === order.id}
                                        className="gap-1"
                                    >
                                        {cloneLoading === order.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <Copy className="h-3 w-3" />
                                        )}
                                        Klonla
                                    </Button>
                                )}
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${order.status === 'REQUESTED' ? 'bg-yellow-100 text-yellow-800' :
                                    order.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                    {translateStatus(order.status).toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ProductTable products={order.products} />
                    </CardContent>
                </Card>
            ))}

            {orders.length === 0 && legacyProducts.length === 0 && (
                <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-lg">
                    Henüz sipariş veya plan bulunmuyor.
                </div>
            )}

            {/* View Product Details Dialog */}
            <Dialog open={viewOpen} onOpenChange={setViewOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Ürün Detayları: {viewProduct?.name}</DialogTitle>
                        <DialogDescription>
                            Kod: {viewProduct?.systemCode} | Model: {viewProduct?.model}
                        </DialogDescription>
                    </DialogHeader>

                    {viewProduct && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="col-span-full flex justify-center">
                                <div className="relative h-64 w-full md:w-96 mb-4 rounded-lg overflow-hidden border bg-slate-100 flex items-center justify-center">
                                    <ProductImage
                                        src={viewProduct.imageUrl || `/${viewProduct.systemCode}.png`}
                                        alt={viewProduct.name}
                                        className="object-contain w-full h-full"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Section title="Temel Bilgiler">
                                    <Detail label="Firma / Müşteri" value={viewProduct.order?.company || viewProduct.company} />
                                    <Detail label="Planlanan Adet" value={viewProduct.quantity} />
                                    <Detail label="Üretilen / Stok" value={viewProduct.produced} />
                                    <Detail label="Durum" value={translateStatus(viewProduct.status)} />
                                    <Detail label="Barkod" value={viewProduct.barcode || '-'} />
                                    <Detail label="Malzeme" value={viewProduct.material} />
                                </Section>

                                <Section title="Tarihler">
                                    {viewProduct.orderDate && (
                                        <Detail label="Sipariş Tarihi" value={format(new Date(viewProduct.orderDate), "PPP", { locale: tr })} />
                                    )}
                                    <Detail label="Termin Tarihi" value={format(new Date(viewProduct.terminDate), "PPP", { locale: tr })} />
                                    <Detail label="Oluşturulma" value={format(new Date(viewProduct.createdAt), "PPP HH:mm", { locale: tr })} />
                                </Section>
                            </div>

                            <div className="space-y-4">
                                <Section title="Özellikler">
                                    <Detail label="Ayak Modeli" value={viewProduct.footType} />
                                    <Detail label="Ayak Özelliği" value={viewProduct.footMaterial} />
                                    <Detail label="Kol Modeli" value={viewProduct.armType} />
                                    <Detail label="Sırt Modeli" value={viewProduct.backType} />
                                    <Detail label="Kumaş" value={viewProduct.fabricType} />
                                    <Detail label="Usta" value={viewProduct.master} />
                                </Section>

                                {viewProduct.description && (
                                    <Section title="Açıklama / Not">
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-2 rounded border">
                                            {viewProduct.description}
                                        </p>
                                    </Section>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
