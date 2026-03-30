import { eq, and, gte, lte, desc, asc, sql, inArray, isNull, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  members, InsertMember, Member,
  attendances, InsertAttendance, Attendance,
  schedules, InsertSchedule, Schedule,
  swapRequests, InsertSwapRequest, SwapRequest,
  items, InsertItem, Item,
  feePayers, InsertFeePayer, FeePayer,
  rentals, InsertRental, Rental,
  manuals, InsertManual, Manual,
  qrSettings, InsertQrSetting, QrSetting
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== User Functions ====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ==================== Member Functions ====================
export async function createMember(member: InsertMember) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(members).values(member);
  return result;
}

export async function getMemberByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(members).where(eq(members.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getMemberById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(members).where(eq(members.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}



export async function getMembersByApprovalStatus(status: "pending" | "approved" | "rejected") {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(members)
    .where(eq(members.approvalStatus, status))
    .orderBy(desc(members.createdAt));
}
export async function getAllMembers() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(members).orderBy(desc(members.createdAt));
}

export async function updateMember(id: number, data: Partial<InsertMember>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(members).set(data).where(eq(members.id, id));
}

export async function deleteMember(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(members).where(eq(members.id, id));
}

// ==================== Attendance Functions ====================
export async function createAttendance(attendance: InsertAttendance) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(attendances).values(attendance);
  return result;
}

export async function getAttendanceByMemberAndDate(memberId: number, date: string, timeSlot: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(attendances)
    .where(and(
      eq(attendances.memberId, memberId),
      sql`${attendances.date} = ${date}`,
      eq(attendances.timeSlot, timeSlot)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateAttendance(id: number, data: Partial<InsertAttendance>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(attendances).set(data).where(eq(attendances.id, id));
}

export async function getAttendancesByMember(memberId: number, startDate?: string, endDate?: string) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(attendances).where(eq(attendances.memberId, memberId));
  
  return await query.orderBy(desc(attendances.date));
}

export async function getAttendancesByDate(date: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(attendances)
    .where(sql`${attendances.date} = ${date}`)
    .orderBy(asc(attendances.timeSlot));
}

export async function getAllAttendances(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(attendances)
    .orderBy(desc(attendances.date), asc(attendances.timeSlot))
    .limit(limit);
}

// ==================== Schedule Functions ====================
export async function createSchedule(schedule: InsertSchedule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(schedules).values(schedule);
  return result;
}

export async function getSchedulesByMember(memberId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(schedules)
    .where(and(eq(schedules.memberId, memberId), eq(schedules.isActive, true)))
    .orderBy(asc(schedules.dayOfWeek), asc(schedules.timeSlot));
}

export async function getSchedulesByDay(dayOfWeek: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(schedules)
    .where(and(eq(schedules.dayOfWeek, dayOfWeek), eq(schedules.isActive, true)))
    .orderBy(asc(schedules.timeSlot));
}

export async function getSchedulesByDate(date: string) {
  const db = await getDb();
  if (!db) return [];
  
  // date를 기반으로 요일 계산 (1: 월, 2: 화, 3: 수, 4: 목, 5: 금)
  const dateObj = new Date(date + 'T00:00:00Z');
  const utcDay = dateObj.getUTCDay();
  const dayOfWeek = utcDay === 0 ? 7 : utcDay; // 일요일(0)을 7로 변환
  
  // 월~금만 (1~5)
  if (dayOfWeek < 1 || dayOfWeek > 5) return [];
  
  return await db.select().from(schedules)
    .where(and(eq(schedules.dayOfWeek, dayOfWeek), eq(schedules.isActive, true)))
    .orderBy(asc(schedules.timeSlot));
}

export async function getAllSchedules() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(schedules)
    .where(eq(schedules.isActive, true))
    .orderBy(asc(schedules.dayOfWeek), asc(schedules.timeSlot));
}

export async function updateSchedule(id: number, data: Partial<InsertSchedule>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(schedules).set(data).where(eq(schedules.id, id));
}

export async function deleteSchedule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(schedules).where(eq(schedules.id, id));
}

// ==================== Swap Request Functions ====================
export async function createSwapRequest(request: InsertSwapRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(swapRequests).values(request);
  return result;
}

export async function getSwapRequestById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(swapRequests).where(eq(swapRequests.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getSwapRequestsByMember(memberId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(swapRequests)
    .where(eq(swapRequests.requesterId, memberId))
    .orderBy(desc(swapRequests.createdAt));
}

export async function getPendingSwapRequests() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(swapRequests)
    .where(eq(swapRequests.status, "pending"))
    .orderBy(desc(swapRequests.createdAt));
}

export async function getAllSwapRequests(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(swapRequests)
    .orderBy(desc(swapRequests.createdAt))
    .limit(limit);
}

export async function updateSwapRequest(id: number, data: Partial<InsertSwapRequest>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(swapRequests).set(data).where(eq(swapRequests.id, id));
}

// ==================== Item Functions ====================
export async function createItem(item: InsertItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(items).values(item);
  return result;
}

export async function getAllItems() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(items).orderBy(asc(items.category), asc(items.name));
}

export async function getItemsByCategory(category: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(items)
    .where(eq(items.category, category))
    .orderBy(asc(items.name));
}

export async function updateItem(id: number, data: Partial<InsertItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(items).set(data).where(eq(items.id, id));
}

export async function deleteItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(items).where(eq(items.id, id));
}


