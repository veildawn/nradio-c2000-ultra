'use strict';
'require view';
'require poll';
'require fs';
'require uci';
'require ui';

var REPO = 'veildawn/nradio-c2000-ultra';

/* Inline SVG brand icons (simplified marks, offline, zero assets) */
var ICONS = {
	wechat: { vb: 24, svg: '<path fill="#fff" d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.3 4.7 3.4 6.2L4.5 20l3.2-1.6c1.3.4 2.7.6 4.3.6 5.5 0 10-3.6 10-8s-4.5-8-10-8zm-4 9.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm4 0c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm4.5 0c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"/>' },
	qq: { vb: 24, svg: '<path fill="#fff" d="M12 2C8 2 5.5 5 5.5 8.5c0 1.5-.3 2.8-.8 4C3.8 14 3 16 3 17.5c0 .8.5 1.5 1.3 1.8.3 1 1.2 1.7 2.2 1.7.5 0 1-.2 1.4-.5 1.2.3 2.6.5 4.1.5s2.9-.2 4.1-.5c.4.3.9.5 1.4.5 1 0 1.9-.7 2.2-1.7.8-.3 1.3-1 1.3-1.8 0-1.5-.8-3.5-1.7-5-.5-1.2-.8-2.5-.8-4C18.5 5 16 2 12 2zm-2 8c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm4 0c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1z"/>' },
	douyin: { vb: 24, svg: '<path fill="#fff" d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.79-2.46V9.76a5.68 5.68 0 1 0 4.88 5.62V8.77a7.35 7.35 0 0 0 4.3 1.38V7.06a4.28 4.28 0 0 1-3.24-1.24z"/>' },
	bilibili: { vb: 24, svg: '<path fill="#fff" d="M7.17 4.34l1.42 1.4L10.3 3.5a1 1 0 0 1 1.4 0l1.7 2.24 1.43-1.4a1 1 0 0 1 1.7.7v1.46H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2.46V5.04a1 1 0 0 1 1.7-.7zM5 9.5v9h14v-9H5zm3 3h8v2H8v-2z"/>' },
	taobao: { vb: 24, svg: '<circle cx="12" cy="12" r="10" fill="none" stroke="#fff" stroke-width="2"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold" font-family="sans-serif">\u6DD8</text>' },
	jd: { vb: 24, svg: '<path fill="#fff" d="M12 3c-3 0-5 2-5 4.5 0 .8.2 1.5.6 2.1C6.6 10.3 6 11.6 6 13c0 3.9 3 7 6.5 7s6.5-3.1 6.5-7c0-1.4-.6-2.7-1.6-3.4.4-.6.6-1.3.6-2.1C18 5 15 3 12 3zm-2 7a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm-2 4c1.5 0 2.5.5 2.5.5s-.5 2-2.5 2-2.5-2-2.5-2S10.5 14 12 14z"/>' },
	weibo: { vb: 24, svg: '<path fill="#fff" d="M10 9C5.5 9 2 12 2 15.5S5.5 22 10 22s8-3 8-6.5S14.5 9 10 9zm0 10c-2.8 0-5-1.6-5-3.5S7.2 12 10 12s5 1.6 5 3.5-2.2 3.5-5 3.5zm0-5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/><path fill="#fff" d="M14 5c2.5-1 5-1 7 0l.5-2C18.5 1 15 1 12.5 2.5z"/>' },
	kuaishou: { vb: 24, svg: '<path fill="#fff" d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/>' },
	iqiyi: { vb: 24, svg: '<rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="#fff" stroke-width="2"/><path fill="#fff" d="M10 9l6 3-6 3V9z"/>' },
	vqq: { vb: 24, svg: '<circle cx="12" cy="12" r="10" fill="none" stroke="#fff" stroke-width="2"/><path fill="#fff" d="M10 8.5l5 3.5-5 3.5v-7z"/>' },
	wzry: { vb: 24, svg: '<path fill="#fff" d="M4 4l7 7-2 2-5-5V4zm16 0l-7 7 2 2 5-5V4zM6.5 14.5L4 17l3 3 2.5-2.5-3-3zm11 0L21 17l-3 3-2.5-2.5 3-3z"/><circle cx="12" cy="12" r="2" fill="#fff"/>' },
	yuanShen: { vb: 24, svg: '<path fill="#fff" d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z"/>' },
	steam: { vb: 24, svg: '<circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="12" cy="12" r="3" fill="#fff"/>' },
	alipay: { vb: 24, svg: '<path fill="#fff" d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 3c-3 0-5.5 2-5.5 5s2.5 5 5.5 5c1.5 0 2.5-.5 3.5-1.5l-1.5-1.5c-.5.5-1 .8-2 .8-1.5 0-2.5-1-2.5-2.8s1-2.8 2.5-2.8c1 0 1.5.3 2 .8l1.5-1.5C14.5 7.5 13.5 7 12 7z"/>' },
	dingtalk: { vb: 24, svg: '<path fill="#fff" d="M14.5 3.5c-.2 0-4.8 1.8-6.5 5.5-.6 1.3-.6 2.8-.2 4L5 16l-1.5 1 1 1.5L6 17.5l3-3c1.2.5 2.7.5 4-.1 3.7-1.7 5.5-6.3 5.5-6.5l-4-.4zM13 7c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1z"/>' },
	baidu: { vb: 24, svg: '<ellipse cx="7" cy="8" rx="3" ry="4" fill="#fff"/><ellipse cx="12" cy="6" rx="2.5" ry="3.5" fill="#fff"/><ellipse cx="17" cy="8" rx="3" ry="4" fill="#fff"/><ellipse cx="12" cy="14" rx="6" ry="5" fill="#fff"/>' },
	neteaseGame: { vb: 24, svg: '<path fill="#fff" d="M7 6h10a5 5 0 0 1 5 5v2a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5v-2a5 5 0 0 1 5-5zm-1 3v2H4v2h2v2h2v-2h2v-2H8V9H6zm10.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-3 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>' },
	xiaohongshu: { vb: 24, svg: '<rect x="4" y="3" width="16" height="18" rx="2" fill="#fff" opacity=".95"/><text x="12" y="15" text-anchor="middle" fill="#e02e24" font-size="8" font-weight="bold" font-family="serif">RED</text>' },
	zhihu: { vb: 24, svg: '<path fill="#fff" d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm3 3v2h4l-1 4h3V9h2V7H8z"/>' },
	apple: { vb: 24, svg: '<path fill="#fff" d="M16.7 12.6c0-2 1.6-3 1.7-3.1-.9-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2.1 2.5 2 1-.1 1.4-.6 2.6-.6 1.2 0 1.5.6 2.6.6 1.1 0 1.8-1 2.4-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.1-3zM14.8 6.2c.5-.7.9-1.6.8-2.6-.8.1-1.8.6-2.3 1.3-.5.6-1 1.6-.8 2.5.9.1 1.8-.5 2.3-1.2z"/>' },
	microsoft: { vb: 24, svg: '<rect x="3" y="3" width="8" height="8" fill="#f25022"/><rect x="13" y="3" width="8" height="8" fill="#7fba00"/><rect x="3" y="13" width="8" height="8" fill="#00a4ef"/><rect x="13" y="13" width="8" height="8" fill="#ffb900"/>' },
	google: { vb: 24, svg: '<path fill="#4285F4" d="M21.35 11.1H12v3.9h5.35c-.5 2.5-2.6 3.9-5.35 3.9a6 6 0 1 1 0-12c1.5 0 2.9.5 4 1.5l2.8-2.8A9.9 9.9 0 0 0 12 2a10 10 0 1 0 0 20c5.8 0 9.7-4 9.7-9.7 0-.4 0-.8-.1-1.2z"/>' },
	mycn: { vb: 24, svg: '<rect x="3" y="3" width="18" height="18" rx="4" fill="#ff6900"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold" font-family="sans-serif">MI</text>' },
	hwcloud: { vb: 24, svg: '<path fill="#fff" d="M12 2c-1.5 2-2.5 4-2.5 6 0 1.5.5 2.5 1.2 3.5L7 15.5C5.5 14 4.5 12 4.5 9.5 4.5 6 6.5 3 12 2zm0 0c5.5 1 7.5 4 7.5 7.5 0 2.5-1 4.5-2.5 6l-3.7-4c.7-1 1.2-2 1.2-3.5 0-2-1-4-2.5-6zm0 20c-5.5-1-7.5-4-7.5-7.5 0-1.7.6-3.3 1.6-4.6L9.5 14c0 2 1 4 2.5 6zm0 0c1.5-2 2.5-4 2.5-6l3.4-4.1c1 1.3 1.6 2.9 1.6 4.6 0 3.5-2 6.5-7.5 7.5z"/>' },
	bytedance: { vb: 24, svg: '<rect x="3" y="5" width="18" height="14" rx="2" fill="#fff"/><path fill="#fe2c55" d="M6 8h9v2H6V8zm0 3h12v1.5H6V11zm0 2.5h7V15H6v-1.5z"/>' },
	neteaseMusic: { vb: 24, svg: '<path fill="#fff" d="M18 3v10.5a3.5 3.5 0 1 1-2-3.2V7l-6 1.5v8a3.5 3.5 0 1 1-2-3.2V6l10-3z"/>' },
	qqmusic: { vb: 24, svg: '<circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="2"/><path fill="#fff" d="M15 7v7a2.5 2.5 0 1 1-1.5-2.3V9l-4 1v5.5a2.5 2.5 0 1 1-1.5-2.3V8.5l7-1.5z"/>' },
	meituan: { vb: 24, svg: '<path fill="#fff" d="M8 7V5a4 4 0 1 1 8 0v2h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h2zm2 0h4V5a2 2 0 1 0-4 0v2z"/>' },
	pdd: { vb: 24, svg: '<circle cx="8" cy="8" r="4" fill="#fff" opacity=".8"/><circle cx="16" cy="8" r="4" fill="#fff" opacity=".6"/><circle cx="8" cy="16" r="4" fill="#fff" opacity=".6"/><circle cx="16" cy="16" r="4" fill="#fff" opacity=".4"/>' },
	feishu: { vb: 24, svg: '<path fill="#fff" d="M20 4L8 16l-4-4L20 4zm-8 14l-2 2 4 0 6-12-8 10z"/>' },
	youku: { vb: 24, svg: '<circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="2"/><path fill="#fff" d="M10 8.5l6 3.5-6 3.5v-7z"/>' },
	huya: { vb: 24, svg: '<path fill="#fff" d="M4 4l3 3c-1 1-1.5 2.5-1.5 4 0 3.5 3 6.5 6.5 6.5S18.5 14.5 18.5 11c0-1.5-.5-3-1.5-4l3-3-4 1.5c-1-.5-2.5-1-4-1s-3 .5-4 1L4 4zm5 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm6 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm-3 3c1 0 2 .5 2 .5s-.5 1.5-2 1.5-2-1.5-2-1.5 1-.5 2-.5z"/>' },
	douyu: { vb: 24, svg: '<path fill="#fff" d="M12 3C7 3 4 7 4 12c0 3 1.5 5.5 3.5 7l1.5-2 1.5 2 1.5-2 1.5 2 1.5-2 1.5 2c2-1.5 3.5-4 3.5-7 0-5-3-9-8-9zm-3 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/>' },
	miguvideo: { vb: 24, svg: '<rect x="3" y="6" width="13" height="12" rx="2" fill="#fff"/><path fill="#fff" d="M16 10l5-3v10l-5-3V10z"/>' },
	egame: { vb: 24, svg: '<path fill="#fff" d="M6 8h4v8H6V8zm8 0h4v8h-4V8zM4 6h2v12H4V6zm14 0h2v12h-2V6z"/>' },
};
var ICON_FALLBACK = { vb: 24, svg: '<circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="1.5" opacity=".6"/><circle cx="12" cy="12" r="3" fill="#fff" opacity=".7"/>' };
var ICON_COLORS = {
	wechat: '#07C160', qq: '#12B7F5', weibo: '#E6162D', douyin: '#1a1a1a',
	bilibili: '#FB7299', taobao: '#FF6B00', jd: '#E31436', kuaishou: '#FF7900',
	iqiyi: '#00BE06', vqq: '#FF6022', youku: '#1EBEFF', miguvideo: '#00A1E0',
	huya: '#F4645F', douyu: '#FF7A3C', pdd: '#E02E24', meituan: '#F39C12',
	alipay: '#1677FF', wzry: '#B8860B', yuanShen: '#6C5CE7', neteaseGame: '#D43C33',
	steam: '#66C0F4', egame: '#7B68EE', dingtalk: '#0089FF', feishu: '#3370FF',
	bytedance: '#FE2C55', baidu: '#2932E1', neteaseMusic: '#C20C0C', qqmusic: '#31C27C',
	apple: '#555555', microsoft: '#5E5E5E', google: '#4285F4', mycn: '#FF6900',
	hwcloud: '#CF0A2C', xiaohongshu: '#E02E24', zhihu: '#0084FF'
};


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

	/* brand-colored SVG icon badge */
	renderIcon: function(info, small) {
		var sz = small ? 20 : 28;
		var bs = small ? 24 : 36;
		var ic = ICONS[info.id] || ICON_FALLBACK;
		var color = ICON_COLORS[info.id] || info.color || '#888888';
		var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 ' + ic.vb + ' ' + ic.vb);
		svg.setAttribute('width', sz);
		svg.setAttribute('height', sz);
		svg.style.cssText = 'flex-shrink:0;';
		svg.innerHTML = ic.svg;
		return E('span', {
			'style': 'display:inline-flex;align-items:center;justify-content:center;width:' + bs + 'px;height:' + bs + 'px;border-radius:50%;background:' + color + ';margin-right:' + (small ? 6 : 10) + 'px;flex-shrink:0;vertical-align:middle;overflow:hidden;'
		}, [ svg ]);
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
