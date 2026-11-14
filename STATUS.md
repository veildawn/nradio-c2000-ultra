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
| 5G 蜂窝 (`MT5700M-CN`) | USB `3466:3301`（6.18 主线 `option` + `cdc_ether`/`cdc_ncm`），禁用 USB 自动挂起、`cpe-pwr`（`pio49` 低有效）冷断电自愈、热重启 USB 2.0 → USB 3.0（`5000M`）一次性重训练、NVRAM 异常模式自愈（`AT^SETMODE` 保留原厂双系统 `1` 并修复 `6/7/8`，修复 `AT^TDCFG` E5/IP 直通残留与 `AT^C5GOPTION` 5G SA 锁死）、`ncm.sh` 串口并发避让、三路 SIM 切换（外置 SIM1 / SIM2 / 内置 eSIM）、四大运营商 APN 自动配置、`fw4` WAN 域与单 `/64` IPv6 `odhcpd` `ndp='relay'` 中继 | 端到端已验证（2026-11-14）：eSIM 自动检测（IMSI `460060`（联通）→APN `3gnet`）、`C5GREG: 2,1` + `AcT=11` **NR 5GC 注册成功**、`^HCSQ: "NR"` 实测 RSRP `-83 ~ -89 dBm` / SINR `+13 ~ +27 dB`、`wwan_4` CGNAT `10.x.x.x` + `wwan_6` 全球单栈 `2408:*` 双栈上线、三卡槽 UI 切换与自动探测恢复闭环实测通过 |
| 散热与指示灯 | `reg_fan`（`pio5` 低有效供电开关）+ `&pwm 1` 静音温控曲线（`65 / 75 / 85 °C` 对应 `31% / 59% / 100%`，`<65 °C` 停转）+ `AT^CHIPTEMP?` 5G 模组高温联动提速（`>=72 °C`），前面板状态灯 / 5G 灯（`blue:indicator-0`）/ 4G 灯（`blue:indicator-1`）/ 氛围灯（`&pwm 0`）。实测 `66.3 °C` 时风扇自动起步 `pwm1=80/255 ≈ 31%`（hwmon `pwmfan`），曲线精确生效 | 已验证 |

## LuCI 前端（`luci-app-nradio-c2000`，随 `board/files/` 预装进固件）

| 页面 | 功能 | 实现要点 |
| --- | --- | --- |
| 网络 → **5G 蜂窝**（Tab 化：总览 / 小区与信号 / SIM 与 QoS / 流量统计 / 设置） | 总览：模组/SIM/信号条/双栈/温度/IMEI/连接时长；小区与信号：`^MONSC` 驻留小区（NR SSB 频点/SCS/Cell ID/PCI/TAC + 实值 RSRP/RSRQ/SINR，LTE/WCDMA 同）+ `^HCSQ` 分制式解码；SIM 与 QoS：`^DSAMBR` 签约速率（实测联通 NR 下行 1 Gbps / 上行 200 Mbps + 签约 APN）、`+CGEQOSRDP` QCI/5QI（23.203 特性表）、PDP 双栈地址、已激活承载；流量统计：日/账期/累计持久化账目（`/tmp` 累计 + NOR ≤10min/1MiB 检查点防磨损）、会话级流量（按 wwan_4 uptime 重定基）、实时速率曲线、月度限额（MB）+ 账期重置日（1–31，短月按月末）+ 超限动作（仅提醒/断开蜂窝直至下账期，实机验证自动断开与恢复）；设置：SIM 槽位/APN/网络模式（自动/仅 5G/仅 4G，`^SYSCFGEX` 幂等）/USB3/NVRAM/高温联动/巡检间隔 | `modem.js` 10 秒轮询 `/usr/sbin/mt5700-status`；限额与账期由 UCI `mt5700` 配置、守护进程执行（清零经 UCI marker，保持 status 只读） |
| 系统 → **双系统切换** | 当前启动目标展示、一键切回原厂固件（确认弹窗 + 待重启警告 + 一键取消切回 + 可选立即重启） | `bootswitch.js` 经 rpcd ACL 受控执行 `c2000-bootswitch`，写入前自动校验 `u-boot-env` CRC32 |
| 系统 → **在线固件更新** | 检查本仓库 GitHub Release（版本/摘要对比，同源码基线绿色徽章）、下载固件到 `/tmp`（进度条、失败后重新下载、可选下载加速前缀）、SHA-256 校验、「保留配置升级」与「不保留配置升级（推荐）」双模式一键 sysupgrade | `c2000-upgrade`（check/download/status/preflight）：完整性锚点取自 `api.github.com` 资产 `digest` 字段（与下载途径解耦）；后台 `setsid` worker 下载规避 rpcd 超时；升级弹窗内置本机迁移风险提示（原厂/Mwrt 残留配置破坏 SSH/Wi-Fi/拨号的实测教训） |

