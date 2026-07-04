---
name: cova-make-design
description: COVA 실서비스의 디자인 패턴 API를 호출해 HTML 시안 한 장을 그 자리에서 생성한다. 레포 clone 없이(빈 폴더에서) curl만으로 동작. "AI 시안 만들기", "HTML 시안 생성", "시안 초안" 요청 시 사용.
---

# COVA HTML 시안 생성 (독립 실행)

COVA 실서비스에 축적된 사전 분석 패턴을 **공개 HTTP API로** 가져와, 그 패턴을 참고 자료로
HTML 시안 한 장을 직접 생성한다. **COVA 레포를 clone할 필요가 없다** — 이 스킬과 `curl`만 있으면
어느 빈 폴더에서든 동작한다. 생성한 HTML은 현재 작업 폴더에 저장한다.

## 설치

이 파일을 `~/.claude/skills/cova-make-design/SKILL.md`로 저장한다(폴더가 없으면 만든다).
그리고 COVA 베이스 URL을 환경변수로 둔다:

```bash
export COVA_API_URL="https://<배포된-COVA-주소>"
# (선택) 4단계 실서비스 저장을 쓸 때만 필요. COVA studio → "API 토큰"에서 본인 토큰을 발급해 넣는다.
export COVA_DESIGN_TOKEN="<studio에서 발급한 내 토큰>"
```

## 순서

1. **태그 확인.**
   ```bash
   curl -s "$COVA_API_URL/api/public/design-patterns/tags"
   ```
   → `{ groups:[{code,label,options:[{code,label}]}] }`. 사용자가 방향(업종/목적/톤/구조)에 맞는 태그를 고르게 한다.
   흐름 선택 가능: (a) 알아서 — 업종/목적/톤만 받아 태그 매핑, (b) 섹션별 — 히어로/서비스/후기/CTA 타입 선택.

2. **패턴 검색.** 태그(라벨 또는 코드, 콤마구분)로 사전 분석 패턴을 가져온다:
   ```bash
   curl -s "$COVA_API_URL/api/public/design-patterns?tags=제안,관광/레저&maxSections=24"
   ```
   → `{ matchedTags, unmatchedTokens, optionIds, patterns:{ patternSnippets, sections } }`.
   `patternSnippets`(시안별 다양화·중복제거된 섹션 패턴)와 `optionIds`를 확보한다. 매칭이 없으면 태그를 넓힌다.

3. **HTML 생성.** `patternSnippets`를 참고해 단일 완결형 HTML을 작성하고 현재 폴더에 `./design-<slug>.html`로 저장한다.
   - **CSP 안전(중요):** COVA 뷰어는 외부 폰트/스크립트/CDN을 차단한다 → CSS는 `<style>` 인라인, 폰트는 시스템 스택
     (`-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`), 이미지는 없거나 `data:` URI만.
   - 이미지를 모방하지 말고 검색된 섹션 구성·레이아웃·리듬만 참고. AI스러운 균일 레이아웃 금지:
     섹션마다 밀도·여백·비율에 차이. 보라-파랑 그라데이션·과한 glow·pill 버튼 남발 지양. 강조색 1~2개, radius 6~10px.
   - 한국어 콘텐츠, 실제 클라이언트 제안용 시안 완성도.
   - 섹션 타입(참고): hero, intro, about, service, product, portfolio, gallery, process, pricing, review, faq, contact, cta, footer.

4. **(선택) 실서비스 저장.** 생성물을 studio 목록에도 등록하려면:
   ```bash
   # payload.json: { "title","company","pageType"(main|dashboard|subpage),"extraNotes",
   #                 "optionIds"[2단계],"html"(전체 HTML 문자열),"analysis","approach","model":"claude-code" }
   curl -s -X POST "$COVA_API_URL/api/public/design-patterns/designs" \
     -H "content-type: application/json" \
     ${COVA_DESIGN_TOKEN:+-H "x-design-token: $COVA_DESIGN_TOKEN"} \
     -d @payload.json
   ```
   → `{ id, viewerPath }`. 뷰어는 `"$COVA_API_URL""$viewerPath"`.
   저장은 **studio에서 발급한 본인 API 토큰**(`COVA_DESIGN_TOKEN`)으로 인증한다. 토큰이 없으면
   3단계의 로컬 HTML 생성까지만 하고 이 저장 단계는 건너뛴다. 저장된 시안은 토큰 소유자에게 귀속된다.

5. **결과 안내.** 생성한 로컬 파일 경로와(저장했다면) `ai_designs` id·뷰어 URL을 사용자에게 알린다.

## 참고
- 이 스킬은 읽기 API만으로 자족한다. 분석 데이터 자체를 새로 만들거나 백필하는 건 COVA 관리자 쪽에서 한다.
- API가 비어 있으면(패턴 0) COVA에 아직 분석 데이터가 없는 것 — 관리자에게 백필을 요청한다.
