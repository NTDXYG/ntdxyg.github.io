(function () {
  'use strict';

  var root = document.documentElement;
  var state = { data: null, lang: 'zh', rank: null };

  var langToggle = document.getElementById('lang-toggle');
  var themeOptions = document.querySelectorAll('.theme-option');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var navEl = document.getElementById('nav');
  var sidebarEl = document.getElementById('sidebar');
  var contentEl = document.getElementById('content-body');
  var copyrightEl = document.getElementById('copyright');
  var updatedEl = document.getElementById('updated');
  var skipLink = document.getElementById('skip-link');
  var errorEl = document.getElementById('load-error');

  var ICONS = {
    mail: '<rect x="2.5" y="4.5" width="19" height="15" rx="1.5"/><path d="m3 6.5 9 6.5 9-6.5"/>',
    scholar: '<path d="M12 3.5 1.8 8.6 12 13.7l10.2-5.1L12 3.5Z"/><path d="M5.6 11v4.4c0 1.8 2.9 3.2 6.4 3.2s6.4-1.4 6.4-3.2V11"/>',
    github: '<path d="M9 19.5c-3.5 1-3.5-1.8-5-2.2m10 4.2v-3.4c0-1 .1-1.4-.5-2 2.3-.3 4.5-1.2 4.5-5a3.9 3.9 0 0 0-1.1-2.7 3.6 3.6 0 0 0-.1-2.7s-1.1-.3-3.5 1.4a8.6 8.6 0 0 0-4.6 0C6.3 5.4 5.2 5.7 5.2 5.7a3.6 3.6 0 0 0-.1 2.7A3.9 3.9 0 0 0 4 11.1c0 3.8 2.2 4.7 4.5 5-.4.4-.5.9-.5 1.6V21"/>',
    orcid: '<circle cx="12" cy="12" r="9"/><path d="M9.2 8.6v7"/><circle cx="9.2" cy="6.9" r=".7" fill="currentColor" stroke="none"/><path d="M12.4 8.6h2.3a3.5 3.5 0 0 1 0 7h-2.3v-7Z"/>',
    cv: '<path d="M13.5 3H6.8A1.8 1.8 0 0 0 5 4.8v14.4A1.8 1.8 0 0 0 6.8 21h10.4a1.8 1.8 0 0 0 1.8-1.8V8.5L13.5 3Z"/><path d="M13.5 3v5.5H19"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>'
  };

  function icon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  function t(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    return value[state.lang] || value.en || value.zh || '';
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (!attrs) return node;
    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key === 'class') node.className = value;
      else node.setAttribute(key, value);
    });
    return node;
  }

  /* ---------- Theme ---------- */

  function applyTheme(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch (e) { /* ignore */ }

    Array.prototype.forEach.call(themeOptions, function (option) {
      option.setAttribute('aria-pressed', String(option.dataset.themeValue === theme));
    });
    if (themeMeta) {
      themeMeta.setAttribute('content', theme === 'dark' ? '#0f1113' : '#ffffff');
    }
  }

  Array.prototype.forEach.call(themeOptions, function (option) {
    option.addEventListener('click', function () {
      applyTheme(option.dataset.themeValue === 'dark' ? 'dark' : 'light');
    });
  });

  /* ---------- Language ---------- */

  function applyLang(lang) {
    state.lang = lang === 'zh' ? 'zh' : 'en';
    root.dataset.lang = state.lang;
    root.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
    try { localStorage.setItem('lang', state.lang); } catch (e) { /* ignore */ }

    if (langToggle) {
      langToggle.value = state.lang;
      langToggle.setAttribute('aria-label', state.lang === 'zh' ? '语言' : 'Language');
    }
    applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');
    paintQuip();
  }

  if (langToggle) {
    langToggle.addEventListener('change', function () {
      applyLang(langToggle.value);
      render();
    });
  }

  /* ---------- Render: nav ---------- */

  function renderNav() {
    navEl.innerHTML = '';
    (state.data.nav || []).forEach(function (item) {
      navEl.appendChild(el('a', { href: item.href, text: t(item.label) }));
    });
  }

  /* ---------- Render: sidebar ---------- */

  function renderSidebar() {
    var p = state.data.profile;
    sidebarEl.innerHTML = '';

    sidebarEl.appendChild(el('img', {
      class: 'portrait',
      src: p.photo,
      alt: t(p.photoAlt),
      width: '600',
      height: '750'
    }));

    var identity = el('div', { class: 'identity' });
    identity.appendChild(el('h1', { text: t(p.name) }));
    identity.appendChild(el('p', { class: 'role', text: t(p.role) }));
    sidebarEl.appendChild(identity);

    var metrics = el('dl', { class: 'metrics', 'aria-label': 'Metrics' });
    (p.metrics || []).forEach(function (metric) {
      var row = el('div');
      row.appendChild(el('dt', { text: t(metric.label) }));
      row.appendChild(el('dd', { text: metric.value }));
      metrics.appendChild(row);
    });
    sidebarEl.appendChild(metrics);

    var contacts = el('ul', { class: 'side-contact' });
    (p.contacts || []).forEach(function (contact) {
      var node;

      if (contact.action === 'print-cv') {
        node = el('button', {
          class: 'cv-print',
          type: 'button',
          'aria-label': t(contact.label)
        });
        node.addEventListener('click', printCv);
      } else {
        node = el('a', { href: contact.href });
        if (contact.external) {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener');
        }
      }

      node.innerHTML = icon(contact.icon) + '<span></span>';
      node.querySelector('span').textContent = t(contact.label);

      var item = el('li');
      item.appendChild(node);
      contacts.appendChild(item);
    });
    sidebarEl.appendChild(contacts);

    if (p.collaboration) {
      var card = el('section', { class: 'side-block side-card' });
      card.appendChild(el('p', { class: 'card-title', text: t(p.collaboration.title) }));
      card.appendChild(el('p', { class: 'card-text', text: t(p.collaboration.text) }));
      card.appendChild(el('a', {
        class: 'card-link',
        href: 'mailto:' + p.collaboration.email,
        text: p.collaboration.email
      }));
      sidebarEl.appendChild(card);
    }

    if (p.meta) {
      var meta = el('div', { class: 'side-meta' });
      var item = el('p', { class: 'meta-item' });
      item.innerHTML = icon('clock') + '<span class="local-time"></span>';
      meta.appendChild(item);
      sidebarEl.appendChild(meta);
      tickClock();
    }
  }

  /* ---------- Render: sections ---------- */

  function sectionHead(section) {
    return el('h2', { text: t(section.title) });
  }

  function bodyWrap() {
    return el('div', { class: 'section-body' });
  }

  function renderInterests(section) {
    var body = bodyWrap();
    var list = el('dl', { class: 'interests' });

    (section.items || []).forEach(function (item) {
      var row = el('div', { class: 'interest' });
      row.appendChild(el('dt', { text: t(item.term) }));
      row.appendChild(el('dd', { text: t(item.desc) }));
      list.appendChild(row);
    });

    body.appendChild(list);
    return body;
  }

  function renderTimeline(section) {
    var body = bodyWrap();
    var list = el('ul', { class: 'rows' });

    (section.items || []).forEach(function (item) {
      var row = el('li', { class: 'row' });
      row.appendChild(el('div', { class: 'when', text: item.date }));

      var what = el('div', { class: 'what' });
      var primary = el('p', { class: 'primary' });
      primary.appendChild(document.createTextNode(t(item.org)));
      primary.appendChild(el('span', { class: 'duty', text: t(item.duty) }));
      what.appendChild(primary);

      if (item.advisor) {
        var advisor = el('p', { class: 'advisor' });
        advisor.appendChild(document.createTextNode(t(item.advisor.label) + ' '));
        advisor.appendChild(el('a', {
          href: item.advisor.url,
          target: '_blank',
          rel: 'noopener',
          text: t(item.advisor.name)
        }));
        what.appendChild(advisor);
      }

      row.appendChild(what);
      list.appendChild(row);
    });

    body.appendChild(list);
    return body;
  }

  function renderProjects(section) {
    var body = bodyWrap();
    var list = el('ul', { class: 'rows' });

    (section.items || []).forEach(function (item) {
      var row = el('li', { class: 'row' });
      row.appendChild(el('div', { class: 'when', text: item.date }));

      var what = el('div', { class: 'what' });
      what.appendChild(el('p', { class: 'primary', text: t(item.title) }));

      var meta = el('p', { class: 'project-meta' });
      meta.appendChild(el('span', { class: 'funder', text: t(item.funder) }));
      meta.appendChild(el('span', { class: 'amount', text: t(item.amount) }));
      what.appendChild(meta);

      row.appendChild(what);
      list.appendChild(row);
    });

    body.appendChild(list);
    return body;
  }

  function printCv() {
    var previous = document.title;
    var profile = state.data && state.data.profile;
    var name = profile ? t(profile.name) : '';

    if (name) document.title = name + ' - CV';

    var restore = function () {
      document.title = previous;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);

    window.print();
  }

  function rankSystemLabel(section) {
    var found = null;

    ((section.rank || {}).systems || []).forEach(function (system) {
      if (system.key === state.rank) found = system;
    });

    return found ? t(found.label) : '';
  }

  var CCF_RANK = { A: 1, B: 2, C: 3 };

  var BUCKETS = {
    1: { zh: 'CCF-A / 一区', en: 'CCF-A / Q1' },
    2: { zh: 'CCF-B / 二区', en: 'CCF-B / Q2' }
  };

  function zoneRank(zone) {
    var value = Number(zone);
    return value >= 1 && value <= 4 ? value : 9;
  }

  function ccfRank(group) {
    var letter = (group.ccf || '').trim().slice(-1).toUpperCase();
    return CCF_RANK[letter] || 9;
  }

  function itemRankValue(item, key) {
    var rank = item ? item.rank : null;
    if (rank === null || rank === undefined) return null;
    if (typeof rank === 'number') return rank;
    return rank[key] === undefined ? null : rank[key];
  }

  function itemZoneRank(item) {
    var rank = zoneRank(itemRankValue(item, state.rank));
    return rank < 9 ? rank : null;
  }

  function hasAnyZone(item) {
    var rank = item ? item.rank : null;
    if (rank === null || rank === undefined) return false;
    if (typeof rank === 'number') return zoneRank(rank) < 9;
    return Object.keys(rank).some(function (key) {
      return zoneRank(rank[key]) < 9;
    });
  }

  function itemBucket(section, group, item) {
    var rank = itemZoneRank(item);

    if (!group.ccf) {
      if (rank === null) return 0;
      return rank === 1 ? 1 : 2;
    }

    var base = ccfRank(group);
    var best = rank === null ? base : Math.min(base, rank);
    return best === 1 ? 1 : 2;
  }

  function bucketLabel(bucket) {
    return t(BUCKETS[bucket] || BUCKETS[2]);
  }

  function noteCounts(buckets) {
    var zh = state.lang === 'zh';
    var parts = [];

    [1, 2].forEach(function (bucket) {
      var count = buckets[bucket].length;
      if (!count) return;
      parts.push(zh
        ? bucketLabel(bucket) + ' ' + count + ' 篇'
        : bucketLabel(bucket) + ' · ' + count + (count === 1 ? ' paper' : ' papers'));
    });

    return parts.join(zh ? '；' : '; ');
  }

  function selfNames(section) {
    var names = (section && section.self) || [];
    return Array.isArray(names) ? names : [names];
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function authorTokens(item) {
    return String(item.authors || '').split(',').map(function (name) {
      return name.trim();
    }).filter(Boolean);
  }

  function authorName(token) {
    return token.replace(/\*/g, '').replace(/\.$/, '').trim();
  }

  function selfIndex(section, item) {
    var names = selfNames(section);
    var tokens = authorTokens(item);
    for (var i = 0; i < tokens.length; i++) {
      if (names.indexOf(authorName(tokens[i])) !== -1) return i;
    }
    return -1;
  }

  function renderAuthors(section, item) {
    var index = selfIndex(section, item);

    return authorTokens(item).map(function (token, i) {
      var corresponding = token.indexOf('*') !== -1;
      var name = authorName(token);
      var period = /\.$/.test(token.trim());
      var html = escapeHtml(name);

      if (i === index) {
        html = '<span class="' + (i === 0 ? 'me' : 'me-plain') + '">' + html + '</span>';
      }
      if (corresponding) html += '<sup>*</sup>';
      if (period) html += '.';
      return html;
    }).join(', ');
  }

  function itemOrder(section, item) {
    if (/major\s+revision/i.test(item.venue || '')) return 3;

    var index = selfIndex(section, item);
    if (index === 0) return 0;
    if (index > 0) return 1;
    return 2;
  }

  function sortItems(section, items) {
    return (items || []).slice().sort(function (a, b) {
      return itemOrder(section, a) - itemOrder(section, b);
    });
  }

  function printCv() {
    var previous = document.title;
    var profile = state.data && state.data.profile;
    var name = profile ? t(profile.name) : '';

    if (name) document.title = name + ' - CV';

    var restore = function () {
      document.title = previous;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);

    window.print();
  }

  function rankSystemLabel(section) {
    var found = null;

    ((section.rank || {}).systems || []).forEach(function (system) {
      if (system.key === state.rank) found = system;
    });

    return found ? t(found.label) : '';
  }

  function buildRankSwitch(section) {
    var cfg = section.rank || {};
    var systems = cfg.systems || [];
    if (!systems.length) return null;

    var keys = systems.map(function (system) { return system.key; });
    if (keys.indexOf(state.rank) === -1) {
      state.rank = keys.indexOf(cfg.default) === -1 ? keys[0] : cfg.default;
    }

    var wrap = el('div', { class: 'seg seg-rank', role: 'group', 'aria-label': t(cfg.label) });
    wrap.style.setProperty('--seg-count', String(systems.length));
    wrap.appendChild(el('span', { class: 'seg-thumb', 'aria-hidden': 'true' }));

    var index = 0;
    systems.forEach(function (system, i) {
      var active = system.key === state.rank;
      if (active) index = i;

      var button = el('button', {
        class: 'seg-option',
        type: 'button',
        'data-rank': system.key,
        'aria-pressed': String(active),
        text: t(system.label)
      });
      button.addEventListener('click', function () { setRank(system.key); });
      wrap.appendChild(button);
    });

    wrap.style.setProperty('--seg-index', String(index));
    return wrap;
  }

  function setRank(key) {
    if (state.rank === key) return;
    state.rank = key;
    try { localStorage.setItem('rank', key); } catch (e) { /* ignore */ }

    var wrap = document.querySelector('.seg-rank');
    if (wrap) {
      var options = wrap.querySelectorAll('.seg-option');
      Array.prototype.forEach.call(options, function (option, i) {
        var active = option.dataset.rank === key;
        option.setAttribute('aria-pressed', String(active));
        if (active) wrap.style.setProperty('--seg-index', String(i));
      });
    }

    if (state.pubBody && state.pubSection) {
      var focused = document.activeElement && document.activeElement.dataset
        ? document.activeElement.dataset.rank
        : null;
      fillPublications(state.pubBody, state.pubSection);
      if (focused) {
        var again = state.pubBody.querySelector('.seg-option[data-rank="' + focused + '"]');
        if (again) again.focus({ preventScroll: true });
      }
    }
  }

  function renderPublications(section) {
    var body = bodyWrap();
    state.pubBody = body;
    state.pubSection = section;
    fillPublications(body, section);
    return body;
  }

  function resolveRank(section) {
    var cfg = section.rank || {};
    var systems = cfg.systems || [];
    if (!systems.length) return;

    var keys = systems.map(function (system) { return system.key; });
    if (keys.indexOf(state.rank) !== -1) return;

    state.rank = keys.indexOf(cfg.default) === -1 ? keys[0] : cfg.default;
  }

  function fillPublications(body, section) {
    body.innerHTML = '';

    resolveRank(section);

    var buckets = { 1: [], 2: [] };
    var plain = [];

    (section.groups || []).forEach(function (group) {
      var graded = !!group.ccf || (group.items || []).some(function (item) {
        return hasAnyZone(item);
      });

      if (!graded) {
        plain.push(group);
        return;
      }

      (group.items || []).forEach(function (item) {
        var bucket = itemBucket(section, group, item);
        if (!bucket) return;
        buckets[bucket].push(item);
      });
    });

    var bar = el('div', { class: 'pub-bar' });
    var note = el('p', { class: 'note', html: t(section.note) });

    var counts = noteCounts(buckets);
    if (counts) note.appendChild(el('span', { class: 'note-count', text: counts }));

    var rankName = rankSystemLabel(section);
    if (rankName) {
      note.appendChild(el('span', {
        class: 'note-rank print-only',
        text: (state.lang === 'zh' ? '分区体系：' : 'Ranking: ') + rankName
      }));
    }

    bar.appendChild(note);

    var switcher = buildRankSwitch(section);
    if (switcher) bar.appendChild(switcher);

    body.appendChild(bar);

    [1, 2].forEach(function (bucket) {
      if (!buckets[bucket].length) return;

      body.appendChild(el('h3', { class: 'group', text: bucketLabel(bucket) }));

      var list = el('ol', { class: 'pubs' });
      sortItems(section, buckets[bucket]).forEach(function (item) {
        var entry = el('li');
        entry.appendChild(el('p', { class: 'pub-title', text: item.title }));
        entry.appendChild(el('p', { class: 'pub-authors', html: renderAuthors(section, item) }));
        entry.appendChild(el('p', { class: 'pub-venue', text: item.venue }));
        list.appendChild(entry);
      });
      body.appendChild(list);
    });

    plain.forEach(function (group) {
      body.appendChild(el('h3', { class: 'group', text: t(group.title) }));

      var extra = el('ol', { class: 'pubs' });
      sortItems(section, group.items).forEach(function (item) {
        var entry = el('li');
        entry.appendChild(el('p', { class: 'pub-title', text: item.title }));
        entry.appendChild(el('p', { class: 'pub-authors', html: renderAuthors(section, item) }));
        entry.appendChild(el('p', { class: 'pub-venue', text: item.venue }));
        extra.appendChild(entry);
      });
      body.appendChild(extra);
    });

    return body;
  }

  function renderService(section) {
    var body = bodyWrap();
    var cols = el('div', { class: 'service-cols' });

    (section.columns || []).forEach(function (column) {
      var wrap = el('div');
      wrap.appendChild(el('h3', { text: t(column.title) }));

      var list = el('ul');
      (column.items || []).forEach(function (item) {
        list.appendChild(el('li', { text: t(item) }));
      });

      wrap.appendChild(list);
      cols.appendChild(wrap);
    });

    body.appendChild(cols);
    return body;
  }

  var RENDERERS = {
    interests: renderInterests,
    timeline: renderTimeline,
    projects: renderProjects,
    publications: renderPublications,
    service: renderService
  };

  function renderContent() {
    contentEl.innerHTML = '';
    contentEl.appendChild(el('p', { class: 'lede', text: t(state.data.intro) }));

    (state.data.sections || []).forEach(function (section) {
      var node = el('section', { class: 'section', id: section.id });
      node.appendChild(sectionHead(section));

      var renderer = RENDERERS[section.type];
      if (renderer) node.appendChild(renderer(section));

      contentEl.appendChild(node);
    });
  }

  /* ---------- Render: footer ---------- */

  function renderFooter() {
    var footer = state.data.site.footer || {};
    var year = String(new Date().getFullYear());

    if (copyrightEl) copyrightEl.textContent = t(footer.copyright).replace('{year}', year);
    if (updatedEl) updatedEl.textContent = t(footer.updated);
    if (skipLink) skipLink.textContent = t(state.data.site.skipLink);
  }

  function render() {
    if (!state.data) return;
    renderNav();
    renderSidebar();
    renderContent();
    renderFooter();
    updateActive();
  }

  /* ---------- Clock ---------- */

  function tickClock() {
    var nodes = document.querySelectorAll('.local-time');
    if (!nodes.length) return;

    var meta = state.data && state.data.profile.meta;
    if (!meta) return;

    var hhmm;
    try {
      hhmm = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: meta.timezone
      }).format(new Date());
    } catch (e) {
      hhmm = new Date().toTimeString().slice(0, 5);
    }

    Array.prototype.forEach.call(nodes, function (node) {
      node.textContent = meta.location + ' ' + hhmm;
    });
  }

  window.setInterval(tickClock, 30000);

  /* ---------- Nav highlight ---------- */

  function updateActive() {
    var links = Array.prototype.slice.call(navEl.querySelectorAll('a'));
    var sections = links
      .map(function (link) { return document.getElementById(link.getAttribute('href').slice(1)); })
      .filter(Boolean);

    if (!sections.length) return;

    if (window.scrollY < 90) {
      links.forEach(function (link) { link.classList.remove('active'); });
      return;
    }

    var current = sections[0];
    sections.forEach(function (section) {
      if (section.getBoundingClientRect().top <= 140) current = section;
    });

    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8) {
      current = sections[sections.length - 1];
    }

    links.forEach(function (link) {
      link.classList.toggle('active', link.getAttribute('href') === '#' + current.id);
    });
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      updateActive();
      ticking = false;
    });
  }, { passive: true });

  /* ---------- Widgets ---------- */

  var quipEl = document.getElementById('quip');
  var quipText = '';

  function paintQuip() {
    if (!quipEl) return;
    var show = !!quipText && state.lang === 'zh';
    quipEl.hidden = !show;
    quipEl.textContent = show ? quipText : '';
  }

  function loadQuip() {
    if (!quipEl || !window.fetch) return;

    fetch('https://v1.hitokoto.cn/?c=d&c=i&c=k&min_length=12&max_length=16&encode=json', { cache: 'no-store' })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (data) {
        if (!data || !data.hitokoto) return;
        quipText = '「' + data.hitokoto + '」';
        paintQuip();
      })
      .catch(function () { /* ignore */ });
  }

  /* ---------- Boot ---------- */

  function loadJSON(path) {
    return fetch(path, { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error(path + ' → HTTP ' + response.status);
      return response.json();
    });
  }

  function loadSite() {
    return loadJSON('data/site.json').then(function (site) {
      var sectionLoads = (site.sections || []).map(function (section) {
        return loadJSON(section.file).then(function (content) {
          return Object.assign({}, section, content);
        });
      });

      return Promise.all([loadJSON(site.profile), Promise.all(sectionLoads)])
        .then(function (results) {
          site.profile = results[0];
          site.sections = results[1];
          return site;
        });
    });
  }

  try {
    var savedRank = localStorage.getItem('rank');
    if (savedRank) state.rank = savedRank;
  } catch (e) { /* ignore */ }

  var savedLang = null;
  try {
    savedLang = localStorage.getItem('lang');
  } catch (e) { /* ignore */ }

  applyLang(savedLang === 'zh' || savedLang === 'en' ? savedLang : state.lang);
  loadQuip();

  loadSite()
    .then(function (data) {
      state.data = data;
      if (!savedLang) {
        var fallback = data.site && data.site.defaultLang;
        if (fallback === 'zh' || fallback === 'en') state.lang = fallback;
      }
      applyLang(state.lang);
      render();
    })
    .catch(function (error) {
      if (errorEl) errorEl.hidden = false;
      if (window.console) window.console.error('Failed to load site data', error);
    });
})();
