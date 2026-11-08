"use client";

import { useEffect, useState } from "react";
import { todayInSeoul, type DateString } from "@/lib/domain/dates";

const CHECK_INTERVAL_MS = 60_000;

/**
 * 오늘 날짜 (한국 기준 "YYYY-MM-DD").
 * 보드를 켜 둔 채 자정을 넘기면 1분 안에 바뀐다. 화면을 떠나면 타이머를 치운다.
 */
export function useToday(): DateString {
  const [today, setToday] = useState(() => todayInSeoul());

  useEffect(() => {
    const timer = setInterval(() => setToday(todayInSeoul()), CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return today;
}
