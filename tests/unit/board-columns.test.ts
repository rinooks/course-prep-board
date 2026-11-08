import { describe, expect, it } from "vitest";
import {
  applyPendingMoves,
  columnsFromCards,
  findCardPosition,
  isSamePosition,
  planDrop,
  type StageColumns,
} from "@/components/board/boardColumns";
import { describeDue } from "@/components/board/cardDisplay";
import {
  displayedFieldValue,
  editsToPatch,
  hasEdits,
  withFieldEdit,
  withoutSaved,
} from "@/components/board/cardEdits";
import { sessionRelativeDay, sessionWhen } from "@/components/board/sessionDisplay";
import { planMove } from "@/lib/domain/ordering";
import { makeCard } from "./fixtures";

function emptyColumns(): StageColumns {
  return {
    request: [],
    curriculum: [],
    lecture: [],
    practice: [],
    rehearsal: [],
    dayof: [],
    survey: [],
  };
}

describe("columnsFromCards", () => {
  it("단계별로 order 순, 휴지통 카드는 뺀다", () => {
    const cards = [
      makeCard({ id: "b", stage: "request", order: 2048 }),
      makeCard({ id: "a", stage: "request", order: 1024 }),
      makeCard({ id: "c", stage: "lecture", order: 1024 }),
      makeCard({ id: "gone", stage: "request", order: 10, deletedAt: 5 }),
    ];
    const columns = columnsFromCards(cards);
    expect(columns.request).toEqual(["a", "b"]);
    expect(columns.lecture).toEqual(["c"]);
    expect(columns.survey).toEqual([]);
    expect(Object.keys(columns)).toHaveLength(7);
  });
});

describe("findCardPosition / isSamePosition", () => {
  it("카드의 칸과 자리를 찾는다", () => {
    const columns = { ...emptyColumns(), curriculum: ["x", "y"] };
    expect(findCardPosition(columns, "y")).toEqual({ stage: "curriculum", index: 1 });
    expect(findCardPosition(columns, "없음")).toBeNull();
  });

  it("같은 칸 같은 자리면 같은 위치", () => {
    expect(isSamePosition({ stage: "request", index: 0 }, { stage: "request", index: 0 })).toBe(true);
    expect(isSamePosition({ stage: "request", index: 0 }, { stage: "lecture", index: 0 })).toBe(false);
    expect(isSamePosition(null, null)).toBe(true);
    expect(isSamePosition(null, { stage: "request", index: 0 })).toBe(false);
  });
});

describe("applyPendingMoves", () => {
  it("다른 칸으로 옮긴 카드를 원하는 자리에 끼운다", () => {
    const columns = { ...emptyColumns(), request: ["a", "b"], lecture: ["c", "d"] };
    const result = applyPendingMoves(columns, [{ cardId: "a", toStage: "lecture", toIndex: 1 }]);
    expect(result.request).toEqual(["b"]);
    expect(result.lecture).toEqual(["c", "a", "d"]);
    // 원래 목록은 바꾸지 않는다
    expect(columns.request).toEqual(["a", "b"]);
  });

  it("같은 칸 안에서 순서를 바꾼다", () => {
    const columns = { ...emptyColumns(), request: ["a", "b", "c"] };
    const result = applyPendingMoves(columns, [{ cardId: "a", toStage: "request", toIndex: 2 }]);
    expect(result.request).toEqual(["b", "c", "a"]);
  });

  it("이미 저장이 반영된 이동을 다시 덧씌워도 결과가 같다", () => {
    const columns = { ...emptyColumns(), lecture: ["c", "a", "d"] };
    const result = applyPendingMoves(columns, [{ cardId: "a", toStage: "lecture", toIndex: 1 }]);
    expect(result.lecture).toEqual(["c", "a", "d"]);
  });

  it("자리가 범위를 넘으면 맨 끝, 지워진 카드는 건너뛴다", () => {
    const columns = { ...emptyColumns(), request: ["a"], survey: ["z"] };
    const result = applyPendingMoves(columns, [
      { cardId: "a", toStage: "survey", toIndex: 99 },
      { cardId: "없어진카드", toStage: "request", toIndex: 0 },
    ]);
    expect(result.request).toEqual([]);
    expect(result.survey).toEqual(["z", "a"]);
  });
});

describe("planDrop", () => {
  it("옮긴 카드를 뺀 이웃 카드와 자리를 돌려준다", () => {
    const columns = { ...emptyColumns(), lecture: ["c", "a", "d"] };
    const cardsById = new Map([
      ["a", { id: "a", order: 1024 }],
      ["c", { id: "c", order: 1024 }],
      ["d", { id: "d", order: 2048 }],
    ]);
    const plan = planDrop(columns, "a", cardsById);
    expect(plan).toEqual({
      stage: "lecture",
      index: 1,
      siblings: [
        { id: "c", order: 1024 },
        { id: "d", order: 2048 },
      ],
    });
    // 이 값으로 계산한 새 순서는 두 이웃 사이에 들어간다
    const move = planMove(plan!.siblings, plan!.index);
    expect(move.order).toBeGreaterThan(1024);
    expect(move.order).toBeLessThan(2048);
  });

  it("그사이 지워진 카드는 자리 계산에서 뺀다", () => {
    const columns = { ...emptyColumns(), request: ["gone", "x", "moved"] };
    const cardsById = new Map([
      ["x", { id: "x", order: 1024 }],
      ["moved", { id: "moved", order: 5000 }],
    ]);
    const plan = planDrop(columns, "moved", cardsById);
    expect(plan?.index).toBe(1);
    expect(plan?.siblings).toEqual([{ id: "x", order: 1024 }]);
  });

  it("목록에 없는 카드면 null", () => {
    expect(planDrop(emptyColumns(), "a", new Map())).toBeNull();
  });
});

