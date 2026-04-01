'use client';

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Calendar, Package, AlertTriangle, Building2, User, Send, ChevronLeft, ChevronRight, List, Users, CalendarIcon, Edit, Filter, Clock, Download, X, Wrench, Factory, Loader2, Search, TrendingUp, Truck, Trash2 } from "lucide-react";
import { format, isBefore, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, addWeeks, subWeeks, parseISO, startOfDay } from "date-fns";
import { tr } from "date-fns/locale";
import { sendProductsToProduction, updateProductionDate, updateProductStatus, deleteProduct, updateProductStages } from "@/lib/actions/product-actions";
import { shipProduct } from "@/lib/actions/shipment-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import { SendToSemiFinishedDialog } from "./send-to-semi-finished-dialog";

interface Product {
    id: number;
    name: string;
    model: string;
    systemCode: string;
    quantity: number;
    produced?: number;
    status: string;
    subStatus?: string | null;
    terminDate: string | Date | null;
    productionDate?: string | Date | null;
    orderDate?: string | Date | null;
    master?: string | null;
    description?: string | null;
    material?: string | null;
    footType?: string | null;
    footMaterial?: string | null;
    armType?: string | null;
    backType?: string | null;
    fabricType?: string | null;
    foamQty?: number;
    upholsteryQty?: number;
    assemblyQty?: number;
    packagedQty?: number;
    storedQty?: number;
    storedDate?: string | Date | null;
    shippedQty?: number;
    shippedDate?: string | Date | null;
    engineerNote?: string | null;
    unitPrice?: number | null;
    totalPrice?: number | null;
    aciklama1?: string | null;
    aciklama2?: string | null;
    aciklama3?: string | null;
    aciklama4?: string | null;
    dstAdi?: string | null;
    marketingDescription?: string | null;
    order?: {
        company: string;
        name: string;
        customerName?: string | null;
        deliveryDate?: string | Date | null;
        totalAmount?: number | null;
        currency?: string | null;
        externalId?: string | null;
    } | null;
}

interface ProductionCalendarProps {
    products: Product[];
    userRole: string;
}

const STATUS_COLORS: Record<string, string> = {
    "APPROVED": "bg-blue-500",
    "IN_PRODUCTION": "bg-purple-500",
    "COMPLETED": "bg-green-600",
    "DEPODA": "bg-green-500",
    "SEVK": "bg-teal-500",
    "KISMI_SEVK": "bg-cyan-500",
    "SUNGERDE": "bg-violet-500",
    "DOSEMEDE": "bg-yellow-500",
    "MONTAJDA": "bg-orange-500",
    "PAKETLENDI": "bg-blue-600",
};

// Tarih parse fonksiyonu - timezone sorunlarını önlemek için
const parseDate = (date: string | Date | null): Date | null => {
    if (!date) return null;
    if (date instanceof Date) return startOfDay(date);

    // ISO string ise parseISO kullan
    try {
        const parsed = parseISO(date.toString());
        return startOfDay(parsed);
    } catch {
        return null;
    }
};

const STATUS_LABELS: Record<string, string> = {
    "APPROVED": "Onaylandı",
    "IN_PRODUCTION": "Üretimde",
    "COMPLETED": "Tamamlandı",
    "DEPODA": "Depoda",
    "SEVK": "Sevk Edildi",
    "KISMI_SEVK": "Kısmi Sevk",
    "SUNGERDE": "Süngerde",
    "DOSEMEDE": "Döşemede",
    "MONTAJDA": "Montajda",
    "PAKETLENDI": "Paketlendi",
};

// Ürünün gerçek durumunu hesapla
const getProductRealStatus = (product: Product): string => {
    // Önce sevk durumunu kontrol et
    if (product.shippedQty && product.shippedQty > 0) {
        if (product.shippedQty >= product.quantity) {
            return "SEVK"; // Tümü sevk edildi
        } else {
            return "KISMI_SEVK"; // Kısmi sevk
        }
    }

    // Depoda mı?
    if (product.storedQty && product.storedQty > 0) {
        return "DEPODA";
    }

    // Üretimdeyse alt durumu kontrol et
    if (product.status === "IN_PRODUCTION") {
        if (product.subStatus) {
            // subStatus'u normalize et
            if (product.subStatus.includes("Sünger")) return "SUNGERDE";
            if (product.subStatus.includes("Döşeme")) return "DOSEMEDE";
            if (product.subStatus.includes("Montaj")) return "MONTAJDA";
            if (product.subStatus.includes("Paket")) return "PAKETLENDI";
        }
        return "IN_PRODUCTION";
    }

    // Diğer durumlar
    return product.status;
};

