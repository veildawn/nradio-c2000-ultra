# NRadio C2000 Ultra

## 目标

给鲲鹏 NRadio C2000 Ultra（MT7987A，Wi-Fi 7，MT5700M 5G）编一份能刷进现有 TF 卡的 sysupgrade 固件。

刷机布局跟现在跑着的三方系统一致：

- GPT 分区 `PARTLABEL=rootfs`，ustar sysupgrade tar，compat 1.0
- 现有系统接受的板名：`NRadio-C2000MAX-798`、`NRadio-C2000MAX-Ultra`、`NRadio-C2000Ultra`
- 内存 256 MiB，地址 `0x40000000`
- 内核加载地址 `0x40080000`，与现有 FIT 一致
- WAN 是 eth0（Airoha EN8811H，MDIO 11），LAN 是 eth1（片内 2.5G PHY）
- TF/SD 是 mmc0，4-bit，不是 eMMC
- `cpe-sel0`（pio48）输出 1，`cpe-pwr`（pio49）输出 0

## 结论

基线改为官方 OpenWrt `main`，提交 `24c13d7`，内核 6.18。不再使用 chasey-dev `immortalwrt-mt798x-rebase` 的 `25.12-dev-wifi7`（`4ab9dab`），也不再移植闭源 `mt_wifi7`。

官方树里已经有 MT7987 的时钟、引脚、以太网、2.5G PHY、PWM，以及主线 mt76。Wi-Fi 用 `kmod-mt7996e` 和 `kmod-mt7992-firmware`。kernel.org 的 6.18.63 和 7.3.4 没有 `pinctrl-mt7987.c`、`clk-mt7987.c`；6.18.63 的 mt76 已经登记 MT7990 / MT7992 / MT7996。能启动这块 SoC 的最新内核是 OpenWrt 自带补丁的 6.18，不是未打补丁的 7.3.4。

没有厂商 HNAT。gmac2 保持关闭。镜像是 `sysupgrade-tar | append-metadata`，`SUPPORTED_DEVICES` 带上旧板名，让现在的 Mwrt 能收下这个包。

## 现状

虚拟机里的树在 `/mnt/lima-colima/owrt/openwrt`。设备树、`filogic.mk`、`platform.sh`、`02_network` 已经写进这棵树。`./scripts/feeds update -a` 还在克隆 packages。日志是 `build/openwrt.log`。还没有新的 `sysupgrade.bin`。

仓库里这份板级设备树是 `board/mt7987a-nradio-c2000ultra.dts`。chasey 的 6.12.117 补丁和旧移植脚本在 `archive/`，不再继续。

## 目录

- `firmware/factory/`：原厂 `C2000Ultra_2.3.9.bin`（31 MiB）
- `firmware/third-party/`：三方 `Mwrt-c2000ultra-tf-1159-24-20261108.bin`（140 MiB，Git LFS）
- `firmware/earlier/`：仓库里原先那份 sysupgrade，不是这次的编译结果
- `docs/mt5700m/`：MT5700M 文档
- `docs/flash/`：刷机教程
- `board/`：当前板级设备树
- `archive/chasey-6.12.117/`：已放弃的 chasey 移植
- `archive/openwrt-port/`：更早的一份移植草稿
- `build/`：本机编译日志和拆包，不入库
