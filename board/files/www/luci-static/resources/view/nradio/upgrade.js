'use strict';
'require view';
'require fs';
'require ui';
'require poll';

function num(v) {
	var n = parseInt(v, 10);
	return isNaN(n) ? 0 : n;
}

function fmtDate(v) {
	if (!num(v)) return '—';
	return new Date(num(v) * 1000).toLocaleString();
}

function fmtSize(v) {
	var n = num(v);
	return n >= 1048576 ? '%.1f MB'.format(n / 1048576) : '%d KB'.format(Math.ceil(n / 1024));
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
		return exec([ 'status' ]).catch(function(e) { return { state: 'unknown', msg: e.message }; });
	},

	isActive: function() {
		return this.download && [ 'downloading', 'verifying', 'flashing' ].indexOf(this.download.state) >= 0;
	},

	updateActions: function() {
		var active = this.isActive(), locked = active || this.busy || this.checking;
		this.checkButton.disabled = !!locked;
		this.downloadButton.disabled = !!(locked || !this.latest || this.latest.kernel_match !== 1);
		this.mirrorInput.disabled = !!locked;
		this.flashBox.querySelectorAll('button').forEach(function(button) { button.disabled = !!locked; });
	},

	renderCheck: function(st) {
		this.latest = st;
		var rows = [
			[ '当前固件', '%s（构建于 %s）'.format(st.current_rev || '—', fmtDate(st.current_date)) ],
			[ '最新发布', st.tag || '—' ],
			[ '发布时间', (st.published || '—').replace('T', ' ').replace(/Z$/, ' UTC') ],
			[ '固件大小', fmtSize(st.size) ],
			[ '内核版本', '%s → %s'.format(st.current_kernel || '未知', st.release_kernel || '未知') ]
		];
		this.checkBox.replaceChildren(E('table', { 'class': 'table' }, rows.map(function(row) {
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '30%' }, row[0]),
				E('td', { 'class': 'td left' }, row[1])
			]);
		})));
		if (st.kernel_match !== 1)
			this.checkBox.appendChild(E('div', { 'class': 'alert-message warning' },
				st.kernel_match === 0
					? '此版本的内核与当前系统不同，请通过原厂 Web 界面刷入完整固件。在线升级已禁用。'
					: '无法确认此版本的内核兼容性，在线升级已禁用。请检查 Release 信息。'));
		else if (st.same_base === 1)
			this.checkBox.appendChild(E('p', {}, '此版本与当前固件使用相同的 OpenWrt 源码基线，仍可能包含新的板级功能和修复。'));
	},

	handleCheck: function(force) {
		if (this.checking || this.isActive()) return Promise.resolve();
		this.checking = true;
		this.notice.textContent = '正在检查最新版本…';
		this.updateActions();
		return exec(force === true ? [ 'check', 'force' ] : [ 'check' ]).then(L.bind(function(st) {
			this.renderCheck(st);
			this.notice.textContent = '检查完成。';
		}, this)).catch(L.bind(function(e) {
			this.latest = null;
			this.notice.textContent = e.message + '。可点击「重新检查」重试。';
		}, this)).finally(L.bind(function() {
			this.checking = false;
			this.updateActions();
		}, this));
	},

	handleDownload: function() {
		if (this.busy || this.isActive() || !this.latest || this.latest.kernel_match !== 1) return;
		var mirror = this.mirrorInput.value.trim();
		if (mirror && !/^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(mirror)) {
			this.notice.textContent = '请输入以 https:// 开头的有效下载加速前缀。';
			return;
		}
		this.busy = true;
		this.updateActions();
		this.notice.textContent = '正在启动下载…';
		return exec([ 'download', this.latest.url, this.latest.sha256, mirror, this.latest.tag ]).then(L.bind(function() {
			this.notice.textContent = '下载在路由器后台进行，关闭或刷新页面后可继续查看。';
			this.renderDownload({ state: 'downloading', bytes: 0, total: this.latest.size, tag: this.latest.tag });
			return this.refreshDownload();
		}, this)).catch(L.bind(function(e) {
			this.notice.textContent = e.message;
		}, this)).finally(L.bind(function() {
			this.busy = false;
			this.updateActions();
		}, this));
	},

	refreshDownload: function() {
		if (this.statusPending) return Promise.resolve();
		this.statusPending = true;
		return exec([ 'status' ]).then(L.bind(function(st) {
			this.renderDownload(st);
		}, this)).catch(L.bind(function(e) {
			this.dlNote.textContent = '暂时无法读取进度，将自动重试：' + e.message;
		}, this)).finally(L.bind(function() { this.statusPending = false; }, this));
	},

	renderDownload: function(st) {
		var previous = this.download;
		this.download = st;
		// Preserve keyboard focus on ready-image actions during idle polling.
		if (st.state === 'done' && previous && previous.state === 'done' &&
		    st.tag === previous.tag && st.sha256 === previous.sha256 && st.have_image === previous.have_image) {
			this.updateActions();
			return;
		}
		this.flashBox.replaceChildren();
		this.dlBox.style.display = st.state === 'idle' ? 'none' : '';
		this.bar.style.display = st.state === 'downloading' || st.state === 'verifying' ? '' : 'none';
		if (st.state === 'downloading' || st.state === 'verifying') {
			var total = num(st.total), bytes = num(st.bytes),
			    pct = total > 0 ? Math.min(100, Math.floor(bytes / total * 100)) : null;
			this.dlTitle.textContent = st.state === 'verifying' ? '下载完成，正在校验固件…' : '正在下载 ' + (st.tag || '固件');
			this.barFill.style.width = pct === null ? '0%' : pct + '%';
			if (pct !== null) this.bar.setAttribute('aria-valuenow', pct);
			else this.bar.removeAttribute('aria-valuenow');
			this.dlNote.textContent = '已下载 %s%s'.format(fmtSize(bytes), total ? ' / %s（%d%%）'.format(fmtSize(total), pct) : '');
		}
		else if (st.state === 'done' && st.have_image) {
			this.dlTitle.textContent = '固件已就绪：' + (st.tag || '未知版本');
			this.dlNote.textContent = 'SHA-256 校验通过，可选择升级方式。';
			this.renderFlash(st);
		}
		else if (st.state === 'flashing') {
			this.dlTitle.textContent = '正在升级';
			this.dlNote.textContent = '正在写入固件并重启，请勿断电。';
		}
		else if (st.state !== 'idle') {
			this.dlTitle.textContent = '固件未就绪';
			this.dlNote.textContent = st.msg || '文件已丢失，请重新下载。';
		}
		this.updateActions();
		if (st.state === 'error' && this.flashing) {
			this.flashing = false;
			ui.hideModal();
			ui.addNotification(null, E('p', {}, st.msg), 'error');
		}
	},

	renderFlash: function(st) {
		this.flashBox.appendChild(E('p', {}, '本固件日常更新可保留配置；从原厂或 Mwrt 迁移时建议清除配置。'));
		this.flashBox.appendChild(E('div', { 'style': 'display:flex;gap:.5em;flex-wrap:wrap;' }, [
			E('button', { 'class': 'cbi-button cbi-button-apply', 'click': L.bind(this.handleFlash, this, false, st.sha256) }, '保留配置升级'),
			E('button', { 'class': 'cbi-button cbi-button-negative', 'click': L.bind(this.handleFlash, this, true, st.sha256) }, '清除配置升级')
		]));
	},

	handleFlash: function(reset, digest) {
		if (this.busy || this.isActive()) return;
		this.busy = true;
		this.updateActions();
		this.notice.textContent = '正在检查固件完整性与设备兼容性…';
		return exec([ 'preflight', digest ]).then(L.bind(function() {
			this.notice.textContent = '';
			ui.showModal(reset ? '清除配置并升级' : '保留配置升级', [
				E('p', {}, '将安装固件：' + this.download.tag),
				E('p', {}, reset
					? 'Wi-Fi、SIM、APN、防火墙和管理密码等设置将恢复默认。重启后请用网线连接 LAN 口，访问 192.168.1.1 重新设置。'
					: '保留现有配置，额外安装的软件包需重新安装。升级后管理地址保持不变。'),
				E('p', {}, '升级约需 2–3 分钟，期间请勿断电。'),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'btn', 'click': ui.hideModal }, '取消'), ' ',
					E('button', { 'class': 'btn cbi-button-negative', 'click': L.bind(this.doFlash, this, reset, digest) }, '确认升级')
				])
			]);
		}, this)).catch(L.bind(function(e) { this.notice.textContent = e.message; }, this)).finally(L.bind(function() {
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

	render: function(st) {
		this.latest = null;
		this.busy = false;
		this.checking = false;
		this.statusPending = false;
		this.checkBox = E('div');
		this.notice = E('p', { 'role': 'status', 'aria-live': 'polite' });
		this.mirrorInput = E('input', { 'class': 'cbi-input-text', 'type': 'url',
			'placeholder': 'https://…/', 'style': 'width:100%;max-width:32em;', 'aria-label': '下载加速前缀（可选）' });
		// This view owns the disabled state for the entire background task;
		// ui.createHandlerFn would re-enable its button after the start RPC.
		this.checkButton = E('button', { 'class': 'cbi-button', 'click': L.bind(this.handleCheck, this, true) }, '重新检查');
		this.downloadButton = E('button', { 'class': 'cbi-button cbi-button-positive', 'click': L.bind(this.handleDownload, this) }, '下载固件到路由器');
		this.dlTitle = E('h4');
		this.dlNote = E('p', { 'role': 'status' });
		this.barFill = E('div', { 'style': 'height:100%;width:0;background:#2eb872;transition:width .5s;' });
		this.bar = E('div', { 'role': 'progressbar', 'aria-label': '固件下载进度', 'aria-valuemin': '0', 'aria-valuemax': '100',
			'style': 'background:rgba(128,128,128,.2);height:16px;border-radius:4px;overflow:hidden;' }, this.barFill);
		this.dlBox = E('div', {}, [ this.dlTitle, this.bar, this.dlNote ]);
		this.flashBox = E('div');
		this.renderDownload(st);
		poll.add(L.bind(function() {
			if (document.hidden || this.busy) return Promise.resolve();
			// Active tasks update every 2s. Idle tabs still notice other sessions.
			this.idleTicks = (this.idleTicks || 0) + 1;
			if (!this.isActive() && this.download.state !== 'unknown' && this.idleTicks % 5 !== 0) return Promise.resolve();
			return this.refreshDownload();
		}, this), 2);
		this.handleCheck(false);
		return E('div', {}, [
			E('h2', {}, '在线固件更新'),
			E('p', {}, '检查 veildawn/nradio-c2000-ultra 的最新固件。下载与校验在路由器后台进行。'),
			this.checkBox,
			E('p', {}, [ '下载加速前缀（可选）', E('br'), this.mirrorInput ]),
			E('p', {}, '直连 GitHub 下载失败时可填写 HTTPS 加速前缀，固件仍按 GitHub 提供的 SHA-256 校验。'),
			E('div', { 'style': 'display:flex;gap:.5em;flex-wrap:wrap;' }, [ this.checkButton, this.downloadButton ]),
			this.notice, this.dlBox, this.flashBox
		]);
	}
});
