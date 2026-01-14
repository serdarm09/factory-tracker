'use client';

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";


type Product = {
    id: number;
    name: string;
    model: string;
    company: string | null;
    quantity: number;
    produced: number;
    systemCode: string;
    barcode: string | null;
    status: string;
    terminDate: Date;
};

export function WarehouseTable({ products }: { products: Product[] }) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");

    const filtered = products.filter(p => {
        const matchesSearch =
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.systemCode.toLowerCase().includes(search.toLowerCase()) ||
            (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()));

        const matchesStatus = statusFilter === "ALL" ? true : p.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-4">
            <div className="flex gap-4">
                <Input
                    placeholder="Ara: Ürün, Kod veya Barkod..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm"
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-10 w-[180px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <option value="ALL">Tümü</option>
                    <option value="APPROVED">Onaylananlar</option>
                    <option value="COMPLETED">Tamamlananlar</option>
                </select>
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Sistem Kodu</TableHead>
                            <TableHead>Ürün</TableHead>
                            <TableHead>Firma</TableHead>
                            <TableHead>Termin</TableHead>
                            <TableHead>Barkod</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead className="text-right">İlerleme</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.map((p) => (
                            <TableRow key={p.id}>
                                <TableCell className="font-mono">{p.systemCode}</TableCell>
                                <TableCell>
                                    <div className="font-semibold">{p.name}</div>
                                    <div className="text-xs text-slate-500">{p.model}</div>
                                </TableCell>
                                <TableCell>{p.company || "-"}</TableCell>
                                <TableCell className="text-xs text-slate-500 font-mono">
                                    {new Date(p.terminDate).toLocaleDateString('tr-TR')}
                                </TableCell>
                                <TableCell className="font-mono text-xs">{p.barcode || "-"}</TableCell>
                                <TableCell>
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${p.produced >= p.quantity
                                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                        : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                        }`}>
                                        {p.produced >= p.quantity ? 'TAMAMLANDI' : 'EKSİK / KISMİ'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className={`font-bold ${p.produced >= p.quantity ? 'text-blue-600' : 'text-yellow-600'}`}>
                                        {p.produced} / {p.quantity} ({Math.round((p.produced / p.quantity) * 100)}%)
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                                    Kayıt bulunamadı.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
