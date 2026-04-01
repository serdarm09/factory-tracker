"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updatePurchaseStatus, createManualPurchaseRequest, updatePurchaseTermDate, cancelPurchaseRequest } from "@/app/actions/purchase-actions";
import { addRawMaterial, updateRawMaterial } from "@/app/actions/raw-material-actions";
import { PurchaseStatus, RawMaterialCategory } from "@prisma/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
    PackageSearch, CheckCircle, Clock, Plus, Calendar, AlertTriangle,
    Search, X, ChevronDown, ChevronUp
} from "lucide-react";

interface RawMaterial { id: number; name: string; unit: string; quantity: number; }

const CATEGORIES: { value: RawMaterialCategory; label: string }[] = [
    { value: "AMORTISOR", label: "Amortisör" },
    { value: "KOL_AYAK_PLASTIK_FILE", label: "Kol / Ayak / File" },
    { value: "SUNGER", label: "Sünger" },
    { value: "TEKER_BINGO_SOKET_MEKANIZMA", label: "Teker / Soket / Mekanizma" },
    { value: "TAHTA", label: "Tahta" },
    { value: "KOLI_NAYLON", label: "Koli / Naylon" },
    { value: "CIVATA", label: "Civata" },
    { value: "KUMAS", label: "Kumaş" },
    { value: "DERI", label: "Deri" },
    { value: "DIGER", label: "Diğer" },
];

export const FIXED_SUPPLIERS = ["Günder", "Hg Tekstil", "Pala Suni Deri"];

