// 강의 준비 7단계와, 과정을 만들 때 자동으로 생기는 기본 카드(PRD 부록).
// id는 데이터베이스에 저장되므로 절대 바꾸지 않는다. 화면 문구는 label만 고친다.

export const STAGES = [
  { id: "request", label: "고객사 요청 확인", order: 1 },
  { id: "curriculum", label: "커리큘럼", order: 2 },
  { id: "lecture", label: "교안", order: 3 },
  { id: "practice", label: "실습 자료", order: 4 },
  { id: "rehearsal", label: "리허설", order: 5 },
  { id: "dayof", label: "당일 준비물", order: 6 },
  { id: "survey", label: "사후 설문", order: 7 },
] as const;

export type Stage = (typeof STAGES)[number];
export type StageId = Stage["id"];

export const STAGE_IDS: readonly StageId[] = STAGES.map((stage) => stage.id);

export function isStageId(value: unknown): value is StageId {
  return typeof value === "string" && (STAGE_IDS as readonly string[]).includes(value);
}

export function getStage(stageId: StageId): Stage {
  const stage = STAGES.find((item) => item.id === stageId);
  if (!stage) {
    throw new Error(`알 수 없는 단계입니다: ${stageId}`);
  }
  return stage;
}

export function stageLabel(stageId: StageId): string {
  return getStage(stageId).label;
}

/** 0부터 시작하는 단계 순번 */
export function stageIndex(stageId: StageId): number {
  return STAGE_IDS.indexOf(stageId);
}

export function nextStageId(stageId: StageId): StageId | null {
  const index = stageIndex(stageId);
  return STAGE_IDS[index + 1] ?? null;
}

export function previousStageId(stageId: StageId): StageId | null {
  const index = stageIndex(stageId);
  return index > 0 ? STAGE_IDS[index - 1] : null;
}

export interface TemplateCard {
  stage: StageId;
  title: string;
  /** 카드 안 체크리스트 항목. 묶여 있던 항목(괄호, '·' 목록)을 풀어 넣었다. */
  checklist: readonly string[];
}

export const DEFAULT_TEMPLATE: readonly TemplateCard[] = [
  // 1. 고객사 요청 확인
  {
    stage: "request",
    title: "교육 정보 확인",
    checklist: ["대상", "인원", "시간", "장소"],
  },
  {
    stage: "request",
    title: "교육 목표와 기대 결과 확인",
    checklist: ["교육 목표 확인", "기대 결과 확인"],
  },
  { stage: "request", title: "사전 미팅 기록 정리", checklist: [] },

  // 2. 커리큘럼
  {
    stage: "curriculum",
    title: "모듈 구성과 시간 배분",
    checklist: ["모듈 구성", "시간 배분"],
  },
  { stage: "curriculum", title: "고객사 검토 요청", checklist: [] },
  { stage: "curriculum", title: "커리큘럼 확정", checklist: [] },

  // 3. 교안
  { stage: "lecture", title: "교안 초안 작성", checklist: [] },
  { stage: "lecture", title: "동료 검토", checklist: [] },
  {
    stage: "lecture",
    title: "교안 확정과 PPT 내보내기",
    checklist: ["교안 확정", "PPT 내보내기"],
  },

  // 4. 실습 자료
  { stage: "practice", title: "실습 설계", checklist: [] },
  { stage: "practice", title: "실습 안내서 작성", checklist: [] },
  {
    stage: "practice",
    title: "실습 환경·계정 점검",
    checklist: ["실습 환경 점검", "실습 계정 점검"],
  },
  { stage: "practice", title: "실습 자료 PDF 내보내기", checklist: [] },

  // 5. 리허설
  { stage: "rehearsal", title: "시간 맞춰 전체 리허설", checklist: [] },
  { stage: "rehearsal", title: "실습 직접 해 보기", checklist: [] },
  { stage: "rehearsal", title: "피드백 반영", checklist: [] },

  // 6. 당일 준비물
  {
    stage: "dayof",
    title: "노트북·충전기·어댑터",
    checklist: ["노트북", "충전기", "어댑터"],
  },
  {
    stage: "dayof",
    title: "발표 파일 백업",
    checklist: ["USB에 백업", "클라우드에 백업"],
  },
  {
    stage: "dayof",
    title: "출석부·명찰·인쇄물",
    checklist: ["출석부", "명찰", "인쇄물"],
  },
  {
    stage: "dayof",
    title: "현장 인터넷·프로젝터 확인",
    checklist: ["현장 인터넷 확인", "프로젝터 확인"],
  },

  // 7. 사후 설문
  { stage: "survey", title: "설문 보내기", checklist: [] },
  { stage: "survey", title: "결과 정리", checklist: [] },
  { stage: "survey", title: "다음 회차 개선점 기록", checklist: [] },
];
