import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useMemberAuth } from '@/contexts/MemberAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Shield,
  KeyRound
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatKSTDateTime } from '@/lib/date';

function getLateLabel(status: string, lateMinutes?: number | null) {
  if (status === 'late') {
    const minutes = typeof lateMinutes === 'number' ? lateMinutes : null;
    return minutes !== null ? `${minutes}분 지각` : '지각';
  }
  if (status === 'present') return '정시 출석';
  if (status === 'absent') return '결석';
  return '미체크';
}

export default function Attendance() {
  const [, navigate] = useLocation();
  const { member, isAuthenticated } = useMemberAuth();
  const initialQrCode = useMemo(() => new URLSearchParams(window.location.search).get('code') || '', []);
  const initialPinCode = useMemo(() => new URLSearchParams(window.location.search).get('pin') || '', []);
  const [qrCode] = useState(initialQrCode);
  const [pinCode, setPinCode] = useState(initialPinCode);

  const { data: todayStatus, isLoading, refetch: refetchStatus } = trpc.attendance.getTodayStatus.useQuery(undefined, { enabled: !!member?.id });

  const checkInMutation = trpc.attendance.checkIn.useMutation({
    onSuccess: (data) => {
      const statusText = getLateLabel(data.status, data.lateMinutes);
      toast.success(`QR 출석 완료 (${statusText})`);
      refetchStatus();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCheckIn = () => {
    if (!todayStatus?.currentSlot) return;
    if (pinCode.trim().length !== 4) {
      toast.error('4자리 인증 코드를 입력해주세요.');
      return;
    }
    if (!qrCode.trim()) {
      toast.error('먼저 학생회실 QR을 스캔해주세요. 보안을 위해 QR 확인 후에만 출석할 수 있습니다.');
      return;
    }
    checkInMutation.mutate({ qrCode: qrCode.trim(), pinCode: pinCode.trim() });
  };

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'late':
        return <Clock className="w-5 h-5 text-amber-500" />;
      case 'absent':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string, lateMinutes?: number | null) => {
    return getLateLabel(status, lateMinutes);
  };

  const currentSlotInfo = todayStatus?.timeSlots?.find(
    (slot) => slot.slot === todayStatus.currentSlot
  );
  const currentAssignees = currentSlotInfo?.assignees ?? [];
  const isCurrentAssignee = currentAssignees.some((assignee: any) => assignee.id === member?.id);

  const isAlreadyCheckedIn = todayStatus?.myAttendances?.some(
    (a) => a.timeSlot === todayStatus.currentSlot && a.status !== 'absent'
  );
  const currentSlotAttendances = todayStatus?.currentSlotAttendances ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container flex items-center h-14">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="mr-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold">출석체크</h1>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">출석 정보를 불러오는 중...</p>
            </div>
          </div>
        )}

        {!isLoading && (
          <>
            <Card className="elegant-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  오늘의 출석
                </CardTitle>
                <CardDescription>
                  {todayStatus?.date} ({todayStatus?.dayName}요일)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {todayStatus?.isWeekend ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>주말에는 출석체크가 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {currentSlotInfo ? (
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">현재 시간대</span>
                          <span className="text-sm font-medium text-primary">{currentSlotInfo.label}</span>
                        </div>
                        <div className="mb-3 p-2 rounded bg-white/50">
                          <div className="text-xs text-muted-foreground mb-1">현재 기준 시간</div>
                          <div className="text-sm font-medium mb-2">{todayStatus?.currentTimeLabel || formatKSTDateTime(todayStatus?.currentTime)}</div>
                          <div className="text-xs text-muted-foreground mb-1">담당자</div>
                          {currentAssignees.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {currentAssignees.map((assignee: any) => (
                                <span key={assignee.id} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                                  {assignee.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm font-semibold text-foreground">담당자 없음</div>
                          )}
                        </div>
                        {currentSlotAttendances.length > 0 && (
                          <div className="mb-3 rounded-lg border border-border/60 bg-background/70 p-2.5">
                            <div className="mb-2 text-xs text-muted-foreground">현재 시간대 출석 현황</div>
                            <div className="space-y-1.5">
                              {currentSlotAttendances.map((entry: any) => (
                                <div key={entry.memberId} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-2.5 py-2 text-sm">
                                  <span className="font-medium text-foreground">{entry.memberName}</span>
                                  <span className={`${entry.status === 'present' ? 'text-emerald-600' : entry.status === 'late' ? 'text-amber-600' : entry.status === 'absent' ? 'text-red-500' : 'text-muted-foreground'} font-medium`}>
                                    {getStatusText(entry.status, entry.lateMinutes)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="space-y-2 mt-3">
                          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <KeyRound className="w-3.5 h-3.5" />
                            현재 시간대 4자리 인증 코드
                          </label>
                          <Input
                            value={pinCode}
                            onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="QR 스캔 후 자동 입력되거나 직접 입력"
                            inputMode="numeric"
                            maxLength={4}
                          />
                        </div>
                        {isAlreadyCheckedIn ? (
                          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${todayStatus?.myAttendances?.find((a) => a.timeSlot === todayStatus.currentSlot)?.status === 'late' ? 'bg-amber-500/10 text-amber-600' : todayStatus?.myAttendances?.find((a) => a.timeSlot === todayStatus.currentSlot)?.status === 'absent' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-600'}`} >
                            {getStatusIcon(todayStatus?.myAttendances?.find((a) => a.timeSlot === todayStatus.currentSlot)?.status || 'present')}
                            <span className="font-medium">{getStatusText(todayStatus?.myAttendances?.find((a) => a.timeSlot === todayStatus.currentSlot)?.status || 'present', todayStatus?.myAttendances?.find((a) => a.timeSlot === todayStatus.currentSlot)?.lateMinutes)}</span>
                          </div>
                        ) : isCurrentAssignee ? (
                          <Button
                            onClick={handleCheckIn}
                            disabled={checkInMutation.isPending || pinCode.trim().length !== 4}
                            className="w-full h-10 mt-2"
                          >
                            {checkInMutation.isPending ? '처리 중...' : 'QR로 출석하기'}
                          </Button>
                        ) : (
                          <p className="text-sm text-amber-600 font-medium">⚠️ 이 시간대의 담당자가 아닙니다</p>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-muted/50 text-center">
                        <p className="text-muted-foreground">현재 출석체크 가능한 시간이 아닙니다.</p>
                        <p className="text-sm text-muted-foreground mt-1">(평일 11:50 - 18:00)</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {todayStatus?.timeSlots?.map((slot) => {
                        const isCurrent = slot.slot === todayStatus.currentSlot;

                        return (
                          <div key={slot.slot} className={`rounded-lg border p-3 ${isCurrent ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
                            <div className="text-sm font-medium text-foreground">{slot.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
