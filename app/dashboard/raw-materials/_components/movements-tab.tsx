"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, X, Info, Download } from "lucide-react";
import { format, formatDistanceToNow, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from "date-fns";
import { tr } from "date-fns/locale";
import * as XLSX from "xlsx";

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
    const [isExporting, setIsExporting] = useState(false);

    const [loadedLogs, setLoadedLogs] = useState<any[]>(logs);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(logs.length === 500);

    useEffect(() => {
        setLoadedLogs(logs);
        setHasMore(logs.length === 500);
    }, [logs]);

    const loadMore = async () => {
        if (loadedLogs.length === 0) return;
        try {
            setIsLoadingMore(true);
            const lastId = loadedLogs[loadedLogs.length - 1].id;
            const res = await fetch(`/api/raw-materials/logs?cursorId=${lastId}&take=500`);
            if (!res.ok) throw new Error("Veri çekilemedi");
            const newLogs = await res.json();
            if (newLogs.length < 500) setHasMore(false);
            setLoadedLogs(prev => [...prev, ...newLogs]);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const { from: dateFrom, to: dateTo } = useMemo(
        () => getDateRange(datePreset, customFrom, customTo),
        [datePreset, customFrom, customTo]
    );

    const filteredLogs = useMemo(() => loadedLogs.filter((log) => {
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
    }), [loadedLogs, searchQuery, filterType, dateFrom, dateTo]);

    const hasActiveFilter = searchQuery || filterType !== "all" || datePreset !== "all";

    const clearFilters = () => {
        setSearchQuery("");
        setFilterType("all");
        setDatePreset("all");
        setCustomFrom("");
        setCustomTo("");
    };

    const exportToExcel = async () => {
        try {
            setIsExporting(true);
            
            let url = "/api/raw-materials/logs";
            if (dateFrom || dateTo) {
                const params = new URLSearchParams();
                if (dateFrom) params.append("from", dateFrom.toISOString());
                if (dateTo) params.append("to", dateTo.toISOString());
                url += `?${params.toString()}`;
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error("Veriler getirilemedi");
            
            const fullLogs = await response.json();

            // Apply text and type filters to the fetched logs
            const finalLogs = fullLogs.filter((log: any) => {
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase();
                    const matchName = log.rawMaterial?.name?.toLowerCase().includes(q);
                    const matchNote = log.note?.toLowerCase().includes(q);
                    const matchUser = log.user?.username?.toLowerCase().includes(q);
                    if (!matchName && !matchNote && !matchUser) return false;
                }
                if (filterType !== "all" && log.type !== filterType) return false;
                return true;
            });

            if (finalLogs.length === 0) {
                alert("Seçili aralıkta ve filtrelerde kayıt bulunamadı.");
                return;
            }

            const dataToExport = finalLogs.map((log: any) => ({
                "Tarih": format(new Date(log.createdAt), "dd.MM.yyyy HH:mm"),
                "Hammadde": log.rawMaterial?.name || "",
                "Kategori": log.rawMaterial?.category || "",
                "İşlem": log.type === "IN" ? "GİRİŞ" : "ÇIKIŞ",
                "Miktar": log.quantity,
                "Birim": log.rawMaterial?.unit || "",
                "Kullanıcı": log.user?.username || "Bilinmiyor",
                "Not": log.note || ""
            }));

            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Hareketler");
            
            // Sütun genişlikleri ayarı
            worksheet["!cols"] = [
                { wch: 18 }, // Tarih
                { wch: 30 }, // Hammadde
                { wch: 20 }, // Kategori
                { wch: 10 }, // İşlem
                { wch: 10 }, // Miktar
                { wch: 10 }, // Birim
                { wch: 20 }, // Kullanıcı
                { wch: 40 }  // Not
            ];

            const fileName = `Hammadde_Hareketleri_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`;
            XLSX.writeFile(workbook, fileName);
        } catch (error) {
            console.error("Excel export error:", error);
            alert("Excel'e aktarılırken bir hata oluştu.");
        } finally {
            setIsExporting(false);
        }
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

                    {/* Excel'e Aktar Butonu */}
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={exportToExcel} 
                        className="h-9 gap-1 ml-auto text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800"
                        disabled={isExporting}
                    >
                        <Download className="w-4 h-4" /> {isExporting ? "Aktarılıyor..." : "Excel'e Aktar"}
                    </Button>
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

                {hasMore && (
                    <div className="py-4 flex justify-center border-t bg-slate-50/30">
                        <Button 
                            variant="outline" 
                            onClick={loadMore} 
                            disabled={isLoadingMore}
                            className="bg-white"
                        >
                            {isLoadingMore ? "Yükleniyor..." : "Daha Eski Kayıtları Yükle"}
                        </Button>
                    </div>
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
