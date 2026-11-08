# 강의 준비 보드

강의 준비 과정을 한곳에서 관리하는 웹 앱이다. PRD F1~F8이 모두 들어가 있다:
구글 로그인과 팀 관리(F1), 홈·과정 복제(F2), 과정 칸반 보드와 체크리스트(F3), 재료함(F4), 받아쓰기(F5),
AI 초안(F6), 결과물과 PPT·PDF 내보내기(F7), 팀 캘린더와 리허설·회의 일정(F8),
교안 올리면 카드 자동 이동과 최근 활동(F9·L7, 2026-10-25 추가, Firebase Functions).
PRD 밖에서 추가한 기능 (2026-10-13 사용자 요청): **강사료 입금관리**(과정 탭 "강사료"와 `/fees`, 금액은 강사 본인과 관리자만 봄),
**고객사 주소록**(`/clients`, 과정과는 고객사 이름으로 연결), **강의 전날·미입금 알림**(앱 안 종 모양 알림 + 매일 아침 9시쯤 Gmail 메일).

**파일 저장소(Firebase Storage)는 카드 첨부 파일에만 쓴다** (2026-10-13엔 Firestore만 쓰기로 했다가, 2026-10-25 사용자가 Storage를 켜고 카드 첨부를 요청).
- **카드 첨부 파일**: 카드 추가 칸과 카드 상세에서 올린다. 파일은 Storage `materials/{올린 사람 uid}/{과정}/{카드}/{파일id}/{이름}`
  (2026-10-25 이전 파일은 `courses/{과정}/cardFiles/{파일id}/{이름}`, 열기·지우기만 됨), 목록 정보는 Firestore `courses/{과정}/cardFiles`.
  교안(PPT·PPTX·PDF)이면 서버 함수 `onLectureUploaded`가 카드를 리허설 단계로 옮기고 `activity`에 기록한다 (`functions/`).
  하나에 100MB, 카드당 20개, 허용 형식은 `lib/domain/cardFiles.ts`의 `CARD_FILE_TYPES`(PDF·PPT·워드·한글·엑셀·이미지·음성·ZIP). 과정 복제 때는 복사하지 않는다.
- 그 밖의 곳은 여전히 Firestore만 쓴다. 그래서 PRD와 다르게 만든 곳이 있다.
- 재료함에는 음성·문서 파일을 올리지 않는다. 구글 드라이브 같은 곳에 두고 **링크**로 남긴다. 결과물 최종본도 링크로 남긴다.
- 받아쓰기는 녹음 파일 대신 **브라우저 받아쓰기**(Web Speech API, 크롬·엣지·사파리)로 말하는 대로 글자로 바꾼다.
- AI 초안은 앱이 AI를 직접 부르지 않는다. 앱이 **요청문을 만들어 주면** 강사가 Claude·ChatGPT 웹에 붙여 넣고 답을 다시 붙여 넣는다 (API 키·사용료 없음).
- PPT는 브라우저에서 pptxgenjs로 만들고, PDF는 인쇄 화면에서 "PDF로 저장"한다.

무엇을 만들지는 `PRD.md`에 정리되어 있다. 기능을 만들거나 바꾸기 전에 해당 부분을 먼저 확인한다.
화면 디자인은 `design.md`(색·글꼴·버튼·카드 기준)를 따른다. 문서에 없는 색이나 모양이 필요하면 먼저 묻는다.

@AGENTS.md

## 기술 구성

| 도구 | 하는 일 | 상태 |
|---|---|---|
| Next.js 16 (App Router) | 화면과 서버 기능을 함께 만드는 틀. 화면 파일은 `app/` 폴더에 둔다 | 설치됨 |
| Tailwind CSS 4 | `className`에 클래스 이름을 적어 바로 스타일을 입히는 도구 | 설치됨 |
| Firebase 13 | 구글 로그인(Auth), 데이터 저장(Firestore), 카드 첨부 파일 저장(Storage, `lib/firebase/storage.ts`). 프로젝트 `edu-project-f1d12` | 설치됨 |
| Vercel | 인터넷에 배포. 운영 주소 `edu-project-beta.vercel.app`, `main`에 올리면 자동 배포 | 연결됨 |
| @dnd-kit/react 0.5 | 칸반 카드를 끌어서 옮기기. 1.0 전 버전이라 API가 바뀔 수 있어 쓰기 전에 문서를 확인한다 | 설치됨 |
| Vitest | 테스트 실행 도구 | 설치됨 |
| pptxgenjs 4 | 결과물을 PPT 파일로 만들기. 버튼을 누를 때만 브라우저가 내려받는다 (`components/outputs/exportPptx.ts`) | 설치됨 |
| firebase-admin 14 | 서버에서 Firestore를 읽는 도구 (보안 규칙을 거치지 않는다). 매일 알림 메일 작업에만 쓴다 (`lib/server/`) | 설치됨 |
| nodemailer 10 | Gmail(owner@example.com, 앱 비밀번호)로 알림 메일 보내기 | 설치됨 |
| Vercel Cron | 정해진 시각에 서버 경로를 자동 실행. `vercel.json`에서 매일 00:00 UTC(한국 9시)에 `/api/cron/daily` | 설정됨 |
| Firebase Functions 2세대 (firebase-functions 7) | Google 서버에서 자동으로 도는 함수. `functions/` 폴더(자체 package.json·tsconfig, Node 22)에 있고 Vercel이 아니라 Firebase에 따로 배포한다. 지역은 버킷과 같은 us-east1이어야 한다 | 설치됨 |

