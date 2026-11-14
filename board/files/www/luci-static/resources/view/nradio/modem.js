'use strict';
'require view';
'require form';
'require poll';
'require fs';
'require uci';
'require ui';

var MODEM_CSS = [
	'.nr-md{--nr-card:var(--background-color-high,#fff);--nr-subtle:var(--background-color-low,#f6f8fa);--nr-text:var(--text-color-high,#1f2328);--nr-muted:var(--text-color-medium,#656d76);--nr-border:var(--border-color-medium,rgba(128,128,128,.22));--nr-border-soft:var(--border-color-low,rgba(128,128,128,.14));--nr-primary:var(--primary-color-high,#0969da);--nr-ok:var(--success-color-high,#2eb872);--nr-warn:var(--warn-color-high,#d9822b);--nr-err:var(--error-color-high,#d9534f);color:var(--nr-text);display:flex;flex-direction:column;gap:1rem}',
	':root[data-darkmode="true"] .nr-md{--nr-card:var(--background-color-high,#24262b);--nr-subtle:var(--background-color-low,#1b1d21);--nr-text:var(--text-color-high,#e6edf3);--nr-muted:var(--text-color-medium,#9ca3af);--nr-border:var(--border-color-medium,rgba(255,255,255,.14));--nr-border-soft:var(--border-color-low,rgba(255,255,255,.08));--nr-primary:var(--primary-color-high,#4a9eff)}',
	'.nr-md-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem}',
	'.nr-md-head h2{margin:0;font-size:1.35rem}',
	'.nr-md-head-right{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;font-size:.82rem;color:var(--nr-muted)}',
	'.nr-md-banner{padding:.75rem 1rem;border-radius:10px;border:1px solid var(--nr-border);font-size:.85rem;line-height:1.5}',
	'.nr-md-banner.warn{border-color:rgba(217,130,43,.45);color:var(--nr-warn);background:rgba(240,173,78,.12);background:color-mix(in srgb,var(--nr-warn) 13%,transparent)}',
	'.nr-md-banner.err{border-color:rgba(217,83,79,.45);color:var(--nr-err);background:rgba(217,83,79,.12);background:color-mix(in srgb,var(--nr-err) 13%,transparent)}',
	'.nr-md-banner.muted{background:var(--nr-subtle);color:var(--nr-muted)}',
	'.nr-md-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.75rem}',
	'@media(max-width:920px){.nr-md-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}',
	'@media(max-width:520px){.nr-md-kpis{grid-template-columns:1fr}}',
	'.nr-md-kpi{background:var(--nr-card);border:1px solid var(--nr-border);border-radius:11px;padding:.85rem 1rem;display:flex;flex-direction:column;gap:.35rem;min-width:0}',
	'.nr-md-kpi-top{display:flex;align-items:center;justify-content:space-between;gap:.4rem;font-size:.78rem;color:var(--nr-muted)}',
	'.nr-md-kpi-val{font-size:1.06rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:.45rem}',
	'.nr-md-kpi-sub{font-size:.78rem;color:var(--nr-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
	'.nr-md-pill{display:inline-flex;align-items:center;padding:.14rem .52rem;border-radius:999px;font-size:.74rem;font-weight:600;white-space:nowrap}',
	'.nr-md-pill.ok{color:var(--nr-ok);background:rgba(46,184,114,.14);background:color-mix(in srgb,var(--nr-ok) 15%,transparent)}',
	'.nr-md-pill.warn{color:var(--nr-warn);background:rgba(240,173,78,.16);background:color-mix(in srgb,var(--nr-warn) 16%,transparent)}',
	'.nr-md-pill.err{color:var(--nr-err);background:rgba(217,83,79,.14);background:color-mix(in srgb,var(--nr-err) 15%,transparent)}',
	'.nr-md-pill.primary{color:var(--nr-primary);background:rgba(9,105,218,.12);background:color-mix(in srgb,var(--nr-primary) 14%,transparent)}',
	'.nr-md-pill.muted{color:var(--nr-muted);background:var(--nr-subtle)}',
	'.nr-md-tabs{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:.2rem;list-style:none;padding:0;margin:0;border-bottom:1.5px solid var(--nr-border)}',
	'.nr-md-tab{padding:.55rem 1rem;cursor:pointer;border-bottom:2.5px solid transparent;margin-bottom:-1.5px;font-size:.88rem;font-weight:500;color:var(--nr-muted);white-space:nowrap;user-select:none}',
	'.nr-md-tab:hover{color:var(--nr-text)}',
	'.nr-md-tab.active{color:var(--nr-primary);border-bottom-color:var(--nr-primary);font-weight:600}',
	'.nr-md-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}',
	'@media(max-width:780px){.nr-md-grid2{grid-template-columns:1fr}}',
	'.nr-md-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.8rem}',
	'@media(max-width:780px){.nr-md-grid3{grid-template-columns:1fr}}',
	'.nr-md-card{background:var(--nr-card);border:1px solid var(--nr-border);border-radius:12px;padding:1rem 1.15rem;min-width:0}',
	'.nr-md-card-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.5rem;padding-bottom:.65rem;margin-bottom:.35rem;border-bottom:1px solid var(--nr-border-soft)}',
	'.nr-md-card-title{margin:0;font-size:.95rem;font-weight:600}',
	'.nr-md-kv{display:grid;grid-template-columns:minmax(98px,34%) 1fr;gap:.4rem .75rem;padding:.52rem 0;border-bottom:1px solid var(--nr-border-soft);font-size:.85rem;align-items:center}',
	'.nr-md-kv:last-child{border-bottom:none;padding-bottom:0}',
	'.nr-md-kv-k{color:var(--nr-muted)}',
	'.nr-md-kv-v{min-width:0;word-break:break-word}',
	'.nr-md-mono{font-family:monospace}',
	'.nr-md-linkbtn{background:none;border:none;padding:0;color:var(--nr-primary);cursor:pointer;font-size:.78rem;text-decoration:none}',
	'.nr-md-linkbtn:hover{text-decoration:underline}',
	'.nr-md-copychip{display:inline-flex;align-items:center;gap:.35rem;flex-wrap:wrap}',
	'.nr-md-gauge{background:var(--nr-subtle);border:1px solid var(--nr-border-soft);border-radius:10px;padding:.8rem .9rem;display:flex;flex-direction:column;gap:.4rem}',
	'.nr-md-gauge-bar{height:8px;border-radius:999px;background:var(--nr-card);border:1px solid var(--nr-border-soft);overflow:hidden}',
	'.nr-md-gauge-fill{height:100%;border-radius:999px;transition:width .35s ease}',
	'.nr-md-quota-bar{background:var(--nr-subtle);border:1px solid var(--nr-border-soft);border-radius:999px;height:12px;overflow:hidden;margin:.55rem 0}',
	'.nr-md-table{width:100%;border-collapse:collapse;font-size:.85rem}',
	'.nr-md-table th{text-align:left;padding:.5rem .6rem;border-bottom:1.5px solid var(--nr-border);color:var(--nr-muted);font-weight:600}',
	'.nr-md-table td{padding:.55rem .6rem;border-bottom:1px solid var(--nr-border-soft)}',
	'.nr-md-table tr:last-child td{border-bottom:none}',
	'.nr-md-note{margin:.65rem 0 0;font-size:.8rem;color:var(--nr-muted);line-height:1.5}'
].join('\n');

function ensureStyle() {
	if (typeof document !== 'undefined' && document.head && !document.getElementById('nr-modem-css'))
		document.head.appendChild(E('style', { 'id': 'nr-modem-css' }, MODEM_CSS));
}

var slotNames = {
	sim1: '外置 SIM1',
	sim2: '外置 SIM2',
	esim: '内置 eSIM',
	auto: '自动检测'
};

var sysmodeNames = {
	GSM: '2G (GSM)',
	WCDMA: '3G (WCDMA)',
	LTE: '4G (LTE)',
	NR: '5G (NR)',
	NOSERVICE: '无服务'
};

/* AT^MONSC field layout per RAT (see MT5700M-CN AT manual 13.9) */
var cellFields = {
	NR:    ['MCC', 'MNC', 'NR 频点 (ARFCN)', '子载波间隔', '小区标识 (Cell ID)', '物理小区标识 (PCI)', '跟踪区 (TAC)', 'RSRP (dBm)', 'RSRQ (dB)', 'SINR (dB)'],
	LTE:   ['MCC', 'MNC', 'LTE 频点 (EARFCN)', '小区标识 (Cell ID)', '物理小区标识 (PCI)', '跟踪区 (TAC)', 'RSRP (dBm)', 'RSRQ (dB)', 'RSSI (dBm)'],
	WCDMA: ['MCC', 'MNC', '频点 (ARFCN)', '主扰码 (PSC)', '小区标识 (Cell ID)', '位置区 (LAC)', 'RSCP (dBm)', 'RXLEV', 'Ec/N0', 'DRX', 'URA']
};

var scsNames = ['15 kHz', '30 kHz', '60 kHz', '120 kHz', '240 kHz'];

