"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "sonner";
import {
  RefreshCw,
  Database,
  Package,
  CheckCircle,
  AlertCircle,
  Download,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Filter,
  X,
  Search,
  Calendar,
} from "lucide-react";
import {
  checkNetSimConnection,
  connectNetSim,
  getNetSimOrders,
  getNetSimOrderDetails,
  importNetSimOrder,
  importMultipleNetSimOrders,
} from "@/lib/netsim-actions";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NetSimOrder {
  ALISSATIS_NO: number;
  TAKIP_NO: string | null;
  ISLEM_KODU: string;
  ISLEM_ADI: string;
  TARIH: string;
  TESLIM_TARIHI: string | null;
  DURUM: string | null;
  CARI_NO: number;
  CARI_UNVANI?: string;
  GENEL_TOPLAM: number;
  DOVIZ_BIRIMI: string;
  ONAYLANDI: string;
  KAPANDI: string;
  ACIKLAMA: string | null;
  PERSONEL_NO: number;
}

interface NetSimOrderDetail {
  ALISSATIS_DETAY_NO: number;
  ALISSATIS_NO: number;
  SIRA_NO: number;
  STOK_NO: number;
  STOK_ADI: string;
  STOK_KODU?: string;
  MIKTAR: number;
  BIRIM: string;
  BIRIM_FIYAT: number;
  SATIR_TOPLAMI: number;
  SATIR_DURUM: string | null;
  ACIKLAMA: string | null;
  ACIKLAMA1: string | null;
  ACIKLAMA2: string | null;
  ACIKLAMA3: string | null;
  ACIKLAMA4: string | null;
  DSTOK_NO?: number;
  DST_ADI?: string | null;
}

