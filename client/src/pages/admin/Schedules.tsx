import { useMemo, useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, Plus, Trash2, User, Clock } from 'lucide-react';

export default function AdminSchedules() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkAssignments, setBulkAssignments] = useState<Record<number, Record<number, string[]>>>(
    Object.fromEntries([1, 2, 3, 4, 5].map((day) => [day, {}]))
  );
  const [bulkPickerValues, setBulkPickerValues] = useState<Record<string, string>>({});
  const [bulkPickerOpen, setBulkPickerOpen] = useState<Record<string, boolean>>({});

  const { data: schedules, refetch } = trpc.schedule.list.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === 'admin',
  });
  const { data: members } = trpc.members.list.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const activeMembers = members?.filter((m) => m.isActive) ?? [];

  const createMutation = trpc.schedule.create.useMutation({
    onSuccess: () => {
      toast.success('스케줄이 추가되었습니다.');
      refetch();
      setSelectedMember('');
      setSelectedDay('');
      setSelectedSlot('');
      setIsAddOpen(false);
    },
    onError: (error: any) => toast.error(error.message),
  });

  const deleteMutation = trpc.schedule.delete.useMutation({
    onSuccess: () => {
      toast.success('스케줄이 삭제되었습니다.');
      refetch();
    },
    onError: (error: any) => toast.error(error.message),
  });

  const bulkAssignMutation = trpc.schedule.bulkAssign.useMutation({
    onSuccess: () => {
      toast.success('일괄배정이 완료되었습니다.');
      refetch();
      setIsBulkOpen(false);
      setBulkAssignments(Object.fromEntries([1, 2, 3, 4, 5].map((day) => [day, {}])));
      setBulkPickerValues({});
      setBulkPickerOpen({});
    },
    onError: (error: any) => toast.error(error.message),
  });

  const dayNames = ['', '월', '화', '수', '목', '금'];
  const timeSlots = [
    { slot: 1, label: '12:00 - 13:30' },
    { slot: 2, label: '13:30 - 15:00' },
    { slot: 3, label: '15:00 - 16:30' },
    { slot: 4, label: '16:30 - 18:00' },
  ];

  const scheduleMatrix = useMemo(() => {
    const matrix: Record<number, Record<number, any[]>> = {};
    for (let day = 1; day <= 5; day++) {
      matrix[day] = {};
      for (let slot = 1; slot <= 4; slot++) {
        matrix[day][slot] = (schedules ?? []).filter((s) => s.dayOfWeek === day && s.timeSlot === slot);
      }
    }
    return matrix;
  }, [schedules]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  if (!isAuthenticated || user?.role !== 'admin') {
    window.location.href = '/admin/login';
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !selectedDay || !selectedSlot) {
      toast.error('모든 항목을 선택해주세요.');
      return;
    }
    const existing = scheduleMatrix[parseInt(selectedDay)]?.[parseInt(selectedSlot)] ?? [];
    if (existing.some((schedule) => schedule.memberId === parseInt(selectedMember))) {
      toast.error('이미 배정된 지킴이입니다.');
      return;
    }
    if (existing.length >= 2) {
      toast.error('한 시간대에는 최대 2명까지만 배정할 수 있습니다.');
      return;
    }
    createMutation.mutate({ memberId: parseInt(selectedMember), dayOfWeek: parseInt(selectedDay), timeSlot: parseInt(selectedSlot) });
  };

  const handleBulkOpenChange = (key: string, currentCount: number, open: boolean) => {
    if (open && currentCount >= 2) {
      toast.error('학지는 2명까지 배정할 수 있습니다.');
      setBulkPickerOpen((prev) => ({ ...prev, [key]: false }));
      return;
    }
    setBulkPickerOpen((prev) => ({ ...prev, [key]: open }));
  };

  const handleBulkSelect = (day: number, slot: number, value: string) => {
    const key = `${day}-${slot}`;
    const prevList = bulkAssignments[day]?.[slot] ?? [];

    if (prevList.includes(value)) {
      toast.error('이미 선택된 지킴이입니다.');
      setBulkPickerValues((prev) => ({ ...prev, [key]: '' }));
      return;
    }

    if (prevList.length >= 2) {
      toast.error('학지는 2명까지 배정할 수 있습니다.');
      setBulkPickerValues((prev) => ({ ...prev, [key]: '' }));
      return;
    }

    setBulkAssignments((prev) => ({
      ...prev,
      [day]: { ...prev[day], [slot]: [...prevList, value] },
    }));
    setBulkPickerValues((prev) => ({ ...prev, [key]: '' }));
    setBulkPickerOpen((prev) => ({ ...prev, [key]: false }));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="mr-2"><ArrowLeft className="w-5 h-5" /></Button>
            <h1 className="font-semibold">스케줄 관리</h1>
          </div>
          <div className="flex gap-2">
            <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
              <DialogTrigger asChild><Button size="sm" variant="outline"><Calendar className="w-4 h-4 mr-1" />일괄배정</Button></DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader><DialogTitle>주간 스케줄 일괄배정</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4 max-h-96 overflow-y-auto">
                  {[1,2,3,4,5].map((day) => (
                    <div key={day} className="space-y-2">
                      <h3 className="font-semibold text-sm">{dayNames[day]}요일</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {timeSlots.map((slot) => {
                          const currentValues = bulkAssignments[day]?.[slot.slot] ?? [];
                          const selectKey = `${day}-${slot.slot}`;
                          const remainingMembers = activeMembers.filter((member) => !currentValues.includes(String(member.id)));
                          return (
                            <div key={slot.slot} className="space-y-2 rounded-lg border border-border p-3">
                              <div className="flex items-center justify-between gap-2">
                                <Label className="text-xs text-muted-foreground">{slot.label}</Label>
                                <span className="text-[11px] text-muted-foreground">{currentValues.length}/2명</span>
                              </div>
                              <Select
                                value={bulkPickerValues[selectKey] ?? ''}
                                open={bulkPickerOpen[selectKey] ?? false}
                                onOpenChange={(open) => handleBulkOpenChange(selectKey, currentValues.length, open)}
                                onValueChange={(value) => handleBulkSelect(day, slot.slot, value)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder={currentValues.length >= 2 ? '배정 완료' : '지킴이 추가'} />
                                </SelectTrigger>
                                <SelectContent>
                                  {remainingMembers.length > 0 ? remainingMembers.map((member) => (
                                    <SelectItem key={member.id} value={member.id.toString()}>{member.name}</SelectItem>
                                  )) : (
                                    <SelectItem value="no-members" disabled>추가 가능한 지킴이가 없습니다</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                              <div className="flex flex-wrap gap-1.5">
                                {currentValues.length > 0 ? currentValues.map((value) => {
                                  const assigned = activeMembers.find((member) => String(member.id) === value);
                                  return (
                                    <button
                                      type="button"
                                      key={value}
                                      onClick={() => {
                                        setBulkAssignments((prev) => ({
                                          ...prev,
                                          [day]: {
                                            ...prev[day],
                                            [slot.slot]: (prev[day]?.[slot.slot] ?? []).filter((id) => id !== value),
                                          },
                                        }));
                                        setBulkPickerValues((prev) => ({ ...prev, [selectKey]: '' }));
                                        setBulkPickerOpen((prev) => ({ ...prev, [selectKey]: false }));
                                      }}
                                      className="rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-muted/70"
                                    >
                                      {assigned?.name ?? value} ×
                                    </button>
                                  );
                                }) : <span className="text-xs text-muted-foreground">미배정</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <Button className="w-full mt-4" onClick={() => {
                  const assignments: Array<{dayOfWeek:number; timeSlot:number; memberId:number}> = [];
                  for (let day=1; day<=5; day++) {
                    for (let slot=1; slot<=4; slot++) {
                      for (const value of bulkAssignments[day]?.[slot] ?? []) {
                        assignments.push({ dayOfWeek: day, timeSlot: slot, memberId: parseInt(value) });
                      }
                    }
                  }
                  if (assignments.length === 0) {
                    toast.error('최소 하나 이상의 스케줄을 선택해주세요.');
                    return;
                  }
                  bulkAssignMutation.mutate({ assignments });
                }} disabled={bulkAssignMutation.isPending}>
                  {bulkAssignMutation.isPending ? '배정 중...' : '일괄배정'}
                </Button>
              </DialogContent>
            </Dialog>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />추가</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>스케줄 추가</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  <div className="space-y-2"><Label>담당자</Label><Select value={selectedMember} onValueChange={setSelectedMember}><SelectTrigger><SelectValue placeholder="담당자 선택" /></SelectTrigger><SelectContent>{activeMembers.map((member) => <SelectItem key={member.id} value={member.id.toString()}>{member.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>요일</Label><Select value={selectedDay} onValueChange={setSelectedDay}><SelectTrigger><SelectValue placeholder="요일 선택" /></SelectTrigger><SelectContent>{[1,2,3,4,5].map((day)=><SelectItem key={day} value={day.toString()}>{dayNames[day]}요일</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>시간대</Label><Select value={selectedSlot} onValueChange={setSelectedSlot}><SelectTrigger><SelectValue placeholder="시간대 선택" /></SelectTrigger><SelectContent>{timeSlots.map((slot)=><SelectItem key={slot.slot} value={slot.slot.toString()}>{slot.label}</SelectItem>)}</SelectContent></Select></div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? '추가 중...' : '스케줄 추가'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>
      <main className="container py-6 space-y-6">
        {[1,2,3,4,5].map((day) => (
          <Card key={day} className="elegant-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">{dayNames[day]}</span>
                {dayNames[day]}요일
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {timeSlots.map((slot) => {
                  const slotSchedules = scheduleMatrix[day]?.[slot.slot] ?? [];
                  return (
                    <div key={slot.slot} className={`flex items-start justify-between gap-3 p-3 rounded-lg border ${slotSchedules.length > 0 ? 'border-primary/20 bg-primary/5' : 'border-border'}`}>
                      <div className="flex items-center gap-3 shrink-0">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{slot.label}</span>
                      </div>
                      <div className="flex-1 flex flex-wrap justify-end gap-2">
                        {slotSchedules.length > 0 ? slotSchedules.map((schedule) => (
                          <div key={schedule.id} className="inline-flex items-center gap-2 rounded-full bg-background px-2.5 py-1 border border-border">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{schedule.member?.name}</span>
                            <button type="button" onClick={() => { if (confirm('이 스케줄을 삭제하시겠습니까?')) deleteMutation.mutate({ id: schedule.id }); }}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </button>
                          </div>
                        )) : <span className="text-sm text-muted-foreground">미배정</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
