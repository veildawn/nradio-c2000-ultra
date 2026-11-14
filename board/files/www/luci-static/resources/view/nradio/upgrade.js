'use strict';
'require view';
'require fs';
'require ui';

var REPO = 'veildawn/nradio-c2000-ultra';

function num(v) {
	var n = parseInt(v, 10);
	return isNaN(n) ? null : n;
}

function fmtDate(v) {
	var d = new Date(num(v) * 1000);
	return isNaN(d.getTime()) ? String(v || '—') : '%d-%02d-%02d %02d:%02d'.format(
		d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes());
}

function fmtSize(b) {
	var n = num(b);
	if (n === null || n <= 0) return '—';
	return (n >= 1048576) ? '%.1f MB'.format(n / 1048576) : '%d KB'.format(Math.max(1, n / 1024));
}

function exec(args) {
	return fs.exec('/usr/sbin/c2000-upgrade', args).then(function(res) {
		try {
			return JSON.parse(res.stdout);
		}
		catch (e) {
			throw new Error('解析升级助手输出失败：%s'.format((res.stderr || res.stdout || e.message).trim()));
		}
	});
}

return view.extend({
	load: function() {
		return Promise.all([
			exec([ 'check' ]),
			exec([ 'status' ])
		]).then(function(rs) {
			return { check: rs[0], dl: rs[1] };
		});
	},

	checkBox: E('div', { 'style': 'margin:1em 0;' }),
	dlBox: E('div', { 'style': 'margin:1em 0;display:none;' }),
	flashBox: E('div', { 'style': 'margin:1em 0;display:none;' }),

	renderCheck: function(st) {
		var nodes = [];
		var cur = '%s（构建于 %s）'.format(st.current_rev || '?', fmtDate(st.current_date));

		nodes.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left', 'width': '30%' }, '当前固件'),
			E('td', { 'class': 'td left' }, cur)
		]));

		if (st.error) {
			nodes.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left' }, '检查结果'),
				E('td', { 'class': 'td left' }, [ E('div', { 'class': 'alert-message warning' }, st.error) ])
			]));
		}
		else {
			var badge = (st.same_base == 1)
				? E('span', { 'class': 'label', 'style': 'background:#2eb872;color:#fff;padding:2px 8px;border-radius:3px;' }, '同源码版本')
				: (st.same_base == -1)
					? E('span', { 'class': 'label', 'style': 'background:#999;color:#fff;padding:2px 8px;border-radius:3px;' }, '版本无法比较')
					: E('span', { 'class': 'label', 'style': 'background:#f0ad4e;color:#fff;padding:2px 8px;border-radius:3px;' }, '有新构建');
				nodes.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left' }, '最新 Release'),
				E('td', { 'class': 'td left' }, [
					E('b', {}, st.tag || '—'), ' ', badge, E('div', {
						'style': 'font-size:small;color:#666;'
					}, '发布：%s ｜ 固件：%s ｜ 基于 %s%s'.format(
						(st.published || '—').replace('T', ' ').replace(/Z$/, ' UTC'),
						fmtSize(st.size), st.rev || '—',
						st.sha256 ? ' ｜ SHA-256：' + st.sha256.slice(0, 12) + '…' : ''))
				])
			]));
			this.latest = st;
		}

		this.checkBox.replaceChildren(E('table', { 'class': 'table' }, nodes));

		var actions = [];
		if (!st.error && st.url) {
			this.mirrorInput = E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'placeholder': '下载加速前缀（可选，如 https://ghfast.top/）',
				'style': 'width:280px;margin-right:.5em;'
			});
			actions.push(E('div', { 'style': 'margin-bottom:.6em;font-size:small;color:#666;' }, [
				'github.com 直连不通时填写加速前缀（固件完整性始终以 GitHub API 提供的 SHA-256 摘要校验，与下载途径无关）：',
				E('br'),
				this.mirrorInput
			]));
		}
		actions.push(E('div', {}, [
			E('button', {
				'class': 'cbi-button cbi-button-neutral important',
				'click': ui.createHandlerFn(this, 'handleCheck')
			}, '重新检查'),
			' ',
			(!st.error && st.url) ? E('button', {
				'class': 'cbi-button cbi-button-positive important',
				'click': ui.createHandlerFn(this, 'handleDownload')
			}, '下载固件到路由器') : E('span', { 'style': 'color:#999;' }, '（无可用固件资产）')
		]));
		this.checkBox.appendChild(E('div', { 'style': 'margin-top:1em;' }, actions));
	},

	handleCheck: function() {
		var btns = this.checkBox.querySelectorAll('button');
		for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
		this.checkBox.appendChild(E('div', { 'style': 'margin-top:.6em;color:#666;' }, '正在查询 GitHub…'));
		return exec([ 'check' ]).then(L.bind(function(st) {
			this.renderCheck(st);
		}, this));
	},

	handleDownload: function() {
		var st = this.latest;
		if (!st || !st.url) return;
		var mirror = this.mirrorInput ? (this.mirrorInput.value || '').trim() : '';
		this.dlBox.style.display = '';
		this.bar = this.bar || E('div', { 'style': 'background:rgba(128,128,128,.2);border-radius:4px;height:16px;overflow:hidden;margin:.5em 0;' });
		this.barFill = this.barFill || E('div', { 'style': 'height:100%;width:0;background:#2eb872;transition:width .5s;' });
		this.bar.replaceChildren(this.barFill);
		this.dlBox.replaceChildren(E('h4', {}, '正在下载固件…'), this.bar);
		return exec([ 'download', st.url, st.sha256 || '', mirror, st.tag || '' ]).then(L.bind(function() {
			this.pollDownload(0);
		}, this));
	},

	pollDownload: function(retry) {
		return exec([ 'status' ]).then(L.bind(function(st) {
			if (st.state == 'downloading') {
				var pct = (this.latest && num(this.latest.size) > 0)
					? Math.min(100, Math.round(100 * num(st.bytes) / num(this.latest.size))) : null;
				if (this.barFill) {
					if (pct !== null) this.barFill.style.width = '%d%%'.format(pct);
					else this.barFill.style.width = '100%';
				}
				if (this.dlLabel) this.dlLabel.remove();
				this.dlLabel = E('div', { 'style': 'font-size:small;color:#666;' },
					'已下载 %s%s'.format(fmtSize(st.bytes), (pct !== null) ? '（%d%%）'.format(pct) : ''));
				this.dlBox.appendChild(this.dlLabel);
				window.setTimeout(L.bind(function() { this.pollDownload(0); }, this), 2000);
			}
			else if (st.state == 'done' && st.have_image) {
				this.dlBox.replaceChildren(
					E('h4', {}, '下载完成'),
					E('div', { 'class': 'alert-message success' },
						'SHA-256 校验通过：%s'.format((st.sha256 || '').slice(0, 16) + '…'))
				);
				this.renderFlash(st.tag);
			}
			else if (st.state == 'error') {
				this.dlBox.replaceChildren(
					E('h4', {}, '下载失败'),
					E('div', { 'class': 'alert-message danger' }, st.msg || '未知错误')
				);
			}
			else if (retry < 3) {
				window.setTimeout(L.bind(function() { this.pollDownload(retry + 1); }, this), 1500);
			}
		}, this));
	},

	renderFlash: function(dlTag) {
		this.flashBox.style.display = '';
		/* Bind the staged image to the release it came from: a leftover
		 * image from an older release must not be flashed while the page
		 * advertises the metadata of a newer one. */
		var stale = (this.latest && dlTag && this.latest.tag && dlTag != this.latest.tag);
		if (stale) {
			this.flashBox.replaceChildren(
				E('h4', {}, '已下载固件版本不匹配'),
				E('div', { 'class': 'alert-message warning' },
					'/tmp 中的固件来自旧 Release「%s」，而当前最新为「%s」。请点击上方「下载固件到路由器」重新获取。'.format(dlTag, this.latest.tag))
			);
			return;
		}
		this.flashBox.replaceChildren(
			E('h4', {}, '选择升级方式'),
			E('div', { 'style': 'display:flex;gap:.5em;flex-wrap:wrap;' }, [
				E('button', {
					'class': 'cbi-button cbi-button-apply important',
					'click': ui.createHandlerFn(this, 'handleFlash', false)
				}, '保留配置升级'),
				E('button', {
					'class': 'cbi-button cbi-button-negative important',
					'click': ui.createHandlerFn(this, 'handleFlash', true)
				}, '不保留配置升级（推荐）')
			]),
			E('p', { 'style': 'font-size:small;color:#666;max-width:640px;' },
				'说明：从原厂 / Mwrt / 早期版本迁移时，旧 /etc/config 残留会破坏 SSH、Wi-Fi 与 5G 拨号（本仓库实测），' +
				'因此跨系统升级建议选择「不保留配置」；从本固件在线更新到新构建时，保留配置一般安全。')
		);
	},

	handleFlash: function(nok) {
		var args = [ 'preflight' ];
		return exec(args).then(L.bind(function(pf) {
			if (pf.ready != 1) {
				ui.showModal('无法升级', [
					E('p', {}, pf.msg || '固件未就绪'),
					E('div', { 'class': 'right' }, E('button', { 'class': 'btn', 'click': ui.hideModal }, '关闭'))
				]);
				return;
			}

			var body, confirmTxt;
			if (nok) {
				confirmTxt = '清除配置并升级';
				body = [
					E('p', {}, [ E('b', {}, '将清除全部配置并刷入新固件：'), '相当于 sysupgrade -n。' ]),
					E('ul', {}, [
						E('li', {}, '所有设置（Wi-Fi、SIM、防火墙等）恢复默认，需重新配置；'),
						E('li', {}, 'TF 卡上的系统与 LuCI 数据一并重置；'),
						E('li', {}, '升级期间切勿断电，约 2–3 分钟后自动重启。')
					])
				];
			}
			else {
				confirmTxt = '保留配置升级';
				body = [
					E('p', {}, [ E('b', {}, '保留现有配置刷入新固件：'), '相当于 sysupgrade（不带 -n）。' ]),
					E('ul', {}, [
						E('li', {}, 'Wi-Fi、SIM、APN、防火墙等配置全部保留；'),
						E('li', {}, '若从原厂 / Mwrt 或很旧的版本升级，残留配置可能导致 SSH / Wi-Fi / 拨号异常（此时可再刷一次并选择不保留）；'),
						E('li', {}, '升级期间切勿断电，约 2–3 分钟后自动重启。')
					])
				];
			}
			body.push(E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, '取消'), ' ',
				E('button', {
					'class': 'btn cbi-button %s'.format(nok ? 'cbi-button-negative' : 'cbi-button-apply'),
					'click': ui.createHandlerFn(this, 'doFlash', nok)
				}, confirmTxt)
			]));
			ui.showModal(nok ? '不保留配置升级' : '保留配置升级', body);
		}, this));
	},

	doFlash: function(nok) {
		var path = '/tmp/c2000-upgrade-sysupgrade.bin',
		    args = nok ? [ '-n', path ] : [ path ];
		ui.showModal('正在升级…', [
			E('p', {}, '正在写入固件并重启（约 2–3 分钟），请勿断电。'),
			E('p', { 'style': 'color:#666;font-size:small;' },
				'重启后请刷新本页。若长时间未恢复，可通过 SSH 或原厂双系统界面检查。')
		]);
		/* sysupgrade never returns; fire and forget */
		fs.exec('/sbin/sysupgrade', args).catch(function() {});
		window.setTimeout(function() { window.location.reload(true); }, 180000);
	},

	render: function(data) {
		this.latest = null;
		this.renderCheck(data.check);
		if (data.dl && data.dl.state == 'done' && data.dl.have_image) {
			this.dlBox.style.display = '';
			this.dlBox.replaceChildren(
				E('h4', {}, '固件已就绪'),
				E('div', { 'class': 'alert-message success' },
					'SHA-256 校验通过：%s…（/tmp 已有下载好的固件）'.format((data.dl.sha256 || '').slice(0, 16)))
			);
			this.renderFlash(data.dl.tag);
		}
		return E('div', {}, [
			E('h2', {}, '在线固件更新'),
			E('p', {},
				'检查并升级到 GitHub 仓库 %s 的最新 Release（官方 OpenWrt Snapshot 基线构建）。'.format(REPO)),
			this.checkBox,
			this.dlBox,
			this.flashBox
		]);
	}
});