describe("describeDue", () => {
  const today = "2026-10-11";

  it("마감일이 없으면 null", () => {
    expect(describeDue(null, today, false)).toBeNull();
  });

  it("지난 마감은 빨강으로 며칠 지났는지 보여준다", () => {
    expect(describeDue("2026-10-09", today, false)).toMatchObject({ tone: "danger", text: "마감 2일 지남" });
  });

  it("오늘·내일·사흘 안은 노랑", () => {
    expect(describeDue("2026-10-11", today, false)).toMatchObject({ tone: "warning", text: "오늘 마감" });
    expect(describeDue("2026-10-12", today, false)).toMatchObject({ tone: "warning", text: "내일 마감" });
    expect(describeDue("2026-10-14", today, false)).toMatchObject({ tone: "warning", text: "3일 후 마감" });
  });

  it("그 뒤는 날짜를 회색으로", () => {
    expect(describeDue("2026-10-20", today, false)).toMatchObject({ tone: "neutral", text: "10월 20일 (화) 마감" });
  });

  it("끝난 카드는 지났어도 강조하지 않는다", () => {
    expect(describeDue("2026-10-01", today, true)).toMatchObject({ tone: "neutral", text: "10월 1일 (목) 마감" });
  });
});

describe("카드 고침(cardEdits)", () => {
  const card = makeCard({ id: "c1", title: "교안 초안", assigneeEmail: "a@example.com", dueDate: null, memo: "" });

  it("고친 칸만 기억하고, 원래 값으로 돌리면 고침 표시를 지운다", () => {
    const edited = withFieldEdit(card, {}, "title", "교안 초안 v2");
    expect(edited).toEqual({ title: "교안 초안 v2" });
    expect(hasEdits(edited)).toBe(true);
    expect(withFieldEdit(card, edited, "title", "교안 초안")).toEqual({});
  });

  it("고치지 않은 칸은 저장값(다른 사람이 바꾼 최신 값)을 보여준다", () => {
    const edits = { memo: "메모" };
    expect(displayedFieldValue(card, edits, "memo")).toBe("메모");
    expect(displayedFieldValue({ ...card, title: "다른 사람이 바꾼 제목" }, edits, "title")).toBe(
      "다른 사람이 바꾼 제목",
    );
    expect(displayedFieldValue(card, edits, "dueDate")).toBe("");
  });

  it("빈 담당자·마감일은 없음(null)으로 보낸다", () => {
    expect(editsToPatch({ assigneeEmail: "", dueDate: "" })).toEqual({ assigneeEmail: null, dueDate: null });
    expect(editsToPatch({ dueDate: "2026-10-20", title: "새 제목" })).toEqual({
      dueDate: "2026-10-20",
      title: "새 제목",
    });
  });

  it("저장하는 동안 또 고친 칸은 남긴다", () => {
    const saved = { title: "A", memo: "M" };
    const current = { title: "AB", memo: "M", dueDate: "2026-10-20" };
    expect(withoutSaved(current, saved)).toEqual({ title: "AB", dueDate: "2026-10-20" });
  });
});

describe("sessionWhen", () => {
  it("올해 회차는 연도 없이, 시간이 있으면 붙인다", () => {
    expect(sessionWhen({ date: "2026-10-20", startTime: "09:30" }, "2026-10-11")).toBe("10월 20일 (화) 09:30");
    expect(sessionWhen({ date: "2026-10-20", startTime: null }, "2026-10-11")).toBe("10월 20일 (화)");
  });

  it("다른 해 회차는 연도를 붙인다", () => {
    expect(sessionWhen({ date: "2027-01-05", startTime: null }, "2026-10-11")).toBe("2027년 1월 5일 (화)");
  });
});

describe("회차 표시가 이상한 날짜에도 멈추지 않는다", () => {
  it("형식이 틀린 날짜는 안내 문구, 남은 날은 빈 문자열", () => {
    expect(sessionWhen({ date: "2026-13-40", startTime: null }, "2026-10-11")).toBe("날짜 확인 필요");
    expect(sessionWhen({ date: "", startTime: "09:00" }, "2026-10-11")).toBe("날짜 확인 필요");
    expect(sessionRelativeDay("2026-13-40", "2026-10-11")).toBe("");
    expect(sessionRelativeDay("2026-10-12", "2026-10-11")).toBe("내일");
  });
});
