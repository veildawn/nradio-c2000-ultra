'use strict';
'require view';
'require fs';
'require ui';
'require poll';

var UPGRADE_CSS = [
	'.nr-up{--nr-card:var(--background-color-high,#fff);--nr-subtle:var(--background-color-low,#f6f8fa);--nr-text:var(--text-color-high,#1f2328);--nr-muted:var(--text-color-medium,#656d76);--nr-border:var(--border-color-medium,rgba(128,128,128,.22));--nr-border-soft:var(--border-color-low,rgba(128,128,128,.14));--nr-primary:var(--primary-color-high,#0969da);--nr-ok:var(--success-color-high,#2eb872);--nr-warn:var(--warn-color-high,#d9822b);--nr-err:var(--error-color-high,#d9534f);color:var(--nr-text);max-inline-size:980px;margin-inline:auto;display:flex;flex-direction:column;gap:1rem}',
	':root[data-darkmode="true"] .nr-up{--nr-card:var(--background-color-high,#24262b);--nr-subtle:var(--background-color-low,#1b1d21);--nr-text:var(--text-color-high,#e6edf3);--nr-muted:var(--text-color-medium,#9ca3af);--nr-border:var(--border-color-medium,rgba(255,255,255,.14));--nr-border-soft:var(--border-color-low,rgba(255,255,255,.08));--nr-primary:var(--primary-color-high,#4a9eff)}',
	'.nr-up-head{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:.75rem}',
	'.nr-up-head h2{margin:0 0 .3rem;font-size:1.35rem}',
	'.nr-up-head p{margin:0;color:var(--nr-muted);font-size:.88rem;line-height:1.5}',
	'.nr-up-head-actions{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem}',
	'.nr-up-head-actions a.cbi-button{text-decoration:none;display:inline-flex;align-items:center}',
	'.nr-up-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.6rem}',
	'@media(max-width:720px){.nr-up-steps{grid-template-columns:repeat(2,minmax(0,1fr))}}',
	'.nr-up-step{padding:.6rem .75rem;border-radius:10px;border:1px solid var(--nr-border);background:var(--nr-card);display:flex;align-items:center;gap:.55rem;min-width:0}',
	'.nr-up-step-num{width:22px;height:22px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-size:.74rem;font-weight:700;background:var(--nr-subtle);color:var(--nr-muted);border:1px solid var(--nr-border-soft);flex-shrink:0}',
	'.nr-up-step-body{min-width:0;display:flex;flex-direction:column;gap:.08rem}',
	'.nr-up-step-title{font-size:.82rem;font-weight:600;color:var(--nr-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
	'.nr-up-step-sub{font-size:.72rem;color:var(--nr-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
	'.nr-up-step.is-done{border-color:rgba(46,184,114,.4);background:rgba(46,184,114,.08);background:color-mix(in srgb,var(--nr-ok) 10%,var(--nr-card))}',
	'.nr-up-step.is-done .nr-up-step-num{background:var(--nr-ok);border-color:var(--nr-ok);color:#fff}',
	'.nr-up-step.is-done .nr-up-step-title{color:var(--nr-ok)}',
	'.nr-up-step.is-active{border-color:rgba(9,105,218,.48);background:rgba(9,105,218,.08);background:color-mix(in srgb,var(--nr-primary) 11%,var(--nr-card))}',
	'.nr-up-step.is-active .nr-up-step-num{background:var(--nr-primary);border-color:var(--nr-primary);color:#fff}',
	'.nr-up-step.is-active .nr-up-step-title{color:var(--nr-primary)}',
	'.nr-up-step.is-warn{border-color:rgba(217,130,43,.48);background:rgba(240,173,78,.1);background:color-mix(in srgb,var(--nr-warn) 12%,var(--nr-card))}',
	'.nr-up-step.is-warn .nr-up-step-num{background:var(--nr-warn);border-color:var(--nr-warn);color:#fff}',
	'.nr-up-step.is-warn .nr-up-step-title{color:var(--nr-warn)}',
	'.nr-up-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}',
	'@media(max-width:740px){.nr-up-grid2{grid-template-columns:1fr}}',
	'.nr-up-card{background:var(--nr-card);border:1px solid var(--nr-border);border-radius:12px;padding:1rem 1.15rem;min-width:0}',
	'.nr-up-card.is-ready{border-color:rgba(46,184,114,.55);box-shadow:0 2px 10px rgba(46,184,114,.08)}',
	'.nr-up-card.is-active{border-color:rgba(9,105,218,.5);box-shadow:0 2px 10px rgba(9,105,218,.08)}',
	'.nr-up-card.is-warn{border-color:rgba(217,130,43,.5)}',
	'.nr-up-card-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.45rem}',
	'.nr-up-label{font-size:.8rem;color:var(--nr-muted);font-weight:600;letter-spacing:.01em}',
	'.nr-up-ver-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:.45rem;margin-bottom:.55rem}',
	'.nr-up-ver{font-size:1.14rem;font-weight:700;font-family:monospace;overflow-wrap:anywhere}',
	'.nr-up-ver.primary{color:var(--nr-primary)}',
	'.nr-up-ver.muted{color:var(--nr-muted);font-size:1rem}',
	'.nr-up-subrev{font-size:.76rem;font-family:monospace;color:var(--nr-muted);background:var(--nr-subtle);border:1px solid var(--nr-border-soft);padding:.1rem .45rem;border-radius:6px;overflow-wrap:anywhere}',
	'.nr-up-pill{display:inline-flex;align-items:center;gap:.25rem;padding:.15rem .56rem;border-radius:999px;font-size:.75rem;font-weight:600;white-space:nowrap}',
	'.nr-up-pill.ok{color:var(--nr-ok);background:rgba(46,184,114,.14);background:color-mix(in srgb,var(--nr-ok) 15%,transparent)}',
	'.nr-up-pill.warn{color:var(--nr-warn);background:rgba(240,173,78,.16);background:color-mix(in srgb,var(--nr-warn) 16%,transparent)}',
	'.nr-up-pill.err{color:var(--nr-err);background:rgba(217,83,79,.14);background:color-mix(in srgb,var(--nr-err) 15%,transparent)}',
	'.nr-up-pill.primary{color:var(--nr-primary);background:rgba(9,105,218,.12);background:color-mix(in srgb,var(--nr-primary) 14%,transparent)}',
	'.nr-up-pill.muted{color:var(--nr-muted);background:var(--nr-subtle)}',
	'.nr-up-kv-wrap{padding-top:.5rem;border-top:1px solid var(--nr-border-soft)}',
	'.nr-up-kv-table{width:100%;border-collapse:collapse;margin:0;font-size:.84rem}',
	'.nr-up-kv-table th,.nr-up-kv-table td{padding:.22rem 0;border:none;background:transparent;vertical-align:baseline;text-align:left}',
	'.nr-up-kv-table th.nr-up-kv-k{width:118px;padding-right:.6rem;color:var(--nr-muted);font-weight:500;white-space:nowrap}',
	'.nr-up-kv-table td.nr-up-kv-v{font-family:monospace;min-width:0;overflow-wrap:anywhere;color:var(--nr-text)}',
	'.nr-up-inline{display:inline-flex;flex-wrap:wrap;align-items:center;gap:.4rem}',
	'.nr-up-linkbtn{background:none;border:none;padding:0;color:var(--nr-primary);cursor:pointer;font-size:.78rem;font-family:sans-serif;text-decoration:none}',
	'.nr-up-linkbtn:hover{text-decoration:underline}',
	'.nr-up-errbox{padding:.65rem .8rem;border-radius:8px;border:1px solid rgba(217,83,79,.35);background:rgba(217,83,79,.08);background:color-mix(in srgb,var(--nr-err) 10%,transparent);font-size:.83rem;line-height:1.55;color:var(--nr-text)}',
	'.nr-up-banner{padding:.75rem .95rem;border-radius:10px;border:1px solid var(--nr-border);font-size:.84rem;line-height:1.55;margin-top:.85rem}',
	'.nr-up-banner.warn{border-color:rgba(217,130,43,.45);background:rgba(240,173,78,.11);background:color-mix(in srgb,var(--nr-warn) 12%,transparent)}',
	'.nr-up-banner.info{background:var(--nr-subtle);color:var(--nr-muted)}',
	'.nr-up-banner a{color:var(--nr-primary);font-weight:600;text-decoration:none}',
	'.nr-up-banner a:hover{text-decoration:underline}',
	'.nr-up-notes-body{margin-top:.65rem;padding-top:.65rem;border-top:1px solid var(--nr-border-soft);font-size:.84rem;line-height:1.6;display:flex;flex-direction:column;gap:.35rem}',
	'.nr-up-notes-body ul{margin:0;padding-left:1.15rem}',
	'.nr-up-notes-body p{margin:0;color:var(--nr-muted)}',
	'.nr-up-dl-row{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;margin-top:.55rem}',
	'.nr-up-dl-row input{flex:1 1 220px;min-width:0;max-width:100%;box-sizing:border-box;margin:0}',
	'@media(max-width:560px){.nr-up-dl-row button{width:100%}}',
	'.nr-up-presets{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem;margin-top:.55rem;font-size:.78rem;color:var(--nr-muted)}',
	'.nr-up-chip{padding:.18rem .55rem;border-radius:6px;border:1px solid var(--nr-border);background:var(--nr-subtle);color:var(--nr-text);cursor:pointer;font-size:.76rem;line-height:1.4}',
	'.nr-up-chip.is-selected{border-color:var(--nr-primary);color:var(--nr-primary);background:rgba(9,105,218,.1);background:color-mix(in srgb,var(--nr-primary) 12%,transparent);font-weight:600}',
	'.nr-up-chip:disabled{opacity:.45;cursor:not-allowed}',
	'.nr-up-notice{margin:.55rem 0 0;font-size:.83rem;color:var(--nr-muted);line-height:1.5}',
	'.nr-up-notice.is-err{color:var(--nr-err)}',
	'.nr-up-notice:empty{display:none}',
	'.nr-up-bar{background:var(--nr-subtle);border:1px solid var(--nr-border-soft);height:12px;border-radius:999px;overflow:hidden;margin:.65rem 0}',
	'.nr-up-bar-fill{height:100%;width:0;background:var(--nr-primary);transition:width .35s ease;border-radius:999px}',
	'.nr-up-bar-fill.is-verifying{width:100%!important;background:var(--nr-ok)}',
	'.nr-up-flash-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.85rem;margin-top:.8rem}',
	'@media(max-width:680px){.nr-up-flash-grid{grid-template-columns:1fr}}',
	'.nr-up-flash-opt{border:1px solid var(--nr-border);border-radius:10px;padding:.9rem 1rem;display:flex;flex-direction:column;justify-content:space-between;gap:.75rem;background:var(--nr-subtle)}',
	'.nr-up-flash-opt.recommended{border-color:rgba(9,105,218,.42);background:rgba(9,105,218,.06);background:color-mix(in srgb,var(--nr-primary) 7%,var(--nr-card))}',
	'.nr-up-flash-opt p{margin:.32rem 0 0;font-size:.82rem;color:var(--nr-muted);line-height:1.5}'
].join('\n');

