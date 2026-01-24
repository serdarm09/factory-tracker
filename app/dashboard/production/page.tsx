'use client';
import { useState, useEffect } from 'react';
import { getProductByBarcode, logProduction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { ProductionQueueTable } from "@/components/production-queue-table";

export default function ProductionPage() {
    const [barcode, setBarcode] = useState("");
    const [product, setProduct] = useState<any>(null);
    const [quantity, setQuantity] = useState("");
    const [shelf, setShelf] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg("");
        setProduct(null);

        try {
            const p = await getProductByBarcode(barcode);
            if (p) {
                setProduct(p);
            } else {
                setMsg("Ürün bulunamadı");
            }
        } catch (err) {
            setMsg("Ürün getirilirken hata oluştu");
        }
        setLoading(false);
    }

    const handleSubmit = async () => {
        if (!product || !quantity) return;
        setLoading(true);
        const qtyNum = parseInt(quantity);

        const res = await logProduction(product.barcode, qtyNum, shelf);

        if (res.error) {
            setMsg(res.error);
        } else {
            setMsg("Başarılı! Üretim kaydedildi.");
            setProduct(null);
            setBarcode("");
            setQuantity("");
            setShelf("");
        }
        setLoading(false);
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Depo / Üretim Girişi</h2>

            <Card>
                <CardHeader><CardTitle>Barkod Okut</CardTitle></CardHeader>
                <CardContent>
                    <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-2">
                        <Input
                            autoFocus
                            placeholder="Barkodu okutun veya yazın..."
                            value={barcode}
                            onChange={e => setBarcode(e.target.value)}
                            className="text-lg h-12"
                        />
                        <Button type="submit" disabled={loading} className="h-12 min-w-[100px]">Bul</Button>
                    </form>
                    {msg && <p className="mt-2 text-red-500 font-medium">{msg}</p>}
                </CardContent>
            </Card>

            {product && (
                <Card className="border-2 border-blue-500">
                    <CardHeader className="bg-blue-50">
                        <CardTitle className="text-blue-900">{product.name}</CardTitle>
                        <p className="text-sm text-blue-700">Model: {product.model}</p>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        <div className="grid grid-cols-3 gap-2 md:gap-4 text-sm">
                            <div className="text-center p-2 bg-slate-50 rounded-lg">
                                <span className="text-slate-500 text-xs md:text-sm">Planlanan</span>
                                <div className="text-lg md:text-xl font-bold">{product.quantity}</div>
                            </div>
                            <div className="text-center p-2 bg-orange-50 rounded-lg">
                                <span className="text-slate-500 text-xs md:text-sm">Üretilen</span>
                                <div className="text-lg md:text-xl font-bold text-orange-600">{product.produced}</div>
                            </div>
                            <div className="text-center p-2 bg-green-50 rounded-lg">
                                <span className="text-slate-500 text-xs md:text-sm">Kalan</span>
                                <div className="text-lg md:text-xl font-bold text-green-600">{product.quantity - product.produced}</div>
                            </div>
                        </div>

                        <div className="border-t pt-4 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Üretim Adedi</label>
                                    <Input
                                        type="number"
                                        placeholder="Adet giriniz..."
                                        value={quantity}
                                        onChange={e => setQuantity(e.target.value)}
                                        max={product.quantity - product.produced}
                                        className="text-lg h-12"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Raf / Konum (Zorunlu)</label>
                                    <Input
                                        placeholder="ör. A-12"
                                        value={shelf}
                                        onChange={e => setShelf(e.target.value)}
                                        required
                                        className="text-lg h-12"
                                    />
                                </div>
                            </div>

                            <Button onClick={handleSubmit} className="w-full h-14 text-lg bg-green-600 hover:bg-green-700" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                                Girişi Onayla
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg md:text-xl">Üretilecekler Listesi (Barkodu Hazır)</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <ProductionQueue />
                </CardContent>
            </Card>
        </div>
    )
}

function ProductionQueue() {
    const [list, setList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQueue = () => {
            fetch('/api/production/queue')
                .then(res => res.json())
                .then(data => {
                    setList(data);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        };

        fetchQueue();
        const interval = setInterval(fetchQueue, 10000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="text-sm text-slate-500">Yükleniyor...</div>;
    // We pass empty list if no data, let table handle empty state

    return <ProductionQueueTable products={list} />;
}
