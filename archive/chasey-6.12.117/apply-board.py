#!/usr/bin/env python3
"""Add the C2000 Ultra board to a chasey-dev ImmortalWrt 25.12 tree."""

import shutil
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
HERE = Path(__file__).resolve().parent
def insert_before(path: Path, needle: str, addition: str) -> None:
    text = path.read_text()
    if addition + needle in text:
        print(f"already patched {path} at {needle!r}")
        return
    if needle not in text:
        raise SystemExit(f"anchor not found in {path}: {needle!r}")
    path.write_text(text.replace(needle, addition + needle, 1))
    print(f"patched {path}")


def main() -> None:
    dts_dir = ROOT / "target/linux/mediatek/dts-ext"
    dts_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(
        HERE / "board/mt7987a-nradio-c2000ultra.dts",
        dts_dir / "mt7987a-nradio-c2000ultra.dts",
    )

    wifi_src = HERE / "board/mtk-wifi-patches"
    for driver in ("mt_wifi7", "mt_wifi_osal"):
        src = wifi_src / "drivers" / driver / "patches"
        dst = ROOT / "package/mtk/drivers" / driver / "patches"
        if not dst.is_dir():
            print(f"skip wifi patches, missing {dst}")
            continue
        for patch in sorted(src.glob("*.patch")):
            target = dst / patch.name
            if not target.exists():
                shutil.copyfile(patch, target)
                print(f"wifi patch {target.relative_to(ROOT)}")

    kernel = ROOT / "target/linux/generic/kernel-6.12"
    kernel_text = kernel.read_text()
    kernel.write_text(
        "LINUX_VERSION-6.12 = .117\n"
        "LINUX_KERNEL_HASH-6.12.117 = 74e99aa5e60e242e0a165fed8cb2ea0d054bf7a401f01861d403d75733456613\n"
    )
    print(f"kernel was:\n{kernel_text.strip()}")

    ext = ROOT / "target/linux/mediatek/image/filogic-ext.mk"
    ext_text = ext.read_text()
    if "Device/nradio_c2000ultra" not in ext_text:
        ext.write_text(
            ext_text.rstrip()
            + """

define Device/nradio_c2000ultra
  DEVICE_VENDOR := NRadio
  DEVICE_MODEL := C2000MAX-Ultra
  DEVICE_DTS := mt7987a-nradio-c2000ultra
  DEVICE_DTS_DIR := ../dts-ext
  SUPPORTED_DEVICES := NRadio-C2000MAX-798 NRadio-C2000MAX-Ultra NRadio-C2000Ultra
  DEVICE_PACKAGES := kmod-usb3 kmod-usb-net-cdc-ncm kmod-usb-net-huawei-cdc-ncm \\
	kmod-usb-serial-option kmod-hwmon-pwmfan kmod-mt798x-2p5g-phy \\
	kmod-phy-airoha-en8811h airoha-en8811h-firmware e2fsprogs f2fsck mkf2fs
  KERNEL_LOADADDR := 0x48000000
  KERNEL := kernel-bin | lzma | fit lzma $$(KDIR)/image-$$(firstword $$(DEVICE_DTS)).dtb
  KERNEL_INITRAMFS := kernel-bin | lzma | \\
	fit lzma $$(KDIR)/image-$$(firstword $$(DEVICE_DTS)).dtb with-initrd | pad-to 64k
  IMAGE/sysupgrade.bin := sysupgrade-tar | append-metadata
endef
TARGET_DEVICES += nradio_c2000ultra
"""
        )
        print("added device profile")

    names = (
        "\tNRadio-C2000MAX-Ultra|\\\n"
        "\tNRadio-C2000Ultra|\\\n"
        "\tNRadio-C2000MAX-798|\\\n"
    )
    platform = ROOT / "target/linux/mediatek/filogic/base-files/lib/upgrade/platform.sh"
    insert_before(platform, "\tsl,3000-emmc|\\\n", names)
    insert_before(platform, "\tnradio,c8-668gl|\\\n", names)
    insert_before(
        platform,
        "\tsl,3000-emmc|\\\n\tnradio,c8-668gl|\\\n",
        names,
    )

    network = ROOT / "target/linux/mediatek/filogic/base-files/etc/board.d/02_network"
    arm = (
        "\tcase $board in\n"
        "\tNRadio-C2000MAX-Ultra|NRadio-C2000Ultra|NRadio-C2000MAX-798)\n"
        '\t\tucidef_set_interfaces_lan_wan "eth1 hnat" eth0\n'
        "\t\t;;\n"
    )
    net = network.read_text()
    if arm not in net:
        needle = "\tcase $board in\n"
        if needle not in net:
            raise SystemExit("network case anchor missing")
        network.write_text(net.replace(needle, arm, 1))
    print("network layout set")


if __name__ == "__main__":
    main()
