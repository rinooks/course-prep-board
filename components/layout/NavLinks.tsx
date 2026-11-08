"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, focusRing } from "@/components/ui/cn";

export interface NavItem {
  href: string;
  label: string;
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/" || pathname.startsWith("/courses");
  return pathname === href || pathname.startsWith(`${href}/`);
}

const LINK_BASE =
  "inline-flex min-h-11 items-center rounded-button px-3 text-sm font-semibold transition motion-reduce:transition-none";

/** 현재 위치를 표시하는 메뉴. usePathname을 쓰므로 AppShell이 Suspense로 감싼다. */
export function NavLinks({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  return <NavList items={items} pathname={pathname} />;
}

/** 현재 위치를 모를 때(Suspense 대기 중)에도 같은 모양으로 보여준다 */
export function NavList({ items, pathname }: { items: readonly NavItem[]; pathname: string | null }) {
  return (
    <ul className="flex flex-wrap items-center gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                LINK_BASE,
                focusRing,
                active ? "bg-primary/10 text-primary" : "text-muted hover:bg-ink/5 hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
