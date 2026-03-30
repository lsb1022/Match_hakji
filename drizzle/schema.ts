import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, date, time } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 학생회실 지킴이 회원 테이블
 * 관리자가 생성한 계정 정보 저장
 */
export const members = mysqlTable("members", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  department: varchar("department", { length: 100 }),
  studentId: varchar("studentId", { length: 20 }),
  approvalStatus: mysqlEnum("approvalStatus", ["pending", "approved", "rejected"]).default("approved").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Member = typeof members.$inferSelect;
export type InsertMember = typeof members.$inferInsert;

/**
 * 출석 기록 테이블
 * 학생회실 지킴이 출석 체크 기록
 */
export const attendances = mysqlTable("attendances", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull(),
  date: date("date").notNull(),
  timeSlot: int("timeSlot").notNull(), // 1: 12:00-13:30, 2: 13:30-15:00, 3: 15:00-16:30, 4: 16:30-18:00
  checkInTime: timestamp("checkInTime"),
  status: mysqlEnum("status", ["present", "late", "absent"]).default("absent").notNull(),
  qrVerified: boolean("qrVerified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Attendance = typeof attendances.$inferSelect;
export type InsertAttendance = typeof attendances.$inferInsert;

/**
 * 지킴이 스케줄 테이블
 * 각 시간대별 담당자 배정
 */
export const schedules = mysqlTable("schedules", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull(),
  dayOfWeek: int("dayOfWeek").notNull(), // 1: 월, 2: 화, 3: 수, 4: 목, 5: 금
  timeSlot: int("timeSlot").notNull(), // 1: 12:00-13:30, 2: 13:30-15:00, 3: 15:00-16:30, 4: 16:30-18:00
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = typeof schedules.$inferInsert;

/**
 * 교대/대타 신청 테이블
 */
export const swapRequests = mysqlTable("swapRequests", {
  id: int("id").autoincrement().primaryKey(),
  requesterId: int("requesterId").notNull(), // 교대 요청자
  targetId: int("targetId"), // 대타 대상자 (null이면 대타 모집)
  originalDate: date("originalDate").notNull(),
  originalTimeSlot: int("originalTimeSlot").notNull(),
  swapDate: date("swapDate"), // 교대 날짜 (대타면 null)
  swapTimeSlot: int("swapTimeSlot"), // 교대 시간대 (대타면 null)
  requestType: mysqlEnum("requestType", ["swap", "substitute"]).notNull(), // swap: 교대, substitute: 대타
  status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled"]).default("pending").notNull(),
  reason: text("reason"),
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SwapRequest = typeof swapRequests.$inferSelect;
export type InsertSwapRequest = typeof swapRequests.$inferInsert;

/**
 * 물품 위치 테이블
 */
export const items = mysqlTable("items", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  location: varchar("location", { length: 200 }).notNull(),
  description: text("description"),
  quantity: int("quantity").default(1).notNull(),
  imageUrl: varchar("imageUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Item = typeof items.$inferSelect;
export type InsertItem = typeof items.$inferInsert;


/**
 * 학생회비 납부자 테이블
 */
export const feePayers = mysqlTable("feePayers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  studentId: varchar("studentId", { length: 30 }).notNull(),
  department: varchar("department", { length: 100 }),
  phone: varchar("phone", { length: 30 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FeePayer = typeof feePayers.$inferSelect;
export type InsertFeePayer = typeof feePayers.$inferInsert;

/**
 * 대여사업 대여 기록 테이블
 */
export const rentals = mysqlTable("rentals", {
  id: int("id").autoincrement().primaryKey(),
  payerId: int("payerId").notNull(),
  itemId: int("itemId").notNull(),
  itemNumber: int("itemNumber").notNull(),
  collateralType: varchar("collateralType", { length: 50 }).notNull(),
  collateralDetail: varchar("collateralDetail", { length: 100 }),
  note: text("note"),
  rentedAt: timestamp("rentedAt").defaultNow().notNull(),
  dueDate: timestamp("dueDate").notNull(),
  returnedAt: timestamp("returnedAt"),
  status: mysqlEnum("status", ["borrowed", "returned", "overdue"]).default("borrowed").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Rental = typeof rentals.$inferSelect;
export type InsertRental = typeof rentals.$inferInsert;

/**
 * 메뉴얼 테이블
 */
export const manuals = mysqlTable("manuals", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  orderIndex: int("orderIndex").default(0).notNull(),
  isPublished: boolean("isPublished").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Manual = typeof manuals.$inferSelect;
export type InsertManual = typeof manuals.$inferInsert;

/**
 * QR 코드 설정 테이블
 */
export const qrSettings = mysqlTable("qrSettings", {
  id: int("id").autoincrement().primaryKey(),
  secretKey: varchar("secretKey", { length: 100 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  lastRotated: timestamp("lastRotated").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QrSetting = typeof qrSettings.$inferSelect;
export type InsertQrSetting = typeof qrSettings.$inferInsert;
