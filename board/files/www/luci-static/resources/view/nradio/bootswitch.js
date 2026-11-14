'use strict';
'require view';
'require fs';
'require ui';

var BOOTSWITCH_CSS = [
	'.nr-bs{--nr-card:var(--background-color-high,#fff);--nr-subtle:var(--background-color-low,#f6f8fa);--nr-text:var(--text-color-high,#1f2328);--nr-muted:var(--text-color-medium,#656d76);--nr-border:var(--border-color-medium,rgba(128,128,128,.22));--nr-border-soft:var(--border-color-low,rgba(128,128,128,.14));--nr-primary:var(--primary-color-high,#0969da);--nr-ok:var(--success-color-high,#2eb872);--nr-warn:var(--warn-color-high,#d9822b);--nr-err:var(--error-color-high,#d9534f);color:var(--nr-text);max-width:980px}',
	':root[data-darkmode="true"] .nr-bs{--nr-card:var(--background-color-high,#24262b);--nr-subtle:var(--background-color-low,#1b1d21);--nr-text:var(--text-color-high,#e6edf3);--nr-muted:var(--text-color-medium,#9ca3af);--nr-border:var(--border-color-medium,rgba(255,255,255,.14));--nr-border-soft:var(--border-color-low,rgba(255,255,255,.08));--nr-primary:var(--primary-color-high,#4a9eff)}',
	'.nr-bs-head{margin-bottom:1rem}',
	'.nr-bs-head h2{margin:0 0 .35rem;font-size:1.35rem}',
	'.nr-bs-head p{margin:0;color:var(--nr-muted);font-size:.9rem;line-height:1.5}',
	'.nr-bs-banner{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.85rem;padding:.9rem 1.05rem;margin-bottom:1rem;border-radius:10px;border:1px solid rgba(240,173,78,.45);background:rgba(240,173,78,.12);background:color-mix(in srgb,var(--nr-warn) 13%,transparent)}',
	'.nr-bs-banner-title{font-weight:600;color:var(--nr-warn);margin-bottom:.2rem}',
	'.nr-bs-banner-desc{font-size:.86rem;color:var(--nr-text)}',
	'.nr-bs-banner-actions{display:flex;flex-wrap:wrap;gap:.5rem}',
	'.nr-bs-slots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;margin-bottom:1rem}',
	'@media(max-width:720px){.nr-bs-slots{grid-template-columns:1fr}}',
	'.nr-bs-slot{background:var(--nr-card);border:1.5px solid var(--nr-border);border-radius:12px;padding:1.1rem 1.15rem;display:flex;flex-direction:column;gap:.75rem;transition:border-color .15s}',
	'.nr-bs-slot.is-target-primary{border-color:var(--nr-primary);box-shadow:0 2px 10px rgba(9,105,218,.07)}',
	'.nr-bs-slot.is-target-warn{border-color:var(--nr-warn);box-shadow:0 2px 10px rgba(217,130,43,.1)}',
	'.nr-bs-slot-top{display:flex;align-items:flex-start;justify-content:space-between;gap:.65rem}',
	'.nr-bs-kicker{font-size:.75rem;font-family:monospace;color:var(--nr-muted);letter-spacing:.02em}',
	'.nr-bs-slot-title{margin:.2rem 0 0;font-size:1.08rem;font-weight:700}',
	'.nr-bs-badges{display:flex;flex-direction:column;align-items:flex-end;gap:.35rem;flex-shrink:0}',
	'.nr-bs-pill{display:inline-flex;align-items:center;gap:.3rem;padding:.18rem .58rem;border-radius:999px;font-size:.76rem;font-weight:600;white-space:nowrap}',
	'.nr-bs-pill.ok{color:var(--nr-ok);background:rgba(46,184,114,.14);background:color-mix(in srgb,var(--nr-ok) 15%,transparent)}',
	'.nr-bs-pill.primary{color:var(--nr-primary);background:rgba(9,105,218,.12);background:color-mix(in srgb,var(--nr-primary) 14%,transparent)}',
	'.nr-bs-pill.warn{color:var(--nr-warn);background:rgba(240,173,78,.16);background:color-mix(in srgb,var(--nr-warn) 16%,transparent)}',
	'.nr-bs-pill.muted{color:var(--nr-muted);background:var(--nr-subtle)}',
	'.nr-bs-list{margin:0;padding:.7rem 0 0 1.1rem;border-top:1px solid var(--nr-border-soft);color:var(--nr-muted);font-size:.84rem;line-height:1.65}',
	'.nr-bs-list code{font-family:monospace;color:var(--nr-text);background:var(--nr-subtle);padding:.08rem .35rem;border-radius:4px}',
	'.nr-bs-meta-card{background:var(--nr-card);border:1px solid var(--nr-border);border-radius:12px;padding:1rem 1.15rem;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem}',
	'.nr-bs-kv{display:grid;grid-template-columns:auto 1fr;gap:.35rem .9rem;font-size:.86rem}',
	'.nr-bs-kv-label{color:var(--nr-muted)}',
	'.nr-bs-kv-val{font-weight:600}',
	'.nr-bs-kv-val code{font-family:monospace;font-weight:500}'
].join('\n');

