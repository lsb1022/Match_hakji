import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useMemberAuth } from '@/contexts/MemberAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatKoreanDate } from '@/lib/date';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  XCircle,
  TrendingUp,
  Calendar
} from 'lucide-react';

export default function MyAttendance() {
  const [, navigate] = useLocation();
  const { member, isAuthenticated } = useMemberAuth();

  const { data, isLoading } = trpc.attendance.getMyAttendance.useQuery(undefined, { enabled: !!member?.id });

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

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
      case 'present':
        return '정시';
      case 'late':
        return '지각';
      case 'absent':
        return '결석';
      default:
        return '-';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'present':
        return 'status-present';
      case 'late':
        return 'status-late';
      case 'absent':
        return 'status-absent';
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

  const stats = data?.stats;
  const attendanceRate = stats?.total 
    ? Math.round(((stats.present + stats.late) / stats.total) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container flex items-center h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="mr-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold">내 출석 기록</h1>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">출석 기록을 불러오는 중...</p>
            </div>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Stats Overview */}
            <Card className="elegant-card overflow-hidden">
              <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">출석 통계</h2>
                <p className="text-sm text-muted-foreground">전체 기간</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
            
            <div className="text-3xl font-bold text-foreground mb-1">
              {attendanceRate}%
            </div>
            <p className="text-sm text-muted-foreground">출석률</p>
              </div>

              <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-emerald-500/10">
                <div className="text-2xl font-bold text-emerald-600">
                  {stats?.present ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">정시</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-500/10">
                <div className="text-2xl font-bold text-amber-600">
                  {stats?.late ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">지각</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-500/10">
                <div className="text-2xl font-bold text-red-500">
                  {stats?.absent ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">결석</div>
              </div>
              </div>
              </CardContent>
            </Card>

            {/* Attendance History */}
            <Card className="elegant-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  출석 기록
                </CardTitle>
              </CardHeader>
              <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : data?.attendances?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>출석 기록이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data?.attendances?.map((attendance) => (
                  <div
                    key={attendance.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(attendance.status)}
                      <div>
                        <div className="font-medium text-sm">
                          {formatKoreanDate(attendance.date, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {timeSlotLabels[attendance.timeSlot]}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusClass(attendance.status)}`}>
                      {getStatusText(attendance.status)}
                    </span>
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
