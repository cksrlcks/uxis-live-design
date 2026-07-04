---
name: cova-make-design
description: COVA 실서비스의 디자인 패턴 API를 참고 자료로 홈페이지 HTML 시안 한 장을 그 자리에서 생성한다. 레포 clone 없이(빈 폴더에서) curl만으로 동작. "AI 시안 만들기", "HTML 시안 생성", "홈페이지 시안", "시안 초안" 요청 시 사용.
---

# COVA HTML 시안 생성 (독립 실행)

COVA 실서비스에 축적된 사전 분석 패턴을 **공개 HTTP API로** 가져와, 그 패턴을 참고 자료로
홈페이지 HTML 시안 한 장을 직접 생성한다. **COVA 레포를 clone할 필요가 없다** — 이 스킬과 `curl`만
있으면 어느 빈 폴더에서든 동작한다. 생성한 HTML은 현재 작업 폴더에 저장하고, 원하면 COVA에 업로드한다.

**목표:** 예쁜 UI 조각이 아니라, 해당 업종·목적에 맞는 **실제 클라이언트 제안용 웹페이지 시안**을 만든다.
첫 화면만 보고도 (1) 어떤 업종/서비스인지 (2) 사용자가 얻는 가치 (3) 다음 행동 (4) 브랜드 분위기
(5) 무엇을 유도하는 페이지인지가 즉시 이해되어야 한다.

## 설치

이 파일을 `~/.claude/skills/cova-make-design/SKILL.md`로 저장한다(폴더가 없으면 만든다).
그리고 COVA 베이스 URL을 환경변수로 둔다:

```bash
export COVA_API_URL="https://<배포된-COVA-주소>"
# (선택) COVA 업로드를 쓸 때만 필요. COVA studio → "API 토큰"에서 본인 토큰을 발급해 넣는다.
export COVA_DESIGN_TOKEN="<studio에서 발급한 내 토큰>"
```

## 순서

### 1. 요구사항 인터뷰 (먼저, 반드시)

HTML을 만들기 전에 아래를 사용자에게 묻는다. **굵게 표시한 항목은 필수**다.

- **사이트 제목** — 이 시안을 부를 이름(업로드 시 title로 쓰인다). 예: "은성한의원 메인", "무브핏 랜딩".
- 업종/서비스 (예: 한의원, 요가 스튜디오, SaaS, 로컬 카페)
- 페이지 목적 (신뢰·상담유도 / 예약·문의 / 제품·구매 / 브랜드 소개 / 캠페인 중 하나)
- 톤·분위기 (예: 신뢰감 있는 절제된 고급, 활동적·젊은, 따뜻·친근, 공공·안내형)
- 페이지 타입 — `main`(홈) / `subpage`(하위) / `dashboard` 중 하나

**홈페이지(main) 시안이면 추가로 묻는다:**

- 한 줄 소개(슬로건) / 핵심 제공 가치 — hero 카피의 뼈대
- 타깃 고객 (누구를 위한 페이지인가)
- 대표 CTA 하나 — 문의 / 예약 / 구매 / 가입 / 다운로드 중 무엇 (secondary CTA는 선택)
- 넣고 싶은 섹션 구성 — hero, 소개(intro/about), 서비스·제품, 특장점, 진행/이용 절차,
  사례·후기, 가격, FAQ, 연락·문의, 하단 CTA 중에서 (안 정해지면 업종에 맞게 알아서 구성)
- 브랜드 컬러/로고 유무, 선호 색감 (없으면 톤 태그로 보완)
- 실제로 넣을 데이터 유무 — 상호명, 연락처·주소, 실제 문구/후기 (없으면 만들어내지 말고 자연스러운 예시로)
- 이미지 톤 — 실사 / 제품컷 / 일러스트 (실사면 무료 이미지로 채운다)
- 참고하고 싶은 사이트·분위기 (있으면 태그 매핑에 참고)

**마지막에 반드시 묻는다:**

- **추가 요청사항이 있나요?** (자유 입력 — 특정 섹션, 금지 요소, 카피 톤 등)
- **완성되면 COVA에 업로드할까요?** (예/아니오 — 필수 질문. 답을 받아 6단계 진행 여부를 결정한다.)

태그 선택 흐름도 정한다: (a) 알아서 — 위 답을 태그로 매핑, (b) 섹션별 — 히어로/서비스/후기/CTA 타입을 직접 선택.

### 2. 태그 확인

```bash
curl -s "$COVA_API_URL/api/public/design-patterns/tags"
```
→ `{ groups:[{code,label,options:[{code,label}]}] }`. 1단계 답을 방향(업종/목적/톤/구조) 태그로 매핑한다.

