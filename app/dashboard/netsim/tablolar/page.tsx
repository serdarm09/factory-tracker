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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  RefreshCw,
  Database,
  Search,
  Loader2,
  ArrowLeft,
  Eye,
  Table2,
  Link as LinkIcon,
} from "lucide-react";
import {
  checkNetSimConnection,
  connectNetSim,
  getNetSimTables,
  getNetSimTableColumns,
} from "@/lib/netsim-actions";
import Link from "next/link";

interface TableColumn {
  FIELD_NAME: string;
  FIELD_TYPE: string;
  FIELD_LENGTH: number;
  FIELD_NULL: string;
}

export default function TablolarPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tables, setTables] = useState<{ TABLE_NAME: string }[]>([]);
  const [filter, setFilter] = useState("");

  // Selected table schema
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableColumns, setTableColumns] = useState<TableColumn[]>([]);
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    const status = await checkNetSimConnection();
    setIsConnected(status.isConnected);
    if (status.isConnected) {
      loadTables();
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const result = await connectNetSim("MARISITTEST.FDB");
      if (result.isConnected) {
        setIsConnected(true);
        toast.success(`Baglanti basarili!`);
        loadTables();
      } else {
        toast.error(result.errorMessage || "Baglanti kurulamadi");
      }
    } catch (error) {
      toast.error("Baglanti hatasi");
    } finally {
      setIsConnecting(false);
    }
  };

  const loadTables = async () => {
    setIsLoading(true);
    try {
      const result = await getNetSimTables();
      if (result.success) {
        setTables(result.tables);
        toast.success(`${result.tables.length} tablo bulundu`);
      } else {
        toast.error(result.error || "Tablolar yuklenemedi");
      }
    } catch (error) {
      toast.error("Tablolar yuklenirken hata olustu");
    } finally {
      setIsLoading(false);
    }
  };

  const loadTableColumns = async (tableName: string) => {
    setSelectedTable(tableName);
    setIsLoadingColumns(true);
    try {
      const result = await getNetSimTableColumns(tableName);
      if (result.success) {
        setTableColumns(result.columns);
      } else {
        toast.error(result.error || "Kolonlar yuklenemedi");
        setTableColumns([]);
      }
    } catch (error) {
      toast.error("Kolonlar yuklenirken hata olustu");
      setTableColumns([]);
    } finally {
      setIsLoadingColumns(false);
    }
  };

  const filteredTables = tables.filter((t) =>
    t.TABLE_NAME?.toLowerCase().includes(filter.toLowerCase())
  );

  // Recete ile ilgili olabilecek tablolari vurgula
  const isRecipeRelated = (name: string) => {
    const keywords = ["URET", "REC", "BOM", "HAMMADDE", "MALZEME", "STOK"];
    return keywords.some((k) => name?.toUpperCase().includes(k));
  };

  // Recete tablolarinin iliskileri
  const recipeRelations = [
    {
      from: "URETRECE",
      to: "URETREVI",
      relation: "1:N",
      key: "URETIM_RECETE_NO",
      description: "Ana recete → Revizyonlar"
    },
    {
      from: "URETREVI",
      to: "URETREDE",
      relation: "1:N",
      key: "URETIM_REVIZYON_NO",
      description: "Revizyon → Recete Detaylari (Hammaddeler)"
    },
    {
      from: "URETREDE",
      to: "STOKKART",
      relation: "N:1",
      key: "STOK_NO",
      description: "Recete Detay → Stok (Hammadde)"
    },
    {
      from: "URETREDE",
      to: "STOKKART",
      relation: "N:1",
      key: "DSTOK_NO",
      description: "Recete Detay → Stok (Uretilen)"
    },
    {
      from: "URETREDE",
      to: "STOKTIPI",
      relation: "N:1",
      key: "STOK_TIP_NO",
      description: "Recete Detay → Stok Tipi"
    },
    {
      from: "URETREDE",
      to: "URETRECE",
      relation: "N:1",
      key: "URETILEN_RECETE_NO",
      description: "Alt Recete Baglantisi"
    },
  ];

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
              NetSim veritabanina baglanarak tablolari goruntuleyebilirsiniz.
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
              <Database className="h-6 w-6" />
              NetSim Veritabani Yapisi
            </h1>
            <p className="text-muted-foreground">
              Tablo yapilari ve iliskileri
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={loadTables} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Yenile
        </Button>
      </div>

      <Tabs defaultValue="relations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="relations">
            <LinkIcon className="mr-2 h-4 w-4" />
            Recete Iliskileri
          </TabsTrigger>
          <TabsTrigger value="tables">
            <Table2 className="mr-2 h-4 w-4" />
            Tum Tablolar
          </TabsTrigger>
        </TabsList>

        {/* Relations Tab */}
        <TabsContent value="relations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Uretim Recetesi Tablo Iliskileri</CardTitle>
              <CardDescription>
                URETRECE, URETREVI ve URETREDE tablolari arasindaki iliskiler
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Visual Diagram */}
                <div className="p-6 bg-muted rounded-lg">
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-8">
                      <Card className="p-4 bg-blue-50 border-blue-200">
                        <div className="font-bold text-blue-800">URETRECE</div>
                        <div className="text-xs text-blue-600">Ana Recete</div>
                        <div className="text-xs mt-2 font-mono">
                          - URETIM_RECETE_NO (PK)<br/>
                          - RECETE_KODU<br/>
                          - RECETE_ADI<br/>
                          - AKTIF
                        </div>
                      </Card>
                      <div className="text-2xl">→</div>
                      <Card className="p-4 bg-green-50 border-green-200">
                        <div className="font-bold text-green-800">URETREVI</div>
                        <div className="text-xs text-green-600">Revizyonlar</div>
                        <div className="text-xs mt-2 font-mono">
                          - URETIM_REVIZYON_NO (PK)<br/>
                          - URETIM_RECETE_NO (FK)<br/>
                          - REVIZYON_KODU<br/>
                          - AKTIF
                        </div>
                      </Card>
                      <div className="text-2xl">→</div>
                      <Card className="p-4 bg-orange-50 border-orange-200">
                        <div className="font-bold text-orange-800">URETREDE</div>
                        <div className="text-xs text-orange-600">Recete Detaylari</div>
                        <div className="text-xs mt-2 font-mono">
                          - URETIM_REVIZYON_NO (FK)<br/>
                          - SIRA_NO<br/>
                          - STOK_NO (FK→STOKKART)<br/>
                          - DSTOK_NO (FK→STOKKART)<br/>
                          - FORMUL
                        </div>
                      </Card>
                    </div>
                    <div className="flex items-center gap-8 mt-4">
                      <Card className="p-4 bg-purple-50 border-purple-200">
                        <div className="font-bold text-purple-800">STOKKART</div>
                        <div className="text-xs text-purple-600">Stok/Urun Bilgileri</div>
                        <div className="text-xs mt-2 font-mono">
                          - STOK_NO (PK)<br/>
                          - STOK_KODU<br/>
                          - STOK_ADI<br/>
                          - BIRIM1
                        </div>
                      </Card>
                      <Card className="p-4 bg-pink-50 border-pink-200">
                        <div className="font-bold text-pink-800">STOKTIPI</div>
                        <div className="text-xs text-pink-600">Stok Tipleri</div>
                        <div className="text-xs mt-2 font-mono">
                          - STOK_TIP_NO (PK)<br/>
                          - STOK_TIP_ADI
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>

                {/* Relations Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kaynak Tablo</TableHead>
                      <TableHead>Hedef Tablo</TableHead>
                      <TableHead>Iliski</TableHead>
                      <TableHead>Anahtar</TableHead>
                      <TableHead>Aciklama</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipeRelations.map((rel, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono font-medium">{rel.from}</TableCell>
                        <TableCell className="font-mono">{rel.to}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{rel.relation}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{rel.key}</TableCell>
                        <TableCell>{rel.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Recipe Schema Details */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-blue-800">URETRECE</CardTitle>
                <CardDescription>Ana Recete Tablosu</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => loadTableColumns("URETRECE")}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Kolonlari Gor
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-green-800">URETREVI</CardTitle>
                <CardDescription>Recete Revizyonlari</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => loadTableColumns("URETREVI")}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Kolonlari Gor
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-orange-800">URETREDE</CardTitle>
                <CardDescription>Recete Detaylari (Hammaddeler)</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => loadTableColumns("URETREDE")}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Kolonlari Gor
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Selected Table Columns */}
          {selectedTable && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Table2 className="h-5 w-5" />
                  {selectedTable} Kolonlari
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingColumns ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Yukleniyor...
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kolon Adi</TableHead>
                        <TableHead>Tip</TableHead>
                        <TableHead>Uzunluk</TableHead>
                        <TableHead>Null</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableColumns.map((col, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono font-medium">
                            {col.FIELD_NAME?.trim()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{col.FIELD_TYPE}</Badge>
                          </TableCell>
                          <TableCell>{col.FIELD_LENGTH}</TableCell>
                          <TableCell>
                            <Badge variant={col.FIELD_NULL === "NOT NULL" ? "default" : "secondary"}>
                              {col.FIELD_NULL}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* All Tables Tab */}
        <TabsContent value="tables" className="space-y-4">
          {/* Filter */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tablo Ara</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Tablo adi ile filtrele... (ornek: URET, STOK, CARI)"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="max-w-md"
                />
                <Search className="h-5 w-5 text-muted-foreground mt-2" />
              </div>
            </CardContent>
          </Card>

          {/* Tables List */}
          <Card>
            <CardHeader>
              <CardTitle>
                Tablolar ({filteredTables.length} / {tables.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Tablo Adi</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="w-24">Islem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTables.map((table, index) => (
                    <TableRow
                      key={table.TABLE_NAME}
                      className={isRecipeRelated(table.TABLE_NAME) ? "bg-yellow-50" : ""}
                    >
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-mono font-medium">
                        {table.TABLE_NAME?.trim()}
                      </TableCell>
                      <TableCell>
                        {isRecipeRelated(table.TABLE_NAME) && (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-400">
                            Uretim/Recete
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => loadTableColumns(table.TABLE_NAME?.trim())}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTables.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        {isLoading ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Yukleniyor...
                          </div>
                        ) : (
                          "Tablo bulunamadi"
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
