# design.md — 코퍼레이트 네이비

> 이 문서는 AI 코딩 도구가 읽는 디자인 기준서입니다. 화면을 만들거나 고칠 때 아래 규칙을 먼저 적용하세요.
> 생성: Tailwind 디자인 포탈 v2.0 · 2026-10-11 · 기준: Tailwind CSS v4

## 1. 컨셉

- 스타일: 코퍼레이트 네이비 (기업·B2B) + 벤토 그리드 (2026-11-08)
- 어울리는 용도: 대기업 제안·신뢰감
- 분위기 키워드: 안정 · 공식 · 신뢰
- 요약: Noto Sans KR 글꼴, navy (#1e2a5a) 메인 컬러, 밝은 배경(Slate 50), 타일 모서리 16px · 버튼과 입력칸 모서리 6px, 그림자 SM
- 벤토 그리드 (2026-11-08 사용자 요청): 화면을 크기가 다른 둥근 타일의 격자로 구성한다. 색·글꼴·글자 크기·터치 영역은 그대로다. 칸반 내부, 달력 칸, 입력 양식, 인쇄 화면은 격자로 쪼개면 쓰기 불편하므로 안쪽 배치를 유지하고 바깥 타일 모양만 맞춘다

## 2. 디자인 토큰

Tailwind v4는 설정 파일 대신 CSS 안의 `@theme`로 토큰을 정의합니다. 전역 CSS 파일에 아래 블록을 넣으세요.

```css
@import "tailwindcss";

@theme {
  --font-sans: 'Noto Sans KR', sans-serif;
  --color-primary: #1e2a5a;
  --color-primary-foreground: #ffffff;
  --color-surface: #f8fafc;
  --color-ink: #0f172a;
  --color-muted: #64748b;
  --color-line: #e2e8f0;
  --radius-tile: 16px;
  --radius-card: 6px;
  --radius-button: 6px;
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / .1), 0 1px 2px -1px rgb(0 0 0 / .1);
  --color-danger: #b91c1c;
  --color-success: #047857;
  --color-warning: #92400e;
  --color-course-1: #1d4ed8;
  --color-course-2: #6d28d9;
  --color-course-3: #be185d;
  --color-course-4: #155e75;
  --color-course-5: #4d7c0f;
  --color-course-6: #475569;
}
```

빌드 없이 HTML 한 파일로 만들 때는 이렇게 씁니다.

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300..900&display=swap">
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<style type="text/tailwindcss">
  @theme {
    --font-sans: 'Noto Sans KR', sans-serif;
    --color-primary: #1e2a5a;
    --color-primary-foreground: #ffffff;
    --color-surface: #f8fafc;
    --color-ink: #0f172a;
    --color-muted: #64748b;
    --color-line: #e2e8f0;
    --radius-tile: 16px;
    --radius-card: 6px;
    --radius-button: 6px;
    --shadow-card: 0 1px 3px 0 rgb(0 0 0 / .1), 0 1px 2px -1px rgb(0 0 0 / .1);
    --color-danger: #b91c1c;
    --color-success: #047857;
    --color-warning: #92400e;
    --color-course-1: #1d4ed8;
    --color-course-2: #6d28d9;
    --color-course-3: #be185d;
    --color-course-4: #155e75;
    --color-course-5: #4d7c0f;
    --color-course-6: #475569;
  }
</style>
```

| 토큰 | 값 | 클래스 | 용도 |
|---|---|---|---|
| primary | `#1e2a5a` | `bg-primary` `text-primary` | 주요 버튼, 링크, 강조 |
| primary-foreground | `#ffffff` | `text-primary-foreground` | primary 배경 위 글자 |
| surface | `#f8fafc` | `bg-surface` | 페이지 배경 |
| ink | `#0f172a` | `text-ink` | 제목·본문 |
| muted | `#64748b` | `text-muted` | 보조 설명, 캡션 |
| line | `#e2e8f0` | `border-line` | 테두리, 구분선 |
| radius-tile | `16px` | `rounded-tile` | 화면을 나누는 타일 (`Card`, 네이비 타일) |
| radius-card | `6px` | `rounded-card` | 타일 안 작은 상자, 칸반 카드, 입력창, 이미지 |
| radius-button | `6px` | `rounded-button` | 버튼, 뱃지 |
| shadow-card | SM | `shadow-card` | 카드 |
| danger | `#b91c1c` | `text-danger` `bg-danger` `bg-danger/5` | 오류, 삭제·내보내기 버튼 |
| success | `#047857` | `text-success` `bg-success/10` | 완료, 성공 알림 |
| warning | `#92400e` | `text-warning` `bg-warning/5` | 주의 안내, 마감 임박 |

| course-1~6 | `#1d4ed8` `#6d28d9` `#be185d` `#155e75` `#4d7c0f` `#475569` | `bg-course-1` … | 과정 구분 (캘린더 일정, 홈 카드의 색 점) |

상태 색 3개(danger·success·warning)는 2026-10-12에 추가했다. 옅은 배경은 `/5`·`/10`으로만 만들고, 흰 배경과 옅은 배경 위 글자 모두 명암비 4.5:1 이상이다.
상태 색 테두리는 모두 `/25`로 쓴다 (`border-danger/25` 등).

과정 구분 색 6개는 2026-10-13에 추가했다. 과정 id로 자동으로 정해지며(`components/course/courseColor.ts`), 흰 글자와 명암비 5:1 이상이다.
상태 색(빨강·초록·갈색)과 헷갈리지 않는 색만 골랐다. 색만으로 과정을 구분하지 않고 **항상 과정 이름을 함께** 쓴다.

**그 밖의 허용 값**
- `bg-white`: 카드·입력칸·목록처럼 페이지 배경(surface) 위에 올라오는 면
- 네이비 타일 위 보조 글자는 `text-primary-foreground/80` 하나만 쓴다
- `rounded-full`: 진행 막대, 날짜 동그라미, 과정 색 점, 사람 이니셜 동그라미, 스피너에만 쓴다

## 3. 타이포그래피

- 글꼴: Noto Sans KR — 가장 무난한 고딕 (불러오기: `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300..900&display=swap`)
- 제목 굵기: Bold 700 → `font-bold`
- 크기: h1 `text-4xl md:text-6xl` / h2 `text-3xl md:text-4xl` / h3 `text-xl` / 본문 `text-base leading-relaxed` / 캡션 `text-sm text-muted`
- 제목은 `tracking-tight text-balance`, 본문 한 줄 너비는 `max-w-prose`(약 65자)로 제한
- **앱 화면 예외 (2026-10-12)**: h1의 `text-4xl md:text-6xl`은 로그인 히어로에만 쓴다. 로그인한 뒤 일하는 화면(홈·보드·관리자)의 페이지 제목은 `text-3xl md:text-4xl`, 구역 제목은 `text-xl`로 한 단계 작게 둔다. 칸반 보드와 목록이 한 화면에 더 많이 보이게 하려는 것이다.
- **글자 크기 한 단계 줄임 (2026-10-13)**: 화면 전체 글자가 크다는 의견에 따라, 클래스 이름은 그대로 두고 `app/globals.css`의 `--text-*` 값을 한 단계씩 낮췄다. 이 앱에서 클래스와 실제 크기는 아래와 같다. 본문 기본 크기(클래스 없는 글)도 14px이다.

  | 클래스 | 실제 크기 | 쓰는 곳 |
  |---|---|---|
  | `text-4xl` | 30px | 페이지 제목 (md 이상) |
  | `text-3xl` | 24px | 페이지 제목 (휴대폰) |
  | `text-xl` | 18px | 구역 제목 |
  | `text-lg` | 16px | 카드 제목 |
  | `text-base` | 14px | 본문, 작은 구역 제목, 목록 제목, 입력칸 |
  | `text-sm` | 13px | 보조 글, 작은 버튼 |
  | `text-xs` | 12px | 배지, 칸반 카드 안 작은 정보 (더 줄이지 않는다) |

  휴대폰 폭(768px 미만)에서는 입력칸 글자만 16px로 둔다. 16px보다 작으면 아이폰이 입력칸을 누를 때마다 화면을 확대하기 때문이다.

## 4. 컴포넌트

### 버튼 · 솔리드

```html
<a href="#" class="inline-flex items-center gap-2 rounded-button bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary/90 transition active:translate-y-px">무료로 시작하기</a>
<a href="#" class="inline-flex items-center gap-2 rounded-button border border-line px-5 py-3 font-semibold text-ink hover:bg-ink/5">자세히 보기</a>
```

### 타일 · 보더형

```html
<div class="rounded-tile border border-line bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
  <h3 class="text-xl font-bold text-ink">말로 기획하기</h3>
  <p class="mt-2 text-muted">만들고 싶은 화면을 문장으로 정리합니다.</p>
</div>
```

### 섹션 · 간격 보통

```html
<section class="bg-surface px-6 py-20">
  <div class="mx-auto max-w-6xl">
    <h2 class="text-3xl md:text-4xl font-bold tracking-tight text-ink">섹션 제목</h2>
  </div>
</section>
```

### 부품 규칙 (2026-10-13)

화면마다 모양이 달라지지 않도록, 아래 부품은 직접 만들지 말고 `components/ui/`의 것을 쓴다.

| 쓰임 | 부품 | 규칙 |
|---|---|---|
| 페이지 틀 | `PageHeader` + `PageBody` (`components/layout/Page.tsx`) | 로그인 뒤 모든 화면(불러오는 중·오류 상태 포함)의 맨 위에 네이비 타일을 둔다. 타일에는 eyebrow(작은 글자)·제목·설명·버튼. 타일 안 버튼은 `inverse`/`inverseOutline`, 크기 `sm`. 다른 타일과 나란히 놓을 때는 `PageHeaderTile`을 격자에 직접 넣는다. 네이비 타일은 한 화면에 하나만 |
| 벤토 격자 | `BentoGrid` (`components/ui/Bento.tsx`) | 타일을 나란히 놓을 때 쓴다. `main-side`(본문 + 오른쪽 24rem), `halves`(2칸), `thirds`(3칸). 간격은 `gap-4` 하나, 휴대폰에서는 한 줄로 쌓는다. 같은 줄 타일은 `h-full`로 높이를 맞춘다. 좁은 타일 안의 긴 세로 목록은 `tileListClass`를 써서 넓은 화면에서 타일 안에서 스크롤한다 |
| 구역 | `Section` / `SectionHeading` | 타일·구역끼리 `gap-4`(PageBody가 정함), 제목과 내용 사이 `gap-3`. 제목 h2 `text-xl`, 타일 안 h3 `text-base`. 개수는 제목 옆 `meta`에 "3개"처럼. 한 덩어리 내용은 `tile`을 켜서 제목까지 타일 안에 넣고, 내용이 타일 묶음이면 제목을 타일 위에 두거나 `hideHeading`으로 숨긴다 |
| 타일·패널 | `Card` | 여백 `md`(p-4 md:p-5)가 기본, 모서리 16px. 타일 안 작은 상자는 `padding="sm" flat`(모서리 6px). 로그인·안내 타일만 `lg`. 타일 안에 다시 타일을 넣지 않는다 |
| 카드 제목 | — | 과정처럼 카드 하나가 한 대상이면 `text-lg font-bold tracking-tight`. 목록 한 줄의 제목은 `text-base font-semibold` |
| 목록 한 줄 | `RowLink`, `rowClass` | 높이 44px 이상, `px-3 py-2`, 마우스를 올리면 `bg-ink/5`. 카드 안 목록은 `-mx-3`으로 넓힌다 |
| 체크박스 줄 | `CheckboxRow` | 줄 전체를 눌러도 체크. 격자로 여러 개 고를 때 `boxed` |
| 보기 고르기 | `SegmentedControl` | 팀 전체/내 것만, 달/주처럼 같은 내용을 다르게 볼 때. 고른 쪽이 채워진 버튼 |
| 탭 | `Tabs`, `TabLinks` | 같은 화면 안 내용 묶음 바꾸기는 `Tabs`, 다른 주소로 가는 탭 메뉴는 `TabLinks`. 밑줄 모양 |
| 아이콘 버튼 | `IconButton` | 44×44px, `label` 필수. 삭제는 `tone="danger"`. 아이콘은 `components/ui/icons.tsx`에만 둔다 |
| 삭제·내보내기 | `Button variant="dangerGhost"` | 확인 창의 마지막 버튼만 `danger`(빨강 바탕) |
| 불러오는 중 | `LoadingBlock`(구역·화면), `InlineLoading`(칸 안 한 줄) | 문구는 "…을 불러오는 중입니다…" |
| 비어 있음 | `EmptyState` (`size="sm"`은 작은 구역 안) | 무엇이 없는지 + 무엇을 하면 되는지. 패널 안 짧은 목록은 `text-sm text-muted` 한 줄도 된다 |
| 오류 | `Alert tone="error"` | 항상 `title`을 넣고, 다시 할 수 있으면 "다시 시도" 버튼 |
| 진행 막대 | `ProgressBar` | 높이 8px. 네이비 타일 위는 `tone="inverse"` |
| 날짜 배지 | `sessionDayBadge` (`components/course/dayBadge.ts`) | 오늘부터 3일 안이면 warning, 그 밖은 neutral |
| 단계 번호 | `StageNumber` (`components/course/StageNumber.tsx`) | 24px 네이비 칸 |
| 과정 색 | `CourseDot`, `courseColor` | 과정 이름 옆에만 |

글자 크기는 페이지 제목(`text-3xl md:text-4xl`, 24/30px), 구역 제목(`text-xl`, 18px), 카드 제목(`text-lg`, 16px), 작은 구역 제목·목록 제목(`text-base`, 14px), 보조 글(`text-sm text-muted`, 13px) 다섯 단계만 쓴다 (실제 크기는 3장 표).
`text-xs`는 배지와 칸반 카드 안 작은 정보에만 쓴다.

## 5. 인터랙션 규칙 · 은은하게

- 호버 시 색 변화 + 포커스 링 (없음 단계 포함)
- 카드 호버 리프트: `transition hover:-translate-y-0.5 hover:shadow-lg` (‑2px)
- 버튼 프레스: `active:translate-y-px` (누르는 순간 1px)
- 스티키 헤더 블러: `sticky top-0 backdrop-blur-md bg-surface/80` (뒤 콘텐츠 14px 블러)
- 팝업 입장: 투명도 0→1 + 8px 위로 이동, 200ms

## 6. 히어로 연출

선택한 연출이 없습니다. 제목 + 설명 + 버튼 2개로 이루어진 정적인 히어로로 만드세요.

## 7. 반응형 · 다크 모드 · 접근성 (필수)

- 모바일 우선: 접두사 없는 클래스는 모바일 기준, `md:`(768px)·`lg:`(1024px)에서 넓힙니다.
- 버튼·링크의 터치 영역은 최소 44×44px입니다.
- 글자와 배경의 명암비는 4.5:1 이상(큰 제목은 3:1 이상)을 지킵니다.
- 모든 버튼과 링크에 `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`를 넣습니다.
- **`prefers-reduced-motion: reduce`이면 모든 반복 애니메이션은 반드시 정지하거나 최종 상태로 보여줍니다.** Tailwind에서는 `motion-reduce:animate-none motion-reduce:transition-none`을 함께 씁니다.
- 다크 모드를 지원할 때는 `dark:` 클래스로 surface와 ink 값만 서로 바꾸고, primary는 유지합니다.

## 8. AI 작업 지시

```
이 design.md를 디자인 기준으로 사용해 줘.
- 색·글꼴·모서리·그림자는 2장의 토큰만 쓰고 새 값을 만들지 마.
- 버튼·카드·섹션은 4장의 마크업을 기본으로 변형해.
- 히어로는 6장의 연출을 적용하고, 7장의 접근성 규칙은 반드시 지켜.
- 문서와 다르게 해야 할 이유가 생기면 먼저 나에게 물어봐.
```