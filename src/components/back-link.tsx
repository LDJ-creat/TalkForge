import Link from "next/link";
import type { ReactNode } from "react";

type BackLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

export function BackLink({ href, children, className }: BackLinkProps) {
  return (
    <Link href={href} className={["back-link", className].filter(Boolean).join(" ")}>
      <span className="back-link__icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12.5 15.5L7 10l5.5-5.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="back-link__label">{children}</span>
    </Link>
  );
}
