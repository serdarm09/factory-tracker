"use client";

import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer } from "lucide-react";

interface BarcodeLabelPrintProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product: {
        barcode: string;
        name: string;
        model: string;
        company?: string;
        dstAdi?: string;
        fabricType?: string;
    };
}

type LabelVariant = "marisit-tr" | "marisit-en" | "no-logo-tr" | "no-logo-en" | "cezzone";

const VARIANTS: { value: LabelVariant; label: string }[] = [
    { value: "marisit-tr", label: "Marisit Logolu (TR)" },
    { value: "marisit-en", label: "Marisit Logolu (EN)" },
    { value: "no-logo-tr", label: "Logosuz (TR)" },
    { value: "no-logo-en", label: "Logosuz (EN)" },
    { value: "cezzone", label: "Cezzone Logolu (TR)" },
];

const formatCompanyNameReact = (name: string | null | undefined) => {
    if (!name) return '-';
    // Remove duplicate spacing and split
    const words = name.trim().split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';
    let wordCount = 0;

    for (const word of words) {
        if ((currentLine + word).length > 30 || wordCount >= 2) {
            if (currentLine) {
                lines.push(currentLine.trim());
            }
            if (word.length > 30) {
                lines.push(word.substring(0, 30) + '-');
                currentLine = word.substring(30) + ' ';
                wordCount = 1;
            } else {
                currentLine = word + ' ';
                wordCount = 1;
            }
        } else {
            currentLine += word + ' ';
            wordCount++;
        }
    }
    if (currentLine.trim()) {
        lines.push(currentLine.trim());
    }

    return (
        <span style={{ display: "inline-block", verticalAlign: "top" }}>
            {lines.slice(0, 4).map((line, idx) => (
                <span key={idx} style={{ display: "block" }}>{line}</span>
            ))}
        </span>
    );
};

