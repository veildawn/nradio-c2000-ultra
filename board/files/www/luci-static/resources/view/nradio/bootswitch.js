'use strict';
'require view';
'require fs';
'require ui';

function parseStatus(text) {
	var m = /mtd=(\S+)\s+boot_from_sd=(\S+)\s+\(([^)]*)\)/.exec(text || '');
	return m ? { mtd: m[1], target: m[2], desc: m[3] } : null;
}

return view.extend({
	handleSave: null,
	handleSaveApply: null,
	handleReset: null,
	load: function() {
		return fs.exec('/usr/sbin/c2000-bootswitch', [ 'status' ]);
	},

	refresh: function(container) {
		return fs.exec('/usr/sbin/c2000-bootswitch', [ 'status' ]).then(L.bind(function(res) {
			var st = parseStatus(res.stdout);
			if (st)
				this.renderStatus(container, st);
			else
				container.replaceChildren(E('div', { 'class': 'alert-message warning' },
					'无法解析启动目标状态：%s'.format((res.stderr || res.stdout || '未知错误').trim())));
		}, this));
	},

	renderStatus: function(container, st) {
		var runningOpenwrt = (st.target == '1'),
		    pendingFactory = (st.target == '0'),
		    view = this;

		var rows = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '30%' }, '下次重启进入'),
				E('td', { 'class': 'td left' }, runningOpenwrt
					? 'OpenWrt（TF 卡，boot_from_sd=1）'
					: (pendingFactory
						? '原厂固件（板载闪存，boot_from_sd=0）'
						: '未知（%s）'.format(st.target || '未设置')))
			]),
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left' }, 'U-Boot 环境分区'),
				E('td', { 'class': 'td left' }, st.mtd)
			])
		]);

		var actions = E('div', { 'style': 'margin-top:1em;display:flex;gap:.5em;flex-wrap:wrap;' });

		if (runningOpenwrt) {
			actions.appendChild(E('button', {
				'class': 'cbi-button cbi-button-negative',
				'click': ui.createHandlerFn(this, 'handleSwitchFactory')
			}, '切换到原厂系统…'));
			actions.appendChild(E('span', { 'style': 'align-self:center;color:#666;font-size:small;' },
				'写入 boot_from_sd=0 并重启后进入原厂固件；TF 卡上的 OpenWrt 与全部配置保留不动。'));
		}
		else if (pendingFactory) {
			actions.appendChild(E('div', { 'class': 'alert-message warning', 'style': 'flex:1;' }, [
				E('b', {}, '注意：'), '启动目标已设为原厂固件，',
				E('b', {}, '重启后将进入原厂系统'), '（OpenWrt 数据保留，可随时再切回）。'
			]));
			actions.appendChild(E('button', {
				'class': 'cbi-button cbi-button-negative',
				'click': ui.createHandlerFn(this, 'confirmReboot')
			}, '立即重启进入原厂系统…'));
			actions.appendChild(E('button', {
				'class': 'cbi-button cbi-button-positive',
				'click': ui.createHandlerFn(this, 'handleCancelFactory')
			}, '取消切换，保持 OpenWrt'));
		}

		container.replaceChildren(
			E('h2', {}, '双系统切换（OpenWrt ⇄ 原厂固件）'),
			E('p', {},
				'选择下次启动的系统，重启后生效。当前 OpenWrt 会继续运行，重启前可随时取消切换。'),
			rows,
			actions
		);
	},

	handleSwitchFactory: function(ev) {
		ui.showModal('切换到原厂系统', [
			E('p', {}, '即将把启动目标从 TF 卡上的 OpenWrt 切回板载闪存中的原厂固件：'),
			E('ul', {}, [
				E('li', {}, '写入 boot_from_sd=0（写入前自动校验 SPI-NOR u-boot-env CRC32）；'),
				E('li', {}, 'TF 卡上的 OpenWrt 系统与全部配置完全保留；'),
				E('li', {}, '重启后进入原厂固件，之后可在原厂 Web 界面或 SSH（c2000-bootswitch to-openwrt）再切回。')
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': ui.hideModal
				}, '取消'), ' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-negative',
					'click': ui.createHandlerFn(this, 'doSwitch', 'to-factory')
				}, '切换到原厂系统')
			])
		]);
	},

	handleCancelFactory: function(ev) {
		return this.doSwitch('to-openwrt');
	},

	doSwitch: function(action) {
		if (this.switching) return Promise.resolve();
		this.switching = true;
		return fs.exec('/usr/sbin/c2000-bootswitch', [ action ]).then(L.bind(function(res) {
			var out = ((res.stdout || '') + (res.stderr || '')).trim();

			if (res.code === 0) {
				if (action == 'to-factory') {
					this.refresh(this.statusContainer).catch(function(e) {
						ui.addNotification(null, E('p', {}, '启动目标已写入，但读取状态失败：' + e.message), 'warning');
					});
					ui.showModal('切换成功', [
						E('p', {}, out),
						E('p', {}, '重启后设备将进入原厂固件。是否立即重启？'),
						E('div', { 'class': 'right' }, [
							E('button', {
								'class': 'btn',
								'click': ui.createHandlerFn(this, function() {
									ui.hideModal();
									return this.refresh(this.statusContainer);
								})
							}, '稍后手动重启'), ' ',
							E('button', {
								'class': 'btn cbi-button cbi-button-negative',
								'click': ui.createHandlerFn(this, 'doReboot')
							}, '立即重启')
						])
					]);
				}
				else {
					ui.hideModal();
					return this.refresh(this.statusContainer);
				}
			}
			else {
				ui.showModal('切换失败', [
					E('pre', { 'style': 'white-space:pre-wrap;user-select:text;' }, out || '未知错误'),
					E('div', { 'class': 'right' }, [
						E('button', { 'class': 'btn', 'click': ui.hideModal }, '关闭')
					])
				]);
			}
		}, this)).catch(function(e) {
			ui.hideModal();
			ui.addNotification(null, E('p', {}, '执行失败：%s'.format(e.message)), 'error');
		}).finally(L.bind(function() { this.switching = false; }, this));
	},

	confirmReboot: function() {
		ui.showModal('重启进入原厂系统', [
			E('p', {}, '重启会暂时中断网络，之后请使用原厂系统的管理地址登录。'),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, '取消'), ' ',
				E('button', { 'class': 'btn cbi-button-negative', 'click': ui.createHandlerFn(this, 'doReboot') }, '确认重启')
			])
		]);
	},

	doReboot: function() {
		return fs.exec('/sbin/reboot').then(function(res) {
			if (res.code !== 0) throw new Error(res.stderr || '重启命令失败');
			ui.showModal('正在重启…', [
				E('p', {}, '设备正在进入原厂系统，约需 1 分钟。'),
				E('p', {}, '请连接原厂系统的网络并使用其管理地址登录。OpenWrt 的设置已保留。')
			]);
		}).catch(function(e) {
			ui.hideModal();
			ui.addNotification(null, E('p', {}, '未能确认重启结果，请检查设备连接：' + e.message), 'error');
		});
	},

	render: function(res) {
		var st = parseStatus(res && res.stdout);

		this.statusContainer = E('div');

		if (st)
			this.renderStatus(this.statusContainer, st);
		else
			this.statusContainer.appendChild(E('div', { 'class': 'alert-message warning' },
				'无法解析启动目标状态：%s'.format(((res && (res.stderr || res.stdout)) || '未知错误').trim())));

		return this.statusContainer;
	}
});
