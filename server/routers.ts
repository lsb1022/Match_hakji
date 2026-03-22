import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { memberProtectedProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { nanoid } from "nanoid";
import crypto from "crypto";
import { clearMemberSessionCookie, setMemberSessionCookie } from "./memberSession";
import { clearAdminSessionCookie, isValidAdminCredential, setAdminSessionCookie } from "./adminSession";

// ==================== Helper Functions ====================
const TIME_SLOTS = [
  { slot: 1, start: "12:00", end: "13:30", label: "12:00 - 13:30" },
  { slot: 2, start: "13:30", end: "15:00", label: "13:30 - 15:00" },
  { slot: 3, start: "15:00", end: "16:30", label: "15:00 - 16:30" },
  { slot: 4, start: "16:30", end: "18:00", label: "16:30 - 18:00" },
];

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const KST_TIME_ZONE = "Asia/Seoul";
const WEEKDAY_INDEX_BY_ENGLISH: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const memberCreateSchema = z.object({
  username: z.string().trim().min(2, '아이디는 2자 이상이어야 합니다.').max(50, '아이디는 50자 이하여야 합니다.'),
  password: z.string().min(4, '비밀번호는 4자리 이상이어야 합니다.').max(100, '비밀번호는 100자 이하여야 합니다.'),
  name: z.string().trim().min(1, '이름을 입력해주세요.').max(100, '이름은 100자 이하여야 합니다.'),
  phone: z.string().trim().optional(),
  department: z.string().trim().optional(),
  studentId: z.string().trim().optional(),
});

const memberUpdateSchema = z.object({
  id: z.number(),
  name: z.string().trim().min(1, '이름을 입력해주세요.').max(100, '이름은 100자 이하여야 합니다.').optional(),
  phone: z.string().trim().optional(),
  department: z.string().trim().optional(),
  studentId: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(4, '비밀번호는 4자리 이상이어야 합니다.').max(100, '비밀번호는 100자 이하여야 합니다.').optional(),
});

function getKSTParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const rawHour = Number(getPart("hour"));
  const hour = Number.isNaN(rawHour) ? 0 : rawHour % 24;
  const minute = Number(getPart("minute")) || 0;
  const second = Number(getPart("second")) || 0;
  const year = Number(getPart("year"));
  const month = Number(getPart("month"));
  const day = Number(getPart("day"));
  const weekdayShort = getPart("weekday");

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekdayShort,
    weekdayIndex: WEEKDAY_INDEX_BY_ENGLISH[weekdayShort] ?? 0,
  };
}

function normalizeDateString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return getKSTDateString(value);
  return String(value).split('T')[0];
}

function getEffectiveNow(): Date {
  const globalAny = global as any;
  if (typeof globalAny.testTimeMs === 'number') {
    return new Date(globalAny.testTimeMs);
  }
  if (typeof globalAny.testTimeOffset === 'number' && globalAny.testTimeOffset !== 0) {
    return new Date(Date.now() + globalAny.testTimeOffset);
  }
  return new Date();
}

