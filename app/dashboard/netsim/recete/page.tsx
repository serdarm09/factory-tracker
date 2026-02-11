"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  RefreshCw,
  Database,
  Package,
  Search,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Layers,
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Box,
  Download,
  Filter,
} from "lucide-react";
import {
  checkNetSimConnection,
  connectNetSim,
  getNetSimRecipes,
  getNetSimRecipeDetails,
  searchNetSimRecipes,
  getNetSimRevisionDetails,
} from "@/lib/netsim-actions";
import Link from "next/link";

interface NetSimRecipe {
  URETIM_RECETE_NO: number;
  RECETE_KODU: string;
  RECETE_ADI: string;
  AKTIF: string;
  STOK_NO: number;
  STOK_KODU: string | null;
  STOK_ADI: string | null;
  ACIKLAMA: string | null;
}

interface NetSimRecipeRevision {
  URETIM_REVIZYON_NO: number;
  URETIM_RECETE_NO: number;
  REVIZYON_KODU: string;
  AKTIF: string;
  VARSAYILAN: string;
  KATSAYI: number;
  MIKTAR: number;
  ACIKLAMA: string | null;
}

interface NetSimRecipeItem {
  REVIZYON_DETAY_NO: number;
  URETIM_REVIZYON_NO: number;
  ISLEM_ADI: string;
  ISLEM_YONU: number;
  DEGISKEN_ADI: string;
  SIRA_NO: number;
  STOK_NO: number;
  STOK_KODU: string | null;
  STOK_ADI: string | null;
  BIRIM: string;
  BIRIMX: number;
  DSTOK_NO: number;
  DSTOK_KODU: string | null;
  DSTOK_ADI: string | null;
  STOK_TIP_NO: number;
  STOK_TIP_ADI: string | null;
  ACIKLAMA: string | null;
}