function ensureStyle() {
	if (typeof document !== 'undefined' && document.head && !document.getElementById('nr-upgrade-css'))
		document.head.appendChild(E('style', { 'id': 'nr-upgrade-css' }, UPGRADE_CSS));
}

function luciUrl(path) {
	return (typeof L !== 'undefined' && typeof L.url === 'function')
		? L.url(path)
		: '/cgi-bin/luci/' + path.replace(/^\/+/, '');
}

function num(v) {
	var n = parseInt(v, 10);
	return isNaN(n) ? 0 : n;
}

function pad2(n) {
	return n < 10 ? '0' + n : String(n);
}

function fmtDate(v) {
	var ts = num(v);
	if (!ts) return '—';
	var d = new Date(ts * 1000);
	return '%d-%s-%s %s:%s UTC'.format(
		d.getUTCFullYear(), pad2(d.getUTCMonth() + 1), pad2(d.getUTCDate()),
		pad2(d.getUTCHours()), pad2(d.getUTCMinutes())
	);
}

function fmtIso(s) {
	if (!s) return '—';
	var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(s);
	return m ? (m[1] + ' ' + m[2] + ' UTC') : s;
}

function fmtSize(v) {
	var n = num(v);
	if (!n) return '—';
	return n >= 1048576 ? '%.1f MB'.format(n / 1048576) : '%d KB'.format(Math.ceil(n / 1024));
}

