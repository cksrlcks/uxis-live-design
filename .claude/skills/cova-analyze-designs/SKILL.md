---
name: cova-analyze-designs
description: COVA 내부 시안(proposal_pages)을 로컬 vision(Claude Code)으로 사전 분석해 proposal_page_analysis / proposal_section_analysis에 저장한다. "시안 분석", "디자인 패턴 분석/데이터화", 분석 백필을 요청할 때 사용. API 과금 없이 Claude Code 사용량으로 처리한다(야간 자동화는 `npm run analyze:designs` API 경로).
---

# COVA 시안 사전 분석 (로컬 vision)

COVA에 축적된 시안(`proposal_pages`)을 Claude Code의 vision으로 분석해
`proposal_page_analysis` / `proposal_section_analysis`에 저장한다.
재분석 방지: `(page_id, analysis_version)`로 이미 analyzed된 페이지는 건너뛴다.

작업 파일은 리포 루트의 `.analyze-cache/`(gitignore됨)에 둔다.

## 순서

1. **대기 이미지 다운로드 + 매니페스트**
   ```bash
   npx tsx --env-file=.env.local scripts/export-pending-images.mts --out="$(pwd)/.analyze-cache" --limit=200
   ```
   - `.analyze-cache/manifest.json`(페이지 identity + 로컬 경로)과 이미지들이 생성된다.
   - 노출 시안만: `--exposed` 추가.

2. **vision 분석 (배치 병렬)**
   - `manifest.json`을 배치(5장 내외)로 나눠, 배치마다 서브에이전트를 띄운다(Workflow 팬아웃 권장).
   - 각 에이전트는 배치 이미지를 Read로 열어 분석하고, 결과 배열을
     `[{ pageId, overall:{industry,tone,styleKeywords,summary,promptSnippet},
        sections:[{sectionType,layoutType,tone,backgroundType,colorPalette,components,summary,promptSnippet}] }]`
     형태로 `.analyze-cache/out/batch-N.json`에 Write한다.
   - 고정 분류만 사용(목록 밖 값은 저장 시 자동 드롭):
     sectionType 14종 = hero, intro, about, service, product, portfolio, gallery, process, pricing, review, faq, contact, cta, footer
     component type 15종 = button, card, tab, accordion, slider, search, form, badge, stats, timeline, stepper, thumbnail, profile-card, review-card, pricing-card
   - 이미지의 실제 텍스트를 옮기지 말고 레이아웃·구성·톤 패턴을 요약한다.

3. **DB 저장**
   ```bash
   npx tsx --env-file=.env.local scripts/save-analysis.mts \
     --manifest="$(pwd)/.analyze-cache/manifest.json" \
     --analyses-dir="$(pwd)/.analyze-cache/out" --model=claude-code
   ```
   - `parsePageAnalysis`로 검증 후 `saveAnalysis`로 upsert. 섹션은 재분석 시 교체.

4. **검증**
   ```bash
   npx tsx --env-file=.env.local scripts/query-patterns.mts --list   # 태그 확인
   ```
   ```sql
   SELECT count(*) FROM proposal_page_analysis WHERE status='analyzed';
   SELECT section_type, count(*) FROM proposal_section_analysis GROUP BY 1 ORDER BY 2 DESC;
   ```
   - 재실행 시 이미 분석된 페이지는 export 단계에서 대기 목록에 안 잡힌다(idempotent).

분석 기준을 바꾸면 `src/entities/design-analysis/model/constants.ts`의 `ANALYSIS_VERSION`을 올려 전체 재분석을 트리거한다.
생성된 HTML 시안이 필요하면 `cova-make-design` 스킬을 사용한다.