在线更新实测记录（2026-11-14，联通 5G 出口）：`api.github.com` 可达（含 IPv6 AAAA）；`github.com` release 下载域名全系 v4-only 且直连被墙——页面提供可选「下载加速前缀」（如 `https://ghfast.top/`，实测免费通道限速 ~10 KB/s 不可用，其他网络环境/有线 WAN 直连即可）；固件完整性始终以 API digest 校验（实测 ghfast 镜像内容哈希与 API digest 一致）。刷新页面自动恢复已下载就绪态。

**在线升级通道（OpenWrt 自身 sysupgrade）根因修复**：上游 `emmc_do_upgrade` 依赖 `find_mmc_part` 按 uevent `PARTNAME` 解析分区，而 TF 卡 GPT 分区不暴露该属性 → `EMMC_ROOT_DEV` 为空 → **写分区被整体跳过、仅重启**（本机此前全部经原厂 Web 刷入，该路径从未被触发过）。修复为 nradio 专有分支直写 `EMMC_ROOT_DEV=/dev/mmcblk0p4`（`root=PARTLABEL=rootfs` 实际所在，`/proc/self/mountinfo` 179:4 实证），kernel 分区 `mmcblk0p3`（原厂 boot 镜像格式，仅原厂刷机工具会重新打包 FIT）不动——因此**跨内核版本的 Release 会被在线更新页拒绝**（Release 名携带 `Linux <ver>` 与 `uname -r` 比对），需走原厂 Web 刷入。`-n` 不保留配置升级在分支内追加 `mtd erase rootfs_data` 清 NOR overlay（否则旧 `/etc/config` 会存活）。注意：保留配置升级会重建 overlay 且仅恢复 `/etc`——对 overlay 的任何热修改都不会存活，修复必须进固件。首个完整自升级版本 **`v2026.11.14-5-r38246`**（`v3`/`v4` 为 tag 误打在旧 main 的退化构建，已删除）；上游 ImageBuilder 已滚动至 `r38253-e2ed57b957`（内核 vermagic `0011ea4d...` 不变，在线升级兼容）。截至该版本，全部 15 条 PR review 意见（5×P1、10×P2）已修复并实机验证。

状态数据链路（注网被拒与 NR 双场景实机验证）：`mt5700-bringup` 每周期在持锁段开头执行一次只读 AT 批量采集（`/etc/gcom/mt5700-status.gcom`）写 `/tmp/mt5700.status.raw`；`mt5700-status` 默认只读 stamp（零 AT 竞争）；仅显式 CLI `mt5700-status --refresh` 在锁空闲且没有拨号任务时直采。一致性语义参考原厂 ROM「按需实时查询」：切卡瞬间删除 stamp、`SLOT_STAMP` 晚于数据即判过渡态、CPIN 空且非过渡判「未检测到 SIM 卡」、stamp 超过 2×巡检间隔数值降级为「—」——UI 永不拿过期数据冒充当前状态。

MT5700M-CN AT/gcom 实测坑（均已内置规避）：Balong AT 解析器不接受背靠背命令（必须逐条交互采集）；gcom 脚本字面 `send` 中 `^X` 是控制符转义（`^` 命令必须经 `$env()` 传入）；`+CSQ` 在 NR 模式返回空（信号以 `^HCSQ` 为准）；busybox 无 `stat(1)`（用 `date -r` 取 mtime）；`jsonfilter` 布尔输出 `true/false`、带连字符键名需 `@['ipv4-address']` 引号语法；gcom 偶发退出段错误（按输出内容判有效性）。守护进程新增 **mkdir 原子锁防双实例**（实测事故：procd SIGKILL 后 D 状态孤儿与 respawn 新实例竞争 tick 锁）。

