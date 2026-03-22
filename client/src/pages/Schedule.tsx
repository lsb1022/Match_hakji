import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useMemberAuth } from '@/contexts/MemberAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Calendar, Clock, User } from 'lucide-react';

export default function Schedule() {
  const [, navigate] = useLocation();
  const { member, isAuthenticated } = useMemberAuth();
  const { data, isLoading } = trpc.schedule.weeklyView.useQuery(undefined, { enabled: isAuthenticated });

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container flex items-center h-14">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="mr-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold">이번주 스케줄</h1>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">스케줄을 불러오는 중...</p>
            </div>
          </div>
        )}

        {!isLoading && (
          <>
            <Card className="elegant-card overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-500/10 to-primary/10 p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/80 flex items-center justify-center">
                    <Calendar className="w-7 h-7 text-cyan-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">이번 주 지킴이 배정표</h2>
                    <p className="text-sm text-muted-foreground">교대·대타 승인 내용까지 반영된 실제 담당자입니다.</p>
                  </div>
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              {data?.days?.map((day) => (
                <Card key={day.date} className="elegant-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {day.dayName}
                      </span>
                      {day.dayName}요일
                      <span className="text-sm text-muted-foreground font-normal">{day.date}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {day.slots.map((slot) => {
                        const isMine = slot.memberId === member?.id;
                        return (
                          <div
                            key={`${day.date}-${slot.slot}`}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              isMine ? 'border-primary/30 bg-primary/5' : 'border-border'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{slot.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {slot.memberName ? (
                                <>
                                  <User className="w-4 h-4 text-muted-foreground" />
                                  <span className={`text-sm ${isMine ? 'font-semibold text-primary' : 'text-foreground'}`}>
                                    {slot.memberName}
                                    {isMine ? ' (나)' : ''}
                                  </span>
                                </>
                              ) : (
                                <span className="text-sm text-muted-foreground">담당자 없음</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
