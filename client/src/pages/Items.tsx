import { trpc } from '@/lib/trpc';
import { useMemberAuth } from '@/contexts/MemberAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Package, Search, MapPin, Box } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';

export default function Items() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useMemberAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: items = [], isLoading } = trpc.items.list.useQuery();

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const groupedItems = useMemo(() => {
    return items.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, typeof items>);
  }, [items]);

  const filteredItems = searchQuery.trim()
    ? items.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  const categoryIcons: Record<string, string> = {
    사무용품: '📎',
    전자기기: '💻',
    청소도구: '🧹',
    '음료/간식': '☕',
    기타: '📦',
  };

  const displayItems = groupedItems;

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
          <h1 className="text-base font-semibold sm:text-lg">물품 위치</h1>
        </div>
      </header>

      <main className="container py-5 sm:py-6">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              <p className="text-sm text-muted-foreground sm:text-base">
                물품 정보를 불러오는 중...
              </p>
            </div>
          </div>
        )}

        {!isLoading && (
          <div className="space-y-4 sm:space-y-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="물품명, 위치, 카테고리 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 rounded-xl border-border/70 bg-card pl-10 text-sm sm:h-12 sm:text-base"
              />
            </div>

            {filteredItems && (
              <Card className="border border-border/60 shadow-sm">
                <CardHeader className="pb-2 pt-4 sm:pb-3 sm:pt-5">
                  <CardTitle className="text-base font-semibold sm:text-lg">
                    검색 결과 ({filteredItems.length}건)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-4 sm:pb-5">
                  {filteredItems.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground sm:text-base">
                      검색 결과가 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-3 sm:px-4"
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                            <Box className="h-5 w-5 text-primary" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[15px] font-semibold leading-6 sm:text-base">
                              {item.name}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{item.location}</span>
                            </div>
                          </div>

                          {item.quantity && (
                            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground sm:text-sm">
                              {item.quantity}개
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!searchQuery && (
              <>
                <Card className="overflow-hidden border border-border/60 shadow-sm">
                  <div className="bg-gradient-to-r from-rose-500/10 to-primary/10 px-4 py-5 sm:px-5 sm:py-6">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm sm:h-14 sm:w-14">
                        <Package className="h-6 w-6 text-rose-600 sm:h-7 sm:w-7" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
                          학생회실 물품 안내
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground sm:text-base">
                          물품의 위치와 수량을 빠르게 확인할 수 있습니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>

                {Object.entries(displayItems).length === 0 ? (
                  <Card className="border border-border/60 shadow-sm">
                    <CardContent className="py-10">
                      <p className="text-center text-sm text-muted-foreground sm:text-base">
                        등록된 물품이 없습니다.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  Object.entries(displayItems).map(([category, categoryItems]) => (
                    <Card key={category} className="border border-border/60 shadow-sm">
                      <CardHeader className="pb-2 pt-4 sm:pb-3 sm:pt-5">
                        <CardTitle className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                          <span className="text-base sm:text-lg">
                            {categoryIcons[category] || '📦'}
                          </span>
                          <span>{category}</span>
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="pt-0 pb-4 sm:pb-5">
                        <div className="space-y-2.5">
                          {categoryItems?.map((item: any) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-3 transition-colors hover:bg-muted/20 sm:px-4"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[15px] font-semibold leading-6 sm:text-base">
                                  {item.name}
                                </div>
                                <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{item.location}</span>
                                </div>
                              </div>

                              {item.quantity && (
                                <div className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground sm:text-sm">
                                  {item.quantity}개
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}