### 3. 패턴 검색

태그(라벨 또는 코드, 콤마구분)로 사전 분석 패턴을 가져온다:
```bash
curl -s "$COVA_API_URL/api/public/design-patterns?tags=제안,관광/레저&maxSections=24"
```
→ `{ matchedTags, unmatchedTokens, optionIds, patterns:{ patternSnippets, sections } }`.
`patternSnippets`(시안별 다양화·중복제거된 섹션 패턴)와 `optionIds`를 확보한다. 매칭이 없으면 태그를 넓힌다.

### 4. HTML 생성

`patternSnippets`를 참고해 단일 완결형 HTML을 작성하고 현재 폴더에 `./design-<slug>.html`로 저장한다.
패턴은 **구성·레이아웃·리듬만 참고**하고 그대로 베끼지 않는다. 아래 [디자인 규칙]을 반드시 지킨다.

생성과 함께 **분석·도입 문장 2개**를 만들어 둔다(6단계 업로드 payload의 `analysis`/`approach`로 쓴다):

- **분석(analysis):** 요구사항·선택 태그·참고 패턴을 어떻게 이해했는지 2~3문장. 태그명을 나열하지 말고
  디자인 판단으로 풀어 쓴다. 예: "업종 특성상 신뢰를 먼저 확보해야 하므로 정보 구조를 단정하게 잡고,
  상담 유도 영역은 과하게 강조하지 않았다."
- **도입(approach):** 참고 패턴의 어떤 요소(레이아웃 질서·여백감·타이포 크기감·섹션 리듬)를 이번 시안에
  어떻게 재해석해 반영했는지 1~2문장. "그대로 복사"라는 인상을 주지 않게 쓴다.

### 5. 자체 테스트 (생성 직후, 반드시)

만든 HTML을 실제로 열어 렌더링·정렬·폰트를 점검한다. Playwright MCP가 있으면 그걸로, 없으면
`npx playwright` 또는 로컬 정적 서버로 연 뒤 스크린샷/DOM을 확인한다:

```bash
# 예: 데스크톱 + 모바일 폭에서 스크린샷
npx --yes playwright screenshot --viewport-size=1440,2200 design-<slug>.html shot-desktop.png
npx --yes playwright screenshot --viewport-size=390,1600  design-<slug>.html shot-mobile.png
```

점검 항목(문제가 있으면 **고치고 다시 확인**한다):

- 레이아웃이 깨지거나 요소가 겹치지 않는가. 콘텐츠가 브라우저 끝까지 퍼지지 않고 `.inner` 안에 있는가.
- 섹션들의 좌측 정렬 기준선이 어긋나지 않는가.
- **뱃지·버튼·칩의 텍스트가 세로 정중앙에 오는가** (아래 규칙 참고 — 가장 흔한 결함).
- Pretendard 폰트가 실제로 적용됐는가(시스템 폰트로 폴백되지 않았는가).
- 사용한 외부 이미지가 실제로 로드되는가(깨진 이미지 없음).
- 모바일 폭(≈390px)에서 1열로 자연스럽게 정리되는가.

### 6. (조건부) COVA 업로드

1단계에서 사용자가 "업로드한다"고 했을 때만 진행한다. `COVA_DESIGN_TOKEN`이 필요하다(없으면
로컬 HTML까지만 하고 안내). HTML은 **최대 10MB**까지 허용된다(외부 이미지는 URL 참조라 보통 문제없다).

```bash
# payload.json: { "title","company","pageType"(main|dashboard|subpage),"extraNotes",
#                 "optionIds"[3단계],"html"(전체 HTML 문자열),"analysis"(4단계 분석),
#                 "approach"(4단계 도입),"model":"claude-code" }
curl -s -X POST "$COVA_API_URL/api/public/design-patterns/designs" \
  -H "content-type: application/json" \
  ${COVA_DESIGN_TOKEN:+-H "x-design-token: $COVA_DESIGN_TOKEN"} \
  -d @payload.json
```
→ `{ id, viewerPath }`. 뷰어는 `"$COVA_API_URL""$viewerPath"`. 저장된 시안은 토큰 소유자에게 귀속된다.
`title`은 1단계의 **사이트 제목**, `extraNotes`는 **추가 요청사항**을 넣는다.

### 7. 결과 안내

생성한 로컬 파일 경로, 자체 테스트 결과 요약, (업로드했다면) `ai_designs` id·뷰어 URL을 알린다.

---

## 디자인 규칙 (사람이 만든 시안처럼)

