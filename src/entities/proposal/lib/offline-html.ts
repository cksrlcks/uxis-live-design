// 오프라인 패키지(zip) 안에 들어가는 index.html을 만든다.
//
// 제약이 곧 설계다: 파일을 더블클릭해 file:// 로 열리므로 네트워크가 전혀 없다.
// - fetch/XHR 없음 (file:// 에서 CORS로 막힌다). 이미지는 상대경로 <img src>로만 참조.
// - 외부 폰트/CDN/스크립트 없음. CSS와 JS는 전부 이 문서 안에 인라인.
// - 통신 기능 없음: 채팅·핀코멘트·화이트보드·라이브 커서·실시간 동기화는 전부 빠진다.
//   남는 건 순수 열람 — 안 목록, 슬라이드 보기, 나란히 비교.
//
// 화면 전환은 location.hash로 한다(#/, #/v/0, #/compare). 라우터를 따로 두지 않고도
// 브라우저 뒤로가기가 그대로 동작한다.

export type OfflinePage = { file: string; width: number; height: number };
export type OfflineVariant = { label: string; pages: OfflinePage[] };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// <script> 안에 JSON을 심을 때 "</script>"와 "<!--"가 문서를 조기 종료시키지 않게 막는다.
function escapeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function buildOfflineHtml(title: string, variants: OfflineVariant[]): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  background: #f4f4f5;
  color: #18181b;
  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic",
    "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  -webkit-font-smoothing: antialiased;
}
button { font: inherit; color: inherit; cursor: pointer; }

