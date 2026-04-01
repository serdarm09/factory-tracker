"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Plus, Edit, Trash2, Search, Check, X, Minus, Download } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExcelImportDialog } from "./excel-import-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addRawMaterial, deleteRawMaterial, updateRawMaterial, addRawMaterialLog } from "@/app/actions/raw-material-actions";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const CATEGORIES = [
    { key: "AMORTISOR",                   label: "Amortisör",        emoji: "🔩" },
    { key: "KOL_AYAK_PLASTIK_FILE",       label: "Kol / Ayak",       emoji: "🪑" },
    { key: "SUNGER",                       label: "Sünger",           emoji: "🟡" },
    { key: "TEKER_BINGO_SOKET_MEKANIZMA", label: "Teker / Soket",    emoji: "⚙️" },
    { key: "TAHTA",                        label: "Tahta",            emoji: "🪵" },
    { key: "KOLI_NAYLON",                  label: "Koli / Naylon",    emoji: "📦" },
    { key: "CIVATA",                       label: "Civata",           emoji: "🔧" },
    { key: "KUMAS",                        label: "Kumaş",            emoji: "🧵" },
    { key: "DERI",                         label: "Deri",             emoji: "🟤" },
    { key: "DIGER",                        label: "Diğer",            emoji: "📂" },
];

const UNITS = ["Adet", "Kg", "Metre", "Litre", "Paket", "Plaka", "Top", "Rulo", "Kutu"];

function StockBadge({ qty, min, max }: { qty: number; min: number; max: number | null }) {
    if (qty === 0)         return <Badge className="bg-red-100 text-red-800    border-red-300    text-xs">Stok Yok</Badge>;
    if (qty < min)         return <Badge className="bg-orange-100 text-orange-800 border-orange-300 text-xs">Kritik</Badge>;
    if (max && qty >= max) return <Badge className="bg-blue-100 text-blue-800  border-blue-300   text-xs">Dolu</Badge>;
    return                        <Badge className="bg-green-100 text-green-800 border-green-300  text-xs">Normal</Badge>;
}