export default function NetSimPage() {
  const { data: session } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [orders, setOrders] = useState<NetSimOrder[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
  const [orderDetails, setOrderDetails] = useState<NetSimOrderDetail[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<NetSimOrder | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importedOrderIds, setImportedOrderIds] = useState<Set<string>>(new Set());

  // Pagination state'leri
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filter state'leri
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterOrderNo, setFilterOrderNo] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);
  const [filterDeliveryFrom, setFilterDeliveryFrom] = useState<Date | undefined>(undefined);
  const [filterDeliveryTo, setFilterDeliveryTo] = useState<Date | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterOnlyOpen, setFilterOnlyOpen] = useState(false);
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [filterMaxAmount, setFilterMaxAmount] = useState("");

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    const status = await checkNetSimConnection();
    setIsConnected(status.isConnected);
    if (status.isConnected) {
      loadOrders(1, pageSize);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const result = await connectNetSim("MARISITTEST.FDB");
      if (result.isConnected) {
        setIsConnected(true);
        toast.success(`Baglanti basarili! ${result.tableCount} tablo bulundu.`);
        loadOrders(1, pageSize);
      } else {
        toast.error(result.errorMessage || "Baglanti kurulamadi");
      }
    } catch (error) {
      toast.error("Baglanti hatasi");
    } finally {
      setIsConnecting(false);
    }
  };

  const loadOrders = async (page: number = currentPage, size: number = pageSize) => {
    setIsLoading(true);
    try {
      const offset = (page - 1) * size;
      const result = await getNetSimOrders({ limit: size, offset, onlyOpen: false });
      if (result.success) {
        setOrders(result.orders);
        setTotalCount(result.totalCount);
        setTotalPages(result.totalPages);
        setCurrentPage(page);
        setPageSize(size);
        // Aktarılmış siparişleri kaydet
        if (result.importedOrderIds) {
          setImportedOrderIds(new Set(result.importedOrderIds.filter((id): id is string => id !== null)));
        }
      } else {
        toast.error(result.error || "Siparisler yuklenemedi");
      }
    } catch (error) {
      toast.error("Siparisler yuklenirken hata olustu");
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrderDetails = async (order: NetSimOrder) => {
    setSelectedOrder(order);
    const result = await getNetSimOrderDetails(order.ALISSATIS_NO);
    if (result.success) {
      setOrderDetails(result.details);
    }
  };

  const handleSelectOrder = (orderId: number) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map((o) => o.ALISSATIS_NO)));
    }
  };

  const handleImportSingle = async (order: NetSimOrder) => {
    if (!session?.user?.id) {
      toast.error("Oturum bilgisi bulunamadi");
      return;
    }

    setIsImporting(true);
    try {
      const detailsResult = await getNetSimOrderDetails(order.ALISSATIS_NO);
      if (!detailsResult.success) {
        toast.error("Siparis detaylari alinamadi");
        return;
      }

      const result = await importNetSimOrder(
        order,
        detailsResult.details,
        session.user.id
      );

      if (result.success) {
        toast.success(`Siparis aktarildi! ${result.productCount} urun eklendi.`);
        loadOrders();
      } else {
        toast.error(result.error || "Aktarma basarisiz");
      }
    } catch (error) {
      toast.error("Aktarma sirasinda hata olustu");
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportSelected = async () => {
    if (!session?.user?.id) {
      toast.error("Oturum bilgisi bulunamadi");
      return;
    }

    if (selectedOrders.size === 0) {
      toast.warning("Lutfen siparis secin");
      return;
    }

    setIsImporting(true);
    try {
      const results = await importMultipleNetSimOrders(
        Array.from(selectedOrders),
        session.user.id
      );

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      if (successful > 0) {
        toast.success(`${successful} siparis aktarildi`);
      }
      if (failed > 0) {
        toast.error(`${failed} siparis aktarilamadi`);
      }

      setSelectedOrders(new Set());
      loadOrders();
    } catch (error) {
      toast.error("Toplu aktarma sirasinda hata olustu");
    } finally {
      setIsImporting(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = "TL") => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: currency === "TL" ? "TRY" : currency,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd MMM yyyy", { locale: tr });
    } catch {
      return dateStr;
    }
  };

  // Client-side filtering
  const filteredOrders = orders.filter((order) => {
    // Customer filter
    if (filterCustomer) {
      const customerName = (order.CARI_UNVANI || "").toLowerCase();
      if (!customerName.includes(filterCustomer.toLowerCase())) {
        return false;
      }
    }

    // Order number filter
    if (filterOrderNo) {
      const orderNo = (order.TAKIP_NO || order.ALISSATIS_NO.toString()).toLowerCase();
      if (!orderNo.includes(filterOrderNo.toLowerCase())) {
        return false;
      }
    }

    // Order date from filter
    if (filterDateFrom) {
      const orderDate = new Date(order.TARIH);
      if (orderDate < filterDateFrom) return false;
    }

    // Order date to filter
    if (filterDateTo) {
      const orderDate = new Date(order.TARIH);
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      if (orderDate > toDate) return false;
    }

    // Delivery date from filter
    if (filterDeliveryFrom && order.TESLIM_TARIHI) {
      const deliveryDate = new Date(order.TESLIM_TARIHI);
      if (deliveryDate < filterDeliveryFrom) return false;
    }

    // Delivery date to filter
    if (filterDeliveryTo && order.TESLIM_TARIHI) {
      const deliveryDate = new Date(order.TESLIM_TARIHI);
      const toDate = new Date(filterDeliveryTo);
      toDate.setHours(23, 59, 59, 999);
      if (deliveryDate > toDate) return false;
    }

    // Status filter
    if (filterStatus !== "all") {
      if (filterStatus === "open" && order.KAPANDI !== "H") return false;
      if (filterStatus === "closed" && order.KAPANDI !== "E") return false;
      if (filterStatus === "approved" && order.ONAYLANDI !== "E") return false;
      if (filterStatus === "pending" && order.ONAYLANDI !== "H") return false;
    }

    // Only open filter
    if (filterOnlyOpen && order.KAPANDI !== "H") {
      return false;
    }

    // Min amount filter
    if (filterMinAmount) {
      const minAmount = parseFloat(filterMinAmount);
      if (!isNaN(minAmount) && order.GENEL_TOPLAM < minAmount) {
        return false;
      }
    }

    // Max amount filter
    if (filterMaxAmount) {
      const maxAmount = parseFloat(filterMaxAmount);
      if (!isNaN(maxAmount) && order.GENEL_TOPLAM > maxAmount) {
        return false;
      }
    }

    return true;
  });

  // Check if any filter is active
  const hasActiveFilters = filterCustomer || filterOrderNo || filterDateFrom || filterDateTo ||
    filterDeliveryFrom || filterDeliveryTo || filterStatus !== "all" || filterOnlyOpen ||
    filterMinAmount || filterMaxAmount;

  // Clear all filters
  const clearFilters = () => {
    setFilterCustomer("");
    setFilterOrderNo("");
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
    setFilterDeliveryFrom(undefined);
    setFilterDeliveryTo(undefined);
    setFilterStatus("all");
    setFilterOnlyOpen(false);
    setFilterMinAmount("");
    setFilterMaxAmount("");
  };

  // Get unique customers for suggestions
  const uniqueCustomers = [...new Set(orders.map(o => o.CARI_UNVANI).filter(Boolean))].sort();

  if (!isConnected) {
    return (
      <div className="container mx-auto py-10">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-6 w-6" />
              NetSim Baglantisi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              NetSim veritabanina baglanarak siparisleri Marisit ERP'a
              aktarabilirsiniz.
            </p>
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Baglaniyor...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  NetSim'e Baglan
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">NetSim Siparisleri</h1>
          <p className="text-muted-foreground">
            Alinan siparisleri planlamaya aktarin
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/netsim/recete">
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Receteler
            </Button>
          </Link>
          <Link href="/dashboard/netsim/tablolar">
            <Button variant="outline">
              <Database className="mr-2 h-4 w-4" />
              Tablolar
            </Button>
          </Link>
          <Button variant="outline" onClick={() => loadOrders()} disabled={isLoading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Yenile
          </Button>
          {selectedOrders.size > 0 && (
            <Button onClick={handleImportSelected} disabled={isImporting}>
              {isImporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Secilenleri Aktar ({selectedOrders.size})
            </Button>
          )}
        </div>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtreler
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Temizle
                </Button>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="onlyOpen"
                  checked={filterOnlyOpen}
                  onCheckedChange={(checked) => setFilterOnlyOpen(checked === true)}
                />
                <label htmlFor="onlyOpen" className="text-sm cursor-pointer">
                  Sadece Açık Siparişler
                </label>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: Text Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Order Number */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Sipariş No</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Takip no veya sipariş no..."
                  value={filterOrderNo}
                  onChange={(e) => setFilterOrderNo(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Customer */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Müşteri</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Müşteri adı ara..."
                  value={filterCustomer}
                  onChange={(e) => setFilterCustomer(e.target.value)}
                  className="pl-8"
                  list="customers"
                />
                <datalist id="customers">
                  {uniqueCustomers.map((customer, i) => (
                    <option key={i} value={customer} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Durum</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Tüm durumlar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Durumlar</SelectItem>
                  <SelectItem value="open">Açık Siparişler</SelectItem>
                  <SelectItem value="closed">Kapalı Siparişler</SelectItem>
                  <SelectItem value="approved">Onaylı Siparişler</SelectItem>
                  <SelectItem value="pending">Onay Bekleyenler</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount Range */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tutar Aralığı (₺)</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filterMinAmount}
                  onChange={(e) => setFilterMinAmount(e.target.value)}
                  className="w-1/2"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filterMaxAmount}
                  onChange={(e) => setFilterMaxAmount(e.target.value)}
                  className="w-1/2"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Date Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Order Date From */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Sipariş Tarihi (Başlangıç)
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filterDateFrom && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {filterDateFrom ? format(filterDateFrom, "dd.MM.yyyy") : "gg.aa.yyyy"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={filterDateFrom}
                    onSelect={setFilterDateFrom}
                    locale={tr}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Order Date To */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Sipariş Tarihi (Bitiş)
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filterDateTo && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {filterDateTo ? format(filterDateTo, "dd.MM.yyyy") : "gg.aa.yyyy"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={filterDateTo}
                    onSelect={setFilterDateTo}
                    locale={tr}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Delivery Date From */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Teslim Tarihi (Başlangıç)
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filterDeliveryFrom && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {filterDeliveryFrom ? format(filterDeliveryFrom, "dd.MM.yyyy") : "gg.aa.yyyy"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={filterDeliveryFrom}
                    onSelect={setFilterDeliveryFrom}
                    locale={tr}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Delivery Date To */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Teslim Tarihi (Bitiş)
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filterDeliveryTo && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {filterDeliveryTo ? format(filterDeliveryTo, "dd.MM.yyyy") : "gg.aa.yyyy"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={filterDeliveryTo}
                    onSelect={setFilterDeliveryTo}
                    locale={tr}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-4 border-t">
              <span className="text-sm text-muted-foreground">Aktif filtreler:</span>
              {filterOrderNo && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Sipariş No: {filterOrderNo}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterOrderNo("")} />
                </Badge>
              )}
              {filterCustomer && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Müşteri: {filterCustomer}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterCustomer("")} />
                </Badge>
              )}
              {filterStatus !== "all" && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Durum: {filterStatus === "open" ? "Açık" : filterStatus === "closed" ? "Kapalı" : filterStatus === "approved" ? "Onaylı" : "Bekleyen"}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterStatus("all")} />
                </Badge>
              )}
              {filterOnlyOpen && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Sadece Açık
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterOnlyOpen(false)} />
                </Badge>
              )}
              {filterDateFrom && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Sipariş: {format(filterDateFrom, "dd.MM.yyyy")}+
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterDateFrom(undefined)} />
                </Badge>
              )}
              {filterDateTo && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Sipariş: -{format(filterDateTo, "dd.MM.yyyy")}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterDateTo(undefined)} />
                </Badge>
              )}
              {filterDeliveryFrom && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Teslim: {format(filterDeliveryFrom, "dd.MM.yyyy")}+
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterDeliveryFrom(undefined)} />
                </Badge>
              )}
              {filterDeliveryTo && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Teslim: -{format(filterDeliveryTo, "dd.MM.yyyy")}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterDeliveryTo(undefined)} />
                </Badge>
              )}
              {filterMinAmount && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Min: ₺{filterMinAmount}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterMinAmount("")} />
                </Badge>
              )}
              {filterMaxAmount && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Max: ₺{filterMaxAmount}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterMaxAmount("")} />
                </Badge>
              )}
              <Badge variant="outline" className="ml-auto">
                {filteredOrders.length} / {orders.length} sipariş
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Toplam Siparis
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground">
              Sayfa {currentPage}/{totalPages} ({orders.length} kayit)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {hasActiveFilters ? "Filtrelenmiş" : "Görüntülenen"}
            </CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredOrders.length}</div>
            <p className="text-xs text-muted-foreground">
              {hasActiveFilters ? "Filtre uygulandı" : "Bu sayfada"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Secili</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedOrders.size}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {hasActiveFilters ? "Filtrelenen Tutar" : "Toplam Tutar"}
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                filteredOrders.reduce((sum, o) => sum + o.GENEL_TOPLAM, 0)
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Alinan Siparisler</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      selectedOrders.size === filteredOrders.length && filteredOrders.length > 0
                    }
                    onCheckedChange={() => {
                      if (selectedOrders.size === filteredOrders.length) {
                        setSelectedOrders(new Set());
                      } else {
                        setSelectedOrders(new Set(filteredOrders.map((o) => o.ALISSATIS_NO)));
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Siparis No</TableHead>
                <TableHead>Musteri</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Teslim</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
                <TableHead className="w-24">Islemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
                const isImported = importedOrderIds.has(`NETSIM-${order.ALISSATIS_NO}`);
                return (
                <TableRow
                  key={order.ALISSATIS_NO}
                  className={isImported ? "bg-blue-50 hover:bg-blue-100" : ""}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedOrders.has(order.ALISSATIS_NO)}
                      onCheckedChange={() =>
                        handleSelectOrder(order.ALISSATIS_NO)
                      }
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {order.TAKIP_NO || order.ALISSATIS_NO}
                      {isImported && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[10px]">
                          Aktarıldı
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate">
                      {order.CARI_UNVANI || `Cari: ${order.CARI_NO}`}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(order.TARIH)}</TableCell>
                  <TableCell>{formatDate(order.TESLIM_TARIHI)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Badge
                        variant={order.KAPANDI === "H" ? "default" : "secondary"}
                        className={order.KAPANDI === "H" ? "bg-green-100 text-green-700" : ""}
                      >
                        {order.KAPANDI === "H" ? "Açık" : "Kapalı"}
                      </Badge>
                      {order.ONAYLANDI === "E" && (
                        <Badge variant="outline" className="text-blue-600 border-blue-300">
                          Onaylı
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(order.GENEL_TOPLAM, order.DOVIZ_BIRIMI)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadOrderDetails(order)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-6xl max-h-[80vh] overflow-auto">
                          <DialogHeader>
                            <DialogTitle>
                              Siparis Detayi - {selectedOrder?.ALISSATIS_NO}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm p-4 bg-muted rounded-lg">
                              <div>
                                <span className="text-muted-foreground">
                                  Musteri:
                                </span>{" "}
                                <span className="font-medium">{selectedOrder?.CARI_UNVANI}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">
                                  Siparis Tarihi:
                                </span>{" "}
                                <span className="font-medium">{formatDate(selectedOrder?.TARIH || null)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">
                                  Teslim Tarihi:
                                </span>{" "}
                                <span className="font-medium">{formatDate(selectedOrder?.TESLIM_TARIHI || null)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">
                                  Toplam:
                                </span>{" "}
                                <span className="font-medium">{formatCurrency(selectedOrder?.GENEL_TOPLAM || 0)}</span>
                              </div>
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Urun</TableHead>
                                  <TableHead>Kod</TableHead>
                                  <TableHead className="text-right">
                                    Miktar
                                  </TableHead>
                                  <TableHead className="text-right">
                                    Fiyat
                                  </TableHead>
                                  <TableHead className="text-right">
                                    Toplam
                                  </TableHead>
                                  <TableHead>Açıklama 1</TableHead>
                                  <TableHead>Açıklama 2</TableHead>
                                  <TableHead>Açıklama 3</TableHead>
                                  <TableHead>Açıklama 4</TableHead>
                                  <TableHead>Renk</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {orderDetails.map((detail) => (
                                  <TableRow key={detail.ALISSATIS_DETAY_NO}>
                                    <TableCell>{detail.STOK_ADI}</TableCell>
                                    <TableCell>{detail.STOK_KODU}</TableCell>
                                    <TableCell className="text-right">
                                      {detail.MIKTAR} {detail.BIRIM}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatCurrency(detail.BIRIM_FIYAT)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatCurrency(detail.SATIR_TOPLAMI)}
                                    </TableCell>
                                    <TableCell className="max-w-[150px] truncate" title={detail.ACIKLAMA1 || ""}>
                                      {detail.ACIKLAMA1 || "-"}
                                    </TableCell>
                                    <TableCell className="max-w-[150px] truncate" title={detail.ACIKLAMA2 || ""}>
                                      {detail.ACIKLAMA2 || "-"}
                                    </TableCell>
                                    <TableCell className="max-w-[150px] truncate" title={detail.ACIKLAMA3 || ""}>
                                      {detail.ACIKLAMA3 || "-"}
                                    </TableCell>
                                    <TableCell className="max-w-[150px] truncate" title={detail.ACIKLAMA4 || ""}>
                                      {detail.ACIKLAMA4 || "-"}
                                    </TableCell>
                                    <TableCell className="max-w-[150px] truncate" title={detail.DST_ADI || ""}>
                                      {detail.DST_ADI || "-"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            <div className="flex justify-end gap-2 pt-4 border-t">
                              <Button
                                size="lg"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() =>
                                  selectedOrder &&
                                  handleImportSingle(selectedOrder)
                                }
                                disabled={isImporting}
                              >
                                {isImporting ? (
                                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                ) : (
                                  <Download className="mr-2 h-5 w-5" />
                                )}
                                Planlamaya Aktar
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleImportSingle(order)}
                        disabled={isImporting}
                      >
                      <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
              {filteredOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Yukleniyor...
                      </div>
                    ) : hasActiveFilters ? (
                      <div className="space-y-2">
                        <p>Filtrelere uygun sipariş bulunamadı</p>
                        <Button variant="outline" size="sm" onClick={clearFilters}>
                          <X className="h-4 w-4 mr-1" />
                          Filtreleri Temizle
                        </Button>
                      </div>
                    ) : (
                      "Siparis bulunamadi"
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 0 && (
            <div className="flex items-center justify-between px-2 py-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Sayfa basina:</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    const newSize = parseInt(value);
                    setPageSize(newSize);
                    loadOrders(1, newSize);
                  }}
                >
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
                <span>
                  Toplam {totalCount} kayit
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadOrders(1)}
                  disabled={currentPage === 1 || isLoading}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadOrders(currentPage - 1)}
                  disabled={currentPage === 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1 mx-2">
                  <span className="text-sm">
                    Sayfa {currentPage} / {totalPages}
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadOrders(currentPage + 1)}
                  disabled={currentPage === totalPages || isLoading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadOrders(totalPages)}
                  disabled={currentPage === totalPages || isLoading}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
