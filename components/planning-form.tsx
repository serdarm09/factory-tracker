'use client';

import { createProduct, updateProduct } from "@/lib/actions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRef, useState } from "react";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ProductCombobox } from "./product-combobox";
import { FeatureCombobox } from "./feature-combobox";

interface PlanningFormProps {
    product?: any; // Start with any to avoid type issues, refine later
    onSuccess?: () => void;
}

export function PlanningForm({ product, onSuccess }: PlanningFormProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const [date, setDate] = useState<Date | undefined>(product ? new Date(product.terminDate) : undefined);

    // Initial state from product if editing
    const [selectedProduct, setSelectedProduct] = useState<{ code: string, name: string, imageUrl?: string | null } | null>(
        product ? { code: product.systemCode, name: product.name, imageUrl: product.imageUrl } : null
    );
    const [orderDate, setOrderDate] = useState<Date | undefined>(product?.orderDate ? new Date(product.orderDate) : new Date());

    const [footType, setFootType] = useState(product?.footType || "");
    const [footMaterial, setFootMaterial] = useState(product?.footMaterial || "");
    const [armType, setArmType] = useState(product?.armType || "");
    const [backType, setBackType] = useState(product?.backType || "");
    const [fabricType, setFabricType] = useState(product?.fabricType || "");
    const [model, setModel] = useState(product?.model || "");

    async function clientAction(formData: FormData) {
        if (!date) {
            toast.error("Lütfen termin tarihi seçiniz");
            return;
        }

        // Validation: If Foot Type is selected, Foot Material is required
        if (footType && !footMaterial) {
            toast.error("Ayak Modeli seçildiğinde, Ayak Özelliği (Materyal/Renk) seçilmesi zorunludur.");
            return;
        }

        let res;
        if (product) {
            res = await updateProduct(product.id, formData);
        } else {
            res = await createProduct(formData);
        }

        if (res?.error) {
            toast.error(res.error);
        } else {
            toast.success(product ? "Ürün güncellendi" : "Ürün başarıyla plana eklendi");
            if (!product) {
                // Complete Reset
                formRef.current?.reset();

                // Reset all state variables
                setDate(undefined);
                setOrderDate(new Date());

                setFootType("");
                setFootMaterial("");
                setArmType("");
                setBackType("");
                setFabricType(""); // Reset fabric
                setModel("");

                setSelectedProduct(null);
            }
            if (onSuccess) onSuccess();
        }
    }

    function handleProductSelect(selected: { code: string; name: string; imageUrl?: string | null }) {
        setSelectedProduct(selected);
        if (formRef.current) {
            const form = formRef.current;
            const nameInput = form.elements.namedItem('name') as HTMLInputElement;
            const codeInput = form.elements.namedItem('systemCode') as HTMLInputElement;

            if (nameInput) nameInput.value = selected.name;
            if (codeInput) codeInput.value = selected.code;
        }
    }

    return (
        <form ref={formRef} action={clientAction} className="space-y-4">
            <div className="space-y-2">
                <Label>Ürün Ara (Katalogdan Seç)</Label>
                <div className="w-full">
                    <ProductCombobox onSelect={handleProductSelect} />
                </div>
            </div>

            {/* Image Upload and Preview */}
            <div className="space-y-2">
                <Label htmlFor="image">Ürün Resmi</Label>
                <div className="flex gap-4 items-start">
                    {/* Preview Area */}
                    {(selectedProduct?.imageUrl) && (
                        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md border bg-slate-50">
                            <img
                                src={selectedProduct.imageUrl}
                                alt="Preview"
                                className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <span className="text-white text-xs font-bold bg-black/50 px-2 py-1 rounded">Katalog</span>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 space-y-2">
                        <Input
                            id="image"
                            name="image"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                // Optional: Client-side preview logic could go here
                            }}
                        />
                        <p className="text-xs text-muted-foreground">
                            {selectedProduct?.imageUrl
                                ? "Yeni bir resim yüklerseniz, katalogdaki resim yerine o kullanılacaktır."
                                : "Ürün resmi yükleyebilirsiniz."}
                        </p>
                        {/* Always pass existing URL if we have one, server decides which to use */}
                        {selectedProduct?.imageUrl && (
                            <input type="hidden" name="existingImageUrl" value={selectedProduct.imageUrl} />
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">

                <div className="space-y-2">
                    <Label htmlFor="name">Ürün Adı</Label>
                    <Input
                        id="name"
                        name="name"
                        required
                        placeholder="Sandalye X1"
                        maxLength={100}
                        defaultValue={product?.name}
                        readOnly={!!selectedProduct}
                        className={selectedProduct ? "bg-slate-100 text-slate-600" : ""}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <FeatureCombobox category="MODEL" placeholder="Model Seçin" onSelect={setModel} initialValue={model} />
                    <input type="hidden" name="model" value={model} />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="company">Firma / Müşteri</Label>
                <Input id="company" name="company" placeholder="ABC Mobilya" maxLength={100} defaultValue={product?.company || ""} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="quantity">Adet</Label>
                    <Input id="quantity" name="quantity" type="number" required min="1" max="100000" defaultValue={product?.quantity} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="systemCode">Ürün Kodu</Label>
                    <Input
                        id="systemCode"
                        name="systemCode"
                        required
                        placeholder="SYS-001"
                        maxLength={20}
                        defaultValue={product?.systemCode}
                        readOnly={!!selectedProduct}
                        className={selectedProduct ? "bg-slate-100 text-slate-600 font-mono" : "font-mono"}
                    />
                </div>
            </div>

            {/* Checkbox to add to catalog if manual entry */}
            {
                !selectedProduct && !product && (
                    <div className="flex items-center space-x-2 border p-3 rounded-md bg-blue-50/50">
                        <input type="checkbox" id="saveToCatalog" name="saveToCatalog" value="true" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <Label htmlFor="saveToCatalog" className="cursor-pointer font-normal text-blue-900">
                            Bu ürünü (Kod ve İsim) kataloğa da kaydet
                        </Label>
                    </div>
                )
            }

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 flex flex-col">
                    <Label htmlFor="orderDate">Sipariş Tarihi</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !orderDate && "text-muted-foreground"
                                )}
                            >
                                {orderDate ? format(orderDate, "PPP", { locale: tr }) : <span>Tarih seçin</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={orderDate}
                                onSelect={setOrderDate}
                                locale={tr}
                                disabled={(date) => date > new Date()}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    <input type="hidden" name="orderDate" value={orderDate ? format(orderDate, "yyyy-MM-dd") : ""} />
                </div>

                <div className="space-y-2 flex flex-col">
                    <Label htmlFor="terminDate">Termin Tarihi</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                {date ? format(date, "PPP", { locale: tr }) : <span>Tarih seçin</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                locale={tr}
                                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    <input type="hidden" name="terminDate" value={date ? format(date, "yyyy-MM-dd") : ""} />
                </div>
            </div>

            {/* Product Configuration Sections */}
            <div className="p-4 border rounded-lg bg-slate-50 space-y-4">
                <h3 className="font-semibold text-sm text-slate-900 mb-2">Ürün Özellikleri (Opsiyonel)</h3>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Ayak Modeli</Label>
                        <FeatureCombobox category="FOOT_TYPE" placeholder="Ayak Modeli Seç" onSelect={setFootType} initialValue={footType} />
                        <input type="hidden" name="footType" value={footType} />
                    </div>
                    <div className="space-y-2">
                        <Label className={!footType ? "text-slate-400" : ""}>Ayak Özelliği</Label>
                        <FeatureCombobox
                            category="FOOT_MATERIAL"
                            placeholder="Materyal/Renk Seç"
                            onSelect={setFootMaterial}
                            disabled={!footType}
                            initialValue={footMaterial}
                        />
                        <input type="hidden" name="footMaterial" value={footMaterial} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Kol Modeli</Label>
                        <FeatureCombobox category="ARM_TYPE" placeholder="Kol Tipi Seç" onSelect={setArmType} initialValue={armType} />
                        <input type="hidden" name="armType" value={armType} />
                    </div>
                    <div className="space-y-2">
                        <Label>Sırt Modeli</Label>
                        <FeatureCombobox category="BACK_TYPE" placeholder="Sırt Tipi Seç" onSelect={setBackType} initialValue={backType} />
                        <input type="hidden" name="backType" value={backType} />
                    </div>
                </div>

                {/* Combined Fabric Field */}
                <div className="space-y-2">
                    <Label>Kumaş / Deri Tipi</Label>
                    <div className="space-y-1">
                        <FeatureCombobox
                            category="FABRIC_TYPE"
                            placeholder="Kumaş veya Deri Seçin (veya yazıp ekleyin)"
                            onSelect={setFabricType}
                            initialValue={fabricType}
                        />
                        <p className="text-[10px] text-muted-foreground">
                            * Listede yoksa, ismini yazıp "Ekle" butonuna basarak yeni oluşturabilirsiniz.
                        </p>
                    </div>
                    {/* We send this as 'fabricType' which matches the DB field now used for all material info */}
                    <input type="hidden" name="fabricType" value={fabricType} />
                    {/* Note: 'material' field is kept in DB but we are deprecating its usage in the form for better structure */}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Açıklama / Müşteri Notu</Label>
                <textarea
                    id="description"
                    name="description"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Ekstra istekler, dikiş detayları vb. (Max 500 karakter)"
                    maxLength={500}
                    defaultValue={product?.description || ""}
                />

                {/* Preserve Shelf if existing (required by updateProduct, though we relaxed it, good to keep it) */}
                <input type="hidden" name="shelf" value={product?.shelf || ""} />
            </div>

            <Button type="submit" className="w-full">{product ? "Güncelle ve Tekrar Gönder" : "Plana Ekle"}</Button>
        </form >
    );
}
