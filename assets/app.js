/* Shared static catalog browser. Content comes from the local catalog only. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const exams = document.body.dataset.view === 'exams';
  const examLabels = { midterm: '期中试题', final: '期末试题', mock: '模拟题', sample: '样题', notice: '考试通知' };
  let catalog = null;
  let entries = [];
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function safeUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value, document.baseURI);
      return url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === location.origin) ? url : null;
    } catch (_) { return null; }
  }
  function link(text, value, className, download) {
    const url = safeUrl(value);
    if (!url) return null;
    const a = el('a', className, text);
    a.href = url.href;
    if (download && url.origin === location.origin) a.setAttribute('download', '');
    if (url.origin !== location.origin) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    return a;
  }
  function size(bytes) {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '大小未登记';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
  function option(id, value, text) {
    if (!$(id)) return;
    const node = el('option', null, text);
    node.value = value;
    $(id).appendChild(node);
  }
  function unique(values) { return [...new Set(values.filter(v => v !== null && v !== undefined && v !== ''))]; }
  function tag(text, kind) { return el('span', 'tag' + (kind ? ' ' + kind : ''), text); }
  function field(id) { return $(id) ? $(id).value : ''; }
  function renderFile(item) {
    const article = el('article', 'file-card');
    const path = String(item.path || item.title || '');
    const ext = path.includes('.') ? path.split('.').pop().toUpperCase() : 'FILE';
    const icon = el('span', 'file-icon', ext.slice(0, 7));
    icon.setAttribute('aria-hidden', 'true');
    article.appendChild(icon);
    const body = el('div', 'file-body');
    const heading = el('h3');
    heading.appendChild(link(item.title || path, item.preview_url || item.url) || el('span', null, item.title || path));
    body.appendChild(heading);
    const tags = el('div', 'tags');
    tags.appendChild(tag(item.course, 'course'));
    tags.appendChild(tag(exams ? examLabels[item.exam_type] : item.category, exams ? 'exam' : ''));
    if (exams) tags.appendChild(tag('考试年份：' + (item.exam_year || '待确认')));
    else {
      if (item.academic_year) tags.appendChild(tag(item.academic_year));
      if (Number.isInteger(item.week)) tags.appendChild(tag('第 ' + item.week + ' 周'));
    }
    if (/official[-_ ]?(solution|answer)|teacher[-_ ]?(solution|answer)|教师答案|官方答案/i.test(item.role || '')) tags.appendChild(tag('教师答案', 'answer'));
    body.appendChild(tags);
    const meta = el('div', 'file-meta');
    meta.appendChild(el('span', null, ext + ' · ' + size(item.size)));
    if (item.sha256) {
      const hash = el('span', null, 'SHA256 ' + String(item.sha256).slice(0, 10) + '…');
      hash.title = String(item.sha256);
      meta.appendChild(hash);
    }
    if (Array.isArray(item.source_urls) && item.source_urls.length) {
      const source = link('Canvas 来源（需课程权限）', item.source_urls[0], 'source-link');
      if (source) meta.appendChild(source);
    }
    body.appendChild(meta);
    article.appendChild(body);
    const actions = el('div', 'file-actions');
    const preview = link('预览 ↗', item.preview_url || item.url, 'button');
    const download = link('下载 ↓', item.download_url || item.url, 'button primary', true);
    if (preview) {
      preview.target = '_blank';
      preview.rel = 'noopener noreferrer';
      preview.setAttribute('aria-label', '预览 ' + item.title + '（新窗口）');
      actions.appendChild(preview);
    }
    if (download) {
      download.setAttribute('aria-label', '下载 ' + item.title);
      if (new URL(download.href).origin !== location.origin) download.title = '前往文件页面下载';
      actions.appendChild(download);
    }
    if (!preview && !download) actions.appendChild(el('span', 'tag', '链接待补充'));
    article.appendChild(actions);
    return article;
  }
  function renderPackages() {
    if (exams || !$('packages')) return;
    const rows = (catalog.packages || []).filter(p => safeUrl(p.url) && (!field('course') || p.course === field('course')) && (!field('category') || p.category_id === field('category')));
    $('package-section').hidden = rows.length === 0;
    $('packages').replaceChildren();
    for (const p of rows) {
      const card = el('article', 'package-card');
      const body = el('div');
      body.appendChild(el('h3', null, p.label));
      body.appendChild(el('p', null, [p.course, Number.isInteger(p.count) ? p.count + ' 份资料' : null, size(p.size)].filter(Boolean).join(' · ')));
      card.appendChild(body);
      card.appendChild(link('下载 ↓', p.url, 'button', true));
      $('packages').appendChild(card);
    }
  }
  function render() {
    if (!catalog) return;
    const q = field('search').trim().toLocaleLowerCase();
    const selectedType = field('exam-type');
    const rows = entries.filter(r => {
      const matchSearch = !q || [r.title, r.path, r.category, r.course, r.academic_year, r.exam_year].join(' ').toLocaleLowerCase().includes(q);
      const matchCourse = !field('course') || r.course === field('course');
      if (exams) return matchSearch && matchCourse && (selectedType === 'all' || (selectedType === 'papers' ? ['midterm', 'final'].includes(r.exam_type) : r.exam_type === selectedType)) && (!field('exam-year') || (field('exam-year') === 'unknown' ? !r.exam_year : String(r.exam_year) === field('exam-year')));
      return matchSearch && matchCourse && (!field('academic-year') || r.academic_year === field('academic-year')) && (!field('category') || r.category_id === field('category')) && (!field('week') || (field('week') === 'unknown' ? !Number.isInteger(r.week) : r.week === Number(field('week'))));
    });
    $('result-count').textContent = '找到 ' + rows.length + ' / ' + entries.length + (exams ? ' 份考试资料' : ' 份资料');
    $('list').replaceChildren();
    const fragment = document.createDocumentFragment();
    for (const row of rows) fragment.appendChild(renderFile(row));
    if (!rows.length) {
      const empty = el('div', 'empty-state');
      empty.appendChild(el('h3', null, exams ? '当前条件下尚未收录试题' : '没有匹配的资料'));
      empty.appendChild(el('p', null, exams ? (entries.length ? '当前筛选未命中。另有 ' + entries.filter(i => !['midterm', 'final'].includes(i.exam_type)).length + ' 份模拟题、样题或通知，可切换类型查看。' : '本批尚无来源已核实的试卷。后续补充请提供来源、学年、学期、类型及题目／答案角色。') : '试试更短的关键词，或清除部分筛选条件。'));
      fragment.appendChild(empty);
    }
    $('list').appendChild(fragment);
    renderPackages();
  }
  function setup(data) {
    if (!data || !Array.isArray(data.items) || !Array.isArray(data.courses)) throw new Error('资料目录格式无效');
    catalog = data;
    entries = data.items.filter(i => i && (!exams || Object.hasOwn(examLabels, i.exam_type)));
    const single = typeof data.course === 'string' ? data.course : data.course && data.course.code;
    $('page-title').textContent = exams ? (single ? single + ' · 历年试题' : '历年期中与期末试题') : data.title || (single ? single + ' 课程资料' : '课程资料馆');
    document.title = $('page-title').textContent + ' · CityU';
    $('updated').textContent = data.updated ? '目录更新 ' + data.updated : '';
    const papers = entries.filter(i => ['midterm', 'final'].includes(i.exam_type)).length;
    $('summary').textContent = exams ? papers + ' 份期中 / 期末试题 · ' + entries.length + ' 份考试相关资料' : data.courses.length + ' 门课程 · ' + entries.length + ' 份已收录资料';
    for (const [id, value] of [['hub-link', data.hub_url], ['repo-link', data.repo_url]]) {
      const target = safeUrl(value);
      if (target) { $(id).href = target.href; $(id).hidden = false; if (target.origin !== location.origin) { $(id).target = '_blank'; $(id).rel = 'noopener noreferrer'; } }
    }
    for (const course of data.courses) option('course', course.code, course.code);
    $('course-filter').hidden = Boolean(single);
    if (single) $('course').value = single;
    if (!exams) {
      for (const year of unique(entries.map(i => i.academic_year)).sort().reverse()) option('academic-year', year, year);
      const categories = new Map(entries.map(i => [i.category_id, i.category]));
      for (const [id, name] of categories) if (id) option('category', id, name || id);
      for (const week of unique(entries.map(i => Number.isInteger(i.week) ? i.week : null)).sort((a, b) => a - b)) option('week', String(week), '第 ' + week + ' 周');
      if (entries.some(i => !Number.isInteger(i.week))) option('week', 'unknown', '周次未确认');
      if (!single && $('course-section')) {
        $('course-section').hidden = data.courses.length === 0;
        for (const course of data.courses) {
          const card = link('', course.site_url, 'course-card');
          if (!card) continue;
          card.appendChild(el('span', 'course-code', course.code));
          card.appendChild(el('span', 'course-name', course.name || '课程资料'));
          const foot = el('span', 'course-card-foot');
          const actualCount = entries.filter(i => i.course === course.code).length;
          foot.appendChild(el('span', null, actualCount + ' 份资料'));
          foot.appendChild(el('span', null, '进入课程 →'));
          card.appendChild(foot);
          $('course-cards').appendChild(card);
        }
      }
    } else {
      for (const year of unique(entries.map(i => i.exam_year)).sort().reverse()) option('exam-year', String(year), String(year));
      if (entries.some(i => !i.exam_year)) option('exam-year', 'unknown', '年份待确认');
    }
    $('filters').addEventListener('submit', event => event.preventDefault());
    $('filters').addEventListener('input', render);
    $('filters').addEventListener('change', render);
    $('reset').addEventListener('click', () => { $('filters').reset(); if (single) $('course').value = single; render(); });
    render();
  }
  fetch(new URL('catalog.json', document.baseURI)).then(response => {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }).then(setup).catch(() => {
    $('load-error').hidden = false;
    $('load-error').textContent = '资料目录暂时无法读取。请刷新页面，或通过 GitHub 仓库查看目录。若正在本地预览，请使用本地静态服务器打开，直接双击 HTML 无法读取资料清单。';
    $('result-count').textContent = '目录未加载';
    $('summary').textContent = '资料数量暂不可用';
  });
})();
