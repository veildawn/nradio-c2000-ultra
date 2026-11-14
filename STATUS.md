# NRadio C2000 Ultra (OpenWrt Official Snapshot / Linux 6.18)

## 目标与基线

为鲲鹏 **NRadio C2000 Ultra**（MediaTek `MT7987A` + `MT7992` BE5040 Wi-Fi 7 + 海思/鼎桥 `MT5700M-CN` 5G）构建基于**社区官方开源标准**的可直刷 `sysupgrade` 固件：

- **上游基线**：官方 OpenWrt `main` Snapshot（`r38246-24c13d794c`，Linux `6.18.60`），严格不使用 `chasey-dev` 分支或闭源 `mt_wifi7` 驱动
- **在线软件源兼容**：内核 `vermagic`（`0011ea4d08f27770cb30251cb10b1094`）与 `downloads.openwrt.org` 官方 `mediatek/filogic` Snapshot 完全一致，刷入后可直接 `apk update && apk add` 安装官方仓库全部 `kmod-*` 与软件包
- **刷机兼容**：未签名 `ustar` 格式 `sysupgrade-tar | append-metadata`（`compat_version = 1.0`），FIT 加载/入口地址 `0x40080000`，`SUPPORTED_DEVICES` 同时包含 `nradio,c2000-ultra`、`NRadio-C2000MAX-798`、`NRadio-C2000MAX-Ultra`、`NRadio-C2000Ultra`，兼容原厂双系统 Web UI（`sysupgrade-opensource`）与三方 `Mwrt` `sysupgrade`
- **刷机勿保留原厂配置**：原厂 Web UI `sysupgrade-opensource` 默认保留 `/etc/config`，迁移后原厂残留会直接破坏系统——实测 `firewall` 中遗留 `src=lan dest_port=22 target=REJECT` 规则导致 SSH 全程 `Connection refused`（dropbear 本身正常）、原厂 `mtkwifi` 死配置（radio0/radio1）顶替真实 `mac80211` 射频且其 wifi-iface 全被禁用（Wi-Fi 全灭）、ATE 工厂测试端口 `50001` 对 WAN 放行、`nrswitch`/`cpe1(odu)`/`vpn` 等死节点。**务必以 `sysupgrade -n` 刷入或刷后执行 `firstboot -y && reboot`**
- **净刷后默认网络布局**：`LAN = eth1`（`br-lan` 仅含 `eth1`，IP `192.168.1.1/24`，DHCP 由 dnsmasq 下发）、`WAN = eth0`（dhcp 客户端，默认启用；`ifstatus wan` 需上游有 DHCP 服务器才 up）。`WAN` 口不对外下发地址——电脑插 `eth0` 拿不到 IP 是插错口，不是故障；LAN IP 只有迁移原厂配置时才是 `192.168.66.1`

## 硬件逆向与适配核验

