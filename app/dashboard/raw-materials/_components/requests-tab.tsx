import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { updateMaterialRequestStatus, createPurchaseRequest, createMaterialRequest } from "@/app/actions/raw-material-actions";
import { RequestStatus } from "@prisma/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Plus, Search, X, Filter, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RequestsTab({ materialRequests, rawMaterials, currentUser }: { materialRequests: any[]; rawMaterials: any[]; currentUser: { id: number, role?: string } }) {
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [purchasePriority, setPurchasePriority] = useState("NORMAL");

    // Detay Modal State
    const [selectedDetail, setSelectedDetail] = useState<any | null>(null);

    // Filtre state'leri
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Manuel Talep State'leri
    const [isManualRequestOpen, setIsManualRequestOpen] = useState(false);
    const [manualReqData, setManualReqData] = useState({ rawMaterialId: "", quantity: "", department: "Sistem Yönetimi", notes: "" });
    const isAdmin = currentUser.role === "ADMIN";

    // Benzersiz departmanlar
    const uniqueDepartments = useMemo(() => {
        const deps = new Set(materialRequests.map(r => r.department));
        return Array.from(deps).sort();
    }, [materialRequests]);

    // Filtrelenmiş liste
    const filtered = useMemo(() => {
        return materialRequests.filter(req => {
            const term = search.toLowerCase();
            const matchSearch = !search ||
                req.department.toLowerCase().includes(term) ||
                req.rawMaterial.name.toLowerCase().includes(term) ||
                req.requester.username.toLowerCase().includes(term);

            const matchStatus = statusFilter === "ALL" || req.status === statusFilter;
            const matchDept = departmentFilter === "ALL" || req.department === departmentFilter;

            const reqDate = new Date(req.createdAt);
            const matchFrom = !dateFrom || reqDate >= new Date(dateFrom);
            const matchTo = !dateTo || reqDate <= new Date(dateTo + "T23:59:59");

            return matchSearch && matchStatus && matchDept && matchFrom && matchTo;
        });
    }, [materialRequests, search, statusFilter, departmentFilter, dateFrom, dateTo]);

    const hasActiveFilters = search || statusFilter !== "ALL" || departmentFilter !== "ALL" || dateFrom || dateTo;

    const clearFilters = () => {
        setSearch("");
        setStatusFilter("ALL");
        setDepartmentFilter("ALL");
        setDateFrom("");
        setDateTo("");
    };

    const handleApprove = async (req: any) => {
        if (!confirm("Bu talebi onaylayıp, stoktan düşmek istediğinize emin misiniz?")) return;

        const res = await updateMaterialRequestStatus(req.id, RequestStatus.APPROVED, req.rawMaterialId, req.quantity);
        if (res.success) {
            toast.success("Talep onaylandı ve stok güncellendi.");
        } else {
            toast.error(res.error);
        }
    };

    const handleReject = async (req: any) => {
        if (!confirm("Talebi iptal etmek (reddetmek) istediğinize emin misiniz?")) return;
        const res = await updateMaterialRequestStatus(req.id, RequestStatus.REJECTED);
        if (res.success) toast.success("Talep reddedildi.");
        else toast.error(res.error);
    };

    const handlePurchaseNeeded = async () => {
        if (!selectedRequest) return;

        // 1. Durumu PURCHASE_NEEDED yap
        const statusRes = await updateMaterialRequestStatus(selectedRequest.id, RequestStatus.PURCHASE_NEEDED);
        if (!statusRes.success) {
            toast.error(statusRes.error);
            return;
        }

        // 2. Bir satınalma talebi (PurchaseRequest) oluştur (otomatik olarak 1 kalem ile)
        const noteText = `Otomatik talep transferi (Departman: ${selectedRequest.department})${selectedRequest.notes ? `\nEk Not: ${selectedRequest.notes}` : ""}`;
        const purchaseRes = await createPurchaseRequest(currentUser.id, [{ rawMaterialId: selectedRequest.rawMaterialId, quantity: selectedRequest.quantity }], purchasePriority, noteText);

        if (purchaseRes.success) {
            toast.success("Talep satın almaya aktarıldı.");
            setIsPurchaseModalOpen(false);
            setSelectedRequest(null);
        } else {
            toast.error(purchaseRes.error);
        }
    };

    const handleManualRequestSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const rqty = parseFloat(manualReqData.quantity);
        if (!manualReqData.rawMaterialId || isNaN(rqty) || rqty <= 0) {
            toast.error("Geçerli bir hammadde ve miktar seçin.");
            return;
        }

        const res = await createMaterialRequest({
            rawMaterialId: parseInt(manualReqData.rawMaterialId),
            quantity: rqty,
            requesterId: currentUser.id,
            department: manualReqData.department,
            notes: manualReqData.notes
        });

        if (res.success) {
            toast.success("Manuel talep oluşturuldu.");
            setIsManualRequestOpen(false);
            setManualReqData({ rawMaterialId: "", quantity: "", department: "Sistem Yönetimi", notes: "" });
        } else {
            toast.error(res.error);
        }
    };

    const getStatusBadge = (status: RequestStatus) => {
        switch (status) {
            case RequestStatus.PENDING: return <Badge variant="outline" className="text-amber-600 border-amber-600">Bekliyor</Badge>
            case RequestStatus.APPROVED: return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-600">Verildi</Badge>
            case RequestStatus.REJECTED: return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-600">Reddedildi</Badge>
            case RequestStatus.PURCHASE_NEEDED: return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-600">Satın Alınacak</Badge>
            default: return <Badge>{status}</Badge>
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                    <CardTitle>Gelen Malzeme Talepleri</CardTitle>
                    <CardDescription>Diğer departmanların hammadde deposundan istediği ürünler burada listelenir.</CardDescription>
                </div>
                {isAdmin && (
                    <Button onClick={() => setIsManualRequestOpen(true)} size="sm" className="gap-2">
                        <Plus className="w-4 h-4" /> Manuel Talep Aç
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {/* Filtre Satırı */}
                <div className="flex flex-wrap gap-2 mb-4 items-end">
                    {/* Arama */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Departman, malzeme veya kullanıcı ara..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {/* Durum Filtresi */}
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Durum" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Tüm Durumlar</SelectItem>
                            <SelectItem value={RequestStatus.PENDING}>Bekliyor</SelectItem>
                            <SelectItem value={RequestStatus.APPROVED}>Verildi</SelectItem>
                            <SelectItem value={RequestStatus.REJECTED}>Reddedildi</SelectItem>
                            <SelectItem value={RequestStatus.PURCHASE_NEEDED}>Satın Alınacak</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Departman Filtresi */}
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Departman" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Tüm Departmanlar</SelectItem>
                            {uniqueDepartments.map(d => (
                                <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Tarih Aralığı */}
                    <div className="flex items-center gap-1">
                        <Input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="w-[140px] text-sm"
                            title="Başlangıç tarihi"
                        />
                        <span className="text-slate-400 text-sm">—</span>
                        <Input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="w-[140px] text-sm"
                            title="Bitiş tarihi"
                        />
                    </div>

                    {/* Temizle */}
                    {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500 hover:text-red-600">
                            <X className="h-4 w-4 mr-1" /> Temizle
                        </Button>
                    )}
                </div>

                {/* Sonuç Sayısı */}
                <div className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                    <Filter className="h-3 w-3" />
                    {filtered.length} / {materialRequests.length} talep gösteriliyor
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tarih</TableHead>
                            <TableHead>Departman / İsteyen</TableHead>
                            <TableHead>Hammadde</TableHead>
                            <TableHead className="text-right">İstenen Miktar</TableHead>
                            <TableHead>Mevcut Stok</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead className="text-right">Aksiyonlar</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.map((req) => (
                            <TableRow 
                                key={req.id}
                                className="hover:bg-slate-50 cursor-pointer transition-colors"
                                onClick={() => setSelectedDetail(req)}
                            >
                                <TableCell className="whitespace-nowrap">{format(new Date(req.createdAt), 'dd MMM yyyy HH:mm', { locale: tr })}</TableCell>
                                <TableCell>
                                    <div className="font-medium">{req.department}</div>
                                    <div className="text-xs text-slate-500">{req.requester.username}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="font-medium">{req.rawMaterial.name}</div>
                                    {req.notes && <div className="text-xs text-slate-500 mt-1 italic">Not: {req.notes}</div>}
                                </TableCell>
                                <TableCell className="text-right font-bold text-slate-700">{req.quantity} {req.rawMaterial.unit}</TableCell>
                                <TableCell>
                                    <span className={req.rawMaterial.quantity < req.quantity ? "text-red-500 font-bold" : "text-emerald-600"}>
                                        {req.rawMaterial.quantity} {req.rawMaterial.unit}
                                    </span>
                                </TableCell>
                                <TableCell>{getStatusBadge(req.status)}</TableCell>
                                <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                                    {req.status === RequestStatus.PENDING && (
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(req)}>
                                                Depoda var
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => { setSelectedRequest(req); setIsPurchaseModalOpen(true); }}>
                                                Satın Almaya
                                            </Button>
                                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleReject(req)}>
                                                Red
                                            </Button>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-slate-500 py-6">
                                    {hasActiveFilters ? "Filtreyle eşleşen talep bulunamadı." : "Bekleyen talep bulunmamaktadır."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                <Dialog open={isPurchaseModalOpen} onOpenChange={setIsPurchaseModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Talebi Satın Almaya Aktar</DialogTitle>
                            <DialogDescription>
                                Depoda yeterli <strong>{selectedRequest?.rawMaterial?.name}</strong> bulunmadığı için bu isteği "Satın Alınacaklar" (Purchase Request) listesine eklemek üzeresiniz.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-2 space-y-2">
                            <Label>Öncelik Durumu</Label>
                            <Select value={purchasePriority} onValueChange={setPurchasePriority}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NORMAL">Normal</SelectItem>
                                    <SelectItem value="URGENT">Acil</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsPurchaseModalOpen(false)}>İptal</Button>
                            <Button onClick={handlePurchaseNeeded}>Aktar ve Listeye Ekle</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Manuel Talep Modalı */}
                <Dialog open={isManualRequestOpen} onOpenChange={setIsManualRequestOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Manuel Malzeme Talebi (Admin)</DialogTitle>
                            <DialogDescription>
                                Depoya işlenmesi için elden talep oluşturup onay sürecine sokabilirsiniz.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleManualRequestSubmit} className="space-y-4 py-2">
                            <div className="space-y-1.5">
                                <Label>Talep Edilen Hammadde</Label>
                                <Select value={manualReqData.rawMaterialId} onValueChange={v => setManualReqData({ ...manualReqData, rawMaterialId: v })}>
                                    <SelectTrigger><SelectValue placeholder="Hammadde seçin..." /></SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                        {rawMaterials.map((m) => (
                                            <SelectItem key={m.id} value={String(m.id)}>
                                                {m.name} <span className="text-muted-foreground text-xs ml-2">({m.quantity} {m.unit} var)</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Miktar</Label>
                                    <Input
                                        type="number" step="0.01"
                                        value={manualReqData.quantity}
                                        onChange={e => setManualReqData({ ...manualReqData, quantity: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>İsteyen Departman</Label>
                                    <Input
                                        value={manualReqData.department}
                                        onChange={e => setManualReqData({ ...manualReqData, department: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Not (İsteğe Bağlı)</Label>
                                <Input
                                    value={manualReqData.notes}
                                    onChange={e => setManualReqData({ ...manualReqData, notes: e.target.value })}
                                />
                            </div>
                            <DialogFooter className="pt-2">
                                <Button type="button" variant="outline" onClick={() => setIsManualRequestOpen(false)}>İptal</Button>
                                <Button type="submit">Talebi Oluştur</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Detay Modal */}
                <Dialog open={!!selectedDetail} onOpenChange={open => !open && setSelectedDetail(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Info className="w-5 h-5 text-blue-600" />
                                Gelen Talep Detayı
                            </DialogTitle>
                        </DialogHeader>
                        {selectedDetail && (
                            <div className="space-y-4 pt-4">
                                <div className="grid grid-cols-3 gap-2 border-b pb-2 text-sm">
                                    <strong className="text-slate-500">Tarih / Saat:</strong>
                                    <span className="col-span-2">{format(new Date(selectedDetail.createdAt), 'dd MMMM yyyy HH:mm', { locale: tr })}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 border-b pb-2 text-sm">
                                    <strong className="text-slate-500">Departman:</strong>
                                    <span className="col-span-2 font-medium">{selectedDetail.department}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 border-b pb-2 text-sm">
                                    <strong className="text-slate-500">Talep Eden:</strong>
                                    <span className="col-span-2">{selectedDetail.requester?.username}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 border-b pb-2 text-sm">
                                    <strong className="text-slate-500">Hammadde:</strong>
                                    <span className="col-span-2 font-medium">{selectedDetail.rawMaterial?.name}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 border-b pb-2 text-sm">
                                    <strong className="text-slate-500">Miktar:</strong>
                                    <span className="col-span-2 font-mono font-bold text-lg">
                                        {selectedDetail.quantity} {selectedDetail.rawMaterial?.unit}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 border-b pb-2 text-sm">
                                    <strong className="text-slate-500">Durum:</strong>
                                    <span className="col-span-2">{getStatusBadge(selectedDetail.status)}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 pt-2 text-sm">
                                    <strong className="text-slate-500">Not / Açıklama:</strong>
                                    <p className="col-span-2 bg-slate-50 p-2 text-slate-700 rounded border whitespace-pre-wrap">
                                        {selectedDetail.notes || "Açıklama girilmemiş."}
                                    </p>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

            </CardContent>
        </Card>
    );    
}