/* 3GPP TS 38.101-1 / TS 36.101 common China & global band ranges */
var nrBands = [
	[151600, 160600, 'n28', 'Band n28 (700 MHz FDD)'],
	[173800, 178800, 'n5',  'Band n5 (850 MHz FDD)'],
	[185000, 192000, 'n8',  'Band n8 (900 MHz FDD)'],
	[361000, 376000, 'n3',  'Band n3 (1800 MHz FDD)'],
	[422000, 434000, 'n1',  'Band n1 (2100 MHz FDD)'],
	[460000, 480000, 'n40', 'Band n40 (2300 MHz TDD)'],
	[499200, 537999, 'n41', 'Band n41 (2.6 GHz TDD)'],
	[620000, 653333, 'n78', 'Band n78 (3.5 GHz TDD)'],
	[693334, 733333, 'n79', 'Band n79 (4.9 GHz TDD)']
];

var lteBands = [
	[0,     599,   'B1',  'Band 1 (2100 MHz FDD)'],
	[1200,  1949,  'B3',  'Band 3 (1800 MHz FDD)'],
	[2400,  2649,  'B5',  'Band 5 (850 MHz FDD)'],
	[3450,  3799,  'B8',  'Band 8 (900 MHz FDD)'],
	[36200, 36349, 'B34', 'Band 34 (2010 MHz TDD)'],
	[37750, 38249, 'B38', 'Band 38 (2600 MHz TDD)'],
	[38250, 38649, 'B39', 'Band 39 (1900 MHz TDD)'],
	[38650, 39649, 'B40', 'Band 40 (2300 MHz TDD)'],
	[39650, 41589, 'B41', 'Band 41 (2500 MHz TDD)']
];

/* 3GPP TS 23.203 / 23.501 QCI(5QI) characteristics */
var qciTable = {
	1:  ['GBR', '会话类语音', '100 ms', '10⁻²'],
	2:  ['GBR', '会话类视频（直播）', '150 ms', '10⁻³'],
	3:  ['GBR', '实时游戏 / VR', '50 ms', '10⁻³'],
	4:  ['GBR', '非会话类视频（缓冲流）', '300 ms', '10⁻⁶'],
	65: ['GBR', '高可靠语音（5G PrEMBS）', '75 ms', '10⁻²'],
	66: ['GBR', '高可靠视频（5G）', '100 ms', '10⁻²'],
	67: ['GBR', '视频通话（5G）', '100 ms', '10⁻³'],
	5:  ['non-GBR', 'IMS 信令', '100 ms', '10⁻⁶'],
	6:  ['non-GBR', '缓冲视频 / 交互业务', '300 ms', '10⁻⁶'],
	7:  ['non-GBR', '语音 / 视频 / 交互游戏', '100 ms', '10⁻³'],
	8:  ['non-GBR', '视频 / 交互（默认承载）', '300 ms', '10⁻⁶'],
	9:  ['non-GBR', '默认承载（TCP / Web 等）', '300 ms', '10⁻⁶'],
	69: ['non-GBR', '5G 低时延信令', '60 ms', '10⁻⁶'],
	70: ['non-GBR', '5G 低时延数据', '200 ms', '10⁻⁶'],
	79: ['non-GBR', '5G 默认承载（低时延）', '60 ms', '10⁻⁶'],
	80: ['non-GBR', '5G 低时延增强', '10 ms', '10⁻⁶']
};

function num(v) {
	var n = parseInt(v, 10);
	return isNaN(n) ? null : n;
}

function inferBand(rat, rawCell) {
	if (!rawCell) return null;
	var f = num(String(rawCell).split(',')[2]);
	if (f === null) return null;
	var table = (rat === 'NR') ? nrBands : (rat === 'LTE') ? lteBands : null;
	if (!table) return null;
	for (var i = 0; i < table.length; i++) {
		if (f >= table[i][0] && f <= table[i][1])
			return { code: table[i][2], desc: table[i][3] };
	}
	return null;
}

function maskMiddle(s, head, tail) {
	if (!s || s.length <= head + tail) return s || '—';
	var stars = new Array(s.length - head - tail + 1).join('*');
	return s.slice(0, head) + stars + s.slice(s.length - tail);
}

function copyButton(rawVal) {
	if (!rawVal) return '';
	var timer;
	var feedback = E('span', { 'role': 'status' });
	function legacyCopy() {
		var field = E('textarea', { 'readonly': '', 'style': 'position:fixed;top:0;opacity:0;' });
		field.value = rawVal;
		document.body.appendChild(field);
		field.select();
		try {
			return document.execCommand('copy');
		} finally {
			field.remove();
			btn.focus();
		}
	}
	var btn = E('button', {
		'type': 'button',
		'class': 'nr-md-linkbtn',
		'click': async function() {
			var copied = false;
			try {
				if (navigator.clipboard && navigator.clipboard.writeText) {
					await navigator.clipboard.writeText(rawVal);
					copied = true;
				} else {
					copied = legacyCopy();
				}
			} catch (e) {}
			feedback.textContent = copied ? '已复制' : '复制失败';
			window.clearTimeout(timer);
			timer = window.setTimeout(function() { feedback.textContent = ''; }, 1500);
		}
	}, '复制');
	return E('span', {}, [btn, feedback]);
}

function fmtDbm(v) {
	var n = num(v);
	return (n === null) ? '—' : '%d dBm'.format(n);
}

function fmtTenth(dc, suffix) {
	var n = num(dc);
	return (n === null) ? '—' : '%.1f%s'.format(n / 10, suffix || ' dB');
}

function fmtBytes(b) {
	var n = Number(b) || 0;
	if (n >= 1073741824) return '%.2f GB'.format(n / 1073741824);
	if (n >= 1048576) return '%.2f MB'.format(n / 1048576);
	if (n >= 1024) return '%.1f KB'.format(n / 1024);
	return '%d B'.format(n);
}

function fmtRate(bps) {
	var n = Number(bps) || 0;
	if (n >= 1048576) return '%.2f MB/s'.format(n / 1048576);
	if (n >= 1024) return '%.1f KB/s'.format(n / 1024);
	return '%d B/s'.format(n);
}

function fmtKbps(kbps) {
	var n = num(kbps);
	if (n === null) return '—';
	if (n >= 1000000) return '%.1f Gbps（%d Mbps）'.format(n / 1000000, Math.round(n / 1000));
	if (n >= 1000) return '%d Mbps'.format(Math.round(n / 1000));
	return '%d kbps'.format(n);
}

function fmtUptime(s) {
	var n = num(s) || 0, d = Math.floor(n / 86400), h = Math.floor(n % 86400 / 3600), m = Math.floor(n % 3600 / 60);
	if (d > 0) return '%d 天 %d 小时 %d 分'.format(d, h, m);
	if (h > 0) return '%d 小时 %d 分'.format(h, m);
	return '%d 分'.format(m);
}

/* Pick the best available quality metric for the current radio mode and
 * map it to a 0..5 bar count (vendor-style signal indicator). */
function signalBars(st) {
	var sm = st.signal.sysmode,
	    rsrp = num(st.signal.rsrp_dbm),
	    rscp = num(st.signal.rscp_dbm),
	    rssi = num(st.signal.rssi_dbm) || num(st.signal.csq_dbm),
	    v = null, isRsrp = false;

	if (sm == 'NR' || sm == 'LTE') {
		v = rsrp; isRsrp = true;
	}
	else if (sm == 'WCDMA') {
		v = (rscp !== null) ? rscp : rssi;
	}
	else {
		v = rssi;
	}

	if (v === null || v === 0)
		return { bars: 0, metric: '' };

	var bars;
	if (isRsrp || sm == 'WCDMA')
		bars = (v >= -85) ? 5 : (v >= -95) ? 4 : (v >= -105) ? 3 : (v >= -115) ? 2 : 1;
	else
		bars = (v >= -60) ? 5 : (v >= -70) ? 4 : (v >= -80) ? 3 : (v >= -90) ? 2 : 1;

	return { bars: bars, metric: fmtDbm(v) };
}

function buildBarStrip(bars) {
	var color = (bars >= 4) ? '#2eb872' : (bars == 3) ? '#f0ad4e' : '#d9534f',
	    widget = E('span', { 'style': 'display:inline-flex;align-items:flex-end;gap:2px;height:16px;vertical-align:middle;' });
	for (var i = 1; i <= 5; i++) {
		widget.appendChild(E('span', {
			'style': 'width:4px;height:%dpx;border-radius:1.5px;background:%s;'.format(2 + i * 2.8, (i <= bars) ? color : 'rgba(128,128,128,.25)')
		}));
	}
	return widget;
}

function renderSignalWidget(st) {
	var q = signalBars(st);
	return E('span', { 'style': 'display:inline-flex;align-items:center;gap:.45rem;' }, [
		buildBarStrip(q.bars),
		E('span', { 'style': 'font-weight:600;' }, (q.bars > 0) ? (sysmodeNames[st.signal.sysmode] || st.signal.sysmode) : '无信号'),
		(q.metric !== '') ? E('span', { 'class': 'nr-md-mono' }, '（%s）'.format(q.metric)) : ''
	]);
}

