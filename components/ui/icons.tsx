// 앱 전체에서 쓰는 작은 아이콘들 (20×20, 선 굵기 1.8). 모두 장식용이라 화면 낭독기는 읽지 않는다 (aria-hidden).
// 뜻은 아이콘 옆 글자나 버튼의 aria-label로 전한다. 새 아이콘도 여기에 같은 모양으로 추가한다.

interface IconProps {
  className?: string;
}

const BASE = {
  "aria-hidden": true,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function CheckIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </svg>
  );
}

/** 끌어서 옮기는 손잡이 (점 여섯 개) */
export function GripIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <circle cx="7.5" cy="5" r="1.4" />
      <circle cx="12.5" cy="5" r="1.4" />
      <circle cx="7.5" cy="10" r="1.4" />
      <circle cx="12.5" cy="10" r="1.4" />
      <circle cx="7.5" cy="15" r="1.4" />
      <circle cx="12.5" cy="15" r="1.4" />
    </svg>
  );
}

export function ArrowUpIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M10 16V4M5 9l5-5 5 5" />
    </svg>
  );
}

export function ArrowDownIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M10 4v12M5 11l5 5 5-5" />
    </svg>
  );
}

export function PencilIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M13.5 3.5l3 3L7 16H4v-3z" />
    </svg>
  );
}

export function TrashIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.8 11h7.4l.8-11" />
    </svg>
  );
}

export function PersonIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="10" cy="6.5" r="3" />
      <path d="M4 17c.8-3.2 3.2-5 6-5s5.2 1.8 6 5" />
    </svg>
  );
}

export function ListIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M8 5.5h8M8 10h8M8 14.5h8M4 5.5h.01M4 10h.01M4 14.5h.01" />
    </svg>
  );
}

export function NoteIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M5 3.5h10v13H5zM7.5 7.5h5M7.5 10.5h5M7.5 13.5h3" />
    </svg>
  );
}

export function PlusIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

export function ChevronLeftIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M12.5 4.5L7 10l5.5 5.5" />
    </svg>
  );
}

export function ChevronRightIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M7.5 4.5L13 10l-5.5 5.5" />
    </svg>
  );
}

export function CloseIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export function CalendarIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M3.5 5.5h13v11h-13zM3.5 8.5h13M7 3.5v4M13 3.5v4" />
    </svg>
  );
}

export function CopyIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M7 7h9v9H7zM4 13V4h9" />
    </svg>
  );
}

export function LinkIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M8.5 11.5a3 3 0 004.2 0l2.6-2.6a3 3 0 00-4.2-4.2l-.9.9M11.5 8.5a3 3 0 00-4.2 0l-2.6 2.6a3 3 0 004.2 4.2l.9-.9" />
    </svg>
  );
}

export function MicIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M10 3a2.5 2.5 0 012.5 2.5v4a2.5 2.5 0 01-5 0v-4A2.5 2.5 0 0110 3zM5 9.5a5 5 0 0010 0M10 14.5V17" />
    </svg>
  );
}

export function DownloadIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M10 3.5v9M6 9l4 4 4-4M4 16.5h12" />
    </svg>
  );
}

/** 알림 (종) */
export function BellIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M5 13.5V9a5 5 0 0110 0v4.5l1.5 2h-13zM8.2 17.5a2 2 0 003.6 0" />
    </svg>
  );
}

/** 첨부 파일 (클립) */
export function PaperclipIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M15.5 9.5l-5.8 5.8a3.5 3.5 0 01-5-5l6.4-6.4a2.3 2.3 0 013.3 3.3l-6.3 6.3a1.2 1.2 0 01-1.7-1.7l5.6-5.6" />
    </svg>
  );
}

/** 파일 한 장 (오른쪽 위가 접힌 종이) */
export function FileIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M11.5 2.5H6A1.5 1.5 0 004.5 4v12A1.5 1.5 0 006 17.5h8a1.5 1.5 0 001.5-1.5V6.5zM11.5 2.5v4h4" />
    </svg>
  );
}
