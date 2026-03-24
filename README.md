# 학생회실 지킴이 (Hakji)

숭실대학교 글로벌미디어학부 학생회실 운영을 위한  
출석 관리 · 교대/대타 · QR 인증 시스템


## 제작자
- 제23대 글로벌미디어학부 학생회장 이승빈

---

# 프로젝트 소개

학생회실 지킴이 앱은 학생회실 운영 과정에서 발생하는  
근무 관리, 출석 체크, 교대/대타 처리의 비효율을 해결하기 위해 제작된 웹 서비스입니다.

기존에는 관리되지 않던 학지의 출석 기록을  
QR 기반 자동화 시스템으로 전환하여  
운영 효율성과 정확성을 향상시키기 위해 제작하였습니다.


## 주요 기능

- 출석 시스템  
  고정 QR 스캔 → 시간대별 4자리 코드 생성  
  10분 전부터 출석 가능  
  출석 상태 자동 판정: 출석 / 지각(n분 표시) / 결석(80분 기준)

- 다중 담당자 지원  
  한 시간대 최대 2명 배정 가능  
  출석 시 여러 담당자 표시

- 교대 / 대타 시스템  
  이번주 / 다음주 일정 기반 선택  
  교대: 특정 상대 지정 교환  
  대타: 선택한 대타 인원으로 교체  
  승인 시 실제 스케줄 자동 반영

- 주간 스케줄  
  이번주 기준 스케줄 표시  
  날짜 포함  
  담당자 다중 표시  
  미배정 슬롯: 미배정

- 출석 통계  
  관리자 대시보드 제공: 출석률 / 지각률 / 결석률  
  회원별 통계 확인 가능

- 회원가입 & 승인 시스템  
  사용자: 회원가입 신청  
  관리자: 승인 / 거절 관리

- 관리자 기능  
  스케줄 관리  
  교대/대타 승인  
  QR 코드 관리  
  출석 로그 확인


## 기술 스택

- Frontend  
  React + TypeScript  
  Vite  
  Tailwind CSS  
  shadcn/ui  
  Radix UI  

- Backend  
  Node.js  
  Express  
  tRPC  

- Database  
  MySQL  
  Drizzle ORM  

- Infra  
  AWS EC2  
  Nginx  
  PM2  


## 배포 방법

1. EC2 환경 준비  
   Ubuntu 22.04  
   Node.js 20+  
   MySQL 설치  

2. 프로젝트 클론  
   git clone https://github.com/your-repo.git  
   cd project  

3. 환경 변수 설정  
   NODE_ENV=production  
   PORT=3000  

   DATABASE_URL=mysql://user:Mysql비밀번호@localhost:3306/hakji  

   MEMBER_SESSION_SECRET=랜덤값  
   ADMIN_SESSION_SECRET=랜덤값  

   ADMIN_USERNAME=admin  
   ADMIN_PASSWORD=비밀번호  

4. 실행  
   pnpm install  
   pnpm db:push  
   pnpm build  
   pm2 start "pnpm start" --name hakji  

5. Nginx 설정  


server {
listen 80;
server_name your-domain.com;

location / {
    proxy_pass http://localhost:3000;
  }
}


### 개발 실행

pnpm install  
pnpm db:push  
pnpm dev  


### 보안 설계

세션 기반 인증  
관리자 단일 계정 체계  
QR + 시간 코드 이중 검증  
중복 출석 방지  
서버 기준 시간 판정  


# 프로젝트 구조

client/  
  ├─ pages/  
  ├─ components/  
  ├─ hooks/  

server/  
  ├─ routers/  
  ├─ _core/  
  ├─ db/  

drizzle/  
  ├─ schema.ts  
  ├─ migrations/  


# 커밋 컨벤션

[FEAT] - 새로운 기능 추가  
[STYLE] - css 수정 및 코드의 의미에 영향을 미치지 않는 변경사항  
[FIX] - 버그 수정  
[REFACTOR] - 리팩토링, 기능 변화 없이 코드 구조 개선  
[CHORE] - 코드 수정 외 잡다한 작업 (빌드 과정이나 설정 변경 등)  
[DOCS] - 문서 변경  
[TEST] - 테스트 코드 추가 또는 수정  
[RENAME] - 파일, 폴더, 변수 등 이름 변경  
[REMOVE] - 파일, 폴더, 변수 등 삭제  
[COMMENT] - 주석 추가, 삭제, 수정  
