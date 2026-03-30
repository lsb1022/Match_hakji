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

function getKSTDateForWeekday(now: Date, targetDayOfWeek: number): string {
  const currentDay = getKSTDayOfWeek(now);
  const diff = targetDayOfWeek - currentDay;
  const target = new Date(now.getTime() + diff * 86400000);
  return getKSTDateString(target);
}

function getWeekDates(now: Date = getEffectiveNow(), weekOffset = 0) {
  const base = new Date(now.getTime() + weekOffset * 7 * 86400000);
  return [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    dayName: DAY_NAMES[dayOfWeek],
    date: getKSTDateForWeekday(base, dayOfWeek),
  }));
}

function formatScheduleOptionLabel(date: string, dayName: string, slotLabel: string, memberName?: string | null) {
  const suffix = memberName ? ` · ${memberName}` : '';
  return `${date} (${dayName}) · ${slotLabel}${suffix}`;
}

function parseSlotMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function getCurrentTimeSlot(now: Date = getEffectiveNow()): number | null {
  const currentTime = getKSTMinutes(now);

  const matchingSlots = TIME_SLOTS.filter((slot) => {
    const startTime = parseSlotMinutes(slot.start);
    const endTime = parseSlotMinutes(slot.end);
    const earlyCheckInTime = startTime - 10;
    return currentTime >= earlyCheckInTime && currentTime < endTime;
  });

  if (matchingSlots.length === 0) return null;
  return matchingSlots[matchingSlots.length - 1]!.slot;
}

function getCurrentTimeSlotInfo(now: Date = getEffectiveNow()) {
  const currentSlot = getActiveCodeTimeSlot(now);
  const slotInfo = TIME_SLOTS.find((slot) => slot.slot === currentSlot) ?? null;
  return { currentSlot, slotInfo };
}

function getNextChangeTime(now: Date = getEffectiveNow()): Date | null {
  const currentMinutes = getKSTMinutes(now);

  for (const slot of TIME_SLOTS) {
    const startTime = parseSlotMinutes(slot.start);
    const endTime = parseSlotMinutes(slot.end);
    const earlyCheckInTime = startTime - 10;

    if (currentMinutes < earlyCheckInTime) {
      const { year, month, day } = getKSTParts(now);
      return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(Math.floor(earlyCheckInTime / 60)).padStart(2, '0')}:${String(earlyCheckInTime % 60).padStart(2, '0')}:00+09:00`);
    }

    if (currentMinutes >= earlyCheckInTime && currentMinutes < endTime) {
      const { year, month, day } = getKSTParts(now);
      return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${slot.end}:00+09:00`);
    }
  }

  return null;
}

function getLateMinutes(checkInTime: Date | string | null | undefined, timeSlot: number): number | null {
  if (!checkInTime) return null;
  const slot = TIME_SLOTS.find((s) => s.slot === timeSlot);
  if (!slot) return null;

  const checkInDate = checkInTime instanceof Date ? checkInTime : new Date(checkInTime);
  if (Number.isNaN(checkInDate.getTime())) return null;

  const lateMinutes = getKSTMinutes(checkInDate) - parseSlotMinutes(slot.start);
  return lateMinutes > 0 ? lateMinutes : 0;
}

function isWeekdayForAttendanceCodes(now: Date = getEffectiveNow()): boolean {
  const dayOfWeek = getKSTDayOfWeek(now);
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}

function getActiveCodeTimeSlot(now: Date = getEffectiveNow()): number | null {
  if (!isWeekdayForAttendanceCodes(now)) return null;

  const currentMinutes = getKSTMinutes(now);
  const matchingSlots = TIME_SLOTS.filter((slot) => {
    const startTime = parseSlotMinutes(slot.start);
    const endTime = parseSlotMinutes(slot.end);
    const earlyCheckInTime = startTime - 10;
    return currentMinutes >= earlyCheckInTime && currentMinutes < endTime;
  });

  if (matchingSlots.length === 0) return null;
  return matchingSlots[matchingSlots.length - 1]!.slot;
}

