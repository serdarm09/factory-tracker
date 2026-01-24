'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createOrder, searchCatalog, CreateOrderData, getAttributes, getMasters, ensureAttributes } from "@/lib/actions";
import { Check, Loader2, Plus, Search, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

export default function NewOrderPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isClone = searchParams.get('clone') === 'true';
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Data
    const [attributes, setAttributes] = useState<any[]>([]);
    const [masters, setMasters] = useState<any[]>([]);

    // Form Data
    const [company, setCompany] = useState("");
    const [orderName, setOrderName] = useState("");
    const [selectedItems, setSelectedItems] = useState<(CreateOrderData['items'][number] & { imageUrl?: string })[]>([]);

    // Step 3 State: Current Item Index being edited
    const [currentItemIndex, setCurrentItemIndex] = useState(0);

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        // Init data
        ensureAttributes().then(() => {
            Promise.all([
                getAttributes('FOOT_TYPE'),
                getAttributes('FOOT_MATERIAL'),
                getAttributes('ARM_TYPE'),
                getAttributes('BACK_TYPE'),
                getAttributes('FABRIC_TYPE'),
                getMasters()
            ]).then(([feet, feetMat, arms, backs, fabrics, masterList]) => {
                setAttributes([
                    ...feet, ...feetMat, ...arms, ...backs, ...fabrics
                ]);
                setMasters(masterList);
            });
        });

        // Check for clone data
        if (isClone) {
            const cloneData = sessionStorage.getItem('cloneOrderData');
            if (cloneData) {
                try {
                    const data = JSON.parse(cloneData);
                    setCompany(data.company || "");
                    setOrderName(data.orderName ? `${data.orderName} (Kopya)` : "");
                    if (data.items && data.items.length > 0) {
                        setSelectedItems(data.items);
                        setStep(2); // Jump to step 2 with items loaded
                        toast.success(`${data.items.length} ürün klonlandı`);
                    }
                    sessionStorage.removeItem('cloneOrderData');
                } catch (e) {
                    console.error("Clone data parse error:", e);
                }
            }
        }
    }, [isClone]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (selectedItems.length > 0 || company || orderName) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [selectedItems, company, orderName]);

    const getOptions = (category: string) => attributes.filter(a => a.category === category);

    const handleSearch = async (val: string) => {
        setSearchQuery(val);
        if (val.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        const res = await searchCatalog(val);
        setSearchResults(res);
        setSearching(false);
    }

    const addItem = (catalogItem: any) => {
        setSelectedItems([...selectedItems, {
            code: catalogItem.code,
            name: catalogItem.name,
            quantity: 1,
            // Defaults
            material: "",
            description: "",
            imageUrl: catalogItem.imageUrl || `/${catalogItem.code}.png`
        }]);
        setSearchQuery("");
        setSearchResults([]);
    }

    const updateCurrentItem = (field: string, value: any) => {
        const newItems = [...selectedItems];
        (newItems[currentItemIndex] as any)[field] = value;
        setSelectedItems(newItems);
    }

    const removeItem = (index: number) => {
        const newItems = [...selectedItems];
        newItems.splice(index, 1);
        setSelectedItems(newItems);
    }

    const handleNextItem = () => {
        if (currentItemIndex < selectedItems.length - 1) {
            setCurrentItemIndex(currentItemIndex + 1);
        } else {
            // Finished
            handleSubmit();
        }
    }

    const handleSubmit = async () => {
        if (!company || !orderName || selectedItems.length === 0) {
            toast.error("Lütfen tüm zorunlu alanları doldurun.");
            return;
        }

        setLoading(true);
        const res = await createOrder({
            company,
            name: orderName,
            items: selectedItems
        });

        if (res.error) {
            toast.error(res.error);
            setLoading(false);
        } else {
            toast.success("Sipariş başarıyla oluşturuldu.");
            router.push("/dashboard/planning");
        }
    }

    const currentItem = selectedItems[currentItemIndex];

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Yeni Sipariş Oluştur</h1>
                <div className="text-sm text-muted-foreground">Adım {step} / 3</div>
            </div>

            {/* Step 1: Info */}
            {step === 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Sipariş Bilgileri</CardTitle>
                        <CardDescription>Müşteri ve sipariş referansını giriniz.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Firma / Müşteri Adı</Label>
                            <Input
                                placeholder="Örn. ABC Mobilya"
                                value={company}
                                onChange={e => setCompany(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Sipariş Adı / Ref No</Label>
                            <Input
                                placeholder="Örn. 2024-Ocak-Sevkiyat"
                                value={orderName}
                                onChange={e => setOrderName(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end pt-4">
                            <Button
                                onClick={() => setStep(2)}
                                disabled={!company || !orderName}
                            >
                                İleri
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Product Select */}
            {step === 2 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Ürün Seçimi</CardTitle>
                        <CardDescription>Listeye ürün ekleyin.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Ürün kodu veya adı ara..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={e => handleSearch(e.target.value)}
                            />
                            {searchResults.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                                    {searchResults.map(item => (
                                        <div
                                            key={item.id}
                                            className="p-2 hover:bg-slate-100 cursor-pointer flex justify-between items-center"
                                            onClick={() => addItem(item)}
                                        >
                                            <div className="flex items-center gap-3">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={item.imageUrl || `/${item.code}.png`} alt="" className="w-10 h-10 object-contain rounded border bg-white" />
                                                <span className="font-medium">{item.code} - {item.name}</span>
                                            </div>
                                            <Button size="sm" variant="ghost"><Plus className="h-4 w-4" /></Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="text-sm font-medium">Seçilen Ürünler ({selectedItems.length})</div>
                            {selectedItems.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={item.imageUrl} alt="" className="w-10 h-10 object-contain rounded border bg-white" />
                                        <div>
                                            <div className="font-medium">{item.code}</div>
                                            <div className="text-sm text-slate-500">{item.name}</div>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between pt-4">
                            <Button variant="outline" onClick={() => setStep(1)}>Geri</Button>
                            <Button onClick={() => setStep(3)} disabled={selectedItems.length === 0}>İleri: Detaylandır</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 3: Sequential Edit */}
            {step === 3 && currentItem && (
                <Card className="border-2 border-blue-100">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Ürün Özellikleri ({currentItemIndex + 1}/{selectedItems.length})</CardTitle>
                                <CardDescription className="text-lg font-bold text-blue-800">{currentItem.code} - {currentItem.name}</CardDescription>
                            </div>
                            <div className="text-sm bg-slate-100 px-3 py-1 rounded">
                                Sonraki: {selectedItems[currentItemIndex + 1]?.code || 'Bitiş'}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Image Preview */}
                        <div className="flex justify-center py-4 bg-slate-50 rounded-lg">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={currentItem.imageUrl} alt={currentItem.name} className="h-48 object-contain" />
                        </div>

                        {/* Row 1: Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Adet</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={currentItem.quantity}
                                    onChange={e => updateCurrentItem('quantity', parseInt(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Termin Tarihi</Label>
                                <Input
                                    type="date"
                                    value={currentItem.terminDate instanceof Date ? currentItem.terminDate.toISOString().split('T')[0] : currentItem.terminDate || ''}
                                    onChange={e => updateCurrentItem('terminDate', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Usta Ata</Label>
                                <Select onValueChange={v => updateCurrentItem('master', v)} value={currentItem.master || ""}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seçiniz..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {masters.map(m => (
                                            <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Row 2: Configs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                            <div className="space-y-2">
                                <Label>Ayak Modeli (Tipi)</Label>
                                <Select onValueChange={v => updateCurrentItem('footType', v)} value={currentItem.footType}>
                                    <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                    <SelectContent>
                                        {getOptions('FOOT_TYPE').map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Ayak Materyali</Label>
                                <Select onValueChange={v => updateCurrentItem('footMaterial', v)} value={currentItem.footMaterial}>
                                    <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                    <SelectContent>
                                        {getOptions('FOOT_MATERIAL').map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Kol Modeli</Label>
                                <Select onValueChange={v => updateCurrentItem('armType', v)} value={currentItem.armType}>
                                    <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                    <SelectContent>
                                        {getOptions('ARM_TYPE').map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Sırt Modeli</Label>
                                <Select onValueChange={v => updateCurrentItem('backType', v)} value={currentItem.backType}>
                                    <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                    <SelectContent>
                                        {getOptions('BACK_TYPE').map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Kumaş Türü</Label>
                                <Select onValueChange={v => updateCurrentItem('fabricType', v)} value={currentItem.fabricType}>
                                    <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                    <SelectContent>
                                        {getOptions('FABRIC_TYPE').map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Materyal / Kumaş Detay</Label>
                                <Input
                                    placeholder="Örn. Kadife Gri"
                                    value={currentItem.material || ""}
                                    onChange={e => updateCurrentItem('material', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Açıklama / Not</Label>
                            <Textarea
                                placeholder="Özel üretim notları..."
                                value={currentItem.description || ""}
                                onChange={e => updateCurrentItem('description', e.target.value)}
                            />
                        </div>

                        <div className="flex justify-between pt-4">
                            <Button variant="outline" onClick={() => {
                                if (currentItemIndex > 0) setCurrentItemIndex(currentItemIndex - 1);
                                else setStep(2);
                            }}>Geri</Button>

                            <Button onClick={handleNextItem} className="w-32 font-bold" disabled={loading}>
                                {currentItemIndex < selectedItems.length - 1 ? (
                                    <>Sonraki <ArrowRight className="ml-2 h-4 w-4" /></>
                                ) : (
                                    <>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Tamamla</>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