export default function PurchasesClient({
    initialPurchaseRequests,
    rawMaterials: initialRawMaterials,
    currentUser
}: {
    initialPurchaseRequests: any[];
    rawMaterials?: RawMaterial[];
    currentUser: { id: number | string, role: string };
}) {
    const router = useRouter();
    const requests = initialPurchaseRequests;
    const rawMaterials = initialRawMaterials || [];

    // ─── Otomatik Yenileme ───
    useEffect(() => {
        const interval = setInterval(() => {
            router.refresh();
        }, 10000);
        return () => clearInterval(interval);
    }, [router]);

    // ─── Filtreler ───
    const [search, setSearch] = useState("");
    const [filterPriority, setFilterPriority] = useState("all");
    const [showCompleted, setShowCompleted] = useState(false);
    // Talep tarihi aralığı
    const [talepFrom, setTalepFrom] = useState("");
    const [talepTo, setTalepTo] = useState("");
    // Termin tarihi aralığı
    const [terminFrom, setTerminFrom] = useState("");
    const [terminTo, setTerminTo] = useState("");

    // ─── Sipariş Verme Modalı ───
    const [orderModal, setOrderModal] = useState<{ open: boolean; requestId: number | null }>({ open: false, requestId: null });
    const [termDate, setTermDate] = useState("");
    const [orderNotes, setOrderNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ─── Termin Düzenleme Modalı ───
    const [editTermModal, setEditTermModal] = useState<{ open: boolean; requestId: number | null; termDate: string; orderNotes: string }>({ open: false, requestId: null, termDate: "", orderNotes: "" });

    // ─── Teslim Alma Modalı ───
    const [deliverModal, setDeliverModal] = useState<{ open: boolean; req: any; selectedSupplier: string }>({ open: false, req: null, selectedSupplier: "" });

    // ─── Manuel Talep Oluşturma Modalı ───
    const [manualOpen, setManualOpen] = useState(false);
    const [cart, setCart] = useState<{ rawMaterialId: number; name: string; unit: string; quantity: number }[]>([]);
    const [manualPriority, setManualPriority] = useState("NORMAL");
    const [manualNotes, setManualNotes] = useState("");

    // ─── Kalem Arama ───
    const [itemSearch, setItemSearch] = useState("");
    const [selectedMat, setSelectedMat] = useState<RawMaterial | null>(null);
    const [itemQty, setItemQty] = useState("");

    // ─── Yeni Ürün Modu ───
    const [newMatMode, setNewMatMode] = useState(false);
    const [newMatName, setNewMatName] = useState("");
    const [newMatUnit, setNewMatUnit] = useState("Adet");
    const [newMatCategory, setNewMatCategory] = useState<RawMaterialCategory>("DIGER");
    const [newMatCreating, setNewMatCreating] = useState(false);

    // ─── Detay Modalı ───
    const [detailModal, setDetailModal] = useState<{ open: boolean; req: any | null }>({ open: false, req: null });

    // ─── İptal Modalı ───
    const [cancelModal, setCancelModal] = useState<{ open: boolean; requestId: number | null }>({ open: false, requestId: null });
    const [cancelReasonText, setCancelReasonText] = useState("");

    // ─── Sayfalama & Filtreleme (Aktif) ───
    const [activePage, setActivePage] = useState(1);

    // ─── Tamamlanan Filtreleri ───
    const [compSearch, setCompSearch] = useState("");
    const [compTalepFrom, setCompTalepFrom] = useState("");
    const [compTalepTo, setCompTalepTo] = useState("");
    const [compPage, setCompPage] = useState(1);
    
    const PAGE_SIZE = 10;

    // ─── Filtreleme Mantığı ───
    const matchesSearch = (req: any) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        if (req.creator?.username?.toLowerCase().includes(q)) return true;
        if (req.notes?.toLowerCase().includes(q)) return true;
        if (req.orderNotes?.toLowerCase().includes(q)) return true;
        if (req.items?.some((it: any) => it.rawMaterial?.name?.toLowerCase().includes(q))) return true;
        return false;
    };

    const matchesDates = (req: any) => {
        const created = new Date(req.createdAt);
        if (talepFrom && created < new Date(talepFrom)) return false;
        if (talepTo) { const to = new Date(talepTo); to.setHours(23, 59, 59, 999); if (created > to) return false; }
        if (req.termDate) {
            const term = new Date(req.termDate);
            if (terminFrom && term < new Date(terminFrom)) return false;
            if (terminTo) { const to = new Date(terminTo); to.setHours(23, 59, 59, 999); if (term > to) return false; }
        } else {
            // Termini olmayan talepleri termin filtresi varsa dışla
            if (terminFrom || terminTo) return false;
        }
        return true;
    };

    const applyFilters = (r: any) =>
        matchesSearch(r) &&
        matchesDates(r) &&
        (filterPriority === "all" || r.priority === filterPriority);

    const activeRequests = useMemo(() =>
        requests.filter(r => r.status !== PurchaseStatus.DELIVERED && r.status !== "CANCELLED" && applyFilters(r)),
        [requests, search, filterPriority, talepFrom, talepTo, terminFrom, terminTo]
    );

    const completedRequests = useMemo(() => {
        return requests.filter(r => {
            if (r.status !== PurchaseStatus.DELIVERED && r.status !== "CANCELLED") return false;
            if (compSearch) {
                const q = compSearch.toLowerCase();
                const matchSearch = r.creator?.username?.toLowerCase().includes(q) || r.notes?.toLowerCase().includes(q) || r.orderNotes?.toLowerCase().includes(q) || r.items?.some((it: any) => it.rawMaterial?.name?.toLowerCase().includes(q));
                if (!matchSearch) return false;
            }
            const created = new Date(r.createdAt);
            if (compTalepFrom && created < new Date(compTalepFrom)) return false;
            if (compTalepTo) { const to = new Date(compTalepTo); to.setHours(23, 59, 59, 999); if (created > to) return false; }
            return true;
        });
    }, [requests, compSearch, compTalepFrom, compTalepTo]);

    const paginatedActive = useMemo(() => activeRequests.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE), [activeRequests, activePage]);
    const totalActivePages = Math.ceil(activeRequests.length / PAGE_SIZE) || 1;

    const paginatedCompleted = useMemo(() => completedRequests.slice((compPage - 1) * PAGE_SIZE, compPage * PAGE_SIZE), [completedRequests, compPage]);
    const totalCompPages = Math.ceil(completedRequests.length / PAGE_SIZE) || 1;

    const hasActiveFilter = !!(search || filterPriority !== "all" || talepFrom || talepTo || terminFrom || terminTo);

    const clearAllFilters = () => { setSearch(""); setFilterPriority("all"); setTalepFrom(""); setTalepTo(""); setTerminFrom(""); setTerminTo(""); setActivePage(1); };

    // ─── Handlers ───
    const filteredMaterials = useMemo(() =>
        rawMaterials.filter(m => m.name.toLowerCase().includes(itemSearch.toLowerCase())).slice(0, 20),
        [rawMaterials, itemSearch]
    );
    const showDropdown = itemSearch.length > 0 && !selectedMat;
    const noResults = showDropdown && filteredMaterials.length === 0;

    const handleSelectMat = (m: RawMaterial) => { setSelectedMat(m); setItemSearch(m.name); setNewMatMode(false); };

    const handleCreateAndAddNewMat = async () => {
        if (!newMatName.trim() || !itemQty) { toast.error("Ürün adı ve miktar gerekli."); return; }
        setNewMatCreating(true);
        const res = await addRawMaterial({ name: newMatName.trim(), category: newMatCategory, quantity: 0, minQuantity: 0, unit: newMatUnit });
        setNewMatCreating(false);
        if (!res.success || !res.data) { toast.error(res.error || "Ürün oluşturulamadı."); return; }
        const created = res.data as any;
        const newMat: RawMaterial = { id: created.id, name: created.name, unit: created.unit, quantity: 0 };
        const qty = parseFloat(itemQty);
        setCart(prev => [...prev, { rawMaterialId: created.id, name: created.name, unit: created.unit, quantity: qty }]);
        router.refresh();
        toast.success(`"${created.name}" eklendi.`);
        setNewMatMode(false); setNewMatName(""); setNewMatUnit("Adet"); setNewMatCategory("DIGER"); setItemQty(""); setItemSearch(""); setSelectedMat(null);
    };

    const handleAddToCart = () => {
        const qty = parseFloat(itemQty);
        if (!selectedMat || isNaN(qty) || qty <= 0) { toast.error("Hammadde seçin ve geçerli miktar girin."); return; }
        setCart(prev => [...prev, { rawMaterialId: selectedMat.id, name: selectedMat.name, unit: selectedMat.unit, quantity: qty }]);
        setSelectedMat(null); setItemSearch(""); setItemQty("");
    };

    const handleOpenOrderModal = (reqId: number) => {
        setTermDate(""); setOrderNotes("");
        setOrderModal({ open: true, requestId: reqId });
    };

    const handleConfirmOrder = async () => {
        if (!termDate) { toast.error("Termin tarihi zorunludur."); return; }
        if (!orderModal.requestId) return;
        setIsSubmitting(true);
        const res = await updatePurchaseStatus(orderModal.requestId, PurchaseStatus.ORDERED, { termDate, orderNotes });
        setIsSubmitting(false);
        if (res.success) { toast.success("Sipariş verildi."); setOrderModal({ open: false, requestId: null }); router.refresh(); }
        else toast.error(res.error);
    };

    const handleOpenEditTermModal = (req: any) => {
        setEditTermModal({ 
            open: true, 
            requestId: req.id, 
            termDate: req.termDate ? new Date(req.termDate).toISOString().split('T')[0] : "", 
            orderNotes: req.orderNotes || "" 
        });
    };

    const handleUpdateTerm = async () => {
        if (!editTermModal.termDate) { toast.error("Termin tarihi zorunludur."); return; }
        if (!editTermModal.requestId) return;
        setIsSubmitting(true);
        const res = await updatePurchaseTermDate(editTermModal.requestId, editTermModal.termDate, editTermModal.orderNotes);
        setIsSubmitting(false);
        if (res.success) { 
            toast.success("Termin güncellendi."); 
            setEditTermModal({ open: false, requestId: null, termDate: "", orderNotes: "" }); 
            router.refresh(); 
        } else {
            toast.error(res.error);
        }
    };

    const handleMarkDelivered = async (req: any, forceSupplier?: string) => {
        if (!forceSupplier && !confirm("Ürünlerin teslim alındığını onaylıyor musunuz? Stoklar otomatik artırılacak.")) return;
        setIsSubmitting(true);
        
        const supplierToApply = forceSupplier || deliverModal.selectedSupplier;

        const res = await updatePurchaseStatus(req.id, PurchaseStatus.DELIVERED, { supplierToApply });
        setIsSubmitting(false);
        if (res.success) { 
            toast.success("Teslim alındı ve stoklar güncellendi."); 
            setDeliverModal({ open: false, req: null, selectedSupplier: "" });
            router.refresh(); 
        } else {
            toast.error(res.error);
        }
    };

    const handleOpenDeliverModal = (req: any) => {
        const hasFabricOrLeather = req.items.some((i: any) => i.rawMaterial.category === "KUMAS" || i.rawMaterial.category === "DERI");
        if (hasFabricOrLeather) {
            setDeliverModal({ open: true, req, selectedSupplier: "" });
        } else {
            handleMarkDelivered(req);
        }
    };

    const handleCreateManual = async () => {
        if (cart.length === 0) { toast.error("En az 1 kalem ekleyin."); return; }
        setIsSubmitting(true);
        const res = await createManualPurchaseRequest({
            creatorId: Number(currentUser.id), priority: manualPriority, notes: manualNotes || undefined,
            items: cart.map(c => ({ rawMaterialId: c.rawMaterialId, quantity: c.quantity }))
        });
        setIsSubmitting(false);
        if (res.success) {
            toast.success("Talep oluşturuldu."); setManualOpen(false); setCart([]); setManualPriority("NORMAL"); setManualNotes(""); router.refresh();
        } else toast.error(res.error);
    };

    const handleCancelRequest = async () => {
        if (!cancelReasonText.trim()) { toast.error("Lütfen iptal nedenini girin."); return; }
        if (!cancelModal.requestId) return;
        setIsSubmitting(true);
        const res = await cancelPurchaseRequest(cancelModal.requestId, cancelReasonText);
        setIsSubmitting(false);
        if (res.success) {
            toast.success("Talep iptal edildi.");
            setCancelModal({ open: false, requestId: null });
            setCancelReasonText("");
            router.refresh();
        } else toast.error(res.error);
    };

    const getStatusBadge = (status: PurchaseStatus | "CANCELLED") => {
        switch (status) {
            case PurchaseStatus.PENDING: return <Badge variant="outline" className="text-amber-600 border-amber-600 bg-amber-50 gap-1"><Clock className="w-3 h-3" /> Bekliyor</Badge>;
            case PurchaseStatus.ORDERED: return <Badge variant="outline" className="text-blue-600 border-blue-600 bg-blue-50 gap-1"><PackageSearch className="w-3 h-3" /> Sipariş Verildi</Badge>;
            case PurchaseStatus.DELIVERED: return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-600 gap-1"><CheckCircle className="w-3 h-3" /> Teslim Alındı</Badge>;
            case "CANCELLED": return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-600 gap-1"><X className="w-3 h-3" /> İptal Edildi</Badge>;
            default: return <Badge>{status}</Badge>;
        }
    };

    const canManual = currentUser.role === "ADMIN" || currentUser.role === "PURCHASING";

    const RequestRow = ({ req }: { req: any }) => {
        return (
            <TableRow className="hover:bg-slate-50/50">
                <TableCell className="whitespace-nowrap font-medium text-slate-600">
                    {format(new Date(req.createdAt), 'dd MMM yyyy', { locale: tr })}
                </TableCell>
                <TableCell>
                    {req.priority === "URGENT"
                        ? <Badge variant="destructive" className="animate-pulse">ACİL</Badge>
                        : <Badge variant="secondary" className="bg-slate-100 text-slate-600">Normal</Badge>}
                </TableCell>
                <TableCell 
                    className="cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => setDetailModal({ open: true, req })}
                >
                    <div className="text-sm font-medium text-blue-600 line-clamp-2">
                        {req.items.map((i: any) => i.rawMaterial.name).join(", ")}
                    </div>
                    {req.notes && <div className="mt-1 text-xs text-slate-500 italic truncate">Not: {req.notes}</div>}
                    <div className="text-[10px] text-slate-400 mt-1">Detay için tıklayın</div>
                </TableCell>
            <TableCell>{getStatusBadge(req.status)}</TableCell>
            <TableCell>
                {req.termDate ? (
                    <span className={`text-sm font-medium flex items-center gap-1 ${new Date(req.termDate) < new Date() && req.status !== "DELIVERED" ? "text-red-600" : "text-slate-700"}`}>
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(req.termDate), 'dd MMM yyyy', { locale: tr })}
                        {new Date(req.termDate) < new Date() && req.status !== "DELIVERED" && <AlertTriangle className="w-3 h-3 text-red-500" />}
                    </span>
                ) : <span className="text-slate-400 text-xs">—</span>}
            </TableCell>
            <TableCell className="text-slate-600 font-medium">{req.creator.username}</TableCell>
            <TableCell className="text-right">
                <div className="flex flex-col gap-2 justify-end items-end">
                    {req.status === PurchaseStatus.PENDING && canManual && (
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 w-full" onClick={(e) => { e.stopPropagation(); handleOpenOrderModal(req.id); }}>Sipariş (Termin gir)</Button>
                    )}
                    {req.status === PurchaseStatus.ORDERED && (
                        <>
                            {canManual && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 w-full" onClick={(e) => { e.stopPropagation(); handleOpenDeliverModal(req); }}>Teslim Al</Button>}
                            {currentUser.role === "ADMIN" && (
                                <Button size="sm" variant="outline" className="w-full text-slate-600" onClick={(e) => { e.stopPropagation(); handleOpenEditTermModal(req); }}>Termin Güncelle</Button>
                            )}
                        </>
                    )}
                    {(req.status === PurchaseStatus.PENDING || req.status === PurchaseStatus.ORDERED) && canManual && (
                        <Button size="sm" variant="destructive" className="w-full" onClick={(e) => { e.stopPropagation(); setCancelModal({ open: true, requestId: req.id }); setCancelReasonText(""); }}>İptal Et</Button>
                    )}
                    {req.status === PurchaseStatus.DELIVERED && <span className="text-xs text-slate-400 italic">Tamamlandı</span>}
                    {req.status === "CANCELLED" && <span className="text-xs text-red-400 italic">İptal Edildi</span>}
                </div>
            </TableCell>
        </TableRow>
        );
    };

    const TableHead6 = () => (
        <TableHeader>
            <TableRow className="bg-slate-50">
                <TableHead className="w-32">Talep Tarihi</TableHead>
                <TableHead className="w-24">Öncelik</TableHead>
                <TableHead className="w-[28%]">Alınacak Kalemler</TableHead>
                <TableHead className="w-36">Durum</TableHead>
                <TableHead className="w-36">Termin</TableHead>
                <TableHead className="w-28">Talep Eden</TableHead>
                <TableHead className="text-right w-44">Aksiyonlar</TableHead>
            </TableRow>
        </TableHeader>
    );

    return (
        <>
            <Card className="border-t-4 border-t-indigo-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-xl text-slate-800">Satın Alma Talepleri</CardTitle>
                        <CardDescription>Aktif ve bekleyen sipariş talepleri.</CardDescription>
                    </div>
                    {canManual && (
                        <Button onClick={() => setManualOpen(true)} className="gap-2">
                            <Plus className="w-4 h-4" /> Manuel Talep Oluştur
                        </Button>
                    )}
                </CardHeader>

                {/* ─── Filtre Satırı ─── */}
                <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
                    {/* Arama */}
                    <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-white border rounded-md h-9 px-3">
                        <Search className="h-4 w-4 text-slate-400 shrink-0" />
                        <Input
                            placeholder="Malzeme, talep eden, not..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="h-8 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm p-0 placeholder:text-slate-400"
                        />
                        {search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
                    </div>

                    {/* Öncelik */}
                    <Select value={filterPriority} onValueChange={setFilterPriority}>
                        <SelectTrigger className="h-9 w-[140px] text-sm bg-white">
                            <SelectValue placeholder="Öncelik" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Öncelikler</SelectItem>
                            <SelectItem value="URGENT">Acil</SelectItem>
                            <SelectItem value="NORMAL">Normal</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Talep Tarihi */}
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500 whitespace-nowrap">Talep:</span>
                        <Input type="date" value={talepFrom} onChange={e => setTalepFrom(e.target.value)} className="h-9 w-[130px] text-sm bg-white" />
                        <span className="text-slate-400 text-xs">—</span>
                        <Input type="date" value={talepTo} onChange={e => setTalepTo(e.target.value)} className="h-9 w-[130px] text-sm bg-white" />
                    </div>

                    {/* Termin Tarihi */}
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500 whitespace-nowrap">Termin:</span>
                        <Input type="date" value={terminFrom} onChange={e => setTerminFrom(e.target.value)} className="h-9 w-[130px] text-sm bg-white" />
                        <span className="text-slate-400 text-xs">—</span>
                        <Input type="date" value={terminTo} onChange={e => setTerminTo(e.target.value)} className="h-9 w-[130px] text-sm bg-white" />
                    </div>

                    {hasActiveFilter && (
                        <Button variant="ghost" size="sm" className="h-9 text-slate-500 gap-1" onClick={clearAllFilters}>
                            <X className="w-3.5 h-3.5" /> Temizle
                        </Button>
                    )}
                    <span className="text-xs text-slate-400 ml-auto">{activeRequests.length} aktif talep</span>
                </div>

                <CardContent className="p-0">
                    <Table>
                        <TableHead6 />
                        <TableBody>
                            {paginatedActive.map(req => <RequestRow key={req.id} req={req} />)}
                            {paginatedActive.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-slate-500 py-12">
                                        <div className="flex flex-col items-center gap-2">
                                            <PackageSearch className="w-8 h-8 text-slate-300" />
                                            <span>{hasActiveFilter ? "Filtreyle eşleşen aktif talep yok." : "Bekleyen satın alma talebi yok."}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    {totalActivePages > 1 && (
                        <div className="flex items-center justify-between px-6 py-3 border-t bg-slate-50">
                            <span className="text-sm text-slate-500">
                                Toplam <strong>{activeRequests.length}</strong> kayıttan <strong>{(activePage - 1) * PAGE_SIZE + 1} - {Math.min(activePage * PAGE_SIZE, activeRequests.length)}</strong> arası gösteriliyor.
                            </span>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => setActivePage(p => Math.max(1, p - 1))} disabled={activePage === 1}>Önceki</Button>
                                <span className="text-sm font-medium">{activePage} / {totalActivePages}</span>
                                <Button variant="outline" size="sm" onClick={() => setActivePage(p => Math.min(totalActivePages, p + 1))} disabled={activePage === totalActivePages}>Sonraki</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ─── Tamamlananlar (Katlanabilir) ─── */}
            {(completedRequests.length > 0 || hasActiveFilter) && (
                <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                    <button
                        className="w-full flex items-center justify-between px-6 py-3 hover:bg-slate-50 transition-colors"
                        onClick={() => setShowCompleted(v => !v)}
                    >
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                            <span className="font-semibold text-slate-700">Tamamlananlar</span>
                            <Badge variant="secondary" className="bg-slate-100 text-slate-500">{completedRequests.length}</Badge>
                        </div>
                        {showCompleted ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>

                    {showCompleted && (
                        <div className="border-t">
                            <div className="bg-slate-50 px-6 py-3 border-b flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-white border rounded-md h-9 px-3">
                                    <Search className="h-4 w-4 text-slate-400 shrink-0" />
                                    <Input
                                        placeholder="Tamamlananlarda ara..."
                                        value={compSearch}
                                        onChange={e => { setCompSearch(e.target.value); setCompPage(1); }}
                                        className="h-8 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm p-0 placeholder:text-slate-400"
                                    />
                                    {compSearch && <button onClick={() => { setCompSearch(""); setCompPage(1); }} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-slate-500 whitespace-nowrap">Tarih:</span>
                                    <Input type="date" value={compTalepFrom} onChange={e => { setCompTalepFrom(e.target.value); setCompPage(1); }} className="h-9 w-[130px] text-sm bg-white" />
                                    <span className="text-slate-400 text-xs">—</span>
                                    <Input type="date" value={compTalepTo} onChange={e => { setCompTalepTo(e.target.value); setCompPage(1); }} className="h-9 w-[130px] text-sm bg-white" />
                                </div>
                            </div>
                            <Table>
                                <TableHead6 />
                                <TableBody>
                                    {paginatedCompleted.map(req => <RequestRow key={req.id} req={req} />)}
                                    {paginatedCompleted.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center text-slate-400 py-6 text-sm">
                                                Tamamlanan talep bulunamadı.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            {totalCompPages > 1 && (
                                <div className="flex items-center justify-between px-6 py-3 border-t bg-slate-50">
                                    <span className="text-sm text-slate-500">
                                        Toplam <strong>{completedRequests.length}</strong> kayıttan <strong>{(compPage - 1) * PAGE_SIZE + 1} - {Math.min(compPage * PAGE_SIZE, completedRequests.length)}</strong> arası gösteriliyor.
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setCompPage(p => Math.max(1, p - 1))} disabled={compPage === 1}>Önceki</Button>
                                        <span className="text-sm font-medium">{compPage} / {totalCompPages}</span>
                                        <Button variant="outline" size="sm" onClick={() => setCompPage(p => Math.min(totalCompPages, p + 1))} disabled={compPage === totalCompPages}>Sonraki</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ─── Sipariş Verme Modalı ─── */}
            <Dialog open={orderModal.open} onOpenChange={o => setOrderModal({ open: o, requestId: o ? orderModal.requestId : null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Sipariş Onayla</DialogTitle>
                        <DialogDescription>Termin tarihini girerek siparişi onaylayın.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="flex items-center gap-1">
                                <Calendar className="w-4 h-4 text-blue-500" />
                                Termin Tarihi <span className="text-red-500 ml-0.5">*</span>
                            </Label>
                            <Input type="date" value={termDate} onChange={e => setTermDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Açıklama (Opsiyonel)</Label>
                            <Textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Tedarikçi, fatura notu..." rows={3} className="resize-none" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOrderModal({ open: false, requestId: null })}>İptal</Button>
                        <Button onClick={handleConfirmOrder} disabled={!termDate || isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                            {isSubmitting ? "Kaydediliyor..." : "Siparişi Onayla"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Manuel Talep Oluşturma Modalı ─── */}
            {canManual && (
                <Dialog open={manualOpen} onOpenChange={o => { setManualOpen(o); if (!o) { setNewMatMode(false); setItemSearch(""); setSelectedMat(null); setItemQty(""); } }}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Manuel Satın Alma Talebi</DialogTitle>
                            <DialogDescription>Hammadde arayın; listede yoksa yeni ürün ekleyin.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-1">
                            {!newMatMode ? (
                                <div className="space-y-2">
                                    <Label>Hammadde Ara</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input value={itemSearch} onChange={e => { setItemSearch(e.target.value); setSelectedMat(null); }}
                                            placeholder="Ürün adını yazın..." className="pl-9" />
                                        {selectedMat && (
                                            <button onClick={() => { setSelectedMat(null); setItemSearch(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    {showDropdown && !noResults && (
                                        <div className="border rounded-md shadow-sm bg-white max-h-48 overflow-y-auto text-sm">
                                            {filteredMaterials.map(m => (
                                                <button key={m.id} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between" onClick={() => handleSelectMat(m)}>
                                                    <span className="font-medium text-slate-800">{m.name}</span>
                                                    <span className="text-slate-400 text-xs">{m.quantity} {m.unit}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {noResults && (
                                        <div className="border border-dashed border-amber-300 rounded-md px-3 py-2 text-sm text-amber-700 bg-amber-50 flex items-center justify-between">
                                            <span>"{itemSearch}" bulunamadı.</span>
                                            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => { setNewMatMode(true); setNewMatName(itemSearch); }}>
                                                <Plus className="w-3 h-3 mr-1" /> Yeni Ürün Ekle
                                            </Button>
                                        </div>
                                    )}
                                    {selectedMat && (
                                        <div className="flex items-center gap-2 p-2 bg-indigo-50 border border-indigo-200 rounded-md">
                                            <span className="flex-1 text-sm font-medium text-indigo-800">{selectedMat.name}</span>
                                            <Input type="number" step="0.01" min="0.01" placeholder="Miktar" value={itemQty} onChange={e => setItemQty(e.target.value)} className="w-28 h-8 text-sm bg-white" />
                                            <span className="text-slate-500 text-sm">{selectedMat.unit}</span>
                                            <Button size="sm" onClick={handleAddToCart} className="h-8">Ekle</Button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3 border rounded-lg p-4 bg-slate-50">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-sm font-semibold text-slate-700">Yeni Ürün Oluştur ve Ekle</p>
                                        <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500" onClick={() => { setNewMatMode(false); setNewMatName(""); }}>İptal</Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2 space-y-1">
                                            <Label>Ürün Adı <span className="text-red-400">*</span></Label>
                                            <Input value={newMatName} onChange={e => setNewMatName(e.target.value)} placeholder="Ör: Özel Civata M8" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Kategori</Label>
                                            <Select value={newMatCategory} onValueChange={v => setNewMatCategory(v as RawMaterialCategory)}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Birim</Label>
                                            <Select value={newMatUnit} onValueChange={setNewMatUnit}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>{["Adet", "Kg", "Metre", "Paket", "Kutu", "Litre", "Çift"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <Label>Miktar <span className="text-red-400">*</span></Label>
                                            <Input type="number" step="0.01" min="0.01" value={itemQty} onChange={e => setItemQty(e.target.value)} />
                                        </div>
                                    </div>
                                    <Button onClick={handleCreateAndAddNewMat} disabled={!newMatName.trim() || !itemQty || newMatCreating} className="w-full">
                                        {newMatCreating ? "Kaydediliyor..." : "Ürünü Oluştur ve Listeye Ekle"}
                                    </Button>
                                </div>
                            )}

                            {cart.length > 0 && (
                                <div className="border rounded-md divide-y text-sm">
                                    <p className="px-3 py-2 font-semibold text-slate-700 bg-slate-50">Talep Listesi ({cart.length} kalem)</p>
                                    {cart.map((c, i) => (
                                        <div key={i} className="flex items-center justify-between px-3 py-2">
                                            <span className="text-slate-700">{c.name}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono font-bold text-slate-800">{c.quantity} {c.unit}</span>
                                                <button onClick={() => setCart(cart.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label>Öncelik</Label>
                                    <Select value={manualPriority} onValueChange={setManualPriority}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NORMAL">Normal</SelectItem>
                                            <SelectItem value="URGENT">Acil</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label>Not (Opsiyonel)</Label>
                                    <Input value={manualNotes} onChange={e => setManualNotes(e.target.value)} placeholder="Ek açıklama..." />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setManualOpen(false)}>İptal</Button>
                            <Button onClick={handleCreateManual} disabled={cart.length === 0 || isSubmitting}>
                                {isSubmitting ? "Oluşturuluyor..." : `Talebi Oluştur (${cart.length} kalem)`}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* --- Termin Güncelleme Modalı --- */}
            <Dialog open={editTermModal.open} onOpenChange={(val) => !val && setEditTermModal({ ...editTermModal, open: false })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Termin & Not Güncelle</DialogTitle>
                        <DialogDescription>
                            Siparişin termin tarihini veya satınalma notunu değiştirebilirsiniz.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Yeni Termin Tarihi</Label>
                            <Input
                                type="date"
                                value={editTermModal.termDate}
                                onChange={(e) => setEditTermModal({ ...editTermModal, termDate: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Satınalma Notu (İsteğe bağlı)</Label>
                            <Textarea
                                placeholder="Tedarikçi bilgisi, ek notlar..."
                                value={editTermModal.orderNotes}
                                onChange={(e) => setEditTermModal({ ...editTermModal, orderNotes: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditTermModal({ ...editTermModal, open: false })}>İptal</Button>
                        <Button onClick={handleUpdateTerm} disabled={isSubmitting}>Güncelle</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Teslim Alma Modalı ─── */}
            <Dialog open={deliverModal.open} onOpenChange={(val) => !val && setDeliverModal({ open: false, req: null, selectedSupplier: "" })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Teslim Al ve Stoklara İşle</DialogTitle>
                        <DialogDescription>
                            Bu siparişte Deri veya Kumaş bulunuyor. Renk/ton takibi için lütfen tedarikçi seçin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Tedarikçi Firma</Label>
                            <Select value={deliverModal.selectedSupplier} onValueChange={(v) => setDeliverModal({ ...deliverModal, selectedSupplier: v })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Tedarikçi seçin..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {FIXED_SUPPLIERS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeliverModal({ open: false, req: null, selectedSupplier: "" })}>İptal</Button>
                        <Button onClick={() => handleMarkDelivered(deliverModal.req, deliverModal.selectedSupplier)} disabled={isSubmitting || !deliverModal.selectedSupplier} className="bg-emerald-600 hover:bg-emerald-700">
                            {isSubmitting ? "İşleniyor..." : "Teslim Al ve Stoklara Ekle"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Talep Detayı Modalı ─── */}
            <Dialog open={detailModal.open} onOpenChange={o => setDetailModal({ open: o, req: o ? detailModal.req : null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Sipariş Detayı</DialogTitle>
                    </DialogHeader>
                    {detailModal.req && (
                        <div className="py-2">
                            <ul className="space-y-2">
                                {detailModal.req.items.map((it: any) => (
                                    <li key={it.id} className="text-sm flex items-center gap-2 p-2 bg-slate-50 rounded border">
                                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                                        <span className="font-semibold text-slate-800">{it.quantity} {it.rawMaterial.unit}</span>
                                        <span className="text-slate-600 font-medium">{it.rawMaterial.name}</span>
                                    </li>
                                ))}
                            </ul>
                            {detailModal.req.notes && (
                                <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded text-amber-800 text-sm whitespace-break-spaces">
                                    <strong>Genel Not:</strong> {detailModal.req.notes}
                                </div>
                            )}
                            {detailModal.req.orderNotes && (
                                <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded text-blue-800 text-sm whitespace-break-spaces">
                                    <strong>Satınalma Notu:</strong> {detailModal.req.orderNotes}
                                </div>
                            )}
                            {detailModal.req.cancelReason && (
                                <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded text-red-800 text-sm whitespace-break-spaces">
                                    <strong>İptal Nedeni:</strong> {detailModal.req.cancelReason}
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDetailModal({ open: false, req: null })}>Kapat</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── İptal Modalı ─── */}
            <Dialog open={cancelModal.open} onOpenChange={(val) => !val && setCancelModal({ open: false, requestId: null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Talebi İptal Et</DialogTitle>
                        <DialogDescription>
                            Talebi iptal etmek istediğinize emin misiniz? Lütfen iptal nedenini girin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>İptal Nedeni <span className="text-red-500">*</span></Label>
                            <Textarea
                                placeholder="Örn: Yanlış miktar girildi, tedarikçi bulunamadı vb."
                                value={cancelReasonText}
                                onChange={(e) => setCancelReasonText(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCancelModal({ open: false, requestId: null })}>Vazgeç</Button>
                        <Button variant="destructive" onClick={handleCancelRequest} disabled={!cancelReasonText.trim() || isSubmitting}>
                            {isSubmitting ? "İşleniyor..." : "İptal Et"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
