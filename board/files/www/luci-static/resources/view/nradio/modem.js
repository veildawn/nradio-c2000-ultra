'use strict';
'require view';
'require form';
'require poll';
'require fs';
'require uci';
'require ui';

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

function renderSignalWidget(st) {
	var q = signalBars(st),
	    color = (q.bars >= 4) ? '#2eb872' : (q.bars == 3) ? '#f0ad4e' : '#d9534f',
	    widget = E('span', { 'style': 'display:inline-flex;align-items:flex-end;gap:2px;height:18px;margin-right:8px;vertical-align:middle;' });

	for (var i = 1; i <= 5; i++)
		widget.appendChild(E('span', {
			'style': 'width:4px;height:%dpx;border-radius:1px;background:%s;'.format(3 + i * 3, (i <= q.bars) ? color : 'rgba(128,128,128,.25)')
		}));

	return E('span', {}, [
		widget,
		(q.bars > 0) ? sysmodeNames[st.signal.sysmode] || st.signal.sysmode : '无信号',
		(q.metric !== '') ? '（%s）'.format(q.metric) : ''
	]);
}

function sparkline(canvas, data, maxHint) {
	var ctx = canvas.getContext('2d');
	var w = canvas.width, h = canvas.height;
	ctx.clearRect(0, 0, w, h);
	if (data.length < 2) return;
	var max = Math.max.apply(null, data.concat([maxHint || 1]));
	ctx.beginPath();
	for (var i = 0; i < data.length; i++) {
		var x = i / (data.length - 1) * (w - 4) + 2;
		var y = h - 3 - data[i] / max * (h - 8);
		if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
	}
	ctx.strokeStyle = canvas.dataset.color;
	ctx.lineWidth = 1.5;
	ctx.stroke();
}

