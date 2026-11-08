import { cn } from "@/components/ui/cn";
import { courseColor } from "./courseColor";

/** 과정 구분 색 동그라미. 장식이라 화면 낭독기는 읽지 않는다 (옆에 과정 이름을 꼭 함께 쓴다) */
export function CourseDot({ courseId, className }: { courseId: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-block size-2.5 shrink-0 rounded-full", courseColor(courseId).bg, className)} />
  );
}