- 패키지 관리는 **npm**으로 한다.
  - `npm run dev` — 개발 서버 실행 (http://localhost:3000, 쓰고 있으면 3001)
  - `npm run build` — 배포 전에 빌드가 깨지지 않는지 확인
  - `npm run lint` — 코드 검사
  - `npm run typecheck` — 타입 검사
  - `npm test` — 단위 테스트 (`tests/unit/`, `components/**/*.test.ts`)
  - `npm run test:rules` — Firestore·Storage 보안 규칙 테스트. 가짜 Firestore·Storage 서버(에뮬레이터)에서 돌린다 (Java 필요)
  - `npm --prefix functions run build` — 서버 함수 빌드. 판단 규칙(`functions/src/lectureRules.ts`)의 테스트는 루트 `npm test`에 들어 있다
- 보안 규칙(`firestore.rules`, `storage.rules`)은 고친 뒤 `npm run test:rules`로 확인하고, 실제 프로젝트에는
  `firebase deploy --only firestore:rules,firestore:indexes,storage --project edu-project-f1d12 --account owner@example.com`으로 올린다.
  서버 함수는 `--only functions`로 올린다 (첫 배포 때 Google Cloud 기능이 켜지고 빌드 이미지 정리 기간을 묻는다 → 1일).
  `storage.rules`는 Firestore의 팀원·과정 문서를 읽으므로(교차 서비스 규칙) 처음 올릴 때 권한을 줄지 묻는다. 한 번 검사에 Firestore 문서는 2개까지만 읽을 수 있다.
  - **배포 명령은 사용자가 Claude Code 밖의 일반 PowerShell 창에서 직접 실행하도록 안내한다.** Claude Code 안전 검사에 막히고,
    `!`로 실행하면 입력을 받을 수 없어 Firebase CLI가 질문(교차 서비스 권한 등)을 묻지 않고 건너뛴다 (2026-10-25 Storage 규칙이 그래서 동작하지 않았다).
  - 올라간 규칙·권한 상태를 확인할 때는 Firebase CLI 로그인을 그대로 쓰는 읽기 전용 스크립트로 Rules API를 조회한다 (바꾸지 않는다).
- Next.js 16은 예전 버전과 API가 많이 다르다. 코드를 쓰기 전에
  `node_modules/next/dist/docs/`의 해당 문서를 먼저 확인한다 (위 `AGENTS.md` 내용).

## 일하는 방식

### 1. 설명은 쉬운 한국어로 한다

- 사용자는 개발자가 아니다. 모든 설명·질문·보고를 쉬운 한국어로 쓴다.
- 전문 용어가 처음 나오면 **무엇인지 / 없으면 무슨 일이 생기는지 / 여기서 어디에 쓰는지**를
  짧게 붙인다. 한 번 설명한 용어는 다시 설명하지 않는다.
- 보고할 때는 "무슨 코드를 고쳤는지"보다 **"화면이나 사용자에게 무엇이 달라지는지"**를 먼저 말한다.

### 2. 큰 변경 전에는 계획부터 보여준다

아래에 해당하면 **바로 고치지 말고 계획을 먼저 보여주고, 사용자가 좋다고 한 뒤 시작한다.**

- 파일 3개 이상을 새로 만들거나 고치는 작업
- 새 패키지 설치
- Firebase 데이터 구조(컬렉션·필드)나 보안 규칙 변경
- 로그인·권한·배포 설정 변경
- 파일이나 데이터를 지우는 작업

계획에는 다음을 적는다.

1. 무엇을, 왜 바꾸는지
2. 바뀌는 파일 목록
3. 사용자 입장에서 달라지는 점
4. 위험한 점과 되돌리는 방법

오타·문구·색상 하나 같은 작은 수정은 계획 없이 바로 해도 된다.

### 3. 비밀 정보는 올리지 않는다

- 비밀값은 **`.env.local` 파일에만** 적는다. `.gitignore`에 `.env*`가 들어 있어 Git에 올라가지 않는다.
- 코드·문서·커밋 메시지에 비밀값을 직접 적지 않는다.
- 배포 환경의 값은 Vercel 대시보드의 Environment Variables에 따로 넣는다.
- 환경 변수를 새로 만들면 **값은 비우고 이름만 적은 `.env.example`**을 만들거나 갱신한다.
  (`.gitignore`가 `.env*`를 전부 막으므로, 처음 만들 때 `!.env.example` 줄을 추가해 이 파일만 올라가게 한다.)
- Firebase 값은 두 종류로 구분한다.
  - **웹 설정값**(apiKey, projectId 등): 원래 브라우저로 내려가는 공개용 값이라 노출 자체는 위험하지 않다.
    `NEXT_PUBLIC_FIREBASE_*` 이름으로 `.env.local`에 둔다. 실제 데이터 보호는 Firestore 보안 규칙이 한다.
  - **서비스 계정 키(JSON 파일), Admin SDK 비밀키**: 절대 Git에 올리지 않는다.
    이름 앞에 `NEXT_PUBLIC_`을 붙이지 않는다 (붙이면 브라우저에 그대로 노출된다).
- 알림 메일용 서버 비밀값은 **Vercel 환경 변수(Production)에만** 둔다: `FIREBASE_SERVICE_ACCOUNT`(서비스 계정 키 JSON),
  `GMAIL_USER`, `GMAIL_APP_PASSWORD`(Gmail 앱 비밀번호), `CRON_SECRET`(예약 작업 호출 확인용). 설정 방법은 `docs/알림-메일-설정.md`.
  Claude는 이 값들을 직접 만들거나 입력하지 않고, 사용자가 넣도록 안내한다.
- 커밋 전에 `git status`로 `.env` 파일이나 키 파일이 섞여 있지 않은지 확인한다.
- 실수로 올렸다면 파일을 지우는 것으로는 부족하다 (Git 기록에 남는다). **그 키를 즉시 폐기하고 새로 발급**한다.

## 코드 작성 원칙

상세 지침은 아래 문서를 따른다. 이 프로젝트에서 특히 챙길 것은 다음과 같다.

- **Firestore 보안 규칙이 곧 서버 검증이다.** 브라우저가 Firestore에 직접 쓰므로 규칙이 뚫리면 화면을 거치지 않고
  데이터를 고칠 수 있다. 초대된 팀원(`members/{이메일}`)만 읽고 쓰고, 칸 목록·형식·길이를 규칙에서 다시 검사한다.
  데이터 구조나 검사 조건을 바꾸면 `lib/domain/validation.ts`의 제한값과 규칙을 같이 고친다 (단위 테스트가 두 값을 대조한다).
- **첫 관리자 이메일**(`owner@example.com`)은 `firestore.rules`와 `lib/domain/roles.ts` 두 곳에 있다. 바꾸면 두 곳을 같이 고친다.
- **지우기는 휴지통 표시(`deletedAt`)로만 한다.** 카드·과정의 영구 삭제는 규칙에서 막혀 있다.
  예외로 바로 지우는 것: 회차·준비 일정·초안 판, 강사료(잘못 넣은 건 정리), 고객사 담당자(개인정보라 남기지 않는다),
  카드 첨부 파일(지운 파일이 용량을 계속 차지하지 않게. Storage 파일 → 목록 정보 순서로 지운다).
- **최근 활동(`activity`)은 서버 함수만 쓴다.** 규칙이 화면 쓰기를 모두 막고, 초대된 팀원만 읽는다. 90일 뒤 매일 아침 작업(`lib/server/dailyJob.ts`)이 지운다.
- **서버 함수는 웹 앱 코드(`lib/`)를 불러올 수 없다** (따로 배포된다). 그래서 단계 id·이름, 저장 위치 모양, 순서 간격을
  `functions/src/lectureRules.ts`에 겹쳐 적었다. 웹 앱 쪽을 바꾸면 그쪽도 고친다 (`tests/unit/lecture-upload.test.ts`가 대조한다).
  고객사 지우기는 관리자만 하고 담당자도 함께 지운다.
- **강사료 금액은 강사 본인과 관리자만 본다.** 규칙이 막으므로 강사 화면의 쿼리는 반드시 `instructorEmail == 본인` 조건을 넣는다
  (`lib/data/fees.ts`의 `subscribeFees`).
- **한글 줄바꿈** — `app/globals.css`의 `body`에 `word-break: keep-all`이 들어 있다.
  웹 주소·코드처럼 띄어쓰기 없이 긴 문자열 칸만 `break-all`로 따로 지정한다.
- **구글 로그인을 붙일 때**는 Firebase authDomain을 자체 도메인으로 바꾸는 4단계를 세트로 적용한다
  (사용자 공통 지침의 "Firebase 구글 로그인" 항목).

@docs/CODING-GUIDELINES.md

## 폴더 구조

| 경로 | 역할 |
|---|---|
| `app/` | 화면(주소)별 파일. `page.tsx`가 홈, `login/` 로그인, `admin/` 팀 관리, `courses/new/` 과정 만들기, `courses/[courseId]/` 과정 보드(+ `materials/` 재료함, `drafts/` 초안, `outputs/` 결과물과 인쇄 화면, `fees/` 강사료), `calendar/` 팀 캘린더, `fees/` 내 강사료 모아 보기, `clients/` 고객사 주소록, `archive/` 보관함·휴지통, `guide/` 이용 안내(로그인 없이 누구나 봄), `api/` 서버 경로(매일 알림 메일 `cron/daily`, 관리자 테스트 메일 `notify/test`) |
| `app/layout.tsx` | 모든 화면에 공통으로 씌우는 틀 (언어, 글꼴, 로그인 상태, 알림) |
| `app/globals.css` | 전체 화면 스타일과 design.md 색 토큰 |
| `components/` | 화면 조각. `ui/` 공용 부품(버튼·창·알림), `auth/` 로그인 확인, `layout/` 머리글(로그인 뒤 `AppShell`, 로그인 전 `PublicHeader`), `guide/` 이용 안내 화면과 문구(`guideContent.ts`), `course/` 여러 화면이 같이 쓰는 과정 부품(과정 탭 틀, 7단계 막대, 단계 번호, 과정 색, 글 미리보기), `notices/` 머리글 알림 종·홈 알림 띠(앱 전체에서 한 번만 구독), 나머지는 화면별(`admin/`, `home/`, `board/`, `materials/`, `drafts/`, `outputs/`, `fees/`, `clients/`, `calendar/`, `course-form/`, `login/`) |
| `lib/domain/` | 화면과 상관없는 계산·규칙 (단계, 진행률, 날짜, 순서, 입력 검사, 오류 문구, 시간 제한·재시도). 여기를 고치면 단위 테스트도 고친다 |
| `lib/data/` | Firestore 읽기·쓰기. 모든 쓰기에 시간 제한과 중복 방지가 들어 있다 |
| `lib/server/` | 서버 전용 코드: firebase-admin 연결, Gmail 발송, 매일 알림 작업, 요청 확인. 화면 코드에서 import하지 않는다. 메일 보낸 기록은 서버만 쓰는 `mailLog` 컬렉션에 남기고 30일 뒤 지운다 |
| `lib/firebase/client.ts` | Firebase 연결. 운영 빌드에서만 authDomain을 앱 도메인으로 바꾼다 |
| `lib/firebase/storage.ts` | Storage 연결 (카드 첨부 파일만). 파일을 안 다루는 화면이 Storage 코드를 내려받지 않게 따로 둔다 |
| `firestore.rules`, `firestore.indexes.json` | Firestore 보안 규칙과 색인 |
| `storage.rules` | Storage(카드 첨부 파일) 보안 규칙. 크기·형식 제한은 `lib/domain/cardFiles.ts`와 같아야 한다 (단위 테스트가 대조) |
| `functions/` | Firebase 서버 함수 (따로 배포). `src/index.ts` 목록, `src/onLectureUploaded.ts` 교안 → 카드 이동·활동 기록, `src/lectureRules.ts` 판단 규칙(순수 함수) |
| `tests/unit/`, `tests/rules/` | 단위 테스트, 보안 규칙 테스트 |
| `next.config.ts` | Next.js 설정. 보안 헤더와 구글 로그인용 `/__/` 프록시가 있다 |
| `vercel.json` | Vercel 예약 작업(Cron). 매일 00:00 UTC(한국 9시)에 `/api/cron/daily`를 부른다 |
| `AGENTS.md` | Next.js가 관리하는 AI 안내문. `npm run dev` 때 다시 써지므로 직접 고치지 않는다 |
| `docs/CODING-GUIDELINES.md` | 상세 코딩 지침 |
| `docs/알림-메일-설정.md` | 알림 메일 환경 변수 넣는 방법 (사용자용 안내) |
| `PRD.md` | 무엇을 왜 만드는지 정리한 기획서 |
| `design.md` | 디자인 기준서 (색, 글꼴, 버튼·카드 모양, 접근성) |
