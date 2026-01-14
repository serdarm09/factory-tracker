'use client';
import Barcode from 'react-barcode';

export default function BarcodeDisplay({ value }: { value: string }) {
    return <Barcode value={value} width={1.2} height={35} fontSize={12} />;
}
