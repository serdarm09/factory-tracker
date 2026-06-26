"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    FileDown, Loader2, AlertTriangle, CheckCircle2,
    XCircle, UploadCloud, ArrowRight, ArrowLeft,
    Info, Download, ChevronRight, AlertCircle,
    Sparkles, PackageOpen, TriangleAlert,
} from "lucide-react";
import {
    previewExcelForExit,
    bulkExitRawMaterialsFromExcel,
} from "@/app/actions/raw-material-actions";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// ─── Tipler ────────────────────────────────────────────────────────────────
type PreviewRow = {
    rowIndex: number;
    name: string;
    quantity: number;
    status: "found" | "not_found" | "insufficient" | "zero";
    currentStock?: number;
    unit?: string;
    suggestions?: string[];
};

type ResultData = {
    deducted: number;
    totalQty: number;
    notFound: { name: string; suggestions: string[] }[];
    insufficient: { name: string; quantity: number }[];
};

type Step = "upload" | "preview" | "confirm" | "result";

// ─── Yardımcı: Kolon tespiti ────────────────────────────────────────────────
function detectColumns(rawData: any[][]): { nameCol: number; qtyCol: number; headers: string[] } {
    let nameCol = -1, qtyCol = -1;
    let headerRow: any[] = [];

    for (let i = 0; i < Math.min(10, rawData.length); i++) {
        const row = rawData[i];
        if (!Array.isArray(row)) continue;

        for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || "").toUpperCase().trim();
            if (
                nameCol === -1 &&
                (cell.includes("STOK ADI") || cell.includes("ÜRÜN ADI") || cell.includes("ÜRÜN CİNSİ") ||
                    cell === "ADI" || cell === "İSİM" || cell === "CİNSİ" ||
                    cell.includes("KUMAŞ ADI") || cell.includes("DERİ ADI"))
            ) {
                nameCol = j;
                headerRow = row;
            }
            if (
                qtyCol === -1 &&
                (cell === "ÇIKIŞ" || cell === "ÇIKAN" || cell === "ÇIKAN METRAJ" ||
                    cell === "MİKTAR" || cell === "HARCANAN" || cell === "DÜŞÜLEN" || cell === "KULLANILAN")
            ) {
                qtyCol = j;
            }
        }
        if (nameCol !== -1 && qtyCol !== -1) break;
    }

    const headers = Array.isArray(headerRow)
        ? headerRow.map((h, i) => (h !== undefined && h !== null && h !== "" ? String(h) : `Kolon ${i + 1}`))
        : [];

    return { nameCol, qtyCol, headers };
}

