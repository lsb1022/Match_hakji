import { useMemberAuth } from '@/contexts/MemberAuthContext';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Shield, 
  ClipboardCheck, 
  BookOpen, 
  Package, 
  ArrowRightLeft, 
  LogOut,
  QrCode,
  Calendar,
  ChevronRight,
  HandHelping
} from 'lucide-react';

export default function Home() {
  const { member, isAuthenticated, logout } = useMemberAuth();
  const [, navigate] = useLocation();

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const menuItems = [
    {
      title: '출석체크',
      description: 'QR 코드로 현재 시간대 출석을 진행하세요',
      icon: QrCode,
      href: '/attendance',
      color: 'bg-emerald-500/10 text-emerald-600',
      iconBg: 'bg-emerald-500/10',
    },
    {
      title: '내 출석 기록',
      description: '출석 현황과 통계를 확인하세요',
      icon: ClipboardCheck,
      href: '/my-attendance',
      color: 'bg-blue-500/10 text-blue-600',
      iconBg: 'bg-blue-500/10',
    },
    {
      title: '교대/대타 신청',
      description: '일정 변경을 요청하세요',
      icon: ArrowRightLeft,
      href: '/swap',
      color: 'bg-amber-500/10 text-amber-600',
      iconBg: 'bg-amber-500/10',
    },
    {
      title: '지킴이 메뉴얼',
      description: '업무 가이드를 확인하세요',
      icon: BookOpen,
      href: '/manual',
      color: 'bg-purple-500/10 text-purple-600',
      iconBg: 'bg-purple-500/10',
    },
    {
      title: '물품 위치',
      description: '학생회실 물품 위치를 확인하세요',
      icon: Package,
      href: '/items',
      color: 'bg-rose-500/10 text-rose-600',
      iconBg: 'bg-rose-500/10',
    },
    {
      title: '주간 스케줄',
      description: '이번 주 지킴이 배정표',
      icon: Calendar,
      href: '/schedule',
      color: 'bg-cyan-500/10 text-cyan-600',
      iconBg: 'bg-cyan-500/10',
    },
    {
      title: '대여사업 관리',
      description: '학생회비 납부자 대상 대여와 반납을 관리하세요',
      icon: HandHelping,
      href: '/rental-business',
      color: 'bg-orange-500/10 text-orange-600',
      iconBg: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <span className="truncate font-semibold text-foreground">학생회실 지킴이</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground sm:px-3"
          >
            <LogOut className="w-4 h-4 mr-2" />
            로그아웃
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6 pb-24">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">
            안녕하세요, {member?.name}님
          </h1>
          <p className="text-muted-foreground">
            글로벌미디어학부 학생회실 지킴이 활동을 응원합니다!
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="elegant-card hover:shadow-md transition-all cursor-pointer group">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`w-12 h-12 rounded-xl ${item.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <item.icon className={`w-6 h-6 ${item.color.split(' ')[1]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 sm:line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
