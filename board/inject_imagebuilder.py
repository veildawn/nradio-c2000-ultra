#!/usr/bin/env python3
"""Inject NRadio C2000 Ultra support into an upstream OpenWrt Filogic ImageBuilder.

Note: An ImageBuilder built directly with CONFIG_IB=y after running board/apply.py
already includes nradio_c2000-ultra out of the box. This helper is for patching a
generic upstream OpenWrt Snapshot mediatek/filogic ImageBuilder archive.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


DEVICE_PACKAGES = [
    "kmod-usb3",
    "kmod-usb-serial-option",
    "kmod-usb-net-cdc-ether",
    "kmod-usb-net-cdc-ncm",
    "kmod-usb-net-huawei-cdc-ncm",
    "kmod-usb-net-rndis",
    "kmod-usb-net-qmi-wwan",
    "comgt-ncm",
    "uqmi",
    "kmod-phy-airoha-en8811h",
    "airoha-en8811h-firmware",
    "mt7987-2p5g-phy-firmware",
    "kmod-hwmon-pwmfan",
    "kmod-mt7996e",
    "kmod-mt7992-23-firmware",
    "kmod-mt7992-firmware",
    "e2fsprogs",
    "f2fsck",
    "mkf2fs",
    "kmod-fs-f2fs",
    "uboot-envtools",
    "zram-swap",
]

EXEC_DIRS = {"init.d", "uci-defaults", "sbin", "bin"}


def copy_tree(src_dir: Path, dst_dir: Path) -> None:
    for src in sorted(src_dir.rglob("*")):
        if src.is_dir():
            continue
        rel = src.relative_to(src_dir)
        dst = dst_dir / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        dst.chmod(0o755 if any(p in EXEC_DIRS for p in rel.parts) else 0o644)


def main() -> None:
    os.umask(0o022)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ib_dir", type=Path, help="Extracted OpenWrt ImageBuilder directory")
    parser.add_argument(
        "--board-dir",
        type=Path,
        default=Path(__file__).resolve().parent,
        help="Path to board/ directory (default: alongside this script)",
    )
    parser.add_argument(
        "--dtb",
        type=Path,
        default=None,
        help="Path to precompiled image-mt7987a-nradio-c2000ultra.dtb",
    )
    parser.add_argument(
        "--linux-include",
        type=Path,
        default=None,
        help="Optional Linux kernel include/ directory to compile DTS if --dtb is omitted",
    )
    args = parser.parse_args()

    ib = args.ib_dir.resolve()
    board_dir = args.board_dir.resolve()

    kdirs = sorted(ib.glob("build_dir/target-*/linux-mediatek_filogic"))
    if not kdirs:
        sys.exit(f"ERROR: linux-mediatek_filogic build_dir not found under {ib}")
    kdir = kdirs[0]
    dtb_dst = kdir / "image-mt7987a-nradio-c2000ultra.dtb"

    # 1. Install or compile DTB
    linux_inc = args.linux_include
    if linux_inc is None and (board_dir / "include/dt-bindings").is_dir():
        linux_inc = board_dir / "include"

    if args.dtb:
        shutil.copyfile(args.dtb.resolve(), dtb_dst)
    else:
        if not linux_inc:
            sys.exit(
                "ERROR: Provide --dtb image-mt7987a-nradio-c2000ultra.dtb "
                "or --linux-include <linux/include>."
            )
        dtcs = sorted(kdir.glob("linux-*/scripts/dtc/dtc"))
        dts_dirs = sorted(kdir.glob("linux-*/arch/arm64/boot/dts/mediatek"))
        if not dtcs:
            sys.exit("ERROR: bundled dtc not found in ImageBuilder")
        dtc = dtcs[0]
        pre_tmp = kdir / ".mt7987a-nradio-c2000ultra.dts.preprocessed"
        inc_flags = [
            "-I", str(board_dir),
            "-I", str(ib / "target/linux/mediatek/dts"),
            "-I", str(linux_inc.resolve()),
        ]
        if dts_dirs:
            inc_flags.extend(["-I", str(dts_dirs[0])])
        subprocess.run(
            [
                "gcc", "-E", "-nostdinc", "-undef", "-D__DTS__",
                "-x", "assembler-with-cpp",
                *inc_flags,
                "-o", str(pre_tmp),
                str(board_dir / "mt7987a-nradio-c2000ultra.dts"),
            ],
            check=True,
        )
        subprocess.run(
            [
                str(dtc), "-O", "dtb", "-i", str(ib / "target/linux/mediatek/dts"),
                "-Wno-unit_address_vs_reg", "-Wno-simple_bus_reg",
                "-o", str(dtb_dst), str(pre_tmp),
            ],
            check=True,
        )
        pre_tmp.unlink(missing_ok=True)

    # 1b. Assemble FIT kernel image (nradio_c2000-ultra-kernel.bin @ 0x40080000)
    linux_dirs = sorted(kdir.glob("linux-*"))
    if not linux_dirs:
        sys.exit(f"ERROR: linux-* directory not found under {kdir}")
    linux_dir = linux_dirs[0]
    linux_ver = linux_dir.name.removeprefix("linux-")
    host_bin = ib / "staging_dir/host/bin"
    kernel_raw = kdir / "Image"
    kernel_fit = kdir / "nradio_c2000-ultra-kernel.bin"
    kernel_lzma = kdir / ".nradio_c2000-ultra-kernel.lzma"
    kernel_its = kdir / "nradio_c2000-ultra-kernel.bin.its"

    subprocess.run(
        [
            str(host_bin / "lzma"), "e", str(kernel_raw),
            "-lc1", "-lp2", "-pb2", str(kernel_lzma),
        ],
        check=True,
    )
    subprocess.run(
        [
            str(ib / "scripts/mkits.sh"),
            "-D", "nradio_c2000-ultra",
            "-o", str(kernel_its),
            "-k", str(kernel_lzma),
            "-C", "lzma",
            "-d", str(dtb_dst),
            "-a", "0x40080000",
            "-e", "0x40080000",
            "-c", "config-1",
            "-A", "arm64",
            "-v", linux_ver,
        ],
        check=True,
    )
    fit_env = os.environ.copy()
    fit_env["PATH"] = f"{linux_dir / 'scripts/dtc'}:{host_bin}:{fit_env.get('PATH', '')}"
    subprocess.run(
        [str(host_bin / "mkimage"), "-f", str(kernel_its), str(kernel_fit)],
        env=fit_env,
        check=True,
    )
    kernel_lzma.unlink(missing_ok=True)

    # 2. Register Device/nradio_c2000-ultra in filogic.mk
    pkgs_joined = " \\\n\t".join(
        [" ".join(DEVICE_PACKAGES[i : i + 3]) for i in range(0, len(DEVICE_PACKAGES), 3)]
    )
    device_block = (
        "define Device/nradio_c2000-ultra\n"
        "  DEVICE_VENDOR := NRadio\n"
        "  DEVICE_MODEL := C2000 Ultra\n"
        "  DEVICE_DTS := mt7987a-nradio-c2000ultra\n"
        "  DEVICE_DTS_DIR := ../dts\n"
        "  SUPPORTED_DEVICES += NRadio-C2000MAX-798 NRadio-C2000MAX-Ultra NRadio-C2000Ultra\n"
        "  KERNEL_LOADADDR := 0x40080000\n"
        f"  DEVICE_PACKAGES := {pkgs_joined}\n"
        "  IMAGE/sysupgrade.bin := sysupgrade-tar | append-metadata\n"
        "endef\n"
        "TARGET_DEVICES += nradio_c2000-ultra\n\n"
    )
    mk_path = ib / "target/linux/mediatek/image/filogic.mk"
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

    # 3. Register or update Target-Profile in .targetinfo
    ti_path = ib / ".targetinfo"
    ti_text = ti_path.read_text()
    ti_entry = (
        "Target-Profile: DEVICE_nradio_c2000-ultra\n"
        "Target-Profile-Name: NRadio C2000 Ultra\n"
        f"Target-Profile-Packages: {' '.join(DEVICE_PACKAGES)}\n"
        "Target-Profile-hasImageMetadata: 1\n"
        "Target-Profile-SupportedDevices: nradio,c2000-ultra NRadio-C2000MAX-798 NRadio-C2000MAX-Ultra NRadio-C2000Ultra\n\n"
        "Target-Profile-Description:\n"
        "Build firmware images for NRadio C2000 Ultra\n\n"
        "@@\n\n"
    )
    existing_ti_re = re.compile(
        r"Target-Profile: DEVICE_nradio_c2000-ultra\n.*?@@\n\n",
        re.S,
    )
    if existing_ti_re.search(ti_text):
        ti_text = existing_ti_re.sub(ti_entry, ti_text, count=1)
    else:
        ti_anchor = "Target-Profile: DEVICE_nradio_c8-668gl"
        if ti_anchor not in ti_text:
            sys.exit("ERROR: anchor missing in .targetinfo")
        ti_text = ti_text.replace(ti_anchor, ti_entry + ti_anchor, 1)
    ti_path.write_text(ti_text)

    # 4. Ensure unsigned sysupgrade image for Factory Dual-OS & Mwrt compatibility
    cfg_path = ib / ".config"
    if cfg_path.is_file():
        cfg_text = cfg_path.read_text()
        cfg_text = re.sub(
            r"^CONFIG_SIGN_FIRMWARE=y$",
            "# CONFIG_SIGN_FIRMWARE is not set",
            cfg_text,
            flags=re.M,
        )
        cfg_path.write_text(cfg_text)

    # 4b. In rootless user-namespace containers where UID 0 is unmapped, Linux returns
    # EINVAL (instead of EPERM) on chown(0, 0), which bundled fakeroot does not mask.
    uid_map = Path("/proc/self/uid_map")
    fakeroot_sh = ib / "staging_dir/host/bin/fakeroot"
    if uid_map.is_file() and fakeroot_sh.is_file():
        has_uid0 = any(
            parts[0] == "0"
            for line in uid_map.read_text().splitlines()
            if (parts := line.split())
        )
        if not has_uid0:
            shim_so = ib / "staging_dir/host/lib/libuserns_eperm.so"
            shim_c = ib / "staging_dir/host/lib/.userns_eperm.c"
            shim_c.write_text(
                "#define _GNU_SOURCE\n"
                "#include <errno.h>\n"
                "#include <sys/syscall.h>\n"
                "#include <sys/types.h>\n"
                "#include <unistd.h>\n"
                "int chown(const char *p, uid_t o, gid_t g) {"
                " long r = syscall(SYS_chown, p, o, g);"
                " if (r == -1 && errno == EINVAL) errno = EPERM; return (int)r; }\n"
                "int lchown(const char *p, uid_t o, gid_t g) {"
                " long r = syscall(SYS_lchown, p, o, g);"
                " if (r == -1 && errno == EINVAL) errno = EPERM; return (int)r; }\n"
                "int fchown(int fd, uid_t o, gid_t g) {"
                " long r = syscall(SYS_fchown, fd, o, g);"
                " if (r == -1 && errno == EINVAL) errno = EPERM; return (int)r; }\n"
                "int fchownat(int d, const char *p, uid_t o, gid_t g, int f) {"
                " long r = syscall(SYS_fchownat, d, p, o, g, f);"
                " if (r == -1 && errno == EINVAL) errno = EPERM; return (int)r; }\n"
            )
            subprocess.run(
                [
                    "gcc", "-shared", "-fPIC", "-O2", "-fno-stack-protector",
                    "-o", str(shim_so), str(shim_c),
                ],
                check=True,
            )
            shim_c.unlink(missing_ok=True)
            fk_text = fakeroot_sh.read_text()
            hook = 'FAKEROOT_LIB="$FAKEROOT_LIB:${STAGING_DIR_HOST}/lib/libuserns_eperm.so"\nexport FAKEROOT_FD_BASE'
            if hook not in fk_text and "export FAKEROOT_FD_BASE" in fk_text:
                fk_text = fk_text.replace("export FAKEROOT_FD_BASE", hook, 1)
                fakeroot_sh.write_text(fk_text)
                fakeroot_sh.chmod(0o755)

    # 5. Stage FILES= overlay (board scripts + patched base-files + ncm.json)
    overlay = ib / "files-c2000-ultra"
    if overlay.exists():
        shutil.rmtree(overlay)
    copy_tree(board_dir / "files", overlay)

    # Reuse apply.py patching logic on a temporary mirror to stage 02_network, 11_fix_wifi_mac, platform.sh
    bf_src = ib / "target/linux/mediatek/filogic/base-files"
    for rel_str in (
        "etc/board.d/02_network",
        "etc/hotplug.d/ieee80211/11_fix_wifi_mac",
        "lib/upgrade/platform.sh",
    ):
        src_f = bf_src / rel_str
        dst_f = overlay / rel_str
        dst_f.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src_f, dst_f)

    # Patch staged 02_network
    net_path = overlay / "etc/board.d/02_network"
    net_text = net_path.read_text()
    if "\tnradio,c2000-ultra|\\\n" not in net_text:
        if_anchor = "\topenembed,som7981|\\\n\topenwrt,one)\n\t\tucidef_set_interfaces_lan_wan eth1 eth0"
        net_text = net_text.replace(if_anchor, "\tnradio,c2000-ultra|\\\n" + if_anchor, 1)
    if "\tnradio,c2000-ultra)\n" not in net_text:
        mac_block = (
            "\tnradio,c2000-ultra)\n"
            "\t\t. /lib/functions/nradio-c2000.sh\n"
            "\t\tlan_mac=$(c2000_get_base_mac)\n"
            '\t\t[ -n "$lan_mac" ] && wan_mac=$(macaddr_add "$lan_mac" 1)\n'
            "\t\tlabel_mac=$lan_mac\n"
            "\t\t;;\n"
        )
        net_text = net_text.replace("\tnradio,c8-668gl)\n", mac_block + "\tnradio,c8-668gl)\n", 1)
    net_path.write_text(net_text)
    net_path.chmod(0o755)

    # Patch staged 11_fix_wifi_mac
    wmac_path = overlay / "etc/hotplug.d/ieee80211/11_fix_wifi_mac"
    wmac_text = wmac_path.read_text()
    if "\tnradio,c2000-ultra)\n" not in wmac_text:
        wmac_block = (
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
        wmac_text = wmac_text.replace("\tnradio,c8-668gl)\n", wmac_block + "\tnradio,c8-668gl)\n", 1)
    wmac_path.write_text(wmac_text)

    # Patch staged platform.sh
    plat_path = overlay / "lib/upgrade/platform.sh"
    plat_text = plat_path.read_text()
    if "nradio,c2000-ultra" not in plat_text:
        # Dedicated do_upgrade branch: TF-card GPT partition labels are not
        # exposed through uevent PARTNAME, so find_mmc_part resolves nothing
        # and the generic emmc group would write no partition at all. Write
        # the squashfs rootfs partition (root=PARTLABEL=rootfs -> mmcblk0p4)
        # directly. The kernel partition (mmcblk0p3, vendor boot-image
        # format) is left untouched: only the factory flasher repackages
        # FIT kernels into it, and same-revision upgrades don't change it.
        plat_text = plat_text.replace(
            "\thuasifei,wh3000-pro-emmc|\\\n",
            "\tnradio,c2000-ultra)\n"
            "\t\texport EMMC_ROOT_DEV=\"/dev/mmcblk0p4\"\n"
            "\t\temmc_do_upgrade \"$1\"\n"
            "\t\t;;\n"
            "\thuasifei,wh3000-pro-emmc|\\\n",
            1,
        )
        plat_text = plat_text.replace(
            "\thiveton,h5000m|\\\n\tnradio,c8-668gl)",
            "\thiveton,h5000m|\\\n\tnradio,c2000-ultra|\\\n\tnradio,c8-668gl)",
            1,
        )
        plat_text = plat_text.replace(
            "\tnradio,c8-668gl|\\\n",
            "\tnradio,c2000-ultra|\\\n\tnradio,c8-668gl|\\\n",
            1,
        )
    plat_path.write_text(plat_text)

    # Stage /etc/gcom/ncm.json with TD Tech MT5700M-CN 5G profile
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
    ncm_base = board_dir / "ncm.base.json"
    ncm_data = json.loads(ncm_base.read_text()) if ncm_base.is_file() else {}
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
    ncm_dst = overlay / "etc/gcom/ncm.json"
    ncm_dst.parent.mkdir(parents=True, exist_ok=True)
    ncm_dst.write_text(json.dumps(ncm_data, indent="\t") + "\n")

    overlay.chmod(0o755)
    for p in sorted(overlay.rglob("*")):
        rel = p.relative_to(overlay)
        if p.is_dir():
            p.chmod(0o755)
        elif any(part in EXEC_DIRS for part in rel.parts) or rel.parts[:2] == ("etc", "board.d"):
            p.chmod(0o755)
        else:
            p.chmod(0o644)

    print(f"Injected nradio_c2000-ultra into {ib}")
    print("Build custom image with:")
    print(
        f'  make -C "{ib}" image PROFILE=nradio_c2000-ultra '
        'PACKAGES="kmod-usb-net-cdc-ether luci luci-ssl luci-proto-ncm luci-i18n-base-zh-cn luci-i18n-firewall-zh-cn luci-i18n-package-manager-zh-cn" '
        'FILES="files-c2000-ultra"'
    )


if __name__ == "__main__":
    main()
