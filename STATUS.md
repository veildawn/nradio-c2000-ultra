# NRadio C2000 Ultra (OpenWrt Official Snapshot / Linux 6.18)

## 目标与基线

为鲲鹏 **NRadio C2000 Ultra**（MediaTek `MT7987A` + `MT7992` BE5040 Wi-Fi 7 + 海思/鼎桥 `MT5700M-CN` 5G）构建基于**社区官方开源标准**的可直刷 `sysupgrade` 固件：

- **上游基线**：官方 OpenWrt `main` Snapshot（`r38246-24c13d794c`，Linux `6.18.60`），严格不使用 `chasey-dev` 分支或闭源 `mt_wifi7` 驱动
- **在线软件源兼容**：内核 `vermagic`（`0011ea4d08f27770cb30251cb10b1094`）与 `downloads.openwrt.org` 官方 `mediatek/filogic` Snapshot 完全一致，刷入后可直接 `apk update && apk add` 安装官方仓库全部 `kmod-*` 与软件包
- **刷机兼容**：未签名 `ustar` 格式 `sysupgrade-tar | append-metadata`（`compat_version = 1.0`），FIT 加载/入口地址 `0x40080000`，`SUPPORTED_DEVICES` 同时包含 `nradio,c2000-ultra`、`NRadio-C2000MAX-798`、`NRadio-C2000MAX-Ultra`、`NRadio-C2000Ultra`，兼容原厂双系统 Web UI（`sysupgrade-opensource`）与三方 `Mwrt` `sysupgrade`

## 硬件逆向与适配核验

| 子系统 | 关键硬件参数与适配实现 | 状态 |
| --- | --- | --- |
| SoC / 存储 / 双系统 | `MT7987A`（实机 `1 GiB` DDR4 动态映射，系统可用 `987 MiB` + `zram-swap` `50%` 自适应 `493 MiB` `lzo-rle` / `swappiness=100`），`mmc0` 4-bit TF 卡（`PARTLABEL=rootfs`），`spi2` NOR 6 分区（`BL2` / `u-boot-env` / `Factory` / `bdinfo` / `FIP` / `firmware`），`uboot-envtools` 严格 CRC32 校验探测 + `c2000-bootswitch` 一键安全切换原厂/OpenWrt 双系统 | 已验证 |
| 双 2.5G 网口 | `LAN = eth1`（片内 2.5G PHY `phy@f` + `mt7987-2p5g-phy-firmware`），`WAN = eth0`（Airoha `EN8811H` `phy@b`，`pio42` 复位 + `airoha-en8811h-firmware`），严格单播 MAC 校验与 `bdinfo` `fac_mac` 派生 | 已验证 |
| Wi-Fi 7 (`MT7992`) | 开源 `mt76`（`kmod-mt7996e` + `kmod-mt7992-23-firmware`），`&pcie0` 复位 `pio38`（`100ms`），读取 `Factory` `0x0..0x1e00` 校准数据；默认 `country=CN`（解锁 160MHz/DFS 与完整功率），严格校验单播 MAC 并自动派生 `2.4G (+2)` / `5G (+3)` `macaddr_base`（修复 `00:0c:43:*` 模板 MAC 及 `0b:00:43:*` 组播脏 MAC 导致无法桥接 `br-lan` 的问题） | 已验证 |
| 5G 蜂窝 (`MT5700M-CN`) | USB `3466:3301`（6.18 主线 `option` + `cdc_ether`/`cdc_ncm`），禁用 USB 自动挂起、`cpe-pwr`（`pio49` 低有效）冷断电自愈、热重启 USB 2.0 → USB 3.0（`5000M`）一次性重训练、NVRAM 异常模式自愈（`AT^SETMODE` 保留原厂双系统 `1` 并修复 `6/7/8`，修复 `AT^TDCFG` E5/IP 直通残留与 `AT^C5GOPTION` 5G SA 锁死）、`ncm.sh` 串口并发避让、三路 SIM 切换（外置 SIM1 / SIM2 / 内置 eSIM）、四大运营商 APN 自动配置、`fw4` WAN 域与单 `/64` IPv6 `odhcpd` `ndp='relay'` 中继 | 已验证 |
| 散热与指示灯 | `reg_fan`（`pio5` 低有效供电开关）+ `&pwm 1` 静音温控曲线（`65 / 75 / 85 °C` 对应 `31% / 59% / 100%`，`<65 °C` 停转）+ `AT^CHIPTEMP?` 5G 模组高温联动提速（`>=72 °C`），前面板状态灯 / 5G 灯（`blue:indicator-0`）/ 4G 灯（`blue:indicator-1`）/ 氛围灯（`&pwm 0`） | 已验证 |

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
