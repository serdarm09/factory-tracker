'use client';

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, CheckCheck, Trash2, AlertTriangle } from "lucide-react";
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } from "@/lib/actions";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import Link from "next/link";

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    productId?: number;
    productName?: string;
    systemCode?: string;
    isRead: boolean;
    createdBy?: string;
    createdAt: Date;
}

interface NotificationDropdownProps {
    initialCount: number;
}

export function NotificationDropdown({ initialCount }: NotificationDropdownProps) {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(initialCount);
    const [isPending, startTransition] = useTransition();
    const [loading, setLoading] = useState(false);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const data = await getNotifications();
            setNotifications(data as Notification[]);
            setUnreadCount((data as Notification[]).filter(n => !n.isRead).length);
        } catch (e) {
            console.error("Fetch notifications error:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchNotifications();
        }
    }, [open]);

    // Poll for new notifications every 30 seconds
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const data = await getNotifications();
                setUnreadCount((data as Notification[]).filter(n => !n.isRead).length);
            } catch (e) { }
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const handleMarkAsRead = async (id: number) => {
        startTransition(async () => {
            await markNotificationAsRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        });
    };

    const handleMarkAllAsRead = async () => {
        startTransition(async () => {
            await markAllNotificationsAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        });
    };

    const handleDelete = async (id: number) => {
        startTransition(async () => {
            await deleteNotification(id);
            const wasUnread = notifications.find(n => n.id === id)?.isRead === false;
            setNotifications(prev => prev.filter(n => n.id !== id));
            if (wasUnread) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        });
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "MARKETING_REJECT":
                return <AlertTriangle className="h-4 w-4 text-red-500" />;
            default:
                return <Bell className="h-4 w-4 text-blue-500" />;
        }
    };

    const getTypeBgColor = (type: string) => {
        switch (type) {
            case "MARKETING_REJECT":
                return "bg-red-50 border-red-200";
            default:
                return "bg-blue-50 border-blue-200";
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="relative w-full justify-start gap-3 px-4 py-3 text-white hover:bg-slate-800"
                >
                    <Bell className="h-5 w-5 text-slate-300" />
                    <span className="font-medium">Bildirimler</span>
                    {unreadCount > 0 && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align="start" side="right">
                <div className="flex items-center justify-between border-b p-3 bg-slate-50">
                    <h4 className="font-semibold text-slate-900">Bildirimler</h4>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={handleMarkAllAsRead}
                            disabled={isPending}
                        >
                            <CheckCheck className="h-3 w-3" />
                            Tümünü Okundu İşaretle
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[400px]">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <span className="text-sm text-muted-foreground">Yükleniyor...</span>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                            <Bell className="h-8 w-8 mb-2 opacity-50" />
                            <span className="text-sm">Bildirim bulunmuyor</span>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-3 hover:bg-slate-50 transition-colors ${!notification.isRead ? "bg-blue-50/50" : ""}`}
                                >
                                    <div className="flex gap-3">
                                        <div className={`flex-shrink-0 p-2 rounded-full ${getTypeBgColor(notification.type)}`}>
                                            {getTypeIcon(notification.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={`text-sm font-medium ${!notification.isRead ? "text-slate-900" : "text-slate-600"}`}>
                                                    {notification.title}
                                                </p>
                                                <div className="flex gap-1 flex-shrink-0">
                                                    {!notification.isRead && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6"
                                                            onClick={() => handleMarkAsRead(notification.id)}
                                                            disabled={isPending}
                                                            title="Okundu işaretle"
                                                        >
                                                            <Check className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => handleDelete(notification.id)}
                                                        disabled={isPending}
                                                        title="Sil"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1 whitespace-pre-line">
                                                {notification.message}
                                            </p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-[10px] text-slate-400">
                                                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: tr })}
                                                    {notification.createdBy && ` - ${notification.createdBy}`}
                                                </span>
                                                {notification.productId && (
                                                    <Link
                                                        href="/dashboard/admin/approvals"
                                                        className="text-[10px] text-blue-600 hover:underline"
                                                        onClick={() => setOpen(false)}
                                                    >
                                                        Onay Sayfasına Git
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