function getNextCodeChangeTime(now: Date = getEffectiveNow()): Date | null {
  if (!isWeekdayForAttendanceCodes(now)) return null;

  const currentMinutes = getKSTMinutes(now);
  const { year, month, day } = getKSTParts(now);

  for (const slot of TIME_SLOTS) {
    const earlyCheckInTime = parseSlotMinutes(slot.start) - 10;
    if (currentMinutes < earlyCheckInTime) {
      return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(Math.floor(earlyCheckInTime / 60)).padStart(2, '0')}:${String(earlyCheckInTime % 60).padStart(2, '0')}:00+09:00`);
    }
  }

  return null;
}

function generateTimeSlotPin(secretKey: string, date: string, timeSlot: number): string {
  const digest = crypto
    .createHash('sha256')
    .update(`${secretKey}:${date}:${timeSlot}`)
    .digest('hex');
  const numeric = parseInt(digest.slice(0, 8), 16) % 10000;
  return String(numeric).padStart(4, '0');
}

function getAttendanceStatus(checkInTime: Date, timeSlot: number): "present" | "late" | "absent" {
  const slot = TIME_SLOTS.find(s => s.slot === timeSlot);
  if (!slot) return "absent";

  const checkInMinutes = getKSTMinutes(checkInTime);
  const startMinutes = parseSlotMinutes(slot.start);
  const absentThresholdMinutes = startMinutes + 80;

  if (checkInMinutes <= startMinutes) return "present";
  if (checkInMinutes < absentThresholdMinutes) return "late";
  return "absent";
}

async function getEffectiveSchedulesForDate(date: string) {
  const baseSchedules = await db.getSchedulesByDate(date);
  const approvedRequests = (await db.getAllSwapRequests(500))
    .filter(request => request.status === 'approved');

  const effectiveSchedules = [...baseSchedules];

  for (const request of approvedRequests) {
    const originalDate = normalizeDateString(request.originalDate);
    const swapDate = normalizeDateString(request.swapDate);
    const requesterId = Number(request.requesterId);
    const targetId = request.targetId ? Number(request.targetId) : null;
    const originalTimeSlot = Number(request.originalTimeSlot);
    const swapTimeSlot = request.swapTimeSlot ? Number(request.swapTimeSlot) : null;

    if (request.requestType === 'substitute') {
      if (targetId && originalDate === date) {
        removeMemberFromSlot(effectiveSchedules, originalTimeSlot, requesterId);
        addMemberToSlot(date, effectiveSchedules, originalTimeSlot, targetId);
      }
      continue;
    }

    if (request.requestType === 'swap' && targetId && swapDate && swapTimeSlot) {
      if (originalDate === date) {
        replaceMemberInSlot(date, effectiveSchedules, originalTimeSlot, requesterId, targetId);
      }
      if (swapDate === date) {
        replaceMemberInSlot(date, effectiveSchedules, swapTimeSlot, targetId, requesterId);
      }
    }
  }

  return effectiveSchedules.sort((a, b) => a.timeSlot - b.timeSlot || a.memberId - b.memberId);
}


function removeMemberFromSlot(schedules: Array<any>, timeSlot: number, memberId: number) {
  const numericTimeSlot = Number(timeSlot);
  const numericMemberId = Number(memberId);
  for (let i = schedules.length - 1; i >= 0; i -= 1) {
    if (Number(schedules[i].timeSlot) === numericTimeSlot && Number(schedules[i].memberId) === numericMemberId) {
      schedules.splice(i, 1);
    }
  }
}

function addMemberToSlot(date: string, schedules: Array<any>, timeSlot: number, memberId: number) {
  const numericTimeSlot = Number(timeSlot);
  const numericMemberId = Number(memberId);
  const exists = schedules.some((item) => Number(item.timeSlot) === numericTimeSlot && Number(item.memberId) === numericMemberId);
  if (exists) return;
  schedules.push({
    id: -1 * (schedules.length + 1),
    memberId: numericMemberId,
    dayOfWeek: new Date(`${date}T00:00:00Z`).getUTCDay(),
    timeSlot: numericTimeSlot,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function replaceMemberInSlot(date: string, schedules: Array<any>, timeSlot: number, fromMemberId: number, toMemberId: number) {
  removeMemberFromSlot(schedules, timeSlot, fromMemberId);
  addMemberToSlot(date, schedules, timeSlot, toMemberId);
}

function getSlotSchedules(schedules: Array<any>, timeSlot: number) {
  return schedules.filter((item) => item.timeSlot === timeSlot);
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
        if (member.approvalStatus === 'pending') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '회원가입 신청이 승인 대기 중입니다.' });
        }
        if (member.approvalStatus === 'rejected') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '회원가입 신청이 반려되었습니다. 학생회에 문의해주세요.' });
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

    signup: publicProcedure
      .input(memberCreateSchema)
      .mutation(async ({ input }) => {
        const existing = await db.getMemberByUsername(input.username);
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: '이미 사용 중인 아이디입니다.' });
        }

        await db.createMember({
          ...input,
          password: hashPassword(input.password),
          approvalStatus: 'pending',
          isActive: false,
        });

        return { success: true } as const;
      }),
  }),

  // ==================== Member Management (Admin) ====================
  members: router({
    list: adminProcedure.query(async () => {
      return (await db.getAllMembers()).filter(member => member.approvalStatus !== 'pending');
    }),

    pending: adminProcedure.query(async () => {
      return await db.getMembersByApprovalStatus('pending');
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
          approvalStatus: 'approved',
          isActive: true,
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

    approve: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateMember(input.id, { approvalStatus: 'approved', isActive: true } as any);
        return { success: true };
      }),

    reject: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateMember(input.id, { approvalStatus: 'rejected', isActive: false } as any);
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
      .input(z.object({ qrCode: z.string().min(1, 'QR 코드가 필요합니다.'), pinCode: z.string().length(4, '인증 코드는 4자리여야 합니다.') }))
      .mutation(async ({ input, ctx }) => {
        const memberId = ctx.member.memberId;

        const now = getEffectiveNow();
        const dayOfWeek = getKSTDayOfWeek(now);
        const today = getKSTDateString(now);
        
        // 주말 체크
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '주말에는 출석체크가 불가능합니다.' });
        }

        const currentSlot = getActiveCodeTimeSlot(now);
        if (!currentSlot) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '현재 출석체크 가능한 시간이 아닙니다. (평일 11:50 - 18:00)' });
        }
        
        // 담당자 검증 - 오늘의 스케줄에서 현재 시간대 담당자 확인
        const activeQr = await db.getActiveQrSetting();
        if (!activeQr) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '활성화된 QR 코드가 없습니다. 관리자에게 문의하세요.' });
        }
        if (input.qrCode !== activeQr.secretKey) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '유효하지 않은 QR 코드입니다.' });
        }

        const expectedPinCode = generateTimeSlotPin(activeQr.secretKey, today, currentSlot);
        if (input.pinCode !== expectedPinCode) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '현재 시간대 인증 코드가 올바르지 않습니다.' });
        }

        const todaySchedules = await getEffectiveSchedulesForDate(today);
        const currentSchedules = todaySchedules.filter(s => s.timeSlot === currentSlot);

        if (!currentSchedules.some(schedule => schedule.memberId === memberId)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '이 시간대의 담당자가 아닙니다. 담당자만 출석체크가 가능합니다.' });
        }
        
        // 이미 출석했는지 확인
        const existing = await db.getAttendanceByMemberAndDate(memberId, today, currentSlot);
        if (existing && existing.status !== 'absent') {
          throw new TRPCError({ code: 'CONFLICT', message: '이미 출석체크를 완료했습니다.' });
        }

        const status = getAttendanceStatus(now, currentSlot);

        if (existing) {
          await db.updateAttendance(existing.id, {
            checkInTime: now,
            status,
            qrVerified: true,
          });
        } else {
          await db.createAttendance({
            memberId,
            date: new Date(today),
            timeSlot: currentSlot,
            checkInTime: now,
            status,
            qrVerified: true,
          });
        }

        const slotInfo = TIME_SLOTS.find(s => s.slot === currentSlot);
        return {
          success: true,
          status,
          lateMinutes: status === 'late' ? getLateMinutes(now, currentSlot) : null,
          timeSlot: slotInfo?.label,
          checkInTime: now.toISOString(),
          checkInTimeLabel: getKSTDateTimeLabel(now),
          pinCode: expectedPinCode,
        };
      }),

    getMyAttendance: memberProtectedProcedure
      .query(async ({ ctx }) => {
        const memberId = ctx.member.memberId;
        const attendances = (await db.getAttendancesByMember(memberId)).map(attendance => ({
          ...attendance,
          lateMinutes: attendance.status === 'late' ? getLateMinutes(attendance.checkInTime, attendance.timeSlot) : null,
        }));
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
        const myAttendances = todayAttendances
          .filter(a => a.memberId === memberId)
          .map(attendance => ({
            ...attendance,
            lateMinutes: attendance.status === 'late' ? getLateMinutes(attendance.checkInTime, attendance.timeSlot) : null,
          }));

        // 오늘의 스케줄 가져오기 (각 시간대별 담당자)
        const todaySchedules = await getEffectiveSchedulesForDate(today);
        const members = await db.getAllMembers();

        // 각 시간대별 담당자 정보 추가
        const timeSlotsWithAssignee = TIME_SLOTS.map(slot => {
          const slotSchedules = todaySchedules.filter(s => s.timeSlot === slot.slot);
          const assignees = slotSchedules
            .map(schedule => members.find(m => m.id === schedule.memberId))
            .filter(Boolean)
            .map((member: any) => ({ id: member.id, name: member.name }));
          return {
            ...slot,
            assigneeIds: slotSchedules.map(schedule => schedule.memberId),
            assigneeId: slotSchedules[0]?.memberId || null,
            assigneeName: assignees.length > 0 ? assignees.map((assignee: any) => assignee.name).join(', ') : null,
            assignees,
          };
        });

        const currentSlotAttendances = currentSlot
          ? (timeSlotsWithAssignee.find((slot) => slot.slot === currentSlot)?.assignees ?? []).map((assignee: any) => {
              const attendance = todayAttendances.find(
                (item) => item.timeSlot === currentSlot && item.memberId === assignee.id
              );
              return {
                memberId: assignee.id,
                memberName: assignee.name,
                status: attendance?.status ?? 'pending',
                lateMinutes:
                  attendance?.status === 'late'
                    ? getLateMinutes(attendance.checkInTime, attendance.timeSlot)
                    : null,
              };
            })
          : [];

        return {
          date: today,
          dayOfWeek,
          dayName: DAY_NAMES[dayOfWeek],
          currentSlot,
          timeSlots: timeSlotsWithAssignee,
          myAttendances,
          currentSlotAttendances,
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
          currentAssigneeIds: timeSlotsWithAssignee.find(s => s.slot === currentSlot)?.assigneeIds || [],
          currentAssigneeId: timeSlotsWithAssignee.find(s => s.slot === currentSlot)?.assigneeId || null,
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

    getCurrentWeek: publicProcedure.query(async () => {
      const now = getEffectiveNow();
      const members = await db.getAllMembers();
      const weekDates = getWeekDates(now);

      const days = await Promise.all(
        weekDates.map(async ({ dayOfWeek, dayName, date }) => {
          const schedules = await getEffectiveSchedulesForDate(date);
          const slots = TIME_SLOTS.map((slot) => {
            const slotSchedules = schedules.filter((s) => s.timeSlot === slot.slot);
            const assignedMembers = slotSchedules
              .map((schedule) => members.find((m) => m.id === schedule.memberId) ?? null)
              .filter(Boolean);
            return {
              slot: slot.slot,
              label: slot.label,
              memberId: slotSchedules[0]?.memberId ?? null,
              member: assignedMembers[0] ?? null,
              members: assignedMembers,
            };
          });

          return {
            dayOfWeek,
            dayName,
            date,
            slots,
          };
        })
      );

      return {
        currentTimeLabel: getKSTDateTimeLabel(now),
        days,
      };
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

    create: adminProcedure
      .input(z.object({
        memberId: z.number(),
        dayOfWeek: z.number().min(1).max(5),
        timeSlot: z.number().min(1).max(4),
      }))
      .mutation(async ({ input }) => {
        const existingSchedules = await db.getSchedulesByDay(input.dayOfWeek);
        const sameSlotSchedules = existingSchedules.filter((schedule) => schedule.timeSlot === input.timeSlot);

        if (sameSlotSchedules.some((schedule) => schedule.memberId === input.memberId)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '이미 해당 시간대에 배정된 지킴이입니다.' });
        }

        if (sameSlotSchedules.length >= 2) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '한 시간대에는 최대 2명까지만 배정할 수 있습니다.' });
        }

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
        const groupedBySlot = new Map<string, number[]>();
        for (const assignment of input.assignments) {
          const key = `${assignment.dayOfWeek}-${assignment.timeSlot}`;
          const list = groupedBySlot.get(key) ?? [];
          if (list.includes(assignment.memberId)) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '같은 시간대에 동일한 지킴이를 중복 배정할 수 없습니다.' });
          }
          list.push(assignment.memberId);
          if (list.length > 2) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '한 시간대에는 최대 2명까지만 배정할 수 있습니다.' });
          }
          groupedBySlot.set(key, list);
        }

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
    getRequestOptions: memberProtectedProcedure
      .query(async ({ ctx }) => {
        const members = await db.getAllMembers();
        const weeks = [0, 1];
        const entries: Array<{
          date: string;
          dayOfWeek: number;
          dayName: string;
          timeSlot: number;
          label: string;
          memberId: number | null;
          memberName: string | null;
        }> = [];

        for (const weekOffset of weeks) {
          const weekDates = getWeekDates(getEffectiveNow(), weekOffset);
          for (const { date, dayOfWeek, dayName } of weekDates) {
            const schedules = await getEffectiveSchedulesForDate(date);
            for (const slot of TIME_SLOTS) {
              const slotSchedules = schedules.filter((item) => item.timeSlot === slot.slot);
              if (slotSchedules.length === 0) {
                entries.push({
                  date,
                  dayOfWeek,
                  dayName,
                  timeSlot: slot.slot,
                  label: formatScheduleOptionLabel(date, dayName, slot.label, null),
                  memberId: null,
                  memberName: null,
                });
                continue;
              }

              for (const schedule of slotSchedules) {
                const assignedMember = members.find((member) => member.id === schedule.memberId) ?? null;
                entries.push({
                  date,
                  dayOfWeek,
                  dayName,
                  timeSlot: slot.slot,
                  label: formatScheduleOptionLabel(date, dayName, slot.label, assignedMember?.name ?? null),
                  memberId: assignedMember?.id ?? null,
                  memberName: assignedMember?.name ?? null,
                });
              }
            }
          }
        }

        return {
          mySchedules: entries.filter((entry) => entry.memberId === ctx.member.memberId),
          availableSwapSchedules: entries.filter((entry) => entry.memberId !== null),
        };
      }),

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
          if (!value.targetId) ctx.addIssue({ code: 'custom', path: ['targetId'], message: '교대할 상대를 선택해주세요.' });
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
          const targetSchedule = effectiveSchedules.find(
            schedule => schedule.timeSlot === request.swapTimeSlot && schedule.memberId === request.targetId
          );
          if (!targetSchedule) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '선택한 교대 상대가 해당 시간대에 배정되어 있지 않습니다.' });
          }

          if (targetSchedule.memberId === request.requesterId) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '본인의 일정끼리는 교대할 수 없습니다.' });
          }
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
        const activeRentalCount = await db.countActiveRentalsByItemId(id);
        if (typeof data.quantity === 'number' && data.quantity < activeRentalCount) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `현재 대여 중인 번호가 ${activeRentalCount}개라 수량을 더 줄일 수 없습니다.` });
        }
        await db.updateItem(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const activeRentalCount = await db.countActiveRentalsByItemId(input.id);
        if (activeRentalCount > 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '현재 대여 중인 번호가 있어 삭제할 수 없습니다.' });
        }
        await db.deleteItem(input.id);
        return { success: true };
      }),
  }),

  // ==================== Rental Business ====================
  rental: router({
    listFeePayers: adminProcedure.query(async () => {
      return await db.getAllFeePayers();
    }),

    uploadFeePayers: adminProcedure
      .input(z.object({
        payers: z.array(z.object({
          name: z.string().trim().min(1),
          studentId: z.string().trim().min(1),
          department: z.string().trim().optional(),
          phone: z.string().trim().optional(),
        })).min(1, '최소 1명 이상이 필요합니다.'),
      }))
      .mutation(async ({ input }) => {
        const deduped = Array.from(new Map(
          input.payers
            .map((payer) => ({
              name: payer.name.trim(),
              studentId: payer.studentId.trim(),
              department: payer.department?.trim(),
              phone: payer.phone?.trim(),
            }))
            .filter((payer) => payer.name && payer.studentId)
            .map((payer) => [`${payer.name}::${payer.studentId}`, payer])
        ).values());

        await db.replaceAllFeePayers(deduped);
        return { success: true, count: deduped.length };
      }),

    getDashboard: publicProcedure.query(async () => {
      const [feePayers, items, rentals] = await Promise.all([
        db.getAllFeePayers(),
        db.getAllItems(),
        db.getRentalsOverview(),
      ]);

      const now = getEffectiveNow();
      const activeRentals = rentals
        .map((rental) => ({
          ...rental,
          computedStatus: !rental.returnedAt && new Date(rental.dueDate).getTime() < now.getTime() ? 'overdue' : rental.status,
        }))
        .filter((rental) => rental.status !== 'returned');

      const availableItems = await Promise.all(items.map(async (item) => {
        const quantity = item.quantity || 0;
        const activeNumbers = await db.getActiveItemNumbersByItemId(item.id);
        const availableNumbers = Array.from({ length: quantity }, (_, idx) => idx + 1).filter((num) => !activeNumbers.includes(num));
        return {
          ...item,
          activeNumbers,
          availableNumbers,
          availableCount: availableNumbers.length,
        };
      }));

      return {
        feePayers,
        items: availableItems,
        rentals: rentals.map((rental) => ({
          ...rental,
          computedStatus: !rental.returnedAt && new Date(rental.dueDate).getTime() < now.getTime() ? 'overdue' : rental.status,
        })),
        stats: {
          totalFeePayers: feePayers.length,
          activeRentals: activeRentals.length,
          overdueRentals: activeRentals.filter((rental) => rental.computedStatus === 'overdue').length,
          availableItems: availableItems.reduce((sum, item) => sum + item.availableCount, 0),
        },
      };
    }),

    create: memberProtectedProcedure
      .input(z.object({
        payerId: z.number(),
        itemId: z.number(),
        itemNumber: z.number().int().positive(),
        collateralType: z.string().trim().min(1).max(50),
        collateralDetail: z.string().trim().max(100).optional(),
        note: z.string().trim().max(500).optional(),
      }))
      .mutation(async ({ input }) => {
        const payer = await db.getFeePayerById(input.payerId);
        if (!payer || !payer.isActive) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '학생회비 납부자 명단에서 대상을 찾을 수 없습니다.' });
        }

        const item = await db.getAllItems().then((items) => items.find((row) => row.id === input.itemId));
        if (!item) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '대여 물품을 찾을 수 없습니다.' });
        }

        const quantity = item.quantity || 0;
        if (input.itemNumber < 1 || input.itemNumber > quantity) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '선택한 물품 번호가 유효하지 않습니다.' });
        }

        const existingPayerRental = await db.getActiveRentalByPayerId(input.payerId);
        if (existingPayerRental) {
          throw new TRPCError({ code: 'CONFLICT', message: '한 사람당 하나의 물품만 대여할 수 있습니다.' });
        }

        const existingNumberRental = await db.getActiveRentalByItemNumber(input.itemId, input.itemNumber);
        if (existingNumberRental) {
          throw new TRPCError({ code: 'CONFLICT', message: '해당 물품 번호는 현재 대여 중입니다.' });
        }

        const rentedAt = getEffectiveNow();
        const dueDate = new Date(rentedAt.getTime() + 3 * 24 * 60 * 60 * 1000);

        await db.createRental({
          payerId: input.payerId,
          itemId: input.itemId,
          itemNumber: input.itemNumber,
          collateralType: input.collateralType,
          collateralDetail: input.collateralDetail || null,
          note: input.note || null,
          rentedAt,
          dueDate,
          status: 'borrowed',
        });

        return { success: true };
      }),

    returnItem: memberProtectedProcedure
      .input(z.object({
        rentalId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const rental = await db.getRentalById(input.rentalId);
        if (!rental) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '대여 기록을 찾을 수 없습니다.' });
        }
        if (rental.returnedAt || rental.status === 'returned') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '이미 반납 처리된 기록입니다.' });
        }

        await db.updateRental(input.rentalId, {
          returnedAt: getEffectiveNow(),
          status: 'returned',
        });

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

    getScanInfo: publicProcedure
      .input(z.object({ qrCode: z.string().min(1, 'QR 코드가 필요합니다.') }))
      .query(async ({ input }) => {
        const activeQr = await db.getActiveQrSetting();
        if (!activeQr || activeQr.secretKey !== input.qrCode) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '유효하지 않은 QR 코드입니다.' });
        }

        const now = getEffectiveNow();
        const today = getKSTDateString(now);
        const currentSlot = getActiveCodeTimeSlot(now);
        const slotInfo = TIME_SLOTS.find((slot) => slot.slot === currentSlot) ?? null;
        const nextChangeTime = getNextCodeChangeTime(now);

        return {
          qrValid: true,
          currentCode: currentSlot ? generateTimeSlotPin(activeQr.secretKey, today, currentSlot) : null,
          currentTimeSlot: currentSlot,
          currentTimeSlotLabel: slotInfo?.label ?? null,
          currentDate: today,
          currentTimeLabel: getKSTDateTimeLabel(now),
          nextChangeTime: nextChangeTime?.toISOString() ?? null,
          nextChangeTimeLabel: nextChangeTime ? getKSTDateTimeLabel(nextChangeTime) : null,
        };
      }),

    verifyTimeBasedCode: publicProcedure
      .input(z.object({ qrCode: z.string().min(1), code: z.string().length(4) }))
      .query(async ({ input }) => {
        const activeQr = await db.getActiveQrSetting();
        if (!activeQr || activeQr.secretKey !== input.qrCode) {
          return { valid: false };
        }
        const now = getEffectiveNow();
        const today = getKSTDateString(now);
        const currentSlot = getActiveCodeTimeSlot(now);
        if (!currentSlot) {
          return { valid: false };
        }
        const expectedCode = generateTimeSlotPin(activeQr.secretKey, today, currentSlot);
        return { valid: input.code === expectedCode };
      }),

    getCurrentCode: adminProcedure.query(async () => {
      const activeQr = await db.getActiveQrSetting();
      if (!activeQr) {
        return {
          currentCode: null,
          nextCode: null,
          currentTime: getEffectiveNow().toISOString(),
          currentTimeLabel: getKSTDateTimeLabel(getEffectiveNow()),
          nextChangeTime: null,
          nextChangeTimeLabel: null,
          currentTimeSlotLabel: null,
        };
      }

      const now = getEffectiveNow();
      const today = getKSTDateString(now);
      const currentSlot = getActiveCodeTimeSlot(now);
      const slotInfo = TIME_SLOTS.find((slot) => slot.slot === currentSlot) ?? null;
      const nextChangeTime = getNextCodeChangeTime(now);
      const nextSlot = nextChangeTime ? getActiveCodeTimeSlot(new Date(nextChangeTime.getTime() + 60000)) : null;

      return {
        currentCode: currentSlot ? generateTimeSlotPin(activeQr.secretKey, today, currentSlot) : null,
        nextCode: nextSlot ? generateTimeSlotPin(activeQr.secretKey, today, nextSlot) : null,
        currentTime: now.toISOString(),
        currentTimeLabel: getKSTDateTimeLabel(now),
        nextChangeTime: nextChangeTime?.toISOString() ?? null,
        nextChangeTimeLabel: nextChangeTime ? getKSTDateTimeLabel(nextChangeTime) : null,
        currentTimeSlotLabel: slotInfo?.label ?? null,
      };
    }),

    forceGenerateCode: adminProcedure.mutation(async () => {
      const activeQr = await db.getActiveQrSetting();
      if (!activeQr) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '먼저 고정 QR 코드를 생성해주세요.' });
      }

      const now = getEffectiveNow();
      const today = getKSTDateString(now);
      const currentSlot = getActiveCodeTimeSlot(now);
      const slotInfo = TIME_SLOTS.find((slot) => slot.slot === currentSlot) ?? null;
      const nextChangeTime = getNextCodeChangeTime(now);
      const nextSlot = nextChangeTime ? getActiveCodeTimeSlot(new Date(nextChangeTime.getTime() + 60000)) : null;

      return {
        success: true,
        message: '고정 QR은 유지되고, 4자리 인증 코드는 평일 11:50부터 각 시간대 시작 10분 전에 미리 바뀝니다.',
        currentCode: currentSlot ? generateTimeSlotPin(activeQr.secretKey, today, currentSlot) : null,
        nextCode: nextSlot ? generateTimeSlotPin(activeQr.secretKey, today, nextSlot) : null,
        nextChangeTime: nextChangeTime?.toISOString() ?? null,
        currentTimeLabel: getKSTDateTimeLabel(now),
        nextChangeTimeLabel: nextChangeTime ? getKSTDateTimeLabel(nextChangeTime) : null,
        currentTimeSlotLabel: slotInfo?.label ?? null,
      };
    }),

  }),

  // ==================== Admin Time Control ====================
  admin: router({
    setTestTime: adminProcedure.input(z.object({
      date: z.string().optional(), // YYYY-MM-DD format
      time: z.string().optional(), // HH:mm format
    })).mutation(({ input }) => {
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

      const currentNow = getEffectiveNow();
      return {
        success: true,
        message: input.date && input.time ? '테스트 시간이 설정되었습니다.' : '현재 시간으로 리셋되었습니다.',
        currentTime: currentNow.toISOString(),
        currentTimeLabel: getKSTDateTimeLabel(currentNow),
        currentDate: getKSTDateString(currentNow),
        currentDayOfWeek: getKSTDayOfWeek(currentNow),
        isTestMode: typeof globalAny.testTimeMs === 'number',
      };
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
      const overallStats = await db.getOverallAttendanceStats();
      const presentRate = overallStats.total > 0 ? Math.round((overallStats.present / overallStats.total) * 100) : 0;
      const lateRate = overallStats.total > 0 ? Math.round((overallStats.late / overallStats.total) * 100) : 0;
      const absentRate = overallStats.total > 0 ? Math.round((overallStats.absent / overallStats.total) * 100) : 0;

      return {
        totalMembers: members.length,
        activeMembers,
        pendingSwapRequests: pendingSwaps.length,
        currentDateLabel: now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' }),
        todayStats: {
          present: presentToday,
          late: lateToday,
          absent: absentToday,
          total: todayAttendances.length,
        },
        attendanceStats: {
          ...overallStats,
          presentRate,
          lateRate,
          absentRate,
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