| 子系统 | 关键硬件参数与适配实现 | 状态 |
| --- | --- | --- |
| SoC / 存储 / 双系统 | `MT7987A`（实机 `1 GiB` DDR4 动态映射（系统可用 `987 MiB`）+ `zram-swap` 实测 `493 MiB ≈ 50%` `lzo-rle` / `swappiness=100`），`mmc0` 4-bit TF 卡 4 分区（GPT，实测 `5G/1M/128M/9.4G`，`PARTLABEL=rootfs`），`spi2` NOR 实测 9 分区：固定 `BL2(256K)` / `u-boot-env(64K)` / `Factory(1M)` / `bdinfo(512K)` / `FIP(1M)` + `firmware(29.2M)` 动态拆分 `kernel(3.4M)` / `rootfs(26.7M)` / `rootfs_data(1.7M)`；`boot_from_sd=1` 时以 `root=PARTLABEL=rootfs` 从 TF 卡挂 squashfs `/rom`，overlay 固定落 NOR `rootfs_data`（mtd8）；`c2000-bootswitch` 自带 mtd1 CRC32 解析一键切换（实测 `boot_from_sd=1 (openwrt-sd)`）。注：旧版镜像 `/etc/fw_env.config` 为空导致标准 `fw_setenv` 不可用，仓库 HEAD 已由 `25-nradio-c2000-ubootenv` 修复 | 已验证 |
| 双 2.5G 网口 | `LAN = eth1`（片内 2.5G PHY `phy@f` + `mt7987-2p5g-phy-firmware`），`WAN = eth0`（Airoha `EN8811H` `phy@b`，`pio42` 复位 + `airoha-en8811h-firmware`），严格单播 MAC 校验与 `bdinfo` `fac_mac` 派生（净刷实测 `eth1=fac_mac`、`eth0=fac_mac+1` 由 `02_network` 写入 uci；内核早期 `mtk_soc_eth` 随机 MAC 的 kern.err 日志会被 uci macaddr 覆盖，无害） | 已验证 |
| Wi-Fi 7 (`MT7992`) | 开源 `mt76`（`kmod-mt7996e` + `kmod-mt7992-23-firmware`），`&pcie0` 复位 `pio38`（`100ms`），读取 `Factory` `0x0..0x1e00` 校准数据；默认 `country=CN`（解锁 160MHz/DFS 与完整功率），严格校验单播 MAC 并自动派生 `2.4G (+2)` / `5G (+3)` `macaddr_base`（修复 `00:0c:43:*` 模板 MAC 及 `0b:00:43:*` 组播脏 MAC 导致无法桥接 `br-lan` 的问题）。净刷后射频遵循上游默认策略**禁用**（`radio0/radio1 disabled=1`），需手动启用；启用后单 phy 双频 `phy0.0-ap0`(2.4G)/`phy0.1-ap0`(5G)，实测 MAC 派生正确、iPhone 以 `EHT-MCS11/80MHz/2×2 = 1200 Mbps`（`-39 dBm`）稳定关联 | 已验证 |
| 5G 蜂窝 (`MT5700M-CN`) | USB `3466:3301`（6.18 主线 `option` + `cdc_ether`/`cdc_ncm`），禁用 USB 自动挂起、`cpe-pwr`（`pio49` 低有效）冷断电自愈、热重启 USB 2.0 → USB 3.0（`5000M`）一次性重训练、NVRAM 异常模式自愈（`AT^SETMODE` 保留原厂双系统 `1` 并修复 `6/7/8`，修复 `AT^TDCFG` E5/IP 直通残留与 `AT^C5GOPTION` 5G SA 锁死）、`ncm.sh` 串口并发避让、三路 SIM 切换（外置 SIM1 / SIM2 / 内置 eSIM）、四大运营商 APN 自动配置、`fw4` WAN 域与单 `/64` IPv6 `odhcpd` `ndp='relay'` 中继 | bringup 链路已验证：eSIM 自动检测（实测 IMSI 前缀 `460060`（联通）→APN `3gnet`）、USB3 重训练 `5000M`、`AT^NDISDUP` 拨号返回 OK。端到端未通：本机注网被拒（`CEREG: 2,3` / `C5GREG: 3`、`CSQ≈8`），仅驻留 3G，待天线/实体 SIM/eSIM 帐号排查 |
| 散热与指示灯 | `reg_fan`（`pio5` 低有效供电开关）+ `&pwm 1` 静音温控曲线（`65 / 75 / 85 °C` 对应 `31% / 59% / 100%`，`<65 °C` 停转）+ `AT^CHIPTEMP?` 5G 模组高温联动提速（`>=72 °C`），前面板状态灯 / 5G 灯（`blue:indicator-0`）/ 4G 灯（`blue:indicator-1`）/ 氛围灯（`&pwm 0`）。实测 `66.3 °C` 时风扇自动起步 `pwm1=80/255 ≈ 31%`（hwmon `pwmfan`），曲线精确生效 | 已验证 |

