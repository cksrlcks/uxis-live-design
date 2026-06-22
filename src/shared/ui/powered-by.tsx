import Image from "next/image";
import { cn } from "@/shared/lib/utils";

// "powered by cova" 브랜딩 배지 — 뷰어 첫화면·비공개 화면 등 공용으로 사용.
export function PoweredBy({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 text-center", className)}>
      <div className="text-sm tracking-tight opacity-50">powered by</div>
      <Image src="/logo.svg" alt="cova" width={77} height={19} />
    </div>
  );
}
