import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

/**
 * Root layout with sidebar and main content. Includes a drag region at the top
 * of the sidebar for moving the frameless window on macOS.
 */
export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen w-full bg-main text-white">
      <aside className="flex w-[250px] flex-col border-r border-border-subtle bg-secondary">
        <div
          className="h-8 shrink-0 px-4"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        />
        <div className="flex-1 overflow-y-auto px-4 pb-4 [-webkit-app-region:no-drag]">
          {/* Sidebar content */}
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-main">{children}</main>
    </div>
  );
}
