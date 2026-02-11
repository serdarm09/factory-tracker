'use client';

import { useState, useMemo, useTransition } from "react";
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
import { Calendar, Package, AlertTriangle, Building2, User, Send, ChevronLeft, ChevronRight, List, Users, CalendarIcon, Edit, Filter, Clock, Download, X, Wrench } from "lucide-react";
import { format, isBefore, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, addWeeks, subWeeks, parseISO, startOfDay } from "date-fns";
import { tr } from "date-fns/locale";
import { sendProductsToProduction, updateProductionDate, updateProductStatus } from "@/lib/actions/product-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';

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
    shippedQty?: number;
    engineerNote?: string | null;
    aciklama1?: string | null;
    aciklama2?: string | null;
    aciklama3?: string | null;
    aciklama4?: string | null;
    dstAdi?: string | null;
    order?: {
        company: string;
        name: string;
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
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterMaster, setFilterMaster] = useState<string>("all");
    const [filterSubStatus, setFilterSubStatus] = useState<string>("all");
    const [filterRealStatus, setFilterRealStatus] = useState<string>("all"); // Yeni: Gerçek durum filtresi
    const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
    const [isPending, startTransition] = useTransition();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'list' | 'master'>('master'); // Default: Usta Bazlı
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
    const [showSentToProduction, setShowSentToProduction] = useState(true); // Default: Tüm ürünleri göster
    const [dateViewMode, setDateViewMode] = useState<'termin' | 'production'>('termin');
    const [isEditingStatus, setIsEditingStatus] = useState(false);
    const [editingStatus, setEditingStatus] = useState<string>("");

    // Filtrelenmiş ürünler
    const filteredProducts = useMemo(() => {
        let filtered = products;

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
    }, [products, filterStatus, filterRealStatus, filterMaster, filterSubStatus, startDateFilter, endDateFilter, showOverdue, showSentToProduction, dateViewMode]);

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
                window.location.reload();
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
                // Sayfayı yenile
                window.location.reload();
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
            <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-blue-900">İş Emri Listesi</h2>
                            <p className="text-sm text-blue-600 mt-1">
                                Üretime göndermek için ürünleri seçin
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-white text-lg px-4 py-2">
                                {filteredProducts.length} ürün
                            </Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Takvim Görünümü - Üstte Sabit */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <CalendarIcon className="h-5 w-5 text-blue-600" />
                            <CardTitle className="text-lg">Üretim Takvimi</CardTitle>
                            <div className="flex items-center gap-1 border rounded-md">
                                <Button
                                    variant={calendarView === 'week' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setCalendarView('week')}
                                    className="h-8"
                                >
                                    Haftalık
                                </Button>
                                <Button
                                    variant={calendarView === 'month' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setCalendarView('month')}
                                    className="h-8"
                                >
                                    Aylık
                                </Button>
                            </div>
                            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                                <Button
                                    variant={dateViewMode === 'termin' ? 'default' : 'ghost'}
                                    size="sm"
                                    className={`h-8 text-xs ${dateViewMode === 'termin' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                                    onClick={() => setDateViewMode('termin')}
                                >
                                    <Calendar className="h-3.5 w-3.5 mr-1" />
                                    Termin
                                </Button>
                                <Button
                                    variant={dateViewMode === 'production' ? 'default' : 'ghost'}
                                    size="sm"
                                    className={`h-8 text-xs ${dateViewMode === 'production' ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                                    onClick={() => setDateViewMode('production')}
                                >
                                    <Wrench className="h-3.5 w-3.5 mr-1" />
                                    Üretim
                                </Button>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={goToPrevious}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-lg font-semibold min-w-[200px] text-center">
                                {calendarView === 'week'
                                    ? `${format(calendarStart, "dd MMM", { locale: tr })} - ${format(calendarEnd, "dd MMM yyyy", { locale: tr })}`
                                    : format(currentDate, "MMMM yyyy", { locale: tr })
                                }
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={goToNext}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentDate(new Date())}
                            >
                                Bugün
                            </Button>
                        </div>
                        {selectedProductIds.length > 0 && (
                            <Badge className="bg-green-600 text-white">
                                {selectedProductIds.length} seçili
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Takvim Grid */}
                    <div className="grid grid-cols-7 gap-2">
                        {/* Hafta Günleri */}
                        {weekDays.map(day => (
                            <div key={day} className="text-center font-semibold text-sm text-slate-600 py-2">
                                {day}
                            </div>
                        ))}

                        {/* Takvim Günleri */}
                        {calendarDays.map(day => {
                            const dateKey = format(day, 'yyyy-MM-dd');
                            const dayProducts = productsByDate[dateKey] || [];
                            const isCurrentMonth = isSameMonth(day, currentDate);
                            const isTodayDate = isToday(day);

                            return (
                                <div
                                    key={day.toISOString()}
                                    className={`
                                        min-h-[120px] border rounded-lg p-2
                                        ${!isCurrentMonth ? 'bg-slate-50 text-slate-400' : 'bg-white'}
                                        ${isTodayDate ? 'border-blue-500 border-2 bg-blue-50' : 'border-slate-200'}
                                    `}
                                >
                                    <div className={`text-sm font-semibold mb-1 ${isTodayDate ? 'text-blue-600' : ''}`}>
                                        {format(day, 'd')}
                                    </div>

                                    <div className="space-y-1">
                                        {dayProducts.map(product => {
                                            const isSelected = selectedProductIds.includes(product.id);
                                            // AI NOTE: Scheduling Logic
                                            // Sevk durumunu kontrol et
                                            const isShipped = (product.shippedQty || 0) >= product.quantity;
                                            const hasProductionDate = !!product.productionDate;
                                            const isScheduledDay = hasProductionDate && isSameDay(new Date(product.productionDate!), day);
                                            const isTerminDay = product.terminDate && isSameDay(new Date(product.terminDate), day);

                                            return (
                                                <div
                                                    key={product.id}
                                                    className={`
                                                        text-xs p-1.5 rounded cursor-pointer transition-all group relative border-l-2
                                                        ${isSelected ? 'bg-blue-500 text-white border-blue-700' :
                                                            isShipped
                                                                ? 'bg-teal-50 hover:bg-teal-100 border-teal-500' // Sevk Edilmiş
                                                                : isScheduledDay
                                                                    ? 'bg-green-50 hover:bg-green-100 border-green-500' // Planlanmış (Üretim Tarihi)
                                                                    : 'bg-slate-50 hover:bg-slate-100 border-amber-400' // Planlanmamış (Termin Tarihi)
                                                        }
                                                    `}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setSelectedProductIds(selectedProductIds.filter(id => id !== product.id));
                                                        } else {
                                                            setSelectedProductIds([...selectedProductIds, product.id]);
                                                        }
                                                    }}
                                                    onDoubleClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditProduct(product);
                                                    }}
                                                >
                                                    <div className="font-medium truncate">{product.name}</div>
                                                    <div className="text-[10px] opacity-80 flex items-center gap-1">
                                                        {isShipped ? (
                                                            <span title="Sevk Edildi">✅</span>
                                                        ) : isScheduledDay ? (
                                                            <span title="Üretim Planlandı">📅</span>
                                                        ) : (
                                                            <span title="Termin Tarihi (Planlanmamış)">⚠️</span>
                                                        )}
                                                        {product.quantity} adet
                                                    </div>
                                                    {product.master && (
                                                        <div className="text-[10px] opacity-80 truncate">
                                                            {product.master}
                                                        </div>
                                                    )}
                                                    {userRole === "ADMIN" && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditProduct(product);
                                                            }}
                                                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 bg-white rounded hover:bg-blue-100"
                                                        >
                                                            <Edit className="h-3 w-3 text-blue-600" />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

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
                        {/* Filtre Satırı 1: Durum Filtreleri */}
                        <div className="flex flex-wrap gap-2">
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
                                <label htmlFor="showOverdue" className="text-sm cursor-pointer flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-red-600" />
                                    Geçikenler
                                    <Badge variant="outline" className="ml-0.5 bg-red-50 text-red-600 border-red-200 text-xs px-1.5">
                                        {overdueCount}
                                    </Badge>
                                </label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="showSentToProduction"
                                    checked={showSentToProduction}
                                    onCheckedChange={(checked) => setShowSentToProduction(checked as boolean)}
                                />
                                <label htmlFor="showSentToProduction" className="text-sm cursor-pointer flex items-center gap-1">
                                    <Package className="h-3 w-3 text-green-600" />
                                    Üretime Gönderilenler
                                    <Badge variant="outline" className="ml-0.5 bg-green-50 text-green-600 border-green-200 text-xs px-1.5">
                                        {inProductionCount}
                                    </Badge>
                                </label>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Alt Kısım - Liste ve Usta Bazlı Sekmeler */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="master" className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Usta Bazlı
                        </TabsTrigger>
                        <TabsTrigger value="list" className="flex items-center gap-2">
                            <List className="h-4 w-4" />
                            Liste
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
            </Tabs>

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
                                                        { label: 'Depo', value: product?.storedQty || 0, editValue: editStoredQty, setter: setEditStoredQty, bgColor: 'bg-green-50', textColor: 'text-green-600', numColor: 'text-green-700', borderColor: 'border-green-200' },
                                                        { label: 'Sevk', value: product?.shippedQty || 0, editValue: editShippedQty, setter: setEditShippedQty, bgColor: 'bg-teal-50', textColor: 'text-teal-600', numColor: 'text-teal-700', borderColor: 'border-teal-200' },
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
                                    {(product?.aciklama1 || product?.aciklama2 || product?.aciklama3 || product?.aciklama4 || product?.dstAdi) && (
                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-sm flex items-center gap-2">
                                                    📋 NetSim Açıklamaları
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                {product?.dstAdi && (
                                                    <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg">
                                                        <p className="text-xs font-semibold text-indigo-600 mb-1">DST (Değişken Stok):</p>
                                                        <p className="text-sm font-medium text-indigo-900">{product.dstAdi}</p>
                                                    </div>
                                                )}
                                                {product?.aciklama1 && (
                                                    <div>
                                                        <p className="text-xs font-semibold text-muted-foreground mb-1">Açıklama 1:</p>
                                                        <p className="text-sm whitespace-pre-wrap bg-slate-50 p-2 rounded">{product.aciklama1}</p>
                                                    </div>
                                                )}
                                                {product?.aciklama2 && (
                                                    <div>
                                                        <p className="text-xs font-semibold text-muted-foreground mb-1">Açıklama 2:</p>
                                                        <p className="text-sm whitespace-pre-wrap bg-slate-50 p-2 rounded">{product.aciklama2}</p>
                                                    </div>
                                                )}
                                                {product?.aciklama3 && (
                                                    <div>
                                                        <p className="text-xs font-semibold text-muted-foreground mb-1">Açıklama 3:</p>
                                                        <p className="text-sm whitespace-pre-wrap bg-slate-50 p-2 rounded">{product.aciklama3}</p>
                                                    </div>
                                                )}
                                                {product?.aciklama4 && (
                                                    <div>
                                                        <p className="text-xs font-semibold text-muted-foreground mb-1">Açıklama 4:</p>
                                                        <p className="text-sm whitespace-pre-wrap bg-slate-50 p-2 rounded">{product.aciklama4}</p>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>

                                <DialogFooter>
                                    {viewingProduct && userRole === "ADMIN" ? (
                                        <>
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
        </div>
    );
}
