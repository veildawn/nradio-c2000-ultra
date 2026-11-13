#!/usr/bin/env python3
"""Apply the C2000 Ultra board port onto a clean OpenWrt tree."""
import shutil
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
port = Path(sys.argv[2]).resolve()

dts_dst = root / "target/linux/mediatek/dts/mt7987a-nradio-c2000-ultra.dts"
shutil.copyfile(port / "dts/mt7987a-nradio-c2000-ultra.dts", dts_dst)

files = port / "files"
base = root / "target/linux/mediatek/filogic/base-files"
for src in files.rglob("*"):
    if src.is_dir():
        continue
    rel = src.relative_to(files)
    dst = base / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)
    if src.suffix in {""} or src.name in {"mt5700-bringup", "mt5700", "99-nradio-c2000-wwan"}:
        dst.chmod(0o755)
    dst.chmod(0o755)

device = r'''
define Device/nradio_c2000-ultra
  DEVICE_VENDOR := NRadio
  DEVICE_MODEL := C2000MAX-Ultra
  DEVICE_DTS := mt7987a-nradio-c2000-ultra
  DEVICE_DTS_DIR := ../dts
  DEVICE_PACKAGES := kmod-usb3 kmod-usb-serial-option kmod-usb-net-cdc-ncm \
	comgt-ncm kmod-phy-airoha-en8811h mt7987-2p5g-phy-firmware \
	kmod-hwmon-pwmfan kmod-mt7996e kmod-mt7992-23-firmware \
	kmod-leds-gpio f2fsck mkf2fs luci luci-ssl luci-proto-ncm
  IMAGE_SIZE := 262144k
  IMAGE/sysupgrade.bin := sysupgrade-tar | append-metadata | check-size
endef
TARGET_DEVICES += nradio_c2000-ultra

'''

mk = root / "target/linux/mediatek/image/filogic.mk"
text = mk.read_text()
anchor = "define Device/nradio_c8-668gl"
if "define Device/nradio_c2000-ultra" not in text:
    if anchor not in text:
        sys.exit("filogic.mk anchor missing")
    text = text.replace(anchor, device + anchor, 1)
    mk.write_text(text)

net = root / "target/linux/mediatek/filogic/base-files/etc/board.d/02_network"
ntext = net.read_text()
lan = """\tnradio,c2000-ultra)
\t\tucidef_set_interface_lan \"eth0 eth1\"
\t\t;;
"""
if "nradio,c2000-ultra" not in ntext:
    needle = "\tairpi,ap3000m|\\\n"
    if needle not in ntext:
        sys.exit("02_network lan anchor missing")
    ntext = ntext.replace(needle, lan + needle, 1)
    mac = """\tnradio,c2000-ultra)
\t\tlan_mac=$(macaddr_generate_from_mmc_cid mmcblk0)
\t\twan_mac=$(macaddr_add \"$lan_mac\" 1)
\t\tlabel_mac=$lan_mac
\t\t;;
"""
    mneedle = "\thiveton,h5000m)\n"
    if mneedle not in ntext:
        sys.exit("02_network mac anchor missing")
    ntext = ntext.replace(mneedle, mac + mneedle, 1)
    net.write_text(ntext)

plat = root / "target/linux/mediatek/filogic/base-files/lib/upgrade/platform.sh"
ptext = plat.read_text()
if "nradio,c2000-ultra" not in ptext:
    upgrade = """\tnradio,c2000-ultra)
\t\tCI_DATAPART=\"rootfs_data\"
\t\tCI_KERNPART=\"kernel_2nd\"
\t\tCI_ROOTPART=\"rootfs_2nd\"
\t\temmc_do_upgrade \"$1\"
\t\t;;
"""
    pneedle = "\tnradio,c8-668gl)\n"
    if ptext.count(pneedle) < 1:
        sys.exit("platform upgrade anchor missing")
    ptext = ptext.replace(pneedle, upgrade + pneedle, 1)
    ptext = ptext.replace(
        "\thiveton,h5000m|\\\n\tnradio,c8-668gl)",
        "\thiveton,h5000m|\\\n\tnradio,c2000-ultra|\\\n\tnradio,c8-668gl)",
        1,
    )
    ptext = ptext.replace(
        "\tnradio,c8-668gl|\\\n",
        "\tnradio,c2000-ultra|\\\n\tnradio,c8-668gl|\\\n",
        1,
    )
    plat.write_text(ptext)

ncm = root / "package/network/utils/comgt/files/ncm.json"
ncm_text = ncm.read_text()
if '"tdtech"' not in ncm_text:
    start = ncm_text.index('\t"huawei": ')
    end = ncm_text.index('\t"samsung": ')
    block = ncm_text[start:end]
    ncm_text = (
        ncm_text[:end]
        + block.replace('"huawei"', '"tdtech"', 1)
        + block.replace('"huawei"', '"td"', 1)
        + ncm_text[end:]
    )
    ncm.write_text(ncm_text)

print("applied")
