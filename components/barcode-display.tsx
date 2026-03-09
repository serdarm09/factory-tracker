'use client';
import Barcode from 'react-barcode';

export default function BarcodeDisplay({ value }: { value: string }) {
    return <Barcode value={value} width={1.5} height={40} fontSize={30} />;
}
