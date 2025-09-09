// src/types/product.ts
export type Product = {
    id?: string;
    merchantId: string;
    name: string;
    price: number;         // IDR
    unit?: string;         // mis. "pcs", "kg", "paket"
    photoUrl?: string;
    description?: string;
    isActive?: boolean;
    createdAt?: any;
    updatedAt?: any;
};
