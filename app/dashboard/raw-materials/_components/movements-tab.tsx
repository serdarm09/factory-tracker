"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, X, Info } from "lucide-react";
import { format, formatDistanceToNow, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from "date-fns";
import { tr } from "date-fns/locale";

const DATE_PRESETS = [
    { label: "Tümü", value: "all" },
    { label: "Bugün", value: "today" },
    { label: "Dün", value: "yesterday" },
    { label: "Son 7 Gün", value: "7days" },
    { label: "Bu Hafta", value: "week" },
    { label: "Bu Ay", value: "month" },
    { label: "Özel Aralık", value: "custom" },
];

function getDateRange(preset: string, customFrom: string, customTo: string): { from: Date | null; to: Date | null } {
    const now = new Date();
    switch (preset) {
        case "today":
            return { from: startOfDay(now), to: endOfDay(now) };
        case "yesterday":
            return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
        case "7days":
            return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
        case "week":
            return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
        case "month":
            return { from: startOfMonth(now), to: endOfDay(now) };
        case "custom":
            return {
                from: customFrom ? startOfDay(new Date(customFrom)) : null,
                to: customTo ? endOfDay(new Date(customTo)) : null,
            };
        default:
            return { from: null, to: null };
    }
}

export function MovementsTab({ logs }: { logs: any[] }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [datePreset, setDatePreset] = useState("all");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");
    const [selectedLog, setSelectedLog] = useState<any | null>(null);

    const { from: dateFrom, to: dateTo } = useMemo(
        () => getDateRange(datePreset, customFrom, customTo),
        [datePreset, customFrom, customTo]
    );

    const filteredLogs = useMemo(() => logs.filter((log) => {
        // Metin araması
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchName = log.rawMaterial?.name?.toLowerCase().includes(q);
            const matchNote = log.note?.toLowerCase().includes(q);
            const matchUser = log.user?.username?.toLowerCase().includes(q);
            if (!matchName && !matchNote && !matchUser) return false;
        }

        // Tür filtresi
        if (filterType !== "all" && log.type !== filterType) return false;

        // Tarih filtresi
        const logDate = new Date(log.createdAt);
        if (dateFrom && logDate < dateFrom) return false;
        if (dateTo && logDate > dateTo) return false;

        return true;
    }), [logs, searchQuery, filterType, dateFrom, dateTo]);

    const hasActiveFilter = searchQuery || filterType !== "all" || datePreset !== "all";

    const clearFilters = () => {
        setSearchQuery("");
        setFilterType("all");
        setDatePreset("all");
        setCustomFrom("");
        setCustomTo("");
    };

    // Özet sayaçları
    const totalIn  = filteredLogs.filter(l => l.type === "IN").reduce((s, l) => s + l.quantity, 0);
    const totalOut = filteredLogs.filter(l => l.type === "OUT").reduce((s, l) => s + l.quantity, 0);

    return (
        <Card className="border rounded-t-none">
            <CardContent className="p-0">
                {/* ─── Araç Çubuğu ─── */}
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b bg-slate-50/60">
                    {/* Metin Arama */}
                    <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-white border rounded-md h-9 px-3">
                        <Search className="h-4 w-4 text-slate-400 shrink-0" />
                        <Input
                            placeholder="Malzeme, not, kullanıcı ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm placeholder:text-slate-400 p-0"
                        />
                    </div>

                    {/* Tür Filtresi */}
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="h-9 w-[150px] text-sm bg-white">
                            <SelectValue placeholder="Tüm İşlemler" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Hareketler</SelectItem>
                            <SelectItem value="IN">Girişler (+)</SelectItem>
                            <SelectItem value="OUT">Çıkışlar (-)</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Tarih Preset Filtresi */}
                    <Select value={datePreset} onValueChange={v => { setDatePreset(v); if (v !== "custom") { setCustomFrom(""); setCustomTo(""); } }}>
                        <SelectTrigger className="h-9 w-[150px] text-sm bg-white">
                            <SelectValue placeholder="Tarih Aralığı" />
                        </SelectTrigger>
                        <SelectContent>
                            {DATE_PRESETS.map(p => (
                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Özel Tarih Aralığı */}
                    {datePreset === "custom" && (
                        <>
                            <Input
                                type="date"
                                value={customFrom}
                                onChange={e => setCustomFrom(e.target.value)}
                                className="h-9 w-[140px] text-sm bg-white"
                            />
                            <span className="text-slate-400 text-sm">—</span>
                            <Input
                                type="date"
                                value={customTo}
                                onChange={e => setCustomTo(e.target.value)}
                                className="h-9 w-[140px] text-sm bg-white"
                            />
                        </>
                    )}

                    {/* Filtreleri Temizle */}
                    {hasActiveFilter && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-slate-500 gap-1">
                            <X className="w-3.5 h-3.5" /> Temizle
                        </Button>
                    )}
                </div>

                {/* ─── Özet Satırı ─── */}
                {filteredLogs.length > 0 && (
                    <div className="flex items-center gap-6 px-4 py-2 bg-white border-b text-sm">
                        <span className="text-slate-500">{filteredLogs.length} kayıt</span>
                        <span className="text-green-600 font-semibold">↑ Toplam Giriş: {totalIn.toLocaleString("tr-TR")}</span>
                        <span className="text-red-600 font-semibold">↓ Toplam Çıkış: {totalOut.toLocaleString("tr-TR")}</span>
                    </div>
                )}

                {/* ─── Tablo ─── */}
                {filteredLogs.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground">
                        Seçili filtreler için kayıt bulunamadı.
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50">
                                <TableHead className="w-52">Tarih</TableHead>
                                <TableHead>Hammadde</TableHead>
                                <TableHead className="w-24 text-center">İşlem</TableHead>
                                <TableHead className="w-32 text-right">Miktar</TableHead>
                                <TableHead className="w-40">Kullanıcı</TableHead>
                                <TableHead>Not / Açıklama</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredLogs.map((log) => {
                                const isAdd = log.type === "IN";
                                return (
                                    <TableRow 
                                        key={log.id} 
                                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                                        onClick={() => setSelectedLog(log)}
                                    >
                                        <TableCell className="text-sm font-medium text-slate-600">
                                            {format(new Date(log.createdAt), "dd MMM yyyy, HH:mm", { locale: tr })}
                                            <span className="text-slate-400 text-xs ml-2 font-normal">
                                                ({formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: tr })})
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-medium text-slate-800">
                                            {log.rawMaterial?.name}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${isAdd ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                                {isAdd ? "GİRİŞ" : "ÇIKIŞ"}
                                            </span>
                                        </TableCell>
                                        <TableCell className={`text-right font-mono font-semibold ${isAdd ? "text-green-600" : "text-red-600"}`}>
                                            {isAdd ? "+" : "-"}{log.quantity} {log.rawMaterial?.unit}
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600">
                                            {log.user?.username || "Bilinmiyor"}
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-500 max-w-[200px] truncate" title={log.note}>
                                            {log.note || "—"}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </CardContent>

            {/* Hareket Detay Modalı */}
            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Info className="w-5 h-5 text-blue-600" />
                            Hareket Detayı
                        </DialogTitle>
                        <DialogDescription>
                            İşlem ile ilgili tüm ayrıntılar
                        </DialogDescription>
                    </DialogHeader>
                    {selectedLog && (
                        <div className="space-y-4 pt-4">
                            <div className="grid grid-cols-3 gap-2 border-b pb-2 text-sm">
                                <strong className="text-slate-500">Hammadde:</strong>
                                <span className="col-span-2 font-medium">{selectedLog.rawMaterial?.name}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 border-b pb-2 text-sm">
                                <strong className="text-slate-500">İşlem Türü:</strong>
                                <span className="col-span-2">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${selectedLog.type === "IN" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                        {selectedLog.type === "IN" ? "GİRİŞ (+)" : "ÇIKIŞ (-)"}
                                    </span>
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 border-b pb-2 text-sm">
                                <strong className="text-slate-500">Miktar:</strong>
                                <span className="col-span-2 font-mono font-bold text-lg">
                                    {selectedLog.quantity} {selectedLog.rawMaterial?.unit}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 border-b pb-2 text-sm">
                                <strong className="text-slate-500">Kullanıcı:</strong>
                                <span className="col-span-2">{selectedLog.user?.username || "Bilinmiyor"}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 border-b pb-2 text-sm">
                                <strong className="text-slate-500">Tarih / Saat:</strong>
                                <span className="col-span-2">
                                    {format(new Date(selectedLog.createdAt), "dd MMMM yyyy HH:mm", { locale: tr })}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-2 text-sm">
                                <strong className="text-slate-500">Not / Açıklama:</strong>
                                <p className="col-span-2 bg-slate-50 p-2 text-slate-700 rounded border">
                                    {selectedLog.note || "Açıklama girilmemiş."}
                                </p>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

        </Card>
    );
}