export function StockTab({ rawMaterials, currentUser }: { rawMaterials: any[]; currentUser?: { id: number; role?: string } }) {
    const router = useRouter();
    const canEdit = currentUser?.role === "ADMIN" || currentUser?.role === "RAW_MATERIAL";
    const [activeTab, setActiveTab]             = useState(CATEGORIES[0].key);
    const [searchQuery, setSearchQuery]         = useState("");
    const [filterUnit, setFilterUnit]           = useState("all");
    const [filterStatus, setFilterStatus]       = useState("all");
    const [editingMaterial, setEditingMaterial] = useState<any>(null);
    const [formData, setFormData]               = useState<any>({
        name: "", category: "DIGER", quantity: 0, minQuantity: 0, maxQuantity: "", unit: "Adet", supplier: "",
    });

    // Inline quantity edit state
    const [inlineEditId, setInlineEditId]     = useState<number | null>(null);
    const [inlineEditValue, setInlineEditValue] = useState("");
    const inlineInputRef                        = useRef<HTMLInputElement>(null);

    // Girdi / Çıktı stateleri
    const [inOutValues, setInOutValues] = useState<{ [key: string]: { in: string, out: string } }>({});

    // Çıktı modal state
    const [outModal, setOutModal] = useState<{ open: boolean; itemId: number | null; itemName: string; amount: string; neden: string; bolum: string }>({
        open: false, itemId: null, itemName: "", amount: "", neden: "", bolum: ""
    });

    const BOLUMLER = ["Konfeksiyon", "Metal", "Ahşap Boya", "Ahşap İskelet", "Sünger Döküm", "Plastik", "Sünger", "Yönetim", "Döşeme", "Montaj", "Paket"];
    
    // Girdi / Çıktı Handler
    const handleInOutChange = (id: number, type: "in" | "out", val: string) => {
        setInOutValues(prev => ({
            ...prev,
            [id]: { ...(prev[id] || { in: "", out: "" }), [type]: val }
        }));
    };

    const openOutModal = (item: any) => {
        setOutModal({ open: true, itemId: item.id, itemName: item.name, amount: inOutValues[item.id]?.out || "", neden: "", bolum: "" });
    };

    const submitInOut = async (id: number, type: "IN" | "OUT") => {
        const valStr = type === "IN" ? inOutValues[id]?.in : inOutValues[id]?.out;
        const amount = parseFloat(valStr || "0");
        if (isNaN(amount) || amount <= 0) return;

        const res = await addRawMaterialLog({ rawMaterialId: id, type, quantity: amount });
        
        if (res.success) {
            toast.success(`${type === "IN" ? "Girdi" : "Çıktı"} başarılı: ${amount}`);
            setInOutValues(prev => ({
                ...prev,
                [id]: { ...(prev[id] || { in: "", out: "" }), [type === "IN" ? "in" : "out"]: "" }
            }));
            router.refresh();
        } else {
            toast.error(res.error);
        }
    };

    const submitOut = async () => {
        const amount = parseFloat(outModal.amount || "0");
        if (isNaN(amount) || amount <= 0) { toast.error("Geçerli bir miktar girin"); return; }
        if (!outModal.bolum) { toast.error("Lütfen bölüm seçin"); return; }
        if (!outModal.neden.trim()) { toast.error("Lütfen neden girin"); return; }
        if (!outModal.itemId) return;

        const note = `[${outModal.bolum}] ${outModal.neden}`;
        const res = await addRawMaterialLog({ rawMaterialId: outModal.itemId, type: "OUT", quantity: amount, note });

        if (res.success) {
            toast.success(`Çıktı başarılı: ${amount}`);
            setInOutValues(prev => ({ ...prev, [outModal.itemId!]: { ...(prev[outModal.itemId!] || { in: "", out: "" }), out: "" } }));
            setOutModal({ open: false, itemId: null, itemName: "", amount: "", neden: "", bolum: "" });
            router.refresh();
        } else {
            toast.error(res.error);
        }
    };

    const criticalItems = rawMaterials.filter(m => m.quantity < m.minQuantity);
    const activeItems   = rawMaterials.filter(m => m.category === activeTab);
    const activeCat     = CATEGORIES.find(c => c.key === activeTab)!;

    // Unique units in the active tab
    const activeUnits = Array.from(new Set(activeItems.map((m: any) => m.unit))).sort();

    const getStatus = (m: any) => {
        if (m.quantity === 0) return "empty";
        if (m.quantity < m.minQuantity) return "critical";
        if (m.maxQuantity && m.quantity >= m.maxQuantity) return "full";
        return "normal";
    };

    // Apply all filters
    const filteredItems = activeItems.filter(m => {
        if (searchQuery.trim() && !m.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (filterUnit !== "all" && m.unit !== filterUnit) return false;
        if (filterStatus !== "all" && getStatus(m) !== filterStatus) return false;
        return true;
    });

    const resetFilters = () => { setSearchQuery(""); setFilterUnit("all"); setFilterStatus("all"); };
    const hasFilters   = searchQuery || filterUnit !== "all" || filterStatus !== "all";

    // ─── Full edit dialog ──────────────────────────────────────
    const handleEdit = (item: any) => {
        setEditingMaterial(item);
        setFormData({
            name: item.name, category: item.category,
            quantity: item.quantity, minQuantity: item.minQuantity,
            maxQuantity: item.maxQuantity ?? "", unit: item.unit,
            supplier: item.supplier || "",
        });
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Bu hammaddeyi silmek istediğinize emin misiniz?")) return;
        const res = await deleteRawMaterial(id);
        if (res.success) toast.success("Silindi.");
        else toast.error(res.error);
        router.refresh();
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            name: formData.name,
            category: formData.category,
            quantity: Number(formData.quantity),
            minQuantity: Number(formData.minQuantity),
            maxQuantity: formData.maxQuantity ? Number(formData.maxQuantity) : null,
            unit: formData.unit,
            supplier: formData.supplier || null,
        };
        const res = editingMaterial?.id
            ? await updateRawMaterial(editingMaterial.id, payload)
            : await addRawMaterial(payload);

        if (res.success) {
            toast.success(editingMaterial?.id ? "Güncellendi." : "Eklendi.");
            setEditingMaterial(null);
            router.refresh();
        } else {
            toast.error(res.error);
        }
    };

    const openAdd = () => {
        setEditingMaterial({ id: null });
        setFormData({ name: "", category: activeTab, quantity: 0, minQuantity: 0, maxQuantity: "", unit: "Adet", supplier: "" });
    };

    // ─── Inline quantity edit ───────────────────────────────────
    const startInlineEdit = (item: any) => {
        setInlineEditId(item.id);
        setInlineEditValue(String(item.quantity));
        setTimeout(() => inlineInputRef.current?.select(), 30);
    };

    const cancelInlineEdit = () => {
        setInlineEditId(null);
        setInlineEditValue("");
    };

    const saveInlineEdit = async (item: any) => {
        const newQty = parseFloat(inlineEditValue);
        if (isNaN(newQty)) { toast.error("Geçersiz sayı"); return; }
        const res = await updateRawMaterial(item.id, {
            name: item.name, category: item.category,
            quantity: newQty,
            minQuantity: item.minQuantity,
            maxQuantity: item.maxQuantity ?? null,
            unit: item.unit,
        });
        if (res.success) {
            toast.success(`${item.name}: ${newQty} ${item.unit} olarak güncellendi.`);
            setInlineEditId(null);
            router.refresh();
        } else {
            toast.error(res.error);
        }
    };

    const exportToExcel = () => {
        const dataToExport = filteredItems.map((item, idx) => {
            const status = getStatus(item);
            return {
                "Sıra": idx + 1,
                "Stok Adı": item.name,
                "Tedarikçi": item.supplier || "-",
                "Birim": item.unit,
                "Mevcut Stok": item.quantity,
                "Minimum": item.minQuantity,
                "Maksimum": item.maxQuantity || "",
                "Durum": status === "empty" ? "Stok Yok" : status === "critical" ? "Kritik" : status === "full" ? "Dolu" : "Normal"
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        
        // Make columns wider
        worksheet["!cols"] = [
            { wch: 5 },  // Sıra
            { wch: 40 }, // Stok Adı
            { wch: 25 }, // Tedarikçi
            { wch: 10 }, // Birim
            { wch: 15 }, // Mevcut Stok
            { wch: 15 }, // Minimum
            { wch: 15 }, // Maksimum
            { wch: 15 }  // Durum
        ];

        const workbook = XLSX.utils.book_new();
        // Remove characters that Excel doesn't allow in sheet names like '/'
        const safeSheetName = activeCat.label.replace(/[\\/?*\[\]:]/g, "").substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
        
        const safeLabel = activeCat.label.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ]/g, "");
        const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, "-");
        XLSX.writeFile(workbook, `Stok_${safeLabel}_${dateStr}.xlsx`);
    };

    return (
        <div className="space-y-4">

            {/* ─── Üst aksiyon bar ──────────────────────────────────────────── */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">Hammadde Stok Listesi</h3>
                    <p className="text-sm text-muted-foreground">
                        {rawMaterials.length} ürün · {criticalItems.length > 0
                            ? <span className="text-red-600 font-medium">{criticalItems.length} kritik ⚠️</span>
                            : "tümü normal"}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={exportToExcel} className="flex items-center gap-2 text-green-700 hover:text-green-800 hover:bg-green-50 border-green-200">
                        <Download className="w-4 h-4" /> Excel İndir
                    </Button>
                    {canEdit && <ExcelImportDialog />}
                    {canEdit && (
                        <Button size="sm" onClick={openAdd} className="flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Yeni Hammadde
                        </Button>
                    )}
                </div>
            </div>

            {/* ─── Kritik uyarı bandı ───────────────────────────────────────── */}
            {criticalItems.length > 0 && (
                <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800 py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-sm font-semibold">
                        {criticalItems.length} üründe kritik stok!
                    </AlertTitle>
                    <AlertDescription>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {criticalItems.slice(0, 10).map(item => (
                                <span key={item.id} className="text-xs bg-red-100 border border-red-300 rounded px-2 py-0.5">
                                    {item.name} ({item.quantity} {item.unit})
                                </span>
                            ))}
                            {criticalItems.length > 10 && (
                                <span className="text-xs text-red-600">+{criticalItems.length - 10} daha…</span>
                            )}
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            {/* ─── Kategori Tab Butonları ───────────────────────────────────── */}
            <div className="flex flex-wrap gap-1 border-b pb-0">
                {CATEGORIES.map(cat => {
                    const count    = rawMaterials.filter(m => m.category === cat.key).length;
                    const critical = rawMaterials.filter(m => m.category === cat.key && m.quantity < m.minQuantity).length;
                    const isActive = activeTab === cat.key;

                    return (
                        <button
                            key={cat.key}
                            onClick={() => { setActiveTab(cat.key); resetFilters(); }}
                            className={[
                                "relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md border border-b-0 transition-colors",
                                isActive
                                    ? "bg-white border-border text-slate-900 -mb-px z-10"
                                    : "bg-slate-50 border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100",
                            ].join(" ")}
                        >
                            <span>{cat.emoji}</span>
                            <span className="hidden sm:inline">{cat.label}</span>
                            {count > 0 && (
                                <span className={`text-xs rounded-full px-1.5 py-0 ${
                                    critical > 0
                                        ? "bg-red-500 text-white"
                                        : "bg-slate-200 text-slate-600"
                                }`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ─── Aktif Tab Tablosu ────────────────────────────────────────── */}
            <Card className="border rounded-tl-none">
                <CardContent className="p-0">
                    {/* Filter bar */}
                    <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b bg-slate-50/60">
                        {/* Search */}
                        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                            <Search className="h-4 w-4 text-slate-400 shrink-0" />
                            <Input
                                placeholder={`${activeCat.label} içinde ara...`}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="h-8 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm placeholder:text-slate-400"
                            />
                        </div>
                        {/* Unit filter */}
                        <Select value={filterUnit} onValueChange={setFilterUnit}>
                            <SelectTrigger className="h-8 w-32 text-xs">
                                <SelectValue placeholder="Birim" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Birimler</SelectItem>
                                {activeUnits.map((u: any) => (
                                    <SelectItem key={u} value={u}>{u}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {/* Status filter */}
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="h-8 w-32 text-xs">
                                <SelectValue placeholder="Durum" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Durumlar</SelectItem>
                                <SelectItem value="critical">⚠️ Kritik</SelectItem>
                                <SelectItem value="empty">🔴 Stok Yok</SelectItem>
                                <SelectItem value="normal">✅ Normal</SelectItem>
                                <SelectItem value="full">🔵 Dolu</SelectItem>
                            </SelectContent>
                        </Select>
                        {/* Result count + clear */}
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-slate-400">{filteredItems.length} / {activeItems.length}</span>
                            {hasFilters && (
                                <button onClick={resetFilters} className="text-xs text-blue-600 hover:underline">
                                    Temizle
                                </button>
                            )}
                        </div>
                    </div>

                    {filteredItems.length === 0 ? (
                        <div className="py-16 text-center space-y-3">
                            <p className="text-muted-foreground text-sm">
                                {searchQuery
                                    ? `"${searchQuery}" ile eşleşen kayıt bulunamadı.`
                                    : <><strong>{activeCat.emoji} {activeCat.label}</strong> kategorisinde henüz kayıt yok.</>
                                }
                            </p>
                            {!searchQuery && canEdit && (
                                <div className="flex justify-center gap-2">
                                    <ExcelImportDialog />
                                    <Button size="sm" variant="outline" onClick={openAdd}>
                                        <Plus className="w-3.5 h-3.5 mr-1" /> Manuel Ekle
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    <TableHead className="w-9 text-center text-xs">#</TableHead>
                                    <TableHead>Stok Adı</TableHead>
                                    <TableHead>Tedarikçi</TableHead>
                                    <TableHead className="text-center w-20">Birim</TableHead>
                                    <TableHead className="text-right w-32">
                                        Mevcut Stok
                                        <span className="text-[10px] text-slate-400 ml-1 font-normal">(tıkla&düzenle)</span>
                                    </TableHead>
                                    <TableHead className="text-center w-28">Girdi (+)</TableHead>
                                    <TableHead className="text-center w-28">Çıktı (-)</TableHead>
                                    <TableHead className="text-right w-24">Minimum</TableHead>
                                    <TableHead className="text-right w-24">Maksimum</TableHead>
                                    <TableHead className="text-center w-28">Durum</TableHead>
                                    <TableHead className="text-right w-20">İşlem</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredItems.map((item, idx) => {
                                    const crit      = item.quantity < item.minQuantity;
                                    const isInline  = inlineEditId === item.id;
                                    return (
                                        <TableRow
                                            key={item.id}
                                            className={crit ? "bg-red-50/60" : "hover:bg-slate-50/60"}
                                        >
                                            <TableCell className="text-center text-xs text-muted-foreground">{idx + 1}</TableCell>
                                            <TableCell className={`font-medium text-sm ${crit ? "text-red-700" : ""}`}>
                                                {item.name}
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-500">
                                                {item.supplier || "—"}
                                            </TableCell>
                                            <TableCell className="text-center text-sm">{item.unit}</TableCell>

                                            {/* ── Inline editable quantity cell ── */}
                                            <TableCell className="text-right">
                                                {isInline ? (
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Input
                                                            ref={inlineInputRef}
                                                            type="number"
                                                            step="0.01"
                                                            value={inlineEditValue}
                                                            onChange={e => setInlineEditValue(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === "Enter") saveInlineEdit(item);
                                                                if (e.key === "Escape") cancelInlineEdit();
                                                            }}
                                                            className="w-24 h-7 text-right text-sm"
                                                            autoFocus
                                                        />
                                                        <Button size="icon" className="h-7 w-7 bg-green-600 hover:bg-green-700" onClick={() => saveInlineEdit(item)}>
                                                            <Check className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={cancelInlineEdit}>
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => canEdit && startInlineEdit(item)}
                                                        className={`font-mono font-semibold text-sm px-2 py-0.5 rounded transition-all ${
                                                            canEdit ? "cursor-pointer hover:bg-blue-50 hover:text-blue-700 hover:ring-1 hover:ring-blue-300" : "cursor-default"
                                                        } ${
                                                            crit ? "text-red-600" : "text-slate-800"
                                                        }`}
                                                        title={canEdit ? "Tıkla ve düzenle" : ""}
                                                    >
                                                        {Number(item.quantity).toLocaleString("tr-TR")}
                                                    </button>
                                                )}
                                            </TableCell>

                                            {/* Girdi / Çıktı Kolonları */}
                                            <TableCell className="text-center p-1">
                                                {canEdit ? (
                                                <div className="flex items-center justify-center">
                                                    <Input 
                                                        type="number" 
                                                        className="w-16 h-8 text-center text-xs border-green-200 bg-green-50/50 focus-visible:ring-green-500 rounded-r-none" 
                                                        placeholder="Miktar"
                                                        value={inOutValues[item.id]?.in || ""}
                                                        onChange={(e) => handleInOutChange(item.id, "in", e.target.value)}
                                                        onKeyDown={(e) => e.key === "Enter" && submitInOut(item.id, "IN")}
                                                    />
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        className="h-8 w-8 rounded-l-none bg-green-100/50 hover:bg-green-200 text-green-700 border border-l-0 border-green-200"
                                                        onClick={() => submitInOut(item.id, "IN")}
                                                        disabled={!inOutValues[item.id]?.in}
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                                ) : <span className="text-slate-400">—</span>}
                                            </TableCell>

                                            <TableCell className="text-center p-1">
                                                {canEdit ? (
                                                <div className="flex items-center justify-center">
                                                    <Input 
                                                        type="number" 
                                                        className="w-16 h-8 text-center text-xs border-red-200 bg-red-50/50 focus-visible:ring-red-500 rounded-r-none" 
                                                        placeholder="Miktar"
                                                        value={inOutValues[item.id]?.out || ""}
                                                        onChange={(e) => handleInOutChange(item.id, "out", e.target.value)}
                                                        onKeyDown={(e) => e.key === "Enter" && inOutValues[item.id]?.out && openOutModal(item)}
                                                    />
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        className="h-8 w-8 rounded-l-none bg-red-100/50 hover:bg-red-200 text-red-700 border border-l-0 border-red-200"
                                                        onClick={() => openOutModal(item)}
                                                        disabled={!inOutValues[item.id]?.out}
                                                    >
                                                        <Minus className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                                ) : <span className="text-slate-400">—</span>}
                                            </TableCell>

                                            <TableCell className="text-right font-mono text-sm text-slate-500">
                                                {Number(item.minQuantity).toLocaleString("tr-TR")}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-sm text-slate-400">
                                                {item.maxQuantity != null ? Number(item.maxQuantity).toLocaleString("tr-TR") : "—"}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <StockBadge qty={item.quantity} min={item.minQuantity} max={item.maxQuantity} />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {canEdit && (
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(item)}>
                                                        <Edit className="w-3.5 h-3.5 text-blue-600" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
                                                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                                    </Button>
                                                </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* ─── Ekle / Düzenle Modalı ───────────────────────────────────── */}
            <Dialog open={editingMaterial !== null} onOpenChange={v => { if (!v) setEditingMaterial(null); }}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingMaterial?.id ? "Hammadde Düzenle" : "Yeni Hammadde Ekle"}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>İsim *</Label>
                                <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ör: AMORTİSÖR 80 LİK" />
                            </div>
                            <div>
                                <Label>Tedarikçi / Cari Adı</Label>
                                {formData.category === "KUMAS" || formData.category === "DERI" ? (
                                    <Select value={formData.supplier || ""} onValueChange={v => setFormData({ ...formData, supplier: v })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Tedarikçi seçin..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {["Günder", "Hg Tekstil", "Pala Suni Deri"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Input value={formData.supplier || ""} onChange={e => setFormData({ ...formData, supplier: e.target.value })} placeholder="Ör: ABC Plastik" />
                                )}
                            </div>
                        </div>
                        <div>
                            <Label>Kategori</Label>
                            <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map(c => (
                                        <SelectItem key={c.key} value={c.key}>{c.emoji} {c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Mevcut Stok</Label>
                                <Input type="number" step="0.01" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
                            </div>
                            <div>
                                <Label>Birim</Label>
                                <Select value={formData.unit} onValueChange={v => setFormData({ ...formData, unit: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Min. Stok</Label>
                                <Input type="number" step="0.01" value={formData.minQuantity} onChange={e => setFormData({ ...formData, minQuantity: e.target.value })} />
                            </div>
                            <div>
                                <Label>Max. Stok (Opsiyonel)</Label>
                                <Input type="number" step="0.01" value={formData.maxQuantity} onChange={e => setFormData({ ...formData, maxQuantity: e.target.value })} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingMaterial(null)}>İptal</Button>
                            <Button type="submit">{editingMaterial?.id ? "Güncelle" : "Ekle"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Çıktı Modal - Neden + Bölüm */}
            <Dialog open={outModal.open} onOpenChange={v => { if (!v) setOutModal({ open: false, itemId: null, itemName: "", amount: "", neden: "", bolum: "" }); }}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Stok Çıktısı — {outModal.itemName}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <Label>Miktar</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={outModal.amount}
                                onChange={e => setOutModal(m => ({ ...m, amount: e.target.value }))}
                                placeholder="Çıkış miktarı"
                                autoFocus
                            />
                        </div>
                        <div>
                            <Label>Bölüm *</Label>
                            <Select value={outModal.bolum} onValueChange={v => setOutModal(m => ({ ...m, bolum: v }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Bölüm seçin..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {BOLUMLER.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Neden *</Label>
                            <Input
                                value={outModal.neden}
                                onChange={e => setOutModal(m => ({ ...m, neden: e.target.value }))}
                                placeholder="Örn: Konfeksiyon üretimi için"
                                onKeyDown={e => e.key === "Enter" && submitOut()}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOutModal({ open: false, itemId: null, itemName: "", amount: "", neden: "", bolum: "" })}>İptal</Button>
                        <Button onClick={submitOut} className="bg-red-600 hover:bg-red-700">Çıkış Yap</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