function shortSha(sha) {
	if (!sha || sha.length < 20) return sha || '—';
	return sha.slice(0, 10) + '…' + sha.slice(-8);
}

function kvTable(rows) {
	return E('div', { 'class': 'nr-up-kv-wrap' }, [
		E('table', { 'class': 'nr-up-kv-table' }, E('tbody', {}, rows.map(function(row) {
			return E('tr', {}, [
				E('th', { 'scope': 'row', 'class': 'nr-up-kv-k' }, row[0]),
				E('td', { 'class': 'nr-up-kv-v' }, row[1])
			]);
		})))
	]);
}

function copyText(text, btn) {
	if (!text) return;
	var done = function() {
		if (!btn) return;
		var orig = btn.textContent;
		btn.textContent = '已复制';
		window.setTimeout(function() { btn.textContent = orig; }, 1400);
	};
	if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
		navigator.clipboard.writeText(text).then(done).catch(function() {});
		return;
	}
	try {
		var ta = E('textarea', { 'style': 'position:fixed;opacity:0;pointer-events:none;' }, text);
		document.body.appendChild(ta);
		ta.select();
		document.execCommand('copy');
		document.body.removeChild(ta);
		done();
	} catch (e) {}
}

function exec(args) {
	return fs.exec('/usr/sbin/c2000-upgrade', args).then(function(res) {
		var st;
		try { st = JSON.parse(res.stdout); }
		catch (e) { throw new Error('升级助手返回异常，请重试。' + (res.stderr || '')); }
		if (st.error || res.code !== 0)
			throw new Error(st.error || st.msg || '升级操作失败');
		return st;
	});
}

