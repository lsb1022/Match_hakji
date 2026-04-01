# 🛡️ Hakji — 학생회실 지킴이

> 숭실대학교 글로벌미디어학부 학생회실 운영을 위한  
> **통합 근무 · 출석 · 대여 관리 시스템**

---

### 👨‍💻 Author
이승빈
숭실대학교 글로벌미디어학부
제23대 학생회장


## 📌 Overview

**Hakji**는 학생회실 운영 과정에서 발생하는  
출석 관리, 근무 스케줄, 교대/대타, 물품 대여 등 다양한 운영 업무를  
자동화하기 위해 개발된 웹 서비스입니다.

기존의 비체계적인 관리 방식에서 벗어나  
**QR 기반 출석 + 대여사업 관리**를 도입했습니다.


## 🚀 Key Features

### 📍 Attendance

- 고정 QR 코드 스캔 → 시간대별 **4자리 인증 코드 생성**
- 출석 가능 시간: **시작 10분 전 ~ 정시**
- 자동 판정:
  - ✅ 출석
  - 🟠 지각 (n분 표시)
  - 🔴 결석 (80분 기준)
- 서버 시간 기준 판정
- 중복 출석 방지

---

### 👥 다중 담당자 근무 시스템

- 한 시간대 최대 **2명 담당자 배정**

---

### 🔄 교대 / 대타 시스템

#### 교대
- 특정 인원 간 일정 교환

#### 대타
- 지정 인원으로 대체 근무

#### 공통
- **이번주 / 다음주 스케줄 기반 선택**
- 관리자 승인 후 실제 스케줄 자동 반영

---

### 📅 주간 스케줄

- 이번주 기준 스케줄 표시
- 날짜 + 시간대 + 담당자 구조
- 다중 담당자 지원
- 미배정 슬롯 처리

---

### 📊 출석 통계

관리자 기능:
- 출석률 / 지각률 / 결석률
- 사용자별 통계
- 출석 로그 조회

---

### 👤 회원 관리

- 회원가입 신청
- 관리자 승인 / 거절
- 계정 관리

---

### 🧾 대여 사업 관리 시스템

- 물품 등록 및 관리
- 물품 개별 번호 관리
- 대여자 관리
- 대여 / 반납 / 연체 상태 관리
- 담보 정보 기록
- 반납 처리 및 상태 자동 변경

#### 특징

- 이미 대여된 물품 번호는 선택 불가
- 상태 자동 관리:
  - `borrowed`
  - `returned`
  - `overdue`

---

## 🔐 Security

- 세션 기반 인증 (User / Admin 분리)
- 관리자 단일 계정 체계
- QR + 시간 코드 이중 검증
- 서버 기준 시간 판정
- 인증 우회 방지

---

## 🧱 Tech Stack

### Frontend
- React + TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Radix UI

### Backend
- Node.js
- Express
- tRPC

### Database
- MySQL
- Drizzle ORM

### Infra
- AWS EC2 (Ubuntu 22.04)
- Nginx
- PM2

---

## ⚙️ Deployment

### 1. EC2 환경 구성
- Ubuntu 22.04
- Node.js 20+
- MySQL

---

### 2. 프로젝트 설치
```bash
git clone https://github.com/your-repo.git
cd project
pnpm install
```

### 3. 환경 변수 설정 (.env)
```bash
NODE_ENV=production
PORT=3000

DATABASE_URL=mysql://user:password@localhost:3306/hakji

MEMBER_SESSION_SECRET=your_secret
ADMIN_SESSION_SECRET=your_secret

ADMIN_USERNAME=admin
ADMIN_PASSWORD=password
```

### 4. DB 마이그레이션
```bash
pnpm db:push
```

### 5. 실행
```bash
pnpm build
pm2 start "pnpm start" --name hakji
```

### 6. Nginx 설정
```bash
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
    }
}
```

### 🧪 Development
```bash
pnpm install
pnpm db:push
pnpm dev
```

### 🧠 Design Philosophy
- 사용자 입력 기반 판정 최소화
- 서버 기준 자동 판정
- 상태 기반 시스템 설계
- 운영 효율 최적화

### 🔥 Core Differentiation
- QR + 시간 기반 이중 인증 출석 시스템
- 교대/대타 → 실제 스케줄 자동 반영
- 대여 관리 → 상태 기반 자동 처리
- 운영 데이터 → 통계화 가능 구조

### 📝 Commit Convention
```
[FEAT]     새로운 기능
[FIX]      버그 수정
[REFACTOR] 구조 개선
[STYLE]    스타일 수정
[DOCS]     문서 변경
[TEST]     테스트
[CHORE]    기타 작업
[RENAME]   이름 변경
[REMOVE]   삭제
[COMMENT]  주석 수정
```

### 📌 Future Improvements
- 실시간 알림 시스템 (WebSocket)
- 모바일 UX 개선
- 권한 레벨 확장
- 데이터 시각화 고도화
- API Rate Limiting
