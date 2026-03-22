import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useMemberAuth } from '@/contexts/MemberAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Clock, QrCode, Shield, UserRound, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatKSTDateTime } from '@/lib/date';

export default function Attendance() {
  const [, navigate] = useLocation();
  const { member, isAuthenticated } = useMemberAuth();
  const initialCode = useMemo(() => new URLSearchParams(window.location.search).get('code') || '', []);
  const [qrCode, setQrCode] = useState(initialCode);

  const { data: todayStatus, isLoading, refetch: refetchStatus } = trpc.attendance.getTodayStatus.useQuery(undefined, {
    enabled: !!member?.id,
  });

  const checkInMutation = trpc.attendance.checkIn.useMutation({
    onSuccess: (data) => {
      const statusText = data.status === 'present' ? '출석' : data.status === 'late' ? '지각' : '결석';
      toast.success(`QR 출석 완료 (${statusText})`);
      refetchStatus();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const currentSlotInfo = todayStatus?.timeSlots?.find((slot) => slot.slot === todayStatus.currentSlot);
  const isAlreadyCheckedIn = todayStatus?.myAttendances?.some(
    (attendance) => attendance.timeSlot === todayStatus.currentSlot,
  );
  const canCheckIn =
    !!currentSlotInfo &&
    currentSlotInfo.assigneeId === member?.id &&
    currentSlotInfo.checkInEnabled &&
    !isAlreadyCheckedIn;

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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'present':
        return '출석';
      case 'late':
        return '지각';
      case 'absent':
        return '결석';
      default:
        return '미체크';
    }
  };

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
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">현재 출석 대상 시간대</span>
                        <span className="text-sm font-medium text-primary">{currentSlotInfo.label}</span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="p-3 rounded-lg bg-white/60 border border-border/60">
                          <div className="text-xs text-muted-foreground mb-1">현재 기준 시간</div>
                          <div className="text-sm font-medium">
                            {todayStatus?.currentTimeLabel || formatKSTDateTime(todayStatus?.currentTime)}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-white/60 border border-border/60">
                          <div className="text-xs text-muted-foreground mb-1">해당 시간 담당자</div>
                          <div className="text-sm font-semibold flex items-center gap-2">
                            <UserRound className="w-4 h-4 text-muted-foreground" />
                            {currentSlotInfo.assigneeName || '담당자 없음'}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <QrCode className="w-3.5 h-3.5" />
                          QR 코드 값
                        </label>
                        <Input
                          value={qrCode}
                          onChange={(e) => setQrCode(e.target.value)}
                          placeholder="QR 스캔 후 자동 입력되거나 직접 붙여넣기"
                        />
                      </div>

                      {isAlreadyCheckedIn ? (
                        <div className="flex items-center gap-2 text-emerald-600 font-medium">
                          <CheckCircle2 className="w-5 h-5" />
                          이미 출석체크를 완료했습니다.
                        </div>
                      ) : canCheckIn ? (
                        <Button
                          onClick={() => checkInMutation.mutate({ code: qrCode.trim() })}
                          disabled={checkInMutation.isPending || !qrCode.trim()}
                          className="w-full h-10"
                        >
                          {checkInMutation.isPending ? '처리 중...' : 'QR 코드로 출석하기'}
                        </Button>
                      ) : currentSlotInfo.assigneeId !== member?.id ? (
                        <p className="text-sm text-amber-600 font-medium">⚠️ 현재 활성화된 시간대의 담당자가 아닙니다.</p>
                      ) : !currentSlotInfo.checkInEnabled ? (
                        <p className="text-sm text-muted-foreground">아직 QR 출석 가능 시간이 아닙니다.</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-muted/50 text-center">
                      <p className="text-muted-foreground">현재 출석체크 가능한 시간이 아닙니다.</p>
                      <p className="text-sm text-muted-foreground mt-1">QR 코드로 출석을 진행하세요.</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {todayStatus?.timeSlots?.map((slot) => {
                      const attendance = todayStatus.myAttendances?.find((a) => a.timeSlot === slot.slot);
                      const status = attendance?.status || 'pending';
                      const isCurrent = slot.slot === todayStatus.currentSlot;

                      return (
                        <div
                          key={slot.slot}
                          className={`p-3 rounded-lg border ${isCurrent ? 'border-primary/30 bg-primary/5' : 'border-border'}`}
                        >
                          <div className="text-xs text-muted-foreground mb-1">{slot.label}</div>
                          <div className="text-xs text-muted-foreground mb-2">
                            담당자: <span className="font-medium text-foreground">{slot.assigneeName || '담당자 없음'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {status !== 'pending' && getStatusIcon(status)}
                            <span
                              className={`text-sm font-medium ${
                                status === 'present'
                                  ? 'text-emerald-600'
                                  : status === 'late'
                                  ? 'text-amber-600'
                                  : status === 'absent'
                                  ? 'text-red-500'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {getStatusText(status)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
