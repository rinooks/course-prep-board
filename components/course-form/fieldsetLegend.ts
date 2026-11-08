// 과정 폼 안 묶음(fieldset) 제목: 과정 정보 · 담당 강사 · 첫 강의 일정이 모두 이 모양을 쓴다.
// 카드 안 작은 구역 제목(design.md 4장, text-base)과 같은 글자. 제목과 내용 사이는 gap-3과 같은 12px.
// legend는 fieldset의 flex 간격(gap)을 받지 않는 브라우저가 있어, 간격을 gap 대신 mb-3으로 준다.
export const FIELDSET_LEGEND_CLASS = "mb-3 text-base font-bold tracking-tight text-ink";