function getKSTDateString(date: Date = getEffectiveNow()): string {
  const { year, month, day } = getKSTParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getKSTDayOfWeek(date: Date = getEffectiveNow()): number {
  return getKSTParts(date).weekdayIndex;
}

function getKSTMinutes(date: Date = getEffectiveNow()): number {
  const { hour, minute } = getKSTParts(date);
  return hour * 60 + minute;
}

function getKSTDateTimeLabel(date: Date = getEffectiveNow()): string {
  const { year, month, day, hour, minute, second } = getKSTParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')} (KST)`;
}

function getKSTDayOfYear(date: Date = getEffectiveNow()): number {
  const { year, month, day } = getKSTParts(date);
  const current = Date.UTC(year, month - 1, day);
  const start = Date.UTC(year, 0, 1);
  return Math.floor((current - start) / 86400000) + 1;
}



function getKSTWeekStart(date: Date = getEffectiveNow()): Date {
  const { year, month, day, weekdayIndex } = getKSTParts(date);
  const diffToMonday = weekdayIndex === 0 ? -6 : 1 - weekdayIndex;
  return new Date(Date.UTC(year, month - 1, day + diffToMonday, 0, 0, 0));
}

function addKSTDays(date: Date, days: number): Date {
  const { year, month, day } = getKSTParts(date);
  return new Date(Date.UTC(year, month - 1, day + days, 0, 0, 0));
}

function formatYmdFromUtcDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function parseDateStringToUtc(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}
function getCurrentTimeSlot(now: Date = getEffectiveNow()): number | null {
  const currentTime = getKSTMinutes(now);
  let matchedSlot: number | null = null;
  let matchedPriority = -Infinity;

  for (const slot of TIME_SLOTS) {
    const [startH, startM] = slot.start.split(":").map(Number);
    const [endH, endM] = slot.end.split(":").map(Number);
    const startTime = startH * 60 + startM;
    const endTime = endH * 60 + endM;
    const earlyCheckInTime = startTime - 10;

    if (currentTime >= earlyCheckInTime && currentTime < endTime && earlyCheckInTime > matchedPriority) {
      matchedSlot = slot.slot;
      matchedPriority = earlyCheckInTime;
    }
  }
  return matchedSlot;
}

function getAttendanceStatus(checkInTime: Date, timeSlot: number): "present" | "late" | "absent" {
  const slot = TIME_SLOTS.find(s => s.slot === timeSlot);
  if (!slot) return "absent";

  const [startH, startM] = slot.start.split(":").map(Number);
  const [endH, endM] = slot.end.split(":").map(Number);
  const checkInMinutes = getKSTMinutes(checkInTime);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (checkInMinutes <= startMinutes) return "present";
  if (checkInMinutes < endMinutes) return "late";
  return "absent";
}

async function getEffectiveSchedulesForDate(date: string) {
  const baseSchedules = await db.getSchedulesByDate(date);
  const approvedRequests = (await db.getAllSwapRequests(500))
    .filter(request => request.status === 'approved');

  const dateUtc = parseDateStringToUtc(date);
  const weekdayIndex = (() => {
    const utcDay = dateUtc.getUTCDay();
    return utcDay === 0 ? 7 : utcDay;
  })();

  const effectiveSchedules = [...baseSchedules];
  const upsertSlot = (timeSlot: number, memberId: number) => {
    const existing = effectiveSchedules.find(s => s.timeSlot === timeSlot);
    if (existing) {
      existing.memberId = memberId;
      return;
    }
    effectiveSchedules.push({
      id: -1 * (effectiveSchedules.length + 1),
      memberId,
      dayOfWeek: weekdayIndex,
      timeSlot,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  for (const request of approvedRequests) {
    const originalDate = normalizeDateString(request.originalDate);
    const swapDate = normalizeDateString(request.swapDate);

    if (request.requestType === 'substitute') {
      if (request.targetId && originalDate === date) {
        upsertSlot(request.originalTimeSlot, request.targetId);
      }
      continue;
    }

    if (request.requestType === 'swap' && request.targetId && swapDate && request.swapTimeSlot) {
      if (originalDate === date) {
        upsertSlot(request.originalTimeSlot, request.targetId);
      }
      if (swapDate === date) {
        upsertSlot(request.swapTimeSlot, request.requesterId);
      }
    }
  }

  return effectiveSchedules.sort((a, b) => a.timeSlot - b.timeSlot);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

function verifyPassword(password: string, hash: string): boolean {
  if (hash.startsWith("scrypt$")) {
    const [, salt, stored] = hash.split("$");
    const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(derivedKey, "hex"), Buffer.from(stored, "hex"));
  }

  // Legacy fallback for previously stored demo passwords.
  return Buffer.from(password).toString("base64") === hash;
}

// Admin check middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure
      .input(z.object({ username: z.string().min(1), password: z.string().min(1) }))
      .mutation(({ input, ctx }) => {
        if (!isValidAdminCredential(input.username, input.password)) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '관리자 아이디 또는 비밀번호가 올바르지 않습니다.' });
        }
        setAdminSessionCookie(ctx.req, ctx.res);
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      clearAdminSessionCookie(ctx.req, ctx.res);
      return { success: true } as const;
    }),
  }),

  // ==================== Member Auth (별도 로그인 시스템) ====================
  memberAuth: router({
    me: memberProtectedProcedure.query(async ({ ctx }) => {
      return {
        success: true,
        member: {
          id: ctx.member.memberId,
          username: ctx.member.username,
          name: ctx.member.name,
        },
      };
    }),

    logout: memberProtectedProcedure.mutation(({ ctx }) => {
      clearMemberSessionCookie(ctx.req, ctx.res);
      return { success: true } as const;
    }),

    login: publicProcedure
      .input(z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const member = await db.getMemberByUsername(input.username);
        if (!member) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }
        if (!member.isActive) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '비활성화된 계정입니다.' });
        }
        if (!verifyPassword(input.password, member.password)) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }

        if (!member.password.startsWith("scrypt$")) {
          await db.updateMember(member.id, { password: hashPassword(input.password) });
        }

        setMemberSessionCookie(ctx.req, ctx.res, member);

        return {
          success: true,
          member: {
            id: member.id,
            username: member.username,
            name: member.name,
            department: member.department,
            studentId: member.studentId,
          }
        };
      }),
  }),

  // ==================== Member Management (Admin) ====================
  members: router({
    list: adminProcedure.query(async () => {
      return await db.getAllMembers();
    }),

    activeOptions: memberProtectedProcedure.query(async ({ ctx }) => {
      const members = await db.getAllMembers();
      return members
        .filter(member => member.isActive && member.id !== ctx.member.memberId)
        .map(member => ({
          id: member.id,
          name: member.name,
          username: member.username,
        }));
    }),
    
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getMemberById(input.id);
      }),
    
    create: adminProcedure
      .input(memberCreateSchema)
      .mutation(async ({ input }) => {
        const existing = await db.getMemberByUsername(input.username);
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: '이미 존재하는 아이디입니다.' });
        }
        
        await db.createMember({
          ...input,
          password: hashPassword(input.password),
        });
        return { success: true };
      }),
    
    update: adminProcedure
      .input(memberUpdateSchema)
      .mutation(async ({ input }) => {
        const { id, password, ...data } = input;
        const updateData: Record<string, unknown> = { ...data };
        if (password) {
          updateData.password = hashPassword(password);
        }
        await db.updateMember(id, updateData as any);
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteMember(input.id);
        return { success: true };
      }),
  }),

  // ==================== Attendance ====================
  attendance: router({
    checkIn: memberProtectedProcedure
      .input(z.object({ code: z.string().min(1, 'QR 코드가 필요합니다.') }))
      .mutation(async ({ input, ctx }) => {
        const memberId = ctx.member.memberId;

        const now = getEffectiveNow();
        const dayOfWeek = getKSTDayOfWeek(now);
        const today = getKSTDateString(now);
        
        // 주말 체크
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '주말에는 출석체크가 불가능합니다.' });
        }

        const currentSlot = getCurrentTimeSlot(now);
        if (!currentSlot) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '현재 출석체크 가능한 시간이 아닙니다. (12:00 - 18:00)' });
        }
        
        // 담당자 검증 - 오늘의 스케줄에서 현재 시간대 담당자 확인
        const activeQr = await db.getActiveQrSetting();
        if (!activeQr) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '활성화된 QR 코드가 없습니다. 관리자에게 문의하세요.' });
        }
        if (input.code !== activeQr.secretKey) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '유효하지 않은 QR 코드입니다.' });
        }

        const todaySchedules = await getEffectiveSchedulesForDate(today);
        const currentSchedule = todaySchedules.find(s => s.timeSlot === currentSlot);
        
        if (!currentSchedule || currentSchedule.memberId !== memberId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '이 시간대의 담당자가 아닙니다. 담당자만 출석체크가 가능합니다.' });
        }
        
        // 이미 출석했는지 확인
        const existing = await db.getAttendanceByMemberAndDate(memberId, today, currentSlot);
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: '이미 출석체크를 완료했습니다.' });
        }

        const status = getAttendanceStatus(now, currentSlot);
        if (status === 'absent') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '해당 시간대는 이미 결석 처리 시점입니다.' });
        }

        await db.createAttendance({
          memberId,
          date: new Date(today),
          timeSlot: currentSlot,
          checkInTime: now,
          status,
          qrVerified: true,
        });

        const slotInfo = TIME_SLOTS.find(s => s.slot === currentSlot);
        return {
          success: true,
          status,
          timeSlot: slotInfo?.label,
          checkInTime: now.toISOString(),
          checkInTimeLabel: getKSTDateTimeLabel(now),
        };
      }),

    getMyAttendance: memberProtectedProcedure
      .query(async ({ ctx }) => {
        const memberId = ctx.member.memberId;
        const attendances = await db.getAttendancesByMember(memberId);
        const stats = await db.getAttendanceStats(memberId);
        return { attendances, stats };
      }),

    getTodayStatus: memberProtectedProcedure
      .query(async ({ ctx }) => {
        const memberId = ctx.member.memberId;
        const now = getEffectiveNow();
        const today = getKSTDateString(now);
        const dayOfWeek = getKSTDayOfWeek(now);
        const currentSlot = getCurrentTimeSlot(now);

        // 오늘의 모든 출석 기록 가져오기
        const todayAttendances = await db.getAttendancesByDate(today);
        const myAttendances = todayAttendances.filter(a => a.memberId === memberId);

        // 오늘의 스케줄 가져오기 (각 시간대별 담당자)
        const todaySchedules = await getEffectiveSchedulesForDate(today);
        const members = await db.getAllMembers();

        // 각 시간대별 담당자 정보 추가
        const timeSlotsWithAssignee = TIME_SLOTS.map(slot => {
          const schedule = todaySchedules.find(s => s.timeSlot === slot.slot);
          const assignee = schedule ? members.find(m => m.id === schedule.memberId) : null;
          const [startH, startM] = slot.start.split(":").map(Number);
          const [endH, endM] = slot.end.split(":").map(Number);
          const startMinutes = startH * 60 + startM;
          const endMinutes = endH * 60 + endM;
          const currentMinutes = getKSTMinutes(now);
          const checkInEnabled = currentMinutes >= startMinutes - 10 && currentMinutes < endMinutes;

          return {
            ...slot,
            assigneeId: schedule?.memberId || null,
            assigneeName: assignee?.name || null,
            checkInEnabled,
          };
        });

        const activeSlot = timeSlotsWithAssignee.find(s => s.slot === currentSlot) ?? null;

        return {
          date: today,
          dayOfWeek,
          dayName: DAY_NAMES[dayOfWeek],
          currentSlot,
          timeSlots: timeSlotsWithAssignee,
          myAttendances,
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
          currentAssigneeId: activeSlot?.assigneeId || null,
          currentAssigneeName: activeSlot?.assigneeName || null,
          currentTime: now.toISOString(),
          currentTimeLabel: getKSTDateTimeLabel(now),
        };
      }),

    // Admin: 모든 출석 기록 조회
    listAll: adminProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.getAllAttendances(input.limit || 100);
      }),

    getByDate: adminProcedure
      .input(z.object({ date: z.string() }))
      .query(async ({ input }) => {
        return await db.getAttendancesByDate(input.date);
      }),
  }),

  // ==================== Schedule ====================
  schedule: router({
    list: publicProcedure.query(async () => {
      const schedules = await db.getAllSchedules();
      const members = await db.getAllMembers();
      
      return schedules.map(s => ({
        ...s,
        member: members.find(m => m.id === s.memberId),
        dayName: DAY_NAMES[s.dayOfWeek],
        timeSlotLabel: TIME_SLOTS.find(t => t.slot === s.timeSlot)?.label,
      }));
    }),

    getByDay: publicProcedure
      .input(z.object({ dayOfWeek: z.number().min(1).max(5) }))
      .query(async ({ input }) => {
        const schedules = await db.getSchedulesByDay(input.dayOfWeek);
        const members = await db.getAllMembers();
        
        return schedules.map(s => ({
          ...s,
          member: members.find(m => m.id === s.memberId),
          timeSlotLabel: TIME_SLOTS.find(t => t.slot === s.timeSlot)?.label,
        }));
      }),


    weeklyView: memberProtectedProcedure.query(async () => {
      const members = await db.getAllMembers();
      const weekStart = getKSTWeekStart();
      const days = Array.from({ length: 5 }, (_, index) => {
        const date = addKSTDays(weekStart, index);
        const dateString = formatYmdFromUtcDate(date);
        return {
          date: dateString,
          dayOfWeek: index + 1,
          dayName: DAY_NAMES[index + 1],
        };
      });

      const schedulesByDay = await Promise.all(
        days.map(async (day) => {
          const effectiveSchedules = await getEffectiveSchedulesForDate(day.date);
          return {
            ...day,
            slots: TIME_SLOTS.map((slot) => {
              const schedule = effectiveSchedules.find((item) => item.timeSlot === slot.slot);
              const member = schedule ? members.find((item) => item.id === schedule.memberId) : null;
              return {
                slot: slot.slot,
                label: slot.label,
                memberId: schedule?.memberId ?? null,
                memberName: member?.name ?? null,
              };
            }),
          };
        })
      );

      return { days: schedulesByDay };
    }),

    myUpcomingOptions: memberProtectedProcedure.query(async ({ ctx }) => {
      const weekStart = getKSTWeekStart();
      const dates = Array.from({ length: 12 }, (_, index) => addKSTDays(weekStart, index))
        .filter((date) => {
          const weekday = date.getUTCDay();
          return weekday >= 1 && weekday <= 5;
        });

      const options: Array<{
        date: string;
        dayName: string;
        timeSlot: number;
        timeSlotLabel: string;
        displayLabel: string;
      }> = [];

      for (const date of dates) {
        const dateString = formatYmdFromUtcDate(date);
        const effectiveSchedules = await getEffectiveSchedulesForDate(dateString);
        for (const schedule of effectiveSchedules) {
          if (schedule.memberId !== ctx.member.memberId) continue;
          const slotInfo = TIME_SLOTS.find((slot) => slot.slot === schedule.timeSlot);
          options.push({
            date: dateString,
            dayName: DAY_NAMES[schedule.dayOfWeek],
            timeSlot: schedule.timeSlot,
            timeSlotLabel: slotInfo?.label ?? '',
            displayLabel: `${dateString} (${DAY_NAMES[schedule.dayOfWeek]}) ${slotInfo?.label ?? ''}`,
          });
        }
      }

      return options;
    }),

    upcomingAllOptions: memberProtectedProcedure.query(async ({ ctx }) => {
      const members = await db.getAllMembers();
      const weekStart = getKSTWeekStart();
      const dates = Array.from({ length: 12 }, (_, index) => addKSTDays(weekStart, index))
        .filter((date) => {
          const weekday = date.getUTCDay();
          return weekday >= 1 && weekday <= 5;
        });

      const options: Array<{
        date: string;
        dayName: string;
        timeSlot: number;
        timeSlotLabel: string;
        memberId: number | null;
        memberName: string | null;
        displayLabel: string;
      }> = [];

      for (const date of dates) {
        const dateString = formatYmdFromUtcDate(date);
        const effectiveSchedules = await getEffectiveSchedulesForDate(dateString);
        for (const slot of TIME_SLOTS) {
          const schedule = effectiveSchedules.find((item) => item.timeSlot === slot.slot);
          const member = schedule ? members.find((item) => item.id === schedule.memberId) : null;
          if (!schedule || schedule.memberId === ctx.member.memberId) continue;
          options.push({
            date: dateString,
            dayName: DAY_NAMES[schedule.dayOfWeek],
            timeSlot: slot.slot,
            timeSlotLabel: slot.label,
            memberId: schedule.memberId,
            memberName: member?.name ?? null,
            displayLabel: `${dateString} (${DAY_NAMES[schedule.dayOfWeek]}) ${slot.label} · ${member?.name ?? '담당자 없음'}`,
          });
        }
      }

      return options;
    }),

    create: adminProcedure
      .input(z.object({
        memberId: z.number(),
        dayOfWeek: z.number().min(1).max(5),
        timeSlot: z.number().min(1).max(4),
      }))
      .mutation(async ({ input }) => {
        await db.createSchedule(input);
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        memberId: z.number().optional(),
        dayOfWeek: z.number().min(1).max(5).optional(),
        timeSlot: z.number().min(1).max(4).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateSchedule(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteSchedule(input.id);
        return { success: true };
      }),

    bulkAssign: adminProcedure
      .input(z.object({
        assignments: z.array(z.object({
          dayOfWeek: z.number().min(1).max(5),
          timeSlot: z.number().min(1).max(4),
          memberId: z.number(),
        })),
      }))
      .mutation(async ({ input }) => {
        const daysToDelete = Array.from(new Set(input.assignments.map(a => a.dayOfWeek)));
        for (const day of daysToDelete) {
          const existingSchedules = await db.getSchedulesByDay(day);
          for (const schedule of existingSchedules) {
            await db.deleteSchedule(schedule.id);
          }
        }
        
        for (const assignment of input.assignments) {
          await db.createSchedule(assignment);
        }
        
        return { success: true };
      }),
  }),

  // ==================== Swap Requests ====================
  swap: router({
    create: memberProtectedProcedure
      .input(z.object({
        targetId: z.number().optional(),
        originalDate: z.string(),
        originalTimeSlot: z.number().min(1).max(4),
        swapDate: z.string().optional(),
        swapTimeSlot: z.number().min(1).max(4).optional(),
        requestType: z.enum(["swap", "substitute"]),
        reason: z.string().optional(),
      }).superRefine((value, ctx) => {
        if (value.requestType === 'swap') {
          if (!value.swapDate) ctx.addIssue({ code: 'custom', path: ['swapDate'], message: '교대할 날짜를 선택해주세요.' });
          if (!value.swapTimeSlot) ctx.addIssue({ code: 'custom', path: ['swapTimeSlot'], message: '교대할 시간대를 선택해주세요.' });
        }
        if (value.requestType === 'substitute' && !value.targetId) {
          ctx.addIssue({ code: 'custom', path: ['targetId'], message: '대타자를 선택해주세요.' });
        }
      }))
      .mutation(async ({ input, ctx }) => {
        await db.createSwapRequest({
          ...input,
          requesterId: ctx.member.memberId,
          originalDate: new Date(input.originalDate),
          swapDate: input.swapDate ? new Date(input.swapDate) : undefined,
        });
        return { success: true };
      }),

    getMyRequests: memberProtectedProcedure
      .query(async ({ ctx }) => {
        return await db.getSwapRequestsByMember(ctx.member.memberId);
      }),

    getPending: adminProcedure.query(async () => {
      const requests = await db.getPendingSwapRequests();
      const members = await db.getAllMembers();
      
      return requests.map(r => ({
        ...r,
        requester: members.find(m => m.id === r.requesterId),
        target: r.targetId ? members.find(m => m.id === r.targetId) : null,
        timeSlotLabel: TIME_SLOTS.find(t => t.slot === r.originalTimeSlot)?.label,
        swapTimeSlotLabel: r.swapTimeSlot ? TIME_SLOTS.find(t => t.slot === r.swapTimeSlot)?.label : null,
      }));
    }),

    listAll: adminProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        const requests = await db.getAllSwapRequests(input.limit || 100);
        const members = await db.getAllMembers();
        
        return requests.map(r => ({
          ...r,
          requester: members.find(m => m.id === r.requesterId),
          target: r.targetId ? members.find(m => m.id === r.targetId) : null,
          timeSlotLabel: TIME_SLOTS.find(t => t.slot === r.originalTimeSlot)?.label,
        }));
      }),

    approve: adminProcedure
      .input(z.object({
        id: z.number(),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const request = await db.getSwapRequestById(input.id);
        if (!request) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '신청 내역을 찾을 수 없습니다.' });
        }

        if (request.status !== 'pending') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '대기 중인 신청만 승인할 수 있습니다.' });
        }

        const originalDate = normalizeDateString(request.originalDate);
        if (!originalDate) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '원래 일정 날짜가 올바르지 않습니다.' });
        }

        const updateData: Record<string, unknown> = {
          status: 'approved',
          adminNote: input.adminNote,
        };

        if (request.requestType === 'swap') {
          const swapDate = normalizeDateString(request.swapDate);
          if (!swapDate || !request.swapTimeSlot) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '교대 일정 정보가 올바르지 않습니다.' });
          }

          const effectiveSchedules = await getEffectiveSchedulesForDate(swapDate);
          const targetSchedule = effectiveSchedules.find(schedule => schedule.timeSlot === request.swapTimeSlot);
          if (!targetSchedule) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '교대할 일정에 배정된 담당자가 없습니다.' });
          }

          if (targetSchedule.memberId === request.requesterId) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '본인의 일정끼리는 교대할 수 없습니다.' });
          }

          updateData.targetId = targetSchedule.memberId;
        } else if (!request.targetId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '대타자가 지정되지 않았습니다.' });
        }

        await db.updateSwapRequest(input.id, updateData as any);
        return { success: true };
      }),

    reject: adminProcedure
      .input(z.object({
        id: z.number(),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateSwapRequest(input.id, {
          status: "rejected",
          adminNote: input.adminNote,
        });
        return { success: true };
      }),

    cancel: memberProtectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const request = await db.getSwapRequestById(input.id);
        if (!request) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '요청을 찾을 수 없습니다.' });
        }
        if (request.requesterId !== ctx.member.memberId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '본인의 요청만 취소할 수 있습니다.' });
        }
        if (request.status !== 'pending') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '대기 중인 요청만 취소할 수 있습니다.' });
        }
        
        await db.updateSwapRequest(input.id, { status: "cancelled" });
        return { success: true };
      }),
  }),

  // ==================== Items ====================
  items: router({
    list: publicProcedure.query(async () => {
      return await db.getAllItems();
    }),

    getByCategory: publicProcedure
      .input(z.object({ category: z.string() }))
      .query(async ({ input }) => {
        return await db.getItemsByCategory(input.category);
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        category: z.string().min(1).max(50),
        location: z.string().min(1).max(200),
        description: z.string().optional(),
        quantity: z.number().optional(),
        imageUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createItem(input);
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        category: z.string().min(1).max(50).optional(),
        location: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        quantity: z.number().optional(),
        imageUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateItem(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteItem(input.id);
        return { success: true };
      }),
  }),

  // ==================== Manuals ====================
  manuals: router({
    list: publicProcedure.query(async () => {
      return await db.getAllManuals();
    }),

    getByCategory: publicProcedure
      .input(z.object({ category: z.string() }))
      .query(async ({ input }) => {
        return await db.getManualsByCategory(input.category);
      }),

    create: adminProcedure
      .input(z.object({
        title: z.string().min(1).max(200),
        content: z.string().min(1),
        category: z.string().min(1).max(50),
        orderIndex: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createManual(input);
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(200).optional(),
        content: z.string().min(1).optional(),
        category: z.string().min(1).max(50).optional(),
        orderIndex: z.number().optional(),
        isPublished: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateManual(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteManual(input.id);
        return { success: true };
      }),
  }),

  // ==================== QR Settings ====================
  qr: router({
    getActive: adminProcedure.query(async () => {
      return await db.getActiveQrSetting();
    }),

    generate: adminProcedure.mutation(async () => {
      const newKey = nanoid(32);
      
      // 기존 활성 QR 비활성화
      const existing = await db.getActiveQrSetting();
      if (existing) {
        await db.updateQrSetting(existing.id, { isActive: false });
      }
      
      // 새 QR 생성
      await db.createQrSetting({
        secretKey: newKey,
        isActive: true,
        lastRotated: new Date(),
      });
      
      return { success: true, secretKey: newKey };
    }),

    verify: publicProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        const setting = await db.getActiveQrSetting();
        return { valid: setting?.secretKey === input.code };
      }),

    // 시간별 동적 4자리 코드 생성
    generateTimeBasedCode: publicProcedure.query(() => {
      const now = getEffectiveNow();
      const hours = Math.floor(getKSTMinutes(now) / 60);
      const dayOfYear = getKSTDayOfYear(now);
      
      // 시간 + 날짜 기반 seed로 4자리 코드 생성 (KST 기준)
      const seed = (dayOfYear * 24 + hours) * 12345;
      const code = Math.abs(seed % 10000).toString().padStart(4, '0');
      
      return { code };
    }),

    // 시간별 동적 코드 검증
    verifyTimeBasedCode: publicProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        const now = getEffectiveNow();
        const hours = Math.floor(getKSTMinutes(now) / 60);
        const dayOfYear = getKSTDayOfYear(now);
        const seed = (dayOfYear * 24 + hours) * 12345;
        const expectedCode = Math.abs(seed % 10000).toString().padStart(4, '0');
        
        return { valid: input.code === expectedCode };
      }),

    getCurrentCode: adminProcedure.query(() => {
      const now = getEffectiveNow();
      const hours = Math.floor(getKSTMinutes(now) / 60);
      const dayOfYear = getKSTDayOfYear(now);
      const seed = (dayOfYear * 24 + hours) * 12345;
      const code = Math.abs(seed % 10000).toString().padStart(4, '0');
      
      const nextHourTime = new Date(now.getTime() + 3600000);
      const nextHours = Math.floor(getKSTMinutes(nextHourTime) / 60);
      const nextDayOfYear = getKSTDayOfYear(nextHourTime);
      const nextSeed = (nextDayOfYear * 24 + nextHours) * 12345;
      const nextCode = Math.abs(nextSeed % 10000).toString().padStart(4, '0');
      
      return { 
        currentCode: code,
        nextCode: nextCode,
        currentTime: now.toISOString(),
        currentTimeLabel: getKSTDateTimeLabel(now),
        nextChangeTime: nextHourTime.toISOString(),
        nextChangeTimeLabel: getKSTDateTimeLabel(nextHourTime)
      };
    }),

    forceGenerateCode: adminProcedure.mutation(async () => {
      const now = getEffectiveNow();
      const hours = Math.floor(getKSTMinutes(now) / 60);
      const dayOfYear = getKSTDayOfYear(now);
      const seed = (dayOfYear * 24 + hours) * 12345;
      const code = Math.abs(seed % 10000).toString().padStart(4, '0');
      
      const nextHourTime = new Date(now.getTime() + 3600000);
      const nextHours = Math.floor(getKSTMinutes(nextHourTime) / 60);
      const nextDayOfYear = getKSTDayOfYear(nextHourTime);
      const nextSeed = (nextDayOfYear * 24 + nextHours) * 12345;
      const nextCode = Math.abs(nextSeed % 10000).toString().padStart(4, '0');
      
      return {
        success: true,
        message: 'Code generated successfully',
        currentCode: code,
        nextCode: nextCode,
        nextChangeTime: nextHourTime.toISOString(),
        currentTimeLabel: getKSTDateTimeLabel(now),
        nextChangeTimeLabel: getKSTDateTimeLabel(nextHourTime)
      };
    }),

  }),

  // ==================== Admin Time Control ====================
  admin: router({
    setTestTime: adminProcedure.input(z.object({
      date: z.string().optional(), // YYYY-MM-DD format
      time: z.string().optional(), // HH:mm format
    })).mutation(({ input }) => {
      if (process.env.NODE_ENV === 'production') {
        throw new TRPCError({ code: 'FORBIDDEN', message: '운영 환경에서는 시간 조작 기능을 사용할 수 없습니다.' });
      }
      const globalAny = global as any;
      
      if (input.date && input.time) {
        const testDate = new Date(`${input.date}T${input.time}:00+09:00`);
        if (Number.isNaN(testDate.getTime())) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '테스트 날짜 또는 시간이 올바르지 않습니다.' });
        }
        globalAny.testTimeMs = testDate.getTime();
        globalAny.testTimeOffset = globalAny.testTimeMs - Date.now();
      } else {
        globalAny.testTimeMs = null;
        globalAny.testTimeOffset = 0;
      }
      
      return { success: true, message: '테스트 시간이 설정되었습니다.', currentTimeLabel: getKSTDateTimeLabel(getEffectiveNow()) };
    }),
    
    getTestTime: adminProcedure.query(() => {
      const now = getEffectiveNow();
      const globalAny = global as any;
      const isTestMode = typeof globalAny.testTimeMs === 'number';
      return {
        currentTime: now.toISOString(),
        currentTimeLabel: getKSTDateTimeLabel(now),
        currentDate: getKSTDateString(now),
        currentDayOfWeek: getKSTDayOfWeek(now),
        isTestMode,
        offset: isTestMode ? (globalAny.testTimeMs - Date.now()) : 0,
      };
    }),
  }),

  // ==================== Dashboard Stats ====================
  dashboard: router({
    stats: adminProcedure.query(async () => {
      const members = await db.getAllMembers();
      const pendingSwaps = await db.getPendingSwapRequests();
      const now = getEffectiveNow();
      const today = getKSTDateString(now);
  const todayAttendances = await db.getAttendancesByDate(today);

      const activeMembers = members.filter(m => m.isActive).length;
      const presentToday = todayAttendances.filter(a => a.status === 'present').length;
      const lateToday = todayAttendances.filter(a => a.status === 'late').length;
      const absentToday = todayAttendances.filter(a => a.status === 'absent').length;

      return {
        totalMembers: members.length,
        activeMembers,
        pendingSwapRequests: pendingSwaps.length,
        todayStats: {
          present: presentToday,
          late: lateToday,
          absent: absentToday,
          total: todayAttendances.length,
        },
      };
    }),
  }),

  // ==================== Constants ====================
  constants: router({
    timeSlots: publicProcedure.query(() => TIME_SLOTS),
    dayNames: publicProcedure.query(() => DAY_NAMES),
  }),
});

export type AppRouter = typeof appRouter;


