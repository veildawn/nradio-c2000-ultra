'use strict';
'require view';
'require form';
'require poll';
'require fs';

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
			'style': 'width:4px;height:%dpx;border-radius:1px;background:%s;'.format(3 + i * 3, (i <= q.bars) ? color : 'rgba(0,0,0,.15)')
		}));

	return E('span', {}, [
		widget,
		(q.bars > 0) ? sysmodeNames[st.signal.sysmode] || st.signal.sysmode : '无信号',
		(q.metric !== '') ? '（%s）'.format(q.metric) : ''
	]);
}

return view.extend({
	load: function() {
		return fs.exec('/usr/sbin/mt5700-status');
	},

	buildStatusTable: function() {
		var rows = [
			[ '模组', this.cModem ],
			[ 'SIM 卡', this.cSim ],
			[ 'IMSI / ICCID', this.cIds ],
			[ '运营商 / 注册状态', this.cReg ],
			[ '信号质量', this.cSig ],
			[ '蜂窝连接 (wwan)', this.cWwan ],
			[ '模组温度', this.cTemp ],
			[ '数据状态', this.cMeta ]
		];

		var tbody = E('table', { 'class': 'table', 'id': 'mt5700_status' });
		for (var i = 0; i < rows.length; i++)
			tbody.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '30%' }, rows[i][0]),
				E('td', { 'class': 'td left', 'id': rows[i][1].id }, rows[i][1])
			]));

		return tbody;
	},

	updateStatus: function(st) {
		/* Consistency rules (factory-ROM semantics):
		 *   - SIM route switched after the last sweep -> show 检测中, never old data
		 *   - no SIM detected on the active slot      -> show 未检测到 SIM 卡
		 *   - stamp older than 2x check interval      -> values degraded to —
		 *   - modem presence / USB / wwan IP are live facts and always shown */
		var interval = num(st.check_interval) || 30,
		    staleAfter = Math.max(60, interval * 2),
		    age = num(st.stamp_age),
		    stale = (age !== null && age > staleAfter),
		    noData = (st.source === 'none'),
		    phase = st.sim.phase || '',
		    switching = (st.sim.transition === 1 || noData || phase == 'switching'),
		    absent = (phase == 'absent');

		this.cModem.textContent = (!st.present)
			? '未检测到模组（USB 3466:3301 不在线）'
			: 'MT5700M-CN 在线，USB %s Mbps，AT 口 %s，网卡 %s'.format(
				st.usb_speed || '?', st.at_port || '—', st.netdev || '—');

		if (!st.present) {
			this.cSim.textContent = '—';
			this.cIds.textContent = '—';
			this.cReg.textContent = '—';
			this.cSig.replaceChildren(E('span', {}, '—'));
			this.cTemp.textContent = '—';
		}
		else {
			var slot = (st.sim.slot) ? (slotNames[st.sim.slot] || st.sim.slot) : '—';
			var cfgslot = (st.sim.configured_slot)
				? (slotNames[st.sim.configured_slot] || st.sim.configured_slot) : '—';

			if (absent) {
				this.cSim.textContent = '未检测到 SIM 卡 ｜ 当前卡槽：%s'.format(slot);
			}
			else if (switching || stale) {
				this.cSim.textContent = '正在检测 SIM 卡… ｜ 卡槽：%s（配置：%s）'.format(slot, cfgslot);
			}
			else {
				var simTxt = '%s ｜ 卡槽：%s'.format(st.sim.state_cn || st.sim.state || '未知', slot);
				if (st.sim.configured_slot != st.sim.slot && st.sim.configured_slot != 'auto')
					simTxt += '（已配置 %s，守护进程将在 %d 秒内切换）'.format(cfgslot, interval);
				else if (st.sim.configured_slot == 'auto')
					simTxt += '（配置：自动检测）';
				this.cSim.textContent = simTxt;
			}
			this.cSim.title = 'SCICHG=%s，cpe-sel0=%s'.format(st.sim.scichg || '—', st.sim.slot_gpio || '—');

			this.cIds.textContent = (absent || switching || stale)
				? '—' : '%s / %s'.format(st.sim.imsi || '—', st.sim.iccid || '—');

			if (absent) {
				this.cReg.textContent = '未注册（无 SIM 卡）';
			}
			else if (switching || stale) {
				this.cReg.textContent = '检测中…';
			}
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
				this.cReg.textContent = reg.join(' ｜ ');
			}

			if (absent) {
				this.cSig.replaceChildren(E('span', {}, '无服务'));
			}
			else if (switching || stale || !st.signal.sysmode) {
				this.cSig.replaceChildren(E('span', {}, '检测中…'));
			}
			else {
				this.cSig.replaceChildren(renderSignalWidget(st));
				var s = st.signal, parts = [];
				if (s.rsrp_dbm) parts.push('RSRP %s'.format(fmtDbm(s.rsrp_dbm)));
				if (s.rscp_dbm) parts.push('RSCP %s'.format(fmtDbm(s.rscp_dbm)));
				if (s.rssi_dbm) parts.push('RSSI %s'.format(fmtDbm(s.rssi_dbm)));
				else if (s.csq_dbm) parts.push('RSSI %s'.format(fmtDbm(s.csq_dbm)));
				if (s.sinr_dc) parts.push('SINR %s'.format(fmtTenth(s.sinr_dc)));
				if (s.rsrq_dc) parts.push('RSRQ %s'.format(fmtTenth(s.rsrq_dc)));
				if (s.ecio_dc) parts.push('Ec/Io %s'.format(fmtTenth(s.ecio_dc)));
				this.cSig.appendChild(E('div', { 'style': 'font-size:small;color:#666;' }, parts.join(' ｜ ') || '—'));
			}

			var t = num(st.temp_dc);
			this.cTemp.textContent = (t !== null) ? '%.1f °C'.format(t / 10) : '—';
		}

		var wwan = [];
		if (st.wwan.pending)
			wwan.push('正在拨号…');
		if (st.wwan.up) {
			wwan.push('已连接');
			if (st.wwan.ip4) wwan.push('IPv4：%s'.format(st.wwan.ip4));
			if (st.wwan.ip6) wwan.push('IPv6：%s'.format(st.wwan.ip6));
			if (num(st.carrier_link) === 0)
				wwan.push('（模组网络链路已断开，等待重建）');
		}
		else if (!st.wwan.pending) {
			wwan.push('未连接');
		}
		wwan.push('APN：%s'.format(st.apn || '自动'));
		this.cWwan.textContent = wwan.join(' ｜ ');

		var meta = [];
		if (st.busy)
			meta.push('AT 通道忙（拨号/守护进程操作中）');
		if (stale)
			meta.push('模组数据已过期（%d 秒前），等待守护进程刷新'.format(age));
		meta.push('数据来源：%s（%d 秒前）'.format(
			st.source === 'none' ? '无' : st.source, age || 0));
		this.cMeta.textContent = meta.join('；');
	},

	render: function(first) {
		var st = null;
		try { st = JSON.parse(first && first.stdout || '{}'); } catch (e) {}

		/* status cells, filled by updateStatus() */
		this.cModem = E('em', { 'id': 'mt5700_modem' }, '…');
		this.cSim   = E('em', { 'id': 'mt5700_sim' }, '…');
		this.cIds   = E('em', { 'id': 'mt5700_ids' }, '…');
		this.cReg   = E('em', { 'id': 'mt5700_reg' }, '…');
		this.cSig   = E('span', { 'id': 'mt5700_sig' }, '…');
		this.cWwan  = E('em', { 'id': 'mt5700_wwan' }, '…');
		this.cTemp  = E('em', { 'id': 'mt5700_temp' }, '…');
		this.cMeta  = E('em', { 'id': 'mt5700_meta', 'style': 'font-size:small;color:#666;' }, '…');

		var container = E('div', {}, [
			E('h2', {}, '5G 蜂窝（MT5700M-CN）'),
			this.buildStatusTable()
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

		/* settings form applied by the mt5700 daemon on its next tick */
		var m = new form.Map('mt5700', null,
			'设置由 <code>mt5700</code> 守护进程应用：保存后最迟在下一个检查周期生效（默认 30 秒，见下方「检查间隔」）。切换 SIM 卡或修改 APN 会短暂中断蜂窝连接。');

		var s = m.section(form.NamedSection, 'modem', 'mt5700', '蜂窝设置');

		var o = s.option(form.Flag, 'enabled', '启用 5G 蜂窝',
			'关闭后将切断模组供电并停止自动拨号。');
		o.rmempty = false;
		o.default = '1';

		var o = s.option(form.ListValue, 'sim_slot', 'SIM 卡槽',
			'「自动检测」按 外置 SIM1 → 外置 SIM2 → 内置 eSIM 顺序探测可用 SIM 卡。');
		o.value('auto', slotNames.auto);
		o.value('sim1', slotNames.sim1);
		o.value('sim2', slotNames.sim2);
		o.value('esim', slotNames.esim);
		o.default = 'auto';

		var o = s.option(form.Value, 'apn', 'APN',
			'留空则按 IMSI 自动识别运营商并配置（移动 cmnet / 联通 3gnet / 电信 ctnet / 广电 cbnet）。');
		o.placeholder = '自动（按运营商识别）';
		o.datatype = 'maxlength(64)';

		var s2 = m.section(form.NamedSection, 'modem', 'mt5700', '高级设置');

		var o = s2.option(form.Flag, 'usb3_retrain', 'USB 3.0 自动重训练',
			'模组以 USB 2.0（480 Mbps）枚举时自动热重启并重训练至 USB 3.0（5000 Mbps）。');
		o.rmempty = false;
		o.default = '1';

		var o = s2.option(form.Flag, 'fix_nvram', '模组 NVRAM 自愈',
			'自动修复其他系统残留的异常配置（SETMODE / TDCFG 网卡模式、C5GOPTION 5G SA 锁死）。');
		o.rmempty = false;
		o.default = '1';

		var o = s2.option(form.Flag, 'thermal_guard', '模组高温联动散热',
			'按 AT^CHIPTEMP 模组内部温度联动风扇加速（≥72 °C 起步），先于 97 °C 保护性断网。');
		o.rmempty = false;
		o.default = '1';

		var o = s2.option(form.Value, 'check_interval', '检查间隔（秒）',
			'守护进程巡检 SIM / 注册 / 拨号状态的周期。');
		o.placeholder = '30';
		o.datatype = 'range(10, 600)';
		o.rmempty = false;

		container.appendChild(E('hr'));

		return m.render().then(function(node) {
			container.appendChild(node);
			return container;
		});
	}
});
