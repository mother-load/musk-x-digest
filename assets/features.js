// features.js — カウントダウン・終了のお知らせ・NEW バッジ・絞り込みと検索
(function () {
  var HOUR = 3600 * 1000;

  // ---- 更新の予定（日本時間 10/15・10/16 の 8・11・14・17・20 時） ----
  var SCHEDULE = [];
  [15, 16].forEach(function (day) {
    [8, 11, 14, 17, 20].forEach(function (h) {
      SCHEDULE.push(new Date(Date.UTC(2026, 9, day, h - 9))); // 日本時間 = 世界標準時 + 9時間
    });
  });
  var END = SCHEDULE[SCHEDULE.length - 1];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // ---- 1. 次回更新までのカウントダウン（ヘッダーにあるので最初に1回だけ準備） ----
  var countdown = document.getElementById('countdown');
  function tick() {
    var now = new Date();
    var next = null;
    for (var i = 0; i < SCHEDULE.length; i++) {
      if (SCHEDULE[i] > now) { next = SCHEDULE[i]; break; }
    }
    if (!next) {
      countdown.textContent = '更新は終了しました';
      return false;
    }
    var s = Math.floor((next - now) / 1000);
    var jst = new Date(next.getTime() + 9 * HOUR);
    countdown.textContent = '次のレポート予定（' + (jst.getUTCMonth() + 1) + '/' + jst.getUTCDate() + ' ' +
      pad(jst.getUTCHours()) + ':00）まで ' + Math.floor(s / 3600) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
    return true;
  }
  if (countdown) {
    countdown.hidden = false;
    if (tick()) {
      var timer = setInterval(function () { if (!tick()) clearInterval(timer); }, 1000);
    }
  }

  // 本文中の「https://〜」という文字を、押せるリンクに変える
  var URL_PATTERN = /https?:\/\/[^\s<>"'「」（）()]+/g;
  function linkify(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (node.parentNode.closest('a, code, pre')) return NodeFilter.FILTER_REJECT;
        URL_PATTERN.lastIndex = 0;
        return URL_PATTERN.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var text = node.nodeValue, frag = document.createDocumentFragment(), last = 0, m;
      URL_PATTERN.lastIndex = 0;
      while ((m = URL_PATTERN.exec(text))) {
        var url = m[0].replace(/[。、.,!?！？]+$/, ''); // 文末の句読点はリンクに含めない
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var a = document.createElement('a');
        a.href = url;
        a.textContent = url;
        frag.appendChild(a);
        last = m.index + url.length;
      }
      frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  // 外部サイトへのリンクは新しいタブで開く（このサイトの BGM を止めないため）
  function openExternalInNewTab(root) {
    Array.prototype.forEach.call(root.querySelectorAll('a[href]'), function (a) {
      if (a.origin && a.origin !== location.origin) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
    });
  }

  // ---- ここから下は、ページの中身が替わるたびに実行する ----
  function initPage() {
    var body = document.querySelector('.post-body');
    if (body) linkify(body);
    var main = document.querySelector('.site-main');
    if (main) openExternalInNewTab(main);

    // 10. 終了のお知らせ
    var endNotice = document.getElementById('end-notice');
    if (endNotice && new Date() >= END) endNotice.hidden = false;

    // 2. NEW バッジ（3時間以内のレポート）
    var now = Date.now();
    Array.prototype.forEach.call(document.querySelectorAll('.post-item'), function (item) {
      var time = item.querySelector('time');
      var badge = item.querySelector('.new-badge');
      if (!time || !badge) return;
      var t = new Date(time.getAttribute('datetime')).getTime();
      if (now - t < 3 * HOUR && t - now < 0.5 * HOUR) badge.hidden = false;
    });

    // 5・7. テーマで絞り込み・キーワード検索
    var list = document.getElementById('report-list');
    var filter = document.getElementById('topic-filter');
    var search = document.getElementById('report-search');
    var result = document.getElementById('filter-result');
    if (!list || !filter || !search) return;

    var items = Array.prototype.slice.call(list.querySelectorAll('.post-item'));
    var chips = Array.prototype.slice.call(filter.querySelectorAll('.chip'));
    var activeTopic = '';

    function topicsOf(item) { return (item.getAttribute('data-topics') || '').split(/\s+/); }

    // そのテーマのレポートが1件もないボタンは隠す
    chips.forEach(function (chip) {
      var key = chip.getAttribute('data-topic');
      if (key && !items.some(function (it) { return topicsOf(it).indexOf(key) !== -1; })) chip.hidden = true;
    });
    // 「すべて」しか残らないときは、絞り込み自体を出さない
    if (chips.every(function (c) { return c.hidden || !c.getAttribute('data-topic'); })) filter.hidden = true;

    function apply() {
      var q = search.value.trim().toLowerCase();
      var shown = 0;
      items.forEach(function (item) {
        var okTopic = !activeTopic || topicsOf(item).indexOf(activeTopic) !== -1;
        var okText = !q || (item.getAttribute('data-search') || '').toLowerCase().indexOf(q) !== -1;
        item.hidden = !(okTopic && okText);
        if (!item.hidden) shown++;
      });
      if (!activeTopic && !q) { result.hidden = true; return; }
      result.hidden = false;
      result.textContent = shown ? shown + ' 件のレポート' : '該当するレポートはありません';
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        activeTopic = chip.getAttribute('data-topic');
        chips.forEach(function (c) { c.classList.toggle('is-active', c === chip); });
        apply();
      });
    });
    search.addEventListener('input', apply);
  }

  initPage();
  document.addEventListener('page:load', initPage); // nav.js がページを差し替えたとき
})();
