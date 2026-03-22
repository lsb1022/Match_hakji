import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatKoreanDate, getTodayInputDate } from '@/lib/date';
import { 
  ArrowLeft, 
  ClipboardCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  User
} from 'lucide-react';

export default function AdminAttendance() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [selectedDate, setSelectedDate] = useState(getTodayInputDate());

  const { data: members, isLoading: membersLoading } = trpc.members.list.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const { data: attendances, isLoading: attendancesLoading } = trpc.attendance.getByDate.useQuery(
    { date: selectedDate },
    { enabled: isAuthenticated && user?.role === 'admin' }
  );

  const { data: allAttendances, isLoading: allAttendancesLoading } = trpc.attendance.listAll.useQuery(
    { limit: 100 },
    { enabled: isAuthenticated && user?.role === 'admin' }
  );

  const isLoading = membersLoading || attendancesLoading || allAttendancesLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    window.location.href = "/admin/login";
    return null;
  }

  const timeSlotLabels: Record<number, string> = {
    1: '12:00-13:30',
    2: '13:30-15:00',
    3: '15:00-16:30',
    4: '16:30-18:00',
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'late':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'absent':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'present': return '정시';
      case 'late': return '지각';
      case 'absent': return '결석';
      default: return '-';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'present': return 'status-present';
      case 'late': return 'status-late';
      case 'absent': return 'status-absent';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getMemberName = (memberId: number) => {
    return members?.find(m => m.id === memberId)?.name || '알 수 없음';
  };

  // Group attendances by date for recent history
  const groupedAttendances = allAttendances?.reduce((acc, att) => {
    const dateStr = String(att.date).split('T')[0];
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(att);
    return acc;
  }, {} as Record<string, typeof allAttendances>);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container flex items-center h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin')}
            className="mr-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold">출석 현황</h1>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">출석 데이터를 불러오는 중...</p>
            </div>
          </div>
        )}

        {members && attendances && (
          <>
        {/* Date Selector */}
        <Card className="elegant-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              날짜별 조회
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full"
            />
          </CardContent>
        </Card>

        {/* Selected Date Attendance */}
        <Card className="elegant-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {formatKoreanDate(selectedDate, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attendances?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>해당 날짜의 출석 기록이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((slot) => {
                  const slotAttendances = attendances?.filter(a => a.timeSlot === slot);
                  
                  return (
                    <div key={slot} className="p-3 rounded-lg border border-border">
                      <div className="font-medium text-sm mb-2 text-muted-foreground">
                        {timeSlotLabels[slot]}
                      </div>
                      {slotAttendances && slotAttendances.length > 0 ? (
                        <div className="space-y-2">
                          {slotAttendances.map((att) => (
                            <div key={att.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">{getMemberName(att.memberId)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {att.checkInTime && (
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(att.checkInTime).toLocaleTimeString('ko-KR', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      timeZone: 'Asia/Seoul'
                                    })}
                                  </span>
                                )}
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusClass(att.status)}`}>
                                  {getStatusText(att.status)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">기록 없음</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent History */}
        <Card className="elegant-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              최근 출석 기록
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!groupedAttendances || Object.keys(groupedAttendances).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>출석 기록이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedAttendances)
                  .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                  .slice(0, 7)
                  .map(([date, dayAttendances]) => (
                    <div key={date} className="border-b border-border pb-3 last:border-0">
                      <div className="font-medium text-sm mb-2">
                        {formatKoreanDate(date, {
                          month: 'short',
                          day: 'numeric',
                          weekday: 'short'
                        })}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2 rounded bg-emerald-500/10">
                          <div className="font-bold text-emerald-600">
                            {dayAttendances?.filter(a => a.status === 'present').length}
                          </div>
                          <div className="text-muted-foreground">정시</div>
                        </div>
                        <div className="p-2 rounded bg-amber-500/10">
                          <div className="font-bold text-amber-600">
                            {dayAttendances?.filter(a => a.status === 'late').length}
                          </div>
                          <div className="text-muted-foreground">지각</div>
                        </div>
                        <div className="p-2 rounded bg-red-500/10">
                          <div className="font-bold text-red-500">
                            {dayAttendances?.filter(a => a.status === 'absent').length}
                          </div>
                          <div className="text-muted-foreground">결석</div>
                        </div>
                      </div>
                    </div>
                  ))}
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
