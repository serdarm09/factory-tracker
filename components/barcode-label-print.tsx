"use client";

import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface BarcodeLabelPrintProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product: {
        barcode: string;
        name: string;
        model: string;
        company?: string;
    };
}

export function BarcodeLabelPrint({ open, onOpenChange, product }: BarcodeLabelPrintProps) {
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Etiket - ${product.barcode}</title>
                <style>
                    @page {
                        size: 10cm 10cm landscape;
                        margin: 0;
                    }

                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }

                    body {
                        width: 10cm;
                        height: 10cm;
                        font-family: Arial, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: white;
                    }

                    .label-container {
                        width: 9.5cm;
                        height: 9.5cm;
                        border: 2px solid #1e293b;
                        border-radius: 8px;
                        padding: 0.6cm;
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 0.5cm;
                        background: white;
                    }

                    .left-section {
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        border-right: 2px solid #e2e8f0;
                        padding-right: 0.5cm;
                    }

                    .logo {
                        font-size: 42px;
                        font-weight: bold;
                        color: #1e40af;
                        letter-spacing: 3px;
                        margin-bottom: 8px;
                    }

                    .logo-subtitle {
                        font-size: 11px;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        text-align: center;
                    }

                    .product-info {
                        margin-top: 0.6cm;
                        text-align: center;
                        width: 100%;
                    }

                    .product-name {
                        font-size: 15px;
                        font-weight: bold;
                        color: #0f172a;
                        margin-bottom: 6px;
                        word-wrap: break-word;
                    }

                    .product-details {
                        font-size: 12px;
                        color: #475569;
                        margin-bottom: 3px;
                    }

                    .right-section {
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        padding-left: 0.3cm;
                    }

                    .barcode-svg {
                        width: 100%;
                        max-width: 4cm;
                        height: auto;
                        margin-bottom: 10px;
                    }

                    .barcode-text {
                        font-family: 'Courier New', monospace;
                        font-size: 20px;
                        font-weight: bold;
                        letter-spacing: 2px;
                        color: #0f172a;
                        margin-top: 8px;
                    }

                    @media print {
                        body {
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                    }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            window.onafterprint = function() {
                                window.close();
                            };
                        }, 250);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    // Basit barcode SVG oluşturma (Code 128 benzeri görünüm)
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

            lines.push({
                x: i * lineWidth,
                height: height,
                color: isDark ? '#000000' : '#ffffff'
            });
        }
        return lines;
    };

    const barcodeLines = generateBarcodeLines(product.barcode);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Printer className="h-5 w-5" />
                        Barkod Etiketi Yazdır
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Önizleme */}
                    <div className="bg-slate-50 p-4 rounded-lg border-2 border-slate-200">
                        <div ref={printRef}>
                            <div className="label-container" style={{
                                width: '9.5cm',
                                height: '9.5cm',
                                border: '2px solid #1e293b',
                                borderRadius: '8px',
                                padding: '0.6cm',
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '0.5cm',
                                background: 'white'
                            }}>
                                {/* Sol Taraf - Logo ve Ürün Bilgileri */}
                                <div className="left-section" style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderRight: '2px solid #e2e8f0',
                                    paddingRight: '0.5cm'
                                }}>
                                    <div className="logo" style={{
                                        fontSize: '42px',
                                        fontWeight: 'bold',
                                        color: '#1e40af',
                                        letterSpacing: '3px',
                                        marginBottom: '8px'
                                    }}>
                                        MARISIT
                                    </div>
                                    <div className="logo-subtitle" style={{
                                        fontSize: '11px',
                                        color: '#64748b',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px',
                                        textAlign: 'center'
                                    }}>
                                        Furniture Manufacturing
                                    </div>

                                    {/* Ürün Bilgileri */}
                                    <div className="product-info" style={{
                                        marginTop: '0.6cm',
                                        textAlign: 'center',
                                        width: '100%'
                                    }}>
                                        <div className="product-name" style={{
                                            fontSize: '15px',
                                            fontWeight: 'bold',
                                            color: '#0f172a',
                                            marginBottom: '6px',
                                            wordWrap: 'break-word'
                                        }}>
                                            {product.name}
                                        </div>
                                        <div className="product-details" style={{
                                            fontSize: '12px',
                                            color: '#475569',
                                            marginBottom: '3px'
                                        }}>
                                            Model: {product.model}
                                        </div>
                                        {product.company && (
                                            <div className="product-details" style={{
                                                fontSize: '12px',
                                                color: '#475569'
                                            }}>
                                                {product.company}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Sağ Taraf - Barkod */}
                                <div className="right-section" style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    paddingLeft: '0.3cm'
                                }}>
                                    <svg
                                        className="barcode-svg"
                                        viewBox="0 0 300 100"
                                        style={{
                                            width: '100%',
                                            maxWidth: '4cm',
                                            height: 'auto',
                                            marginBottom: '10px'
                                        }}
                                    >
                                        <rect width="300" height="100" fill="white"/>
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
                                    <div className="barcode-text" style={{
                                        fontFamily: "'Courier New', monospace",
                                        fontSize: '20px',
                                        fontWeight: 'bold',
                                        letterSpacing: '2px',
                                        color: '#0f172a',
                                        marginTop: '8px'
                                    }}>
                                        {product.barcode}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Yazdır Butonu */}
                    <div className="flex gap-2">
                        <Button
                            onClick={handlePrint}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                            <Printer className="h-4 w-4 mr-2" />
                            Yazdır
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            İptal
                        </Button>
                    </div>

                    <p className="text-xs text-slate-500 text-center">
                        10x10 cm yapışkan etiket kağıdı için optimize edilmiştir
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
