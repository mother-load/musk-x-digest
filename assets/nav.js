// nav.js — サイト内のページ移動を「本文の差し替え」で行い、BGM を途切れさせない
// ブラウザはページを読み込み直すと音を止めてしまうため、サイト内のリンクを押したときは
// 新しいページを裏で取ってきて <main> の中身とタイトルだけを入れ替える。
(function () {
  if (!window.fetch || !window.DOMParser || !history.pushState) return; // 古いブラウザは普通に移動

  var main = document.querySelector('.site-main');
  var base = new URL(document.querySelector('.site-title').href); // サイトのトップ（/musk-x-digest/）
  var busy = false;

  // サイト内のページへのリンクだけを対象にする（画像・RSS・外部サイトなどは普通に開く）
  function isInternalPage(a, e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    if (a.target && a.target !== '_self') return false;
    if (a.hasAttribute('download')) return false;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return false;
    if (url.pathname.indexOf(base.pathname) !== 0) return false;
    if (/\.(?!html?$)[a-z0-9]+$/i.test(url.pathname)) return false; // .xml や .jpg などのファイル
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return false; // 同じページ内の移動
    return true;
  }

  function show(url, push) {
    if (busy) return;
    busy = true;
    main.classList.add('is-leaving');
    fetch(url, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error(res.status);
        return res.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var next = doc.querySelector('.site-main');
        if (!next) throw new Error('no main');
        if (push) history.pushState({ nav: true }, '', url);
        document.title = doc.title;
        main.innerHTML = next.innerHTML;
        main.classList.remove('is-leaving');
        var target = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
        if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
        main.focus({ preventScroll: true });
        document.dispatchEvent(new CustomEvent('page:load'));
      })
      .catch(function () {
        location.href = url; // うまくいかなければ普通に移動する
      })
      .then(function () { busy = false; });
  }

  main.setAttribute('tabindex', '-1'); // 移動後に読み上げソフトなどが本文から読めるように

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || !isInternalPage(a, e)) return;
    e.preventDefault();
    var url = new URL(a.href, location.href);
    if (url.href === location.href) return;
    show(url, true);
  });

  // ブラウザの「戻る」「進む」
  history.replaceState({ nav: true }, '');
  window.addEventListener('popstate', function (e) {
    if (e.state && e.state.nav) show(new URL(location.href), false);
  });
})();