**레이아웃·정렬**
- 모든 콘텐츠는 `.inner`(데스크톱 `max-width: 1180~1240px`, 좌우 패딩 데스크톱 32 / 태블릿 24 / 모바일 20px) 안에 둔다.
- 풀폭 배경은 `section`이 담당하고, 텍스트·버튼·이미지는 그 안의 `.inner`에 배치한다. 콘텐츠가 브라우저 끝에 붙으면 실패.
- 한 페이지의 주요 텍스트 시작점은 같은 좌측 기준선에 맞춘다. 정보형 섹션은 좌측 정렬이 기본, 가운데 정렬은 필요한 곳만.
- 섹션 간격은 정보 흐름에 따라 72 / 96 / 120px로 변주한다(전부 동일 간격 금지). 본문 텍스트 폭은 `max-width: 520~680px`.

**섹션 다양성 (AI스러움 방지)**
- 3열 카드 반복 금지. 텍스트 중심 / 좌텍스트·우이미지 / 좌이미지·우설명 / 넓은 이미지+짧은 설명 / 리스트·단계 / 하단 CTA를 섞는다.
- 섹션마다 밀도·여백·이미지 비율에 차이를 둔다. 모든 섹션을 같은 max-width·radius·shadow로 반복하지 않는다.
- 보라-파랑 그라데이션, 과한 glow, blur blob, 의미 없는 3D 오브젝트, pill 버튼 남발, 과한 그림자 금지.

**타이포 (Pretendard)**
- `<head>`에 Pretendard CDN을 넣는다:
  ```html
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
  ```
- `body`에 `font-family: "Pretendard", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;`
- 제목 `font-weight: 600~700`, 본문 `400~500` / `line-height: 1.6~1.75`. letter-spacing을 과하게 주지 않는다.

**폰트 세로 정렬 (중요 — 가장 흔한 결함)**
- 뱃지·버튼·칩처럼 텍스트를 감싼 작은 박스는 **flex로 중앙 정렬**한다. padding만으로 맞추지 않는다:
  ```css
  .button, .badge, .chip {
    display: inline-flex;
    align-items: center;      /* 세로 정중앙 */
    justify-content: center;  /* 가로 정중앙 */
    line-height: 1;           /* 고정 높이 요소는 1로 두고 padding으로 높이 확보 */
  }
  ```
- 아이콘+텍스트가 함께 들어가면 `gap`으로 간격을 주고, 두 자식 모두 flex 중앙에 오게 한다.
- 고정 `height`를 준 버튼/뱃지는 `line-height`가 글자를 위/아래로 밀지 않는지 5단계에서 반드시 확인한다.

**색·디테일**
- 강조색 1~2개, `border-radius: 6~10px`. 구분은 그림자보다 여백·배경 톤·얇은 선·타이포 위계로 먼저 해결한다.
- CSS 변수를 먼저 정의: `--page-max`, `--side-padding`, `--section-space`, `--color-primary/text/muted/line/bg/bg-soft` 등.

**이미지**
- **무료 이미지 사이트에서 수집**해 실제 URL로 넣는다(플레이스홀더 회색 박스 금지). 예:
  - Unsplash: `https://images.unsplash.com/photo-<id>?w=1200&q=80` (또는 `https://source.unsplash.com/1200x800/?keyword`)
  - Pexels: `https://images.pexels.com/photos/<id>/...jpeg?auto=compress&w=1200`
- hero / 소개 / 사례 영역은 비율을 서로 다르게. `figure`+`figcaption`, 설명형 `alt`를 넣는다.
- 뷰어 CSP는 외부 이미지·폰트(https)와 인라인 CSS를 허용하지만 **스크립트는 차단**한다 →
  JS가 꼭 필요하지 않으면 쓰지 않는다(써도 뷰어에서 실행되지 않는다).

**카피·태그**
- 한국어. "혁신적인/스마트한/최고의/새로운 기준" 같은 추상 문구를 남발하지 않고 업종에 맞는 구체적 문장으로.
- 주어지지 않은 브랜드명·수치·후기·인증마크를 사실처럼 지어내지 않는다.
- 선택 태그는 방향 결정에만 쓰고 화면에 노출하지 않는다. 충돌하는 태그는 업종·목적에 더 맞는 쪽을 우선한다.

## 참고
- 이 스킬은 읽기 API로 패턴을 참고할 뿐, 분석 데이터를 새로 만들거나 백필하지 않는다(COVA 관리자 몫).
- API가 비어 있으면(패턴 0) 아직 분석 데이터가 없는 것 — 관리자에게 백필을 요청한다. 패턴 없이도 위 규칙만으로 생성은 가능하다.
