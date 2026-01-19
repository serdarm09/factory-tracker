import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CatalogTable } from "./catalog-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { CatalogImportDialog } from "@/components/catalog-import-dialog";
import { CatalogDeleteDialog } from "@/components/catalog-delete-dialog";
import { getCatalog } from "@/lib/catalog-actions";

export default async function CatalogPage({
    searchParams,
}: {
    searchParams: { q?: string; page?: string };
}) {
    const session = await auth();
    if (!session || (session.user as any).role !== "ADMIN") {
        redirect("/dashboard");
    }

    const page = Number(searchParams.page) || 1;
    const query = searchParams.q || "";

    // Use shared getCatalog action for pagination
    const { items: products, total, totalPages } = await getCatalog(page, query);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Katalog Yönetimi</h2>
                <div className="text-sm text-muted-foreground">
                    Toplam {total} ürün bulundu
                </div>
            </div>

            <div className="flex items-center space-x-2">
                <div className="flex w-full items-center justify-between">
                    <form className="flex w-full max-w-sm items-center space-x-2">
                        <Input
                            placeholder="İsim veya Kod ile ara..."
                            name="q"
                            defaultValue={query}
                        />
                        <Button type="submit">
                            <Search className="h-4 w-4 mr-2" />
                            Ara
                        </Button>
                    </form>
                    <div className="flex gap-2">
                        <CatalogDeleteDialog />
                        <CatalogImportDialog />
                    </div>
                </div>
            </div>

            <CatalogTable products={products} />

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 py-4">
                    {page > 1 ? (
                        <a href={`/dashboard/admin/catalog?page=${page - 1}&q=${query}`} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
                            Önceki
                        </a>
                    ) : (
                        <Button variant="outline" disabled>Önceki</Button>
                    )}

                    <span className="text-sm text-muted-foreground mx-4">
                        Sayfa {page} / {totalPages}
                    </span>

                    {page < totalPages ? (
                        <a href={`/dashboard/admin/catalog?page=${page + 1}&q=${query}`} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
                            Sonraki
                        </a>
                    ) : (
                        <Button variant="outline" disabled>Sonraki</Button>
                    )}
                </div>
            )}
        </div>
    );
}