## 实测记录（2026-11-14，r38246 实机诊断）

- **原厂配置迁移引发的故障**（净刷前）：原厂 Web UI 刷机保留 `/etc/config` 后——SSH `Connection refused`（原厂 `firewall` 遗留 `lan→22 REJECT`，dropbear 正常运行）、Wi-Fi 全灭（原厂 `mtkwifi` radio0/radio1 死配置 + 真实射频 iface 被禁）、`AT^NDISDUP` 反复 `Error running AT-command` 死循环（wwan 15s 重试刷爆日志）。`firstboot -y` 后以上全部消失
- **净刷后验证通过**：fw4 规则加载、LAN DHCP、Wi-Fi 7 双频广播及 EHT 2×2 关联、风扇温控、zram、TF 四分区、双系统 bootswitch、mt5700-bringup 全链路（见上表）
- **遗留排查项**：5G 注网被拒（`CEREG/C5GREG = 3`，弱信号，待天线与实体 SIM 交叉验证）；无上游网络时 sysntpd 不同步、时钟慢约一天（注网上游通了自愈）；root 密码净刷后为空，需第一时间设置

## 编译与定制打包方式

### 方式一：官方 ImageBuilder 极速定制打包（推荐，约 30 秒）

使用 `board/inject_imagebuilder.py` 可将板级 DTB、`0x40080000` FIT 内核与板级脚本直接注入官方 OpenWrt Snapshot `mediatek/filogic` ImageBuilder：

```bash
curl -fL -o ib.tar.zst \
  https://downloads.openwrt.org/snapshots/targets/mediatek/filogic/openwrt-imagebuilder-mediatek-filogic.Linux-x86_64.tar.zst
mkdir -p ib && tar --use-compress-program=unzstd -xf ib.tar.zst -C ib --strip-components=1

umask 022
python3 board/inject_imagebuilder.py ib
make -C ib image \
  PROFILE="nradio_c2000-ultra" \
  PACKAGES="kmod-usb-net-cdc-ether luci luci-ssl luci-proto-ncm luci-i18n-base-zh-cn luci-i18n-firewall-zh-cn luci-i18n-package-manager-zh-cn iw-full pciutils usbutils picocom" \
  FILES="files-c2000-ultra"
```

仓库已内置 GitHub Actions 工作流 `.github/workflows/imagebuilder.yml`，支持在网页端手动输入自定义软件包列表并一键生成 Artifact 或 GitHub Release。

### 方式二：完整 OpenWrt 主线源码编译

```bash
git clone https://github.com/openwrt/openwrt.git
cd openwrt
./scripts/feeds update -a && ./scripts/feeds install -a
python3 /path/to/nradio-c2000-ultra/board/apply.py .
cp /path/to/nradio-c2000-ultra/board/defconfig .config
make defconfig
make -j"$(nproc)"
```

## 目录结构

- `board/mt7987a-nradio-c2000ultra.dts`：OpenWrt 6.18 板级设备树
- `board/files/`：板级预置脚本（`mt5700-bringup`、Wi-Fi MLD MAC 修正、`uci-defaults` 等）
- `board/inject_imagebuilder.py`：官方 OpenWrt Filogic ImageBuilder 注入与 FIT 内核合成工具
- `board/apply.py` / `board/defconfig`：OpenWrt `main` 完整源码树一键打补丁脚本与默认配置
- `.github/workflows/imagebuilder.yml`：GitHub Actions 在线定制固件与自动发版工作流
- `firmware/`：原厂 `C2000Ultra_2.3.9.bin` 与三方参考固件（Git LFS）
- `docs/`：MT5700M 硬件/AT 手册与刷机说明
- `archive/`：早期归档草稿（不再使用）
- `build/`：本地编译与发布暂存目录（`.gitignore` 忽略，不入库）