// ==================== Fee Payer Functions ====================
export async function replaceAllFeePayers(payers: Array<Pick<InsertFeePayer, 'name' | 'studentId' | 'department' | 'phone'>>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.delete(feePayers);
  if (payers.length === 0) return;

  await db.insert(feePayers).values(
    payers.map((payer) => ({
      name: payer.name.trim(),
      studentId: payer.studentId.trim(),
      department: payer.department?.trim() || null,
      phone: payer.phone?.trim() || null,
      isActive: true,
    }))
  );
}

export async function getAllFeePayers() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(feePayers)
    .where(eq(feePayers.isActive, true))
    .orderBy(asc(feePayers.name), asc(feePayers.studentId));
}

export async function getFeePayerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db.select().from(feePayers).where(eq(feePayers.id, id)).limit(1);
  return rows[0];
}

// ==================== Rental Functions ====================
export async function createRental(rental: InsertRental) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const result = await db.insert(rentals).values(rental);
  return result;
}

export async function updateRental(id: number, data: Partial<InsertRental>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.update(rentals).set(data).where(eq(rentals.id, id));
}

export async function getRentalById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db.select().from(rentals).where(eq(rentals.id, id)).limit(1);
  return rows[0];
}

export async function getActiveRentalByPayerId(payerId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db.select().from(rentals)
    .where(and(eq(rentals.payerId, payerId), inArray(rentals.status, ['borrowed', 'overdue'] as const), isNull(rentals.returnedAt)))
    .orderBy(desc(rentals.rentedAt))
    .limit(1);
  return rows[0];
}

export async function getActiveRentalByItemNumber(itemId: number, itemNumber: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db.select().from(rentals)
    .where(and(
      eq(rentals.itemId, itemId),
      eq(rentals.itemNumber, itemNumber),
      inArray(rentals.status, ['borrowed', 'overdue'] as const),
      isNull(rentals.returnedAt),
    ))
    .limit(1);
  return rows[0];
}

