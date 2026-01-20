import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, Package, AlertTriangle, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { SemiFinishedTable } from "@/components/semi-finished-table";
import { SemiFinishedDialog } from "@/components/semi-finished-dialog";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SemiFinishedPage() {
    const session = await auth();
    const role = (session?.user as any)?.role;

    if (!["ADMIN", "PLANNER", "WORKER"].includes(role)) {
        redirect("/dashboard");
    }

    const semiFinished = await prisma.semiFinished.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
            logs: {
                orderBy: { createdAt: 'desc' },
                take: 5
            }
        }
    });

    // İstatistikler
    const totalItems = semiFinished.length;
    const totalStock = semiFinished.reduce((sum, item) => sum + item.quantity, 0);
    const lowStockItems = semiFinished.filter(item => item.quantity <= item.minStock);
    const outOfStockItems = semiFinished.filter(item => item.quantity === 0);

    // Kategorilere göre grupla
    const categories = [...new Set(semiFinished.map(item => item.category || 'Diğer'))];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Yarı Mamül Stok</h2>
                    <p className="text-muted-foreground">Yarı mamül ürünlerin stok takibi</p>
                </div>
                <SemiFinishedDialog mode="create">
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Yeni Yarı Mamül
                    </Button>
                </SemiFinishedDialog>
            </div>

            {/* İstatistik Kartları */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam Çeşit</CardTitle>
                        <Package className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalItems}</div>
                        <p className="text-xs text-muted-foreground">{categories.length} kategori</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam Stok</CardTitle>
                        <ArrowUpCircle className="h-5 w-5 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalStock}</div>
                        <p className="text-xs text-muted-foreground">Tüm yarı mamüller</p>
                    </CardContent>
                </Card>

                <Card className={lowStockItems.length > 0 ? "border-amber-200 bg-amber-50" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Düşük Stok</CardTitle>
                        <AlertTriangle className={`h-5 w-5 ${lowStockItems.length > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{lowStockItems.length}</div>
                        <p className="text-xs text-muted-foreground">Minimum seviyede</p>
                    </CardContent>
                </Card>

                <Card className={outOfStockItems.length > 0 ? "border-red-200 bg-red-50" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Stokta Yok</CardTitle>
                        <ArrowDownCircle className={`h-5 w-5 ${outOfStockItems.length > 0 ? "text-red-500" : "text-muted-foreground"}`} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{outOfStockItems.length}</div>
                        <p className="text-xs text-muted-foreground">Acil tedarik gerekli</p>
                    </CardContent>
                </Card>
            </div>

            {/* Düşük Stok Uyarıları */}
            {lowStockItems.length > 0 && (
                <Card className="border-amber-200 bg-amber-50">
                    <CardHeader>
                        <CardTitle className="text-amber-800 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Düşük Stok Uyarıları
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {lowStockItems.map(item => (
                                <Badge
                                    key={item.id}
                                    variant="outline"
                                    className={`${item.quantity === 0 ? 'bg-red-100 text-red-800 border-red-300' : 'bg-amber-100 text-amber-800 border-amber-300'}`}
                                >
                                    {item.name}: {item.quantity} {item.unit}
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Yarı Mamül Tablosu */}
            <Card>
                <CardHeader>
                    <CardTitle>Yarı Mamül Listesi</CardTitle>
                </CardHeader>
                <CardContent>
                    <SemiFinishedTable items={semiFinished} />
                </CardContent>
            </Card>
        </div>
    );
}
