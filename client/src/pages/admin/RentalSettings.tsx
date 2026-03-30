import { useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { read, utils as xlsxUtils } from 'xlsx';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { ArrowLeft, FileSpreadsheet, Package2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

function normalizeCell(value: unknown) {
  return String(value ?? '').trim();
}

function parseRows(rows: Record<string, unknown>[]) {
  return rows
    .map((row) => {
      const keys = Object.keys(row);
      const findValue = (candidates: string[]) => {
        const key = keys.find((entry) => candidates.some((candidate) => entry.toLowerCase().includes(candidate)));
        return key ? normalizeCell(row[key]) : '';
      };

      return {
        name: findValue(['이름', 'name']),
        studentId: findValue(['학번', 'student', 'id']),
        department: findValue(['학과', '학부', 'department']),
        phone: findValue(['연락처', '전화', 'phone']),
      };
    })
    .filter((row) => row.name && row.studentId);
}

export default function RentalSettings() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewRows, setPreviewRows] = useState<Array<{ name: string; studentId: string; department?: string; phone?: string }>>([]);
  const utilsTrpc = trpc.useUtils();

  const { data: feePayers = [], isLoading: feePayersLoading } = trpc.rental.listFeePayers.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === 'admin',
  });
  const { data: items = [] } = trpc.items.list.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === 'admin',
  });
  const { data: rentalDashboard } = trpc.rental.getDashboard.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const uploadMutation = trpc.rental.uploadFeePayers.useMutation({
    onSuccess: async (result) => {
      toast.success(`${result.count}명의 학생회비 납부자 명단을 업로드했습니다.`);
      setPreviewRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await Promise.all([
        utilsTrpc.rental.listFeePayers.invalidate(),
        utilsTrpc.rental.getDashboard.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  if (!isAuthenticated) { window.location.href = '/admin/login'; return null; }
  if (user?.role !== 'admin') return null;

  const handleFileChange = async (file?: File) => {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonRows = xlsxUtils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
      const parsed = parseRows(jsonRows);
      if (parsed.length === 0) {
        toast.error('이름과 학번 컬럼을 찾지 못했습니다. 헤더명을 다시 확인해주세요.');
        return;
      }
      setPreviewRows(parsed);
      toast.success(`${parsed.length}개 행을 불러왔습니다. 검토 후 업로드하세요.`);
    } catch (error) {
      console.error(error);
      toast.error('엑셀 파일을 읽는 중 오류가 발생했습니다. .xlsx 형식을 확인해주세요.');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container flex items-center h-14">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="mr-2"><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="font-semibold">대여사업 설정</h1>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="elegant-card"><CardContent className="p-4"><div className="text-sm text-muted-foreground">등록 납부자</div><div className="text-2xl font-semibold">{feePayers.length}</div></CardContent></Card>
          <Card className="elegant-card"><CardContent className="p-4"><div className="text-sm text-muted-foreground">현재 대여 중</div><div className="text-2xl font-semibold">{rentalDashboard?.stats.activeRentals ?? 0}</div></CardContent></Card>
          <Card className="elegant-card"><CardContent className="p-4"><div className="text-sm text-muted-foreground">관리자 물품 총 재고</div><div className="text-2xl font-semibold">{items.reduce((sum, item) => sum + (item.quantity ?? 0), 0)}</div></CardContent></Card>
        </div>

        <Card className="elegant-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" />학생회비 납부자 엑셀 업로드</CardTitle>
            <CardDescription>이름, 학번 컬럼이 포함된 .xlsx 파일을 업로드하면 기존 명단을 전체 교체합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0])} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />엑셀 파일 선택
              </Button>
              <Button type="button" onClick={() => uploadMutation.mutate({ payers: previewRows })} disabled={previewRows.length === 0 || uploadMutation.isPending}>
                업로드 반영
              </Button>
            </div>
            {previewRows.length > 0 && (
              <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                미리보기 {previewRows.length}명 준비됨. 업로드 시 기존 명단이 이 파일 기준으로 덮어쓰기됩니다.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="elegant-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Package2 className="w-5 h-5" />대여사업 물품 기준</CardTitle>
            <CardDescription>대여사업 물품은 관리자 물품 관리에 등록된 항목을 그대로 사용합니다. 수량은 번호 개수와 같습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>물품명</TableHead>
                  <TableHead>카테고리</TableHead>
                  <TableHead>위치</TableHead>
                  <TableHead>수량(번호 개수)</TableHead>
                  <TableHead>현재 대여 중</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const rentalItem = rentalDashboard?.items.find((entry) => entry.id === item.id);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>{item.location}</TableCell>
                      <TableCell>{item.quantity ?? 0}</TableCell>
                      <TableCell>{rentalItem?.activeNumbers.length ?? 0}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="elegant-card">
          <CardHeader>
            <CardTitle>현재 등록된 학생회비 납부자</CardTitle>
            <CardDescription>{feePayersLoading ? '불러오는 중...' : '대여 등록 드롭다운에 그대로 노출됩니다.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>학번</TableHead>
                  <TableHead>학과/학부</TableHead>
                  <TableHead>연락처</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feePayers.map((payer) => (
                  <TableRow key={payer.id}>
                    <TableCell>{payer.name}</TableCell>
                    <TableCell>{payer.studentId}</TableCell>
                    <TableCell>{payer.department || '-'}</TableCell>
                    <TableCell>{payer.phone || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