function sparkline(canvas, data, maxHint) {
	if (!canvas) return;
	var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
	var cssW = canvas.clientWidth || 300, cssH = canvas.clientHeight || 64;
	canvas.width = Math.round(cssW * dpr);
	canvas.height = Math.round(cssH * dpr);
	var ctx = canvas.getContext('2d');
	ctx.scale(dpr, dpr);
	ctx.clearRect(0, 0, cssW, cssH);

	ctx.strokeStyle = 'rgba(128,128,128,0.16)';
	ctx.lineWidth = 1;
	[0.33, 0.66].forEach(function(r) {
		ctx.beginPath();
		ctx.moveTo(0, cssH * r);
		ctx.lineTo(cssW, cssH * r);
		ctx.stroke();
	});

	if (!data || data.length < 2) return;
	var max = Math.max.apply(null, data.concat([maxHint || 1])) * 1.15;
	var pts = data.map(function(v, i) {
		return {
			x: i / (data.length - 1) * (cssW - 4) + 2,
			y: cssH - 4 - (v / max) * (cssH - 10)
		};
	});

	ctx.save();
	ctx.beginPath();
	ctx.moveTo(pts[0].x, cssH - 2);
	pts.forEach(function(p) { ctx.lineTo(p.x, p.y); });
	ctx.lineTo(pts[pts.length - 1].x, cssH - 2);
	ctx.closePath();
	ctx.fillStyle = canvas.dataset.color || '#2eb872';
	ctx.globalAlpha = 0.16;
	ctx.fill();
	ctx.restore();

	ctx.beginPath();
	pts.forEach(function(p, i) {
		if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
	});
	ctx.strokeStyle = canvas.dataset.color || '#2eb872';
	ctx.lineWidth = 2;
	ctx.lineJoin = 'round';
	ctx.stroke();
}

