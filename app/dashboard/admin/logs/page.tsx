import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function LogsPage() {
    const session = await auth();
    // Only ADMIN should see all logs, or maybe everyone? Let's restrict to ADMIN for now as requested context implies admin oversight.
    if ((session?.user as any).role !== "ADMIN") {
        redirect("/dashboard");
    }

    const logs = await prisma.productionLog.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            user: true,
            product: true
        }
    });

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold tracking-tight">Üretim Kayıtları (Log)</h2>

            <Card>
                <CardHeader>
                    <CardTitle>Son Hareketler</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tarih</TableHead>
                                <TableHead>Kullanıcı</TableHead>
                                <TableHead>Ürün</TableHead>
                                <TableHead>Sistem Kodu</TableHead>
                                <TableHead>İşlem / Adet</TableHead>
                                <TableHead>Raf</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell>{log.createdAt.toLocaleString('tr-TR')}</TableCell>
                                    <TableCell className="font-medium">{log.user.username}</TableCell>
                                    <TableCell>{log.product.name}</TableCell>
                                    <TableCell className="text-xs text-slate-500">{log.product.systemCode}</TableCell>
                                    <TableCell>
                                        <span className="font-bold text-green-600">+{log.quantity}</span> Üretim
                                    </TableCell>
                                    <TableCell>{log.shelf || '-'}</TableCell>
                                </TableRow>
                            ))}
                            {logs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">Kayıt bulunamadı.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
