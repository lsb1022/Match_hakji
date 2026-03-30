import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useMemberAuth } from '@/contexts/MemberAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ArrowLeft, BookOpen, FileText } from 'lucide-react';
import { Streamdown } from 'streamdown';

export default function Manual() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useMemberAuth();

  const { data: manuals = [], isLoading } = trpc.manuals.list.useQuery();

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const groupedManuals = manuals.reduce((acc, manual) => {
    if (!acc[manual.category]) {
      acc[manual.category] = [];
    }
    acc[manual.category].push(manual);
    return acc;
  }, {} as Record<string, typeof manuals>);

  const categoryLabels: Record<string, string> = {
    basic: '기본 안내',
    duty: '업무 가이드',
    emergency: '비상 상황',
    etc: '기타',
  };

  const displayManuals = groupedManuals;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="mr-2 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold sm:text-lg">지킴이 메뉴얼</h1>
        </div>
      </header>

      <main className="container py-5 sm:py-6">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              <p className="text-sm text-muted-foreground sm:text-base">
                메뉴얼을 불러오는 중...
              </p>
            </div>
          </div>
        )}

        {!isLoading && (
          <div className="space-y-4 sm:space-y-5">
            <Card className="overflow-hidden border border-border/60 shadow-sm">
              <div className="bg-gradient-to-r from-purple-500/10 to-primary/10 px-4 py-5 sm:px-5 sm:py-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm sm:h-14 sm:w-14">
                    <BookOpen className="h-6 w-6 text-purple-600 sm:h-7 sm:w-7" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
                      학생회실 지킴이 가이드
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground sm:text-base">
                      업무 수행에 필요한 주요 안내와 운영 정보를 확인하세요.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {Object.entries(displayManuals).length === 0 ? (
              <Card className="border border-border/60 shadow-sm">
                <CardContent className="py-10">
                  <p className="text-center text-sm text-muted-foreground sm:text-base">
                    등록된 메뉴얼이 없습니다.
                  </p>
                </CardContent>
              </Card>
            ) : (
              Object.entries(displayManuals).map(([category, items]) => (
                <Card key={category} className="border border-border/60 shadow-sm">
                  <CardHeader className="pb-2 pt-4 sm:pb-3 sm:pt-5">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                      <FileText className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
                      <span>{categoryLabels[category] || category}</span>
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="pt-0 pb-4 sm:pb-5">
                    <Accordion type="single" collapsible className="w-full">
                      {items?.map((manual: any, index: number) => (
                        <AccordionItem
                          key={manual.id || index}
                          value={`item-${index}`}
                          className="mb-2 overflow-hidden rounded-xl border border-border/70 bg-background last:mb-0"
                        >
                          <AccordionTrigger className="px-4 py-3 text-left text-[15px] font-semibold leading-6 hover:no-underline sm:px-5 sm:text-base">
                            <span className="pr-4">{manual.title}</span>
                          </AccordionTrigger>

                          <AccordionContent className="border-t border-border/60 px-4 pt-3 pb-4 sm:px-5 sm:pt-4 sm:pb-5">
                            <div className="prose prose-sm max-w-none text-foreground sm:prose-base prose-p:my-2 prose-headings:my-3 prose-li:my-1 prose-ul:my-2 prose-ol:my-2 leading-7">
                              <Streamdown>{manual.content}</Streamdown>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}