// ─── Ana Bileşen ─────────────────────────────────────────────────────────────
export function ExcelExitDialog() {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<Step>("upload");
    const [isDragging, setIsDragging] = useState(false);

    // Adım 1
    const [file, setFile] = useState<File | null>(null);
    const [rawData, setRawData] = useState<any[][] | null>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>("");
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);

    // Adım 2
    const [headers, setHeaders] = useState<string[]>([]);
    const [nameCol, setNameCol] = useState(-1);
    const [qtyCol, setQtyCol] = useState(-1);
    const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
    const [isPreviewing, setIsPreviewing] = useState(false);

    // Adım 3
    const [note, setNote] = useState("");
    const [allowNegative, setAllowNegative] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sonuç
    const [result, setResult] = useState<ResultData | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── Reset ───────────────────────────────────────────────────────────────
    const reset = () => {
        setStep("upload");
        setFile(null);
        setRawData(null);
        setSheetNames([]);
        setSelectedSheet("");
        setWorkbook(null);
        setHeaders([]);
        setNameCol(-1);
        setQtyCol(-1);
        setPreviewRows([]);
        setNote("");
        setAllowNegative(false);
        setResult(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // ─── Dosya okuma ─────────────────────────────────────────────────────────
    const readExcel = useCallback((selectedFile: File, sheetName?: string) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: "array" });
                setWorkbook(wb);
                setSheetNames(wb.SheetNames);
                const sheet = sheetName || wb.SheetNames[0];
                setSelectedSheet(sheet);
                const ws = wb.Sheets[sheet];
                const raw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
                setRawData(raw);

                const { nameCol: nc, qtyCol: qc, headers: hdrs } = detectColumns(raw);
                setNameCol(nc);
                setQtyCol(qc);
                setHeaders(hdrs);
            } catch {
                toast.error("Excel dosyası okunamadı.");
            }
        };
        reader.readAsArrayBuffer(selectedFile);
    }, []);

    const handleFile = (f: File) => {
        if (!f.name.match(/\.(xlsx|xls)$/i)) {
            toast.error("Lütfen .xlsx veya .xls formatında dosya seçin.");
            return;
        }
        setFile(f);
        readExcel(f);
    };

    // ─── Drag & Drop ─────────────────────────────────────────────────────────
    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
    }, []);

    // ─── Sayfa değişimi ──────────────────────────────────────────────────────
    const handleSheetChange = (sheet: string) => {
        setSelectedSheet(sheet);
        if (workbook && file) {
            const ws = workbook.Sheets[sheet];
            const raw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
            setRawData(raw);
            const { nameCol: nc, qtyCol: qc, headers: hdrs } = detectColumns(raw);
            setNameCol(nc);
            setQtyCol(qc);
            setHeaders(hdrs);
        }
    };

    // ─── Adım 1 → 2: Önizleme ────────────────────────────────────────────────
    const handleGoToPreview = async () => {
        if (!rawData || nameCol === -1) {
            toast.error("İsim kolonu seçili değil.");
            return;
        }
        if (qtyCol === -1) {
            toast.error("Miktar kolonu seçili değil.");
            return;
        }
        setIsPreviewing(true);
        try {
            const res = await previewExcelForExit(rawData, nameCol, qtyCol);
            if (res.success) {
                setPreviewRows(res.rows);
                setStep("preview");
            } else {
                toast.error(res.error);
            }
        } catch {
            toast.error("Önizleme sırasında hata oluştu.");
        } finally {
            setIsPreviewing(false);
        }
    };

    // ─── Adım 3: Onayla ve çalıştır ─────────────────────────────────────────
    const handleSubmit = async () => {
        if (!rawData) return;
        setIsSubmitting(true);
        try {
            const res = await bulkExitRawMaterialsFromExcel(rawData, {
                nameColIndex: nameCol,
                qtyColIndex: qtyCol,
                note: note || undefined,
                allowNegative,
            });
            if (res.success) {
                setResult({
                    deducted: res.deducted ?? 0,
                    totalQty: res.totalQty ?? 0,
                    notFound: res.notFound ?? [],
                    insufficient: res.insufficient ?? [],
                });
                setStep("result");
            } else {
                toast.error(res.error || "İşlem başarısız.");
            }
        } catch {
            toast.error("Beklenmeyen bir hata oluştu.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ─── Önizleme özeti ──────────────────────────────────────────────────────
    const foundCount = previewRows.filter(r => r.status === "found").length;
    const notFoundCount = previewRows.filter(r => r.status === "not_found").length;
    const insufficientCount = previewRows.filter(r => r.status === "insufficient").length;

    // ─── Dialog kapatma ──────────────────────────────────────────────────────
    const handleOpenChange = (o: boolean) => {
        setOpen(o);
        if (!o) setTimeout(reset, 300);
    };

    // ─── Şablon indir ────────────────────────────────────────────────────────
    const downloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            ["STOK ADI", "MİKTAR"],
            ["Örnek Malzeme A", 50],
            ["Örnek Malzeme B", 120],
        ]);
        ws["!cols"] = [{ wch: 35 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws, "Çıkış Listesi");
        XLSX.writeFile(wb, "toplu_cikis_sablonu.xlsx");
    };

    // ─── Adım göstergesi ─────────────────────────────────────────────────────
    const STEPS = [
        { key: "upload", label: "Dosya" },
        { key: "preview", label: "Önizleme" },
        { key: "confirm", label: "Onay" },
    ];

    const currentStepIdx = step === "result" ? 3 : STEPS.findIndex(s => s.key === step);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 text-orange-600 border-orange-200 hover:bg-orange-50">
                    <FileDown className="w-4 h-4" />
                    Excel ile Toplu Çıkış
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
                {/* ── Header ── */}
                <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <FileDown className="w-5 h-5 text-orange-500" />
                        Excel'den Günlük Toplu Çıkış
                    </DialogTitle>

                    {/* Adım göstergesi */}
                    {step !== "result" && (
                        <div className="flex items-center gap-1 mt-3">
                            {STEPS.map((s, idx) => (
                                <div key={s.key} className="flex items-center gap-1">
                                    <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all ${
                                        idx === currentStepIdx
                                            ? "bg-orange-500 text-white"
                                            : idx < currentStepIdx
                                            ? "bg-orange-100 text-orange-700"
                                            : "bg-slate-100 text-slate-400"
                                    }`}>
                                        <span className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] border border-current/30">
                                            {idx < currentStepIdx ? "✓" : idx + 1}
                                        </span>
                                        {s.label}
                                    </div>
                                    {idx < STEPS.length - 1 && (
                                        <ChevronRight className="w-3 h-3 text-slate-300" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </DialogHeader>

                {/* ── İçerik Alanı ── */}
                <div className="flex-1 overflow-y-auto px-6 py-4">

                    {/* ══════════ ADIM 1: DOSYA YÜKLEME ══════════ */}
                    {step === "upload" && (
                        <div className="space-y-4">
                            {/* Bilgi kutusu */}
                            <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 flex gap-2 text-sm text-orange-800">
                                <Info className="w-4 h-4 shrink-0 mt-0.5 text-orange-500" />
                                <div>
                                    Excel dosyanızda <strong>Malzeme Adı</strong> ve <strong>Miktar</strong> sütunları olmalıdır.
                                    Sistem otomatik algılar; isterseniz bir sonraki adımda düzeltebilirsiniz.
                                </div>
                            </div>

                            {/* Drop Zone */}
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={onDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                                    isDragging
                                        ? "border-orange-400 bg-orange-50 scale-[1.01]"
                                        : file
                                        ? "border-green-300 bg-green-50"
                                        : "border-slate-200 bg-slate-50 hover:border-orange-300 hover:bg-orange-50/50"
                                }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    className="hidden"
                                    onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                                />
                                {file ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <CheckCircle2 className="w-10 h-10 text-green-500" />
                                        <p className="font-semibold text-green-700">{file.name}</p>
                                        <p className="text-xs text-slate-500">({(file.size / 1024).toFixed(1)} KB) – Değiştirmek için tıklayın</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <UploadCloud className="w-10 h-10 text-slate-300" />
                                        <p className="font-medium text-slate-600">Excel dosyasını sürükleyin veya tıklayın</p>
                                        <p className="text-xs text-slate-400">.xlsx / .xls desteklenir</p>
                                    </div>
                                )}
                            </div>

                            {/* Sayfa seçimi (çok sayfalı Excel) */}
                            {sheetNames.length > 1 && (
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium">Excel Sayfası Seçin</Label>
                                    <Select value={selectedSheet} onValueChange={handleSheetChange}>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {sheetNames.map(n => (
                                                <SelectItem key={n} value={n}>{n}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Kolon tespiti özeti */}
                            {file && rawData && (
                                <div className="rounded-lg border bg-white p-3 space-y-2 text-sm">
                                    <p className="font-medium text-slate-700 flex items-center gap-1.5">
                                        <Sparkles className="w-4 h-4 text-orange-400" />
                                        Otomatik Algılanan Kolonlar
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className={`rounded p-2 ${nameCol !== -1 ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
                                            <span className="font-medium">İsim Kolonu: </span>
                                            {nameCol !== -1 ? (headers[nameCol] || `Kolon ${nameCol + 1}`) : "❌ Bulunamadı"}
                                        </div>
                                        <div className={`rounded p-2 ${qtyCol !== -1 ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-700"}`}>
                                            <span className="font-medium">Miktar Kolonu: </span>
                                            {qtyCol !== -1 ? (headers[qtyCol] || `Kolon ${qtyCol + 1}`) : "⚠ Bulunamadı (otomatik)"}
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400">Bir sonraki adımda düzeltebilirsiniz.</p>
                                </div>
                            )}

                            {/* Şablon indir */}
                            <button
                                onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                                className="w-full flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg py-2 transition-colors border border-blue-100"
                            >
                                <Download className="w-4 h-4" />
                                Örnek Şablon İndir
                            </button>
                        </div>
                    )}

                    {/* ══════════ ADIM 2: ÖNİZLEME ══════════ */}
                    {step === "preview" && (
                        <div className="space-y-4">
                            {/* Kolon seçimi */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-slate-500">İSİM KOLONU</Label>
                                    <Select
                                        value={String(nameCol)}
                                        onValueChange={(v) => setNameCol(Number(v))}
                                    >
                                        <SelectTrigger className="h-8 text-sm bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {headers.map((h, i) => (
                                                <SelectItem key={i} value={String(i)}>{h}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-slate-500">MİKTAR KOLONU</Label>
                                    <Select
                                        value={String(qtyCol)}
                                        onValueChange={(v) => setQtyCol(Number(v))}
                                    >
                                        <SelectTrigger className="h-8 text-sm bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {headers.map((h, i) => (
                                                <SelectItem key={i} value={String(i)}>{h}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Özet kartları */}
                            <div className="grid grid-cols-3 gap-2 text-center text-sm">
                                <div className="rounded-lg bg-green-50 border border-green-100 p-3">
                                    <p className="text-2xl font-bold text-green-600">{foundCount}</p>
                                    <p className="text-xs text-green-700 mt-0.5">Eşleşen</p>
                                </div>
                                <div className={`rounded-lg border p-3 ${notFoundCount > 0 ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"}`}>
                                    <p className={`text-2xl font-bold ${notFoundCount > 0 ? "text-red-600" : "text-slate-400"}`}>{notFoundCount}</p>
                                    <p className={`text-xs mt-0.5 ${notFoundCount > 0 ? "text-red-700" : "text-slate-400"}`}>Bulunamayan</p>
                                </div>
                                <div className={`rounded-lg border p-3 ${insufficientCount > 0 ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100"}`}>
                                    <p className={`text-2xl font-bold ${insufficientCount > 0 ? "text-amber-600" : "text-slate-400"}`}>{insufficientCount}</p>
                                    <p className={`text-xs mt-0.5 ${insufficientCount > 0 ? "text-amber-700" : "text-slate-400"}`}>Yetersiz Stok</p>
                                </div>
                            </div>

                            {/* Satır tablosu */}
                            <div className="rounded-lg border overflow-hidden">
                                <div className="bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 grid grid-cols-12 gap-2">
                                    <span className="col-span-5">Malzeme Adı</span>
                                    <span className="col-span-2 text-right">Çıkış</span>
                                    <span className="col-span-2 text-right">Mevcut</span>
                                    <span className="col-span-3 text-center">Durum</span>
                                </div>
                                <div className="max-h-52 overflow-y-auto divide-y">
                                    {previewRows.filter(r => r.status !== "zero").map((row, i) => (
                                        <div key={i} className={`grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center ${
                                            row.status === "found" ? "" :
                                            row.status === "not_found" ? "bg-red-50/60" :
                                            row.status === "insufficient" ? "bg-amber-50/60" : ""
                                        }`}>
                                            <span className="col-span-5 font-medium text-slate-700 truncate" title={row.name}>{row.name}</span>
                                            <span className="col-span-2 text-right font-mono text-slate-600">
                                                {row.quantity} {row.unit ?? ""}
                                            </span>
                                            <span className="col-span-2 text-right font-mono text-slate-500 text-xs">
                                                {row.currentStock !== undefined ? row.currentStock : "—"}
                                            </span>
                                            <span className="col-span-3 flex justify-center">
                                                {row.status === "found" && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">✓ Tamam</span>
                                                )}
                                                {row.status === "insufficient" && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">⚠ Az Stok</span>
                                                )}
                                                {row.status === "not_found" && (
                                                    <div className="text-center">
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">✗ Bulunamadı</span>
                                                        {row.suggestions && row.suggestions.length > 0 && (
                                                            <p className="text-[9px] text-slate-400 mt-0.5 truncate" title={row.suggestions.join(", ")}>
                                                                ≈ {row.suggestions[0]}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </span>
                                        </div>
                                    ))}
                                    {previewRows.filter(r => r.status !== "zero").length === 0 && (
                                        <div className="py-8 text-center text-slate-400 text-sm">İşlenecek satır bulunamadı.</div>
                                    )}
                                </div>
                            </div>

                            {insufficientCount > 0 && (
                                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
                                    <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span><strong>{insufficientCount}</strong> malzemenin stoğu yetersiz – bu kalemler atlanacak ve stok 0'ın altına düşürülmeyecek.</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══════════ ADIM 3: ONAY ══════════ */}
                    {step === "confirm" && (
                        <div className="space-y-5">
                            {/* Özet */}
                            <div className="rounded-xl border bg-gradient-to-br from-orange-50 to-white p-4 space-y-2">
                                <p className="font-semibold text-slate-700 flex items-center gap-2">
                                    <PackageOpen className="w-5 h-5 text-orange-500" />
                                    İşlem Özeti
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-slate-500">İşlenecek malzeme:</div>
                                    <div className="font-bold text-slate-800">{foundCount} kalem</div>
                                    <div className="text-slate-500">Eşleşmeyen (atlanacak):</div>
                                    <div className={`font-bold ${notFoundCount > 0 ? "text-red-600" : "text-slate-400"}`}>{notFoundCount} kalem</div>
                                    {insufficientCount > 0 && (
                                        <>
                                            <div className="text-slate-500">Stok yetersiz (atlanacak):</div>
                                            <div className="font-bold text-amber-600">{insufficientCount} kalem</div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Not alanı */}
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium">Çıkış Notu <span className="text-slate-400 font-normal">(opsiyonel)</span></Label>
                                <Textarea
                                    placeholder="Örn: 18.06.2026 günlük üretim çıkışı, A4 koşusu..."
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="resize-none h-20 text-sm"
                                />
                                <p className="text-xs text-slate-400">Bu not, her malzemenin hareket geçmişine kaydedilecek.</p>
                            </div>



                            <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                Bu işlem geri alınamaz. Onaylamadan önce yukarıdaki özeti kontrol edin.
                            </div>
                        </div>
                    )}

                    {/* ══════════ SONUÇ ══════════ */}
                    {step === "result" && result && (
                        <div className="space-y-4">
                            {/* Başarı başlığı */}
                            <div className="flex flex-col items-center gap-2 py-4 text-center">
                                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                                    <CheckCircle2 className="w-9 h-9 text-green-500" />
                                </div>
                                <p className="text-xl font-bold text-slate-800">İşlem Tamamlandı!</p>
                                <p className="text-slate-500 text-sm">
                                    <span className="font-semibold text-green-600">{result.deducted}</span> malzeme başarıyla stoktan düşüldü.
                                </p>
                            </div>

                            {/* Detay kartları */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg border bg-green-50 p-3 text-center">
                                    <p className="text-2xl font-bold text-green-600">{result.deducted}</p>
                                    <p className="text-xs text-green-700">Başarılı İşlem</p>
                                </div>
                                <div className="rounded-lg border bg-slate-50 p-3 text-center">
                                    <p className="text-2xl font-bold text-slate-600">{result.totalQty.toLocaleString("tr-TR")}</p>
                                    <p className="text-xs text-slate-500">Toplam Düşülen Miktar</p>
                                </div>
                            </div>

                            {/* Eşleşmeyenler */}
                            {result.notFound.length > 0 && (
                                <div className="rounded-lg border border-red-200 bg-red-50 overflow-hidden">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-800 text-sm font-semibold">
                                        <XCircle className="w-4 h-4" />
                                        Eşleşmeyen Malzemeler ({result.notFound.length})
                                    </div>
                                    <div className="max-h-36 overflow-y-auto divide-y divide-red-100">
                                        {result.notFound.map((item, i) => (
                                            <div key={i} className="px-3 py-2">
                                                <p className="text-sm font-medium text-red-700">• {item.name}</p>
                                                {item.suggestions.length > 0 && (
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        Benzer:{" "}
                                                        {item.suggestions.map((s, si) => (
                                                            <span key={si} className="inline-block bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] mr-1 text-slate-700">
                                                                {s}
                                                            </span>
                                                        ))}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Stok yetersizleri */}
                            {result.insufficient.length > 0 && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-800 text-sm font-semibold">
                                        <AlertTriangle className="w-4 h-4" />
                                        Stok Yetersiz – Atlandı ({result.insufficient.length})
                                    </div>
                                    <div className="max-h-28 overflow-y-auto divide-y divide-amber-100">
                                        {result.insufficient.map((item, i) => (
                                            <div key={i} className="px-3 py-2 text-sm text-amber-700">
                                                • {item.name} <span className="text-amber-500">({item.quantity} adet istenilen)</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="px-6 pb-5 pt-3 border-t bg-white shrink-0 flex justify-between gap-2">
                    {step === "upload" && (
                        <>
                            <Button variant="outline" onClick={() => handleOpenChange(false)}>İptal</Button>
                            <Button
                                onClick={handleGoToPreview}
                                disabled={!file || !rawData || isPreviewing}
                                className="bg-orange-500 hover:bg-orange-600 text-white"
                            >
                                {isPreviewing
                                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analiz ediliyor...</>
                                    : <><span>Önizlemeye Geç</span> <ArrowRight className="w-4 h-4 ml-1" /></>
                                }
                            </Button>
                        </>
                    )}

                    {step === "preview" && (
                        <>
                            <Button variant="outline" onClick={() => setStep("upload")} className="gap-1">
                                <ArrowLeft className="w-4 h-4" /> Geri
                            </Button>
                            <Button
                                onClick={() => setStep("confirm")}
                                disabled={foundCount + insufficientCount === 0}
                                className="bg-orange-500 hover:bg-orange-600 text-white"
                            >
                                Onayla & Devam Et <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                        </>
                    )}

                    {step === "confirm" && (
                        <>
                            <Button variant="outline" onClick={() => setStep("preview")} className="gap-1">
                                <ArrowLeft className="w-4 h-4" /> Geri
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                            >
                                {isSubmitting
                                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> İşleniyor...</>
                                    : "✓ Stoklardan Düş"
                                }
                            </Button>
                        </>
                    )}

                    {step === "result" && (
                        <Button
                            className="w-full bg-slate-800 hover:bg-slate-900 text-white"
                            onClick={() => handleOpenChange(false)}
                        >
                            Kapat
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