export async function getRentalsOverview() {
  const db = await getDb();
  if (!db) return [];

  return await db.select({
      id: rentals.id,
      payerId: rentals.payerId,
      itemId: rentals.itemId,
      itemNumber: rentals.itemNumber,
      collateralType: rentals.collateralType,
      collateralDetail: rentals.collateralDetail,
      note: rentals.note,
      rentedAt: rentals.rentedAt,
      dueDate: rentals.dueDate,
      returnedAt: rentals.returnedAt,
      status: rentals.status,
      payerName: feePayers.name,
      payerStudentId: feePayers.studentId,
      payerDepartment: feePayers.department,
      payerPhone: feePayers.phone,
      itemName: items.name,
      itemCategory: items.category,
    })
    .from(rentals)
    .leftJoin(feePayers, eq(rentals.payerId, feePayers.id))
    .leftJoin(items, eq(rentals.itemId, items.id))
    .orderBy(desc(rentals.rentedAt));
}

export async function getActiveItemNumbersByItemId(itemId: number) {
  const db = await getDb();
  if (!db) return [] as number[];

  const rows = await db.select({ itemNumber: rentals.itemNumber }).from(rentals)
    .where(and(eq(rentals.itemId, itemId), inArray(rentals.status, ['borrowed', 'overdue'] as const), isNull(rentals.returnedAt)));
  return rows.map((row) => row.itemNumber).sort((a, b) => a - b);
}

export async function countActiveRentalsByItemId(itemId: number) {
  const db = await getDb();
  if (!db) return 0;

  const rows = await db.select({ count: sql<number>`count(*)` }).from(rentals)
    .where(and(eq(rentals.itemId, itemId), inArray(rentals.status, ['borrowed', 'overdue'] as const), isNull(rentals.returnedAt)));
  return Number(rows[0]?.count || 0);
}

// ==================== Manual Functions ====================
export async function createManual(manual: InsertManual) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(manuals).values(manual);
  return result;
}

export async function getAllManuals() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(manuals)
    .where(eq(manuals.isPublished, true))
    .orderBy(asc(manuals.category), asc(manuals.orderIndex));
}

export async function getManualsByCategory(category: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(manuals)
    .where(and(eq(manuals.category, category), eq(manuals.isPublished, true)))
    .orderBy(asc(manuals.orderIndex));
}

export async function updateManual(id: number, data: Partial<InsertManual>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(manuals).set(data).where(eq(manuals.id, id));
}

export async function deleteManual(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(manuals).where(eq(manuals.id, id));
}

// ==================== QR Settings Functions ====================
export async function getActiveQrSetting() {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(qrSettings)
    .where(eq(qrSettings.isActive, true))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createQrSetting(setting: InsertQrSetting) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(qrSettings).values(setting);
  return result;
}

export async function updateQrSetting(id: number, data: Partial<InsertQrSetting>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(qrSettings).set(data).where(eq(qrSettings.id, id));
}

// ==================== Statistics Functions ====================
export async function getAttendanceStats(memberId: number) {
  const db = await getDb();
  if (!db) return { present: 0, late: 0, absent: 0, total: 0 };
  
  const result = await db.select({
    status: attendances.status,
    count: sql<number>`count(*)`.as('count')
  })
    .from(attendances)
    .where(eq(attendances.memberId, memberId))
    .groupBy(attendances.status);
  
  const stats = { present: 0, late: 0, absent: 0, total: 0 };
  result.forEach(row => {
    if (row.status === 'present') stats.present = Number(row.count);
    else if (row.status === 'late') stats.late = Number(row.count);
    else if (row.status === 'absent') stats.absent = Number(row.count);
  });
  stats.total = stats.present + stats.late + stats.absent;
  
  return stats;
}


export async function getOverallAttendanceStats() {
  const db = await getDb();
  if (!db) return { present: 0, late: 0, absent: 0, total: 0 };

  const result = await db.select({
    status: attendances.status,
    count: sql<number>`count(*)`.as('count')
  })
    .from(attendances)
    .groupBy(attendances.status);

  const stats = { present: 0, late: 0, absent: 0, total: 0 };
  result.forEach(row => {
    if (row.status === 'present') stats.present = Number(row.count);
    else if (row.status === 'late') stats.late = Number(row.count);
    else if (row.status === 'absent') stats.absent = Number(row.count);
  });
  stats.total = stats.present + stats.late + stats.absent;

  return stats;
}
