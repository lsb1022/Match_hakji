import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useMemberAuth } from '@/contexts/MemberAuthContext';
import { trpc } from '@/lib/trpc';
import { ArrowLeft, HandHelping, IdCard, Package2, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const collateralOptions = ['학생증', '신분증', '주민등록증', '운전면허증', '기타'];

export default function RentalBusiness() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useMemberAuth();
  const utils = trpc.useUtils();
  const [payerSearch, setPayerSearch] = useState('');
  const [selectedPayerId, setSelectedPayerId] = useState<string>('');
  const [isPayerDropdownOpen, setIsPayerDropdownOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedItemNumber, setSelectedItemNumber] = useState<string>('');
  const [collateralType, setCollateralType] = useState<string>('학생증');
  const [collateralDetail, setCollateralDetail] = useState('');
  const [note, setNote] = useState('');

  const { data, isLoading } = trpc.rental.getDashboard.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createMutation = trpc.rental.create.useMutation({
    onSuccess: async () => {
      toast.success('대여 등록이 완료되었습니다.');
      setSelectedPayerId('');
      setPayerSearch('');
      setIsPayerDropdownOpen(false);
      setSelectedItemId('');
      setSelectedItemNumber('');
      setCollateralType('학생증');
      setCollateralDetail('');
      setNote('');
      await utils.rental.getDashboard.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const returnMutation = trpc.rental.returnItem.useMutation({
    onSuccess: async () => {
      toast.success('반납 처리되었습니다.');
      await utils.rental.getDashboard.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const feePayers = data?.feePayers ?? [];
  const items = data?.items ?? [];
  const rentals = data?.rentals ?? [];

  const filteredPayers = useMemo(() => {
    const query = payerSearch.trim().toLowerCase();
    if (!query) return feePayers;
    return feePayers.filter((payer) =>
      `${payer.name} ${payer.studentId} ${payer.department ?? ''}`.toLowerCase().includes(query)
    );
  }, [feePayers, payerSearch]);

  const selectedPayer = feePayers.find((payer) => String(payer.id) === selectedPayerId);
  const selectedItem = items.find((item) => String(item.id) === selectedItemId);
  const selectedPayerActiveRental = rentals.find(
    (rental) => rental.payerId === selectedPayer?.id && rental.status !== 'returned'
  );

  const handleCreateRental = () => {
    if (!selectedPayerId || !selectedItemId || !selectedItemNumber || !collateralType) {
      toast.error('대여 대상, 물품, 번호, 맡긴 신분증을 모두 선택해주세요.');
      return;
    }

    createMutation.mutate({
      payerId: Number(selectedPayerId),
      itemId: Number(selectedItemId),
      itemNumber: Number(selectedItemNumber),
      collateralType,
      collateralDetail: collateralDetail || undefined,
      note: note || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container flex items-center h-14">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="mr-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold">대여사업 관리</h1>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="elegant-card"><CardContent className="p-4"><div className="text-sm text-muted-foreground">납부자 명단</div><div className="text-2xl font-semibold">{data?.stats.totalFeePayers ?? 0}</div></CardContent></Card>
          <Card className="elegant-card"><CardContent className="p-4"><div className="text-sm text-muted-foreground">현재 대여 중</div><div className="text-2xl font-semibold">{data?.stats.activeRentals ?? 0}</div></CardContent></Card>
          <Card className="elegant-card"><CardContent className="p-4"><div className="text-sm text-muted-foreground">연체 건수</div><div className="text-2xl font-semibold text-red-600">{data?.stats.overdueRentals ?? 0}</div></CardContent></Card>
          <Card className="elegant-card"><CardContent className="p-4"><div className="text-sm text-muted-foreground">즉시 대여 가능 수량</div><div className="text-2xl font-semibold">{data?.stats.availableItems ?? 0}</div></CardContent></Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <Card className="elegant-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HandHelping className="w-5 h-5" />새 대여 등록</CardTitle>
              <CardDescription>학생회실 대여사업 물품을 대여합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>대여 대상자 *</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-[35%] w-4 h-4 text-muted-foreground" />
                  <Input
                    value={payerSearch}
                    onFocus={() => setIsPayerDropdownOpen(true)}
                    onChange={(e) => {
                      setPayerSearch(e.target.value);
                      setSelectedPayerId('');
                      setIsPayerDropdownOpen(true);
                    }}
                    placeholder="이름 또는 학번 검색 후 바로 선택"
                    className="pl-9"
                  />
                  {isPayerDropdownOpen && (
                    <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border bg-background shadow-lg">
                      {filteredPayers.length > 0 ? (
                        filteredPayers.slice(0, 50).map((payer) => (
                          <button
                            type="button"
                            key={payer.id}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setSelectedPayerId(String(payer.id));
                              setPayerSearch(`${payer.name} (${payer.studentId})`);
                              setIsPayerDropdownOpen(false);
                            }}
                          >
                            <span>{payer.name} ({payer.studentId})</span>
                            {payer.department ? <span className="text-xs text-muted-foreground">{payer.department}</span> : null}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">검색 결과가 없습니다.</div>
                      )}
                    </div>
                  )}
                </div>
                {selectedPayer && (
                  <div className="text-sm text-muted-foreground">
                    {selectedPayer.department ? `${selectedPayer.department} · ` : ''}{selectedPayer.phone || '연락처 없음'}
                  </div>
                )}
                {selectedPayerActiveRental && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    이 대상자는 이미 {selectedPayerActiveRental.itemName} {selectedPayerActiveRental.itemNumber}번을 대여 중입니다. 반납 후 새 대여가 가능합니다.
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>대여 물품 *</Label>
                  <Select value={selectedItemId} onValueChange={(value) => { setSelectedItemId(value); setSelectedItemNumber(''); }}>
                    <SelectTrigger><SelectValue placeholder="물품 선택" /></SelectTrigger>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.name} · 가능 {item.availableCount}/{item.quantity ?? 0}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>물품 번호 *</Label>
                  <Select value={selectedItemNumber} onValueChange={setSelectedItemNumber} disabled={!selectedItem || selectedItem.availableNumbers.length === 0}>
                    <SelectTrigger><SelectValue placeholder="번호 선택" /></SelectTrigger>
                    <SelectContent>
                      {(selectedItem?.availableNumbers ?? []).map((num) => (
                        <SelectItem key={num} value={String(num)}>{num}번</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedItem && (
                <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                  <div>{selectedItem.category} · 보관 위치 {selectedItem.location}</div>
                  <div className="mt-1">대여 가능한 번호: {(selectedItem.availableNumbers ?? []).length > 0 ? selectedItem.availableNumbers.map((n:number) => `${n}번`).join(', ') : '없음'}</div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>맡긴 신분증 종류 *</Label>
                  <Select value={collateralType} onValueChange={setCollateralType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {collateralOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>신분증 상세</Label>
                  <Input value={collateralDetail} onChange={(e) => setCollateralDetail(e.target.value)} placeholder="예: 학생증, 주민등록증" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>비고</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="특이사항, 파손 여부, 안내사항 등을 적어주세요." />
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                기본 반납 기한은 <span className="font-medium text-foreground">대여일 포함 3일</span>입니다.
              </div>

              <Button className="w-full" onClick={handleCreateRental} disabled={createMutation.isPending || !!selectedPayerActiveRental}>
                대여 등록하기
              </Button>
            </CardContent>
          </Card>

          <Card className="elegant-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Package2 className="w-5 h-5" />현재 대여 현황</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading && <div className="text-sm text-muted-foreground">불러오는 중...</div>}
              {!isLoading && rentals.filter((rental) => rental.status !== 'returned').length === 0 && (
                <div className="text-sm text-muted-foreground">현재 대여 중인 물품이 없습니다.</div>
              )}
              {rentals.filter((rental) => rental.status !== 'returned').map((rental) => (
                <div key={rental.id} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{rental.payerName} ({rental.payerStudentId})</div>
                      <div className="text-sm text-muted-foreground">{rental.itemName} · {rental.itemNumber}번</div>
                    </div>
                    <Badge variant={rental.computedStatus === 'overdue' ? 'destructive' : 'secondary'}>
                      {rental.computedStatus === 'overdue' ? '연체' : '대여 중'}
                    </Badge>
                  </div>
                  <div className="grid gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><IdCard className="w-4 h-4" />{rental.collateralType}{rental.collateralDetail ? ` · ${rental.collateralDetail}` : ''}</div>
                    <div>대여일 {new Date(rental.rentedAt).toLocaleDateString('ko-KR')} · 반납기한 {new Date(rental.dueDate).toLocaleDateString('ko-KR')}</div>
                    {rental.note && <div>비고: {rental.note}</div>}
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => returnMutation.mutate({ rentalId: rental.id })} disabled={returnMutation.isPending}>
                    <RotateCcw className="w-4 h-4 mr-2" />반납 처리
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="elegant-card">
          <CardHeader>
            <CardTitle>전체 대여 이력</CardTitle>
            <CardDescription>최근 등록 순으로 표시됩니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>학번</TableHead>
                  <TableHead>물품</TableHead>
                  <TableHead>번호</TableHead>
                  <TableHead>신분증</TableHead>
                  <TableHead>대여일</TableHead>
                  <TableHead>반납기한</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentals.map((rental) => (
                  <TableRow key={rental.id}>
                    <TableCell>{rental.payerName}</TableCell>
                    <TableCell>{rental.payerStudentId}</TableCell>
                    <TableCell>{rental.itemName}</TableCell>
                    <TableCell>{rental.itemNumber}번</TableCell>
                    <TableCell>{rental.collateralType}</TableCell>
                    <TableCell>{new Date(rental.rentedAt).toLocaleDateString('ko-KR')}</TableCell>
                    <TableCell>{new Date(rental.dueDate).toLocaleDateString('ko-KR')}</TableCell>
                    <TableCell>
                      <Badge variant={rental.status === 'returned' ? 'outline' : rental.computedStatus === 'overdue' ? 'destructive' : 'secondary'}>
                        {rental.status === 'returned' ? '반납 완료' : rental.computedStatus === 'overdue' ? '연체' : '대여 중'}
                      </Badge>
                    </TableCell>
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