function ensureStyle() {
	if (typeof document !== 'undefined' && document.head && !document.getElementById('nr-bootswitch-css'))
		document.head.appendChild(E('style', { 'id': 'nr-bootswitch-css' }, BOOTSWITCH_CSS));
}

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
		ensureStyle();
		var runningOpenwrt = (st.target == '1'),
		    pendingFactory = (st.target == '0');

		var targetSummary = runningOpenwrt
			? 'OpenWrt（TF 卡，boot_from_sd=1）'
			: (pendingFactory
				? '原厂固件（板载闪存，boot_from_sd=0）'
				: '未知（%s）'.format(st.target || '未设置'));

		var children = [
			E('div', { 'class': 'nr-bs-head' }, [
				E('h2', {}, '双系统切换（OpenWrt ⇄ 原厂固件）'),
				E('p', {}, '通过 SPI-NOR U-Boot 环境变量选择下次重启进入的系统。两套系统的配置与数据完全隔离，切换前可随时取消。')
			])
		];

		if (pendingFactory) {
			children.push(E('div', { 'class': 'nr-bs-banner' }, [
				E('div', {}, [
					E('div', { 'class': 'nr-bs-banner-title' }, '注意：启动目标已设为原厂固件（待重启生效）'),
					E('div', { 'class': 'nr-bs-banner-desc' }, '重启后将进入原厂系统；当前 TF 卡上的 OpenWrt 仍在运行且数据完整保留，可随时取消切换。')
				]),
				E('div', { 'class': 'nr-bs-banner-actions' }, [
					E('button', {
						'class': 'cbi-button cbi-button-positive',
						'click': ui.createHandlerFn(this, 'handleCancelFactory')
					}, '取消切换，保持 OpenWrt'),
					E('button', {
						'class': 'cbi-button cbi-button-negative',
						'click': ui.createHandlerFn(this, 'confirmReboot')
					}, '立即重启进入原厂系统…')
				])
			]));
		}

		var owrtBadges = [ E('span', { 'class': 'nr-bs-pill ok' }, '● 当前运行中') ];
		if (runningOpenwrt)
			owrtBadges.push(E('span', { 'class': 'nr-bs-pill primary' }, '下次启动目标'));

		var facBadges = [
			pendingFactory
				? E('span', { 'class': 'nr-bs-pill warn' }, '⚡ 下次启动目标')
				: E('span', { 'class': 'nr-bs-pill muted' }, '待机保留')
		];

		children.push(E('div', { 'class': 'nr-bs-slots' }, [
			E('div', { 'class': 'nr-bs-slot' + (runningOpenwrt ? ' is-target-primary' : '') }, [
				E('div', { 'class': 'nr-bs-slot-top' }, [
					E('div', {}, [
						E('div', { 'class': 'nr-bs-kicker' }, 'SLOT A · TF 卡存储'),
						E('h3', { 'class': 'nr-bs-slot-title' }, 'OpenWrt 系统')
					]),
					E('div', { 'class': 'nr-bs-badges' }, owrtBadges)
				]),
				E('ul', { 'class': 'nr-bs-list' }, [
					E('li', {}, [ '启动标记：', E('code', {}, 'boot_from_sd=1') ]),
					E('li', {}, '数据隔离：系统与插件配置独立保存在 TF 卡 Overlay 分区'),
					E('li', {}, '切走后 TF 卡数据原样保留，切回即恢复全部设置')
				])
			]),
			E('div', { 'class': 'nr-bs-slot' + (pendingFactory ? ' is-target-warn' : '') }, [
				E('div', { 'class': 'nr-bs-slot-top' }, [
					E('div', {}, [
						E('div', { 'class': 'nr-bs-kicker' }, 'SLOT B · 板载闪存'),
						E('h3', { 'class': 'nr-bs-slot-title' }, 'NRadio 原厂固件')
					]),
					E('div', { 'class': 'nr-bs-badges' }, facBadges)
				]),
				E('ul', { 'class': 'nr-bs-list' }, [
					E('li', {}, [ '启动标记：', E('code', {}, 'boot_from_sd=0') ]),
					E('li', {}, [ '切回方式：原厂双系统页面或 SSH 执行 ', E('code', {}, 'c2000-bootswitch to-openwrt') ]),
					E('li', {}, '适用场景：跨内核版本完整包升级或使用原厂管理功能')
				])
			])
		]));

		var footerActions = E('div', { 'style': 'display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;' });
		if (runningOpenwrt) {
			footerActions.appendChild(E('button', {
				'class': 'cbi-button cbi-button-negative',
				'click': ui.createHandlerFn(this, 'handleSwitchFactory')
			}, '切换到原厂系统…'));
		}

		children.push(E('div', { 'class': 'nr-bs-meta-card' }, [
			E('div', { 'class': 'nr-bs-kv' }, [
				E('span', { 'class': 'nr-bs-kv-label' }, '下次重启进入'),
				E('span', { 'class': 'nr-bs-kv-val' }, targetSummary),
				E('span', { 'class': 'nr-bs-kv-label' }, 'U-Boot 环境分区'),
				E('span', { 'class': 'nr-bs-kv-val' }, [ E('code', {}, st.mtd), '（写入前自动校验 CRC32）' ])
			]),
			footerActions
		]));

		container.replaceChildren(E('div', { 'class': 'nr-bs' }, children));
	},

	handleSwitchFactory: function() {
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

	handleCancelFactory: function() {
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
		ensureStyle();
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
