'use client';

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProductImage } from "@/components/product-image";
import { updateProduct, getMasters, sendToApproval } from "@/lib/actions";
import { toast } from "sonner";
import { Loader2, X, Upload } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FeatureCombobox } from "./feature-combobox";
import { ProductCombobox } from "./product-combobox";

interface ProductDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product: any;
    userRole: string;
}

export function ProductDetailDialog({ open, onOpenChange, product, userRole }: ProductDetailDialogProps) {
    const [loading, setLoading] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        model: "",
        company: "",
        master: "",
        quantity: 0,
        systemCode: "",
        orderDate: null as Date | null,
        terminDate: null as Date | null,
        footType: "",
        footMaterial: "",
        armType: "",
        backType: "",
        fabricType: "",
        material: "",
        description: ""
    });

    const [masters, setMasters] = useState<{ id: number; name: string }[]>([]);

    useEffect(() => {
        getMasters().then(setMasters);
    }, []);

    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name || "",
                model: product.model || "",
                company: product.order?.company || product.company || "",
                master: product.master || "",
                quantity: product.quantity || 0,
                systemCode: product.systemCode || "",
                orderDate: product.orderDate ? new Date(product.orderDate) : null,
                terminDate: product.terminDate ? new Date(product.terminDate) : null,
                footType: product.footType || "",
                footMaterial: product.footMaterial || "",
                armType: product.armType || "",
                backType: product.backType || "",
                fabricType: product.fabricType || "",
                material: product.material || "",
                description: product.description || ""
            });
            setImagePreview(product.imageUrl || null);
            setImageFile(null);
        }
    }, [product]);

    if (!product) return null;

    const canEdit = ["ADMIN", "PLANNER"].includes(userRole);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCatalogSelect = (catalogProduct: any) => {
        if (catalogProduct) {
            setFormData(prev => ({
                ...prev,
                name: catalogProduct.name || prev.name,
                model: catalogProduct.model || prev.model,
                systemCode: catalogProduct.systemCode || prev.systemCode
            }));
            if (catalogProduct.imageUrl) {
                setImagePreview(catalogProduct.imageUrl);
            }
        }
    };

    // Güncelle ve Onaya Gönder
    const handleSubmit = async (sendApproval: boolean = false) => {
        if (!formData.terminDate) {
            toast.error("Lütfen termin tarihi seçin");
            return;
        }

        if (!formData.quantity || formData.quantity <= 0) {
            toast.error("Lütfen geçerli bir adet girin");
            return;
        }

        // Validation: If Foot Type is selected, Foot Material is required
        if (formData.footType && !formData.footMaterial) {
            toast.error("Ayak Modeli seçildiğinde, Ayak Özelliği (Materyal/Renk) seçilmesi zorunludur.");
            return;
        }

        setLoading(true);
        try {
            const submitData = new FormData();
            submitData.append("name", formData.name);
            submitData.append("model", formData.model);
            submitData.append("systemCode", formData.systemCode);
            submitData.append("quantity", formData.quantity.toString());
            submitData.append("terminDate", format(formData.terminDate, "yyyy-MM-dd"));
            submitData.append("master", formData.master);
            submitData.append("footType", formData.footType);
            submitData.append("footMaterial", formData.footMaterial);
            submitData.append("armType", formData.armType);
            submitData.append("backType", formData.backType);
            submitData.append("fabricType", formData.fabricType);
            submitData.append("material", formData.material);
            submitData.append("description", formData.description);
            if (formData.orderDate) {
                submitData.append("orderDate", format(formData.orderDate, "yyyy-MM-dd"));
            }
            if (imageFile) {
                submitData.append("image", imageFile);
            }

            // Önce güncelle
            const updateResult = await updateProduct(product.id, submitData);

            if (updateResult?.error) {
                toast.error(updateResult.error);
                return;
            }

            // Onaya gönder (eğer sendApproval true ise ve henüz onaylanmamışsa)
            if (sendApproval && !["APPROVED", "IN_PRODUCTION", "COMPLETED", "SHIPPED"].includes(product.status)) {
                const approvalResult = await sendToApproval(product.id);
                if (approvalResult?.error) {
                    toast.error(approvalResult.error);
                    return;
                }
                toast.success("Ürün güncellendi ve onaya gönderildi");
            } else {
                toast.success("Ürün güncellendi");
            }

            onOpenChange(false);
        } catch (error) {
            toast.error("İşlem başarısız");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>Mevcut Planı Düzenle</DialogTitle>
                    </div>
                    <p className="text-sm text-slate-500">
                        Reddedilen veya hatalı girilen planı buradan güncelleyebilirsiniz. Güncelleme sonrası ürün durumu tekrar değerlendirilecektir.
                    </p>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    {/* NetSim Sipariş Bilgileri (En Üstte) */}
                    {(product.aciklama1 || product.aciklama2 || product.aciklama3 || product.aciklama4 || product.dstAdi) && (
                        <div className="space-y-2">
                            <Label className="text-amber-700 font-semibold text-base">📋 NetSim Sipariş Bilgileri</Label>
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                                {/* Renk Bilgisi */}
                                {product.dstAdi && (
                                    <div className="bg-blue-50 p-3 rounded border border-blue-200 text-sm mb-3">
                                        <span className="font-medium text-blue-700">🎨 Renk/DST:</span> <span className="font-bold text-blue-900">{product.dstAdi}</span>
                                    </div>
                                )}
                                {/* Açıklamalar */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {product.aciklama1 && (
                                        <div className="bg-white p-2 rounded border border-amber-100 text-sm">
                                            <span className="font-medium text-amber-700">Açıklama 1:</span> {product.aciklama1}
                                        </div>
                                    )}
                                    {product.aciklama2 && (
                                        <div className="bg-white p-2 rounded border border-amber-100 text-sm">
                                            <span className="font-medium text-amber-700">Açıklama 2:</span> {product.aciklama2}
                                        </div>
                                    )}
                                    {product.aciklama3 && (
                                        <div className="bg-white p-2 rounded border border-amber-100 text-sm">
                                            <span className="font-medium text-amber-700">Açıklama 3:</span> {product.aciklama3}
                                        </div>
                                    )}
                                    {product.aciklama4 && (
                                        <div className="bg-white p-2 rounded border border-amber-100 text-sm">
                                            <span className="font-medium text-amber-700">Açıklama 4:</span> {product.aciklama4}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Ürün Ara (Katalogdan Seç) */}
                    <div className="space-y-2">
                        <Label>Ürün Ara (Katalogdan Seç)</Label>
                        <ProductCombobox
                            onSelect={handleCatalogSelect}
                            placeholder="Ürün ara (Kod veya İsim)..."
                            disabled={!canEdit || loading}
                        />
                    </div>

                    {/* Ürün Resmi */}
                    <div className="space-y-2">
                        <Label>Ürün Resmi</Label>
                        <div className="flex items-center gap-4">
                            {imagePreview && (
                                <div className="relative h-16 w-16 rounded-lg overflow-hidden border bg-slate-100">
                                    <ProductImage
                                        src={imagePreview}
                                        alt={formData.name}
                                        className="object-contain w-full h-full"
                                    />
                                </div>
                            )}
                            <div className="flex-1">
                                <label className={cn(
                                    "flex items-center justify-center w-full h-12 border-2 border-dashed rounded-lg cursor-pointer",
                                    "hover:bg-slate-50 transition-colors",
                                    !canEdit && "opacity-50 cursor-not-allowed"
                                )}>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        disabled={!canEdit || loading}
                                        className="hidden"
                                    />
                                    <span className="text-sm text-slate-500">
                                        {imageFile ? imageFile.name : "Seçilen dosya yok"}
                                    </span>
                                </label>
                                <p className="text-xs text-slate-400 mt-1">Ürün resmini yükleyebilirsiniz.</p>
                            </div>
                        </div>
                    </div>

                    {/* Ürün Adı ve Model */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Ürün Adı</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                disabled={!canEdit || loading}
                                className="bg-blue-50 border-blue-200"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Model</Label>
                            <Input
                                value={formData.model}
                                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                disabled={!canEdit || loading}
                            />
                        </div>
                    </div>

                    {/* Firma / Müşteri ve Atanan Usta */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Firma / Müşteri</Label>
                            <Input
                                value={formData.company}
                                disabled
                                className="bg-slate-50"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Atanan Usta</Label>
                            <Select
                                value={formData.master || undefined}
                                onValueChange={(value) => setFormData({ ...formData, master: value === "_none_" ? "" : value })}
                                disabled={!canEdit || loading}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Usta Seçiniz..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="_none_">Seçiniz...</SelectItem>
                                    {masters.map(m => (
                                        <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Adet ve Ürün Kodu */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Adet</Label>
                            <Input
                                type="number"
                                min="1"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                                disabled={!canEdit || loading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Ürün Kodu</Label>
                            <Input
                                value={formData.systemCode}
                                disabled
                                className="bg-blue-50 border-blue-200 text-blue-600"
                            />
                        </div>
                    </div>

                    {/* Sipariş Tarihi ve Termin Tarihi */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Sipariş Tarihi</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        type="button"
                                        disabled={!canEdit || loading}
                                        className={cn(
                                            "w-full pl-3 text-left font-normal justify-start",
                                            !formData.orderDate && "text-muted-foreground"
                                        )}
                                    >
                                        {formData.orderDate ? format(formData.orderDate, "d MMMM yyyy", { locale: tr }) : <span>Tarih seçin</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={formData.orderDate || undefined}
                                        onSelect={(date) => setFormData({ ...formData, orderDate: date || null })}
                                        locale={tr}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label>Termin Tarihi</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        type="button"
                                        disabled={!canEdit || loading}
                                        className={cn(
                                            "w-full pl-3 text-left font-normal justify-start",
                                            !formData.terminDate && "text-muted-foreground"
                                        )}
                                    >
                                        {formData.terminDate ? format(formData.terminDate, "d MMMM yyyy", { locale: tr }) : <span>Tarih seçin</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={formData.terminDate || undefined}
                                        onSelect={(date) => setFormData({ ...formData, terminDate: date || null })}
                                        locale={tr}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Ürün Özellikleri (Opsiyonel) */}
                    <div className="space-y-4">
                        <Label className="text-sm font-medium text-slate-700">Ürün Özellikleri (Opsiyonel)</Label>

                        {/* Ayak Modeli ve Ayak Özelliği */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm text-slate-600">Ayak Modeli</Label>
                                <FeatureCombobox
                                    category="FOOT_TYPE"
                                    placeholder="Ayak Modeli Seç"
                                    onSelect={(value) => setFormData({ ...formData, footType: value })}
                                    initialValue={formData.footType}
                                    disabled={!canEdit || loading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className={cn("text-sm", !formData.footType ? "text-slate-400" : "text-blue-600")}>Ayak Özelliği</Label>
                                <FeatureCombobox
                                    category="FOOT_MATERIAL"
                                    placeholder="Materyal/Renk Seç"
                                    onSelect={(value) => setFormData({ ...formData, footMaterial: value })}
                                    initialValue={formData.footMaterial}
                                    disabled={!canEdit || loading || !formData.footType}
                                />
                            </div>
                        </div>

                        {/* Kol Modeli ve Sırt Modeli */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm text-slate-600">Kol Modeli</Label>
                                <FeatureCombobox
                                    category="ARM_TYPE"
                                    placeholder="Kol Tipi Seç"
                                    onSelect={(value) => setFormData({ ...formData, armType: value })}
                                    initialValue={formData.armType}
                                    disabled={!canEdit || loading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm text-slate-600">Sırt Modeli</Label>
                                <FeatureCombobox
                                    category="BACK_TYPE"
                                    placeholder="Sırt Tipi Seç"
                                    onSelect={(value) => setFormData({ ...formData, backType: value })}
                                    initialValue={formData.backType}
                                    disabled={!canEdit || loading}
                                />
                            </div>
                        </div>

                        {/* Kumaş / Deri Tipi */}
                        <div className="space-y-2">
                            <Label className="text-sm text-slate-600">Kumaş / Deri Tipi</Label>
                            <FeatureCombobox
                                category="FABRIC_TYPE"
                                placeholder="Kumaş veya Deri Seçin"
                                onSelect={(value) => setFormData({ ...formData, fabricType: value })}
                                initialValue={formData.fabricType}
                                disabled={!canEdit || loading}
                            />
                        </div>

                        {/* Materyal / Kumaş Detay */}
                        <div className="space-y-2">
                            <Label className="text-sm text-slate-600">Materyal / Kumaş Detay</Label>
                            <FeatureCombobox
                                category="MATERIAL"
                                placeholder="Materyal Seçin (veya yazıp ekleyin)"
                                onSelect={(value) => setFormData({ ...formData, material: value })}
                                initialValue={formData.material}
                                disabled={!canEdit || loading}
                            />
                            <p className="text-xs text-slate-400">* Listede yoksa, isminiz yazıp "Ekle" butonuna basarak yeni oluşturabilirsiniz.</p>
                        </div>
                    </div>

                    {/* Açıklama / Müşteri Notu */}
                    <div className="space-y-2">
                        <Label>Açıklama / Müşteri Notu</Label>
                        <Textarea
                            placeholder="Ekstra istekler, dikiş detayları vb. (Max 500 karakter)"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value.slice(0, 500) })}
                            disabled={!canEdit || loading}
                            className="h-24 resize-none"
                            maxLength={500}
                        />
                    </div>

                    {/* Butonlar */}
                    {canEdit && (
                        <div className="flex gap-3">
                            <Button
                                onClick={() => handleSubmit(false)}
                                disabled={loading}
                                variant="outline"
                                className="flex-1 h-12 text-base font-medium"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                        İşleniyor...
                                    </>
                                ) : (
                                    "Kaydet"
                                )}
                            </Button>
                            {!["APPROVED", "IN_PRODUCTION", "COMPLETED", "SHIPPED"].includes(product.status) && (
                                <Button
                                    onClick={() => handleSubmit(true)}
                                    disabled={loading}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 h-12 text-base font-medium"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                            İşleniyor...
                                        </>
                                    ) : (
                                        "Kaydet ve Onaya Gönder"
                                    )}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
