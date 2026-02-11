'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getProductByBarcode, transferToWarehouse } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ScanBarcode, Focus, Volume2, VolumeX, RotateCcw, CheckCircle2, AlertCircle, Package, Warehouse } from "lucide-react";
import { ProductionQueueTable } from "@/components/production-queue-table";

export default function ProductionPage() {
    const [barcode, setBarcode] = useState("");
    const [product, setProduct] = useState<any>(null);
    const [quantity, setQuantity] = useState("");
    const [shelf, setShelf] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const [msgType, setMsgType] = useState<"success" | "error">("error");
    const [scanMode, setScanMode] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [lastScanTime, setLastScanTime] = useState<Date | null>(null);

    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const quantityInputRef = useRef<HTMLInputElement>(null);

    // Auto-focus barcode input on mount and when scan mode is active
    useEffect(() => {
        if (scanMode && barcodeInputRef.current) {
            barcodeInputRef.current.focus();
        }
    }, [scanMode]);

    // Re-focus barcode input after product is cleared
    useEffect(() => {
        if (!product && scanMode && barcodeInputRef.current) {
            barcodeInputRef.current.focus();
        }
    }, [product, scanMode]);

    // Play beep sound for feedback
    const playBeep = useCallback((success: boolean) => {
        if (!soundEnabled) return;
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = success ? 800 : 300;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;

            oscillator.start();
            oscillator.stop(audioContext.currentTime + (success ? 0.1 : 0.3));
        } catch (e) {
            // Audio not supported
        }
    }, [soundEnabled]);

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!barcode.trim()) return;

        setLoading(true);
        setMsg("");
        setProduct(null);
        setLastScanTime(new Date());

        try {
            const p = await getProductByBarcode(barcode.trim());
            if (p) {
                // Paketlenmiş ürün kontrolü
                if ((p.packagedQty || 0) <= 0) {
                    setMsgType("error");
                    setMsg("Bu ürün henüz paketlenmemiş. Önce paketleme işlemini tamamlayın.");
                    playBeep(false);
                    barcodeInputRef.current?.focus();
                    barcodeInputRef.current?.select();
                } else {
                    setProduct(p);
                    setMsgType("success");
                    setMsg("Ürün bulundu! Depoya giriş yapabilirsiniz.");
                    playBeep(true);
                    // Focus quantity input after successful scan
                    setTimeout(() => quantityInputRef.current?.focus(), 100);
                }
            } else {
                setMsgType("error");
                setMsg("Ürün bulunamadı");
                playBeep(false);
                // Re-focus barcode input for next scan
                barcodeInputRef.current?.focus();
                barcodeInputRef.current?.select();
            }
        } catch (err) {
            setMsgType("error");
            setMsg("Ürün getirilirken hata oluştu");
            playBeep(false);
        }
        setLoading(false);
    }

    const handleSubmit = async () => {
        if (!product || !quantity) return;
        setLoading(true);
        const qtyNum = parseInt(quantity);

        const res = await transferToWarehouse({
            productId: product.id,
            quantity: qtyNum,
            shelf: shelf || undefined
        });

        if (res.error) {
            setMsgType("error");
            setMsg(res.error);
            playBeep(false);
        } else {
            setMsgType("success");
            setMsg("Başarılı! Ürün depoya alındı.");
            playBeep(true);
            setProduct(null);
            setBarcode("");
            setQuantity("");
            setShelf("");
            // Re-focus barcode input for next scan
            setTimeout(() => barcodeInputRef.current?.focus(), 100);
        }
        setLoading(false);
    }

    const handleReset = () => {
        setProduct(null);
        setBarcode("");
        setQuantity("");
        setShelf("");
        setMsg("");
        barcodeInputRef.current?.focus();
    }

    const focusBarcodeInput = () => {
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Warehouse className="h-7 w-7 text-green-600" />
                        Depo Girişi
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Paketlenmiş ürünleri depoya alın
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={scanMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => setScanMode(!scanMode)}
                        className={scanMode ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                        <ScanBarcode className="mr-2 h-4 w-4" />
                        {scanMode ? "Tarama Modu Aktif" : "Tarama Modu"}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        title={soundEnabled ? "Sesi Kapat" : "Sesi Aç"}
                    >
                        {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            {/* Barcode Scanner Card */}
            <Card className={`border-2 transition-all ${scanMode ? "border-green-500 shadow-lg shadow-green-100" : "border-slate-200"}`}>
                <CardHeader className={scanMode ? "bg-green-50" : ""}>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <ScanBarcode className={`h-5 w-5 ${scanMode ? "text-green-600" : ""}`} />
                                Barkod Okut
                            </CardTitle>
                            <CardDescription className="mt-1">
                                Paketlenmiş ürünü barkod ile bulun ve depoya alın
                            </CardDescription>
                        </div>
                        {lastScanTime && (
                            <Badge variant="outline" className="text-xs">
                                Son: {lastScanTime.toLocaleTimeString('tr-TR')}
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form onSubmit={handleScan} className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                                <Input
                                    ref={barcodeInputRef}
                                    autoFocus
                                    autoComplete="off"
                                    placeholder="Barkodu okutun veya yazın..."
                                    value={barcode}
                                    onChange={e => setBarcode(e.target.value)}
                                    className={`text-xl h-16 pr-12 font-mono tracking-wider ${scanMode ? "border-green-400 focus:border-green-500 focus:ring-green-500" : ""}`}
                                    disabled={loading}
                                />
                                <ScanBarcode className={`absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 ${scanMode ? "text-green-500" : "text-slate-400"}`} />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="submit"
                                    disabled={loading || !barcode.trim()}
                                    className="h-16 px-8 text-lg bg-blue-600 hover:bg-blue-700"
                                >
                                    {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                    Bul
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={focusBarcodeInput}
                                    className="h-16 px-4"
                                    title="Barkod alanına odaklan"
                                >
                                    <Focus className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </form>

                    {/* Quick Action Buttons for Barcode Machine */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleReset}
                            className="flex-1 sm:flex-none"
                        >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Sıfırla
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={focusBarcodeInput}
                            className="flex-1 sm:flex-none"
                        >
                            <Focus className="mr-2 h-4 w-4" />
                            Yeni Tarama
                        </Button>
                    </div>

                    {/* Status Message */}
                    {msg && (
                        <div className={`flex items-center gap-2 p-3 rounded-lg ${msgType === "success"
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                            }`}>
                            {msgType === "success"
                                ? <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                                : <AlertCircle className="h-5 w-5 flex-shrink-0" />
                            }
                            <span className="font-medium">{msg}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Product Detail Card - Depoya Giriş Formu */}
            {product && (
                <Card className="border-2 border-green-500 shadow-lg shadow-green-100">
                    <CardHeader className="bg-green-50">
                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle className="text-green-900 text-xl flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    {product.name}
                                </CardTitle>
                                <p className="text-sm text-green-700 mt-1">Model: {product.model}</p>
                                {product.barcode && (
                                    <Badge variant="outline" className="mt-2 font-mono">
                                        Barkod: {product.barcode}
                                    </Badge>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleReset}
                                className="text-green-600 hover:text-green-800"
                            >
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Vazgeç
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        <div className="grid grid-cols-3 gap-2 md:gap-4 text-sm">
                            <div className="text-center p-3 bg-slate-50 rounded-lg border">
                                <span className="text-slate-500 text-xs md:text-sm">Planlanan</span>
                                <div className="text-xl md:text-2xl font-bold">{product.quantity}</div>
                            </div>
                            <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <span className="text-blue-600 text-xs md:text-sm flex items-center justify-center gap-1">
                                    <Package className="h-3 w-3" /> Paketlenen
                                </span>
                                <div className="text-xl md:text-2xl font-bold text-blue-600">{product.packagedQty || 0}</div>
                            </div>
                            <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                                <span className="text-green-600 text-xs md:text-sm flex items-center justify-center gap-1">
                                    <Warehouse className="h-3 w-3" /> Depoda
                                </span>
                                <div className="text-xl md:text-2xl font-bold text-green-600">{product.storedQty || 0}</div>
                            </div>
                        </div>

                        {/* NetSim Açıklamaları */}
                        {(product.aciklama1 || product.aciklama2 || product.aciklama3 || product.aciklama4) && (
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                                <h4 className="text-sm font-semibold text-amber-800 mb-2">Sipariş Notları</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                    {product.aciklama1 && (
                                        <div className="bg-white p-2 rounded border border-amber-100">
                                            <span className="font-medium text-amber-700">1:</span> {product.aciklama1}
                                        </div>
                                    )}
                                    {product.aciklama2 && (
                                        <div className="bg-white p-2 rounded border border-amber-100">
                                            <span className="font-medium text-amber-700">2:</span> {product.aciklama2}
                                        </div>
                                    )}
                                    {product.aciklama3 && (
                                        <div className="bg-white p-2 rounded border border-amber-100">
                                            <span className="font-medium text-amber-700">3:</span> {product.aciklama3}
                                        </div>
                                    )}
                                    {product.aciklama4 && (
                                        <div className="bg-white p-2 rounded border border-amber-100">
                                            <span className="font-medium text-amber-700">4:</span> {product.aciklama4}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="border-t pt-4 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        Depoya Alınacak Adet
                                        <Badge variant="secondary" className="text-xs">
                                            Max: {product.packagedQty || 0}
                                        </Badge>
                                    </label>
                                    <Input
                                        ref={quantityInputRef}
                                        type="number"
                                        placeholder="Adet giriniz..."
                                        value={quantity}
                                        onChange={e => setQuantity(e.target.value)}
                                        max={product.packagedQty || 0}
                                        min={1}
                                        className="text-xl h-14 font-semibold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Raf / Konum (Opsiyonel)</label>
                                    <Input
                                        placeholder="ör. A-12"
                                        value={shelf}
                                        onChange={e => setShelf(e.target.value)}
                                        className="text-xl h-14"
                                    />
                                </div>
                            </div>

                            {/* Large Submit Button for Touch/Barcode Scanner Workflow */}
                            <Button
                                onClick={handleSubmit}
                                className="w-full h-16 text-xl bg-green-600 hover:bg-green-700 shadow-lg"
                                disabled={loading || !quantity || parseInt(quantity) <= 0}
                            >
                                {loading && <Loader2 className="mr-2 h-6 w-6 animate-spin" />}
                                <Warehouse className="mr-2 h-6 w-6" />
                                Depoya Al
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg md:text-xl flex items-center gap-2">
                        <Package className="h-5 w-5 text-blue-600" />
                        Paketlenmiş Ürünler (Depoya Giriş Bekleyen)
                    </CardTitle>
                    <CardDescription>
                        Paketleme aşamasını tamamlamış ve depoya alınmayı bekleyen ürünler
                    </CardDescription>
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
