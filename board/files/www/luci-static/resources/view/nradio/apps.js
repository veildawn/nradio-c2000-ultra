'use strict';
'require view';
'require poll';
'require fs';
'require uci';
'require ui';

var REPO = 'veildawn/nradio-c2000-ultra';

function num(v) {
	var n = parseInt(v, 10);
	return isNaN(n) ? null : n;
}

function fmtAgo(s) {
	var n = num(s);
	if (n === null) return '—';
	if (n < 60) return '%d 秒前'.format(n);
	if (n < 3600) return '%d 分钟前'.format(Math.floor(n / 60));
	if (n < 86400) return '%d 小时前'.format(Math.floor(n / 3600));
	return '%d 天前'.format(Math.floor(n / 86400));
}

function exec(args) {
	return fs.exec('/usr/sbin/nr-app-status', args).then(function(res) {
		try {
			return JSON.parse(res.stdout);
		}
		catch (e) {
			throw new Error('解析输出失败：%s'.format((res.stderr || res.stdout || e.message).trim()));
		}
	});
}

return view.extend({
	appsBox: E('div', {}),
	clientsBox: E('div', {}),
	unknownBox: E('div', {}),
	appRows: {},

	findApp: function(st, id) {
		for (var i = 0; i < (st.apps || []).length; i++)
			if (st.apps[i].id == id)
				return st.apps[i];
		return { id: id, name: id, cat: '' };
	},

	isBlocked: function(st, id) {
		return (st.blocked || []).indexOf(id) >= 0;
	},

	/* colored circular icon badge with emoji */
	renderIcon: function(info, small) {
		var sz = small ? 24 : 36;
		var fs = small ? 14 : 20;
		return E('span', {
			'style': 'display:inline-flex;align-items:center;justify-content:center;width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:' + (info.color || '#888888') + ';font-size:' + fs + 'px;margin-right:' + (small ? 6 : 10) + 'px;flex-shrink:0;vertical-align:middle;'
		}, info.icon || '🌐');
	},

	/* per-app usage row with a block toggle */
	renderAppRow: function(st, stat) {
		var self = this,
		    info = this.findApp(st, stat ? stat.app : null),
		    row = this.appRows[info.id];
		if (!row) {
			var qTd = E('td', { 'class': 'td left' }, '…'),
			    tTd = E('td', { 'class': 'td left' }, '…'),
			    btn = E('button', { 'class': 'cbi-button', 'style': 'padding:3px 12px;' }, '…');
			row = E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'style': 'min-width:180px;' }, [
					this.renderIcon(info),
					E('span', { 'style': 'display:inline-block;vertical-align:middle;' }, [
						E('b', {}, info.name),
						E('div', { 'style': 'font-size:small;color:#888;' }, info.cat)
					])
				]),
				qTd,
				tTd,
				E('td', { 'class': 'td left' }, [ btn ])
			]);
			/* keep direct references: the row may not be in the document yet
			 * when the table is assembled before being attached */
			row._qTd = qTd;
			row._tTd = tTd;
			row._btn = btn;
			this.appRows[info.id] = row;
		}
		row._qTd.textContent = stat ? '%d 次'.format(stat.queries) : '0';
		row._tTd.textContent = stat ? fmtAgo(stat.last_ago) : '—';
		var blocked = this.isBlocked(st, info.id);
		row._btn.textContent = blocked ? '解除阻断' : '阻断';
		row._btn.className = 'cbi-button ' + (blocked ? 'cbi-button-negative' : '');
		row._btn.style.padding = '3px 12px';
		row._btn.onclick = L.bind(self.toggleBlock, self, info.id, !blocked);
		return row;
	},

	toggleBlock: function(appId, block) {
		var self = this;
		return uci.load('nrapp').then(function() {
			// find or create the section for this app
			var sid = null,
			    sections = uci.sections('nrapp', 'app');
			for (var i = 0; i < sections.length; i++)
				if (sections[i].app == appId) { sid = sections[i]['.name']; break; }
			if (!sid) {
				sid = uci.add('nrapp', 'app');
				uci.set('nrapp', sid, 'app', appId);
			}
			uci.set('nrapp', sid, 'blocked', block ? '1' : '0');
			return uci.save().then(function() {
				return uci.apply().then(function() {
					return self.refresh();
				});
			});
		}).catch(function(e) {
			ui.addNotification(null, E('p', {}, '应用失败：%s'.format(e.message)), 'error');
		});
	},

	toggleFeature: function() {
		var self = this;
		return uci.load('nrapp').then(function() {
			var cur = uci.get('nrapp', 'global', 'enabled') || '1';
			uci.set('nrapp', 'global', 'enabled', cur == '1' ? '0' : '1');
			return uci.save().then(function() {
				return uci.apply().then(function() {
					/* enabling/disabling restarts services via our init hook */
					return fs.exec('/sbin/service', [ 'nr-apptrack', 'restart' ]).catch(function() {}).then(function() {
						return self.refresh();
					});
				});
			});
		});
	},

	clearStats: function() {
		var self = this;
		ui.showModal('清空应用统计', [
			E('p', {}, '确认清空全部应用访问统计？阻断配置不受影响。'),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, '取消'), ' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-negative',
					'click': ui.createHandlerFn(this, function() {
						return uci.load('nrapp').then(function() {
							uci.set('nrapp', 'global', 'clear', '1');
							return uci.save().then(function() {
								return uci.apply();
							});
						}).then(ui.hideModal).then(L.bind(self.refresh, self));
					})
				}, '确认清空')
			])
		]);
	},

	refresh: function() {
		return exec([]).then(L.bind(this.renderData, this)).catch(function(e) {
			ui.addNotification(null, E('p', {}, e.message), 'error');
		});
	},

	renderData: function(st) {
		var self = this;
		/* feature switch header */
		this.appsBox.replaceChildren(
			E('div', { 'style': 'margin:0 0 1em;display:flex;gap:.6em;flex-wrap:wrap;align-items:center;' }, [
				E('button', {
					'class': 'cbi-button ' + (st.enabled != '0' ? 'cbi-button-negative' : 'cbi-button-positive'),
					'click': ui.createHandlerFn(this, 'toggleFeature')
				}, st.enabled != '0' ? '停用应用管控' : '启用应用管控'),
				E('button', { 'class': 'cbi-button', 'click': ui.createHandlerFn(this, 'clearStats') }, '清空统计'),
				E('span', { 'style': 'font-size:small;color:#888;' },
					st.enabled != '0'
						? (st.running ? '运行中 ｜ DNS 记录: %s'.format(st.log_enabled == '1' ? '已开启' : '未开启') : '⚠ 服务未运行（保存设置后自动启动）')
						: '已停用（不再记录/阻断）')
			])
		);

		/* per-app table: catalog rows (with or without observed traffic) */
		var byApp = {};
		(st.per_app || []).forEach(function(s) { byApp[s.app] = s; });
		var seen = {};
		var rows = [];
		(st.per_app || []).forEach(function(s) { seen[s.app] = 1; rows.push(s); });
		(st.apps || []).forEach(function(a) {
			if (!seen[a.id]) rows.push(null), seen[a.id] = 1;
		});
		// rebuild table body; keep order: observed first (by queries), then untouched catalog
		var observed = (st.per_app || []).slice().sort(function(a, b) { return b.queries - a.queries; });
		var table = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, '应用'),
				E('th', { 'class': 'th' }, 'DNS 请求'),
				E('th', { 'class': 'th' }, '最近活跃'),
				E('th', { 'class': 'th' }, '限制')
			])
		]);
		var done = {};
		observed.forEach(function(s) {
			if (done[s.app]) return;
			done[s.app] = 1;
			table.appendChild(self.renderAppRow(st, s));
		});
		(st.apps || []).forEach(function(a) {
			if (done[a.id]) return;
			if (self.isBlocked(st, a.id)) {
				done[a.id] = 1;
				table.appendChild(self.renderAppRow(st, null));
			}
		});

		/* per-client table */
		var ct = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, '客户端'),
				E('th', { 'class': 'th' }, 'IP'),
				E('th', { 'class': 'th' }, '在用应用（DNS 请求 / 最近活跃）')
			])
		]);
			(st.clients || []).forEach(function(c) {
				var appChips = (c.apps || []).slice().sort(function(a, b) { return b.queries - a.queries; }).slice(0, 12).map(function(a) {
					var info = self.findApp(st, a.app);
					return E('span', {
						'style': 'display:inline-flex;align-items:center;margin:2px 4px 2px 0;padding:2px 10px 2px 4px;border-radius:12px;background:rgba(128,128,128,.12);font-size:small;'
					}, [
						self.renderIcon(info, true),
						info.name + ' ×' + a.queries
					]);
				});
			ct.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left' }, c.name || '（未知设备）'),
				E('td', { 'class': 'td left' }, c.ip),
				E('td', { 'class': 'td left' }, appChips.length ? appChips : [ E('span', { 'style': 'color:#888;' }, '暂无记录') ])
			]));
		});
		this.clientsBox.replaceChildren(
			E('h4', {}, '客户端应用使用'),
			(st.clients || []).length ? ct : E('p', { 'style': 'color:#888;' }, '暂无客户端记录——有设备开始上网后 20 秒内出现。')
		);

		/* unknown domains */
		var ut = E('table', { 'class': 'table' });
		(st.unknown_top || []).slice(0, 15).forEach(function(u) {
			ut.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left' }, u.domain),
				E('td', { 'class': 'td left' }, '%d 次'.format(u.queries)),
				E('td', { 'class': 'td left' }, fmtAgo(u.last_ago))
			]));
		});
		this.unknownBox.replaceChildren(
			E('h4', {}, '未识别域名 Top'),
			(st.unknown_top || []).length ? ut : E('p', { 'style': 'color:#888;' }, '暂无。'),
			E('p', { 'style': 'font-size:small;color:#888;' },
				'以上域名不在内置应用库中；可将高频域名补充到 /usr/share/nradio-c2000/app-domains.json（后缀匹配）。')
		);

		/* app table container swap */
		this.appTableBox.replaceChildren(
			E('h4', {}, '应用访问统计与限制'),
			table,
			E('p', { 'style': 'font-size:small;color:#888;' },
				'识别方式：DNS 查询域名后缀匹配（小米/华为路由器应用限制同源方案）。统计口径为 DNS 请求次数与活跃时间，非字节流量；' +
				'阻断通过返回 0.0.0.0 实现，对使用域名解析的应用（网页/大部分 App 主链路）有效，内置硬编码 IP 的应用可能绕过。')
		);
	},

	load: function() {
		return exec([]).catch(function() { return null; });
	},

	render: function(first) {
		var self = this;
		this.appTableBox = E('div', {});
		if (first)
			this.renderData(first);

		poll.add(L.bind(function() {
			return exec([]).then(L.bind(this.renderData, this)).catch(function() {});
		}, this), 15);

		return E('div', {}, [
			E('h2', {}, '应用管控'),
			E('p', {},
				'查看局域网设备在用应用并一键阻断。数据来自本机 dnsmasq DNS 查询日志（仅统计，不外传），域名库参考社区常用应用清单维护于仓库内。'),
			this.appsBox,
			this.appTableBox,
			E('hr'),
			this.clientsBox,
			E('hr'),
			this.unknownBox
		]);
	}
});
