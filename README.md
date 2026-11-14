# NRadio C2000 Ultra · OpenWrt

为鲲鹏 NRadio C2000 Ultra 构建的 OpenWrt 固件。基于官方 `mediatek/filogic` Snapshot，使用主线 `mt76` Wi-Fi 驱动和官方 LuCI Bootstrap。OpenWrt 从 TF 卡启动，板载原厂系统可随时切回。

[首个正式版 v1.0.0](https://github.com/veildawn/nradio-c2000-ultra/releases/tag/v1.0.0) · [下载固件](https://github.com/veildawn/nradio-c2000-ultra/releases/download/v1.0.0/openwrt-mediatek-filogic-nradio_c2000-ultra-squashfs-sysupgrade.bin) · [SHA-256 校验文件](https://github.com/veildawn/nradio-c2000-ultra/releases/download/v1.0.0/sha256sums)

首版基于 OpenWrt `r38253-e2ed57b957`，内核为 Linux `6.18.60`。适用于配备 MT7987A、MT7992 和 MT5700M-CN 的 C2000 Ultra。

## 刷机教程

### 1. 准备固件和 TF 卡

- 确认原厂固件为 **2.3.5 或以上**。本项目在原厂 **2.3.9** 上验证过第二系统烧录。
- 插入容量至少 **1 GB** 的 TF（microSD）卡。烧录会清除 TF 卡第二系统分区的数据。如果还需要在原厂页面初始化或重新分区，请先备份整张卡。
- 下载上方的 `openwrt-mediatek-filogic-nradio_c2000-ultra-squashfs-sysupgrade.bin` 和 `sha256sums`，保存到同一个目录。用以下命令校验，结果应为 `OK`：

  ```sh
  awk '/-squashfs-sysupgrade[.]bin$/' sha256sums | shasum -a 256 -c
  ```

### 2. 在原厂系统烧录 TF 卡

1. 用网线连接电脑和路由器的 **LAN** 口。在原厂系统打开 [192.168.66.1](http://192.168.66.1/)，用原厂管理密码登录。未修改过时，默认密码为 `admin`。
2. 进入 **更多 → 存储管理**。如果 **存储扩展** 已开启，先关闭，按提示重启后重新登录。确认页面已识别 TF 卡并有第二系统分区。
3. 在 **烧录第二系统** 区域点击 **上传第二系统镜像文件**，选择已校验的 `sysupgrade.bin`。
4. 核对文件名，点击 **烧入**，在清除第二系统分区的确认框里点击 **是**。烧录期间保持供电和网络连接，TF 卡留在设备内。
5. 等页面明确显示烧录成功。到 **启动设置** 选择 **第二系统优先**，确认切换并按页面提示重启。

### 3. 首次进入 OpenWrt

保持网线连接 LAN 口，等电脑通过 DHCP 获得 `192.168.1.x` 地址，再访问 [192.168.1.1](http://192.168.1.1/)。也可以连接下表的任一个默认无线网络。

| 项目 | 全新安装默认值 |
| --- | --- |
| OpenWrt 管理地址 | `http://192.168.1.1` |
| LuCI 账号 | `root`，首次登录时密码为空 |
| 2.4 GHz Wi-Fi | `NRadio-C2000-2G`，默认开启 |
| 5 GHz Wi-Fi | `NRadio-C2000-5G`，默认开启 |
| 无线密码 | 两个频段均为 `12345678`，使用 WPA2/WPA3 混合加密 |
| 有线端口 | LAN 对应 `eth1`，向客户端分配地址。WAN 对应 `eth0`，通过 DHCP 获取上游地址 |

从全新配置开始使用。首次登录后，在 **系统 → 管理权** 设置管理密码，并在 **网络 → 无线** 更改两个无线网络的初始密码。如果电脑仍是 `192.168.66.x`，重新连接网线或更新 DHCP 租约。

## 日常使用

| LuCI 菜单 | 用途 |
| --- | --- |
| **网络 → 5G 蜂窝** | 管理 SIM1、SIM2、eSIM 和 APN，查看注册状态、信号、小区、温度与流量，设置流量限额 |
| **系统 → 双系统切换** | 查看下次启动目标，切回板载原厂系统并重启。回到原厂后，可在存储管理里再次选择 **第二系统优先** |
| **系统 → 在线固件更新** | 检查 GitHub Release，将固件下载到路由器并校验 SHA-256，选择保留或清除 OpenWrt 配置后升级 |

OpenWrt 的只读根文件系统和可写 `/overlay` 均位于 TF 卡第 4 分区（`/dev/mmcblk0p4`）。板载原厂镜像在 OpenWrt 下以只读的 `factory-firmware` 分区暴露。启动保护会在分区布局不符合预期时进入 failsafe，避免使用板载配置区作为 OpenWrt 的可写层。

在线升级适用于已从原厂页面完整安装、且内核版本与待升级镜像一致的设备。在线升级更新 TF 卡第 4 分区，清除配置也只作用于 TF 卡上的 OpenWrt。跨内核版本升级时，从原厂页面重新烧录完整镜像，以更新 TF 卡上的内核和设备树。

## 构建与测试

### GitHub Actions

在 Actions 中选择 **OpenWrt ImageBuilder (NRadio C2000 Ultra)**，点击 **Run workflow**。可以通过 `extra_packages` 指定预装包，从运行结果的 **Artifacts** 下载固件。工作流运行回归测试并检查镜像元数据和设备树。 [构建工作流](.github/workflows/imagebuilder.yml)

### 本地 ImageBuilder

在 x86-64 Linux 上从本仓库根目录运行。需要 Python 3、GCC、make、curl、tar、zstd 和 OpenWrt ImageBuilder 的主机依赖。

```sh
curl -fL -o ib.tar.zst \
  https://downloads.openwrt.org/snapshots/targets/mediatek/filogic/openwrt-imagebuilder-mediatek-filogic.Linux-x86_64.tar.zst
mkdir -p ib
tar --use-compress-program=unzstd -xf ib.tar.zst -C ib --strip-components=1

python3 -B board/inject_imagebuilder.py ib
make -C ib image PROFILE=nradio_c2000-ultra FILES=files-c2000-ultra \
  PACKAGES="kmod-usb-net-cdc-ether luci luci-ssl luci-proto-ncm luci-i18n-base-zh-cn luci-i18n-firewall-zh-cn luci-i18n-package-manager-zh-cn iw-full pciutils usbutils picocom"
```

输出位于 `ib/bin/targets/mediatek/filogic/`。官方 Snapshot 会滚动更新，构建基线和内核以实际使用的 ImageBuilder 为准。

### 完整源码编译

在干净的 OpenWrt 源码树中运行以下命令。将示例里的仓库路径替换为本地实际路径。 [板级注入脚本](board/apply.py) · [默认构建配置](board/defconfig)

```sh
./scripts/feeds update -a
./scripts/feeds install -a
python3 -B /path/to/nradio-c2000-ultra/board/apply.py .
cp /path/to/nradio-c2000-ultra/board/defconfig .config
make defconfig
make -j"$(nproc)"
```

### 回归测试

```sh
python3 -m unittest discover -s tests -v
```

LuCI 浏览器用例需要 Playwright 和 Chromium。安装 `playwright>=1.50,<2` 后运行 `python3 -m playwright install chromium`。

## 仓库目录

| 路径 | 内容 |
| --- | --- |
| [board/](board/) | 设备树、源码与 ImageBuilder 注入脚本、随固件安装的板级文件 |
| [tests/](tests/) | TF 启动保护、固件更新、蜂窝状态和 LuCI 交互回归测试 |
| [docs/mt5700m/](docs/mt5700m/) | MT5700M-CN 硬件与 AT 指令参考 |
| [firmware/](firmware/) | 原厂和第三方参考固件，通过 Git LFS 管理。日常刷机请使用 Release 提供的镜像 |
