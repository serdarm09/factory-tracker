'use client';

import { createProduct } from "@/lib/actions";
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

export function PlanningForm() {
    const formRef = useRef<HTMLFormElement>(null);
    const [date, setDate] = useState<Date>();

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

        const res = await createProduct(formData);
        if (res?.error) {
            toast.error(res.error);
        } else {
            toast.success("Ürün başarıyla plana eklendi");
            formRef.current?.reset();
            setDate(undefined);
            setOrderDate(new Date()); // Reset to today
            setFootType("");
            setFootMaterial("");
            setArmType("");
            setBackType("");
            setFabricType("");
            setSelectedProduct(null);
        }
    }


    const [selectedProduct, setSelectedProduct] = useState<{ code: string, name: string } | null>(null);
    const [orderDate, setOrderDate] = useState<Date | undefined>(new Date());
    const [footType, setFootType] = useState("");
    const [footMaterial, setFootMaterial] = useState("");
    const [armType, setArmType] = useState("");
    const [backType, setBackType] = useState("");
    const [fabricType, setFabricType] = useState("");

    function handleProductSelect(product: { code: string; name: string }) {
        setSelectedProduct(product);
        if (formRef.current) {
            // Auto fill fields
            const form = formRef.current;
            (form.elements.namedItem('name') as HTMLInputElement).value = product.name;
            (form.elements.namedItem('systemCode') as HTMLInputElement).value = product.code;
            // Assuming model might be related or empty, for now just name and code
            // User requested "product code entered -> product name auto entered"
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

            <div className="grid grid-cols-2 gap-4">

                <div className="space-y-2">
                    <Label htmlFor="name">Ürün Adı</Label>
                    <Input
                        id="name"
                        name="name"
                        required
                        placeholder="Sandalye X1"
                        maxLength={100}
                        readOnly={!!selectedProduct}
                        className={selectedProduct ? "bg-slate-100 text-slate-600" : ""}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input id="model" name="model" required placeholder="V2024" maxLength={50} />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="company">Firma / Müşteri</Label>
                <Input id="company" name="company" placeholder="ABC Mobilya" maxLength={100} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="quantity">Adet</Label>
                    <Input id="quantity" name="quantity" type="number" required min="1" max="100000" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="systemCode">Ürün Kodu</Label>
                    <Input
                        id="systemCode"
                        name="systemCode"
                        required
                        placeholder="SYS-001"
                        maxLength={20}
                        readOnly={!!selectedProduct}
                        className={selectedProduct ? "bg-slate-100 text-slate-600 font-mono" : "font-mono"}
                    />
                </div>
            </div>

            {/* Checkbox to add to catalog if manual entry */}
            {!selectedProduct && (
                <div className="flex items-center space-x-2 border p-3 rounded-md bg-blue-50/50">
                    <input type="checkbox" id="saveToCatalog" name="saveToCatalog" value="true" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <Label htmlFor="saveToCatalog" className="cursor-pointer font-normal text-blue-900">
                        Bu ürünü (Kod ve İsim) kataloğa da kaydet
                    </Label>
                </div>
            )}

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
                        <FeatureCombobox category="FOOT_TYPE" placeholder="Ayak Modeli Seç" onSelect={setFootType} />
                        <input type="hidden" name="footType" value={footType} />
                    </div>
                    <div className="space-y-2">
                        <Label className={!footType ? "text-slate-400" : ""}>Ayak Özelliği</Label>
                        <FeatureCombobox
                            category="FOOT_MATERIAL"
                            placeholder="Materyal/Renk Seç"
                            onSelect={setFootMaterial}
                            disabled={!footType}
                        />
                        <input type="hidden" name="footMaterial" value={footMaterial} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Kol Modeli</Label>
                        <FeatureCombobox category="ARM_TYPE" placeholder="Kol Tipi Seç" onSelect={setArmType} />
                        <input type="hidden" name="armType" value={armType} />
                    </div>
                    <div className="space-y-2">
                        <Label>Sırt Modeli</Label>
                        <FeatureCombobox category="BACK_TYPE" placeholder="Sırt Tipi Seç" onSelect={setBackType} />
                        <input type="hidden" name="backType" value={backType} />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Kumaş / Deri Tipi</Label>
                    <FeatureCombobox category="FABRIC_TYPE" placeholder="Kumaş/Deri Seç" onSelect={setFabricType} />
                    <input type="hidden" name="fabricType" value={fabricType} />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="material">Malzeme / Kumaş / Deri</Label>
                <Input id="material" name="material" placeholder="Örn: Nubuk Deri, Gri Kumaş..." maxLength={100} />
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Açıklama / Müşteri Notu</Label>
                <textarea
                    id="description"
                    name="description"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Ekstra istekler, dikiş detayları vb. (Max 500 karakter)"
                    maxLength={500}
                />
            </div>

            <Button type="submit" className="w-full">Plana Ekle</Button>
        </form>
    );
}
