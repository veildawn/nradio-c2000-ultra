# NRadio C2000 Ultra 固件

## 目标

给鲲鹏 NRadio C2000 Ultra（MT7987A，Wi-Fi 7，MT5700M 5G）编一份自己的可刷机固件。

- 基线是 chasey-dev `immortalwrt-mt798x-rebase` 的 `25.12-dev-wifi7`，提交 `4ab9dab`。闭源 Wi-Fi 7 驱动只在这条分支上。
- 内核用 Linux **6.12.117**。这是 6.12 长期分支的最新版本。社区树自带的 6.12.112 不再作为成品内核。
- 刷机包要能 sysupgrade 到现在这块 TF 卡上的三方 OpenWrt：`PARTLABEL=rootfs`，compat 1.0，板名 `NRadio-C2000MAX-798` / `NRadio-C2000MAX-Ultra` / `NRadio-C2000Ultra`。
- 内存按参考固件为 256 MiB。LAN 是 `eth1 hnat`，WAN 是 `eth0`。内核加载地址 `0x40080000`，与三方 FIT 一致。

主线稳定版 7.3.4 和长期版 6.18.63 的设备树里没有 MT7987。这块板的以太网、HNAT 和 Wi-Fi 7 驱动都在 6.12 的补丁上。所以“最新内核”落到 6.12.117，由我们自己把补丁改到能打上，而不是退回社区的 6.12.112。

## 现状

固件还没有编出来。没有 `sysupgrade.bin`。

虚拟机里的源码树在 Colima 数据盘 `/mnt/lima-colima/owrt/immortalwrt`，相对 `4ab9dab` 的改动在 `patches/immortalwrt-6.12.117.diff`。

已经放进树里的板级内容：

- 设备树 `mt7987a-nradio-c2000ultra.dts`（256 MiB，`root=PARTLABEL=rootfs`，`cpe-sel0` 输出 1）
- `filogic-ext.mk` 里的 `Device/nradio_c2000ultra`（sysupgrade tar，compat 1.0）
- `platform.sh` 与 `02_network`
- Wi-Fi 7 / OSAL 的 6.12 补丁

6.12.117 补丁移植还没走完。检查树上大约 900 个补丁已经按顺序打上，还剩大约 144 个没处理。已经改过或拿掉的冲突：

- `732`、`788`：6.12.117 里已经有同样的改动，从系列里去掉
- `750`：2500Base-X 无自协商，按 6.12.117 的 lynxi 错误处理重写
- phylink `neg_mode` 两个补丁：去掉尚不存在的 `an8855.c`，并改 lynxi 调用点
- `999-eth-07`：NAPI 提前注册已经在 6.12.117 里，只保留 `mtk_napi_del`
- `999-eth-91`：HNAT 的错误路径改到当前的 `mtk_probe`
- `999-pcs-01`：pextp reset 的重试块改到当前的 `get_state`
- 若干只改 MT7981/MT7986 参考板、且目标文件在 6.12.117 中不存在的 DTS 补丁已移出系列。本机是 MT7987，不靠那些文件启动

工具链曾经在 6.12.112 上编过。切回 6.12.117 之后那次编译已经停掉，避免继续编错内核。

原厂包 `C2000Ultra_2.3.9.bin` 和三方包 `Mwrt-c2000ultra-tf-1159-24-20261108.bin` 留在本机根目录，不放进仓库。

## 下一步

把剩下的 6.12.117 补丁冲突改完，确认 `make target/linux/prereq` 能打完内核补丁，然后只编 `nradio_c2000ultra` 的 sysupgrade。