export function ProductionCalendar({ products, userRole }: ProductionCalendarProps) {
    const router = useRouter();
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterMaster, setFilterMaster] = useState<string>("all");
    const [filterSubStatus, setFilterSubStatus] = useState<string>("all");
    const [filterRealStatus, setFilterRealStatus] = useState<string>("all"); // Yeni: Gerçek durum filtresi
    const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
    const [isPending, startTransition] = useTransition();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'list' | 'master' | 'shipped' | 'warehouse' | 'inproduction'>('master'); // Default: Usta Bazlı
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
    const [editProductionDate, setEditProductionDate] = useState<string>("");
    const [editTerminDate, setEditTerminDate] = useState<string>("");
    const [editMaster, setEditMaster] = useState<string>("");
    const [editDescription, setEditDescription] = useState<string>("");
    const [editMaterial, setEditMaterial] = useState<string>("");
    const [editFootType, setEditFootType] = useState<string>("");
    const [editFootMaterial, setEditFootMaterial] = useState<string>("");
    const [editArmType, setEditArmType] = useState<string>("");
    const [editBackType, setEditBackType] = useState<string>("");
    const [editFabricType, setEditFabricType] = useState<string>("");
    const [editEngineerNote, setEditEngineerNote] = useState<string>("");
    const [editFoamQty, setEditFoamQty] = useState<number>(0);
    const [editUpholsteryQty, setEditUpholsteryQty] = useState<number>(0);
    const [editAssemblyQty, setEditAssemblyQty] = useState<number>(0);
    const [editPackagedQty, setEditPackagedQty] = useState<number>(0);
    const [editStoredQty, setEditStoredQty] = useState<number>(0);
    const [editShippedQty, setEditShippedQty] = useState<number>(0);
    const [startDateOpen, setStartDateOpen] = useState(false);
    const [endDateOpen, setEndDateOpen] = useState(false);
    const [calendarView, setCalendarView] = useState<'week' | 'month'>('month');
    const [startDateFilter, setStartDateFilter] = useState<string>("");
    const [endDateFilter, setEndDateFilter] = useState<string>("");
    const [showOverdue, setShowOverdue] = useState(false);
    const [hideSevk, setHideSevk] = useState(true); // Varsayılan: tümü sevk edilenleri gizle
    const [showSentToProduction, setShowSentToProduction] = useState(true); // Default: Tüm ürünleri göster
    const [dateViewMode, setDateViewMode] = useState<'termin' | 'production'>('termin');
    const [isEditingStatus, setIsEditingStatus] = useState(false);
    const [editingStatus, setEditingStatus] = useState<string>("");
    const [isSemiFinishedDialogOpen, setIsSemiFinishedDialogOpen] = useState(false);
    const [filterSearch, setFilterSearch] = useState(""); // Ürün / firma arama
    const [sevkStartDate, setSevkStartDate] = useState(""); // Sevk edilenler tarih filtresi
    const [sevkEndDate, setSevkEndDate] = useState("");
    const [shipDialogProduct, setShipDialogProduct] = useState<Product | null>(null);
    const [shipQty, setShipQty] = useState("");
    const [isShipping, setIsShipping] = useState(false);

    // Filtrelenmiş ürünler
    const filteredProducts = useMemo(() => {
        let filtered = products;

        // Depoda olan ürünleri ana listeden gizle (sadece Depoda sekmesinde görünsün)
        filtered = filtered.filter(p => (p.storedQty ?? 0) < p.quantity);

        // Tümü sevk edilenleri her zaman gizle (sadece Sevk Edilenler sekmesinde görünsün)
        filtered = filtered.filter(p => (p.shippedQty ?? 0) < p.quantity);

        // Üretimdeki ürünleri ana listeden gizle (sadece Üretimdekiler sekmesinde görünsün)
        filtered = filtered.filter(p => {
            const hasStageData = (p.foamQty ?? 0) + (p.upholsteryQty ?? 0) + (p.assemblyQty ?? 0) + (p.packagedQty ?? 0) + (p.storedQty ?? 0) > 0;
            return p.status !== 'IN_PRODUCTION' && !hasStageData;
        });

        // Ürün adı / firma arama
        if (filterSearch) {
            const s = filterSearch.toLowerCase();
            filtered = filtered.filter(p =>
                p.name?.toLowerCase().includes(s) ||
                p.model?.toLowerCase().includes(s) ||
                p.order?.company?.toLowerCase().includes(s) ||
                p.order?.name?.toLowerCase().includes(s)
            );
        }

        if (filterStatus !== "all") {
            filtered = filtered.filter(p => p.status === filterStatus);
        }

        // Gerçek durum filtresi (Yeni)
        if (filterRealStatus !== "all") {
            filtered = filtered.filter(p => getProductRealStatus(p) === filterRealStatus);
        }

        if (filterMaster !== "all") {
            if (filterMaster === "none") {
                filtered = filtered.filter(p => !p.master);
            } else {
                filtered = filtered.filter(p => p.master === filterMaster);
            }
        }

        // Alt durum filtresi
        if (filterSubStatus !== "all") {
            if (filterSubStatus === "none") {
                filtered = filtered.filter(p => !p.subStatus);
            } else {
                filtered = filtered.filter(p => p.subStatus === filterSubStatus);
            }
        }

        // Tarih filtreleme (her zaman çalışır)
        // "Geçikenler" aktifse: Tarih aralığındaki ürünler VEYA gecikmiş ürünler
        if (startDateFilter || endDateFilter || showOverdue) {
            filtered = filtered.filter(p => {
                const displayDate = p.terminDate; // Sadece termin tarihi
                if (!displayDate) return false;

                const parsedDate = parseDate(displayDate);
                if (!parsedDate) return false;
                const today = startOfDay(new Date());
                const isOverdue = isBefore(parsedDate, today);

                // Geçikenler aktifse: (tarih aralığında VEYA gecikmiş)
                if (showOverdue) {
                    let inDateRange = true;

                    if (startDateFilter && endDateFilter) {
                        const start = parseDate(startDateFilter);
                        const end = parseDate(endDateFilter);
                        if (start && end) {
                            inDateRange = parsedDate >= start && parsedDate <= end;
                        }
                    } else if (startDateFilter) {
                        const start = parseDate(startDateFilter);
                        if (start) inDateRange = parsedDate >= start;
                    } else if (endDateFilter) {
                        const end = parseDate(endDateFilter);
                        if (end) inDateRange = parsedDate <= end;
                    }

                    return inDateRange || isOverdue;
                } else {
                    // Geçikenler pasifse: sadece tarih aralığı
                    if (startDateFilter) {
                        const start = parseDate(startDateFilter);
                        if (start && parsedDate < start) return false;
                    }
                    if (endDateFilter) {
                        const end = parseDate(endDateFilter);
                        if (end && parsedDate > end) return false;
                    }
                    return true;
                }
            });
        }

        // Üretime gönderilenleri göster/gizle
        if (!showSentToProduction) {
            // Sadece üretime gönderilmemiş olanları göster (APPROVED)
            filtered = filtered.filter(p => p.status === "APPROVED");
        }
        // showSentToProduction true ise tüm ürünleri göster (default davranış)

        // Seçilen tarih moduna göre sırala (en yakın tarih önce)
        filtered.sort((a, b) => {
            const dateField = dateViewMode === 'termin' ? 'terminDate' : 'productionDate';
            const aDate = a[dateField] ? new Date(a[dateField]).getTime() : Infinity;
            const bDate = b[dateField] ? new Date(b[dateField]).getTime() : Infinity;
            return aDate - bDate;
        });

        return filtered;
    }, [products, filterStatus, filterRealStatus, filterMaster, filterSubStatus, startDateFilter, endDateFilter, showOverdue, showSentToProduction, dateViewMode, hideSevk, filterSearch]);

    // Benzersiz ustalar
    const uniqueMasters = useMemo(() => {
        const masters = new Set<string>();
        products.forEach(p => { if (p.master) masters.add(p.master); });
        return Array.from(masters).sort();
    }, [products]);

    // Benzersiz alt durumlar
    const uniqueSubStatuses = useMemo(() => {
        const subStatuses = new Set<string>();
        products.forEach(p => { if (p.subStatus) subStatuses.add(p.subStatus); });
        return Array.from(subStatuses).sort();
    }, [products]);

    // Usta bazlı gruplama
    const groupedByMaster = useMemo(() => {
        const groups: Record<string, Product[]> = {};
        filteredProducts.forEach(p => {
            const master = p.master || "Usta Atanmamış";
            if (!groups[master]) groups[master] = [];
            groups[master].push(p);
        });
        return groups;
    }, [filteredProducts]);

    // Gecikmiş ürün sayısı (sevk edilmişler hariç)
    const overdueCount = useMemo(() => {
        return products.filter(p => {
            // Sevk edilmiş ürünler gecikmiş sayılmaz
            if ((p.shippedQty || 0) >= p.quantity) return false;
            const displayDate = p.productionDate || p.terminDate;
            if (!displayDate) return false;
            const parsedDate = parseDate(displayDate);
            if (!parsedDate) return false;
            return isBefore(parsedDate, startOfDay(new Date()));
        }).length;
    }, [products]);

    // Üretime gönderilmiş ürün sayısı
    const inProductionCount = useMemo(() => {
        return products.filter(p => p.status === "IN_PRODUCTION").length;
    }, [products]);

    // Sevk edilen ürünler (tarih filtreli, ciro hesabı)
    const shippedProducts = useMemo(() => {
        let list = products.filter(p => (p.shippedQty ?? 0) > 0);

        if (filterSearch) {
            const s = filterSearch.toLowerCase();
            list = list.filter(p =>
                p.name?.toLowerCase().includes(s) ||
                p.model?.toLowerCase().includes(s) ||
                p.order?.company?.toLowerCase().includes(s) ||
                p.order?.name?.toLowerCase().includes(s)
            );
        }

        // Sevk sekmesine özel tarih filtresi (Termin Aralığı)
        if (sevkStartDate || sevkEndDate) {
            list = list.filter(p => {
                const d = parseDate(p.terminDate);
                if (!d) return false;
                if (sevkStartDate && d < parseDate(sevkStartDate)!) return false;
                if (sevkEndDate && d > parseDate(sevkEndDate)!) return false;
                return true;
            });
        }

        // Genel termin tarihi filtresi de sevk sekmesine uygulanır
        if (startDateFilter || endDateFilter) {
            list = list.filter(p => {
                const d = parseDate(p.terminDate);
                if (!d) return false;
                if (startDateFilter) {
                    const start = parseDate(startDateFilter);
                    if (start && d < start) return false;
                }
                if (endDateFilter) {
                    const end = parseDate(endDateFilter);
                    if (end && d > end) return false;
                }
                return true;
            });
        }

        return list;
    }, [products, filterSearch, sevkStartDate, sevkEndDate, startDateFilter, endDateFilter]);

    const totalShippedQty = useMemo(() =>
        shippedProducts.reduce((s, p) => s + (p.shippedQty ?? 0), 0),
        [shippedProducts]);

    // Firma bazlı ciro özeti (adet)
    const shippedByCompany = useMemo(() => {
        const map: Record<string, number> = {};
        shippedProducts.forEach(p => {
            const c = p.order?.company || "Belirtilmedi";
            map[c] = (map[c] ?? 0) + (p.shippedQty ?? 0);
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [shippedProducts]);

    // Depodaki ürünler (storedQty > 0)
    const warehouseProducts = useMemo(() => {
        let list = products.filter(p => {
            // Depoda adeti varsa ve tümü sevk edilmemişse göster
            if ((p.storedQty ?? 0) === 0) return false;
            if ((p.shippedQty ?? 0) >= p.quantity) return false;
            return true;
        });
        if (filterSearch) {
            const s = filterSearch.toLowerCase();
            list = list.filter(p =>
                p.name?.toLowerCase().includes(s) ||
                p.model?.toLowerCase().includes(s) ||
                p.order?.company?.toLowerCase().includes(s) ||
                p.order?.name?.toLowerCase().includes(s)
            );
        }
        return list;
    }, [products, filterSearch]);
    //inProductionProducts

    const totalWarehouseQty = useMemo(() =>
        warehouseProducts.reduce((s, p) => s + (p.storedQty ?? 0), 0),
        [warehouseProducts]);

    // Usta bazlı depo özeti
    const warehouseByMaster = useMemo(() => {
        const map: Record<string, { products: Product[]; qty: number }> = {};
        warehouseProducts.forEach(p => {
            const m = p.master || "Usta Atanmamış";
            if (!map[m]) map[m] = { products: [], qty: 0 };
            map[m].products.push(p);
            map[m].qty += (p.storedQty ?? 0);
        });
        return Object.entries(map).sort((a, b) => b[1].qty - a[1].qty);
    }, [warehouseProducts]);

    // Üretimdeki ürünler (IN_PRODUCTION statüsü veya herhangi bir aşamada ilerleme var)
    const inProductionProducts = useMemo(() => {
        let list = products.filter(p => {
            // Tamamen depoya veya sevke giden toplam miktar
            const totalFinished = (p.storedQty ?? 0) + (p.shippedQty ?? 0);
            
            // Eğer ürünün BÜTÜN miktarı depoda veya sevk edildiyse, Üretim'de gözükmesin!
            if (totalFinished >= p.quantity) return false;

            // Eğer en az 1 adedi bile depoya girmediyse veya sevk edilmediyse (hala üretilmeyi bekleyen kısmı varsa), 
            // ve statüsü IN_PRODUCTION ise VEYA herhangi bir üretim sürecinde işlem gördüyse (hatta partially stored ise)
            // Üretimde sayılır.
            const hasStartedAnyStage = (p.foamQty ?? 0) + (p.upholsteryQty ?? 0) + (p.assemblyQty ?? 0) + (p.packagedQty ?? 0) > 0;
            const hasRemainingToProduce = totalFinished < p.quantity;

            return hasRemainingToProduce && (p.status === 'IN_PRODUCTION' || hasStartedAnyStage || totalFinished > 0);
        });
        if (filterSearch) {
            const s = filterSearch.toLowerCase();
            list = list.filter(p =>
                p.name?.toLowerCase().includes(s) ||
                p.model?.toLowerCase().includes(s) ||
                p.order?.company?.toLowerCase().includes(s) ||
                p.order?.name?.toLowerCase().includes(s)
            );
        }
        return list;
    }, [products, filterSearch]);

    // Usta bazlı üretim özeti
    const inProductionByMaster = useMemo(() => {
        const map: Record<string, { products: Product[]; qty: number }> = {};
        inProductionProducts.forEach(p => {
            const m = p.master || "Usta Atanmamış";
            if (!map[m]) map[m] = { products: [], qty: 0 };
            map[m].products.push(p);
            map[m].qty += p.quantity;
        });
        return Object.entries(map).sort((a, b) => b[1].qty - a[1].qty);
    }, [inProductionProducts]);

    // Ciro hesaplari (unitPrice mevcut olan urunler)
    const ciroInProduction = useMemo(() =>
        inProductionProducts.reduce((sum, p) => {
            if (!p.unitPrice) return sum;
            const activeQty = (p.foamQty ?? 0) + (p.upholsteryQty ?? 0) + (p.assemblyQty ?? 0) + (p.packagedQty ?? 0);
            return sum + p.unitPrice * activeQty;
        }, 0)
        , [inProductionProducts]);

    const ciroWarehouse = useMemo(() =>
        warehouseProducts.reduce((sum, p) => {
            if (!p.unitPrice) return sum;
            return sum + p.unitPrice * (p.storedQty ?? 0);
        }, 0)
        , [warehouseProducts]);

    const ciroShipped = useMemo(() =>
        shippedProducts.reduce((sum, p) => {
            if (!p.unitPrice) return sum;
            return sum + p.unitPrice * (p.shippedQty ?? 0);
        }, 0)
        , [shippedProducts]);

    const formatCiro = (val: number) =>
        val > 0 ? val.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₺' : '—';

    // Takvim için günler
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

    const calendarStart = calendarView === 'week' ? weekStart : startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = calendarView === 'week' ? weekEnd : endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

    // Takvim navigasyon fonksiyonları
    const goToPrevious = () => {
        if (calendarView === 'week') {
            setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)));
        } else {
            setCurrentDate(subMonths(currentDate, 1));
        }
    };

    const goToNext = () => {
        if (calendarView === 'week') {
            setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)));
        } else {
            setCurrentDate(addMonths(currentDate, 1));
        }
    };

    // Gün bazında ürünleri grupla
    // AI NOTE: Üretim planlaması için öncelik 'productionDate' (Üretim Tarihi) olmalıdır.
    // Eğer üretim tarihi atanmamışsa 'terminDate' (Teslim Tarihi) baz alınır.
    // Gün bazında ürünleri grupla - dateViewMode'a göre
    const productsByDate = useMemo(() => {
        const grouped: Record<string, Product[]> = {};
        filteredProducts.forEach(product => {
            let displayDate: any = null;
            if (dateViewMode === 'termin') {
                displayDate = product.terminDate || product.productionDate;
            } else {
                // Üretim tarihi modunda sadece üretim tarihi olan ürünleri göster
                displayDate = product.productionDate;
            }

            if (displayDate) {
                const parsedDate = parseDate(displayDate);
                if (parsedDate) {
                    const dateKey = format(parsedDate, 'yyyy-MM-dd');
                    if (!grouped[dateKey]) grouped[dateKey] = [];
                    grouped[dateKey].push(product);
                }
            }
        });
        return grouped;
    }, [filteredProducts, dateViewMode]);

    // Tümünü seç/kaldır
    const toggleSelectAll = () => {
        if (selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0) {
            setSelectedProductIds([]);
        } else {
            setSelectedProductIds(filteredProducts.map(p => p.id));
        }
    };

    // Üretime gönder
    const handleSendToProduction = () => {
        if (selectedProductIds.length === 0) {
            toast.error("Lütfen en az bir ürün seçin");
            return;
        }

        startTransition(async () => {
            const result = await sendProductsToProduction(selectedProductIds);
            if (result.error) {
                toast.error(result.error);
            } else {
                // Message varsa onu göster, yoksa varsayılan mesajı göster
                const message = result.message || `${result.count} ürün üretime gönderildi`;
                toast.success(message);
                setSelectedProductIds([]);
            }
        });
    };

    // Ürün düzenleme dialog'u aç - tüm alanları doldur
    const handleEditProduct = (product: Product) => {
        setEditingProduct(product);
        setEditProductionDate(
            product.productionDate
                ? format(new Date(product.productionDate), 'yyyy-MM-dd')
                : ''
        );
        setEditTerminDate(
            product.terminDate
                ? format(new Date(product.terminDate), 'yyyy-MM-dd')
                : ''
        );
        setEditMaster(product.master || '');
        setEditDescription(product.description || '');
        setEditMaterial(product.material || '');
        setEditFootType(product.footType || '');
        setEditFootMaterial(product.footMaterial || '');
        setEditArmType(product.armType || '');
        setEditBackType(product.backType || '');
        setEditFabricType(product.fabricType || '');
        setEditEngineerNote(product.engineerNote || '');
        setEditFoamQty(product.foamQty || 0);
        setEditUpholsteryQty(product.upholsteryQty || 0);
        setEditAssemblyQty(product.assemblyQty || 0);
        setEditPackagedQty(product.packagedQty || 0);
        setEditStoredQty(product.storedQty || 0);
        setEditShippedQty(product.shippedQty || 0);
    };

    // Ürün bilgilerini güncelle - tüm alanlar
    const handleUpdateProduct = () => {
        if (!editingProduct) return;

        // Eğer shippedQty artırıldıysa otomatik Shipment kaydı oluştur ve varsa depodan düş
        const oldShippedQty = editingProduct.shippedQty || 0;
        const newShippedQty = editShippedQty;

        if (newShippedQty > oldShippedQty) {
            // Sevkiyat yapılıyor
            const shipQty = newShippedQty - oldShippedQty;
            const currentStoredQty = editStoredQty; // Güncel edit değerini kullan

            // Depodan düşülecek miktar (depoda ne kadar varsa o kadar düş, min 0)
            const decrementFromStore = Math.min(shipQty, currentStoredQty);
            const newStoredQty = Math.max(0, currentStoredQty - shipQty);

            // storedQty'yi güncelle
            setEditStoredQty(newStoredQty);

            startTransition(async () => {
                try {
                    // Tüm alanları güncelle (storedQty dahil)
                    const { updateProductFields } = await import('@/lib/actions/product-actions');
                    const updateResult = await updateProductFields(editingProduct.id, {
                        productionDate: editProductionDate ? new Date(editProductionDate) : null,
                        terminDate: editTerminDate ? new Date(editTerminDate) : null,
                        master: editMaster || null,
                        description: editDescription || null,
                        material: editMaterial || null,
                        footType: editFootType || null,
                        footMaterial: editFootMaterial || null,
                        armType: editArmType || null,
                        backType: editBackType || null,
                        fabricType: editFabricType || null,
                        engineerNote: editEngineerNote || null,
                        foamQty: editFoamQty,
                        upholsteryQty: editUpholsteryQty,
                        assemblyQty: editAssemblyQty,
                        packagedQty: editPackagedQty,
                        storedQty: newStoredQty, // Depodan düşürülmüş miktar
                        shippedQty: editShippedQty,
                    });

                    if (updateResult.error) {
                        toast.error(updateResult.error);
                        return;
                    }

                    // Otomatik Shipment kaydı oluştur
                    const response = await fetch('/api/shipment/create-direct', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            productId: editingProduct.id,
                            quantity: shipQty,
                            company: editingProduct.order?.company || "Belirtilmedi",
                            driverName: null,
                            vehiclePlate: null,
                            note: decrementFromStore > 0
                                ? `Üretim takviminden sevk (${decrementFromStore} adet depodan düşüldü)`
                                : "Üretim takviminden sevk (depoda stok yoktu)",
                        }),
                    });

                    const result = await response.json();

                    if (result.error) {
                        console.error('Shipment kayıt hatası:', result.error);
                        // Hata olsa bile devam et, en azından shippedQty ve storedQty güncellendi
                    }

                    toast.success(`Ürün güncellendi, ${shipQty} adet sevk edildi${decrementFromStore > 0 ? ` (${decrementFromStore} adet depodan düşüldü)` : ''}`);
                    setEditingProduct(null);
                    router.refresh();
                } catch (error) {
                    console.error('Update error:', error);
                    toast.error('Güncelleme sırasında hata oluştu');
                }
            });
            return;
        }

        // Normal güncelleme (sevkiyat yoksa)
        performProductUpdate();
    };

    // Ürün güncellemeyi gerçekleştir
    const performProductUpdate = () => {
        if (!editingProduct) return;

        startTransition(async () => {
            const { updateProductFields } = await import('@/lib/actions/product-actions');
            const result = await updateProductFields(editingProduct.id, {
                productionDate: editProductionDate ? new Date(editProductionDate) : null,
                terminDate: editTerminDate ? new Date(editTerminDate) : null,
                master: editMaster || null,
                description: editDescription || null,
                material: editMaterial || null,
                footType: editFootType || null,
                footMaterial: editFootMaterial || null,
                armType: editArmType || null,
                backType: editBackType || null,
                fabricType: editFabricType || null,
                engineerNote: editEngineerNote || null,
                foamQty: editFoamQty,
                upholsteryQty: editUpholsteryQty,
                assemblyQty: editAssemblyQty,
                packagedQty: editPackagedQty,
                storedQty: editStoredQty,
                shippedQty: editShippedQty,
            });

            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success("Ürün güncellendi");
                setEditingProduct(null);
                router.refresh();
            }
        });
    };

    // Silme fonksiyonu
    const handleDeleteProduct = async (product: Product) => {
        if (!confirm(`${product.name} ürününü silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) return;

        startTransition(async () => {
            const result = await deleteProduct(product.id);
            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success("Ürün silindi");
                setViewingProduct(null);
                setEditingProduct(null);
                router.refresh();
            }
        });
    };

    // Durum güncelleme
    const handleUpdateStatus = async () => {
        if (!editingProduct || !editingStatus) return;

        startTransition(async () => {
            const result = await updateProductStatus(editingProduct.id, editingStatus);

            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success("Durum güncellendi");
                setIsEditingStatus(false);
                setEditingProduct(null);
                router.refresh();
            }
        });
    };

    // Excel'e aktar
    const handleExportToExcel = () => {
        const exportData = filteredProducts.map(product => ({
            'Ürün Adı': product.name,
            'Model': product.model,
            'Sistem Kodu': product.systemCode,
            'Firma': product.order?.company || '-',
            'Sipariş Adı': product.order?.name || '-',
            'Usta': product.master || 'Atanmamış',
            'Adet': product.quantity,
            'Üretilen': product.produced || 0,
            'Durum': STATUS_LABELS[getProductRealStatus(product)] || product.status,
            'Alt Durum': product.subStatus || '-',
            'Sipariş Tarihi': product.orderDate ? format(new Date(product.orderDate), 'dd/MM/yyyy') : '-',
            'Termin Tarihi': product.terminDate ? format(new Date(product.terminDate), 'dd/MM/yyyy') : '-',
            'Üretim Tarihi': product.productionDate ? format(new Date(product.productionDate), 'dd/MM/yyyy') : '-',
            'Sünger': product.foamQty || 0,
            'Döşeme': product.upholsteryQty || 0,
            'Montaj': product.assemblyQty || 0,
            'Paketlenen': product.packagedQty || 0,
            'Depoda': product.storedQty || 0,
            'Sevk Edilen': product.shippedQty || 0,
            'Malzeme': product.material || '-',
            'Ayak Tipi': product.footType || '-',
            'Ayak Malzeme': product.footMaterial || '-',
            'Kol Tipi': product.armType || '-',
            'Sırt Tipi': product.backType || '-',
            'Kumaş Tipi': product.fabricType || '-',
            'Açıklama': product.description || '-',
            'Mühendis Notu': product.engineerNote || '-',
            'NetSim Açık. 1': product.aciklama1 || '-',
            'NetSim Açık. 2': product.aciklama2 || '-',
            'NetSim Açık. 3': product.aciklama3 || '-',
            'NetSim Açık. 4': product.aciklama4 || '-',
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ürünler");

        // Kolon genişliklerini ayarla
        const colWidths = [
            { wch: 25 }, // Ürün Adı
            { wch: 15 }, // Model
            { wch: 15 }, // Sistem Kodu
            { wch: 20 }, // Firma
            { wch: 20 }, // Sipariş Adı
            { wch: 15 }, // Usta
            { wch: 8 },  // Adet
            { wch: 10 }, // Üretilen
            { wch: 12 }, // Durum
            { wch: 12 }, // Alt Durum
            { wch: 12 }, // Sipariş Tarihi
            { wch: 12 }, // Termin Tarihi
            { wch: 12 }, // Üretim Tarihi
            { wch: 8 },  // Sünger
            { wch: 8 },  // Döşeme
            { wch: 8 },  // Montaj
            { wch: 10 }, // Paketlenen
            { wch: 8 },  // Depoda
            { wch: 12 }, // Sevk Edilen
            { wch: 15 }, // Malzeme
            { wch: 12 }, // Ayak Tipi
            { wch: 12 }, // Ayak Malzeme
            { wch: 12 }, // Kol Tipi
            { wch: 12 }, // Sırt Tipi
            { wch: 12 }, // Kumaş Tipi
            { wch: 30 }, // Açıklama
            { wch: 30 }, // Mühendis Notu
            { wch: 30 }, // NetSim 1
            { wch: 30 }, // NetSim 2
            { wch: 30 }, // NetSim 3
            { wch: 30 }, // NetSim 4
        ];
        ws['!cols'] = colWidths;

        const fileName = `Uretim_Takvimi_${format(new Date(), 'dd-MM-yyyy_HH-mm')}.xlsx`;
        XLSX.writeFile(wb, fileName);
        toast.success(`${filteredProducts.length} ürün Excel'e aktarıldı`);
    };

    // Seçili ürünleri Excel'e aktar
    const handleExportSelected = () => {
        const selectedProducts = filteredProducts.filter(p => selectedProductIds.includes(p.id));

        const exportData = selectedProducts.map(product => ({
            'Ürün Adı': product.name,
            'Model': product.model,
            'Sistem Kodu': product.systemCode,
            'Firma': product.order?.company || '-',
            'Sipariş Adı': product.order?.name || '-',
            'Usta': product.master || 'Atanmamış',
            'Adet': product.quantity,
            'Üretilen': product.produced || 0,
            'Durum': STATUS_LABELS[getProductRealStatus(product)] || product.status,
            'Alt Durum': product.subStatus || '-',
            'Sipariş Tarihi': product.orderDate ? format(new Date(product.orderDate), 'dd/MM/yyyy') : '-',
            'Termin Tarihi': product.terminDate ? format(new Date(product.terminDate), 'dd/MM/yyyy') : '-',
            'Üretim Tarihi': product.productionDate ? format(new Date(product.productionDate), 'dd/MM/yyyy') : '-',
            'Sünger': product.foamQty || 0,
            'Döşeme': product.upholsteryQty || 0,
            'Montaj': product.assemblyQty || 0,
            'Paketlenen': product.packagedQty || 0,
            'Depoda': product.storedQty || 0,
            'Sevk Edilen': product.shippedQty || 0,
            'Malzeme': product.material || '-',
            'Ayak Tipi': product.footType || '-',
            'Ayak Malzeme': product.footMaterial || '-',
            'Kol Tipi': product.armType || '-',
            'Sırt Tipi': product.backType || '-',
            'Kumaş Tipi': product.fabricType || '-',
            'Açıklama': product.description || '-',
            'Mühendis Notu': product.engineerNote || '-',
            'NetSim Açık. 1': product.aciklama1 || '-',
            'NetSim Açık. 2': product.aciklama2 || '-',
            'NetSim Açık. 3': product.aciklama3 || '-',
            'NetSim Açık. 4': product.aciklama4 || '-',
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Seçili Ürünler");

        // Kolon genişliklerini ayarla
        const colWidths = [
            { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
            { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
            { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 },
            { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
            { wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }
        ];
        ws['!cols'] = colWidths;

        const fileName = `Secili_Urunler_${format(new Date(), 'dd-MM-yyyy_HH-mm')}.xlsx`;
        XLSX.writeFile(wb, fileName);
        toast.success(`${selectedProducts.length} seçili ürün Excel'e aktarıldı`);
    };

    return (
        <div className="space-y-4">
            {/* Üst Bilgi ve Kontroller */}



            {/* Filtreler */}
            <Card className="border-slate-200 bg-white shadow-sm">
                <CardContent className="pt-4 pb-3">
                    <div className="space-y-3">
                        {/* Üst Satır: Başlık + Butonlar */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <Filter className="h-4 w-4" />
                                <span>Filtreler</span>
                                {(filterStatus !== 'all' || filterRealStatus !== 'all' || filterMaster !== 'all' || filterSubStatus !== 'all' || startDateFilter || endDateFilter || showOverdue) && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => {
                                            setFilterStatus('all');
                                            setFilterRealStatus('all');
                                            setFilterMaster('all');
                                            setFilterSubStatus('all');
                                            setStartDateFilter('');
                                            setEndDateFilter('');
                                            setShowOverdue(false);
                                        }}
                                    >
                                        <X className="h-3 w-3 mr-1" />
                                        Temizle
                                    </Button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleExportToExcel}
                                    className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                                >
                                    <Download className="h-4 w-4 mr-1" />
                                    Excel ({filteredProducts.length})
                                </Button>
                            </div>
                        </div>
                        {/* Filtre Satırı 1: Arama + Durum Filtreleri */}
                        <div className="flex flex-wrap gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Ürün veya firma ara..."
                                    value={filterSearch}
                                    onChange={(e) => setFilterSearch(e.target.value)}
                                    className="pl-8 h-9 w-[220px] text-sm"
                                />
                            </div>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="w-[150px] h-9 text-sm">
                                    <SelectValue placeholder="Durum" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm Durumlar</SelectItem>
                                    <SelectItem value="APPROVED">Onaylandı</SelectItem>
                                    <SelectItem value="IN_PRODUCTION">Üretimde</SelectItem>
                                    <SelectItem value="COMPLETED">Tamamlandı</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={filterRealStatus} onValueChange={setFilterRealStatus}>
                                <SelectTrigger className="w-[160px] h-9 text-sm">
                                    <SelectValue placeholder="Detaylı Durum" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm Detay Durumlar</SelectItem>
                                    <SelectItem value="APPROVED">Onaylandı</SelectItem>
                                    <SelectItem value="SUNGERDE">Süngerde</SelectItem>
                                    <SelectItem value="DOSEMEDE">Döşemede</SelectItem>
                                    <SelectItem value="MONTAJDA">Montajda</SelectItem>
                                    <SelectItem value="PAKETLENDI">Paketlendi</SelectItem>
                                    <SelectItem value="DEPODA">Depoda</SelectItem>
                                    <SelectItem value="KISMI_SEVK">Kısmi Sevk</SelectItem>
                                    <SelectItem value="SEVK">Sevk Edildi</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={filterMaster} onValueChange={setFilterMaster}>
                                <SelectTrigger className="w-[160px] h-9 text-sm">
                                    <SelectValue placeholder="Usta" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm Ustalar</SelectItem>
                                    <SelectItem value="none">Usta Atanmamış</SelectItem>
                                    {uniqueMasters.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={filterSubStatus} onValueChange={setFilterSubStatus}>
                                <SelectTrigger className="w-[160px] h-9 text-sm">
                                    <SelectValue placeholder="Alt Durum" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm Alt Durumlar</SelectItem>
                                    <SelectItem value="none">Alt Durum Yok</SelectItem>
                                    {uniqueSubStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Filtre Satırı 2: Tarih + Checkbox'lar */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className={cn(
                                                "w-[150px] h-9 justify-start text-left text-sm font-normal",
                                                !startDateFilter && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                                            {startDateFilter ? format(new Date(startDateFilter), "dd MMM yyyy", { locale: tr }) : "Başlangıç"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <CalendarComponent
                                            mode="single"
                                            selected={startDateFilter ? new Date(startDateFilter) : undefined}
                                            onSelect={(date) => {
                                                setStartDateFilter(date ? format(date, 'yyyy-MM-dd') : '');
                                                setStartDateOpen(false);
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <span className="text-slate-300">→</span>
                                <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className={cn(
                                                "w-[150px] h-9 justify-start text-left text-sm font-normal",
                                                !endDateFilter && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                                            {endDateFilter ? format(new Date(endDateFilter), "dd MMM yyyy", { locale: tr }) : "Bitiş"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <CalendarComponent
                                            mode="single"
                                            selected={endDateFilter ? new Date(endDateFilter) : undefined}
                                            onSelect={(date) => {
                                                setEndDateFilter(date ? format(date, 'yyyy-MM-dd') : '');
                                                setEndDateOpen(false);
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="h-6 w-px bg-slate-200" />
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="showOverdue"
                                    checked={showOverdue}
                                    onCheckedChange={(checked) => setShowOverdue(checked as boolean)}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Alt Kısım - Liste, Usta Bazlı ve Sevk Edilenler Sekmeler */}
            <Tabs value={viewMode} onValueChange={(v) => { const y = window.scrollY; setViewMode(v as any); requestAnimationFrame(() => window.scrollTo({ top: y })); }} className="w-full">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <TabsList className="grid w-full max-w-3xl grid-cols-5">
                        <TabsTrigger value="master" className="flex items-center gap-1 text-xs">
                            <Users className="h-3.5 w-3.5" />
                            Usta Bazlı
                        </TabsTrigger>
                        <TabsTrigger value="list" className="flex items-center gap-1 text-xs">
                            <List className="h-3.5 w-3.5" />
                            Liste
                        </TabsTrigger>
                        <TabsTrigger value="inproduction" className="flex items-center gap-1 text-xs">
                            <Factory className="h-3.5 w-3.5" />
                            Üretimdekiler
                            <Badge variant="outline" className="ml-0.5 bg-purple-50 text-purple-700 border-purple-200 text-xs px-1">
                                {inProductionProducts.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="warehouse" className="flex items-center gap-1 text-xs">
                            <Package className="h-3.5 w-3.5" />
                            Depoda
                            <Badge variant="outline" className="ml-0.5 bg-green-50 text-green-700 border-green-200 text-xs px-1">
                                {warehouseProducts.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="shipped" className="flex items-center gap-1 text-xs">
                            <Send className="h-3.5 w-3.5" />
                            Sevk Edilenler
                            <Badge variant="outline" className="ml-0.5 bg-teal-50 text-teal-700 border-teal-200 text-xs px-1">
                                {shippedProducts.length}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>
                    <div className="flex items-center gap-2 bg-white border rounded-lg p-1">
                        <Button
                            variant={dateViewMode === 'termin' ? 'default' : 'ghost'}
                            size="sm"
                            className={dateViewMode === 'termin' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                            onClick={() => setDateViewMode('termin')}
                        >
                            <Calendar className="h-4 w-4 mr-1" />
                            Termin Tarihi
                        </Button>
                        <Button
                            variant={dateViewMode === 'production' ? 'default' : 'ghost'}
                            size="sm"
                            className={dateViewMode === 'production' ? 'bg-purple-600 hover:bg-purple-700' : ''}
                            onClick={() => setDateViewMode('production')}
                        >
                            <Wrench className="h-4 w-4 mr-1" />
                            Üretim Tarihi
                        </Button>
                    </div>
                </div>

                {/* Liste Görünümü */}
                <TabsContent value="list">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Checkbox
                                        checked={selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                    <span className="text-sm font-semibold">Tümünü Seç / Kaldır</span>
                                </div>
                                {selectedProductIds.length > 0 && (
                                    <Badge className="bg-green-600 text-white">
                                        {selectedProductIds.length} / {filteredProducts.length} seçili
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {filteredProducts.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500">
                                        <Package className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                                        <p className="text-lg font-medium">İş emri bulunamadı</p>
                                        <p className="text-sm">Filtreleri değiştirerek tekrar deneyin</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {/* Tablo Başlıkları */}
                                        <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-slate-100 rounded-lg text-xs font-semibold text-slate-600">
                                            <div className="col-span-1 text-center">Seç</div>
                                            <div className="col-span-2">Ürün Adı</div>
                                            <div className="col-span-2">Firma</div>
                                            <div className="col-span-1">Usta</div>
                                            <div className="col-span-1 text-center">Adet</div>
                                            <div className="col-span-2">Termin/Üretim</div>
                                            <div className="col-span-2">Sipariş Adı</div>
                                            <div className="col-span-1 text-center">Durum</div>
                                        </div>

                                        {/* Ürün Satırları */}
                                        {filteredProducts.map(product => {
                                            const isSelected = selectedProductIds.includes(product.id);
                                            const displayDate = dateViewMode === 'termin' ? product.terminDate : (product.productionDate || null);
                                            const hasProductionDate = !!product.productionDate;
                                            const parsedDisplayDate = parseDate(displayDate);
                                            const isShipped = (product.shippedQty || 0) >= product.quantity;
                                            const isOverdue = !isShipped && parsedDisplayDate && isBefore(parsedDisplayDate, startOfDay(new Date()));
                                            const realStatus = getProductRealStatus(product);

                                            return (
                                                <div
                                                    key={product.id}
                                                    className={`
                                                grid grid-cols-12 gap-3 px-4 py-3 rounded-lg border-2 transition-all items-center cursor-pointer
                                                ${isSelected ? 'border-blue-500 bg-blue-50' : isShipped ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'}
                                                ${isOverdue && !isSelected && !isShipped ? 'border-red-200 bg-red-50' : ''}
                                            `}
                                                    onClick={() => setViewingProduct(product)}
                                                >
                                                    {/* Checkbox */}
                                                    <div className="col-span-1 flex justify-center" onClick={(e) => e.stopPropagation()}>
                                                        <Checkbox
                                                            className="scale-140"
                                                            checked={isSelected}
                                                            disabled={isShipped}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    setSelectedProductIds([...selectedProductIds, product.id]);
                                                                } else {
                                                                    setSelectedProductIds(selectedProductIds.filter(id => id !== product.id));
                                                                }
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Ürün Adı */}
                                                    <div className="col-span-2">
                                                        <div className="font-semibold text-sm text-slate-900">{product.name}</div>
                                                        <div className="text-xs text-slate-500">{product.model}</div>
                                                        <div className="text-xs text-slate-400 font-mono">{product.systemCode}</div>
                                                    </div>

                                                    {/* Firma */}
                                                    <div className="col-span-2">
                                                        <div className="flex items-center gap-1 text-sm">
                                                            <Building2 className="h-3 w-3 text-slate-400" />
                                                            <span className="text-slate-700">{product.order?.company || '-'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Usta */}
                                                    <div className="col-span-1">
                                                        {product.master ? (
                                                            <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                                                                <User className="h-3 w-3 mr-1" />
                                                                {product.master}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-xs text-slate-400">-</span>
                                                        )}
                                                    </div>

                                                    {/* Adet */}
                                                    <div className="col-span-1 text-center">
                                                        <Badge variant="secondary" className="font-semibold">
                                                            {product.quantity}
                                                        </Badge>
                                                    </div>

                                                    {/* Termin/Üretim Tarihi */}
                                                    <div className="col-span-2">
                                                        {displayDate ? (
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="h-3 w-3 text-slate-400" />
                                                                <div>
                                                                    <div className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                                                                        {parsedDisplayDate ? format(parsedDisplayDate, "dd MMM yyyy", { locale: tr }) : '-'}
                                                                    </div>
                                                                    <div className="flex items-center gap-1 mt-0.5">
                                                                        <Badge variant="outline" className={`text-xs ${dateViewMode === 'production' ? 'bg-purple-50 text-purple-700 border-purple-200' : ''}`}>
                                                                            {dateViewMode === 'termin' ? '⏰ Termin' : '🔧 Üretim'}
                                                                        </Badge>
                                                                        {isOverdue && (
                                                                            <span className="flex items-center gap-1 text-xs text-red-600">
                                                                                <AlertTriangle className="h-3 w-3" />
                                                                                Gecikti
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400">Tarih yok</span>
                                                        )}
                                                    </div>

                                                    {/* Sipariş Adı */}
                                                    <div className="col-span-2">
                                                        <div className="text-sm text-slate-600">{product.order?.name || '-'}</div>
                                                    </div>

                                                    {/* Durum */}
                                                    <div className="col-span-1 flex flex-col items-center gap-1">
                                                        <Badge className={STATUS_COLORS[realStatus]}>
                                                            {STATUS_LABELS[realStatus]}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Usta Bazlı Görünüm */}
                <TabsContent value="master">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle>Usta Bazlı Gruplandırma</CardTitle>
                                {selectedProductIds.length > 0 && (
                                    <Badge className="bg-green-600 text-white">
                                        {selectedProductIds.length} seçili
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {Object.keys(groupedByMaster).length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <Users className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                                    <p className="text-lg font-medium">Ürün bulunamadı</p>
                                </div>
                            ) : (
                                <Accordion type="multiple" className="space-y-4">
                                    {Object.entries(groupedByMaster).map(([master, masterProducts]) => {
                                        const totalQuantity = masterProducts.reduce((sum, p) => sum + p.quantity, 0);
                                        const selectedCount = masterProducts.filter(p => selectedProductIds.includes(p.id)).length;

                                        // Excel export fonksiyonu bu usta için
                                        const handleExportMaster = () => {
                                            const exportData = masterProducts.map(product => ({
                                                'Ürün Adı': product.name,
                                                'Model': product.model,
                                                'Sistem Kodu': product.systemCode,
                                                'Firma': product.order?.company || '-',
                                                'Sipariş Adı': product.order?.name || '-',
                                                'Usta': product.master || 'Atanmamış',
                                                'Adet': product.quantity,
                                                'Üretilen': product.produced || 0,
                                                'Durum': STATUS_LABELS[getProductRealStatus(product)] || product.status,
                                                'Termin Tarihi': product.terminDate ? format(new Date(product.terminDate), 'dd/MM/yyyy') : '-',
                                                'Üretim Tarihi': product.productionDate ? format(new Date(product.productionDate), 'dd/MM/yyyy') : '-',
                                            }));

                                            const ws = XLSX.utils.json_to_sheet(exportData);
                                            const wb = XLSX.utils.book_new();
                                            XLSX.utils.book_append_sheet(wb, ws, master.slice(0, 30));

                                            const fileName = `${master}_${format(new Date(), 'dd-MM-yyyy_HH-mm')}.xlsx`;
                                            XLSX.writeFile(wb, fileName);
                                            toast.success(`${masterProducts.length} ürün Excel'e aktarıldı`);
                                        };

                                        return (
                                            <AccordionItem key={master} value={master} className="border-2 rounded-lg">
                                                <AccordionTrigger className="px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-t-lg hover:no-underline">
                                                    <div className="flex items-center justify-between w-full pr-4">
                                                        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                                            <Checkbox
                                                                checked={selectedCount === masterProducts.length && masterProducts.length > 0}
                                                                onCheckedChange={(checked) => {
                                                                    const masterProductIds = masterProducts.map(p => p.id);
                                                                    if (checked) {
                                                                        setSelectedProductIds([
                                                                            ...selectedProductIds,
                                                                            ...masterProductIds.filter(id => !selectedProductIds.includes(id))
                                                                        ]);
                                                                    } else {
                                                                        setSelectedProductIds(
                                                                            selectedProductIds.filter(id => !masterProductIds.includes(id))
                                                                        );
                                                                    }
                                                                }}
                                                            />
                                                            <div>
                                                                <div className="text-lg font-semibold flex items-center gap-2">
                                                                    <User className="h-5 w-5 text-blue-600" />
                                                                    {master}
                                                                </div>
                                                                <p className="text-sm text-slate-600">
                                                                    {masterProducts.length} ürün • {totalQuantity} adet
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                            {selectedCount > 0 && (
                                                                <Badge className="bg-green-600 text-white">
                                                                    {selectedCount} / {masterProducts.length} seçili
                                                                </Badge>
                                                            )}
                                                            <div
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleExportMaster();
                                                                }}
                                                                className="px-3 py-1.5 text-sm rounded-md border cursor-pointer bg-green-50 hover:bg-green-100 text-green-700 border-green-200 flex items-center gap-1"
                                                            >
                                                                <Download className="h-4 w-4" />
                                                                Excel
                                                            </div>
                                                        </div>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-4 pb-4 pt-2">
                                                    <div className="space-y-2">
                                                        {masterProducts.map(product => {
                                                            const isSelected = selectedProductIds.includes(product.id);
                                                            const displayDate = dateViewMode === 'termin' ? product.terminDate : (product.productionDate || null);
                                                            const hasProductionDate = !!product.productionDate;
                                                            const parsedDisplayDate = parseDate(displayDate);
                                                            const isShipped = (product.shippedQty || 0) >= product.quantity;
                                                            const isOverdue = !isShipped && parsedDisplayDate && isBefore(parsedDisplayDate, startOfDay(new Date()));
                                                            const realStatus = getProductRealStatus(product);

                                                            return (
                                                                <div
                                                                    key={product.id}
                                                                    className={`
                                                                grid grid-cols-12 gap-3 px-4 py-3 rounded-lg border-2 transition-all items-center cursor-pointer
                                                                ${isSelected ? 'border-blue-500 bg-blue-50' : isShipped ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'}
                                                                ${isOverdue && !isSelected && !isShipped ? 'border-red-200 bg-red-50' : ''}
                                                            `}
                                                                    onClick={() => setViewingProduct(product)}
                                                                >
                                                                    {/* Checkbox */}
                                                                    <div className="col-span-1 flex justify-center" onClick={(e) => e.stopPropagation()}>
                                                                        <Checkbox
                                                                            className="scale-140"
                                                                            checked={isSelected}
                                                                            disabled={isShipped}
                                                                            onCheckedChange={(checked) => {
                                                                                if (checked) {
                                                                                    setSelectedProductIds([...selectedProductIds, product.id]);
                                                                                } else {
                                                                                    setSelectedProductIds(selectedProductIds.filter(id => id !== product.id));
                                                                                }
                                                                            }}
                                                                        />
                                                                    </div>

                                                                    {/* Ürün Adı */}
                                                                    <div className="col-span-3">
                                                                        <div className="font-semibold text-sm text-slate-900">{product.name}</div>
                                                                        <div className="text-xs text-slate-500">{product.model}</div>
                                                                    </div>

                                                                    {/* Firma */}
                                                                    <div className="col-span-2">
                                                                        <div className="flex items-center gap-1 text-sm">
                                                                            <Building2 className="h-3 w-3 text-slate-400" />
                                                                            <span className="text-slate-700">{product.order?.company || '-'}</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Adet */}
                                                                    <div className="col-span-1 text-center">
                                                                        <Badge variant="secondary" className="font-semibold">
                                                                            {product.quantity}
                                                                        </Badge>
                                                                    </div>

                                                                    {/* Tarih */}
                                                                    <div className="col-span-3">
                                                                        {displayDate ? (
                                                                            <div className="flex items-center gap-2">
                                                                                <Calendar className="h-3 w-3 text-slate-400" />
                                                                                <div>
                                                                                    <div className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                                                                                        {parsedDisplayDate ? format(parsedDisplayDate, "dd MMM yyyy", { locale: tr }) : '-'}
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1 mt-0.5">
                                                                                        <Badge variant="outline" className="text-xs">
                                                                                            ⏰ Termin
                                                                                        </Badge>
                                                                                        {isOverdue && (
                                                                                            <span className="flex items-center gap-1 text-xs text-red-600">
                                                                                                <AlertTriangle className="h-3 w-3" />
                                                                                                Gecikti
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-xs text-slate-400">Tarih yok</span>
                                                                        )}
                                                                    </div>

                                                                    {/* Durum */}
                                                                    <div className="col-span-2 flex flex-col items-center gap-1">
                                                                        <Badge className={STATUS_COLORS[realStatus]}>
                                                                            {STATUS_LABELS[realStatus]}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        );
                                    })}
                                </Accordion>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Sevk Edilenler Sekmesi */}
                <TabsContent value="shipped">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div className="flex items-center gap-3">
                                    <Send className="h-5 w-5 text-teal-600" />
                                    <CardTitle>Sevk Edilenler</CardTitle>
                                    <Badge className="bg-teal-600">{shippedProducts.length} ürün</Badge>
                                    <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
                                        <TrendingUp className="h-3 w-3 mr-1" />
                                        Toplam: {totalShippedQty} adet
                                    </Badge>
                                    {userRole === "ADMIN" && ciroShipped > 0 && (
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-base font-bold px-3 py-1">
                                            <TrendingUp className="h-3 w-3 mr-1" />
                                            Ciro: {formatCiro(ciroShipped)}
                                        </Badge>
                                    )}
                                </div>
                                {/* Tarih filtresi - sadece admin */}
                                {userRole === "ADMIN" && (
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-slate-500">Termin Aralığı:</label>
                                        <Input
                                            type="date"
                                            value={sevkStartDate}
                                            onChange={(e) => setSevkStartDate(e.target.value)}
                                            className="h-8 w-[140px] text-sm"
                                        />
                                        <span className="text-slate-400 text-sm">—</span>
                                        <Input
                                            type="date"
                                            value={sevkEndDate}
                                            onChange={(e) => setSevkEndDate(e.target.value)}
                                            className="h-8 w-[140px] text-sm"
                                        />
                                        {(sevkStartDate || sevkEndDate) && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2 text-red-600 hover:bg-red-50"
                                                onClick={() => { setSevkStartDate(""); setSevkEndDate(""); }}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {shippedProducts.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <Truck className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                                    <p className="text-lg font-medium">Sevk edilen ürün bulunamadı</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {shippedByCompany.map(([company, shippedQty]) => {
                                        const companyProducts = shippedProducts.filter(p => (p.order?.company || '-') === company);
                                        const companyCiro = companyProducts.reduce((s, p) => s + (p.unitPrice ?? 0) * (p.shippedQty ?? 0), 0);
                                        return (
                                            <div key={company} className="border border-teal-200 rounded-lg overflow-hidden">
                                                <div className="bg-teal-50 px-4 py-2 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="h-4 w-4 text-teal-600" />
                                                        <span className="font-semibold text-teal-800 text-sm">{company}</span>
                                                        <Badge variant="outline" className="bg-white text-teal-700 border-teal-300 text-xs">
                                                            {companyProducts.length} ürün
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {companyCiro > 0 && (
                                                            <Badge variant="outline" className="bg-white text-teal-700 border-teal-300 text-xs">
                                                                {formatCiro(companyCiro)}
                                                            </Badge>
                                                        )}
                                                        <Badge className="bg-teal-600 text-white">
                                                            {shippedQty} adet sevk
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="divide-y divide-teal-100">
                                                    {companyProducts.map(product => {
                                                        const terminDate = parseDate(product.terminDate);
                                                        return (
                                                            <div
                                                                key={product.id}
                                                                className="grid grid-cols-12 gap-3 px-4 py-3 bg-white hover:bg-teal-50 transition-colors items-center cursor-pointer"
                                                                onClick={() => setViewingProduct(product)}
                                                            >
                                                                <div className="col-span-4">
                                                                    <div className="font-semibold text-sm text-slate-900">{product.name}</div>
                                                                    <div className="text-xs text-slate-500">{product.model}</div>
                                                                </div>
                                                                <div className="col-span-3 text-sm text-slate-600">{product.order?.name || '-'}</div>
                                                                <div className="col-span-1 text-center">
                                                                    <Badge variant="secondary">{product.quantity}</Badge>
                                                                </div>
                                                                <div className="col-span-1 text-center">
                                                                    <Badge className="bg-teal-600">{product.shippedQty}</Badge>
                                                                </div>
                                                                <div className="col-span-2 text-sm text-slate-500">
                                                                    <div className="flex flex-col gap-0.5">
                                                                        {product.shippedDate && (
                                                                            <div className="flex items-center gap-1 text-teal-600 font-medium">
                                                                                <Truck className="h-3 w-3" />
                                                                                {format(new Date(product.shippedDate), "dd MMM yyyy", { locale: tr })}
                                                                            </div>
                                                                        )}
                                                                        {terminDate && (
                                                                            <div className="text-slate-400 text-xs">
                                                                                Termin: {format(terminDate, "dd MMM", { locale: tr })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="col-span-1 text-right text-sm font-medium text-teal-700">
                                                                    {product.unitPrice ? formatCiro((product.unitPrice ?? 0) * (product.shippedQty ?? 0)) : '—'}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Depoda Sekmesi */}
                <TabsContent value="warehouse">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div className="flex items-center gap-3">
                                    <Package className="h-5 w-5 text-green-600" />
                                    <CardTitle>Depodaki Ürünler</CardTitle>
                                    <Badge className="bg-green-600">{warehouseProducts.length} ürün</Badge>
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-base px-3 py-1">
                                        <TrendingUp className="h-3 w-3 mr-1" />
                                        Toplam: {totalWarehouseQty} adet
                                    </Badge>
                                    {userRole === "ADMIN" && ciroWarehouse > 0 && (
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-base font-bold px-3 py-1">
                                            <TrendingUp className="h-4 w-4 mr-1" />
                                            Depo Cirosu: {formatCiro(ciroWarehouse)}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {warehouseProducts.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <Package className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                                    <p className="text-lg font-medium">Depoda ürün bulunamadı</p>
                                    <p className="text-sm">Ürünler depoya alındıkça burada görünür</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {warehouseByMaster.map(([master, { products: masterProducts, qty }]) => (
                                        <div key={master} className="border border-green-200 rounded-lg overflow-hidden">
                                            <div className="bg-green-50 px-4 py-2 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <User className="h-4 w-4 text-green-600" />
                                                    <span className="font-semibold text-green-800 text-sm">{master}</span>
                                                    <Badge variant="outline" className="bg-white text-green-700 border-green-300 text-xs">
                                                        {masterProducts.length} ürün
                                                    </Badge>
                                                </div>
                                                <Badge className="bg-green-600 text-white">
                                                    {qty} adet depoda
                                                </Badge>
                                            </div>
                                            <div className="divide-y divide-green-100">
                                                {masterProducts.map(product => {
                                                    const terminDate = parseDate(product.terminDate);
                                                    return (
                                                        <div
                                                            key={product.id}
                                                            className="grid grid-cols-12 gap-3 px-4 py-3 bg-white hover:bg-green-50 transition-colors items-center"
                                                        >
                                                            <div className="col-span-3 cursor-pointer" onClick={() => setViewingProduct(product)}>
                                                                <div className="font-semibold text-sm text-slate-900">{product.name}</div>
                                                                <div className="text-xs text-slate-500">{product.model}</div>
                                                                <div className="text-xs text-slate-400 font-mono">{product.systemCode}</div>
                                                            </div>
                                                            <div className="col-span-2 text-sm text-slate-700">
                                                                <div className="flex items-center gap-1">
                                                                    <Building2 className="h-3 w-3 text-slate-400" />
                                                                    {product.order?.company || '-'}
                                                                </div>
                                                            </div>
                                                            <div className="col-span-2 text-sm text-slate-600">{product.order?.name || '-'}</div>
                                                            <div className="col-span-1 text-center">
                                                                <Badge variant="secondary">{product.quantity}</Badge>
                                                            </div>
                                                            <div className="col-span-1 text-center">
                                                                <Badge className="bg-green-600">{product.storedQty}</Badge>
                                                            </div>
                                                            <div className="col-span-2 text-sm text-slate-600 flex flex-col gap-1">
                                                                <div className="flex items-center gap-1" title="Termin Tarihi">
                                                                    <Calendar className="h-3 w-3 text-slate-400" />
                                                                    <span>{terminDate ? format(terminDate, "dd MMM yyyy", { locale: tr }) : '-'}</span>
                                                                </div>
                                                                {product.storedDate && (
                                                                    <div title="Depo Giriş Tarihi" className="text-xs text-green-700 font-medium flex items-center gap-1">
                                                                        <Package className="h-3 w-3" />
                                                                        {format(new Date(product.storedDate), "dd MMM yyyy", { locale: tr })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="col-span-1 flex justify-center">
                                                                <Button
                                                                    size="sm"
                                                                    className="h-7 px-2 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setShipDialogProduct(product);
                                                                        setShipQty(String(product.storedQty ?? 0));
                                                                    }}
                                                                >
                                                                    <Send className="h-3 w-3 mr-1" />
                                                                    Sevk
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Üretimdekiler Sekmesi */}
                <TabsContent value="inproduction">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-3">
                                <Factory className="h-5 w-5 text-purple-600" />
                                <CardTitle>Üretimdekiler</CardTitle>
                                <Badge className="bg-purple-600">{inProductionProducts.length} ürün</Badge>
                                <Badge className="bg-purple-600">{inProductionProducts.reduce((sum, p) => sum + p.quantity, 0)} adet</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {inProductionProducts.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <Factory className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                                    <p className="text-lg font-medium">Üretimde ürün bulunamadı</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {inProductionByMaster.map(([master, { products: masterProducts, qty }]) => {
                                        const selectedCount = masterProducts.filter(p => selectedProductIds.includes(p.id)).length;
                                        return (
                                            <div key={master} className="border border-purple-200 rounded-lg overflow-hidden">
                                                <div className="bg-purple-50 px-4 py-2 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox
                                                            checked={selectedCount === masterProducts.length && masterProducts.length > 0}
                                                            onCheckedChange={(checked) => {
                                                                const masterProductIds = masterProducts.map(p => p.id);
                                                                if (checked) {
                                                                    setSelectedProductIds([
                                                                        ...selectedProductIds,
                                                                        ...masterProductIds.filter(id => !selectedProductIds.includes(id))
                                                                    ]);
                                                                } else {
                                                                    setSelectedProductIds(
                                                                        selectedProductIds.filter(id => !masterProductIds.includes(id))
                                                                    );
                                                                }
                                                            }}
                                                        />
                                                        <User className="h-4 w-4 text-purple-600" />
                                                        <span className="font-semibold text-purple-800 text-sm">{master}</span>
                                                        <Badge variant="outline" className="bg-white text-purple-700 border-purple-300 text-xs">
                                                            {masterProducts.length} ürün
                                                        </Badge>
                                                    </div>
                                                    <Badge className="bg-purple-600 text-white">
                                                        {qty} adet
                                                    </Badge>
                                                </div>
                                                <div className="divide-y divide-purple-100">
                                                    {masterProducts.map(product => {
                                                        const terminDate = parseDate(product.terminDate);
                                                        const realStatus = getProductRealStatus(product);
                                                        const isOverdue = terminDate && isBefore(terminDate, startOfDay(new Date()));
                                                        const isSelected = selectedProductIds.includes(product.id);

                                                        return (
                                                            <div
                                                                key={product.id}
                                                                className={`grid grid-cols-12 gap-2 px-4 py-3 bg-white hover:bg-purple-50 transition-colors items-center cursor-pointer ${isSelected ? 'bg-purple-50 ring-1 ring-purple-300' : ''}`}
                                                                onClick={() => setViewingProduct(product)}
                                                            >
                                                                {/* Checkbox */}
                                                                <div className="col-span-1 flex justify-center" onClick={(e) => e.stopPropagation()}>
                                                                    <Checkbox
                                                                        className="scale-125"
                                                                        checked={isSelected}
                                                                        onCheckedChange={(checked) => {
                                                                            if (checked) {
                                                                                setSelectedProductIds([...selectedProductIds, product.id]);
                                                                            } else {
                                                                                setSelectedProductIds(selectedProductIds.filter(id => id !== product.id));
                                                                            }
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div className="col-span-3">
                                                                    <div className="font-semibold text-sm text-slate-900">{product.name}</div>
                                                                    <div className="text-xs text-slate-500">{product.model}</div>
                                                                </div>
                                                                <div className="col-span-2 text-sm text-slate-700">
                                                                    <div className="flex items-center gap-1">
                                                                        <Building2 className="h-3 w-3 text-slate-400" />
                                                                        {product.order?.company || '-'}
                                                                    </div>
                                                                </div>
                                                                <div className="col-span-1 text-center">
                                                                    <Badge variant="secondary">{product.quantity}</Badge>
                                                                </div>
                                                                <div className="col-span-3 flex flex-wrap gap-1">
                                                                    {(product.foamQty ?? 0) > 0 && (
                                                                        <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium">
                                                                            S:{product.foamQty}
                                                                        </span>
                                                                    )}
                                                                    {(product.upholsteryQty ?? 0) > 0 && (
                                                                        <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">
                                                                            D:{product.upholsteryQty}
                                                                        </span>
                                                                    )}
                                                                    {(product.assemblyQty ?? 0) > 0 && (
                                                                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
                                                                            M:{product.assemblyQty}
                                                                        </span>
                                                                    )}
                                                                    {(product.packagedQty ?? 0) > 0 && (
                                                                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                                                                            P:{product.packagedQty}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="col-span-2 text-right">
                                                                    <div className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                                                                        {terminDate ? format(terminDate, "dd MMM", { locale: tr }) : '-'}
                                                                    </div>
                                                                    <Badge className={`text-xs mt-0.5 ${STATUS_COLORS[realStatus] || 'bg-slate-500'}`}>
                                                                        {STATUS_LABELS[realStatus] || realStatus}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Sevkiyat Dialog - Depoda Sekmesinden Sevk */}
            <Dialog open={!!shipDialogProduct} onOpenChange={(open) => { if (!open) { setShipDialogProduct(null); setShipQty(""); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Truck className="h-5 w-5 text-teal-600" />
                            Sevkiyat Oluştur
                        </DialogTitle>
                        <DialogDescription>
                            {shipDialogProduct?.name} — Depoda: {shipDialogProduct?.storedQty} adet
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-800">
                            <div><span className="font-medium">Firma:</span> {shipDialogProduct?.order?.company || '-'}</div>
                            <div><span className="font-medium">Sipariş:</span> {shipDialogProduct?.order?.name || '-'}</div>
                        </div>
                        <div className="space-y-2">
                            <Label>Sevk Edilecek Adet</Label>
                            <Input
                                type="number"
                                min="1"
                                max={shipDialogProduct?.storedQty ?? 0}
                                value={shipQty}
                                onChange={(e) => setShipQty(e.target.value)}
                                className="text-xl h-12 font-semibold"
                            />
                            <p className="text-xs text-slate-500">Maks: {shipDialogProduct?.storedQty ?? 0} adet</p>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => { setShipDialogProduct(null); setShipQty(""); }}
                            disabled={isShipping}
                        >
                            İptal
                        </Button>
                        <Button
                            className="flex-1 bg-teal-600 hover:bg-teal-700"
                            disabled={isShipping || !shipQty || parseInt(shipQty) <= 0}
                            onClick={async () => {
                                if (!shipDialogProduct) return;
                                const qty = parseInt(shipQty);
                                if (!qty || qty <= 0) return;
                                setIsShipping(true);
                                try {
                                    const result = await shipProduct({
                                        productId: shipDialogProduct.id,
                                        quantity: qty,
                                        company: shipDialogProduct.order?.company || "Belirtilmedi"
                                    });
                                    if (result.error) {
                                        toast.error(result.error);
                                    } else {
                                        toast.success(`${qty} adet sevk edildi!`);
                                        setShipDialogProduct(null);
                                        setShipQty("");
                                        router.refresh();
                                    }
                                } catch {
                                    toast.error("Sevkiyat sırasında hata oluştu");
                                } finally {
                                    setIsShipping(false);
                                }
                            }}
                        >
                            {isShipping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                            Sevk Et
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Ürün Düzenleme/Görüntüleme Dialog */}
            <Dialog open={!!(editingProduct || viewingProduct)} onOpenChange={(open) => {
                if (!open) {
                    setEditingProduct(null);
                    setViewingProduct(null);
                }
            }}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {(() => {
                        const product = editingProduct || viewingProduct;
                        const isEditing = !!editingProduct;

                        return (
                            <>
                                <DialogHeader>
                                    <DialogTitle className="text-xl">
                                        {isEditing ? 'Ürün Düzenle' : 'Ürün Detayları'}
                                    </DialogTitle>
                                    <DialogDescription>
                                        {product?.name} - {product?.model} ({product?.systemCode})
                                    </DialogDescription>
                                </DialogHeader>

                                {/* Tek görünüm - düzenleme modunda alanlar input olur */}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-sm">Durum Bilgileri</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-2 text-sm">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-muted-foreground">Durum:</span>
                                                    <div className="flex items-center gap-2">
                                                        {isEditingStatus ? (
                                                            <div className="flex items-center gap-2">
                                                                <Select value={editingStatus} onValueChange={setEditingStatus}>
                                                                    <SelectTrigger className="w-[180px] h-8">
                                                                        <SelectValue placeholder="Durum seçin" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="APPROVED">Onaylandı</SelectItem>
                                                                        <SelectItem value="IN_PRODUCTION">Üretimde</SelectItem>
                                                                        <SelectItem value="COMPLETED">Tamamlandı</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <Button size="sm" onClick={handleUpdateStatus} disabled={isPending}>
                                                                    Kaydet
                                                                </Button>
                                                                <Button size="sm" variant="ghost" onClick={() => setIsEditingStatus(false)}>
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <Badge className={STATUS_COLORS[product ? getProductRealStatus(product) : 'APPROVED']}>
                                                                    {product ? STATUS_LABELS[getProductRealStatus(product)] : '-'}
                                                                </Badge>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 p-0"
                                                                    onClick={() => {
                                                                        setIsEditingStatus(true);
                                                                        setEditingStatus(product?.status || 'APPROVED');
                                                                    }}
                                                                >
                                                                    <Edit className="h-3 w-3" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Ana Durum:</span>
                                                    <span className="font-medium text-xs">{product ? STATUS_LABELS[product.status] : '-'}</span>
                                                </div>
                                                {product?.subStatus && (
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Alt Durum:</span>
                                                        <span className="font-medium">{product.subStatus}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Üretilen:</span>
                                                    <span className="font-medium">{product?.produced || 0} / {product?.quantity}</span>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-sm">Tarih Bilgileri</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Sipariş Tarihi:</span>
                                                    <span className="font-medium">
                                                        {product?.orderDate ? format(new Date(product.orderDate), 'dd MMM yyyy', { locale: tr }) : '-'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-muted-foreground">Termin Tarihi:</span>
                                                    {isEditing ? (
                                                        <Input
                                                            type="date"
                                                            value={editTerminDate}
                                                            onChange={(e) => setEditTerminDate(e.target.value)}
                                                            className="w-[160px] h-8 text-sm"
                                                        />
                                                    ) : (
                                                        <span className="font-medium">
                                                            {product?.terminDate ? format(new Date(product.terminDate), 'dd MMM yyyy', { locale: tr }) : '-'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-muted-foreground">Üretim Tarihi:</span>
                                                    {isEditing ? (
                                                        <Input
                                                            type="date"
                                                            value={editProductionDate}
                                                            onChange={(e) => setEditProductionDate(e.target.value)}
                                                            className="w-[160px] h-8 text-sm"
                                                        />
                                                    ) : (
                                                        <span className="font-medium">
                                                            {product?.productionDate ? format(new Date(product.productionDate), 'dd MMM yyyy', { locale: tr }) : '-'}
                                                        </span>
                                                    )}
                                                </div>
                                                {isEditing && (
                                                    <div className="flex justify-between items-center pt-1">
                                                        <span className="text-muted-foreground">Usta:</span>
                                                        <Select value={editMaster || "NONE"} onValueChange={(val) => setEditMaster(val === "NONE" ? "" : val)}>
                                                            <SelectTrigger className="w-[160px] h-8 text-sm">
                                                                <SelectValue placeholder="Usta Seç" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="NONE">Usta Atanmamış</SelectItem>
                                                                {uniqueMasters.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Cari Bilgileri */}
                                    {product?.order && (
                                        <Card className="border-blue-200 bg-blue-50/40">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
                                                    <Building2 className="h-4 w-4" />
                                                    Cari Bilgileri
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Firma</p>
                                                        <p className="font-semibold text-slate-800">{product.order.company || '-'}</p>
                                                    </div>
                                                    {product.order.externalId && (
                                                        <div>
                                                            <p className="text-xs text-muted-foreground">NetSim Cari Kodu</p>
                                                            <p className="font-medium font-mono text-slate-700">{product.order.externalId}</p>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Sipariş Adı</p>
                                                        <p className="font-medium text-slate-700">{product.order.name || '-'}</p>
                                                    </div>
                                                    {product.order.deliveryDate && (
                                                        <div>
                                                            <p className="text-xs text-muted-foreground">Teslim Tarihi</p>
                                                            <p className="font-medium text-slate-700">
                                                                {format(new Date(product.order.deliveryDate), 'dd MMM yyyy', { locale: tr })}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {product.order.totalAmount != null && (
                                                        <div>
                                                            <p className="text-xs text-muted-foreground">Sipariş Tutarı</p>
                                                            <p className="font-semibold text-blue-700">
                                                                {product.order.totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                                                {' '}{product.order.currency || 'TL'}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-sm flex items-center gap-2">
                                                <Wrench className="h-4 w-4" />
                                                Üretim Aşamaları
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-4">
                                                {/* Görsel Progress Bar */}
                                                <div className="flex gap-1 h-10 rounded-lg overflow-hidden bg-slate-100">
                                                    {(() => {
                                                        if (!product) return null;
                                                        const stageValues = isEditing
                                                            ? [
                                                                { value: editFoamQty, color: 'bg-purple-500', label: 'Sünger' },
                                                                { value: editUpholsteryQty, color: 'bg-yellow-500', label: 'Döşeme' },
                                                                { value: editAssemblyQty, color: 'bg-orange-500', label: 'Montaj' },
                                                                { value: editPackagedQty, color: 'bg-blue-500', label: 'Paket' },
                                                                { value: editStoredQty, color: 'bg-green-500', label: 'Depo' },
                                                                { value: editShippedQty, color: 'bg-teal-500', label: 'Sevk' },
                                                            ]
                                                            : [
                                                                { value: product.foamQty || 0, color: 'bg-purple-500', label: 'Sünger' },
                                                                { value: product.upholsteryQty || 0, color: 'bg-yellow-500', label: 'Döşeme' },
                                                                { value: product.assemblyQty || 0, color: 'bg-orange-500', label: 'Montaj' },
                                                                { value: product.packagedQty || 0, color: 'bg-blue-500', label: 'Paket' },
                                                                { value: product.storedQty || 0, color: 'bg-green-500', label: 'Depo' },
                                                                { value: product.shippedQty || 0, color: 'bg-teal-500', label: 'Sevk' },
                                                            ];

                                                        return stageValues.map((stage, i) => {
                                                            const width = (stage.value / product.quantity) * 100;
                                                            if (width === 0) return null;
                                                            return (
                                                                <div
                                                                    key={i}
                                                                    className={`${stage.color} flex items-center justify-center text-white text-sm font-bold transition-all`}
                                                                    style={{ width: `${width}%` }}
                                                                    title={`${stage.label}: ${stage.value}`}
                                                                >
                                                                    {stage.value > 0 && stage.value}
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>

                                                {/* Adet Kartları - düzenleme modunda input */}
                                                <div className="grid grid-cols-6 gap-2">
                                                    {[
                                                        { label: 'Sünger', value: product?.foamQty || 0, editValue: editFoamQty, setter: setEditFoamQty, bgColor: 'bg-purple-50', textColor: 'text-purple-600', numColor: 'text-purple-700', borderColor: 'border-purple-200' },
                                                        { label: 'Döşeme', value: product?.upholsteryQty || 0, editValue: editUpholsteryQty, setter: setEditUpholsteryQty, bgColor: 'bg-yellow-50', textColor: 'text-yellow-600', numColor: 'text-yellow-700', borderColor: 'border-yellow-200' },
                                                        { label: 'Montaj', value: product?.assemblyQty || 0, editValue: editAssemblyQty, setter: setEditAssemblyQty, bgColor: 'bg-orange-50', textColor: 'text-orange-600', numColor: 'text-orange-700', borderColor: 'border-orange-200' },
                                                        { label: 'Paket', value: product?.packagedQty || 0, editValue: editPackagedQty, setter: setEditPackagedQty, bgColor: 'bg-blue-50', textColor: 'text-blue-600', numColor: 'text-blue-700', borderColor: 'border-blue-200' },
                                                        {
                                                            label: 'Depo', value: product?.storedQty || 0, editValue: editStoredQty,
                                                            setter: (val: number) => {
                                                                const origStored = editingProduct?.storedQty ?? 0;
                                                                const origPackaged = editingProduct?.packagedQty ?? 0;
                                                                const netChange = val - origStored;
                                                                // storedQty artışını packagedQty'den otomatik düş
                                                                setEditPackagedQty(Math.max(0, origPackaged - netChange));
                                                                setEditStoredQty(val);
                                                            },
                                                            bgColor: 'bg-green-50', textColor: 'text-green-600', numColor: 'text-green-700', borderColor: 'border-green-200'
                                                        },
                                                    ].map((stage) => (
                                                        <div key={stage.label} className={`${stage.bgColor} p-3 rounded-lg text-center border ${stage.borderColor}`}>
                                                            <p className={`${stage.textColor} text-xs font-medium`}>{stage.label}</p>
                                                            {isEditing ? (
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    max={product?.quantity || 0}
                                                                    value={stage.editValue}
                                                                    onChange={(e) => stage.setter(parseInt(e.target.value) || 0)}
                                                                    className={`w-full h-10 text-center text-lg font-bold mt-1 ${stage.numColor}`}
                                                                />
                                                            ) : (
                                                                <p className={`text-2xl font-bold ${stage.numColor}`}>{stage.value}</p>
                                                            )}
                                                        </div>
                                                    ))}

                                                    {/* Sevk - Özel alanı */}
                                                    <div className="bg-teal-50 p-3 rounded-lg text-center border border-teal-200">
                                                        <p className="text-teal-600 text-xs font-medium">Sevk</p>
                                                        {isEditing ? (
                                                            <>
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    max={product?.quantity || 0}
                                                                    value={editShippedQty}
                                                                    onChange={(e) => setEditShippedQty(parseInt(e.target.value) || 0)}
                                                                    className="w-full h-10 text-center text-lg font-bold mt-1 text-teal-700"
                                                                />
                                                                {editShippedQty > (product?.shippedQty || 0) && (
                                                                    <p className="text-xs mt-1 text-muted-foreground">
                                                                        {editStoredQty > 0 ? (
                                                                            <span className="text-green-600">✓ Depodan düşülecek: {Math.min(editShippedQty - (product?.shippedQty || 0), editStoredQty)}</span>
                                                                        ) : (
                                                                            <span className="text-amber-600">⚠ Depoda stok yok, sevk edilebilir</span>
                                                                        )}
                                                                    </p>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <p className="text-2xl font-bold text-teal-700">{product?.shippedQty || 0}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-sm">Ürün Özellikleri</CardTitle>
                                        </CardHeader>
                                        <CardContent className="grid grid-cols-2 gap-3 text-sm">
                                            {[
                                                { label: 'Malzeme', value: product?.material, editValue: editMaterial, setter: setEditMaterial },
                                                { label: 'Ayak Tipi', value: product?.footType, editValue: editFootType, setter: setEditFootType },
                                                { label: 'Ayak Malzeme', value: product?.footMaterial, editValue: editFootMaterial, setter: setEditFootMaterial },
                                                { label: 'Kol Tipi', value: product?.armType, editValue: editArmType, setter: setEditArmType },
                                                { label: 'Sırt Tipi', value: product?.backType, editValue: editBackType, setter: setEditBackType },
                                                { label: 'Kumaş Tipi', value: product?.fabricType, editValue: editFabricType, setter: setEditFabricType },
                                            ].map((field) => (
                                                <div key={field.label}>
                                                    <span className="text-muted-foreground">{field.label}:</span>
                                                    {isEditing ? (
                                                        <Input
                                                            value={field.editValue}
                                                            onChange={(e) => field.setter(e.target.value)}
                                                            className="h-8 mt-1"
                                                            placeholder={field.label}
                                                        />
                                                    ) : (
                                                        <p className="font-medium">{field.value || '-'}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>

                                    {/* Mühendis Notu - düzenleme modunda textarea */}
                                    {(isEditing || product?.engineerNote) && (
                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-sm">Mühendis Notu</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                {isEditing ? (
                                                    <Textarea
                                                        value={editEngineerNote}
                                                        onChange={(e) => setEditEngineerNote(e.target.value)}
                                                        placeholder="Mühendis notu..."
                                                        rows={3}
                                                    />
                                                ) : (
                                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product?.engineerNote}</p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Açıklama / Not - düzenleme modunda textarea */}
                                    {(isEditing || product?.description) && (
                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-sm">Açıklama / Not</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                {isEditing ? (
                                                    <Textarea
                                                        value={editDescription}
                                                        onChange={(e) => setEditDescription(e.target.value)}
                                                        placeholder="Ürün hakkında notlar..."
                                                        rows={3}
                                                    />
                                                ) : (
                                                    <p className="text-sm whitespace-pre-wrap">{product?.description}</p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* NetSim Açıklamaları & Bilgiler */}
                                    {(product?.aciklama1 || product?.aciklama2 || product?.aciklama3 || product?.aciklama4 || product?.dstAdi || product?.marketingDescription) && (
                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-sm flex items-center gap-2">
                                                    📋 Satış / NetSim Açıklamaları
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                {product?.marketingDescription && (
                                                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                                                        <p className="text-xs font-bold text-blue-900 mb-1">Satış/Pazarlama Notu:</p>
                                                        <p className="text-sm font-medium text-blue-800 whitespace-pre-wrap">{product.marketingDescription}</p>
                                                    </div>
                                                )}
                                                {product?.dstAdi && (
                                                    <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg">
                                                        <p className="text-xs font-semibold text-indigo-900 mb-1">DST (Değişken Stok):</p>
                                                        <p className="text-sm font-medium text-indigo-800">{product.dstAdi}</p>
                                                    </div>
                                                )}
                                                {product?.aciklama1 && (
                                                    <div>
                                                        <p className="text-xs font-semibold text-muted-foreground mb-1">Açıklama 1:</p>
                                                        <p className="text-sm whitespace-pre-wrap bg-slate-50 p-2 rounded border">{product.aciklama1}</p>
                                                    </div>
                                                )}
                                                {product?.aciklama2 && (
                                                    <div>
                                                        <p className="text-xs font-semibold text-muted-foreground mb-1">Açıklama 2:</p>
                                                        <p className="text-sm whitespace-pre-wrap bg-slate-50 p-2 rounded border">{product.aciklama2}</p>
                                                    </div>
                                                )}
                                                {product?.aciklama3 && (
                                                    <div>
                                                        <p className="text-xs font-semibold text-muted-foreground mb-1">Açıklama 3:</p>
                                                        <p className="text-sm whitespace-pre-wrap bg-slate-50 p-2 rounded border">{product.aciklama3}</p>
                                                    </div>
                                                )}
                                                {product?.aciklama4 && (
                                                    <div>
                                                        <p className="text-xs font-semibold text-muted-foreground mb-1">Açıklama 4:</p>
                                                        <p className="text-sm whitespace-pre-wrap bg-slate-50 p-2 rounded border">{product.aciklama4}</p>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>

                                <DialogFooter>
                                    {viewingProduct && userRole === "ADMIN" ? (
                                        <>
                                            <div className="flex-1 flex justify-start">
                                                <Button
                                                    variant="destructive"
                                                    onClick={() => handleDeleteProduct(viewingProduct)}
                                                    disabled={isPending}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Sil
                                                </Button>
                                            </div>
                                            <Button variant="outline" onClick={() => setViewingProduct(null)}>
                                                Kapat
                                            </Button>
                                            <Button onClick={() => {
                                                handleEditProduct(viewingProduct);
                                                setViewingProduct(null);
                                            }}>
                                                <Edit className="h-4 w-4 mr-2" />
                                                Düzenle
                                            </Button>
                                        </>
                                    ) : editingProduct ? (
                                        <>
                                            <div className="flex-1 flex justify-start">
                                                <Button
                                                    variant="destructive"
                                                    onClick={() => handleDeleteProduct(editingProduct)}
                                                    disabled={isPending}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Sil
                                                </Button>
                                            </div>
                                            <Button variant="outline" onClick={() => setEditingProduct(null)}>
                                                İptal
                                            </Button>
                                            <Button onClick={handleUpdateProduct} disabled={isPending}>
                                                {isPending ? 'Güncelleniyor...' : 'Kaydet'}
                                            </Button>
                                        </>
                                    ) : (
                                        <Button variant="outline" onClick={() => setViewingProduct(null)}>
                                            Kapat
                                        </Button>
                                    )}
                                </DialogFooter>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Floating Bottom Action Bar */}
            {selectedProductIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 animate-in slide-in-from-bottom-4">
                    <span className="font-medium">
                        {selectedProductIds.length} ürün seçili
                    </span>
                    <span className="font-medium">
                        {products.filter(p => selectedProductIds.includes(p.id)).reduce((sum, p) => sum + p.quantity, 0)} adet
                    </span>

                    <div className="h-6 w-px bg-slate-600" />

                    <Button
                        onClick={() => setIsSemiFinishedDialogOpen(true)}
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        <Factory className="h-4 w-4 mr-2" />
                        Yarı Mamül Üretime Gönder
                    </Button>

                    <div className="h-6 w-px bg-slate-600" />

                    <Button
                        onClick={handleExportSelected}
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-slate-800 hover:text-white"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Seçilenleri İndir
                    </Button>

                    <div className="h-6 w-px bg-slate-600" />

                    <Button
                        onClick={handleSendToProduction}
                        disabled={isPending}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <Send className="h-4 w-4 mr-2" />
                        Üretime Gönder
                    </Button>

                    <div className="h-6 w-px bg-slate-600" />

                    <Button
                        onClick={() => setSelectedProductIds([])}
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-slate-800 hover:text-white"
                    >
                        <X className="h-4 w-4 mr-2" />
                        Seçimi Temizle
                    </Button>
                </div>
            )}

            {/* Yarı Mamül Üretime Gönderme Dialog */}
            <SendToSemiFinishedDialog
                open={isSemiFinishedDialogOpen}
                onOpenChange={setIsSemiFinishedDialogOpen}
                selectedProductIds={selectedProductIds}
                products={products}
                onSuccess={() => {
                    setSelectedProductIds([]);
                    router.refresh();
                }}
            />
        </div>
    );
}
