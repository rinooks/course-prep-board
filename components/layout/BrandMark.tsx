/** 앱 이름 앞 네이비 표식: 칸 세 개짜리 보드 모양 */
export function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-8 items-center justify-center rounded-button bg-primary text-primary-foreground"
    >
      <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
        <rect x="1" y="2" width="4" height="12" rx="1" />
        <rect x="6" y="2" width="4" height="8" rx="1" />
        <rect x="11" y="2" width="4" height="10" rx="1" />
      </svg>
    </span>
  );
}
