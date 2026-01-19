"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

interface ProductImageProps {
    src: string;
    alt: string;
    className?: string;
}

export function ProductImage({ src, alt, className }: ProductImageProps) {
    const [error, setError] = useState(false);

    if (error) {
        return (
            <div className={`flex flex-col items-center justify-center bg-slate-100 text-slate-400 ${className}`}>
                <ImageOff className="h-8 w-8 mb-2 opacity-50" />
                <span className="text-xs">Görsel Yok</span>
            </div>
        );
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt={alt}
            className={className}
            onError={() => setError(true)}
        />
    );
}
