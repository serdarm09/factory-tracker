'use client';

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Activity, Package, CheckCircle2, Factory, Truck, AlertCircle, CalendarClock, User } from "lucide-react";
import { getProductTimeline } from "@/lib/actions";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface ProductTimelineDialogProps {
    productId: number;
    productName: string;
    trigger?: React.ReactNode;
}

export function ProductTimelineDialog({ productId, productName, trigger }: ProductTimelineDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [timeline, setTimeline] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setLoading(true);
            setError(null);
            getProductTimeline(productId)
                .then((res: any) => {
                    if (res.error) setError(res.error);
                    else setTimeline(res.timeline);
                })
                .catch(() => setError("Yüklenirken hata oluştu"))
                .finally(() => setLoading(false));
        }
    }, [open, productId]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'CREATED': return <Package className="h-4 w-4 text-blue-500" />;
            case 'CREATE_ORDER': return <Package className="h-4 w-4 text-blue-500" />;
            case 'PRODUCTION': return <Factory className="h-4 w-4 text-purple-500" />;
            case 'APPROVE': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
            case 'SHIPMENT': return <Truck className="h-4 w-4 text-teal-600" />;
            case 'REJECT': return <AlertCircle className="h-4 w-4 text-red-500" />;
            case 'UPDATE': return <CalendarClock className="h-4 w-4 text-orange-500" />;
            default: return <Activity className="h-4 w-4 text-slate-500" />;
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="icon" title="Geçmiş / İlerleme">
                        <Activity className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-100 rounded-full">
                            <Package className="h-5 w-5 text-slate-700" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg">{productName}</DialogTitle>
                            <p className="text-xs text-muted-foreground">Ürün Yaşam Döngüsü</p>
                        </div>
                    </div>
                </DialogHeader>
                <div className="h-[1px] w-full bg-slate-100" />

                <div className="flex-1 overflow-y-auto p-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <span className="text-sm">Veriler Getiriliyor...</span>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-2 text-red-500">
                            <AlertCircle className="h-8 w-8" />
                            <span className="text-sm font-medium">{error}</span>
                        </div>
                    ) : timeline.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                            <Activity className="h-8 w-8 opacity-20" />
                            <span className="text-sm">Henüz işlem kaydı bulunmuyor.</span>
                        </div>
                    ) : (
                        <div className="relative pl-6 pr-2 py-4 space-y-8">
                            {/* Vertical Line */}
                            <div className="absolute left-[23px] top-6 bottom-6 w-[2px] bg-slate-100" />

                            {timeline.map((item, index) => (
                                <div key={item.id} className="relative flex gap-4 group">
                                    {/* Icon Bubble */}
                                    <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white shadow-sm group-hover:scale-110 transition-transform duration-200 ${item.type === 'REJECT' ? 'border-red-100 bg-red-50' :
                                        item.type === 'APPROVE' ? 'border-green-100 bg-green-50' :
                                            'border-slate-100'
                                        }`}>
                                        {getIcon(item.type)}
                                    </div>

                                    {/* Content Card */}
                                    <div className="flex-1 flex flex-col gap-1 min-w-0 bg-slate-50/50 p-3 rounded-lg border border-transparent hover:border-slate-100 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-bold text-slate-900 truncate">
                                                {item.title}
                                            </span>
                                            <Badge variant="outline" className="shrink-0 text-[10px] font-normal text-slate-500 bg-white">
                                                {format(new Date(item.date), "d MMM HH:mm", { locale: tr })}
                                            </Badge>
                                        </div>

                                        <p className="text-sm text-slate-600 leading-snug">
                                            {item.description}
                                        </p>

                                        <div className="flex items-center gap-1 mt-1">
                                            <User className="h-3 w-3 text-slate-400" />
                                            <span className="text-xs text-slate-400 font-medium">
                                                {item.user || 'Sistem'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
