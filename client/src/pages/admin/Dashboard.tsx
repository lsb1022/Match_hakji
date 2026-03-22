import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Shield, 
  Users, 
  ClipboardCheck, 
  ArrowRightLeft,
  Settings,
  QrCode,
  LogOut,
  ChevronRight,
  TrendingUp,
  Calendar,
  Package,
  BookOpen,
  Tag
} from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Clock } from 'lucide-react';

export default function AdminDashboard() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const [isTimeDialogOpen, setIsTimeDialogOpen] = useState(false);
  const [testDate, setTestDate] = useState('');
  const [testTime, setTestTime] = useState('');

  const { data: stats, error: statsError, isLoading: statsLoading, refetch: refetchStats } = trpc.dashboard.stats.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const { data: testTimeData, refetch: refetchTestTime } = trpc.admin.getTestTime.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const setTestTimeMutation = trpc.admin.setTestTime.useMutation({
    onSuccess: async () => {
      setTestDate('');
      setTestTime('');
      setIsTimeDialogOpen(false);
      await Promise.all([refetchStats(), refetchTestTime()]);
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = "/admin/login";
    return null;
  }

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-semibold mb-2">접근 권한이 없습니다</h1>
        <p className="text-muted-foreground mb-4">관리자만 접근할 수 있습니다.</p>
        <Button onClick={() => navigate('/')}>홈으로 돌아가기</Button>
      </div>
    );
  }

  const menuItems = [
    {
      title: '회원 관리',
      description: '지킴이 계정 추가 및 관리',
      icon: Users,
      href: '/admin/members',
      color: 'bg-blue-500/10 text-blue-600',
    },
    {
      title: '출석 현황',
      description: '전체 출석 기록 조회',
      icon: ClipboardCheck,
      href: '/admin/attendance',
      color: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      title: '교대/대타 승인',
      description: '신청 내역 확인 및 승인',
      icon: ArrowRightLeft,
      href: '/admin/swaps',
      color: 'bg-amber-500/10 text-amber-600',
    },
    {
      title: '스케줄 관리',
      description: '주간 스케줄 배정',
      icon: Calendar,
      href: '/admin/schedules',
      color: 'bg-purple-500/10 text-purple-600',
    },
    {
      title: 'QR 코드 관리',
      description: '출석용 QR 생성 및 갱신',
      icon: QrCode,
      href: '/admin/qr',
      color: 'bg-cyan-500/10 text-cyan-600',
    },

    {
      title: '물품 관리',
      description: '물품 정보 추가 및 수정',
      icon: Package,
      href: '/admin/items',
      color: 'bg-rose-500/10 text-rose-600',
    },
    {
      title: '메뉴얼 관리',
      description: '메뉴얼 작성 및 수정',
      icon: BookOpen,
      href: '/admin/manuals',
      color: 'bg-indigo-500/10 text-indigo-600',
    },
    {
      title: '카테고리 관리',
      description: '물품 및 메뉴얼 카테고리 관리',
      icon: Tag,
      href: '/admin/categories',
      color: 'bg-cyan-500/10 text-cyan-600',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="font-semibold text-foreground">관리자 대시보드</span>
              <span className="text-xs text-muted-foreground ml-2">
                {user?.name}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {testTimeData?.isTestMode && (
              <div className="text-xs bg-amber-500/10 text-amber-600 px-2 py-1 rounded">
                테스트 모드: {testTimeData.currentTimeLabel}
              </div>
            )}
            <Dialog open={isTimeDialogOpen} onOpenChange={setIsTimeDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <Clock className="w-4 h-4 mr-2" />
                  시간 설정
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>테스트 시간 설정</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>날짜</Label>
                    <Input
                      type="date"
                      value={testDate}
                      onChange={(e) => setTestDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>시간</Label>
                    <Input
                      type="time"
                      value={testTime}
                      onChange={(e) => setTestTime(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => {
                        if (testDate && testTime) {
                          setTestTimeMutation.mutate({ date: testDate, time: testTime });
                        }
                      }}
                      disabled={!testDate || !testTime || setTestTimeMutation.isPending}
                    >
                      설정
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setTestTimeMutation.mutate({});
                      }}
                      disabled={setTestTimeMutation.isPending}
                    >
                      현재 시간으로 리셋
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout();
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4 mr-2" />
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Loading State */}
        {statsLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">대시보드를 불러오는 중...</p>
            </div>
          </div>
        )}

        {statsError && (
          <div className="py-12 text-center text-red-500">대시보드 데이터를 불러오지 못했습니다: {statsError.message}</div>
        )}

        {stats && (
          <>
        {/* Stats Overview */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="elegant-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats?.activeMembers ?? 0}</div>
                  <div className="text-xs text-muted-foreground">활성 회원</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="elegant-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats?.pendingSwapRequests ?? 0}</div>
                  <div className="text-xs text-muted-foreground">대기 중 신청</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Today's Stats */}
        <Card className="elegant-card overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">오늘의 출석</h2>
                <p className="text-sm text-muted-foreground">
                  {new Date().toLocaleDateString('ko-KR', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    weekday: 'long'
                  })}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-primary/50" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-lg bg-white/50">
                <div className="text-xl font-bold text-emerald-600">
                  {stats?.todayStats?.present ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">출석</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/50">
                <div className="text-xl font-bold text-amber-600">
                  {stats?.todayStats?.late ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">지각</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/50">
                <div className="text-xl font-bold text-red-600">
                  {stats?.todayStats?.absent ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">결석</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/50">
                <div className="text-xl font-bold text-foreground">
                  {stats?.todayStats?.total ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">전체</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Menu Grid */}
        <div className="grid gap-3">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="elegant-card hover:shadow-md transition-all cursor-pointer group">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`w-12 h-12 rounded-xl ${item.color.split(' ')[0]} flex items-center justify-center flex-shrink-0`}>
                    <item.icon className={`w-6 h-6 ${item.color.split(' ')[1]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
          </>
        )}
      </main>
    </div>
  );
}
