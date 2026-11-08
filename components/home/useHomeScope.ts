"use client";

// 홈 보기 범위(팀 전체 / 내 것만)를 기억한다.
// 이 기기의 브라우저에만 남는 편의 기능이라, 저장소를 못 쓰면(사생활 보호 창 등) 매번 팀 전체로 시작한다.

import { useCallback, useState } from "react";
import type { HomeScope } from "./homeOverview";

const STORAGE_KEY = "lecture-board:home-scope";

function readSavedScope(): HomeScope {
  if (typeof window === "undefined") return "team";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "mine" ? "mine" : "team";
  } catch {
    return "team";
  }
}

function saveScope(scope: HomeScope): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, scope);
  } catch {
    // 기억하지 못해도 지금 화면은 바뀐다. 다음에 열 때 팀 전체로 시작할 뿐이다
  }
}

/**
 * 홈은 로그인 확인(RequireMember)이 끝난 뒤 브라우저에서만 그려지므로,
 * 처음 값을 바로 저장소에서 읽어도 서버 화면과 어긋나지 않는다.
 */
export function useHomeScope(): [HomeScope, (scope: HomeScope) => void] {
  const [scope, setScopeState] = useState<HomeScope>(readSavedScope);

  const setScope = useCallback((next: HomeScope) => {
    setScopeState(next);
    saveScope(next);
  }, []);

  return [scope, setScope];
}
