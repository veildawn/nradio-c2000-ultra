#!/usr/bin/env python3
"""Apply the NRadio C2000 Ultra board port onto an official OpenWrt main tree."""

import json
import os
import re
import shutil
import sys
from pathlib import Path


EXEC_DIRS = {"init.d", "uci-defaults", "sbin", "bin"}


def copy_board_files(files_dir: Path, base_files: Path) -> None:
    if not files_dir.is_dir():
        return
    for src in sorted(files_dir.rglob("*")):
        if src.is_dir():
            continue
        rel = src.relative_to(files_dir)
        dst = base_files / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        if any(part in EXEC_DIRS for part in rel.parts):
            dst.chmod(0o755)
        else:
            dst.chmod(0o644)
    for d in sorted(base_files.rglob("*")):
        if d.is_dir():
            d.chmod(0o755)


def main() -> None:
    os.umask(0o022)
    if len(sys.argv) < 2:
        sys.exit(f"Usage: {sys.argv[0]} <openwrt-dir> [board-dir]")

    root = Path(sys.argv[1]).resolve()
    board_dir = (
        Path(sys.argv[2]).resolve()
        if len(sys.argv) >= 3
        else Path(__file__).resolve().parent
    )

    # 1. Copy board DTS
    dts_src = board_dir / "mt7987a-nradio-c2000ultra.dts"
    dts_dst = root / "target/linux/mediatek/dts/mt7987a-nradio-c2000ultra.dts"
    shutil.copyfile(dts_src, dts_dst)

    # 2. Copy board base-files (MT5700M-CN manager, hotplug, gcom, UCI defaults)
    copy_board_files(
        board_dir / "files",
        root / "target/linux/mediatek/filogic/base-files",
    )

    # 3. Register or update Device/nradio_c2000-ultra in filogic.mk
    device_block = """define Device/nradio_c2000-ultra
  DEVICE_VENDOR := NRadio
  DEVICE_MODEL := C2000 Ultra
  DEVICE_DTS := mt7987a-nradio-c2000ultra
  DEVICE_DTS_DIR := ../dts
  SUPPORTED_DEVICES += NRadio-C2000MAX-798 NRadio-C2000MAX-Ultra NRadio-C2000Ultra
  KERNEL_LOADADDR := 0x40080000
  DEVICE_PACKAGES := kmod-usb3 kmod-usb-serial-option kmod-usb-net-cdc-ether \\
\tkmod-usb-net-cdc-ncm kmod-usb-net-huawei-cdc-ncm kmod-usb-net-rndis \\
\tkmod-usb-net-qmi-wwan comgt-ncm uqmi \\
\tkmod-phy-airoha-en8811h airoha-en8811h-firmware \\
\tmt7987-2p5g-phy-firmware kmod-hwmon-pwmfan \\
\tkmod-mt7996e kmod-mt7992-23-firmware kmod-mt7992-firmware \\
\te2fsprogs f2fsck mkf2fs kmod-fs-f2fs uboot-envtools zram-swap
  IMAGE/sysupgrade.bin := sysupgrade-tar | append-metadata
endef
TARGET_DEVICES += nradio_c2000-ultra

"""
    mk_path = root / "target/linux/mediatek/image/filogic.mk"
    mk_text = mk_path.read_text()
    existing_dev_re = re.compile(
        r"define Device/nradio_c2000-ultra\n.*?TARGET_DEVICES \+= nradio_c2000-ultra\n+",
        re.S,
    )
    if existing_dev_re.search(mk_text):
        mk_text = existing_dev_re.sub(device_block, mk_text, count=1)
    else:
        anchor = "define Device/nradio_c8-668gl"
        if anchor not in mk_text:
            sys.exit("ERROR: anchor missing in filogic.mk")
        mk_text = mk_text.replace(anchor, device_block + anchor, 1)
    mk_path.write_text(mk_text)

    # 4. Update 02_network (LAN=eth1 internal 2.5G, WAN=eth0 EN8811H, strict unicast MACs)
    net_path = root / "target/linux/mediatek/filogic/base-files/etc/board.d/02_network"
    net_text = net_path.read_text()

    if "\tnradio,c2000-ultra|\\\n" not in net_text:
        if_anchor = "\topenembed,som7981|\\\n\topenwrt,one)\n\t\tucidef_set_interfaces_lan_wan eth1 eth0"
        if if_anchor not in net_text:
            sys.exit("ERROR: eth1/eth0 anchor missing in 02_network")
        net_text = net_text.replace(
            if_anchor,
            "\tnradio,c2000-ultra|\\\n" + if_anchor,
            1,
        )

    mac_block = (
        "\tnradio,c2000-ultra)\n"
        "\t\t. /lib/functions/nradio-c2000.sh\n"
        "\t\tlan_mac=$(c2000_get_base_mac)\n"
        '\t\t[ -n "$lan_mac" ] && wan_mac=$(macaddr_add "$lan_mac" 1)\n'
        "\t\tlabel_mac=$lan_mac\n"
        "\t\t;;\n"
    )
    existing_mac_re = re.compile(
        r"\tnradio,c2000-ultra\)\n.*?\t\t;;\n(?=\tnradio,c8-668gl\))",
        re.S,
    )
    if existing_mac_re.search(net_text):
        net_text = existing_mac_re.sub(mac_block, net_text, count=1)
    else:
        mac_anchor = "\tnradio,c8-668gl)\n"
        if mac_anchor not in net_text:
            sys.exit("ERROR: mac anchor missing in 02_network")
        net_text = net_text.replace(mac_anchor, mac_block + mac_anchor, 1)
    net_path.write_text(net_text)

    # 4b. Update 11_fix_wifi_mac (override template 00:0c:43:* & multicast EEPROM MACs)
    wifi_mac_path = (
        root
        / "target/linux/mediatek/filogic/base-files/etc/hotplug.d/ieee80211/11_fix_wifi_mac"
    )
    wifi_mac_text = wifi_mac_path.read_text()
    wifi_mac_block = (
        "\tnradio,c2000-ultra)\n"
        "\t\t. /lib/functions/nradio-c2000.sh\n"
        '\t\tcur_mac=$(cat /sys${DEVPATH}/macaddress 2>/dev/null)\n'
        '\t\tif ! c2000_mac_is_valid_unicast "$cur_mac"; then\n'
        "\t\t\tbase_mac=$(c2000_get_base_mac)\n"
        '\t\t\tif [ -n "$base_mac" ]; then\n'
        '\t\t\t\t[ "$PHYNBR" = "0" ] && macaddr_add "$base_mac" 2 > /sys${DEVPATH}/macaddress\n'
        '\t\t\t\t[ "$PHYNBR" = "1" ] && macaddr_add "$base_mac" 3 > /sys${DEVPATH}/macaddress\n'
        "\t\t\tfi\n"
        "\t\tfi\n"
        "\t\t;;\n"
    )
    existing_wifi_re = re.compile(
        r"\tnradio,c2000-ultra\)\n.*?\t\t;;\n(?=\tnradio,c8-668gl\))",
        re.S,
    )
    if existing_wifi_re.search(wifi_mac_text):
        wifi_mac_text = existing_wifi_re.sub(wifi_mac_block, wifi_mac_text, count=1)
    else:
        wifi_anchor = "\tnradio,c8-668gl)\n"
        if wifi_anchor not in wifi_mac_text:
            sys.exit("ERROR: anchor missing in 11_fix_wifi_mac")
        wifi_mac_text = wifi_mac_text.replace(
            wifi_anchor, wifi_mac_block + wifi_anchor, 1
        )
    wifi_mac_path.write_text(wifi_mac_text)

    # 4c. Register nradio,c2000-ultra in uboot-envtools mediatek_filogic if present
    ubenv_path = root / "package/boot/uboot-envtools/files/mediatek_filogic"
    if ubenv_path.is_file():
        ubenv_text = ubenv_path.read_text()
        if "nradio,c2000-ultra" not in ubenv_text and "teltonika,rutc50|\\\n" in ubenv_text:
            ubenv_text = ubenv_text.replace(
                "teltonika,rutc50|\\\n",
                "nradio,c2000-ultra|\\\nteltonika,rutc50|\\\n",
                1,
            )
            ubenv_path.write_text(ubenv_text)

    # 5. Update platform.sh (GPT kernel/rootfs emmc upgrade + ustar check + copy_config)
    plat_path = root / "target/linux/mediatek/filogic/base-files/lib/upgrade/platform.sh"
    plat_text = plat_path.read_text()
    if "nradio,c2000-ultra" not in plat_text:
        do_anchor = "\thuasifei,wh3000-pro-emmc|\\\n"
        if do_anchor not in plat_text:
            sys.exit("ERROR: platform_do_upgrade anchor missing in platform.sh")
        plat_text = plat_text.replace(
            do_anchor,
            do_anchor + "\tnradio,c2000-ultra|\\\n",
            1,
        )

        chk_anchor = "\thiveton,h5000m|\\\n\tnradio,c8-668gl)"
        if chk_anchor not in plat_text:
            sys.exit("ERROR: platform_check_image anchor missing in platform.sh")
        plat_text = plat_text.replace(
            chk_anchor,
            "\thiveton,h5000m|\\\n\tnradio,c2000-ultra|\\\n\tnradio,c8-668gl)",
            1,
        )

        cfg_anchor = "\tnradio,c8-668gl|\\\n"
        if cfg_anchor not in plat_text:
            sys.exit("ERROR: platform_copy_config anchor missing in platform.sh")
        plat_text = plat_text.replace(
            cfg_anchor,
            "\tnradio,c2000-ultra|\\\n" + cfg_anchor,
            1,
        )
        plat_path.write_text(plat_text)

    # 6. Configure comgt ncm.json with verified 5G NR profile for TD Tech MT5700M-CN
    ncm_path = root / "package/network/utils/comgt/files/ncm.json"
    ncm_data = json.loads(ncm_path.read_text())
    mt5700m_profile = {
        "initialize": [
            "AT",
            "ATQ0",
            "ATV1",
            "ATE1",
            "ATS0=0",
            "AT+CFUN=1",
            r'AT+CGDCONT=${profile},\"${pdptype}\"${apn:+,\"$apn\"}',
        ],
        "modes": {
            "prefer5g": r'AT^SYSCFGEX=\"080302\",3fffffff,1,2,7fffffffffffffff,,',
            "5g": r'AT^SYSCFGEX=\"08\",3fffffff,1,2,7fffffffffffffff,,',
            "preferlte": r'AT^SYSCFGEX=\"0302\",3fffffff,1,2,7fffffffffffffff,,',
            "lte": r'AT^SYSCFGEX=\"03\",3fffffff,1,2,7fffffffffffffff,,',
            "umts": r'AT^SYSCFGEX=\"02\",3fffffff,1,2,7fffffffffffffff,,',
            "auto": r'AT^SYSCFGEX=\"080302\",3fffffff,1,2,7fffffffffffffff,,',
        },
        "connect": r'AT^NDISDUP=${profile},1${apn:+,\"$apn\"}${username:+,\"$username\",\"$password\"${auth:+,$auth}}',
        "disconnect": "AT^NDISDUP=${profile},0",
    }
    for alias in (
        "td-mt5700m",
        "tdtech-mt5700m",
        "huawei-mt5700m",
        '"td-mt5700m',
        '"tdtech-mt5700m',
        '"huawei-mt5700m',
        "td",
        "tdtech",
        "huawei",
        '"td',
        '"tdtech',
        '"huawei',
        "hisilicon",
    ):
        ncm_data[alias] = mt5700m_profile
    ncm_path.write_text(json.dumps(ncm_data, indent="\t") + "\n")

    print("Successfully applied NRadio C2000 Ultra port to", root)


if __name__ == "__main__":
    main()