return view.extend({
	/* Prefetch one snapshot for the very first paint; failures just fall
	 * back to the immediate first poll tick. */
	load: function() {
		return fs.exec('/usr/sbin/mt5700-status').then(function(res) {
			try { return JSON.parse(res.stdout || '{}'); }
			catch (e) { return null; }
		}).catch(function() { return null; });
	},

	rateRx: [],
	rateTx: [],
	lastTraffic: null,
	cells: {},

	cell: function(id) {
		if (!this.cells[id])
			this.cells[id] = E('em', { 'id': id }, '…');
		return this.cells[id];
	},

	/* ------------------------- tab skeleton ------------------------- */

	buildTabs: function() {
		var titles = [
			['overview', '总览'],
			['cell', '小区与信号'],
			['simqos', 'SIM 与 QoS'],
			['traffic', '流量统计'],
			['settings', '设置']
		];
		var self = this;
		var bar = E('ul', { 'class': 'cbi-tabmenu', 'style': 'display:flex;flex-wrap:wrap;gap:0;list-style:none;padding:0;margin:1em 0 0;border-bottom:2px solid rgba(128,128,128,.3);' });
		var bodies = {};

		titles.forEach(function(t, i) {
			var li = E('li', {
				'class': 'cbi-tab' + (i === 0 ? ' active' : ''),
				'style': 'padding:6px 16px;cursor:pointer;border:2px solid transparent;border-bottom:none;margin-bottom:-2px;border-radius:6px 6px 0 0;' + (i === 0 ? 'background:var(--background-color,#fff);font-weight:bold;' : 'opacity:.7;'),
				'click': function(ev) {
					bar.querySelectorAll('li').forEach(function(el) {
						el.classList.remove('active');
						el.style.background = '';
						el.style.fontWeight = '';
						el.style.opacity = '.7';
					});
					ev.target.closest('li').classList.add('active');
					ev.target.closest('li').style.background = 'var(--background-color,#fff)';
					ev.target.closest('li').style.fontWeight = 'bold';
					ev.target.closest('li').style.opacity = '1';
					Object.keys(bodies).forEach(function(k) { bodies[k].style.display = 'none'; });
					bodies[t[0]].style.display = '';
				}
			}, t[1]);
			bar.appendChild(li);
			bodies[t[0]] = E('div', { 'style': (i === 0 ? '' : 'display:none;') });
		});

		this.tabBodies = bodies;
		return { bar: bar, bodies: bodies };
	},

	tableFromRows: function(rows) {
		var t = E('table', { 'class': 'table' });
		rows.forEach(function(r) {
			t.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '32%' }, r[0]),
				E('td', { 'class': 'td left' }, [ r[1] ])
			]));
		});
		return t;
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
		var interval = num(st.check_interval) || 30,
		    staleAfter = Math.max(60, interval * 2),
		    age = num(st.stamp_age),
		    stale = (age !== null && age > staleAfter),
		    noData = (st.source === 'none'),
		    phase = st.sim.phase || '',
		    switching = (st.sim.transition === 1 || noData || phase == 'switching'),
		    absent = (phase == 'absent');
		var C = this.cells;

		C.modem.textContent = (!st.present)
			? '未检测到模组（USB 3466:3301 不在线）'
			: 'MT5700M-CN 在线 ｜ USB %s Mbps ｜ AT 口 %s ｜ 网卡 %s'.format(
				st.usb_speed || '?', st.at_port || '—', st.netdev || '—');

		var slot = (st.sim.slot) ? (slotNames[st.sim.slot] || st.sim.slot) : '—';
		var cfgslot = (st.sim.configured_slot)
			? (slotNames[st.sim.configured_slot] || st.sim.configured_slot) : '—';

		if (!st.present) {
			C.sim.textContent = '—';
			C.imsi.textContent = '—';
			C.reg.textContent = '—';
			C.sig.replaceChildren(E('span', {}, '—'));
			C.temp.textContent = '—';
		}
		else {
			if (switching || stale)
				C.sim.textContent = '正在检测 SIM 卡… ｜ 卡槽：%s（配置：%s）'.format(slot, cfgslot);
			else if (absent)
				C.sim.textContent = '未检测到 SIM 卡 ｜ 当前卡槽：%s'.format(slot);
			else {
				var simTxt = '%s ｜ 卡槽：%s'.format(st.sim.state_cn || st.sim.state || '未知', slot);
				if (st.sim.configured_slot != st.sim.slot && st.sim.configured_slot != 'auto')
					simTxt += '（已配置 %s，守护进程将在 %d 秒内切换）'.format(cfgslot, interval);
				else if (st.sim.configured_slot == 'auto')
					simTxt += '（配置：自动检测）';
				C.sim.textContent = simTxt;
			}
			C.sim.title = 'SCICHG=%s，cpe-sel0=%s'.format(st.sim.scichg || '—', st.sim.slot_gpio || '—');

			C.imsi.textContent = (absent || switching || stale)
				? '—' : '%s / %s'.format(st.sim.imsi || '—', st.sim.iccid || '—');

			if (switching || stale)
				C.reg.textContent = '检测中…';
			else if (absent)
				C.reg.textContent = '未注册（无 SIM 卡）';
			else {
				var reg = [];
				if (st.reg.operator)
					reg.push('%s（%s）'.format(st.reg.operator, st.reg.operator_act || st.reg.cereg_act || ''));
				if (st.sim.carrier)
					reg.push('IMSI 识别：%s'.format(st.sim.carrier));
				reg.push('CEREG：%s'.format(st.reg.cereg_state || '未知'));
				if (st.reg.c5greg_stat)
					reg.push('C5GREG：%s'.format(st.reg.c5greg_state || '未知'));
				if (st.cfun === '0')
					reg.push('⚠️ 模组射频已关闭（CFUN=0）');
				C.reg.textContent = reg.join(' ｜ ');
			}

			if (switching || stale || !st.signal.sysmode)
				C.sig.replaceChildren(E('span', {}, '检测中…'));
			else if (absent)
				C.sig.replaceChildren(E('span', {}, '无服务'));
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
				C.sig.appendChild(E('div', { 'style': 'font-size:small;color:#888;' }, parts.join(' ｜ ') || '—'));
			}

			var t = num(st.temp_dc);
			C.temp.textContent = (t !== null) ? '%.1f °C'.format(t / 10) : '—';
		}

		var wwan = [];
		if (st.wwan.pending)
			wwan.push('正在拨号…');
		if (st.wwan.up && (st.wwan.ip4 || st.wwan.ip6)) {
			wwan.push('已连接');
			if (st.wwan.ip4) wwan.push('IPv4：%s'.format(st.wwan.ip4));
			if (st.wwan.ip6) wwan.push('IPv6：%s'.format(st.wwan.ip6));
			if (num(st.carrier_link) === 0)
				wwan.push('（模组网络链路已断开，等待重建）');
		}
		else if (st.wwan.up) {
			wwan.push('连接建立中（尚未获取 IP）');
		}
		else if (!st.wwan.pending) {
			wwan.push('未连接');
		}
		wwan.push('APN：%s'.format(st.apn || '自动'));
		C.wwan.textContent = wwan.join(' ｜ ');

		C.imei.textContent = st.imei || '—';
		C.uptime.textContent = fmtUptime(st.traffic.uptime);

		var meta = [];
		if (st.busy)
			meta.push('AT 通道忙（拨号/守护进程操作中）');
		if (stale)
			meta.push('模组数据已过期（%d 秒前），等待守护进程刷新'.format(age));
		meta.push('数据来源：%s（%d 秒前）'.format(st.source === 'none' ? '无' : st.source, age || 0));
		C.meta.textContent = meta.join('；');

		var self = this;
		['updateCellTab', 'updateSimQosTab', 'updateTrafficTab'].forEach(function(fn) {
			try { self[fn](st, switching, stale, absent); }
			catch (e) {
				self.cells.meta.textContent = '%s 更新异常：%s'.format(fn, e.message);
			}
		});
	},

	updateCellTab: function(st, switching, stale, absent) {
		var C = this.cells, raw = (st.cell && st.cell.raw) || '', rat = (st.cell && st.cell.rat) || '';

		if (switching || stale) {
			C.cellrat.textContent = '检测中…';
			C.celltable.replaceChildren();
			return;
		}
		C.cellrat.textContent = (rat && rat != 'NONE') ? rat : (absent ? '无 SIM 卡' : '未知');

		var names = cellFields[rat], rows = [];
		if (names && raw) {
			var vals = raw.split(',');
			var reg = new RegExp('^([0-9]+)$');
			names.forEach(function(n, i) {
				var v = (vals[i] !== undefined && vals[i] !== '') ? vals[i] : '—';
				if (n.indexOf('子载波') === 0 && reg.test(v))
					v = scsNames[num(v)] || v;
				rows.push([n, v]);
			});
			/* humanize hex identifiers */
			['小区标识', '物理小区标识', '跟踪区', '位置区'].forEach(function(key) {
				rows.forEach(function(r) {
					if (r[0].indexOf(key) >= 0 && /^[0-9A-Fa-f]+$/.test(String(r[1])))
						r[1] = '%s (0x%s)'.format(parseInt(r[1], 16), r[1]);
				});
			});
			rows.push(['PLMN', '%s-%s'.format(vals[0], vals[1])]);
		}
		C.celltable.replaceChildren(this.tableFromRows(rows));
	},

	updateSimQosTab: function(st, switching, stale, absent) {
		var C = this.cells;

		if (switching || stale || absent) {
			C.qci.textContent = '检测中…';
			C.qcitable.replaceChildren();
			C.ambrdl.textContent = '—';
			C.ambrul.textContent = '—';
			C.apnsub.textContent = '—';
			C.pdp4.textContent = '—';
			C.pdp6.textContent = '—';
			C.cids.textContent = '—';
			C.ndis.textContent = '—';
			C.syscfg.textContent = '—';
			C.nwtime.textContent = '—';
		}
		else {
			var q = num(st.qos && st.qos.qci);
			if (q === null) {
				C.qci.textContent = '未上报（网络未协商 QoS 参数）';
				C.qcitable.replaceChildren();
			}
			else {
				C.qci.textContent = 'QCI/5QI %d'.format(q);
				var info = qciTable[q];
				var rows = [
					['QCI / 5QI', '%d'.format(q)],
					['类别', info ? info[0] : '运营商专用'],
					['业务类型', info ? info[1] : '—'],
					['时延预算', info ? info[2] : '—'],
					['丢包率', info ? info[3] : '—']
				];
				if (!info)
					rows.push(['保证比特率', '未知（运营商专用 QCI/5QI，特性由运营商定义）']);
				else if (info[0] == 'non-GBR')
					rows.push(['保证比特率', '不保证（non-GBR，按网络 AMBR 调度）']);
				else
					rows.push(['保证比特率', 'GBR 承载（速率由网络分配）']);
				C.qcitable.replaceChildren(this.tableFromRows(rows));
			}
		}

		C.ambrdl.textContent = (st.qos && st.qos.dl_ambr_kbps) ? fmtKbps(st.qos.dl_ambr_kbps) : '—（模组未上报）';
		C.ambrul.textContent = (st.qos && st.qos.ul_ambr_kbps) ? fmtKbps(st.qos.ul_ambr_kbps) : '—（模组未上报）';
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
		var ndis = (st.pdp && st.pdp.ndis) || '';
		var nd = [];
		if (ndis.indexOf('IPV4') >= 0) nd.push('IPv4 ✓');
		if (ndis.indexOf('IPV6') >= 0) nd.push('IPv6 ✓');
		C.ndis.textContent = nd.length ? nd.join(' ｜ ') : '—';
		var mode = { '080302': '自动（5G 优先）', '08': '仅 5G NR', '03': '仅 LTE', '0302': '仅 LTE/3G' };
		C.syscfg.textContent = mode[st.syscfg] || st.syscfg || '—';
		C.nwtime.textContent = st.nwtime || '—（网络未下发时间）';
	},

	updateTrafficTab: function(st) {
		var C = this.cells, tr = st.traffic || {};

		C.sess.textContent = '下行 %s ｜ 上行 %s ｜ 已连接 %s'.format(
			fmtBytes(tr.sess_rx !== undefined ? tr.sess_rx : tr.live_rx),
			fmtBytes(tr.sess_tx !== undefined ? tr.sess_tx : tr.live_tx),
			fmtUptime(tr.uptime));
		C.day.textContent = '下行 %s ｜ 上行 %s ｜ 合计 %s'.format(
			fmtBytes(tr.day_rx), fmtBytes(tr.day_tx), fmtBytes(num(tr.day_rx) + num(tr.day_tx)));
		C.mon.textContent = '下行 %s ｜ 上行 %s ｜ 合计 %s'.format(
			fmtBytes(tr.mon_rx), fmtBytes(tr.mon_tx), fmtBytes(num(tr.mon_rx) + num(tr.mon_tx)));
		C.tot.textContent = '下行 %s ｜ 上行 %s ｜ 合计 %s'.format(
			fmtBytes(tr.tot_rx), fmtBytes(tr.tot_tx), fmtBytes(Number(tr.tot_rx) + Number(tr.tot_tx)));

		/* quota / billing-period display */
		var qWrap = this.quotaWrap;
		if (qWrap) {
			var limit = num(tr.limit_mb);
			var monUsed = (num(tr.mon_rx) + num(tr.mon_tx)) || 0;
			if (limit !== null && limit > 0) {
				var limitB = limit * 1048576,
				    pct = Math.min(999, Math.round(monUsed / limitB * 100)),
				    over = (num(tr.over_limit) === 1),
				    color = over ? '#d9534f' : (pct >= 80 ? '#f0ad4e' : '#2eb872');
				this.quotaFill.style.width = Math.min(100, pct) + '%';
				this.quotaFill.style.background = color;
				var qparts = [ '%s / %s（%d%%）'.format(fmtBytes(monUsed), fmtBytes(limitB), pct) ];
				if (over)
					qparts.push((tr.action == 'offline') ? '⚠ 已超限，蜂窝已按设置断开' : '⚠ 已超限（提醒模式）');
				C.quota.replaceChildren(
					E('span', {}, qparts.join('　')),
					over ? E('b', { 'style': 'color:#d9534f;margin-left:.4em;' }, '⚠') : ''
				);
				C.quota.title = 'billing period ' + (tr.period_key || '');
				qWrap.style.display = '';
			}
			else {
				C.quota.textContent = '未设置限额（可在「设置」中配置月度限额与重置日）';
				qWrap.style.display = '';
				this.quotaFill.style.width = '0%';
			}
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

	render: function(st) {
		st = st || null;

		this.cells = {};
		var self = this;
		['modem','sim','imsi','reg','sig','wwan','temp','meta','imei','uptime',
		 'cellrat','celltable','qci','qcitable','pdp4','pdp6','cids','ndis','syscfg','nwtime',
		 'sess','day','mon','tot','raterx','ratetx','ambrdl','ambrul','apnsub','quota'].forEach(function(k) {
			self.cells[k] = E('em', { 'id': 'mt5700_' + k }, '…');
		});
		var C = this.cells;
		this.canvasRx = E('canvas', { 'width': 320, 'height': 56, 'data-color': '#2eb872', 'style': 'width:320px;max-width:100%;height:56px;' });
		this.canvasTx = E('canvas', { 'width': 320, 'height': 56, 'data-color': '#4a90d9', 'style': 'width:320px;max-width:100%;height:56px;' });
		this.quotaFill = E('div', { 'style': 'height:100%;width:0;background:#2eb872;transition:width .5s,background .5s;' });
		this.quotaWrap = E('div', { 'style': 'margin:0 0 .6em;' });

		var tabs = this.buildTabs();
		var B = tabs.bodies;

		/* --- overview --- */
		B.overview.appendChild(this.tableFromRows([
			['模组', C.modem],
			['SIM 卡', C.sim],
			['IMSI / ICCID', C.imsi],
			['运营商 / 注册状态', C.reg],
			['信号质量', C.sig],
			['蜂窝连接 (wwan)', C.wwan],
			['模组温度', C.temp],
			['IMEI', C.imei],
			['连接时长', C.uptime],
			['数据状态', E('em', { 'style': 'font-size:small;color:#888;' }, [ C.meta ])]
		]));

		/* --- cell & signal --- */
		B.cell.appendChild(this.tableFromRows([
			['驻留网络制式', C.cellrat]
		]));
		B.cell.appendChild(C.celltable);
		B.cell.appendChild(E('p', { 'style': 'font-size:small;color:#888;' },
			'数据来自 AT^MONSC（驻留小区参数，NR 下频点为 SSB 频点）与 AT^HCSQ（信号索引解码），随守护进程巡检刷新。'));

		/* --- SIM & QoS --- */
		B.simqos.appendChild(this.tableFromRows([
			['签约速率（下行）', C.ambrdl],
			['签约速率（上行）', C.ambrul],
			['签约 APN', C.apnsub],
			['QoS（网络协商）', C.qci],
			['PDP IPv4', C.pdp4],
			['PDP IPv6', C.pdp6],
			['已激活承载', C.cids],
			['NDIS 双栈', C.ndis],
			['当前网络模式', C.syscfg],
			['网络时间', C.nwtime]
		]));
		B.simqos.appendChild(E('h4', {}, 'QoS 特性'));
		B.simqos.appendChild(C.qcitable);
		B.simqos.appendChild(E('p', { 'style': 'font-size:small;color:#888;' },
			'签约速率（APN-AMBR）由 AT^DSAMBR 读取运营商套餐签约值，实际速率受信号与网络调度影响；QCI/5QI 由 AT+CGEQOSRDP 读取网络协商值（5G SA 下即 5QI）。'));

		/* --- traffic --- */
		this.quotaWrap.replaceChildren(
			E('div', { 'style': 'font-weight:bold;margin-bottom:.3em;' }, '本月限额'),
			E('div', { 'style': 'background:rgba(128,128,128,.2);border-radius:4px;height:14px;overflow:hidden;' }, [ this.quotaFill ]),
			E('div', { 'style': 'font-size:small;margin:.25em 0;' }, [ C.quota ])
		);
		B.traffic.appendChild(this.quotaWrap);
		B.traffic.appendChild(E('div', { 'style': 'display:flex;gap:2em;flex-wrap:wrap;margin:.5em 0 1em;' }, [
			E('div', {}, [ E('div', { 'style': 'font-weight:bold;' }, '实时速率'), E('div', { 'style': 'display:flex;gap:1.5em;margin:.3em 0;' }, [ C.raterx, C.ratetx ]), this.canvasRx, this.canvasTx ]),
			E('div', { 'style': 'min-width:260px;flex:1;' }, this.tableFromRows([
				['本次连接', C.sess],
				['今日', C.day],
				['本月', C.mon],
				['累计', C.tot]
			]))
		]));
		B.traffic.appendChild(E('div', { 'style': 'margin-top:.5em;display:flex;gap:.5em;flex-wrap:wrap;' }, [
			E('button', { 'class': 'cbi-button', 'style': 'padding:4px 12px;', 'click': ui.createHandlerFn(this, 'handleTrafficReset', 'day') }, '清零今日'),
			E('button', { 'class': 'cbi-button', 'style': 'padding:4px 12px;', 'click': ui.createHandlerFn(this, 'handleTrafficReset', 'month') }, '清零本月'),
			E('button', { 'class': 'cbi-button cbi-button-negative', 'style': 'padding:4px 12px;', 'click': ui.createHandlerFn(this, 'handleTrafficReset', 'all') }, '全部清零')
		]));
		B.traffic.appendChild(E('p', { 'style': 'font-size:small;color:#888;' },
			'统计由 mt5700 守护进程每巡检周期从模组网卡计数器累计并持久化（重启不丢失），按自然日/自然月自动分账。速率曲线仅在本页打开期间实时采样。'));

		/* --- settings form --- */
		var m = new form.Map('mt5700', null,
			'设置由 <code>mt5700</code> 守护进程应用：保存后最迟在下一个检查周期生效（默认 30 秒）。切换 SIM 卡、修改 APN 或网络模式会短暂中断蜂窝连接。');
		var s = m.section(form.NamedSection, 'modem', 'mt5700', '蜂窝设置');

		var o = s.option(form.Flag, 'enabled', '启用 5G 蜂窝', '关闭后将切断模组供电并停止自动拨号。');
		o.rmempty = false;
		o.default = '1';

		var o = s.option(form.ListValue, 'sim_slot', 'SIM 卡槽', '「自动检测」按 外置 SIM1 → 外置 SIM2 → 内置 eSIM 顺序探测可用 SIM 卡。');
		o.value('auto', slotNames.auto);
		o.value('sim1', slotNames.sim1);
		o.value('sim2', slotNames.sim2);
		o.value('esim', slotNames.esim);
		o.default = 'auto';

		var o = s.option(form.Value, 'apn', 'APN', '留空则按 IMSI 自动识别运营商并配置（移动 cmnet / 联通 3gnet / 电信 ctnet / 广电 cbnet）。');
		o.placeholder = '自动（按运营商识别）';
		o.datatype = 'maxlength(64)';

		var o = s.option(form.ListValue, 'netmode', '网络模式', '仅 5G / 仅 4G 通过 AT^SYSCFGEX 锁定制式，切换会触发网络重选。');
		o.value('auto', '自动（5G 优先）');
		o.value('nr', '仅 5G NR');
		o.value('lte', '仅 LTE');
		o.default = 'auto';
		o.rmempty = false;

		var s3 = m.section(form.NamedSection, 'modem', 'mt5700', '流量限额');

		var o = s3.option(form.Value, 'traffic_limit_mb', '月度限额（MB）', '留空或 0 表示不限。按下方「重置日」划分的账期统计（下行+上行合计）。');
		o.placeholder = '不限';
		o.datatype = 'and(uinteger,min(0))';

		var o = s3.option(form.Value, 'traffic_reset_day', '账期重置日（几号）', '每月第几号结转流量账目（1–31；短月自动按月末处理），默认 1 号。');
		o.placeholder = '1';
		o.rmempty = false;
		o.datatype = 'and(uinteger,min(1),max(31))';

		var o = s3.option(form.ListValue, 'traffic_action', '超限动作', '「断开蜂窝」会在超限后断开并停止拨号，直到下个账期或调高/取消限额；「仅提醒」只在页面标红提示。');
		o.value('notify', '仅提醒（页面标红）');
		o.value('offline', '断开蜂窝（直至下个账期）');
		o.default = 'notify';
		o.rmempty = false;

		var s2 = m.section(form.NamedSection, 'modem', 'mt5700', '高级设置');

		var o = s2.option(form.Flag, 'usb3_retrain', 'USB 3.0 自动重训练', '模组以 USB 2.0（480 Mbps）枚举时自动热重启并重训练至 USB 3.0（5000 Mbps）。');
		o.rmempty = false;
		o.default = '1';

		var o = s2.option(form.Flag, 'fix_nvram', '模组 NVRAM 自愈', '自动修复其他系统残留的异常配置（SETMODE / TDCFG 网卡模式、C5GOPTION 5G SA 锁死）。');
		o.rmempty = false;
		o.default = '1';

		var o = s2.option(form.Flag, 'thermal_guard', '模组高温联动散热', '按 AT^CHIPTEMP 模组内部温度联动风扇加速（≥72 °C 起步），先于 97 °C 保护性断网。');
		o.rmempty = false;
		o.default = '1';

		var o = s2.option(form.Value, 'check_interval', '检查间隔（秒）', '守护进程巡检 SIM / 注册 / 拨号 / 流量统计的周期。');
		o.placeholder = '30';
		o.datatype = 'range(10, 600)';
		o.rmempty = false;

		var container = E('div', {}, [
			E('h2', {}, '5G 蜂窝（MT5700M-CN）'),
			tabs.bar,
			B.overview, B.cell, B.simqos, B.traffic,
			E('div', { 'style': 'margin-top:1.5em;' })
		]);

		if (st)
			this.updateStatus(st);

		poll.add(L.bind(function() {
			return fs.exec('/usr/sbin/mt5700-status').then(L.bind(function(res) {
				var s = null;
				try { s = JSON.parse(res.stdout); } catch (e) {}
				if (s)
					this.updateStatus(s);
			}, this));
		}, this), 10);

		return m.render().then(function(formNode) {
			B.settings.appendChild(formNode);
			container.appendChild(B.settings);
			return container;
		});
	}
});
