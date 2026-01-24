import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Building, Type, Box, FileText, Barcode as BarcodeIcon } from "lucide-react";
import Link from "next/link";
import BarcodeDisplay from "@/components/barcode-display";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/product-image";

export default async function ProductDetailPage({
    params
}: {
    params: { id: string }
}) {
    const session = await auth();
    if (!session) {
        redirect("/dashboard");
    }

    const productId = parseInt(params.id);
    if (isNaN(productId)) {
        notFound();
    }

    const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
            creator: true,
            order: true
        }
    });

    if (!product) {
        notFound();
    }

    const statusMap: Record<string, { label: string, color: string }> = {
        'PENDING': { label: 'Bekliyor', color: 'bg-yellow-100 text-yellow-800' },
        'APPROVED': { label: 'Onaylandı', color: 'bg-blue-100 text-blue-800' },
        'REJECTED': { label: 'Reddedildi', color: 'bg-red-100 text-red-800' },
        'COMPLETED': { label: 'Üretildi', color: 'bg-green-100 text-green-800' },
    };

    const statusInfo = statusMap[product.status] || { label: product.status, color: 'bg-gray-100 text-gray-800' };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/admin/approvals">
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{product.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className={`${statusInfo.color} font-medium`}>
                            {statusInfo.label}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                            ID: {product.id}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="col-span-2 md:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Box className="h-5 w-5 text-primary" />
                            Ürün Görseli
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <div className="relative h-64 w-full rounded-lg overflow-hidden border bg-slate-100">
                            <ProductImage
                                src={`/${product.systemCode}.png`}
                                alt={product.name}
                                className="object-contain w-full h-full"
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Box className="h-5 w-5 text-primary" />
                            Temel Bilgiler
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <span className="text-muted-foreground">Ürün Adı:</span>
                            <span className="font-medium">{product.name}</span>

                            <span className="text-muted-foreground">Model:</span>
                            <span className="font-medium">{product.model}</span>

                            <span className="text-muted-foreground">Firma:</span>
                            <span className="font-medium flex items-center gap-2">
                                <Building className="h-3 w-3" />
                                {product.order?.company || "-"}
                            </span>

                            <span className="text-muted-foreground">Miktar:</span>
                            <span className="font-medium">{product.quantity}</span>

                            <span className="text-muted-foreground">Üretilen:</span>
                            <span className="font-medium">{product.produced}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Detaylar
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-2 text-sm">
                            <div className="space-y-1">
                                <span className="text-muted-foreground block">Malzeme:</span>
                                <span className="font-medium break-words">{product.material || "-"}</span>
                            </div>

                            <div className="space-y-1 mt-2">
                                <span className="text-muted-foreground block">Açıklama / Not:</span>
                                <div className="p-2 bg-slate-50 rounded-md border text-xs text-slate-700 min-h-[60px] whitespace-pre-wrap">
                                    {product.description || "Not yok."}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" />
                            Tarihçeler
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <span className="text-muted-foreground">Giriş Tarihi:</span>
                            <span className="font-medium">{new Date(product.createdAt).toLocaleDateString("tr-TR")}</span>

                            <span className="text-muted-foreground">Termin Tarihi:</span>
                            <span className="font-medium text-red-600">{product.terminDate ? new Date(product.terminDate).toLocaleDateString("tr-TR") : "-"}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarcodeIcon className="h-5 w-5 text-primary" />
                            Barkod & Sistem
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="text-sm">
                                <span className="text-muted-foreground">Sistem Kodu:</span>{" "}
                                <span className="font-mono bg-slate-100 px-1 rounded">{product.systemCode}</span>
                            </div>

                            {product.barcode ? (
                                <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-white">
                                    <BarcodeDisplay value={product.barcode} />
                                    <span className="text-xs text-slate-400 mt-2 font-mono tracking-wider">{product.barcode}</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-24 bg-slate-50 border border-dashed rounded-lg text-slate-400">
                                    Barkod Yok
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
