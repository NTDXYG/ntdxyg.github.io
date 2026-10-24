/*
 * 主页即简历。
 *
 * 本文件不写死任何个人内容。姓名、论文、项目、奖项都在 data/*.js 里，
 * index.html 用 script 标签载入，本文件从 window.HOMEPAGE.files 取用：
 *   1. 读取 data/site.js，得到默认语言、导航和章节清单；
 *   2. 按清单并行读取个人信息与各章节；
 *   3. 按章节的 type 交给下面的 RENDERERS 生成 DOM。
 *
 * 界面文案（语言、主题、计数、分区提示等）统一交给 layui i18n，见 UI 字典；
 * 语言菜单用 layui dropdown 渲染；数据里的中英双语字段用 T() 取值。
 *
 * 四种选择会记在 localStorage，刷新后仍生效：
 *   lang   中 / 英
 *   theme  浅色 / 深色
 *   ccf    是否把 CCF 计入分档
 *   rank   分区体系（cas / jcr / xr）
 *
 * 侧栏「CV (PDF)」调用 window.print()，由 style.css 的 @media print 排成 A4。
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var state = { data: null, lang: 'zh', rank: null, ccf: null, pubBody: null, pubSection: null };

  /* 界面文案。layui i18n 的 key 前缀为 ui.，例如 ui.theme.light。 */
  var UI = {
    zh: {
      lang: { label: '语言' },
      theme: { label: '主题', light: '浅色', dark: '深色' },
      nav: {
        label: '章节',
        research: '研究兴趣',
        experience: '教育与工作经历',
        projects: '科研项目',
        publications: '代表性成果',
        service: '学术服务与荣誉'
      },
      profile: { label: '个人资料', metrics: '主要指标' },
      error: { load: '无法加载 data/site.js。请确认它和本页在同一目录。' },
      ccf: { label: '是否使用 CCF', on: '使用 CCF', off: '不使用 CCF' },
      rank: { label: '分区体系', print: '分区体系：{name}' },
      pub: { count: '{label} {n} 篇', countPlural: '{label} {n} 篇', sep: '；' },
      print: { cv: 'CV', noCcf: ' · 不使用CCF' },
      footer: { updated: '最近更新：{date}' }
    },
    en: {
      lang: { label: 'Language' },
      theme: { label: 'Theme', light: 'Light', dark: 'Dark' },
      nav: {
        label: 'Sections',
        research: 'Research',
        experience: 'Experience',
        projects: 'Projects',
        publications: 'Publications',
        service: 'Service'
      },
      profile: { label: 'Profile', metrics: 'Metrics' },
      error: { load: 'Cannot load data/site.js. Make sure it sits next to this page.' },
      ccf: { label: 'Use CCF', on: 'Use CCF', off: 'Do not use CCF' },
      rank: { label: 'Ranking system', print: 'Ranking: {name}' },
      pub: { count: '{label} · {n} paper', countPlural: '{label} · {n} papers', sep: '; ' },
      print: { cv: 'CV', noCcf: ' · no CCF' },
      footer: { updated: 'Last updated: {date}' }
    }
  };

  var ICONS = {
    scholar: '<path d="M12 3.5 1.8 8.6 12 13.7l10.2-5.1L12 3.5Z"/><path d="M5.6 11v4.4c0 1.8 2.9 3.2 6.4 3.2s6.4-1.4 6.4-3.2V11"/>',
    github: '<path d="M9 19.5c-3.5 1-3.5-1.8-5-2.2m10 4.2v-3.4c0-1 .1-1.4-.5-2 2.3-.3 4.5-1.2 4.5-5a3.9 3.9 0 0 0-1.1-2.7 3.6 3.6 0 0 0-.1-2.7s-1.1-.3-3.5 1.4a8.6 8.6 0 0 0-4.6 0C6.3 5.4 5.2 5.7 5.2 5.7a3.6 3.6 0 0 0-.1 2.7A3.9 3.9 0 0 0 4 11.1c0 3.8 2.2 4.7 4.5 5-.4.4-.5.9-.5 1.6V21"/>',
    orcid: '<circle cx="12" cy="12" r="9"/><path d="M9.2 8.6v7"/><circle cx="9.2" cy="6.9" r=".7" fill="currentColor" stroke="none"/><path d="M12.4 8.6h2.3a3.5 3.5 0 0 1 0 7h-2.3v-7Z"/>',
    cv: '<path d="M13.5 3H6.8A1.8 1.8 0 0 0 5 4.8v14.4A1.8 1.8 0 0 0 6.8 21h10.4a1.8 1.8 0 0 0 1.8-1.8V8.5L13.5 3Z"/><path d="M13.5 3v5.5H19"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="m4.5 7 7.5 5.5L19.5 7"/>'
  };

  function icon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
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

  layui.use(['i18n'], function () {
    var $ = layui.$;
    var i18n = layui.i18n;

    /* 把界面文案挂到 layui 的语言表上，不覆盖组件内置的文案。 */
    var messages = i18n.config.messages || (i18n.config.messages = {});
    (messages['zh-CN'] = messages['zh-CN'] || {}).ui = UI.zh;
    (messages.en = messages.en || {}).ui = UI.en;

    function $t(key, data) {
      return i18n.$t('ui.' + key, data);
    }

    /* 数据里的中英双语字段：字符串原样返回，对象按当前语言取。 */
    function T(value) {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return value;
      return value[state.lang] || value.en || value.zh || '';
    }

    function read(key) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    function store(key, value) {
      try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
    }

    var navEl = document.getElementById('nav');
    var sidebarEl = document.getElementById('sidebar');
    var contentEl = document.getElementById('content-body');
    var copyrightEl = document.getElementById('copyright');
    var updatedEl = document.getElementById('updated');
    var errorEl = document.getElementById('load-error');
    var langSelect = document.getElementById('lang-toggle');
    var themeMeta = document.querySelector('meta[name="theme-color"]');
    var themeButtons = document.querySelectorAll('.theme-option');

    /* ---------- Theme ---------- */

    function setTheme(theme) {
      var next = theme === 'dark' ? 'dark' : 'light';
      root.dataset.theme = next;
      store('theme', next);

      Array.prototype.forEach.call(themeButtons, function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.themeValue === next));
      });
      if (themeMeta) themeMeta.setAttribute('content', next === 'dark' ? '#0f1113' : '#ffffff');
    }

    Array.prototype.forEach.call(themeButtons, function (button) {
      button.addEventListener('click', function () {
        setTheme(button.dataset.themeValue);
      });
    });

    // 首屏的主题由 head 里的内联脚本先套上，这里把按钮状态和 theme-color 对齐。
    setTheme(root.dataset.theme);

    /* ---------- Language ---------- */

    /* 静态骨架上的 data-i18n / data-i18n-label 在这里填文案。 */
    function fillStaticText() {
      $('[data-i18n]').each(function () {
        $(this).text($t(this.getAttribute('data-i18n')));
      });
      $('[data-i18n-label]').each(function () {
        this.setAttribute('aria-label', $t(this.getAttribute('data-i18n-label')));
      });
    }

    function setLang(lang, persist) {
      state.lang = lang === 'en' ? 'en' : 'zh';
      root.dataset.lang = state.lang;
      root.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
      i18n.set({ locale: state.lang === 'zh' ? 'zh-CN' : 'en' });
      if (persist !== false) store('lang', state.lang);

      if (langSelect) langSelect.value = state.lang;

      fillStaticText();
      paintQuip();
      render();
    }

    if (langSelect) {
      langSelect.addEventListener('change', function () {
        setLang(langSelect.value);
      });
    }

    /* ---------- Render: sidebar ---------- */

    function roleParts(profile) {
      var org = T(profile.org);
      var title = T(profile.title);
      if (org || title) return [org, title].filter(Boolean);
      return String(T(profile.role) || '').split(/\s*·\s*/).filter(Boolean);
    }

    function roleLine(parts) {
      var node = el('p', { class: 'role' });
      if (parts.length < 2) {
        node.textContent = parts[0] || '';
        return node;
      }
      parts.forEach(function (part) {
        node.appendChild(el('span', { class: 'role-line', text: part }));
      });
      return node;
    }

    function renderSidebar() {
      var p = state.data.profile;
      sidebarEl.innerHTML = '';

      sidebarEl.appendChild(el('img', {
        class: 'portrait',
        src: p.photo,
        alt: T(p.name),
        width: '600',
        height: '750'
      }));

      var main = el('div', { class: 'side-main' });
      var identity = el('div', { class: 'identity' });
      identity.appendChild(el('h1', { text: T(p.name) }));
      identity.appendChild(roleLine(roleParts(p)));
      main.appendChild(identity);

      var metrics = el('dl', { class: 'metrics', 'aria-label': $t('profile.metrics') });
      (p.metrics || []).forEach(function (metric) {
        var row = el('div');
        row.appendChild(el('dt', { text: T(metric.label) }));
        row.appendChild(el('dd', { text: metric.value }));
        metrics.appendChild(row);
      });
      main.appendChild(metrics);

      var contacts = el('ul', { class: 'side-contact' });
      (p.contacts || []).forEach(function (contact) {
        if (contact.action === 'print-cv') return;
        var node = el('a', { href: contact.href });
        if (contact.external) {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener');
        }

        node.innerHTML = icon(contact.icon) + '<span></span>';
        node.querySelector('span').textContent = T(contact.label);

        var item = el('li');
        item.appendChild(node);
        contacts.appendChild(item);
      });

      var printItem = el('li');
      var printBtn = el('button', { class: 'cv-print', type: 'button', 'aria-label': 'CV (PDF)' });
      printBtn.addEventListener('click', function () { window.print(); });
      printBtn.innerHTML = icon('cv') + '<span>CV (PDF)</span>';
      printItem.appendChild(printBtn);
      contacts.appendChild(printItem);
      main.appendChild(contacts);

      if (p.collaboration) {
        var card = el('section', { class: 'side-block side-card' });
        card.appendChild(el('p', { class: 'card-title', text: T(p.collaboration.title) }));
        card.appendChild(el('p', { class: 'card-text', text: T(p.collaboration.text) }));
        var mail = el('a', {
          class: 'card-link',
          href: 'mailto:' + p.collaboration.email
        });
        mail.innerHTML = icon('mail') + '<span></span>';
        mail.querySelector('span').textContent = p.collaboration.email;
        card.appendChild(mail);
        main.appendChild(card);
      }

      sidebarEl.appendChild(main);

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
      return el('h2', { text: T(section.title) });
    }

    function bodyWrap() {
      return el('div', { class: 'section-body' });
    }

    function renderInterests(section) {
      var body = bodyWrap();
      var list = el('dl', { class: 'interests' });

      (section.items || []).forEach(function (item) {
        var row = el('div', { class: 'interest' });
        row.appendChild(el('dt', { text: T(item.term) }));
        row.appendChild(el('dd', { text: T(item.desc) }));
        list.appendChild(row);
      });

      body.appendChild(list);
      return body;
    }

    /* 开始时间近的在前。写不成日期的排到最后。 */
    function timeValue(text, part) {
      var raw = String(text || '').trim();
      if (!raw) return null;
      var piece = raw.split(/\s*[–—-]\s*/)[part || 0] || '';
      var match = piece.match(/(\d{4})\D*(\d{1,2})?/);
      if (!match) return null;
      return Number(match[1]) * 100 + (match[2] ? Number(match[2]) : 0);
    }

    function byTime(a, b) {
      var startA = timeValue(a.date, 0);
      var startB = timeValue(b.date, 0);
      if (startA == null && startB == null) return 0;
      if (startA == null) return 1;
      if (startB == null) return -1;
      if (startA !== startB) return startB - startA;
      var endA = timeValue(a.date, 1);
      var endB = timeValue(b.date, 1);
      if (endA == null && endB == null) return 0;
      if (endA == null) return 1;
      if (endB == null) return -1;
      return endB - endA;
    }

    function renderTimeline(section) {
      var body = bodyWrap();
      var list = el('ul', { class: 'rows' });

      (section.items || []).slice().sort(byTime).forEach(function (item) {
        var row = el('li', { class: 'row' });
        row.appendChild(el('div', { class: 'when', text: item.date }));

        var what = el('div', { class: 'what' });
        var primary = el('p', { class: 'primary' });
        primary.appendChild(document.createTextNode(T(item.org)));
        primary.appendChild(el('span', { class: 'duty', text: T(item.duty) }));
        what.appendChild(primary);

        var advisorName = item.advisor ? T(item.advisor.name).trim() : '';
        if (advisorName) {
          var advisor = el('p', { class: 'advisor' });
          var advisorLabel = T(item.advisor.label).trim();
          if (advisorLabel) advisor.appendChild(document.createTextNode(advisorLabel + ' '));
          var advisorUrl = String(item.advisor.url || '').trim();
          if (advisorUrl) {
            advisor.appendChild(el('a', {
              href: advisorUrl,
              target: '_blank',
              rel: 'noopener',
              text: advisorName
            }));
          } else {
            advisor.appendChild(document.createTextNode(advisorName));
          }
          what.appendChild(advisor);
        }

        row.appendChild(what);
        list.appendChild(row);
      });

      body.appendChild(list);
      return body;
    }

    function projectRoleLabel(role) {
      if (role === 'join') return state.lang === 'zh' ? '参与' : 'Participant';
      if (role === 'lead') return state.lang === 'zh' ? '主持' : 'PI';
      return '';
    }

    function renderProjects(section) {
      var body = bodyWrap();
      var list = el('ul', { class: 'rows' });

      (section.items || []).slice().sort(byTime).forEach(function (item) {
        var row = el('li', { class: 'row' });
        row.appendChild(el('div', { class: 'when', text: item.date }));

        var what = el('div', { class: 'what' });
        what.appendChild(el('p', { class: 'primary', text: T(item.title) }));

        var meta = el('p', { class: 'project-meta' });
        meta.appendChild(el('span', { class: 'funder', text: T(item.funder) }));
        var amount = T(item.amount).trim();
        var role = projectRoleLabel(item.role);
        var tail = [amount, role].filter(Boolean).join(' · ');
        if (tail) meta.appendChild(el('span', { class: 'amount', text: tail }));
        what.appendChild(meta);

        row.appendChild(what);
        list.appendChild(row);
      });

      body.appendChild(list);
      return body;
    }

    /*
     * 打印时把 document.title 改成「姓名 - CV - 分区」，多数浏览器会把它当作建议文件名。
     */
    var titleBeforePrint = '';

    function printTitle() {
      var profile = state.data && state.data.profile;
      var name = profile ? T(profile.name) : '';
      var rankName = state.pubSection ? rankSystemLabel(state.pubSection) : '';
      var title = name ? name + ' - ' + $t('print.cv') : $t('print.cv');
      if (rankName) title += ' - ' + rankName;
      if (state.ccf === false) title += $t('print.noCcf');
      return title;
    }

    window.addEventListener('beforeprint', function () {
      titleBeforePrint = document.title;
      document.title = printTitle();
    });
    window.addEventListener('afterprint', function () {
      if (titleBeforePrint) document.title = titleBeforePrint;
    });

    function rankSystemLabel(section) {
      var found = null;

      ((section.rank || {}).systems || []).forEach(function (system) {
        if (system.key === state.rank) found = system;
      });

      return found ? T(found.label) : '';
    }

    /*
     * 论文分档。
     * 论文是一条扁平列表。ccf 与 rank 都写在论文上；rank 可写数字或按体系写对象。
     * 打开 CCF 时收成两档，关掉后按当前体系的分区各排一节。
     * 档内顺序：在投（Major Revision）最后；其余先按本人作者位置，再按出版年，近的在前。没有年份的（Just Accepted）排在同类最前。
     * 完整规则见 README。
     */
    var CCF_RANK = { A: 1, B: 2, C: 3 };

    var BUCKETS = {
      1: { zh: 'CCF-A / 一区', en: 'CCF-A / Q1' },
      2: { zh: 'CCF-B / 二区', en: 'CCF-B / Q2' }
    };

    var ZONE_LABELS = {
      1: { zh: '一区', en: 'Q1' },
      2: { zh: '二区', en: 'Q2' }
    };

    /* 只收录一区和二区。3、4 以及空值都不进列表。 */
    function zoneRank(zone) {
      var value = Number(zone);
      return value === 1 || value === 2 ? value : 9;
    }

    function ccfRank(group) {
      var letter = (group.ccf || '').trim().slice(-1).toUpperCase();
      return CCF_RANK[letter] || 9;
    }

    /* 论文上的 ccf：1 是 A，2 是 B。没写时再看旧数据里分组上的 CCF。 */
    function paperCcf(group, item) {
      var value = item && item.ccf;
      if (value === 1 || value === 2) return value;
      if (group && group.ccf) {
        var base = ccfRank(group);
        if (base === 1 || base === 2) return base;
      }
      return 0;
    }

    /*
     * none：没写 rank，使用 CCF 时跟着分组走。
     * missing：写了分区对象，但当前体系是空的（例如新锐被置空），当前体系下不显示。
     * drop：当前体系写了三区、四区或其他无效值，不显示。
     * zone：当前体系是一区或二区。
     */
    function currentZone(item) {
      var rank = item ? item.rank : null;
      if (rank === null || rank === undefined) return { state: 'none' };
      if (typeof rank === 'number') {
        var numeric = zoneRank(rank);
        return numeric < 9 ? { state: 'zone', value: numeric } : { state: 'drop' };
      }
      if (!Object.prototype.hasOwnProperty.call(rank, state.rank) || rank[state.rank] === '' || rank[state.rank] == null) {
        return { state: 'missing' };
      }
      var value = zoneRank(rank[state.rank]);
      return value < 9 ? { state: 'zone', value: value } : { state: 'drop' };
    }

    function sectionPapers(section) {
      if (Array.isArray(section.items)) {
        return section.items.map(function (item) { return { group: null, item: item }; });
      }
      var list = [];
      (section.groups || []).forEach(function (group) {
        (group.items || []).forEach(function (item) {
          list.push({ group: group, item: item });
        });
      });
      return list;
    }

    function itemBucket(group, item) {
      var zone = currentZone(item);
      if (zone.state === 'drop' || zone.state === 'missing') return 0;
      var ccf = paperCcf(group, item);
      if (!state.ccf) return zone.state === 'zone' ? zone.value : 0;
      if (zone.state === 'zone') {
        if (!ccf) return zone.value;
        var best = Math.min(ccf, zone.value);
        return best === 1 ? 1 : 2;
      }
      return ccf === 1 || ccf === 2 ? ccf : 0;
    }

    function bucketLabel(section, bucket) {
      var rank = section && section.rank;
      var configured = state.ccf ? rank && rank.buckets : rank && rank.zones;
      var fallback = state.ccf ? BUCKETS : ZONE_LABELS;

      if (configured) {
        for (var i = 0; i < configured.length; i++) {
          if (configured[i].id === bucket && configured[i].label) return T(configured[i].label);
        }
      }
      return T(fallback[bucket] || '');
    }

    function bucketKeys(buckets) {
      return Object.keys(buckets).map(Number).sort(function (a, b) { return a - b; });
    }

    function noteCounts(section, buckets) {
      var parts = [];

      bucketKeys(buckets).forEach(function (bucket) {
        var count = buckets[bucket].length;
        if (!count) return;
        parts.push($t(count === 1 ? 'pub.count' : 'pub.countPlural', {
          label: bucketLabel(section, bucket),
          n: count
        }));
      });

      return parts.join($t('pub.sep'));
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

    /* 出处里的四位年份。Just Accepted、Major Revision 没有年份。 */
    function pubYear(item) {
      var match = String(item.venue || '').match(/\b(?:19|20)\d{2}\b/);
      return match ? Number(match[0]) : null;
    }

    function sortItems(section, items) {
      return (items || []).slice().sort(function (a, b) {
        var order = itemOrder(section, a) - itemOrder(section, b);
        if (order) return order;
        var yearA = pubYear(a);
        var yearB = pubYear(b);
        if (yearA == null && yearB == null) return 0;
        if (yearA == null) return -1;
        if (yearB == null) return 1;
        return yearB - yearA;
      });
    }

    function buildSeg(className, label, options) {
      var wrap = el('div', { class: 'seg ' + className, role: 'group', 'aria-label': label });
      wrap.style.setProperty('--seg-count', String(options.length));
      wrap.appendChild(el('span', { class: 'seg-thumb', 'aria-hidden': 'true' }));

      var index = 0;
      options.forEach(function (option, i) {
        if (option.active) index = i;
        var button = el('button', {
          class: 'seg-option',
          type: 'button',
          'aria-pressed': String(option.active),
          text: option.text
        });
        Object.keys(option.attrs || {}).forEach(function (key) {
          button.setAttribute(key, option.attrs[key]);
        });
        button.addEventListener('click', option.onClick);
        wrap.appendChild(button);
      });

      wrap.style.setProperty('--seg-index', String(index));
      return wrap;
    }

    function ccfOptions(section) {
      var configured = section.rank && section.rank.ccf && section.rank.ccf.options;
      if (configured && configured.length) return configured;
      return [
        { use: true, label: { zh: '使用 CCF', en: 'Use CCF' } },
        { use: false, label: { zh: '不使用 CCF', en: 'Do not use CCF' } }
      ];
    }

    function buildCcfSelect(section) {
      var cfg = (section.rank || {}).ccf || {};
      var wrap = el('span', { class: 'ccf-select' });
      var select = el('select', {
        'aria-label': cfg.label ? T(cfg.label) : $t('ccf.label')
      });

      ccfOptions(section).forEach(function (option) {
        var use = option.use !== false;
        var node = el('option', { value: use ? '1' : '0', text: T(option.label) });
        if (state.ccf === use) node.selected = true;
        select.appendChild(node);
      });

      select.addEventListener('change', function () { setCcf(select.value === '1'); });
      wrap.appendChild(select);
      wrap.insertAdjacentHTML('beforeend',
        '<svg class="lang-caret" viewBox="0 0 10 6" aria-hidden="true">' +
        '<path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.3" ' +
        'stroke-linecap="round" stroke-linejoin="round"/></svg>');
      return wrap;
    }

    function buildRankSwitch(section) {
      var cfg = section.rank || {};
      var systems = cfg.systems || [];
      if (!systems.length) return null;

      return buildSeg('seg-rank', T(cfg.label) || $t('rank.label'), systems.map(function (system) {
        return {
          active: system.key === state.rank,
          text: T(system.label),
          attrs: { 'data-rank': system.key },
          onClick: function () { setRank(system.key); }
        };
      }));
    }

    function refillPublications(selector) {
      if (!(state.pubBody && state.pubSection)) return;
      fillPublications(state.pubBody, state.pubSection);
      if (!selector) return;
      var again = state.pubBody.querySelector(selector);
      if (again) again.focus({ preventScroll: true });
    }

    function setCcf(use) {
      use = !!use;
      if (state.ccf === use) return;
      state.ccf = use;
      store('ccf', use ? '1' : '0');

      var focused = document.activeElement && document.activeElement.matches
        && document.activeElement.matches('.ccf-select select');
      refillPublications(focused ? '.ccf-select select' : null);
    }

    function setRank(key) {
      if (state.rank === key) return;
      state.rank = key;
      store('rank', key);

      var focused = document.activeElement && document.activeElement.dataset
        ? document.activeElement.dataset.rank
        : null;
      refillPublications(focused ? '.seg-option[data-rank="' + focused + '"]' : null);
    }

    function pubList(section, items) {
      var list = el('ol', { class: 'pubs' });

      sortItems(section, items).forEach(function (item) {
        var entry = el('li');
        entry.appendChild(el('p', { class: 'pub-title', text: item.title }));
        entry.appendChild(el('p', { class: 'pub-authors', html: renderAuthors(section, item) }));
        entry.appendChild(el('p', { class: 'pub-venue', text: item.venue }));
        list.appendChild(entry);
      });

      return list;
    }

    function renderPublications(section) {
      var body = bodyWrap();
      state.pubBody = body;
      state.pubSection = section;
      fillPublications(body, section);
      return body;
    }

    /* 没手动选过时用 rank.ccf.default，缺省为使用 CCF。 */
    function resolveCcf(section) {
      if (state.ccf === true || state.ccf === false) return;
      var cfg = section.rank && section.rank.ccf;
      state.ccf = !(cfg && cfg.default === false);
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
      resolveCcf(section);

      var buckets = { 1: [], 2: [] };

      sectionPapers(section).forEach(function (entry) {
        var bucket = itemBucket(entry.group, entry.item);
        if (!bucket) return;
        buckets[bucket].push(entry.item);
      });

      var bar = el('div', { class: 'pub-bar' });
      var note = el('p', { class: 'note', html: T(section.note) });

      var counts = noteCounts(section, buckets);
      if (counts) note.appendChild(el('span', { class: 'note-count', text: counts }));

      var rankName = rankSystemLabel(section);
      if (rankName) {
        var ccfMark = state.ccf ? ' · CCF' : '';
        note.appendChild(el('span', {
          class: 'note-rank print-only',
          text: $t('rank.print', { name: rankName + ccfMark })
        }));
      }

      bar.appendChild(note);

      var switches = el('div', { class: 'pub-switches' });
      switches.appendChild(buildCcfSelect(section));
      var switcher = buildRankSwitch(section);
      if (switcher) switches.appendChild(switcher);
      bar.appendChild(switches);

      body.appendChild(bar);

      bucketKeys(buckets).forEach(function (bucket) {
        if (!buckets[bucket].length) return;

        body.appendChild(el('h3', { class: 'group', text: bucketLabel(section, bucket) }));
        body.appendChild(pubList(section, buckets[bucket]));
      });

      return body;
    }

    function renderService(section) {
      var body = bodyWrap();
      var cols = el('div', { class: 'service-cols' });

      (section.columns || []).forEach(function (column) {
        var wrap = el('div');
        wrap.appendChild(el('h3', { text: T(column.title) }));

        var list = el('ul');
        (column.items || []).forEach(function (item) {
          list.appendChild(el('li', { text: T(item) }));
        });

        wrap.appendChild(list);
        cols.appendChild(wrap);
      });

      body.appendChild(cols);
      return body;
    }

    /* sections[].type 必须是这里的键。新版式在此加函数；只调整现有章节则改 site.js。 */
    var RENDERERS = {
      interests: renderInterests,
      timeline: renderTimeline,
      projects: renderProjects,
      publications: renderPublications,
      service: renderService
    };

    function renderContent() {
      contentEl.innerHTML = '';
      contentEl.appendChild(el('p', { class: 'lede', text: T(state.data.intro) }));

      (state.data.sections || []).forEach(function (section) {
        var node = el('section', { class: 'section', id: section.id });
        node.appendChild(sectionHead(section));

        var renderer = RENDERERS[section.type];
        if (renderer) node.appendChild(renderer(section));

        contentEl.appendChild(node);
      });
    }

    /* ---------- Render: footer ---------- */

    /* 页脚「最近更新」不进数据文件，按打开页面时的日期生成。 */
    function updatedLine() {
      var now = new Date();
      var year = now.getFullYear();
      var month = now.getMonth();
      var day = now.getDate();
      var date = state.lang === 'zh'
        ? year + ' 年 ' + (month + 1) + ' 月 ' + day + ' 日'
        : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month] + ' ' + day + ', ' + year;
      return $t('footer.updated', { date: date });
    }

    function renderFooter() {
      var year = String(new Date().getFullYear());

      if (copyrightEl) copyrightEl.textContent = '© ' + year + ' HomePage · CV';
      if (updatedEl) updatedEl.textContent = updatedLine();
    }

    /* 标签页标题来自网站设置里的 site.title，不随语言切换。打印时 beforeprint 会临时改成带分区的文件名。 */
    function applyHead() {
      var profile = state.data.profile || {};
      var name = profile.name || {};
      var en = typeof name === 'string' ? name : (name.en || '');
      var zh = typeof name === 'string' ? '' : (name.zh || '');
      var configured = state.data.site && state.data.site.title;
      var title = typeof configured === 'string' ? configured.trim() : '';
      if (title) document.title = title;

      var description = document.querySelector('meta[name="description"]');
      if (description && state.data.intro) {
        description.setAttribute('content', T(state.data.intro));
      }

      var author = document.querySelector('meta[name="author"]');
      if (author && (en || zh)) author.setAttribute('content', en || zh);
    }

    function render() {
      if (!state.data) return;
      applyHead();
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

    /* 顶栏短句。site.quip 为 false 或 "" 时不请求；true 用默认一言接口；写成 URL 则请求该地址。
       只在中文界面显示。接口失败就空着，不影响正文。 */
    var DEFAULT_QUIP = 'https://v1.hitokoto.cn/?c=d&c=i&c=k&min_length=12&max_length=16&encode=json';

    function loadQuip() {
      var quip = state.data && state.data.site && state.data.site.quip;
      if (quip === false || quip === '' || !quipEl || !window.fetch) return;

      var url = typeof quip === 'string' ? quip : DEFAULT_QUIP;

      fetch(url, { cache: 'no-store' })
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

    /* 数据由 index.html 里的 script 标签预加载，直接读 window.HOMEPAGE.files。 */
    function loadJSON(path) {
      var files = window.HOMEPAGE && window.HOMEPAGE.files;
      if (!files || !Object.prototype.hasOwnProperty.call(files, path)) {
        return Promise.reject(new Error(path + ' 未加载'));
      }
      return Promise.resolve(files[path]);
    }

    function loadSite() {
      return loadJSON('data/site.js').then(function (site) {
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

    var savedRank = read('rank');
    if (savedRank) state.rank = savedRank;

    var savedCcf = read('ccf');
    if (savedCcf === '0') state.ccf = false;
    else if (savedCcf === '1') state.ccf = true;

    var savedLang = read('lang');
    var initialLang = savedLang === 'en' || savedLang === 'zh' ? savedLang : 'zh';
    setLang(initialLang, false);

    loadSite()
      .then(function (data) {
        state.data = data;
        /* 用户没手动选过语言时，用 site.defaultLang 覆盖首屏兜底值。 */
        var fallback = data.site && data.site.defaultLang;
        if (!savedLang && (fallback === 'zh' || fallback === 'en') && fallback !== state.lang) {
          setLang(fallback);
        } else {
          render();
        }
        loadQuip();
      })
      .catch(function (error) {
        if (errorEl) errorEl.hidden = false;
        if (window.console) window.console.error('Failed to load site data', error);
      });
  });
})();