export default function RecetePage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recipes, setRecipes] = useState<NetSimRecipe[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Selected recipe details
  const [selectedRecipe, setSelectedRecipe] = useState<NetSimRecipe | null>(null);
  const [revisions, setRevisions] = useState<NetSimRecipeRevision[]>([]);
  const [recipeItems, setRecipeItems] = useState<NetSimRecipeItem[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Sorting
  type SortField = "RECETE_KODU" | "RECETE_ADI" | "STOK_ADI" | "AKTIF";
  type SortDirection = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Filters
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "passive">("all");
  const [filterHasProduct, setFilterHasProduct] = useState<"all" | "yes" | "no">("all");

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    const status = await checkNetSimConnection();
    setIsConnected(status.isConnected);
    if (status.isConnected) {
      loadRecipes(1, pageSize);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const result = await connectNetSim("MARISITTEST.FDB");
      if (result.isConnected) {
        setIsConnected(true);
        toast.success(`Baglanti basarili! ${result.tableCount} tablo bulundu.`);
        loadRecipes(1, pageSize);
      } else {
        toast.error(result.errorMessage || "Baglanti kurulamadi");
      }
    } catch {
      toast.error("Baglanti hatasi");
    } finally {
      setIsConnecting(false);
    }
  };

  const loadRecipes = async (page: number = currentPage, size: number = pageSize) => {
    setIsLoading(true);
    try {
      const offset = (page - 1) * size;
      const result = await getNetSimRecipes({ limit: size, offset });
      if (result.success) {
        setRecipes(result.recipes);
        setTotalCount(result.totalCount);
        setTotalPages(result.totalPages);
        setCurrentPage(page);
        setPageSize(size);
      } else {
        toast.error(result.error || "Receteler yuklenemedi");
      }
    } catch {
      toast.error("Receteler yuklenirken hata olustu");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadRecipes(1, pageSize);
      return;
    }

    setIsSearching(true);
    try {
      const result = await searchNetSimRecipes(searchQuery);
      if (result.success) {
        setRecipes(result.recipes);
        setTotalCount(result.recipes.length);
        setTotalPages(1);
        setCurrentPage(1);
      } else {
        toast.error(result.error || "Arama hatasi");
      }
    } catch {
      toast.error("Arama sirasinda hata olustu");
    } finally {
      setIsSearching(false);
    }
  };

  const loadRecipeDetails = async (recipe: NetSimRecipe) => {
    setSelectedRecipe(recipe);
    setIsLoadingDetails(true);
    setSelectedRevision(null);
    try {
      const result = await getNetSimRecipeDetails(recipe.URETIM_RECETE_NO);
      if (result.success) {
        setRevisions(result.revisions || []);
        setRecipeItems(result.items || []);
        if (result.items.length === 0) {
          toast.info("Bu recete icin detay bulunamadi");
        }
      } else {
        toast.error(result.error || "Recete detaylari alinamadi");
        setRevisions([]);
        setRecipeItems([]);
      }
    } catch {
      toast.error("Recete detaylari yuklenirken hata olustu");
      setRevisions([]);
      setRecipeItems([]);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const loadRevisionDetails = async (revizyonNo: number) => {
    setSelectedRevision(revizyonNo);
    setIsLoadingDetails(true);
    try {
      const result = await getNetSimRevisionDetails(revizyonNo);
      if (result.success) {
        setRecipeItems(result.items || []);
      } else {
        toast.error(result.error || "Revizyon detaylari alinamadi");
      }
    } catch {
      toast.error("Revizyon detaylari yuklenirken hata olustu");
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Islem yonune gore ikon
  const getIslemYonuIcon = (yonu: number) => {
    if (yonu === 1) return <ArrowDown className="h-4 w-4 text-green-600" />;
    if (yonu === -1) return <ArrowUp className="h-4 w-4 text-red-600" />;
    return <ArrowRight className="h-4 w-4 text-gray-400" />;
  };

  const getIslemYonuText = (yonu: number) => {
    if (yonu === 1) return "Giris";
    if (yonu === -1) return "Cikis";
    return "-";
  };

  // Sorting function
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Get filtered and sorted recipes
  const getFilteredAndSortedRecipes = () => {
    let filtered = recipes;

    // Apply status filter
    if (filterStatus === "active") {
      filtered = filtered.filter((r) => r.AKTIF === "E");
    } else if (filterStatus === "passive") {
      filtered = filtered.filter((r) => r.AKTIF !== "E");
    }

    // Apply product filter
    if (filterHasProduct === "yes") {
      filtered = filtered.filter((r) => r.STOK_NO && r.STOK_NO > 0);
    } else if (filterHasProduct === "no") {
      filtered = filtered.filter((r) => !r.STOK_NO || r.STOK_NO === 0);
    }

    // Apply sorting
    if (!sortField) return filtered;

    return [...filtered].sort((a, b) => {
      let aVal: string | null = null;
      let bVal: string | null = null;

      switch (sortField) {
        case "RECETE_KODU":
          aVal = a.RECETE_KODU || "";
          bVal = b.RECETE_KODU || "";
          break;
        case "RECETE_ADI":
          aVal = a.RECETE_ADI || "";
          bVal = b.RECETE_ADI || "";
          break;
        case "STOK_ADI":
          aVal = a.STOK_ADI || "";
          bVal = b.STOK_ADI || "";
          break;
        case "AKTIF":
          aVal = a.AKTIF || "";
          bVal = b.AKTIF || "";
          break;
      }

      const comparison = aVal.localeCompare(bVal, "tr");
      return sortDirection === "asc" ? comparison : -comparison;
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setFilterStatus("all");
    setFilterHasProduct("all");
    setSortField(null);
    setSortDirection("asc");
    loadRecipes(1, pageSize);
  };

  // Check if any filter is active
  const hasActiveFilters = searchQuery || filterStatus !== "all" || filterHasProduct !== "all" || sortField;

  // Export to Excel
  const exportToExcel = () => {
    const filteredRecipes = getFilteredAndSortedRecipes();

    // Create CSV content
    const headers = ["Recete Kodu", "Recete Adi", "Urun Kodu", "Urun Adi", "Durum"];
    const rows = filteredRecipes.map((recipe) => [
      recipe.RECETE_KODU || "",
      recipe.RECETE_ADI || "",
      recipe.STOK_KODU || "",
      recipe.STOK_ADI || "",
      recipe.AKTIF === "E" ? "Aktif" : "Pasif",
    ]);

    // BOM for Excel UTF-8 support
    const BOM = "\uFEFF";
    const csvContent = BOM + [headers.join(";"), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(";"))].join("\n");

    // Download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `receteler_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${filteredRecipes.length} recete Excel'e aktarildi`);
  };

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-4 w-4 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-1 h-4 w-4" />
    );
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto py-10">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-6 w-6" />
              NetSim Baglantisi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              NetSim veritabanina baglanarak uretim recetelerini goruntuleyebilirsiniz.
            </p>
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Baglaniyor...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  NetSim'e Baglan
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/netsim">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Geri
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Uretim Receteleri
            </h1>
            <p className="text-muted-foreground">
              NetSim'deki uretim recetelerini ve hammaddelerini goruntuleyin
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} disabled={isLoading || recipes.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button variant="outline" onClick={() => loadRecipes()} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Recete</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground">
              Tanimli uretim receteleri
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Filtrelenmis</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getFilteredAndSortedRecipes().length}</div>
            <p className="text-xs text-muted-foreground">
              {hasActiveFilters ? "Filtre uygulandi" : "Filtre yok"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sayfa</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentPage}/{totalPages || 1}
            </div>
            <p className="text-xs text-muted-foreground">
              {recipes.length} kayit gosteriliyor
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Baglanti</CardTitle>
            <Database className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium text-green-600">Aktif</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Arama ve Filtreler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Row */}
          <div className="flex gap-2">
            <Input
              placeholder="Recete kodu veya adi ile ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="max-w-md"
            />
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2">Ara</span>
            </Button>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Durum:</span>
              <Select
                value={filterStatus}
                onValueChange={(value: "all" | "active" | "passive") => setFilterStatus(value)}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tumu</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="passive">Pasif</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Product Link Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Urun Baglantisi:</span>
              <Select
                value={filterHasProduct}
                onValueChange={(value: "all" | "yes" | "no") => setFilterHasProduct(value)}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tumu</SelectItem>
                  <SelectItem value="yes">Bagli</SelectItem>
                  <SelectItem value="no">Bagli Degil</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Filtreleri Temizle
              </Button>
            )}
          </div>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <span className="text-sm text-muted-foreground">Aktif Filtreler:</span>
              {searchQuery && (
                <Badge variant="secondary">Arama: "{searchQuery}"</Badge>
              )}
              {filterStatus !== "all" && (
                <Badge variant="secondary">
                  Durum: {filterStatus === "active" ? "Aktif" : "Pasif"}
                </Badge>
              )}
              {filterHasProduct !== "all" && (
                <Badge variant="secondary">
                  Urun: {filterHasProduct === "yes" ? "Bagli" : "Bagli Degil"}
                </Badge>
              )}
              {sortField && (
                <Badge variant="secondary">
                  Siralama: {sortField === "RECETE_KODU" ? "Recete Kodu" :
                            sortField === "RECETE_ADI" ? "Recete Adi" :
                            sortField === "STOK_ADI" ? "Urun" : "Durum"}
                  ({sortDirection === "asc" ? "A-Z" : "Z-A"})
                </Badge>
              )}
              <Badge variant="outline" className="text-muted-foreground">
                {getFilteredAndSortedRecipes().length} sonuc
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recipes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Uretim Receteleri</CardTitle>
          <CardDescription>
            Her reçetenin detaylarını görmek için "Detay" butonuna tıklayın
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("RECETE_KODU")}
                >
                  <div className="flex items-center">
                    Recete Kodu
                    <SortIcon field="RECETE_KODU" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("RECETE_ADI")}
                >
                  <div className="flex items-center">
                    Recete Adi
                    <SortIcon field="RECETE_ADI" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("STOK_ADI")}
                >
                  <div className="flex items-center">
                    Urun
                    <SortIcon field="STOK_ADI" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("AKTIF")}
                >
                  <div className="flex items-center">
                    Durum
                    <SortIcon field="AKTIF" />
                  </div>
                </TableHead>
                <TableHead className="w-24">Islemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getFilteredAndSortedRecipes().map((recipe, index) => (
                <TableRow key={`${recipe.URETIM_RECETE_NO}-${index}`}>
                  <TableCell className="font-mono font-medium">
                    {recipe.RECETE_KODU}
                  </TableCell>
                  <TableCell>{recipe.RECETE_ADI}</TableCell>
                  <TableCell>
                    {recipe.STOK_KODU ? (
                      <div>
                        <span className="font-mono text-xs">{recipe.STOK_KODU}</span>
                        <div className="text-xs text-muted-foreground">{recipe.STOK_ADI}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={recipe.AKTIF === "E" ? "default" : "secondary"}>
                      {recipe.AKTIF === "E" ? "Aktif" : "Pasif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => loadRecipeDetails(recipe)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Detay
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Recete Detayi: {selectedRecipe?.RECETE_KODU}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          {/* Recipe Info */}
                          <div className="p-4 bg-muted rounded-lg">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Recete Kodu:</span>{" "}
                                <span className="font-mono font-medium">
                                  {selectedRecipe?.RECETE_KODU}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Recete Adi:</span>{" "}
                                <span className="font-medium">
                                  {selectedRecipe?.RECETE_ADI}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Urun:</span>{" "}
                                {selectedRecipe?.STOK_ADI || "-"}
                              </div>
                              <div>
                                <span className="text-muted-foreground">
                                  Malzeme Sayisi:
                                </span>{" "}
                                <Badge>{recipeItems.length}</Badge>
                              </div>
                            </div>
                          </div>

                          {/* Revisions */}
                          {revisions.length > 0 && (
                            <Card>
                              <CardHeader className="py-3">
                                <CardTitle className="text-sm">Revizyonlar</CardTitle>
                              </CardHeader>
                              <CardContent className="py-2">
                                <div className="flex gap-2 flex-wrap">
                                  {revisions.map((rev) => (
                                    <Button
                                      key={rev.URETIM_REVIZYON_NO}
                                      variant={selectedRevision === rev.URETIM_REVIZYON_NO ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => loadRevisionDetails(rev.URETIM_REVIZYON_NO)}
                                    >
                                      {rev.REVIZYON_KODU}
                                      {rev.VARSAYILAN === "E" && (
                                        <Badge variant="secondary" className="ml-2 text-xs">Varsayilan</Badge>
                                      )}
                                    </Button>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Recipe Items */}
                          {isLoadingDetails ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin mr-2" />
                              Detaylar yukleniyor...
                            </div>
                          ) : recipeItems.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              Bu recete icin detay bulunamadi
                            </div>
                          ) : (
                            <Card>
                              <CardHeader className="py-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <Box className="h-4 w-4" />
                                  Hammaddeler ve Islemler
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-12">Sira</TableHead>
                                      <TableHead className="w-12">Yon</TableHead>
                                      <TableHead>Islem</TableHead>
                                      <TableHead>Stok Kodu</TableHead>
                                      <TableHead>Stok Adi</TableHead>
                                      <TableHead>Birim</TableHead>
                                      <TableHead>Katsayi</TableHead>
                                      <TableHead>Tip</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {recipeItems.map((item, idx) => (
                                      <TableRow
                                        key={idx}
                                        className={item.ISLEM_YONU === 1 ? "bg-green-50" : item.ISLEM_YONU === -1 ? "bg-red-50" : ""}
                                      >
                                        <TableCell>{item.SIRA_NO}</TableCell>
                                        <TableCell>
                                          <div className="flex items-center gap-1">
                                            {getIslemYonuIcon(item.ISLEM_YONU)}
                                            <span className="text-xs">{getIslemYonuText(item.ISLEM_YONU)}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <div className="font-medium">{item.ISLEM_ADI}</div>
                                          {item.DEGISKEN_ADI && (
                                            <div className="text-xs text-muted-foreground">
                                              {item.DEGISKEN_ADI}
                                            </div>
                                          )}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                          {item.STOK_KODU || "-"}
                                        </TableCell>
                                        <TableCell>
                                          <div>{item.STOK_ADI || "-"}</div>
                                          {item.DSTOK_ADI && item.DSTOK_ADI !== item.STOK_ADI && (
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                              <ArrowRight className="h-3 w-3" />
                                              {item.DSTOK_ADI}
                                            </div>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant="outline">{item.BIRIM}</Badge>
                                        </TableCell>
                                        <TableCell className="font-mono">
                                          {item.BIRIMX || 1}
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant="secondary" className="text-xs">
                                            {item.STOK_TIP_ADI || "-"}
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
              {recipes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Yukleniyor...
                      </div>
                    ) : (
                      "Recete bulunamadi"
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 0 && (
            <div className="flex items-center justify-between px-2 py-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Sayfa basina:</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    const newSize = parseInt(value);
                    setPageSize(newSize);
                    loadRecipes(1, newSize);
                  }}
                >
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span>Toplam {totalCount} kayit</span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadRecipes(1)}
                  disabled={currentPage === 1 || isLoading}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadRecipes(currentPage - 1)}
                  disabled={currentPage === 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1 mx-2">
                  <span className="text-sm">
                    Sayfa {currentPage} / {totalPages}
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadRecipes(currentPage + 1)}
                  disabled={currentPage === totalPages || isLoading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadRecipes(totalPages)}
                  disabled={currentPage === totalPages || isLoading}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