export function BarcodeLabelPrint({ open, onOpenChange, product }: BarcodeLabelPrintProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const [variant, setVariant] = useState<LabelVariant>("marisit-tr");
    const [koliMiktari, setKoliMiktari] = useState<string>("");

    const isEnglish = variant === "marisit-en" || variant === "no-logo-en";
    const showMarisit = variant === "marisit-tr" || variant === "marisit-en";
    const showCezzone = variant === "cezzone";
    const showLogo = showMarisit || showCezzone;

    const labels = {
        model: isEnglish ? "Model" : "Model",
        company: isEnglish ? "Customer" : "Firma",
        fabric: isEnglish ? "Fabric" : "Kumaş",
        mfg: isEnglish ? "Furniture Manufacturing" : "Mobilya Üretim",
    };

    // Barcode lines generator
    const generateBarcodeLines = (barcode: string) => {
        const lines = [];
        const totalWidth = 280;
        const lineCount = barcode.length * 8;
        const lineWidth = totalWidth / lineCount;
        for (let i = 0; i < lineCount; i++) {
            const charCode = barcode.charCodeAt(Math.floor(i / 8)) || 65;
            const pattern = charCode % 4;
            const height = pattern === 0 ? 100 : pattern === 1 ? 90 : pattern === 2 ? 95 : 85;
            const isDark = (i + pattern) % 2 === 0;
            lines.push({ x: i * lineWidth, height, color: isDark ? "#000000" : "#ffffff" });
        }
        return lines;
    };
    const barcodeLines = generateBarcodeLines(product.barcode);

    const cezzoneLogoUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/cezzonelogo.png`;

    const getLogoHTML = () => {
        if (showMarisit) {
            return `
                <div class="logo">MARISIT</div>
                <div class="logo-subtitle">${labels.mfg}</div>
            `;
        }
        if (showCezzone) {
            return `<img src="${cezzoneLogoUrl}" alt="Cezzone" style="max-width:3.5cm;max-height:2.5cm;object-fit:contain;" />`;
        }
        return "";
    };

    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent) return;
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Etiket - ${product.barcode}</title>
                <style>
                    @page { size: 20cm 10cm landscape; margin: 0; }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        width: 20cm; height: 10cm;
                        font-family: Arial, sans-serif;
                        display: flex; align-items: center; justify-content: center;
                        background: white;
                    }
                    .label-container {
                        width: 19cm; height: 10cm;
                        border: 2px solid #1e293b; border-radius: 8px;
                        padding: 0.4cm 0.2cm;
                        display: grid; grid-template-columns: 1.2fr 1.5fr;
                        gap: 0.2cm; background: white;
                    }
                    .left-section {
                        display: flex; flex-direction: column;
                        justify-content: center; align-items: flex-start;
                        border-right: 2px solid #e2e8f0; padding-right: 0.4cm; padding-left: 0.4cm;
                    }
                    .logo { font-size: 96px; font-weight: bold; color: #1e40af; letter-spacing: 3px; margin-bottom: 16px; }
                    .logo-subtitle { font-size: 26px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; text-align: center; }
                    .product-info { margin-top: 0.8cm; text-align: left; width: 100%; }
                    .product-name { font-size: 40px; font-weight: bold; color: #0f172a; margin-bottom: 12px; word-wrap: break-word; }
                    .product-details { font-size: 30px; color: #475569; margin-bottom: 6px; }
                    .right-section {
                        display: flex; flex-direction: column;
                        justify-content: center; align-items: flex-start; padding-left: 0.2cm;
                    }
                    .barcode-svg { width: 100%; max-width: 11cm; height: auto; margin-bottom: 0px; margin-left: -0.4cm; }
                    .barcode-text { font-family: 'Courier New', monospace; font-size: 136px; font-weight: bold; letter-spacing: 2px; color: #0f172a; margin-top: 16px; margin-left: -0.4cm; }
                    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            window.onafterprint = function() { window.close(); };
                        }, 300);
                    };
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Printer className="h-5 w-5" />
                        Barkod Etiketi Yazdır
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Varyant Seçimi */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">Etiket Türü</label>
                        <div className="flex flex-wrap gap-2">
                            {VARIANTS.map((v) => (
                                <button
                                    key={v.value}
                                    onClick={() => setVariant(v.value)}
                                    className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${variant === v.value
                                        ? "bg-blue-600 text-white border-blue-600"
                                        : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
                                        }`}
                                >
                                    {v.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Koli Miktarı (Manuel Giriş) */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">Koli içi Miktarı (Opsiyonel)</label>
                        <Input
                            placeholder="Örn: 2 Koli, 1 Paket..."
                            value={koliMiktari}
                            onChange={(e) => setKoliMiktari(e.target.value)}
                            className="bg-white"
                        />
                    </div>

                    {/* Önizleme */}
                    <div className="bg-slate-50 p-3 rounded-lg border-2 border-slate-200 flex justify-center">
                        <div ref={printRef}>
                            <div className="border-2 border-slate-800 rounded-lg p-3 bg-white flex w-[19cm] h-[10cm] items-center gap-3">
                                {/* Sol Taraf — Logo ve Ürün Bilgisi */}
                                <div className="flex-[1.2] flex flex-col justify-center items-start border-r-2 border-slate-200 pr-3 pl-3 h-full">
                                    {showMarisit && (
                                        <>
                                            <div style={{ fontSize: "72px", fontWeight: "bold", color: "#1e40af", letterSpacing: "3px", marginBottom: "12px" }}>
                                                MARISIT
                                            </div>
                                            <div style={{ fontSize: "20px", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", textAlign: "center" }}>
                                                {labels.mfg}
                                            </div>
                                        </>
                                    )}
                                    {showCezzone && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src="/cezzonelogo.png" alt="Cezzone" style={{ maxWidth: "60cm", maxHeight: "76cm", objectFit: "contain" }} />
                                    )}

                                    <div style={{ marginTop: showLogo ? "0.6cm" : "0", textAlign: "left", width: "100%" }}>
                                        <div style={{ fontSize: "40px", fontWeight: "bold", color: "#0f172a", marginBottom: "10px", wordWrap: "break-word" }}>
                                            {product.name}
                                        </div>
                                        <div style={{ fontSize: "30px", color: "#475569", marginBottom: "4px" }}>
                                            {labels.model}: {product.model}
                                        </div>
                                        {product.company && (
                                            <div style={{
                                                fontSize: "26px", color: "#475569", marginBottom: "6px",
                                                lineHeight: "1.2"
                                            }}>
                                                <span style={{ verticalAlign: "top" }}>{labels.company}: </span>
                                                {formatCompanyNameReact(product.company)}
                                            </div>
                                        )}
                                        {/* Kumaş (DST) Bilgisi */}
                                        {(product.dstAdi || product.fabricType) && (
                                            <div style={{ fontSize: "30px", color: "#475569" }}>
                                                {product.dstAdi || product.fabricType}
                                            </div>
                                        )}
                                        {/* Koli Miktarı Bilgisi */}
                                        {koliMiktari && (
                                            <div style={{ fontSize: "30px", color: "#475569", marginTop: "6px" }}>
                                                {isEnglish ? "Box Qty:" : "Koli içi Miktarı:"} {koliMiktari}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Sağ — Barkod */}
                                <div style={{
                                    display: "flex", flexDirection: "column",
                                    justifyContent: "center", alignItems: "flex-start", paddingLeft: "0.2cm"
                                }}>
                                    <svg viewBox="0 0 300 100" style={{ width: "100%", maxWidth: "11cm", height: "auto", marginBottom: "0px", marginLeft: "-0.4cm" }}>
                                        <rect width="500" height="100" fill="white" />
                                        <g transform="translate(10, 0)">
                                            {barcodeLines.map((line, idx) => (
                                                <rect
                                                    key={idx}
                                                    x={line.x}
                                                    y={100 - line.height}
                                                    width={line.x < 280 ? (barcodeLines[idx + 1]?.x || 280) - line.x : 2}
                                                    height={line.height}
                                                    fill={line.color}
                                                />
                                            ))}
                                        </g>
                                    </svg>
                                    <div style={{ fontFamily: "'Courier New', monospace", fontSize: "136px", fontWeight: "bold", letterSpacing: "2px", color: "#0f172a", marginTop: "12px", textAlign: "left", marginLeft: "-0.4cm" }}>
                                        {product.barcode}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Butonlar */}
                    <div className="flex gap-2">
                        <Button onClick={handlePrint} className="flex-1 bg-blue-600 hover:bg-blue-700">
                            <Printer className="h-4 w-4 mr-2" />
                            Yazdır
                        </Button>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            İptal
                        </Button>
                    </div>
                    <p className="text-xs text-slate-500 text-center">20×10 cm yapışkan etiket kağıdı için optimize edilmiştir</p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
