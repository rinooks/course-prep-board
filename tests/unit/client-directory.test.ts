import { describe, expect, it } from "vitest";
import { clientElementId, clientHref, newClientHref } from "@/components/clients/clientLinks";
import {
  clientNameMatchesQuery,
  contactMatchesQuery,
  groupContactsByClient,
  isBlankQuery,
  normalizeSearchText,
  searchClients,
} from "@/components/clients/clientSearch";
import { clientNameHint } from "@/components/course-form/clientNameHint";

const clients = [
  { id: "lg", name: "LG 화학" },
  { id: "samsung", name: "삼성전자(주)" },
  { id: "kakao", name: "카카오" },
];

function contact(id: string, clientId: string, overrides: Partial<{ name: string; role: string; phone: string; email: string }> = {}) {
  return { id, clientId, name: "담당자", role: "", phone: "", email: "", ...overrides };
}

const contacts = [
  contact("p1", "samsung", { name: "김하나", role: "인재개발팀 과장", phone: "010-1234-5678", email: "hana@samsung.com" }),
  contact("p2", "samsung", { name: "이두리", role: "교육기획팀", phone: "02-555-0000", email: "duri@samsung.com" }),
  contact("p3", "lg", { name: "박세나", role: "HRD", phone: "+82 10 9876 5432", email: "sena@lgchem.com" }),
];

const byClient = groupContactsByClient(contacts);

describe("주소록 찾기", () => {
  it("띄어쓰기·대소문자·전각 글자 차이를 지운다", () => {
    expect(normalizeSearchText(" LG  화학 ")).toBe("lg화학");
    expect(normalizeSearchText("ＡＢＣ")).toBe("abc");
    expect(isBlankQuery("   ")).toBe(true);
    expect(isBlankQuery("a")).toBe(false);
  });

  it("담당자를 고객사별로 받은 순서대로 묶는다", () => {
    expect(byClient.get("samsung")?.map((item) => item.id)).toEqual(["p1", "p2"]);
    expect(byClient.get("lg")?.map((item) => item.id)).toEqual(["p3"]);
    expect(byClient.get("kakao")).toBeUndefined();
  });

  it("검색어가 비면 모든 고객사와 담당자를 그대로 보여 준다", () => {
    const results = searchClients(clients, byClient, "  ");
    expect(results.map((result) => result.client.id)).toEqual(["lg", "samsung", "kakao"]);
    expect(results.every((result) => !result.filtered)).toBe(true);
    expect(results[1].contacts).toHaveLength(2);
    expect(results[2]).toMatchObject({ contacts: [], totalContacts: 0 });
  });

  it("고객사 이름이 맞으면 그 고객사 담당자를 모두 보여 준다 ((주)·띄어쓰기·대소문자 무시)", () => {
    expect(clientNameMatchesQuery("삼성전자(주)", "삼성 전자")).toBe(true);
    expect(clientNameMatchesQuery("삼성전자", "㈜삼성전자")).toBe(true);
    expect(clientNameMatchesQuery("LG 화학", "lg화")).toBe(true);
    expect(clientNameMatchesQuery("카카오", "네이버")).toBe(false);

    const results = searchClients(clients, byClient, "삼성");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ filtered: false, totalContacts: 2 });
    expect(results[0].contacts.map((item) => item.id)).toEqual(["p1", "p2"]);
  });

  it("담당자만 맞으면 맞는 담당자만 골라 보여 준다", () => {
    const results = searchClients(clients, byClient, "이두리");
    expect(results).toHaveLength(1);
    expect(results[0].client.id).toBe("samsung");
    expect(results[0]).toMatchObject({ filtered: true, totalContacts: 2 });
    expect(results[0].contacts.map((item) => item.id)).toEqual(["p2"]);
  });

  it("부서·직책과 이메일로도 찾는다", () => {
    expect(contactMatchesQuery(contacts[0], "인재개발")).toBe(true);
    expect(contactMatchesQuery(contacts[2], "hrd")).toBe(true);
    expect(contactMatchesQuery(contacts[2], "LGCHEM.com")).toBe(true);
    expect(contactMatchesQuery(contacts[0], "교육기획")).toBe(false);
  });

  it("전화번호는 숫자만 비교한다 (하이픈·띄어쓰기·국가번호 표기 무시)", () => {
    expect(contactMatchesQuery(contacts[0], "1234 5678")).toBe(true);
    expect(contactMatchesQuery(contacts[0], "01012345678")).toBe(true);
    expect(contactMatchesQuery(contacts[2], "9876-5432")).toBe(true);
    expect(contactMatchesQuery(contacts[1], "555")).toBe(true);
    expect(contactMatchesQuery(contacts[0], "5555")).toBe(false);
  });

  it("아무것도 맞지 않으면 빈 목록", () => {
    expect(searchClients(clients, byClient, "없는사람")).toEqual([]);
  });
});

describe("주소록 주소", () => {
  it("고객사 카드로 가는 주소와 카드 id", () => {
    expect(clientHref("abc123")).toBe("/clients?client=abc123");
    expect(clientElementId("abc123")).toBe("client-abc123");
  });

  it("고객사 추가 주소는 이름을 주소용 글자로 바꾸고 앞뒤 띄어쓰기를 지운다", () => {
    expect(newClientHref(" A사 & B사 ")).toBe(`/clients?new=${encodeURIComponent("A사 & B사")}`);
    expect(new URL(newClientHref("삼성전자(주)"), "https://example.com").searchParams.get("new")).toBe("삼성전자(주)");
  });
});

describe("과정의 고객사 칸 안내", () => {
  it("주소록을 못 받았으면 안내하지 않는다", () => {
    expect(clientNameHint(null, "삼성전자")).toBeNull();
  });

  it("빈 칸이면 추천이 있다고만 알린다 (주소록이 비었으면 안내 없음)", () => {
    expect(clientNameHint(clients, " ")).toContain("추천");
    expect(clientNameHint([], "")).toBeNull();
  });

  it("주소록과 맞는지 알려 준다", () => {
    expect(clientNameHint(clients, "카카오")).toContain("주소록에 있는 고객사");
    expect(clientNameHint(clients, "삼성전자")).toContain("‘삼성전자(주)’");
    expect(clientNameHint(clients, "네이버")).toContain("아직 없는 이름");
  });
});
