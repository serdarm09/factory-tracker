import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updatePurchaseRequestStatus, createPurchaseRequest, closePurchaseRequestDelivered } from "@/app/actions/raw-material-actions";
import { PurchaseStatus } from "@prisma/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Plus, CheckCircle, PackageSearch, Search, X, Filter, Info, Edit3 } from "lucide-react";
import { useRouter } from "next/navigation";

export function PurchasesTab({ purchaseRequests, rawMaterials, currentUser }: { purchaseRequests: any[]; rawMaterials: any[]; currentUser: { id: number; role?: string } }) {
    const router = useRouter();
    const canOrder = currentUser.role === "ADMIN" || currentUser.role === "PURCHASING";
    const canReceive = currentUser.role === "ADMIN" || currentUser.role === "PURCHASING" || currentUser.role === "RAW_MATERIAL";
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newItem, setNewItem] = useState({ rawMaterialId: "", quantity: 0 });
    const [cart, setCart] = useState<{ rawMaterialId: number, rawMaterialName: string, quantity: number, unit: string }[]>([]);
    const [priority, setPriority] = useState("NORMAL");
    const [notes, setNotes] = useState("");

    // Manuel Talep states
    const [isManualCreateOpen, setIsManualCreateOpen] = useState(false);
    const [manualForm, setManualForm] = useState({ rawMaterialId: "", quantity: "", note: "" });

    // Detay Modal State
    const [selectedDetail, setSelectedDetail] = useState<any | null>(null);

    // Filtre state'leri
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Filtrelenmiş liste
    const filtered = useMemo(() => {
        return purchaseRequests.filter(req => {
            const term = search.toLowerCase();
            const matchSearch = !search ||
                req.creator.username.toLowerCase().includes(term) ||
                (req.notes || "").toLowerCase().includes(term) ||
                req.items.some((it: any) => it.rawMaterial.name.toLowerCase().includes(term));

            const matchStatus = statusFilter === "ALL" || req.status === statusFilter;
            const matchPriority = priorityFilter === "ALL" || req.priority === priorityFilter;

            const reqDate = new Date(req.createdAt);
            const matchFrom = !dateFrom || reqDate >= new Date(dateFrom);
            const matchTo = !dateTo || reqDate <= new Date(dateTo + "T23:59:59");

            return matchSearch && matchStatus && matchPriority && matchFrom && matchTo;
        });
    }, [purchaseRequests, search, statusFilter, priorityFilter, dateFrom, dateTo]);

    const hasActiveFilters = search || statusFilter !== "ALL" || priorityFilter !== "ALL" || dateFrom || dateTo;

    const clearFilters = () => {
        setSearch("");
        setStatusFilter("ALL");
        setPriorityFilter("ALL");
        setDateFrom("");
        setDateTo("");
    };

    const [searchTerm, setSearchTerm] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Manuel Dropdown States
    const [manualSearchTerm, setManualSearchTerm] = useState("");
    const [isManualDropdownOpen, setIsManualDropdownOpen] = useState(false);

    const filteredManualMaterials = useMemo(() => {
        if (!manualSearchTerm) return rawMaterials.slice(0, 50);
        return rawMaterials
            .filter(m => m.name.toLowerCase().includes(manualSearchTerm.toLowerCase()))
            .slice(0, 50);
    }, [rawMaterials, manualSearchTerm]);

    const filteredMaterials = useMemo(() => {
        if (!searchTerm) return rawMaterials.slice(0, 50);
        return rawMaterials
            .filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .slice(0, 50); // limit to 50 for performance
    }, [rawMaterials, searchTerm]);

    const handleCreate = async () => {
        if (cart.length === 0) {
            toast.error("Lütfen satın alınacak en az 1 ürün ekleyin.");
            return;
        }

        const itemsPayload = cart.map(c => ({ rawMaterialId: c.rawMaterialId, quantity: Number(c.quantity) }));
        const res = await createPurchaseRequest(currentUser.id, itemsPayload, priority, notes);

        if (res.success) {
            toast.success("Satın alma talebi oluşturuldu.");
            setIsCreateOpen(false);
            setCart([]);
            setPriority("NORMAL");
            setNotes("");
            router.refresh();
        } else {
            toast.error(res.error);
        }
    };

    const handleManualCreate = async () => {
        if (!manualForm.rawMaterialId || !manualForm.quantity) {
            toast.error("Lütfen ürün seçin ve miktarını girin.");
            return;
        }

        const itemsPayload = [{ rawMaterialId: parseInt(manualForm.rawMaterialId), quantity: Number(manualForm.quantity) }];
        const formattedNote = manualForm.note ? `Sistem Siparişi: ${manualForm.note}` : undefined;
        const res = await createPurchaseRequest(currentUser.id, itemsPayload, "NORMAL", formattedNote);

        if (res.success) {
            toast.success("Sistem üzerinden talep oluşturuldu.");
            setIsManualCreateOpen(false);
            setManualForm({ rawMaterialId: "", quantity: "", note: "" });
            setManualSearchTerm("");
            router.refresh();
        } else {
            toast.error(res.error);
        }
    };

    const handleAddToCart = () => {
        if (!newItem.rawMaterialId || newItem.quantity <= 0) return;
        const mat = rawMaterials.find(m => m.id === Number(newItem.rawMaterialId));
        if (!mat) return;

        setCart([...cart, { rawMaterialId: mat.id, rawMaterialName: mat.name, quantity: newItem.quantity, unit: mat.unit }]);
        setNewItem({ rawMaterialId: "", quantity: 0 });
    };

    const handleMarkOrdered = async (id: number) => {
        const res = await updatePurchaseRequestStatus(id, PurchaseStatus.ORDERED);
        if (res.success) {
            toast.success("Durum güncellendi: Sipariş Verildi.");
            router.refresh();
        } else {
            toast.error(res.error);
        }
    };

    const handleMarkDelivered = async (req: any) => {
        const isRawMaterial = currentUser.role === "RAW_MATERIAL";
        const confirmMsg = isRawMaterial
            ? "Ürünleri depodan teslim aldınız mı? Stok miktarları değiştirilmeyecek, talep sadece kapatılacak."
            : "Ürünleri teslim aldınız mı? Bu işlem stokları otomatik olarak artıracaktır.";
        if (!confirm(confirmMsg)) return;

        let res;
        if (isRawMaterial) {
            // Stok miktarı değiştirmeden sadece kapat
            res = await closePurchaseRequestDelivered(req.id);
        } else {
            const itemsToReceive = req.items.map((it: any) => ({
                rawMaterialId: it.rawMaterialId,
                quantity: it.quantity
            }));
            res = await updatePurchaseRequestStatus(req.id, PurchaseStatus.DELIVERED, itemsToReceive);
        }

        if (res.success) {
            toast.success(isRawMaterial ? "Talep kapatıldı." : "Teslim alındı ve stoklar artırıldı.");
            router.refresh();
        } else {
            toast.error(res.error);
        }
    };

    const getStatusBadge = (status: PurchaseStatus | "CANCELLED") => {
        switch (status) {
            case PurchaseStatus.PENDING: return <Badge variant="outline" className="text-amber-600 border-amber-600">Bekliyor (Onay/Sipariş)</Badge>;
            case PurchaseStatus.ORDERED: return <Badge variant="outline" className="text-blue-600 border-blue-600">Sipariş Verildi</Badge>;
            case PurchaseStatus.DELIVERED: return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-600">Teslim Alındı</Badge>;
            case "CANCELLED": return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-600">İptal Edildi</Badge>;
            default: return <Badge>{status}</Badge>;
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Satın Alma Taleplerim</CardTitle>
                    <CardDescription>Depodaki eksik ürünler için açtığınız satın alma siparişleri.</CardDescription>
                </div>
                <div className="flex gap-2 items-center">
                    {canOrder && (
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={() => setCart([])}>
                                    <Plus className="w-4 h-4 mr-2" /> Yeni Satın Alma
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-xl">
                                <DialogHeader>
                                    <DialogTitle>Yeni Satın Alma Talebi Oluştur</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-12 gap-2 items-end">
                                        <div className="col-span-6">
                                            <Label>Hammadde Ara ve Seç</Label>
                                            <div className="relative mt-1">
                                                <div
                                                    className="flex items-center border rounded-md px-3 py-2 bg-white cursor-text"
                                                    onClick={() => setIsDropdownOpen(true)}
                                                >
                                                    <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                                                    <input
                                                        type="text"
                                                        className="w-full outline-none text-sm bg-transparent"
                                                        placeholder="Malzeme adı (Örn: Sünger, Vida...)"
                                                        value={searchTerm}
                                                        onChange={e => {
                                                            setSearchTerm(e.target.value);
                                                            setIsDropdownOpen(true);
                                                            setNewItem({ ...newItem, rawMaterialId: "" }); // Reset internal selection when typing
                                                        }}
                                                        onFocus={() => setIsDropdownOpen(true)}
                                                    />
                                                    {searchTerm && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setSearchTerm(""); setNewItem({ ...newItem, rawMaterialId: "" }); }}
                                                            className="text-slate-400 hover:text-slate-600"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Dropdown Menu */}
                                                {isDropdownOpen && (
                                                    <>
                                                        <div
                                                            className="fixed inset-0 z-40"
                                                            onClick={() => setIsDropdownOpen(false)}
                                                        />
                                                        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                                                            {filteredMaterials.length === 0 ? (
                                                                <div className="p-3 text-sm text-slate-500 text-center">Sonuç bulunamadı.</div>
                                                            ) : (
                                                                filteredMaterials.map(m => (
                                                                    <div
                                                                        key={m.id}
                                                                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 ${newItem.rawMaterialId === m.id.toString() ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"}`}
                                                                        onClick={() => {
                                                                            setNewItem({ ...newItem, rawMaterialId: m.id.toString() });
                                                                            setSearchTerm(m.name);
                                                                            setIsDropdownOpen(false);
                                                                        }}
                                                                    >
                                                                        {m.name} <span className="text-slate-400 text-xs ml-1">({m.quantity} {m.unit} var)</span>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="col-span-3">
                                            <Label>Miktar</Label>
                                            <Input type="number" step="0.01" value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: Number(e.target.value) })} />
                                        </div>
                                        <div className="col-span-3">
                                            <Button type="button" variant="secondary" className="w-full" onClick={handleAddToCart}>Listeye Ekle</Button>
                                        </div>
                                    </div>

                                    {cart.length > 0 && (
                                        <div className="p-3 bg-slate-50 border rounded-md text-sm">
                                            <strong className="block mb-2 text-slate-700">Talep Listesi:</strong>
                                            <ul className="space-y-1">
                                                {cart.map((c, i) => (
                                                    <li key={i} className="flex justify-between border-b pb-1 last:border-b-0">
                                                        <span>{c.rawMaterialName}</span>
                                                        <span className="font-mono font-bold">{c.quantity} {c.unit}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div>
                                        <Label>Öncelik</Label>
                                        <Select value={priority} onValueChange={setPriority}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="NORMAL">Normal</SelectItem>
                                                <SelectItem value="URGENT">Acil (Kritik Stok)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label>Notlar (Opsiyonel)</Label>
                                        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Örn: X firmasından alınacak" />
                                    </div>

                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>İptal</Button>
                                    <Button onClick={handleCreate} disabled={cart.length === 0}>Oluştur</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}

                    {currentUser.role === "RAW_MATERIAL" && (
                        <Button onClick={() => setIsManualCreateOpen(true)} className="bg-amber-600 hover:bg-amber-700">
                            <Edit3 className="w-4 h-4 mr-2" /> Manuel Talep
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {/* Filtre Satırı */}
                <div className="flex flex-wrap gap-2 mb-4 items-end">
                    {/* Arama */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Malzeme adı, kullanıcı veya not ara..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {/* Durum Filtresi */}
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Durum" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Tüm Durumlar</SelectItem>
                            <SelectItem value={PurchaseStatus.PENDING}>Bekliyor</SelectItem>
                            <SelectItem value={PurchaseStatus.ORDERED}>Sipariş Verildi</SelectItem>
                            <SelectItem value={PurchaseStatus.DELIVERED}>Teslim Alındı</SelectItem>
                            <SelectItem value={"CANCELLED"}>İptal Edildi</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Öncelik Filtresi */}
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Öncelik" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Tüm Öncelikler</SelectItem>
                            <SelectItem value="URGENT">🔴 Acil</SelectItem>
                            <SelectItem value="NORMAL">Normal</SelectItem>
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
                    {filtered.length} / {purchaseRequests.length} talep gösteriliyor
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tarih</TableHead>
                            <TableHead>Öncelik</TableHead>
                            <TableHead>İstenen Kalemler</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead>Termin</TableHead>
                            <TableHead>Oluşturan</TableHead>
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
                                <TableCell className="whitespace-nowrap">{format(new Date(req.createdAt), 'dd MMM yyyy', { locale: tr })}</TableCell>
                                <TableCell>
                                    {req.priority === "URGENT" ? <Badge variant="destructive">ACİL</Badge> : <Badge variant="secondary">Normal</Badge>}
                                </TableCell>
                                <TableCell>
                                    <ul className="text-sm">
                                        {req.items.map((it: any) => (
                                            <li key={it.id}>• {it.quantity} {it.rawMaterial.unit} {it.rawMaterial.name}</li>
                                        ))}
                                    </ul>
                                    {req.notes && <div className="text-xs text-slate-500 mt-1 italic">Not: {req.notes}</div>}
                                </TableCell>
                                <TableCell>{getStatusBadge(req.status)}</TableCell>
                                <TableCell>
                                    {req.termDate ? (
                                        <span className={`text-sm font-medium ${new Date(req.termDate) < new Date() && req.status !== "DELIVERED"
                                                ? "text-red-600" : "text-slate-700"
                                            }`}>
                                            {format(new Date(req.termDate), 'dd MMM yyyy', { locale: tr })}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 text-xs italic">Girilmedi</span>
                                    )}
                                </TableCell>
                                <TableCell>{req.creator.username}</TableCell>
                                <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                                    <div className="flex justify-end gap-2">
                                        {canOrder && req.status === PurchaseStatus.PENDING && (
                                            <Button size="sm" variant="outline" onClick={() => handleMarkOrdered(req.id)}>
                                                <PackageSearch className="w-4 h-4 mr-1" /> Sipariş Verildi Yap
                                            </Button>
                                        )}
                                        {canReceive && req.status === PurchaseStatus.ORDERED && req.termDate && (
                                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleMarkDelivered(req)}>
                                                <CheckCircle className="w-4 h-4 mr-1" /> Teslim Al
                                            </Button>
                                        )}
                                        {canReceive && req.status === PurchaseStatus.ORDERED && !req.termDate && (
                                            <span className="text-xs text-amber-600 italic">Satın Alma termin girecek</span>
                                        )}
                                        {!canOrder && !canReceive && req.status !== PurchaseStatus.DELIVERED && (
                                            <span className="text-xs text-slate-400 italic">Satın Alma departmanı işler</span>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-slate-500 py-6">
                                    {hasActiveFilters ? "Filtreyle eşleşen talep bulunamadı." : "Kayıtlı satın alma talebi bulunmamaktadır."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>

            {/* Manuel Talep Modal (RAW_MATERIAL User) */}
            <Dialog open={isManualCreateOpen} onOpenChange={setIsManualCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Sistemden Satın Alma Talebi Oluştur</DialogTitle>
                        <DialogDescription>
                            Aşağıdan istediğiniz hammaddeyi seçip ihtiyacınız olan miktarı ve açıklamayı ekleyebilirsiniz.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <Label>Hammadde Seçin *</Label>
                            <div className="relative mt-1">
                                <div
                                    className="flex items-center border rounded-md px-3 py-2 bg-white cursor-text"
                                    onClick={() => setIsManualDropdownOpen(true)}
                                >
                                    <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                                    <input
                                        type="text"
                                        className="w-full outline-none text-sm bg-transparent"
                                        placeholder="Sistemdeki hammaddeler... (Arayın)"
                                        value={manualSearchTerm}
                                        onChange={e => {
                                            setManualSearchTerm(e.target.value);
                                            setIsManualDropdownOpen(true);
                                            setManualForm(m => ({ ...m, rawMaterialId: "" }));
                                        }}
                                        onFocus={() => setIsManualDropdownOpen(true)}
                                    />
                                    {manualSearchTerm && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setManualSearchTerm(""); setManualForm(m => ({ ...m, rawMaterialId: "" })); }}
                                            className="text-slate-400 hover:text-slate-600"
                                            type="button"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Dropdown Menu */}
                                {isManualDropdownOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setIsManualDropdownOpen(false)}
                                        />
                                        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                                            {filteredManualMaterials.length === 0 ? (
                                                <div className="p-3 text-sm text-slate-500 text-center">Sonuç bulunamadı.</div>
                                            ) : (
                                                filteredManualMaterials.map(m => (
                                                    <div
                                                        key={m.id}
                                                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 ${manualForm.rawMaterialId === String(m.id) ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"}`}
                                                        onClick={() => {
                                                            setManualForm(curr => ({ ...curr, rawMaterialId: String(m.id) }));
                                                            setManualSearchTerm(m.name);
                                                            setIsManualDropdownOpen(false);
                                                        }}
                                                    >
                                                        {m.name} <span className="text-slate-400 text-xs ml-1">({m.quantity} {m.unit} var)</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div>
                            <Label>Miktar *</Label>
                            <Input
                                type="number"
                                step="any"
                                value={manualForm.quantity}
                                onChange={e => setManualForm(m => ({ ...m, quantity: e.target.value }))}
                                placeholder="Sadece sayı girin (Örn: 50)"
                            />
                        </div>
                        <div>
                            <Label>Ek Notlar</Label>
                            <Input
                                value={manualForm.note}
                                onChange={e => setManualForm(m => ({ ...m, note: e.target.value }))}
                                placeholder="Örn: Pazartesiye kadar lazım"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsManualCreateOpen(false)}>İptal</Button>
                        <Button onClick={handleManualCreate} className="bg-amber-600 hover:bg-amber-700">Talebi İlet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detay Modal */}
            <Dialog open={!!selectedDetail} onOpenChange={open => !open && setSelectedDetail(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Info className="w-5 h-5 text-blue-600" />
                            Satın Alma Talebi Detayı
                        </DialogTitle>
                    </DialogHeader>
                    {selectedDetail && (
                        <div className="space-y-4 pt-4">
                            <div className="grid grid-cols-3 gap-2 border-b pb-2 text-sm">
                                <strong className="text-slate-500">Tarih:</strong>
                                <span className="col-span-2">{format(new Date(selectedDetail.createdAt), 'dd MMMM yyyy HH:mm', { locale: tr })}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 border-b pb-2 text-sm">
                                <strong className="text-slate-500">Oluşturan:</strong>
                                <span className="col-span-2">{selectedDetail.creator?.username}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 border-b pb-2 text-sm">
                                <strong className="text-slate-500">Öncelik:</strong>
                                <span className="col-span-2">{selectedDetail.priority === "URGENT" ? "ACİL" : "Normal"}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 border-b pb-2 text-sm">
                                <strong className="text-slate-500">Durum:</strong>
                                <span className="col-span-2">{getStatusBadge(selectedDetail.status)}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 border-b pb-2 text-sm">
                                <strong className="text-slate-500">Termin Tarihi:</strong>
                                <span className="col-span-2">
                                    {selectedDetail.termDate
                                        ? format(new Date(selectedDetail.termDate), 'dd MMMM yyyy (EEEE)', { locale: tr })
                                        : "Girilmedi"
                                    }
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 border-b pb-2 text-sm">
                                <strong className="text-slate-500">İstenen Kalemler:</strong>
                                <div className="col-span-2">
                                    {selectedDetail.items && selectedDetail.items.length > 0 ? (
                                        <ul className="list-disc pl-4 space-y-1">
                                            {selectedDetail.items.map((it: any) => (
                                                <li key={it.id}>{it.quantity} {it.rawMaterial?.unit} {it.rawMaterial?.name}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <span className="text-slate-400 italic">Manuel Talep (Kalem yok)</span>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-2 text-sm">
                                <strong className="text-slate-500">Not / Açıklama:</strong>
                                <p className="col-span-2 bg-slate-50 p-2 rounded border whitespace-pre-wrap">
                                    {selectedDetail.notes || "Not bulunmuyor."}
                                </p>
                            </div>
                            {selectedDetail.orderNotes && (
                                <div className="grid grid-cols-3 gap-2 pt-2 text-sm">
                                    <strong className="text-slate-500">Satınalma Notu:</strong>
                                    <p className="col-span-2 bg-blue-50 p-2 rounded border border-blue-100 text-blue-800 whitespace-pre-wrap">
                                        {selectedDetail.orderNotes}
                                    </p>
                                </div>
                            )}
                            {selectedDetail.cancelReason && (
                                <div className="grid grid-cols-3 gap-2 pt-2 text-sm">
                                    <strong className="text-red-500">İptal Nedeni:</strong>
                                    <p className="col-span-2 bg-red-50 p-2 rounded border border-red-100 text-red-800 whitespace-pre-wrap">
                                        {selectedDetail.cancelReason}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

        </Card>
    );
}
