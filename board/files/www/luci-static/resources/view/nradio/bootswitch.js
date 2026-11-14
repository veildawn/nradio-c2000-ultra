'use strict';
'require view';
'require fs';
'require ui';

function parseStatus(text) {
	var m = /mtd=(\S+)\s+boot_from_sd=(\S+)\s+\(([^)]*)\)/.exec(text || '');
	return m ? { mtd: m[1], target: m[2], desc: m[3] } : null;
}

return view.extend({
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
				E('td', { 'class': 'td left', 'width': '30%' }, '当前启动目标'),
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
				'class': 'cbi-button cbi-button-positive',
				'click': ui.createHandlerFn(this, 'handleCancelFactory')
			}, '取消切换，保持 OpenWrt'));
		}

		container.replaceChildren(
			E('h2', {}, '双系统切换（OpenWrt ⇄ 原厂固件）'),
			E('p', {},
				'C2000 Ultra 的 U-Boot 通过 SPI-NOR u-boot-env 中的 boot_from_sd 选择启动系统。' +
				'切换前会自动校验环境分区 CRC32，校验失败将拒绝写入。'),
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
		return fs.exec('/usr/sbin/c2000-bootswitch', [ action ]).then(L.bind(function(res) {
			var out = ((res.stdout || '') + (res.stderr || '')).trim();

			if (res.code === 0) {
				if (action == 'to-factory') {
					ui.showModal('切换成功', [
						E('p', {}, out),
						E('p', {}, '重启后设备将进入原厂固件。是否立即重启？'),
						E('div', { 'class': 'right' }, [
							E('button', {
								'class': 'btn',
								'click': ui.createHandlerFn(this, function() {
									ui.hideModal();
									this.refresh(this.statusContainer);
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
					this.refresh(this.statusContainer);
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
		});
	},

	doReboot: function() {
		return fs.exec('/sbin/reboot').catch(function() {}).then(function() {
			ui.showModal('正在重启…', [
				E('p', {}, '设备正在重启并进入原厂固件，约 1 分钟后完成。'),
				E('p', { 'style': 'color:#666;font-size:small;' },
					'之后如需回到 OpenWrt，请在原厂系统执行双系统切换，或使用 SSH：c2000-bootswitch to-openwrt && reboot。')
			]);
			window.setTimeout(function() { window.location.reload(true); }, 90000);
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
