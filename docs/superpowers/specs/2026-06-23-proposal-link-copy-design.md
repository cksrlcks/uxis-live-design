# 시안목록 "복사" 컬럼 (공개 링크 클립보드 복사)

> 작성일: 2026-06-23
> 배경: 스튜디오 시안목록([proposals-list-page.tsx](../../../src/pages/proposals-list/ui/proposals-list-page.tsx))에는 공개 뷰어를 새 탭으로 여는 "링크" 컬럼만 있다. 링크를 **공유용으로 복사**하려면 주소창에서 직접 긁어야 한다.

스튜디오 시안목록 테이블에 **"복사" 컬럼**을 신규 추가해, 각 시안의 **공개 뷰어 절대 URL**을 클릭 한 번으로 클립보드에 복사하고 toast로 피드백한다.

## 1. 범위

**포함**
- 시안목록 테이블에 우측 정렬 **"복사" 컬럼** 추가, **컬럼 순서는 `… → 복사 → 링크`**(링크 컬럼을 맨 끝으로 이동)
- 시안 공개 링크는 **최대 2개**: 공개ID 링크 `/p/{publicId}`(항상) + 도메인 링크 `/p/{domain}`(도메인 지정 시). **각 링크를 라벨(ID/도메인)과 함께 셀 안에 나란히(가로) 표시**
- 복사 컬럼: 링크별 복사 아이콘 버튼 → 해당 링크의 **절대 URL**(`origin + path`)을 클립보드에 복사. 링크 컬럼: 링크별 "뷰어 열기"(새 탭)
- 복사 성공/실패 시 `toast`(sonner) 피드백
- **부수 수정**: `<Toaster />`가 앱 어디에도 마운트돼 있지 않아 현재 모든 toast가 표시되지 않음 → 루트 레이아웃에 마운트 (기존 whiteboard toast도 함께 복구됨)

**제외 (YAGNI)**
- 복사 대상 선택 UI(토글 등) — 존재하는 링크를 전부 노출하므로 불필요
- 일괄 복사, 비공개 시안 복사 차단 등 추가 정책

## 2. 확정된 결정
| # | 결정 | 선택 | 이유 |
|---|------|------|------|
| 1 | 배치 | **별도 "복사" 컬럼 추가**, 순서 `… → 복사 → 링크`(링크 맨 끝) | 사용자 결정 |
| 2 | 피드백 | **`toast.success` + 루트 레이아웃에 `<Toaster />` 마운트** | 사용자 결정. 정의만 돼 있고 미마운트인 Toaster를 살려 기존 whiteboard toast도 복구 |
| 3 | 복사 대상 | **공개 뷰어 절대 URL** (`origin + path`) | 공유하려면 origin 포함 절대주소 필요 |
| 4 | 링크 개수 | **최대 2개(공개ID + 도메인) 각각 표시**, 라벨 ID/도메인, 셀 안 가로 나란히 | 사용자 결정. 도메인 링크와 ID 링크는 서로 다른 주소라 둘 다 노출 |

## 3. 변경 파일
1. **[app/layout.tsx](../../../app/layout.tsx)** — `@/shared/ui/sonner`의 `<Toaster />`를 body 내부(프로바이더 트리 안)에 마운트
2. **[proposals-list-page.tsx](../../../src/pages/proposals-list/ui/proposals-list-page.tsx)**
   - `import { Copy } from "lucide-react"`, `import { Button } from "@/shared/ui/button"`, `import { toast } from "sonner"`
   - 모듈 헬퍼 `copyViewerLink(path)` — `origin + path`를 `navigator.clipboard.writeText` → 성공 `toast.success` / 실패 `toast.error`
   - 헤더 순서 `… 복사 · 링크`(둘 다 우측 정렬, 링크가 마지막)
   - 행마다 `links` 배열 구성: 공개ID(항상) + 도메인(있을 때) → 복사 셀·링크 셀이 각각 `links.map`으로 라벨 + 액션을 가로로 렌더
   - 로딩 스켈레톤 행에 셀 1개 추가(복사·링크 = 2셀), 빈/에러 행 `colSpan` 7 → 8

## 4. 검증
- 복사 버튼 클릭 시 클립보드에 해당 링크의 절대 URL이 들어가고 "복사했습니다" toast가 뜬다
- 도메인이 있으면 복사·링크 컬럼에 **ID·도메인 두 항목**이, 없으면 ID 한 항목이 보인다
- 컬럼 순서가 `… → 복사 → 링크`이고, 로딩/빈/에러 상태에서 열 정렬이 깨지지 않는다 (colSpan·스켈레톤 일치)