/* ── 안 목록 ─────────────────────────────────────────── */
/* 100%가 아니라 100vh — 상위(#app)가 auto 높이라 퍼센트 min-height가 풀린다. */
.list { display: flex; flex-direction: column; min-height: 100vh; }
.list-inner {
  flex: 1; display: flex; flex-direction: column; justify-content: center;
  width: 100%; max-width: 1024px; margin: 0 auto; padding: 64px 24px;
}
.list h1 { margin: 0 0 12px; text-align: center; font-size: 30px; font-weight: 600; letter-spacing: -0.02em; }
.list .note { margin: 0 0 40px; text-align: center; font-size: 14px; line-height: 1.6; color: rgba(113,113,122,0.7); }
.cards { display: flex; flex-wrap: wrap; justify-content: center; gap: 28px; }
.card {
  flex: 0 1 calc(33.333% - 18.667px); min-width: 260px;
  display: block; padding: 0; overflow: hidden; text-align: left;
  background: #fff; border: 1px solid rgba(0,0,0,0.03); border-radius: 16px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(0,0,0,0.12);
  transition: transform .2s, box-shadow .2s;
}
.card:hover { transform: translateY(-4px); box-shadow: 0 2px 4px rgba(0,0,0,0.04), 0 18px 40px -16px rgba(0,0,0,0.22); }
.card .thumb { aspect-ratio: 16 / 10; overflow: hidden; background: #e4e4e7; }
.card .thumb img { width: 100%; height: 100%; object-fit: cover; object-position: top; transition: transform .3s; }
.card:hover .thumb img { transform: scale(1.03); }
.card .empty { display: flex; height: 100%; align-items: center; justify-content: center; font-size: 14px; color: #71717a; }
.card .meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-top: 1px solid rgba(0,0,0,0.05); }
.card .meta b { display: block; font-weight: 500; letter-spacing: -0.01em; }
.card .meta span { display: block; margin-top: 2px; font-size: 12px; color: #71717a; }
.card .arrow { flex: none; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 999px; color: #71717a; transition: background .2s, color .2s; }
.card:hover .arrow { background: #18181b; color: #fff; }
.compare-cta { margin: 40px auto 0; padding: 10px 20px; background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 999px; font-size: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.compare-cta:hover { background: #18181b; color: #fff; }
.footer { padding-bottom: 40px; text-align: center; font-size: 13px; letter-spacing: -0.01em; opacity: .4; }

/* ── 슬라이드 보기 ───────────────────────────────────── */
.slides { position: relative; height: 100vh; width: 100%; }
.stage { height: 100%; width: 100%; overflow-x: hidden; overflow-y: auto; background: #f3f4f6; scrollbar-width: none; }
.stage::-webkit-scrollbar { display: none; }
/* 원본 픽셀 폭 그대로 — 온라인 뷰어처럼 축소하지 않고 좁은 화면에선 우측을 자른다. */
.stage img { display: block; margin: 0 auto; max-width: none; user-select: none; }
.counter {
  position: absolute; right: 12px; bottom: 12px; pointer-events: none;
  padding: 4px 8px; border-radius: 4px; font-size: 12px;
  background: rgba(24,24,27,0.8); color: #fafafa;
}

/* ── 나란히 비교 ─────────────────────────────────────── */
.compare { height: 100vh; width: 100%; overflow-x: auto; background: #f4f4f5; }
.compare-cols { display: flex; height: 100%; min-width: fit-content; gap: 24px; padding: 24px 24px 112px; }
.compare-col { display: flex; flex: 1; min-width: 300px; height: 100%; flex-direction: column; }
.compare-col .label { position: sticky; top: 0; z-index: 10; margin-bottom: 12px; flex: none; display: flex; justify-content: center; }
.compare-col .label span { padding: 6px 16px; border-radius: 999px; background: rgba(24,24,27,0.9); color: #fafafa; font-size: 12px; font-weight: 500; }
.compare-col .scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; border: 1px solid rgba(0,0,0,0.15); }
.compare-col .scroll img { display: block; width: 100%; }
.compare-col .scroll img + img { margin-top: 16px; }

/* ── 하단 독 (슬라이드/비교 공용) ─────────────────────── */
.dock {
  position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 20;
  display: flex; align-items: center; gap: 4px; padding: 6px;
  background: rgba(255,255,255,0.92); backdrop-filter: blur(12px);
  border: 1px solid rgba(0,0,0,0.06); border-radius: 999px;
  box-shadow: 0 8px 28px -10px rgba(0,0,0,0.35);
}
.dock button { padding: 7px 14px; border: 0; border-radius: 999px; background: transparent; font-size: 13px; white-space: nowrap; }
.dock button:hover { background: rgba(24,24,27,0.06); }
.dock button.on { background: #18181b; color: #fff; }
.dock .sep { width: 1px; height: 20px; margin: 0 4px; background: rgba(0,0,0,0.08); }
.dock .page { padding: 0 4px; font-size: 13px; font-variant-numeric: tabular-nums; color: #52525b; }

@media (max-width: 900px) { .card { flex-basis: calc(50% - 14px); } }
@media (max-width: 640px) { .card { flex-basis: 100%; } .list-inner { padding: 40px 16px; } }
</style>
</head>
<body>
<div id="app"></div>
<script>
(function () {
  "use strict";
  var TITLE = ${escapeJson(title)};
  var VARIANTS = ${escapeJson(variants)};

  var app = document.getElementById("app");

  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function go(hash) { location.hash = hash; }

  var ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg>';

  // ── 안 목록 ──────────────────────────────────────────
  function renderList() {
    var cards = VARIANTS.map(function (v, i) {
      var thumb = v.pages.length
        ? '<img src="' + esc(v.pages[0].file) + '" alt="' + esc(v.label) + '" loading="lazy">'
        : '<div class="empty">미리보기 없음</div>';
      return (
        '<button class="card" type="button" data-index="' + i + '">' +
          '<div class="thumb">' + thumb + '</div>' +
          '<div class="meta">' +
            '<div><b>' + esc(v.label) + '</b><span>' + v.pages.length + ' pages</span></div>' +
            '<div class="arrow">' + ARROW + '</div>' +
          '</div>' +
        '</button>'
      );
    }).join("");

    var compare = VARIANTS.length > 1
      ? '<button class="compare-cta" type="button" id="go-compare">나란히 비교하기</button>'
      : "";

    var view = el(
      '<div class="list">' +
        '<div class="list-inner">' +
          '<h1>' + esc(TITLE) + '</h1>' +
          '<p class="note">본 자료는 1920×1080(FHD) 해상도에 최적화되어 있습니다.<br>정확한 확인을 위해 데스크탑 환경에서 열람해 주시기 바랍니다.</p>' +
          '<div class="cards">' + cards + '</div>' +
          compare +
        '</div>' +
        '<div class="footer">powered by cova</div>' +
      '</div>'
    );

    view.querySelectorAll(".card").forEach(function (card) {
      card.addEventListener("click", function () { go("#/v/" + card.dataset.index); });
    });
    var cta = view.querySelector("#go-compare");
    if (cta) cta.addEventListener("click", function () { go("#/compare"); });
    return view;
  }

  // ── 슬라이드 보기 ────────────────────────────────────
  function renderSlides(variantIndex) {
    var variant = VARIANTS[variantIndex];
    var pages = variant.pages;
    var index = 0;

    var view = el(
      '<div class="slides">' +
        '<div class="stage"></div>' +
        '<div class="counter"></div>' +
        '<div class="dock">' +
          '<button type="button" data-act="list">목록</button>' +
          '<div class="sep"></div>' +
          '<button type="button" data-act="prev" aria-label="이전 페이지">‹</button>' +
          '<span class="page"></span>' +
          '<button type="button" data-act="next" aria-label="다음 페이지">›</button>' +
        '</div>' +
      '</div>'
    );

    var stage = view.querySelector(".stage");
    var counter = view.querySelector(".counter");
    var pageLabel = view.querySelector(".page");

    function draw() {
      if (!pages.length) {
        stage.innerHTML = '<div class="empty" style="padding:32px">페이지가 없습니다.</div>';
        counter.textContent = "";
        pageLabel.textContent = "0/0";
        return;
      }
      var page = pages[index];
      // 통째로 갈아끼워 스크롤을 맨 위로 되돌린다(온라인 뷰어의 key 리마운트와 같은 동작).
      stage.innerHTML = '<img src="' + esc(page.file) + '" alt="" width="' + page.width + '" height="' + page.height + '" draggable="false">';
      stage.scrollTop = 0;
      counter.textContent = index + 1 + "/" + pages.length;
      pageLabel.textContent = index + 1 + "/" + pages.length;
    }

    function move(step) {
      if (!pages.length) return;
      index = (index + step + pages.length) % pages.length;
      draw();
    }

    stage.addEventListener("click", function () { move(1); });
    view.querySelector(".dock").addEventListener("click", function (e) {
      var act = e.target.closest("button") && e.target.closest("button").dataset.act;
      if (act === "list") go("#/");
      else if (act === "prev") move(-1);
      else if (act === "next") move(1);
    });

    view.onKey = function (e) {
      if (e.key === "ArrowRight") move(1);
      else if (e.key === "ArrowLeft") move(-1);
      else if (e.key === "Escape") go("#/");
    };

    draw();
    return view;
  }

  // ── 나란히 비교 ──────────────────────────────────────
  function renderCompare() {
    var cols = VARIANTS.map(function (v) {
      var imgs = v.pages.length
        ? v.pages.map(function (p) { return '<img src="' + esc(p.file) + '" alt="" loading="lazy">'; }).join("")
        : '<div class="empty" style="padding:64px 0">미리보기 없음</div>';
      return (
        '<div class="compare-col">' +
          '<div class="label"><span>' + esc(v.label) + '</span></div>' +
          '<div class="scroll">' + imgs + '</div>' +
        '</div>'
      );
    }).join("");

    var view = el(
      '<div class="compare">' +
        '<div class="compare-cols">' + cols + '</div>' +
        '<div class="dock"><button type="button" data-act="list">목록</button></div>' +
      '</div>'
    );
    view.querySelector(".dock").addEventListener("click", function () { go("#/"); });
    view.onKey = function (e) { if (e.key === "Escape") go("#/"); };
    return view;
  }

  // ── 라우팅 ───────────────────────────────────────────
  var current = null;

  function route() {
    var hash = location.hash || "#/";
    var slide = hash.match(/^#\\/v\\/(\\d+)$/);
    if (slide && VARIANTS[Number(slide[1])]) current = renderSlides(Number(slide[1]));
    else if (hash === "#/compare" && VARIANTS.length > 1) current = renderCompare();
    else current = renderList();

    app.replaceChildren(current);
    window.scrollTo(0, 0);
  }

  window.addEventListener("keydown", function (e) {
    if (current && current.onKey) current.onKey(e);
  });
  window.addEventListener("hashchange", route);
  route();
})();
</script>
</body>
</html>
`;
}
