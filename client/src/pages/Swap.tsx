import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useMemberAuth } from '@/contexts/MemberAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { AlertCircle, ArrowLeft, ArrowRightLeft, CheckCircle2, Clock, Plus, XCircle } from 'lucide-react';

export default function Swap() {
  const [, navigate] = useLocation();
  const { member, isAuthenticated } = useMemberAuth();

  const [requestType, setRequestType] = useState<'swap' | 'substitute'>('swap');
  const [originalSelection, setOriginalSelection] = useState('');
  const [swapSelection, setSwapSelection] = useState('');
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');

  const { data: myRequests, isLoading, refetch } = trpc.swap.getMyRequests.useQuery(undefined, { enabled: !!member?.id });
  const { data: activeMembers } = trpc.members.activeOptions.useQuery(undefined, { enabled: !!member?.id });
  const { data: myScheduleOptions } = trpc.schedule.myUpcomingOptions.useQuery(undefined, { enabled: !!member?.id });
  const { data: upcomingAllOptions } = trpc.schedule.upcomingAllOptions.useQuery(undefined, { enabled: !!member?.id });

  const scheduleOptionMap = useMemo(() => {
    const map = new Map<string, (typeof myScheduleOptions)[number]>();
    myScheduleOptions?.forEach((option) => map.set(`${option.date}|${option.timeSlot}`, option));
    return map;
  }, [myScheduleOptions]);

  const createMutation = trpc.swap.create.useMutation({
    onSuccess: () => {
      toast.success('신청이 완료되었습니다.');
      refetch();
      setOriginalSelection('');
      setSwapSelection('');
      setReason('');
      setTargetId('');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelMutation = trpc.swap.cancel.useMutation({
    onSuccess: () => {
      toast.success('신청이 취소되었습니다.');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const parseSelection = (value: string) => {
    const [date, timeSlot] = value.split('|');
    return { date, timeSlot: Number(timeSlot) };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalSelection) {
      toast.error('내 원래 일정을 선택해주세요.');
      return;
    }
    if (requestType === 'swap' && !swapSelection) {
      toast.error('교대할 일정을 선택해주세요.');
      return;
    }
    if (requestType === 'substitute' && !targetId) {
      toast.error('대타를 해줄 사람을 선택해주세요.');
      return;
    }

    const original = parseSelection(originalSelection);
    const swap = swapSelection ? parseSelection(swapSelection) : null;

    createMutation.mutate({
      originalDate: original.date,
      originalTimeSlot: original.timeSlot,
      requestType,
      targetId: requestType === 'substitute' ? Number(targetId) : undefined,
      swapDate: requestType === 'swap' ? swap?.date : undefined,
      swapTimeSlot: requestType === 'swap' ? swap?.timeSlot : undefined,
      reason: reason || undefined,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return '승인됨';
      case 'rejected':
        return '거절됨';
      case 'pending':
        return '대기중';
      case 'cancelled':
        return '취소됨';
      default:
        return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-500/10 text-emerald-600';
      case 'rejected':
        return 'bg-red-500/10 text-red-500';
      case 'pending':
        return 'bg-amber-500/10 text-amber-600';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const timeSlotLabels: Record<number, string> = {
    1: '12:00-13:30',
    2: '13:30-15:00',
    3: '15:00-16:30',
    4: '16:30-18:00',
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container flex items-center h-14">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="mr-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold">교대/대타</h1>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">교대/대타 정보를 불러오는 중...</p>
            </div>
          </div>
        )}

        {!isLoading && (
          <Tabs defaultValue="request" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="request">신청하기</TabsTrigger>
              <TabsTrigger value="history">신청 내역</TabsTrigger>
            </TabsList>

            <TabsContent value="request" className="space-y-4">
              <Card className="elegant-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-primary" />
                    교대/대타 신청
                  </CardTitle>
                  <CardDescription>이번주와 다음주 내 일정만 선택해서 신청할 수 있습니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-3 p-4 rounded-lg bg-muted/50">
                      <Label className="text-sm font-medium">신청 유형</Label>
                      <div className="flex gap-2">
                        <Button type="button" variant={requestType === 'swap' ? 'default' : 'outline'} onClick={() => setRequestType('swap')} className="flex-1">
                          교대
                        </Button>
                        <Button type="button" variant={requestType === 'substitute' ? 'default' : 'outline'} onClick={() => setRequestType('substitute')} className="flex-1">
                          대타
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 p-4 rounded-lg bg-muted/50">
                      <Label className="text-sm font-medium">내 원래 일정</Label>
                      <Select value={originalSelection} onValueChange={setOriginalSelection}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="이번주/다음주 내 일정 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {myScheduleOptions?.map((option) => (
                            <SelectItem key={`${option.date}-${option.timeSlot}`} value={`${option.date}|${option.timeSlot}`}>
                              {option.displayLabel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {requestType === 'substitute' && (
                      <div className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                        <Label className="text-sm font-medium">대타자 선택</Label>
                        <Select value={targetId} onValueChange={setTargetId}>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="대타를 해줄 사람 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeMembers?.map((option) => (
                              <SelectItem key={option.id} value={String(option.id)}>
                                {option.name} ({option.username})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {requestType === 'swap' && (
                      <div className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                        <Label className="text-sm font-medium">교대할 일정</Label>
                        <Select value={swapSelection} onValueChange={setSwapSelection}>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="상대 일정 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {upcomingAllOptions
                              ?.filter((option) => `${option.date}|${option.timeSlot}` !== originalSelection)
                              .map((option) => (
                                <SelectItem key={`${option.date}-${option.timeSlot}-${option.memberId}`} value={`${option.date}|${option.timeSlot}`}>
                                  {option.displayLabel}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">교대 상대는 승인 시 해당 일정의 실제 담당자로 자동 매칭됩니다.</p>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">사유 (선택사항)</Label>
                      <Textarea placeholder="교대/대타 사유를 입력하세요" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-24" />
                    </div>

                    <Button type="submit" disabled={createMutation.isPending || !myScheduleOptions?.length} className="w-full h-12">
                      {createMutation.isPending ? '처리 중...' : '신청하기'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card className="elegant-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">신청 내역</CardTitle>
                </CardHeader>
                <CardContent>
                  {myRequests?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>신청 내역이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myRequests?.map((request) => {
                        const targetLabel = request.targetId
                          ? activeMembers?.find((m) => m.id === request.targetId)?.name || `회원 #${request.targetId}`
                          : null;
                        const originalKey = `${String(request.originalDate).split('T')[0]}|${request.originalTimeSlot}`;
                        const originalOption = scheduleOptionMap.get(originalKey);
                        const swapKey = request.swapDate ? `${String(request.swapDate).split('T')[0]}|${request.swapTimeSlot}` : null;
                        const swapOption = swapKey ? scheduleOptionMap.get(swapKey) : null;
                        return (
                          <div key={request.id} className="p-4 rounded-lg border border-border">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(request.status)}
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusClass(request.status)}`}>
                                  {getStatusText(request.status)}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">{request.requestType === 'swap' ? '교대' : '대타'}</span>
                            </div>

                            <div className="text-sm space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">원래 일정:</span>
                                <span>{originalOption?.displayLabel || `${String(request.originalDate).split('T')[0]} ${timeSlotLabels[request.originalTimeSlot]}`}</span>
                              </div>
                              {request.requestType === 'substitute' && targetLabel && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">대타자:</span>
                                  <span>{targetLabel}</span>
                                </div>
                              )}
                              {request.swapDate && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">교대 일정:</span>
                                  <span>{swapOption?.displayLabel || `${String(request.swapDate).split('T')[0]} ${request.swapTimeSlot ? timeSlotLabels[request.swapTimeSlot] : ''}`}</span>
                                </div>
                              )}
                            </div>

                            {request.reason && <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded">{request.reason}</p>}
                            {request.adminNote && <p className="text-xs text-primary mt-2 p-2 bg-primary/5 rounded">관리자: {request.adminNote}</p>}

                            {request.status === 'pending' && (
                              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => cancelMutation.mutate({ id: request.id })} disabled={cancelMutation.isPending}>
                                신청 취소
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