return view.extend({
	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	load: function() {
		// Render local state first, even if GitHub is unreachable.
		return Promise.all([
			exec([ 'info' ]).catch(function() { return {}; }),
			exec([ 'status' ]).catch(function(e) { return { state: 'unknown', msg: e.message }; })
		]);
	},

	isActive: function() {
		return this.download && [ 'downloading', 'verifying', 'flashing' ].indexOf(this.download.state) >= 0;
	},

	syncLocalInfo: function(st) {
		if (!st) return;
		if (!this.localInfo) this.localInfo = { tag: '', rev: '', date: '', kernel: '' };
		if (st.current_tag) this.localInfo.tag = st.current_tag;
		if (st.current_rev) this.localInfo.rev = st.current_rev;
		if (st.current_date) this.localInfo.date = st.current_date;
		if (st.current_kernel) this.localInfo.kernel = st.current_kernel;
	},

	isExactLatest: function(st) {
		if (!st || st.kernel_match !== 1) return false;
		var loc = this.localInfo || {};
		if (loc.tag && st.tag)
			return loc.tag === st.tag && st.same_base !== 0;
		return !!(st.same_base === 1 && st.rev && st.rev.indexOf('-') > 0 && loc.rev === st.rev);
	},

	setNotice: function(text, isErr) {
		if (!this.notice) return;
		this.notice.textContent = text || '';
		this.notice.className = 'nr-up-notice' + (isErr ? ' is-err' : '');
	},

	updatePresetSelection: function() {
		if (!this.presetBox || !this.mirrorInput) return;
		var cur = this.mirrorInput.value.trim();
		this.presetBox.querySelectorAll('button[data-mirror]').forEach(function(btn) {
			var val = btn.getAttribute('data-mirror') || '';
			btn.className = 'nr-up-chip' + (cur === val ? ' is-selected' : '');
		});
	},

	updateStepper: function() {
		if (!this.stepperBox) return;
		var dlState = (this.download && this.download.state) || 'idle';
		var hasDone = (dlState === 'done' && this.download && this.download.have_image);
		var s1 = 'wait', s2 = 'wait', s3 = 'wait', s4 = 'wait';
		var sub1 = '等待检查', sub2 = '待拉取镜像', sub3 = '官方摘要锚定', sub4 = '等待就绪';

		if (this.checking) {
			s1 = 'active';
			sub1 = '正在请求 API…';
		}
		else if (this.checkError) {
			s1 = 'warn';
			sub1 = '连接失败';
		}
		else if (this.latest) {
			if (this.latest.kernel_match !== 1) {
				s1 = 'warn';
				sub1 = '跨内核禁用';
			}
			else {
				s1 = 'done';
				sub1 = this.isExactLatest(this.latest) ? '当前已是最新' : '可在线更新';
			}
		}

		if (dlState === 'downloading') {
			if (s1 === 'wait') { s1 = 'done'; sub1 = this.download.tag ? '目标 ' + this.download.tag : '已完成检查'; }
			s2 = 'active';
			sub2 = '后台拉取中…';
		}
		else if (dlState === 'verifying') {
			if (s1 === 'wait') { s1 = 'done'; sub1 = this.download.tag ? '目标 ' + this.download.tag : '已完成检查'; }
			s2 = 'done'; sub2 = '拉取已完成';
			s3 = 'active'; sub3 = '摘要比对中…';
		}
		else if (hasDone) {
			if (s1 === 'wait') { s1 = 'done'; sub1 = this.download.tag ? '目标 ' + this.download.tag : '已完成检查'; }
			s2 = 'done'; sub2 = '已缓存到本地';
			s3 = 'done'; sub3 = 'SHA-256 通过';
			s4 = 'active'; sub4 = '待选择模式';
		}
		else if (dlState === 'flashing') {
			s1 = 'done';
			if (sub1 === '等待检查') sub1 = '已完成检查';
			s2 = 'done'; sub2 = '已缓存到本地';
			s3 = 'done'; sub3 = 'SHA-256 通过';
			s4 = 'active'; sub4 = '写入并重启中…';
		}
		else if (dlState === 'error') {
			s2 = 'warn';
			sub2 = '任务异常中断';
		}

		var items = [
			[ '1', '检查版本', sub1, s1 ],
			[ '2', '后台下载', sub2, s2 ],
			[ '3', 'SHA-256 校验', sub3, s3 ],
			[ '4', '刷写重启', sub4, s4 ]
		];

		this.stepperBox.replaceChildren.apply(this.stepperBox, items.map(function(it) {
			var st = it[3],
			    cls = 'nr-up-step' + (st === 'done' ? ' is-done' : st === 'active' ? ' is-active' : st === 'warn' ? ' is-warn' : ''),
			    badge = st === 'done' ? '✓' : st === 'warn' ? '!' : it[0];
			return E('div', { 'class': cls }, [
				E('span', { 'class': 'nr-up-step-num' }, badge),
				E('div', { 'class': 'nr-up-step-body' }, [
					E('span', { 'class': 'nr-up-step-title' }, it[1]),
					E('span', { 'class': 'nr-up-step-sub' }, it[2])
				])
			]);
		}));
	},

	updateActions: function() {
		var active = this.isActive(),
		    locked = active || this.busy || this.checking,
		    hasDone = !!(this.download && this.download.state === 'done' && this.download.have_image);

		this.checkButton.disabled = !!locked;
		this.downloadButton.disabled = !!(locked || !this.latest || this.latest.kernel_match !== 1);
		this.downloadButton.className = hasDone ? 'cbi-button' : 'cbi-button cbi-button-positive';
		if (this.sourceCardTitle)
			this.sourceCardTitle.textContent = hasDone ? '重新拉取固件 / 加速源设置' : '固件拉取与下载加速';

		this.mirrorInput.disabled = !!locked;
		if (this.presetBox)
			this.presetBox.querySelectorAll('button').forEach(function(b) { b.disabled = !!locked; });
		this.flashBox.querySelectorAll('button').forEach(function(button) { button.disabled = !!locked; });
		this.updateStepper();
	},

	buildLocalCard: function() {
		var loc = this.localInfo || {},
		    dl = this.download || {},
		    heroText = loc.tag || loc.rev || '本机 OpenWrt',
		    verNodes = [ E('span', { 'class': 'nr-up-ver' + ((loc.tag || loc.rev) ? '' : ' muted') }, heroText) ],
		    cacheNode;

		if (loc.tag && loc.rev && loc.rev !== loc.tag)
			verNodes.push(E('span', { 'class': 'nr-up-subrev' }, loc.rev));

		if (dl.state === 'done' && dl.have_image)
			cacheNode = E('span', { 'style': 'color:var(--nr-ok);font-weight:600;' }, '已就绪 (' + (dl.tag || '待刷写') + ')');
		else if (dl.state === 'downloading' || dl.state === 'verifying')
			cacheNode = E('span', { 'style': 'color:var(--nr-primary);' }, '后台处理中…');
		else
			cacheNode = E('span', { 'style': 'color:var(--nr-muted);' }, '无待刷写镜像');

		var baselineText = loc.date
			? '%s（%s）'.format(loc.rev || '—', fmtDate(loc.date))
			: (loc.rev || '—');

		return E('div', { 'class': 'nr-up-card' }, [
			E('div', { 'class': 'nr-up-card-top' }, [
				E('span', { 'class': 'nr-up-label' }, '当前运行系统'),
				E('span', { 'class': 'nr-up-pill muted' }, 'SLOT A · 本地固件')
			]),
			E('div', { 'class': 'nr-up-ver-row' }, verNodes),
			kvTable([
				[ '当前固件', loc.tag || '未记录发布版本' ],
				[ '当前 OpenWrt 基线', baselineText ],
				[ '当前内核', loc.kernel ? 'Linux ' + loc.kernel : '—' ],
				[ '本地缓存', cacheNode ]
			])
		]);
	},

	buildRemoteCard: function() {
		var st = this.latest,
		    loc = this.localInfo || {};

		if (!st && this.checkError) {
			return E('div', { 'class': 'nr-up-card is-warn' }, [
				E('div', { 'class': 'nr-up-card-top' }, [
					E('span', { 'class': 'nr-up-label' }, 'GitHub 最新发布'),
					E('span', { 'class': 'nr-up-pill err' }, '⚠ 检查失败')
				]),
				E('div', { 'class': 'nr-up-ver-row' }, [
					E('span', { 'class': 'nr-up-ver muted' }, '暂未获取远端版本')
				]),
				E('div', { 'class': 'nr-up-errbox' }, [
					E('div', { 'style': 'font-weight:600;margin-bottom:.2rem;' }, this.checkError),
					E('div', { 'style': 'color:var(--nr-muted);' },
						'请检查 5G / WAN 网络后点击右上角「重新检查」重试，或使用「本地上传 / 备份」手动刷入固件。')
				])
			]);
		}

		if (!st) {
			return E('div', { 'class': 'nr-up-card' }, [
				E('div', { 'class': 'nr-up-card-top' }, [
					E('span', { 'class': 'nr-up-label' }, 'GitHub 最新发布'),
					E('span', { 'class': 'nr-up-pill primary' }, '检查中…')
				]),
				E('div', { 'class': 'nr-up-ver-row' }, [
					E('span', { 'class': 'nr-up-ver primary' }, '正在连接 Release API…')
				]),
				kvTable([
					[ '固件仓库', 'veildawn/nradio-c2000-ultra' ],
					[ '信任锚点', 'api.github.com SHA-256' ],
					[ '连接状态', '正在同步最新发布元数据…' ]
				])
			]);
		}

		var kMatch = st.kernel_match === 1,
		    exact = this.isExactLatest(st),
		    verdictBadge;
		if (!kMatch)
			verdictBadge = E('span', { 'class': 'nr-up-pill warn' }, st.kernel_match === 0 ? '⚠ 内核跨版本' : '⚠ 兼容性未知');
		else if (exact)
			verdictBadge = E('span', { 'class': 'nr-up-pill ok' }, '✓ 当前已是最新');
		else if (st.same_base === 1)
			verdictBadge = E('span', { 'class': 'nr-up-pill ok' }, '✓ 同基线可更新');
		else
			verdictBadge = E('span', { 'class': 'nr-up-pill primary' }, '↑ 发现可用更新');

		var relRev = st.rev || st.release_rev || '',
		    verChildren = [ E('span', { 'class': 'nr-up-ver primary' }, st.tag || '—') ];
		if (relRev && relRev !== st.tag)
			verChildren.push(E('span', { 'class': 'nr-up-subrev' }, relRev));

		var copyBtn = E('button', {
			'type': 'button',
			'class': 'nr-up-linkbtn',
			'click': function() { copyText(st.sha256, copyBtn); }
		}, '复制');

		var curKernel = st.current_kernel || loc.kernel || '未知',
		    relKernel = st.release_kernel || '未知';

		return E('div', { 'class': 'nr-up-card' }, [
			E('div', { 'class': 'nr-up-card-top' }, [
				E('span', { 'class': 'nr-up-label' }, 'GitHub 最新发布'),
				verdictBadge
			]),
			E('div', { 'class': 'nr-up-ver-row' }, verChildren),
			kvTable([
				[ '发布时间', fmtIso(st.published) ],
				[ '固件大小', fmtSize(st.size) ],
				[ '内核对比', '%s → %s'.format(curKernel, relKernel) ],
				[ 'SHA-256', E('span', { 'class': 'nr-up-inline' }, [
					E('span', { 'title': st.sha256 || '' }, shortSha(st.sha256)),
					st.sha256 ? copyBtn : ''
				]) ]
			])
		]);
	},

	renderOverview: function() {
		if (!this.checkBox) return;
		var st = this.latest,
		    nodes = [ E('div', { 'class': 'nr-up-grid2' }, [ this.buildLocalCard(), this.buildRemoteCard() ]) ];

		if (st && st.kernel_match !== 1) {
			nodes.push(E('div', { 'class': 'nr-up-banner warn' }, [
				E('strong', {}, st.kernel_match === 0
					? '跨内核版本保护：在线升级已自动禁用。'
					: '无法确认远端固件内核版本：在线升级已自动禁用。'),
				' 在线升级仅更新 TF 卡 rootfs 分区，跨内核直接写入会导致内核模块不匹配（USB 5G 模组与 Wi-Fi 失效）。请前往 ',
				E('a', { 'href': luciUrl('admin/system/bootswitch') }, '双系统切换'),
				' 切回原厂 Web 刷入完整底包，或使用 ',
				E('a', { 'href': luciUrl('admin/system/flash') }, '本地上传 / 备份'),
				' 处理。'
			]));
		}
		else if (st && this.isExactLatest(st)) {
			nodes.push(E('div', { 'class': 'nr-up-banner info' },
				'当前运行的固件版本（' + (st.tag || st.rev) + '）已与 GitHub 最新发布一致；如需重新刷写或恢复初始配置，仍可拉取镜像。'));
		}
		else if (st && st.same_base === 1) {
			nodes.push(E('div', { 'class': 'nr-up-banner info' },
				'提示：此版本与当前固件基于同一 OpenWrt 源码基线，仍可能包含新的板级驱动、界面或配置修复。'));
		}

		this.checkBox.replaceChildren.apply(this.checkBox, nodes);
	},

	renderCheck: function(st) {
		this.latest = st;
		this.checkError = '';
		this.syncLocalInfo(st);
		this.renderOverview();
		this.renderNotes(st);
	},

	renderNotes: function(st) {
		if (!this.notesBox) return;
		var raw = (st && st.notes) ? String(st.notes).trim() : '';
		if (!raw) {
			this.notesBox.style.display = 'none';
			this.notesBox.replaceChildren();
			return;
		}
		var self = this,
		    lines = raw.split(/\r?\n/),
		    bodyNodes = [],
		    listItems = [];

		var flushList = function() {
			if (!listItems.length) return;
			bodyNodes.push(E('ul', {}, listItems.slice()));
			listItems = [];
		};

		lines.forEach(function(line) {
			var trimmed = line.trim();
			if (!trimmed) {
				flushList();
				return;
			}
			var heading = /^#{1,4}\s+(.*)$/.exec(trimmed);
			if (heading) {
				flushList();
				bodyNodes.push(E('strong', { 'style': 'margin-top:.2rem;' }, heading[1]));
				return;
			}
			var bullet = /^[-*]\s+(.*)$/.exec(trimmed);
			if (bullet) {
				listItems.push(E('li', {}, bullet[1]));
				return;
			}
			flushList();
			bodyNodes.push(E('p', {}, trimmed));
		});
		flushList();

		if (!bodyNodes.length) {
			this.notesBox.style.display = 'none';
			this.notesBox.replaceChildren();
			return;
		}

		var bodyWrap = E('div', {
			'class': 'nr-up-notes-body',
			'style': this.notesExpanded ? '' : 'display:none;'
		}, bodyNodes);

		var toggleBtn = E('button', {
			'type': 'button',
			'class': 'nr-up-linkbtn',
			'click': function() {
				self.notesExpanded = !self.notesExpanded;
				bodyWrap.style.display = self.notesExpanded ? '' : 'none';
				toggleBtn.textContent = self.notesExpanded ? '收起更新日志' : '展开更新日志';
			}
		}, this.notesExpanded ? '收起更新日志' : '展开更新日志');

		this.notesBox.style.display = '';
		this.notesBox.replaceChildren(
			E('div', { 'class': 'nr-up-card-top', 'style': 'margin-bottom:0;' }, [
				E('strong', { 'style': 'font-size:.92rem;' }, '版本更新说明 · ' + (st.tag || '')),
				toggleBtn
			]),
			bodyWrap
		);
	},

	handleCheck: function(force) {
		if (this.checking || (force === true && this.isActive())) return Promise.resolve();
		this.checking = true;
		this.checkError = '';
		if (force === true)
			this.setNotice('正在强制刷新 GitHub 最新版本信息…', false);
		this.renderOverview();
		this.updateActions();
		return exec(force === true ? [ 'check', 'force' ] : [ 'check' ]).then(L.bind(function(st) {
			this.renderCheck(st);
			this.setNotice(force === true ? '远端版本信息已刷新。' : '', false);
		}, this)).catch(L.bind(function(e) {
			this.latest = null;
			this.checkError = e.message || '无法访问 GitHub Release API';
			this.renderOverview();
			this.renderNotes(null);
			this.setNotice(force === true ? (this.checkError + '。可点击「重新检查」重试。') : '', force === true);
		}, this)).finally(L.bind(function() {
			this.checking = false;
			this.updateActions();
		}, this));
	},

	handleDownload: function() {
		if (this.busy || this.isActive() || !this.latest || this.latest.kernel_match !== 1) return;
		var mirror = this.mirrorInput.value.trim();
		if (mirror && !/^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(mirror)) {
			this.setNotice('请输入以 https:// 开头的有效下载加速前缀。', true);
			return;
		}
		this.busy = true;
		this.updateActions();
		this.setNotice('正在启动后台下载任务…', false);
		return exec([ 'download', this.latest.url, this.latest.sha256, mirror, this.latest.tag ]).then(L.bind(function() {
			this.setNotice('下载已在路由器后台启动，关闭或刷新页面不会中断任务。', false);
			this.renderDownload({ state: 'downloading', bytes: 0, total: this.latest.size, tag: this.latest.tag });
			return this.refreshDownload();
		}, this)).catch(L.bind(function(e) {
			this.setNotice(e.message, true);
		}, this)).finally(L.bind(function() {
			this.busy = false;
			this.updateActions();
		}, this));
	},

	refreshDownload: function() {
		if (this.statusPending) return Promise.resolve();
		this.statusPending = true;
		return exec([ 'status' ]).then(L.bind(function(st) {
			this.syncLocalInfo(st);
			this.renderDownload(st);
		}, this)).catch(L.bind(function(e) {
			this.dlBox.style.display = '';
			this.dlBox.className = 'nr-up-card is-warn';
			this.dlTitle.textContent = '状态读取受阻';
			this.dlBadge.textContent = '连接重试中';
			this.dlBadge.className = 'nr-up-pill warn';
			this.dlNote.textContent = '暂时无法读取进度，将自动重试：' + e.message;
		}, this)).finally(L.bind(function() { this.statusPending = false; }, this));
	},

	renderDownload: function(st) {
		var previous = this.download;
		this.download = st;
		this.syncLocalInfo(st);

		// Preserve keyboard focus on ready-image actions during idle polling.
		if (st.state === 'done' && previous && previous.state === 'done' &&
		    st.tag === previous.tag && st.sha256 === previous.sha256 && st.have_image === previous.have_image) {
			this.updateActions();
			return;
		}

		if (!previous || previous.state !== st.state || previous.have_image !== st.have_image || previous.tag !== st.tag)
			this.renderOverview();

		this.flashBox.replaceChildren();
		this.dlBox.style.display = st.state === 'idle' ? 'none' : '';
		this.bar.style.display = st.state === 'downloading' || st.state === 'verifying' ? '' : 'none';

		if (st.state === 'downloading' || st.state === 'verifying') {
			var total = num(st.total), bytes = num(st.bytes),
			    pct = total > 0 ? Math.min(100, Math.floor(bytes / total * 100)) : null;
			this.dlBox.className = 'nr-up-card is-active';
			this.dlTitle.textContent = st.state === 'verifying' ? '下载完成，正在校验固件…' : '正在下载 ' + (st.tag || '固件');
			this.dlBadge.textContent = st.state === 'verifying' ? 'SHA-256 校验中' : (pct !== null ? pct + '%' : '下载中');
			this.dlBadge.className = 'nr-up-pill primary';
			this.barFill.className = 'nr-up-bar-fill' + (st.state === 'verifying' ? ' is-verifying' : '');
			this.barFill.style.width = pct === null ? '0%' : pct + '%';
			if (pct !== null) this.bar.setAttribute('aria-valuenow', pct);
			else this.bar.removeAttribute('aria-valuenow');
			this.dlNote.textContent = st.state === 'verifying'
				? '正在比对 GitHub API 官方 SHA-256 摘要，请稍候…'
				: '已下载 %s%s · 路由器后台独立执行'.format(fmtSize(bytes), total ? ' / %s（%d%%）'.format(fmtSize(total), pct) : '');
		}
		else if (st.state === 'done' && st.have_image) {
			this.dlBox.className = 'nr-up-card is-ready';
			this.dlTitle.textContent = '固件已就绪：' + (st.tag || '未知版本');
			this.dlBadge.textContent = '✓ SHA-256 校验通过';
			this.dlBadge.className = 'nr-up-pill ok';
			var details = [];
			if (st.sha256) details.push('SHA-256 ' + shortSha(st.sha256));
			if (num(st.total) || num(st.bytes)) details.push(fmtSize(st.total || st.bytes));
			this.dlNote.textContent = '镜像完整性已验证' + (details.length ? '（' + details.join(' · ') + '）' : '') + '，请选择下方升级方式：';
			this.renderFlash(st);
		}
		else if (st.state === 'flashing') {
			this.dlBox.className = 'nr-up-card is-warn';
			this.dlTitle.textContent = '正在写入固件并重启…';
			this.dlBadge.textContent = '请勿断电';
			this.dlBadge.className = 'nr-up-pill warn';
			this.dlNote.textContent = '正在将新固件写入 TF 卡系统分区并重启路由器，约需 2–3 分钟，期间请勿断电。';
		}
		else if (st.state !== 'idle') {
			this.dlBox.className = 'nr-up-card is-warn';
			this.dlTitle.textContent = '固件未就绪';
			this.dlBadge.textContent = '待重新拉取';
			this.dlBadge.className = 'nr-up-pill warn';
			this.dlNote.textContent = st.msg || '本地缓存镜像已失效或丢失，请重新下载。';
		}

		this.updateActions();
		if (st.state === 'error' && this.flashing) {
			this.flashing = false;
			ui.hideModal();
			ui.addNotification(null, E('p', {}, st.msg), 'error');
		}
	},

	renderFlash: function(st) {
		this.flashBox.appendChild(E('div', { 'class': 'nr-up-flash-grid' }, [
			E('div', { 'class': 'nr-up-flash-opt recommended' }, [
				E('div', {}, [
					E('div', { 'style': 'display:flex;align-items:center;justify-content:space-between;gap:.5rem;' }, [
						E('strong', {}, '保留现有配置'),
						E('span', { 'class': 'nr-up-pill primary' }, '日常推荐')
					]),
					E('p', {}, '保留 Wi-Fi、5G SIM 卡槽、APN、防火墙和管理密码等设置，升级后管理地址不变。')
				]),
				E('div', {}, [
					E('button', { 'class': 'cbi-button cbi-button-apply', 'click': L.bind(this.handleFlash, this, false, st.sha256) }, '保留配置升级')
				])
			]),
			E('div', { 'class': 'nr-up-flash-opt' }, [
				E('div', {}, [
					E('div', { 'style': 'display:flex;align-items:center;justify-content:space-between;gap:.5rem;' }, [
						E('strong', {}, '恢复初始配置'),
						E('span', { 'class': 'nr-up-pill muted' }, '全新迁移')
					]),
					E('p', {}, '清除全部自定义设置（适合跨配置重置或排障），重启后需连有线 LAN 口访问 192.168.1.1。')
				]),
				E('div', {}, [
					E('button', { 'class': 'cbi-button cbi-button-negative', 'click': L.bind(this.handleFlash, this, true, st.sha256) }, '清除配置升级')
				])
			])
		]));
	},

	handleFlash: function(reset, digest) {
		if (this.busy || this.isActive()) return;
		this.busy = true;
		this.updateActions();
		this.setNotice('正在执行刷写前兼容性与摘要复核（sysupgrade -T）…', false);
		return exec([ 'preflight', digest ]).then(L.bind(function() {
			this.setNotice('', false);
			ui.showModal(reset ? '清除配置并升级' : '保留配置升级', [
				E('p', {}, '即将刷入固件版本：' + (this.download.tag || '未知版本')),
				E('p', {}, reset
					? 'Wi-Fi、SIM、APN、防火墙和管理密码等设置将恢复默认。重启后请用网线连接 LAN 口，访问 192.168.1.1 重新设置。'
					: '保留现有系统配置，后期自行安装的附加软件包需重新安装。升级后管理地址保持不变。'),
				E('p', {}, '写入与重启约需 2–3 分钟，期间请勿断电或拔出 TF 卡。'),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'btn', 'click': ui.hideModal }, '取消'), ' ',
					E('button', { 'class': 'btn cbi-button-negative', 'click': L.bind(this.doFlash, this, reset, digest) }, '确认升级')
				])
			]);
		}, this)).catch(L.bind(function(e) { this.setNotice(e.message, true); }, this)).finally(L.bind(function() {
			this.busy = false;
			this.updateActions();
		}, this));
	},

	doFlash: function(reset, digest) {
		if (this.busy || this.isActive()) return;
		this.busy = true;
		this.updateActions();
		return exec([ 'flash', reset ? 'reset' : 'keep', digest ]).then(L.bind(function() {
			this.flashing = true;
			this.renderDownload({ state: 'flashing' });
			ui.showModal('正在升级…', [
				E('p', { 'class': 'spinning' }, '正在写入固件并重启，约需 2–3 分钟，请勿断电。'),
				E('p', {}, reset ? '重启后请用网线连接 LAN 口，访问 http://192.168.1.1。' : '重启后请重新打开当前管理地址。')
			]);
			window.setTimeout(L.bind(function() {
				if (this.flashing) ui.awaitReconnect(reset ? '192.168.1.1' : window.location.host);
			}, this), 10000);
		}, this)).catch(function(e) {
			ui.hideModal();
			ui.addNotification(null, E('p', {}, e.message), 'error');
		}).finally(L.bind(function() { this.busy = false; this.updateActions(); }, this));
	},

	render: function(data) {
		ensureStyle();
		var self = this,
		    current = Array.isArray(data) ? (data[0] || {}) : (data || {}),
		    st = Array.isArray(data) ? (data[1] || { state: 'idle' }) : (data || { state: 'idle' });

		this.latest = null;
		this.checkError = '';
		this.localInfo = { tag: '', rev: '', date: '', kernel: '' };
		this.syncLocalInfo(current);
		this.syncLocalInfo(st);
		this.busy = false;
		this.checking = false;
		this.statusPending = false;
		this.notesExpanded = false;

		this.stepperBox = E('div', { 'class': 'nr-up-steps' });
		this.checkBox = E('div');
		this.notesBox = E('div', { 'class': 'nr-up-card', 'style': 'display:none;' });

		this.notice = E('p', { 'class': 'nr-up-notice', 'role': 'status', 'aria-live': 'polite' });
		this.mirrorInput = E('input', {
			'class': 'cbi-input-text',
			'type': 'url',
			'placeholder': '可选 HTTPS 加速前缀，留空则从 GitHub 官方直连下载',
			'aria-label': '下载加速前缀（可选）',
			'input': function() { self.updatePresetSelection(); }
		});

		// This view owns the disabled state for the entire background task;
		// ui.createHandlerFn would re-enable its button after the start RPC.
		this.checkButton = E('button', { 'class': 'cbi-button', 'click': L.bind(this.handleCheck, this, true) }, '重新检查');
		this.downloadButton = E('button', { 'class': 'cbi-button cbi-button-positive', 'click': L.bind(this.handleDownload, this) }, '下载固件到路由器');
		this.sourceCardTitle = E('strong', { 'style': 'font-size:.95rem;' }, '固件拉取与下载加速');

		var makePreset = function(label, mirrorVal) {
			return E('button', {
				'type': 'button',
				'class': 'nr-up-chip',
				'data-mirror': mirrorVal,
				'click': function() {
					self.mirrorInput.value = mirrorVal;
					self.updatePresetSelection();
				}
			}, label);
		};

		this.presetBox = E('div', { 'class': 'nr-up-presets' }, [
			E('span', {}, '下载源快捷选择：'),
			makePreset('GitHub 官方直连', ''),
			makePreset('加速镜像示例', 'https://gh-proxy.com/'),
			makePreset('ghfast 加速源', 'https://ghfast.top/')
		]);
		this.updatePresetSelection();

		this.dlTitle = E('strong', { 'style': 'font-size:.96rem;' });
		this.dlBadge = E('span', { 'class': 'nr-up-pill muted' });
		this.dlNote = E('p', { 'role': 'status', 'style': 'margin:.4rem 0 0;font-size:.84rem;color:var(--nr-muted);line-height:1.5;' });
		this.barFill = E('div', { 'class': 'nr-up-bar-fill' });
		this.bar = E('div', {
			'role': 'progressbar',
			'aria-label': '固件下载进度',
			'aria-valuemin': '0',
			'aria-valuemax': '100',
			'class': 'nr-up-bar'
		}, this.barFill);
		this.flashBox = E('div');
		this.dlBox = E('div', { 'class': 'nr-up-card' }, [
			E('div', { 'class': 'nr-up-card-top', 'style': 'margin-bottom:0;' }, [ this.dlTitle, this.dlBadge ]),
			this.bar,
			this.dlNote,
			this.flashBox
		]);

		this.renderOverview();
		this.renderDownload(st);
		poll.add(L.bind(function() {
			if (document.hidden || this.busy) return Promise.resolve();
			// Active tasks update every 2s. Idle tabs still notice other sessions.
			this.idleTicks = (this.idleTicks || 0) + 1;
			if (!this.isActive() && this.download.state !== 'unknown' && this.idleTicks % 5 !== 0) return Promise.resolve();
			return this.refreshDownload();
		}, this), 2);
		this.handleCheck(false);

		return E('div', { 'class': 'nr-up' }, [
			E('div', { 'class': 'nr-up-head' }, [
				E('div', {}, [
					E('h2', {}, '在线固件更新'),
					E('p', {}, '自动检测 veildawn/nradio-c2000-ultra 最新固件，在路由器后台完成拉取与 SHA-256 信任锚点校验。')
				]),
				E('div', { 'class': 'nr-up-head-actions' }, [
					E('a', { 'class': 'cbi-button', 'href': luciUrl('admin/system/flash') }, '本地上传 / 备份'),
					this.checkButton
				])
			]),
			this.stepperBox,
			this.checkBox,
			this.notesBox,
			this.dlBox,
			E('div', { 'class': 'nr-up-card' }, [
				E('div', { 'class': 'nr-up-card-top' }, [
					this.sourceCardTitle,
					E('span', { 'style': 'font-size:.78rem;color:var(--nr-muted);' }, '无论直连或镜像，均强制校验官方 SHA-256')
				]),
				E('div', { 'class': 'nr-up-dl-row' }, [ this.mirrorInput, this.downloadButton ]),
				this.presetBox,
				this.notice
			])
		]);
	}
});