## 新增功能效率与交互优化（待新固件实机验证）

此轮修改覆盖蜂窝状态、在线更新和双系统切换，尚未构建或刷入设备；下面是代码行为与模拟回归结果，不替代上方版本的实机记录。

- **蜂窝状态**：Web 轮询不再触发最长 40 秒的串口采集；后台快照通过临时文件加 rename 原子发布。12 组 AT 字段解析管道合并为一次 shell 遍历，wwan 主接口状态只读取一次，温控复用本周期已采集的温度。页面隐藏时暂停查询；请求失败清除旧的连接结论，过期温度不再显示为实时值。
- **蜂窝设置**：保留总览、小区、SIM/QoS、流量和设置五个页面页签，常用/流量限额/高级选项分栏，增加手动刷新和 APN 字符检查，说明「保存并应用」后的等待过程；关闭蜂窝功能时显示明确的关闭状态。
- **在线更新**：先显示本地状态，再查询 GitHub；版本信息缓存 5 分钟，手动重新检查强制刷新。页面恢复下载进度、显示校验阶段，进度总大小取自下载任务本身。失败显示原因并允许重试；就绪固件始终显示其实际 Release 标签。
- **升级一致性**：下载、校验和提交升级共用互斥锁；状态原子更新。后端将 URL/摘要/标签绑定到 GitHub API 元数据，拒绝未知或不一致的内核；升级前以及最终确认时验证摘要、所选固件与 `sysupgrade -T` 兼容性。清除配置时明确提示 LAN 口及 `192.168.1.1`，提交后等待设备重新上线。
- **双系统切换**：显示「下次重启进入」，待切换状态保留重启和取消入口；去掉无意义的保存栏，重启错误明确反馈。

验证命令：

```bash
# Python 标准库执行后端回归；浏览器用例需以下可选依赖
python3 -m pip install 'playwright>=1.50,<2'
python3 -m playwright install chromium
python3 -m unittest discover -s tests -v
```

`tests/` 使用临时目录中的假网络、JSON 接口及 sysupgrade 命令验证下载/校验/互斥与故障恢复；Chromium 用真实页面脚本配合 LuCI RPC/表单替身验证交互。CI 同时运行这些测试、每个 shell 文件的语法检查与 JavaScript 语法检查。仍需在设备上验证三卡槽切换、温控曲线、弱网下载和保留/清除配置的实际升级闭环。

## 实测记录（2026-11-14，r38246 实机诊断）

- **原厂配置迁移引发的故障**（净刷前）：原厂 Web UI 刷机保留 `/etc/config` 后——SSH `Connection refused`（原厂 `firewall` 遗留 `lan→22 REJECT`，dropbear 正常运行）、Wi-Fi 全灭（原厂 `mtkwifi` radio0/radio1 死配置 + 真实射频 iface 被禁）、`AT^NDISDUP` 反复 `Error running AT-command` 死循环（wwan 15s 重试刷爆日志）。`firstboot -y` 后以上全部消失
- **净刷后验证通过**：fw4 规则加载、LAN DHCP、Wi-Fi 7 双频广播及 EHT 2×2 关联、风扇温控、zram、TF 四分区、双系统 bootswitch、mt5700-bringup 全链路（见上表）
- **2026-11-14 追加（LuCI 前端联调）**：`luci-app-nradio-c2000` 两个页面上机实测——5G NR 注册恢复（`C5GREG AcT=11`，RSRP `-83 dBm`）、三卡槽 UI 切换闭环（sim1 无卡→如实显示「未检测到 SIM 卡」→切回 auto 自动探测恢复 eSIM 并重新拨号）、双系统切换全链路（写入 `boot_from_sd=0` → 待重启警告 → UI 取消切回 `1`，全程 5G 在线）
- **遗留排查项**：无上游网络时 sysntpd 不同步、时钟慢约一天（注网上游通了自愈）；root 密码净刷后为空，需第一时间设置

## 编译与定制打包方式

固件默认使用官方 LuCI 的 Bootstrap 主题。5G 蜂窝、应用管控、双系统切换和在线固件更新仍可从 LuCI 菜单打开。

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