return view.extend({
	/* Prefetch one snapshot for the very first paint; failures just fall
	 * back to the immediate first poll tick. */
	load: function() {
		return fs.exec('/usr/sbin/mt5700-status').catch(function(e) { return { error: e.message }; });
	},

	rateRx: [],
	rateTx: [],
	lastTraffic: null,
	lastSnapshot: null,
	maskIds: true,
	cells: {},

	kvBlock: function(rows) {
		var box = E('div');
		rows.forEach(function(r) {
			box.appendChild(E('div', { 'class': 'nr-md-kv' }, [
				E('span', { 'class': 'nr-md-kv-k' }, r[0]),
				E('div', { 'class': 'nr-md-kv-v' }, Array.isArray(r[1]) ? r[1] : [ r[1] ])
			]));
		});
		return box;
	},

	buildTabs: function() {
		var titles = [
			['overview', '总览'],
			['cell', '小区与信号'],
			['simqos', 'SIM 与 QoS'],
			['traffic', '流量统计'],
			['settings', '设置']
		];
		var self = this;
		var bar = E('ul', { 'class': 'nr-md-tabs', 'role': 'tablist' });
		var bodies = {};

		titles.forEach(function(t, i) {
			var li = E('li', {
				'class': 'nr-md-tab' + (i === 0 ? ' active' : ''),
				'role': 'tab',
				'aria-selected': i === 0 ? 'true' : 'false',
				'click': function() {
					bar.querySelectorAll('li').forEach(function(el) {
						el.classList.remove('active');
						el.setAttribute('aria-selected', 'false');
					});
					li.classList.add('active');
					li.setAttribute('aria-selected', 'true');
					Object.keys(bodies).forEach(function(k) { bodies[k].style.display = 'none'; });
					bodies[t[0]].style.display = '';
					if (t[0] === 'traffic') {
						sparkline(self.canvasRx, self.rateRx, 1024 * 200);
						sparkline(self.canvasTx, self.rateTx, 1024 * 50);
					}
				}
			}, t[1]);
			bar.appendChild(li);
			bodies[t[0]] = E('div', { 'style': (i === 0 ? '' : 'display:none;') });
		});

		this.tabBodies = bodies;
		return { bar: bar, bodies: bodies };
	},

	renderIdentityFields: function(st, hideValues) {
		var C = this.cells;
		if (hideValues) {
			C.imsi.replaceChildren('—');
			C.imei.replaceChildren('—');
			return;
		}
		var imsi = (st && st.sim && st.sim.imsi) || '';
		var iccid = (st && st.sim && st.sim.iccid) || '';
		var imei = (st && st.imei) || '';

		var imsiShown = imsi ? (this.maskIds ? maskMiddle(imsi, 5, 4) : imsi) : '—';
		var iccidShown = iccid ? (this.maskIds ? maskMiddle(iccid, 6, 4) : iccid) : '—';
		var imeiShown = imei ? (this.maskIds ? maskMiddle(imei, 6, 3) : imei) : '—';

		var stack = E('div', { 'style': 'display:flex;flex-direction:column;gap:.25rem;' }, [
			E('div', { 'class': 'nr-md-copychip' }, [
				E('span', { 'style': 'color:var(--nr-muted);font-size:.8rem;' }, 'IMSI:'),
				E('span', { 'class': 'nr-md-mono' }, imsiShown),
				imsi ? copyButton(imsi) : ''
			]),
			E('div', { 'class': 'nr-md-copychip' }, [
				E('span', { 'style': 'color:var(--nr-muted);font-size:.8rem;' }, 'ICCID:'),
				E('span', { 'class': 'nr-md-mono' }, iccidShown),
				iccid ? copyButton(iccid) : ''
			])
		]);
		C.imsi.replaceChildren(stack);

		var imeiChildren = [ E('span', { 'class': 'nr-md-mono' }, imeiShown) ];
		if (imei) imeiChildren.push(' ', copyButton(imei));
		C.imei.replaceChildren.apply(C.imei, imeiChildren);
	},

	resetKpisOnFailure: function() {
		if (!this.kpi) return;
		this.alertBanner.style.display = 'none';
		this.kpi.netPill.textContent = '离线';
		this.kpi.netPill.className = 'nr-md-pill muted';
		this.kpi.netVal.textContent = '—';
		this.kpi.netSub.textContent = '暂时无法获取状态';
		this.kpi.bandPill.textContent = '—';
		this.kpi.bandPill.className = 'nr-md-pill muted';
		this.kpi.sigVal.replaceChildren('—');
		this.kpi.sigSub.textContent = '—';
		this.kpi.usbPill.textContent = '—';
		this.kpi.usbPill.className = 'nr-md-pill muted';
		this.kpi.simVal.textContent = '—';
		this.kpi.simSub.textContent = '—';
		this.kpi.tempPill.textContent = '—';
		this.kpi.tempPill.className = 'nr-md-pill muted';
		this.kpi.tempSub.textContent = '—';
		if (this.rfGaugesBox) this.rfGaugesBox.replaceChildren();
	},

	/* ------------------------- update logic ------------------------- */

	updateStatus: function(st) {
		/* tolerate snapshots from older helper versions */
		st.traffic = st.traffic || {};
		st.cell = st.cell || {};
		st.qos = st.qos || {};
		st.pdp = st.pdp || {};
		st.sim = st.sim || {};
		st.reg = st.reg || {};
		st.signal = st.signal || {};
		st.wwan = st.wwan || {};
		this.lastSnapshot = st;

		var interval = num(st.check_interval) || 30,
		    staleAfter = Math.max(60, interval * 2),
		    age = num(st.stamp_age),
		    stale = (age !== null && age > staleAfter),
		    noData = (st.source === 'none'),
		    phase = st.sim.phase || '',
		    switching = (st.sim.transition === 1 || noData || phase == 'switching'),
		    absent = (phase == 'absent'),
		    disabled = (st.enabled === '0'),
		    tempNum = (!stale && !switching) ? num(st.temp_dc) : null,
		    bandInfo = (!stale && !switching && !absent) ? inferBand(st.cell.rat || st.signal.sysmode, st.cell.raw) : null;
		var C = this.cells, K = this.kpi;

		/* Contextual alert banner */
		var bannerMsg = '', bannerCls = '';
		if (disabled) {
			bannerMsg = '蜂窝功能当前已关闭，可在「设置」选项卡中重新启用。';
			bannerCls = 'nr-md-banner muted';
		}
		else if (!st.present) {
			bannerMsg = '未检测到 MT5700M-CN 模组（USB 3466:3301 离线），请检查硬件状态。';
			bannerCls = 'nr-md-banner err';
		}
		else if (num(st.traffic.over_limit) === 1) {
			bannerMsg = (st.traffic.action == 'offline')
				? '本月流量已超出设定限额，守护进程已按保护策略断开蜂窝连接。'
				: '提醒：本月蜂窝流量已超出设定限额（当前为仅提醒模式）。';
			bannerCls = (st.traffic.action == 'offline') ? 'nr-md-banner err' : 'nr-md-banner warn';
		}
		else if (st.cfun === '0') {
			bannerMsg = '模组射频当前处于关闭状态（CFUN=0），等待后台守护进程恢复。';
			bannerCls = 'nr-md-banner warn';
		}
		else if (st.usb_speed === '480') {
			bannerMsg = '提示：模组当前以 USB 2.0 (480 Mbps) 枚举，若已开启 USB 3.0 自动重训练将在后台自动恢复 5000 Mbps。';
			bannerCls = 'nr-md-banner warn';
		}
		else if (tempNum !== null && tempNum >= 720) {
			bannerMsg = '模组芯片温度达 %.1f °C，已触发联动散热加速。'.format(tempNum / 10);
			bannerCls = (tempNum >= 900) ? 'nr-md-banner err' : 'nr-md-banner warn';
		}

		if (bannerMsg) {
			this.alertBanner.className = bannerCls;
			this.alertBanner.textContent = bannerMsg;
			this.alertBanner.style.display = '';
		}
		else {
			this.alertBanner.style.display = 'none';
		}

		/* Hardware & SIM overview fields */
		if (disabled) {
			C.modem.textContent = '蜂窝功能已关闭（可在下方启用）';
		}
		else if (!st.present) {
			C.modem.textContent = '未检测到模组（USB 3466:3301 不在线）';
		}
		else {
			var usbBadgeCls = (num(st.usb_speed) >= 5000) ? 'nr-md-pill ok' : 'nr-md-pill warn';
			C.modem.replaceChildren(
				E('span', { 'style': 'font-weight:600;margin-right:.45rem;' }, 'MT5700M-CN 在线'),
				E('span', { 'class': usbBadgeCls + ' nr-md-mono' }, 'USB %s Mbps'.format(st.usb_speed || '?')),
				E('div', { 'style': 'font-size:.78rem;color:var(--nr-muted);margin-top:.2rem;', 'class': 'nr-md-mono' },
					'AT 口 %s · 网卡 %s'.format(st.at_port || '—', st.netdev || '—'))
			);
		}

		var slot = (st.sim.slot) ? (slotNames[st.sim.slot] || st.sim.slot) : '—';
		var cfgslot = (st.sim.configured_slot)
			? (slotNames[st.sim.configured_slot] || st.sim.configured_slot) : '—';

		if (!st.present || disabled) {
			C.sim.textContent = '—';
			this.renderIdentityFields(st, true);
			C.reg.textContent = '—';
			C.sig.replaceChildren(E('span', {}, '—'));
			C.temp.textContent = '—';

			K.bandPill.textContent = '—';
			K.bandPill.className = 'nr-md-pill muted';
			K.sigVal.replaceChildren('—');
			K.sigSub.textContent = disabled ? '蜂窝已停用' : '模组不在线';
			K.usbPill.textContent = disabled ? '已停用' : '离线';
			K.usbPill.className = 'nr-md-pill muted';
			K.simVal.textContent = slot;
			K.simSub.textContent = '配置：%s'.format(cfgslot);
			K.tempPill.textContent = '—';
			K.tempPill.className = 'nr-md-pill muted';
		}
		else {
			K.usbPill.textContent = (num(st.usb_speed) >= 5000) ? 'USB 3.0' : (st.usb_speed ? ('USB ' + st.usb_speed + 'M') : '在线');
			K.usbPill.className = (num(st.usb_speed) >= 5000) ? 'nr-md-pill ok nr-md-mono' : 'nr-md-pill warn nr-md-mono';
			K.simVal.textContent = slot;

			if (switching || stale) {
				C.sim.textContent = '正在检测 SIM 卡…（当前：%s，配置：%s）'.format(slot, cfgslot);
				K.simSub.textContent = '正在检测… · 配置：%s'.format(cfgslot);
			}
			else if (absent) {
				C.sim.textContent = '未检测到 SIM 卡（当前卡槽：%s）'.format(slot);
				K.simSub.textContent = '未插卡 · 配置：%s'.format(cfgslot);
			}
			else {
				var simTxt = '%s · 卡槽：%s'.format(st.sim.state_cn || st.sim.state || '未知', slot);
				if (st.sim.configured_slot != st.sim.slot && st.sim.configured_slot != 'auto')
					simTxt += '（已配置 %s，将在 %d 秒内切换）'.format(cfgslot, interval);
				else if (st.sim.configured_slot == 'auto')
					simTxt += '（配置：自动检测）';
				C.sim.textContent = simTxt;
				K.simSub.textContent = '%s · 配置：%s'.format(st.sim.state_cn || '已就绪', cfgslot);
			}
			C.sim.title = 'SCICHG=%s，cpe-sel0=%s'.format(st.sim.scichg || '—', st.sim.slot_gpio || '—');

			this.renderIdentityFields(st, absent || switching || stale);

			if (switching || stale) {
				C.reg.textContent = '检测中…';
			}
			else if (absent) {
				C.reg.textContent = '未注册（无 SIM 卡）';
			}
			else {
				var regNodes = E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:.35rem;align-items:center;' });
				if (st.reg.operator)
					regNodes.appendChild(E('span', { 'style': 'font-weight:600;margin-right:.25rem;' },
						'%s%s'.format(st.reg.operator, (st.reg.operator_act || st.reg.cereg_act) ? (' · ' + (st.reg.operator_act || st.reg.cereg_act)) : '')));
				if (st.sim.carrier)
					regNodes.appendChild(E('span', { 'class': 'nr-md-pill primary' }, st.sim.carrier));
				regNodes.appendChild(E('span', { 'class': 'nr-md-pill muted' }, 'CEREG: %s'.format(st.reg.cereg_state || '未知')));
				if (st.reg.c5greg_stat)
					regNodes.appendChild(E('span', { 'class': 'nr-md-pill muted' }, 'C5GREG: %s'.format(st.reg.c5greg_state || '未知')));
				if (st.cfun === '0')
					regNodes.appendChild(E('span', { 'class': 'nr-md-pill warn' }, 'CFUN=0 射频已关'));
				C.reg.replaceChildren(regNodes);
			}

			if (switching || stale) {
				C.sig.replaceChildren(E('span', {}, '检测中…'));
				K.bandPill.textContent = '检测中';
				K.bandPill.className = 'nr-md-pill muted';
				K.sigVal.replaceChildren('检测中…');
				K.sigSub.textContent = '等待模组上报';
			}
			else if (absent || !st.signal.sysmode) {
				C.sig.replaceChildren(E('span', {}, '无服务'));
				K.bandPill.textContent = '无服务';
				K.bandPill.className = 'nr-md-pill muted';
				K.sigVal.replaceChildren('无信号');
				K.sigSub.textContent = absent ? '未检测到 SIM 卡' : '未驻留小区';
			}
			else {
				C.sig.replaceChildren(renderSignalWidget(st));
				var s = st.signal, parts = [];
				if (s.rsrp_dbm) parts.push('RSRP %s'.format(fmtDbm(s.rsrp_dbm)));
				if (s.rscp_dbm) parts.push('RSCP %s'.format(fmtDbm(s.rscp_dbm)));
				if (s.rssi_dbm) parts.push('RSSI %s'.format(fmtDbm(s.rssi_dbm)));
				else if (s.csq_dbm) parts.push('RSSI %s'.format(fmtDbm(s.csq_dbm)));
				if (s.sinr_dc) parts.push('SINR %s'.format(fmtTenth(s.sinr_dc)));
				if (s.rsrq_dc) parts.push('RSRQ %s'.format(fmtTenth(s.rsrq_dc)));
				if (s.ecio_dc) parts.push('Ec/Io %s'.format(fmtTenth(s.ecio_dc)));
				C.sig.appendChild(E('div', { 'style': 'font-size:.8rem;color:var(--nr-muted);margin-top:.2rem;', 'class': 'nr-md-mono' }, parts.join(' · ') || '—'));

				var q = signalBars(st);
				K.bandPill.textContent = bandInfo ? bandInfo.code : (st.signal.sysmode || '—');
				K.bandPill.className = 'nr-md-pill primary nr-md-mono';
				K.sigVal.replaceChildren(buildBarStrip(q.bars), E('span', { 'class': 'nr-md-mono' }, q.metric || (sysmodeNames[st.signal.sysmode] || st.signal.sysmode)));
				var subParts = [];
				if (s.sinr_dc) subParts.push('SINR %s'.format(fmtTenth(s.sinr_dc)));
				if (s.rsrq_dc) subParts.push('RSRQ %s'.format(fmtTenth(s.rsrq_dc)));
				K.sigSub.textContent = subParts.join(' · ') || (sysmodeNames[st.signal.sysmode] || '信号正常');
			}

			if (tempNum !== null) {
				C.temp.textContent = '%.1f °C'.format(tempNum / 10);
				if (tempNum >= 900) {
					K.tempPill.textContent = '高温告警';
					K.tempPill.className = 'nr-md-pill err';
				}
				else if (tempNum >= 720) {
					K.tempPill.textContent = '风扇联动';
					K.tempPill.className = 'nr-md-pill warn';
				}
				else {
					K.tempPill.textContent = '散热正常';
					K.tempPill.className = 'nr-md-pill ok';
				}
			}
			else {
				C.temp.textContent = '—';
				K.tempPill.textContent = '待采样';
				K.tempPill.className = 'nr-md-pill muted';
			}
		}

		/* WWAN & KPI 1 */
		var wwanNodes = E('div', { 'style': 'display:flex;flex-direction:column;gap:.3rem;' });
		var wwanTop = E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;' });
		var isConnected = !!(st.wwan.up && (st.wwan.ip4 || st.wwan.ip6));

		if (isConnected) {
			wwanTop.appendChild(E('span', { 'class': 'nr-md-pill ok' }, '已连接'));
			K.netPill.textContent = '已连接';
			K.netPill.className = 'nr-md-pill ok';
			if (num(st.carrier_link) === 0)
				wwanTop.appendChild(E('span', { 'class': 'nr-md-pill warn' }, '链路重建中'));
		}
		else if (st.wwan.pending || st.wwan.up) {
			wwanTop.appendChild(E('span', { 'class': 'nr-md-pill primary' }, st.wwan.up ? '连接建立中（待获取 IP）' : '正在拨号…'));
			K.netPill.textContent = '拨号中';
			K.netPill.className = 'nr-md-pill primary';
		}
		else {
			wwanTop.appendChild(E('span', { 'class': 'nr-md-pill muted' }, '未连接'));
			K.netPill.textContent = disabled ? '已关闭' : '未连接';
			K.netPill.className = 'nr-md-pill muted';
		}
		wwanTop.appendChild(E('span', { 'class': 'nr-md-pill muted nr-md-mono' }, 'APN: %s'.format(st.apn || '自动')));
		wwanNodes.appendChild(wwanTop);

		if (st.wwan.ip4) {
			wwanNodes.appendChild(E('div', { 'class': 'nr-md-copychip' }, [
				E('span', { 'style': 'color:var(--nr-muted);font-size:.8rem;' }, 'IPv4:'),
				E('code', { 'class': 'nr-md-mono' }, st.wwan.ip4),
				copyButton(st.wwan.ip4)
			]));
		}
		if (st.wwan.ip6) {
			wwanNodes.appendChild(E('div', { 'class': 'nr-md-copychip' }, [
				E('span', { 'style': 'color:var(--nr-muted);font-size:.8rem;' }, 'IPv6:'),
				E('code', { 'class': 'nr-md-mono' }, st.wwan.ip6),
				copyButton(st.wwan.ip6)
			]));
		}
		C.wwan.replaceChildren(wwanNodes);

		var operName = (!stale && !switching && !absent)
			? (st.sim.carrier || st.reg.operator || (st.signal.sysmode ? sysmodeNames[st.signal.sysmode] : ''))
			: '';
		var ratShort = (!stale && !switching && !absent && st.signal.sysmode && st.signal.sysmode !== 'NOSERVICE')
			? (sysmodeNames[st.signal.sysmode] || st.signal.sysmode)
			: '';
		K.netVal.textContent = disabled ? '蜂窝已停用'
			: (!st.present ? '模组离线'
			: (operName && ratShort && operName !== ratShort ? '%s · %s'.format(operName, ratShort)
			: (operName || ratShort || (switching ? '正在检测…' : '等待驻留'))));
		K.netSub.textContent = isConnected
			? '在线 %s · APN %s'.format(fmtUptime(st.traffic.uptime), st.apn || '自动')
			: 'APN：%s'.format(st.apn || '自动');

		C.uptime.textContent = fmtUptime(st.traffic.uptime);

		var limitMb = num(st.traffic.limit_mb),
		    monUsedB = (num(st.traffic.mon_rx) || 0) + (num(st.traffic.mon_tx) || 0);
		K.tempSub.textContent = (limitMb && limitMb > 0)
			? '本月流量：%s / %s'.format(fmtBytes(monUsedB), fmtBytes(limitMb * 1048576))
			: '本月流量：%s'.format(fmtBytes(monUsedB));

		var meta = [];
		if (st.busy)
			meta.push('AT 通道忙');
		if (stale)
			meta.push('数据已过期（%d 秒前）'.format(age));
		if (noData) meta.push('等待后台采集 · 10s 自动刷新');
		else meta.push('快照 %d 秒前 · 10s 自动刷新'.format(Math.max(0, age || 0)));
		C.meta.textContent = meta.join(' ｜ ');

		var self = this;
		['updateCellTab', 'updateSimQosTab', 'updateTrafficTab'].forEach(function(fn) {
			try { self[fn](st, switching, stale || !st.present || disabled, absent); }
			catch (e) {
				self.cells.meta.textContent = '%s 更新异常：%s'.format(fn, e.message);
			}
		});
	},

	updateCellTab: function(st, switching, stale, absent) {
		var C = this.cells, raw = (st.cell && st.cell.raw) || '', rat = (st.cell && st.cell.rat) || '';

		if (switching || stale) {
			C.cellrat.textContent = '检测中…';
			this.rfGaugesBox.replaceChildren();
			C.celltable.replaceChildren();
			return;
		}

		var band = (!absent) ? inferBand(rat || st.signal.sysmode, raw) : null;
		C.cellrat.textContent = (rat && rat != 'NONE')
			? (band ? '%s · %s'.format(rat, band.desc) : rat)
			: (absent ? '无 SIM 卡' : '未知');

		/* Render RF quality gauges */
		var s = st.signal || {}, gauges = [];
		var rsrp = num(s.rsrp_dbm), sinrDc = num(s.sinr_dc), rsrqDc = num(s.rsrq_dc), rscp = num(s.rscp_dbm), rssi = num(s.rssi_dbm) || num(s.csq_dbm);
		if (!absent && rsrp !== null) {
			gauges.push({
				title: 'RSRP 接收功率',
				val: '%d dBm'.format(rsrp),
				pct: Math.max(5, Math.min(100, Math.round((rsrp + 135) / 85 * 100))),
				verdict: rsrp >= -85 ? ['极佳', 'var(--nr-ok)'] : rsrp >= -100 ? ['良好', 'var(--nr-primary)'] : ['偏弱', 'var(--nr-warn)'],
				hint: '参考区间 -135 … -50 dBm'
			});
		}
		else if (!absent && (rscp !== null || rssi !== null)) {
			var rv = (rscp !== null) ? rscp : rssi;
			gauges.push({
				title: (rscp !== null) ? 'RSCP 接收功率' : 'RSSI 信号强度',
				val: '%d dBm'.format(rv),
				pct: Math.max(5, Math.min(100, Math.round((rv + 120) / 70 * 100))),
				verdict: rv >= -85 ? ['良好', 'var(--nr-ok)'] : ['一般', 'var(--nr-warn)'],
				hint: '参考区间 -120 … -50 dBm'
			});
		}
		if (!absent && sinrDc !== null) {
			var sinr = sinrDc / 10;
			gauges.push({
				title: 'SINR 信噪比',
				val: '%.1f dB'.format(sinr),
				pct: Math.max(5, Math.min(100, Math.round((sinr + 5) / 35 * 100))),
				verdict: sinr >= 15 ? ['极佳', 'var(--nr-ok)'] : sinr >= 5 ? ['一般', 'var(--nr-warn)'] : ['较差', 'var(--nr-err)'],
				hint: '参考区间 -5 … +30 dB'
			});
		}
		if (!absent && rsrqDc !== null) {
			var rsrq = rsrqDc / 10;
			gauges.push({
				title: 'RSRQ 接收质量',
				val: '%.1f dB'.format(rsrq),
				pct: Math.max(5, Math.min(100, Math.round((rsrq + 20) / 17 * 100))),
				verdict: rsrq >= -10 ? ['优良', 'var(--nr-ok)'] : ['一般', 'var(--nr-warn)'],
				hint: '参考区间 -20 … -3 dB'
			});
		}

		this.rfGaugesBox.replaceChildren.apply(this.rfGaugesBox, gauges.map(function(g) {
			return E('div', { 'class': 'nr-md-gauge' }, [
				E('div', { 'style': 'display:flex;justify-content:space-between;font-size:.8rem;' }, [
					E('span', { 'style': 'color:var(--nr-muted);' }, g.title),
					E('span', { 'style': 'font-weight:600;color:' + g.verdict[1] }, g.verdict[0])
				]),
				E('div', { 'style': 'font-size:1.05rem;font-weight:700;', 'class': 'nr-md-mono' }, g.val),
				E('div', { 'class': 'nr-md-gauge-bar' }, [
					E('div', { 'class': 'nr-md-gauge-fill', 'style': 'width:%d%%;background:%s;'.format(g.pct, g.verdict[1]) })
				]),
				E('div', { 'style': 'font-size:.75rem;color:var(--nr-muted);', 'class': 'nr-md-mono' }, g.hint)
			]);
		}));
		this.rfGaugesCard.style.display = gauges.length ? '' : 'none';

		var names = cellFields[rat], rows = [];
		if (names && raw) {
			var vals = raw.split(',');
			var reg = new RegExp('^([0-9]+)$');
			rows.push(['PLMN (MCC-MNC)', '%s-%s'.format(vals[0], vals[1])]);
			if (band)
				rows.push(['推算 3GPP 频段', band.desc]);
			names.forEach(function(n, i) {
				if (i === 0 || i === 1) return;
				var v = (vals[i] !== undefined && vals[i] !== '') ? vals[i] : '—';
				if (n.indexOf('子载波') === 0 && reg.test(v))
					v = scsNames[num(v)] || v;
				rows.push([n, v]);
			});
			/* humanize hex identifiers */
			rows.forEach(function(r) {
				if (/[A-Fa-f]/.test(String(r[1])) && /^[0-9A-Fa-f]+$/.test(String(r[1])))
					r[1] = '%s (0x%s)'.format(parseInt(r[1], 16), r[1]);
			});
		}

		if (!rows.length) {
			C.celltable.replaceChildren(E('p', { 'class': 'nr-md-note' }, '暂无驻留小区详细参数。'));
			return;
		}

		var half = Math.ceil(rows.length / 2);
		C.celltable.replaceChildren(E('div', { 'class': 'nr-md-grid2' }, [
			this.kvBlock(rows.slice(0, half)),
			this.kvBlock(rows.slice(half))
		]));
	},

	updateSimQosTab: function(st, switching, stale, absent) {
		var C = this.cells;

		if (switching || stale || absent) {
			C.qci.textContent = '检测中…';
			C.qcitable.replaceChildren(E('p', { 'class': 'nr-md-note' }, '等待网络协商参数…'));
			C.ambrdl.textContent = '—';
			C.ambrul.textContent = '—';
			C.apnsub.textContent = '—';
			C.pdp4.textContent = '—';
			C.pdp6.textContent = '—';
			C.cids.textContent = '—';
			C.ndis.textContent = '—';
			C.syscfg.textContent = '—';
			C.nwtime.textContent = '—';
			return;
		}

		var q = num(st.qos && st.qos.qci);
		if (q === null) {
			C.qci.textContent = '未上报';
			C.qcitable.replaceChildren(E('p', { 'class': 'nr-md-note' }, '网络暂未下发 QCI / 5QI 承载等级参数。'));
		}
		else {
			var info = qciTable[q];
			C.qci.textContent = 'QCI/5QI %d%s'.format(q, info ? (' · ' + info[0]) : '');
			var rows = [
				['QCI / 5QI', E('span', { 'class': 'nr-md-mono' }, '%d'.format(q))],
				['资源类别', info ? info[0] : '运营商专用'],
				['典型业务', info ? info[1] : '—'],
				['包时延预算', E('span', { 'class': 'nr-md-mono' }, info ? info[2] : '—')],
				['丢包率上限', E('span', { 'class': 'nr-md-mono' }, info ? info[3] : '—')]
			];
			if (!info)
				rows.push(['保证比特率', '未知（运营商专用特性）']);
			else if (info[0] == 'non-GBR')
				rows.push(['保证比特率', '不保证（non-GBR，按网络 AMBR 调度）']);
			else
				rows.push(['保证比特率', 'GBR 承载（速率由网络分配）']);
			C.qcitable.replaceChildren(this.kvBlock(rows));
		}

		C.ambrdl.textContent = (st.qos && st.qos.dl_ambr_kbps) ? fmtKbps(st.qos.dl_ambr_kbps) : '—（未上报）';
		C.ambrul.textContent = (st.qos && st.qos.ul_ambr_kbps) ? fmtKbps(st.qos.ul_ambr_kbps) : '—（未上报）';
		C.apnsub.textContent = (st.qos && st.qos.apn) || '—';

		C.pdp4.textContent = (st.pdp && st.pdp.addr4) || '—';
		var v6 = (st.pdp && st.pdp.addr6) || '';
		if (v6) {
			/* modem reports IPv6 in IA5 dotted form: "36.8.137..." -> hex groups */
			var hex = v6.split('.').map(function(x) { return ('0' + parseInt(x, 10).toString(16)).slice(-2); }).join('');
			var groups = [];
			for (var i = 0; i < hex.length; i += 4) groups.push(hex.slice(i, i + 4));
			C.pdp6.textContent = groups.join(':') || v6;
		}
		else {
			C.pdp6.textContent = '—';
		}
		C.cids.textContent = (st.pdp && st.pdp.active_cids) ? 'CID %s'.format(st.pdp.active_cids) : '—';
		C.ndis.replaceChildren(
			E('span', { 'class': (st.pdp && st.pdp.addr4) ? 'nr-md-pill ok' : 'nr-md-pill muted', 'style': 'margin-right:.35rem;' },
				(st.pdp && st.pdp.addr4) ? 'IPv4 ✓' : 'IPv4 ✗'),
			E('span', { 'class': (st.pdp && st.pdp.addr6) ? 'nr-md-pill ok' : 'nr-md-pill muted' },
				(st.pdp && st.pdp.addr6) ? 'IPv6 ✓' : 'IPv6 ✗')
		);
		var mode = { '080302': '自动（5G 优先）', '08': '仅 5G NR', '03': '仅 LTE', '0302': '仅 LTE/3G' };
		C.syscfg.textContent = mode[st.syscfg] || st.syscfg || '—';
		C.nwtime.textContent = st.nwtime || '—（网络未下发时间）';
	},

	updateTrafficTab: function(st) {
		var C = this.cells, tr = st.traffic || {};
		var sessRx = (tr.sess_rx !== undefined) ? tr.sess_rx : tr.live_rx,
		    sessTx = (tr.sess_tx !== undefined) ? tr.sess_tx : tr.live_tx,
		    dayRx = num(tr.day_rx) || 0, dayTx = num(tr.day_tx) || 0,
		    monRx = num(tr.mon_rx) || 0, monTx = num(tr.mon_tx) || 0,
		    totRx = Number(tr.tot_rx) || 0, totTx = Number(tr.tot_tx) || 0;

		function fillRow(rowEl, label, rxB, txB, totB) {
			rowEl.replaceChildren(
				E('td', { 'style': 'font-weight:600;' }, label),
				E('td', { 'class': 'nr-md-mono', 'style': 'color:var(--nr-ok);' }, fmtBytes(rxB)),
				E('td', { 'class': 'nr-md-mono', 'style': 'color:var(--nr-primary);' }, fmtBytes(txB)),
				E('td', { 'class': 'nr-md-mono', 'style': 'font-weight:600;' }, fmtBytes(totB))
			);
		}

		fillRow(C.sess, '本次连接（%s）'.format(fmtUptime(tr.uptime)), sessRx, sessTx, (Number(sessRx) || 0) + (Number(sessTx) || 0));
		fillRow(C.day, '今日统计', dayRx, dayTx, dayRx + dayTx);
		fillRow(C.mon, '本月账期', monRx, monTx, monRx + monTx);
		fillRow(C.tot, '历史累计', totRx, totTx, totRx + totTx);

		/* quota / billing-period display */
		var limit = num(tr.limit_mb),
		    resetDay = num(tr.reset_day) || 1,
		    monUsed = monRx + monTx;
		this.quotaResetPill.textContent = '每月 %d 日重置'.format(resetDay);
		this.quotaPolicyPill.textContent = (tr.action == 'offline') ? '策略：超限断开蜂窝' : '策略：超限仅提醒';
		this.quotaPolicyPill.className = (tr.action == 'offline') ? 'nr-md-pill warn' : 'nr-md-pill muted';

		if (limit !== null && limit > 0) {
			var limitB = limit * 1048576,
			    pct = Math.min(999, Math.round(monUsed / limitB * 100)),
			    over = (num(tr.over_limit) === 1),
			    color = over ? '#d9534f' : (pct >= 80 ? '#f0ad4e' : '#2eb872'),
			    remainB = Math.max(0, limitB - monUsed);
			this.quotaFill.style.width = Math.min(100, pct) + '%';
			this.quotaFill.style.background = color;
			var qText = '已用 %s / %s（%d%%）'.format(fmtBytes(monUsed), fmtBytes(limitB), pct);
			var rText = over
				? ((tr.action == 'offline') ? '⚠ 已超限，蜂窝已断开' : '⚠ 已超限（提醒模式）')
				: '剩余可用 %s'.format(fmtBytes(remainB));
			C.quota.replaceChildren(
				E('span', { 'style': 'font-weight:600;' }, qText),
				E('span', { 'style': over ? 'color:var(--nr-err);font-weight:600;' : 'color:var(--nr-muted);' }, rText)
			);
			C.quota.title = 'billing period ' + (tr.period_key || '');
		}
		else {
			C.quota.replaceChildren(
				E('span', { 'style': 'color:var(--nr-muted);' }, '未设置月度限额（可在「设置 → 流量限额」中配置配额与重置日）'),
				E('span', { 'class': 'nr-md-mono' }, '本月已用 %s'.format(fmtBytes(monUsed)))
			);
			this.quotaFill.style.width = '0%';
		}

		/* client-side rate from consecutive live counter samples */
		var now = Date.now();
		if (this.lastTraffic && tr.live_rx !== undefined) {
			var dt = (now - this.lastTraffic.t) / 1000;
			if (dt > 0.5) {
				var rx = Math.max(0, Number(tr.live_rx) - this.lastTraffic.rx) / dt;
				var tx = Math.max(0, Number(tr.live_tx) - this.lastTraffic.tx) / dt;
				this.rateRx.push(rx); if (this.rateRx.length > 36) this.rateRx.shift();
				this.rateTx.push(tx); if (this.rateTx.length > 36) this.rateTx.shift();
				C.raterx.textContent = '↓ %s'.format(fmtRate(rx));
				C.ratetx.textContent = '↑ %s'.format(fmtRate(tx));
				sparkline(this.canvasRx, this.rateRx, 1024 * 200);
				sparkline(this.canvasTx, this.rateTx, 1024 * 50);
			}
		}
		this.lastTraffic = { t: now, rx: Number(tr.live_rx) || 0, tx: Number(tr.live_tx) || 0 };
	},

	handleTrafficReset: function(scope) {
		ui.showModal('清零流量统计', [
			E('p', {}, scope == 'day' ? '确认将「今日」流量统计清零？' : scope == 'month' ? '确认将「本月」（含今日）流量统计清零？' : '确认将全部流量统计清零？'),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, '取消'), ' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-negative',
					'click': ui.createHandlerFn(this, function() {
						uci.set('mt5700', 'modem', 'traffic_reset', scope);
						return uci.save().then(function() {
							return uci.apply();
						}).then(ui.hideModal);
					})
				}, '确认清零')
			])
		]);
	},

	applyStatus: function(res) {
		try {
			if (res.error || res.code !== 0) throw new Error(res.error || res.stderr || '状态查询失败');
			var st = JSON.parse(res.stdout);
			if (!st.sim || !st.signal || !st.reg || !st.wwan) throw new Error('状态数据不完整');
			this.updateStatus(st);
		}
		catch (e) {
			// Never leave a previous "connected" verdict after a failed poll.
			this.lastSnapshot = null;
			this.resetKpisOnFailure();
			var cells = this.cells;
			Object.keys(cells).forEach(function(key) {
				if (cells[key].tagName === 'TR') {
					cells[key].replaceChildren(
						E('td', {}, '—'), E('td', {}, '—'), E('td', {}, '—'), E('td', {}, '—')
					);
				}
				else {
					cells[key].textContent = '—';
				}
			});
			this.lastTraffic = null;
			this.rateRx = [];
			this.rateTx = [];
			sparkline(this.canvasRx, []);
			sparkline(this.canvasTx, []);
			this.quotaFill.style.width = '0%';
			cells.meta.textContent = '暂时无法读取状态，将自动重试：' + e.message;
		}
	},

	refreshStatus: function() {
		if (this.refreshing) return this.refreshing;
		this.refreshing = fs.exec('/usr/sbin/mt5700-status').then(L.bind(this.applyStatus, this))
			.catch(L.bind(function(e) { this.applyStatus({ error: e.message }); }, this))
			.finally(L.bind(function() { this.refreshing = null; }, this));
		return this.refreshing;
	},

	render: function(first) {
		ensureStyle();
		this.cells = {};
		var self = this;

		['modem', 'sim', 'imsi', 'reg', 'sig', 'wwan', 'temp', 'meta', 'imei', 'uptime',
		 'cellrat', 'qci', 'pdp4', 'pdp6', 'cids', 'ndis', 'syscfg', 'nwtime',
		 'raterx', 'ratetx', 'ambrdl', 'ambrul', 'apnsub'].forEach(function(k) {
			self.cells[k] = E('span', { 'id': 'mt5700_' + k }, '…');
		});
		['celltable', 'qcitable'].forEach(function(k) {
			self.cells[k] = E('div', { 'id': 'mt5700_' + k }, '…');
		});
		self.cells.quota = E('div', { 'id': 'mt5700_quota', 'style': 'display:flex;flex-wrap:wrap;justify-content:space-between;gap:.5rem;font-size:.84rem;' }, '…');
		['sess', 'day', 'mon', 'tot'].forEach(function(k) {
			self.cells[k] = E('tr', { 'id': 'mt5700_' + k }, [
				E('td', {}, '…'), E('td', {}, '…'), E('td', {}, '…'), E('td', {}, '…')
			]);
		});

		var C = this.cells;
		C.raterx.textContent = '↓ 0 B/s';
		C.ratetx.textContent = '↑ 0 B/s';

		this.alertBanner = E('div', { 'class': 'nr-md-banner', 'style': 'display:none;' });

		/* Top 4 KPI summary cards */
		this.kpi = {
			netPill: E('span', { 'class': 'nr-md-pill muted' }, '…'),
			netVal: E('div', { 'class': 'nr-md-kpi-val' }, '…'),
			netSub: E('div', { 'class': 'nr-md-kpi-sub' }, '…'),
			bandPill: E('span', { 'class': 'nr-md-pill muted' }, '…'),
			sigVal: E('div', { 'class': 'nr-md-kpi-val' }, '…'),
			sigSub: E('div', { 'class': 'nr-md-kpi-sub' }, '…'),
			usbPill: E('span', { 'class': 'nr-md-pill muted' }, '…'),
			simVal: E('div', { 'class': 'nr-md-kpi-val' }, '…'),
			simSub: E('div', { 'class': 'nr-md-kpi-sub' }, '…'),
			tempPill: E('span', { 'class': 'nr-md-pill muted' }, '…'),
			tempSub: E('div', { 'class': 'nr-md-kpi-sub' }, '…')
		};
		var K = this.kpi;
		var kpiGrid = E('div', { 'class': 'nr-md-kpis' }, [
			E('div', { 'class': 'nr-md-kpi' }, [
				E('div', { 'class': 'nr-md-kpi-top' }, [ E('span', {}, '驻留网络'), K.netPill ]),
				K.netVal,
				K.netSub
			]),
			E('div', { 'class': 'nr-md-kpi' }, [
				E('div', { 'class': 'nr-md-kpi-top' }, [ E('span', {}, '射频信号'), K.bandPill ]),
				K.sigVal,
				K.sigSub
			]),
			E('div', { 'class': 'nr-md-kpi' }, [
				E('div', { 'class': 'nr-md-kpi-top' }, [ E('span', {}, 'SIM 与总线'), K.usbPill ]),
				K.simVal,
				K.simSub
			]),
			E('div', { 'class': 'nr-md-kpi' }, [
				E('div', { 'class': 'nr-md-kpi-top' }, [ E('span', {}, '芯片温度'), K.tempPill ]),
				E('div', { 'class': 'nr-md-kpi-val nr-md-mono' }, [ C.temp ]),
				K.tempSub
			])
		]);

		this.canvasRx = E('canvas', { 'width': 360, 'height': 64, 'data-color': '#2eb872', 'style': 'width:100%;height:64px;display:block;' });
		this.canvasTx = E('canvas', { 'width': 360, 'height': 64, 'data-color': '#4a90d9', 'style': 'width:100%;height:64px;display:block;' });
		this.quotaFill = E('div', { 'style': 'height:100%;width:0;background:#2eb872;transition:width .4s,background .4s;border-radius:999px;' });

		var tabs = this.buildTabs();
		var B = tabs.bodies;

		/* --- Tab 1: Overview --- */
		var maskBtn = E('button', {
			'type': 'button',
			'class': 'nr-md-linkbtn',
			'click': function() {
				self.maskIds = !self.maskIds;
				maskBtn.textContent = self.maskIds ? '显示完整标识' : '隐藏敏感标识';
				if (self.lastSnapshot) {
					var st = self.lastSnapshot;
					var hide = !st.present || st.enabled === '0' || st.sim.phase === 'absent' || st.sim.transition === 1 || st.source === 'none';
					self.renderIdentityFields(st, hide);
				}
			}
		}, '显示完整标识');

		B.overview.appendChild(E('div', { 'class': 'nr-md-grid2' }, [
			E('div', { 'class': 'nr-md-card' }, [
				E('div', { 'class': 'nr-md-card-head' }, [
					E('h3', { 'class': 'nr-md-card-title' }, '蜂窝拨号与网络注册')
				]),
				this.kvBlock([
					['蜂窝连接 (wwan)', C.wwan],
					['运营商 / 注册', C.reg],
					['信号质量', C.sig],
					['连接时长', C.uptime]
				])
			]),
			E('div', { 'class': 'nr-md-card' }, [
				E('div', { 'class': 'nr-md-card-head' }, [
					E('h3', { 'class': 'nr-md-card-title' }, '硬件链路与设备标识'),
					maskBtn
				]),
				this.kvBlock([
					['模组状态', C.modem],
					['SIM 卡槽', C.sim],
					['IMSI / ICCID', C.imsi],
					['模组 IMEI', C.imei]
				])
			])
		]));

		/* --- Tab 2: Cell & Signal --- */
		this.rfGaugesBox = E('div', { 'class': 'nr-md-grid3' });
		this.rfGaugesCard = E('div', { 'class': 'nr-md-card', 'style': 'margin-bottom:1rem;' }, [
			E('div', { 'class': 'nr-md-card-head' }, [
				E('h3', { 'class': 'nr-md-card-title' }, '空口信号指标（AT^HCSQ）'),
				E('span', { 'class': 'nr-md-pill primary nr-md-mono' }, [ C.cellrat ])
			]),
			this.rfGaugesBox
		]);
		B.cell.appendChild(this.rfGaugesCard);
		B.cell.appendChild(E('div', { 'class': 'nr-md-card' }, [
			E('div', { 'class': 'nr-md-card-head' }, [
				E('h3', { 'class': 'nr-md-card-title' }, '驻留小区参数（AT^MONSC）'),
				E('span', { 'style': 'font-size:.78rem;color:var(--nr-muted);' }, 'NR 频点为 SSB ARFCN')
			]),
			C.celltable,
			E('p', { 'class': 'nr-md-note' }, '频段由 3GPP 频点号区间自动推算，十六进制小区/跟踪区标识已自动换算十进制，随守护进程巡检刷新。')
		]));

		/* --- Tab 3: SIM & QoS --- */
		B.simqos.appendChild(E('div', { 'class': 'nr-md-grid3', 'style': 'margin-bottom:1rem;' }, [
			E('div', { 'class': 'nr-md-kpi' }, [
				E('div', { 'class': 'nr-md-kpi-top' }, '签约下行速率 (DL-AMBR)'),
				E('div', { 'class': 'nr-md-kpi-val nr-md-mono', 'style': 'color:var(--nr-ok);' }, [ C.ambrdl ])
			]),
			E('div', { 'class': 'nr-md-kpi' }, [
				E('div', { 'class': 'nr-md-kpi-top' }, '签约上行速率 (UL-AMBR)'),
				E('div', { 'class': 'nr-md-kpi-val nr-md-mono', 'style': 'color:var(--nr-primary);' }, [ C.ambrul ])
			]),
			E('div', { 'class': 'nr-md-kpi' }, [
				E('div', { 'class': 'nr-md-kpi-top' }, '网络协商等级 (QoS)'),
				E('div', { 'class': 'nr-md-kpi-val' }, [ C.qci ])
			])
		]));
		B.simqos.appendChild(E('div', { 'class': 'nr-md-grid2' }, [
			E('div', { 'class': 'nr-md-card' }, [
				E('div', { 'class': 'nr-md-card-head' }, [
					E('h3', { 'class': 'nr-md-card-title' }, 'PDP 承载与双栈协议')
				]),
				this.kvBlock([
					['签约 APN', E('span', { 'class': 'nr-md-mono' }, [ C.apnsub ])],
					['PDP IPv4', E('span', { 'class': 'nr-md-mono' }, [ C.pdp4 ])],
					['PDP IPv6', E('span', { 'class': 'nr-md-mono' }, [ C.pdp6 ])],
					['已激活承载', E('span', { 'class': 'nr-md-mono' }, [ C.cids ])],
					['NDIS 双栈', C.ndis],
					['当前网络模式', C.syscfg],
					['网络时间', E('span', { 'class': 'nr-md-mono' }, [ C.nwtime ])]
				])
			]),
			E('div', { 'class': 'nr-md-card' }, [
				E('div', { 'class': 'nr-md-card-head' }, [
					E('h3', { 'class': 'nr-md-card-title' }, '3GPP QoS 承载特性')
				]),
				C.qcitable,
				E('p', { 'class': 'nr-md-note' }, '签约速率（APN-AMBR）由 AT^DSAMBR 读取运营商套餐签约值，实际速率受空口信号与基站调度影响；QCI/5QI 由 AT+CGEQOSRDP 读取。')
			])
		]));

		/* --- Tab 4: Traffic --- */
		this.quotaResetPill = E('span', { 'class': 'nr-md-pill muted' }, '每月 1 日重置');
		this.quotaPolicyPill = E('span', { 'class': 'nr-md-pill muted' }, '策略：超限仅提醒');
		B.traffic.appendChild(E('div', { 'class': 'nr-md-card', 'style': 'margin-bottom:1rem;' }, [
			E('div', { 'class': 'nr-md-card-head', 'style': 'border-bottom:none;padding-bottom:0;margin-bottom:0;' }, [
				E('div', { 'style': 'display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;' }, [
					E('h3', { 'class': 'nr-md-card-title' }, '本月账期流量配额'),
					this.quotaResetPill
				]),
				this.quotaPolicyPill
			]),
			E('div', { 'class': 'nr-md-quota-bar' }, [ this.quotaFill ]),
			C.quota
		]));

		B.traffic.appendChild(E('div', { 'class': 'nr-md-grid2', 'style': 'margin-bottom:1rem;' }, [
			E('div', { 'class': 'nr-md-card' }, [
				E('div', { 'class': 'nr-md-card-head' }, [
					E('span', { 'style': 'font-size:.85rem;color:var(--nr-muted);font-weight:600;' }, '实时下行速率 (RX)'),
					E('strong', { 'class': 'nr-md-mono', 'style': 'color:var(--nr-ok);font-size:.95rem;' }, [ C.raterx ])
				]),
				this.canvasRx
			]),
			E('div', { 'class': 'nr-md-card' }, [
				E('div', { 'class': 'nr-md-card-head' }, [
					E('span', { 'style': 'font-size:.85rem;color:var(--nr-muted);font-weight:600;' }, '实时上行速率 (TX)'),
					E('strong', { 'class': 'nr-md-mono', 'style': 'color:var(--nr-primary);font-size:.95rem;' }, [ C.ratetx ])
				]),
				this.canvasTx
			])
		]));

		B.traffic.appendChild(E('div', { 'class': 'nr-md-card' }, [
			E('div', { 'class': 'nr-md-card-head' }, [
				E('h3', { 'class': 'nr-md-card-title' }, '分周期累计账单'),
				E('div', { 'style': 'display:flex;gap:.4rem;flex-wrap:wrap;' }, [
					E('button', { 'class': 'cbi-button', 'style': 'padding:3px 10px;', 'click': ui.createHandlerFn(this, 'handleTrafficReset', 'day') }, '清零今日'),
					E('button', { 'class': 'cbi-button', 'style': 'padding:3px 10px;', 'click': ui.createHandlerFn(this, 'handleTrafficReset', 'month') }, '清零本月'),
					E('button', { 'class': 'cbi-button cbi-button-negative', 'style': 'padding:3px 10px;', 'click': ui.createHandlerFn(this, 'handleTrafficReset', 'all') }, '全部清零')
				])
			]),
			E('div', { 'style': 'overflow-x:auto;' }, [
				E('table', { 'class': 'nr-md-table' }, [
					E('thead', {}, [
						E('tr', {}, [
							E('th', {}, '统计周期'),
							E('th', {}, '下行流量 ↓'),
							E('th', {}, '上行流量 ↑'),
							E('th', {}, '合计')
						])
					]),
					E('tbody', {}, [ C.sess, C.day, C.mon, C.tot ])
				])
			]),
			E('p', { 'class': 'nr-md-note' }, '统计由 mt5700 守护进程每巡检周期从模组网卡计数器累计并持久化（重启不丢失），速率曲线在本页打开期间实时采样。')
		]));

		/* --- Tab 5: Settings form --- */
		var m = new form.Map('mt5700', null,
			'点击「保存并应用」后，后台将在下一个检查周期开始处理（默认 30 秒，检测或注册可能需要更长时间）。切换 SIM 卡、修改 APN 或网络模式会短暂中断蜂窝连接，可在总览查看进度。');
		var s = m.section(form.NamedSection, 'modem', 'mt5700', '蜂窝设置');
		s.tab('general', '常用设置');
		s.tab('quota', '流量限额');
		s.tab('advanced', '高级设置');

		var o = s.taboption('general', form.Flag, 'enabled', '启用 5G 蜂窝', '关闭后将切断模组供电并停止自动拨号。');
		o.rmempty = false;
		o.default = '1';

		o = s.taboption('general', form.ListValue, 'sim_slot', 'SIM 卡槽', '「自动检测」按 外置 SIM1 → 外置 SIM2 → 内置 eSIM 顺序探测可用 SIM 卡。');
		o.value('auto', slotNames.auto);
		o.value('sim1', slotNames.sim1);
		o.value('sim2', slotNames.sim2);
		o.value('esim', slotNames.esim);
		o.default = 'auto';

		o = s.taboption('general', form.Value, 'apn', 'APN', '留空则按 IMSI 自动识别运营商并配置（移动 cmnet / 联通 3gnet / 电信 ctnet / 广电 cbnet）。');
		o.placeholder = '自动（按运营商识别）';
		o.datatype = 'maxlength(64)';
		o.validate = function(section, value) {
			return !value || /^[a-zA-Z0-9.-]+$/.test(value) || 'APN 只能包含字母、数字、点和连字符';
		};

		o = s.taboption('general', form.ListValue, 'netmode', '网络模式', '仅 5G / 仅 4G 通过 AT^SYSCFGEX 锁定制式，切换会触发网络重选。');
		o.value('auto', '自动（5G 优先）');
		o.value('nr', '仅 5G NR');
		o.value('lte', '仅 LTE');
		o.default = 'auto';
		o.rmempty = false;

		o = s.taboption('quota', form.Value, 'traffic_limit_mb', '月度限额（MB）', '留空或 0 表示不限。按下方「重置日」划分的账期统计（下行+上行合计）。');
		o.placeholder = '不限';
		o.datatype = 'and(uinteger,min(0))';

		o = s.taboption('quota', form.Value, 'traffic_reset_day', '账期重置日（几号）', '每月第几号结转流量账目（1–31；短月自动按月末处理），默认 1 号。');
		o.placeholder = '1';
		o.default = '1';
		o.rmempty = false;
		o.datatype = 'and(uinteger,min(1),max(31))';

		o = s.taboption('quota', form.ListValue, 'traffic_action', '超限动作', '「断开蜂窝」会在超限后断开并停止拨号，直到下个账期或调高/取消限额；「仅提醒」只在页面标红提示。');
		o.value('notify', '仅提醒（页面标红）');
		o.value('offline', '断开蜂窝（直至下个账期）');
		o.default = 'notify';
		o.rmempty = false;

		o = s.taboption('advanced', form.Flag, 'usb3_retrain', 'USB 3.0 自动重训练', '模组以 USB 2.0（480 Mbps）枚举时自动热重启并重训练至 USB 3.0（5000 Mbps）。');
		o.rmempty = false;
		o.default = '1';

		o = s.taboption('advanced', form.Flag, 'fix_nvram', '模组 NVRAM 自愈', '自动修复其他系统残留的异常配置（SETMODE / TDCFG 网卡模式、C5GOPTION 5G SA 锁死）。');
		o.rmempty = false;
		o.default = '1';

		o = s.taboption('advanced', form.Flag, 'thermal_guard', '模组高温联动散热', '按 AT^CHIPTEMP 模组内部温度联动风扇加速（≥72 °C 起步），先于 97 °C 保护性断网。');
		o.rmempty = false;
		o.default = '1';

		o = s.taboption('advanced', form.Value, 'check_interval', '检查间隔（秒）', '守护进程巡检 SIM / 注册 / 拨号 / 流量统计的周期。');
		o.placeholder = '30';
		o.datatype = 'range(10, 600)';
		o.rmempty = false;

		var refreshBtn = E('button', {
			'class': 'cbi-button',
			'click': ui.createHandlerFn(this, 'refreshStatus')
		}, '刷新状态');

		var container = E('div', { 'class': 'nr-md' }, [
			E('div', { 'class': 'nr-md-head' }, [
				E('h2', {}, '5G 蜂窝（MT5700M-CN）'),
				E('div', { 'class': 'nr-md-head-right' }, [ C.meta, refreshBtn ])
			]),
			this.alertBanner,
			kpiGrid,
			tabs.bar,
			B.overview, B.cell, B.simqos, B.traffic
		]);

		this.applyStatus(first);
		poll.add(L.bind(function() {
			if (document.hidden) return Promise.resolve();
			return this.refreshStatus();
		}, this), 10);

		return m.render().then(function(formNode) {
			B.settings.appendChild(E('div', { 'class': 'nr-md-card' }, [ formNode ]));
			container.appendChild(B.settings);
			return container;
		});
	}
});
