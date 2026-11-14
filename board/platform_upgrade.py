"""Install the C2000 Ultra's TF-only upgrade path in the Filogic platform script."""

import re


BOARD = "nradio,c2000-ultra"


def patch_platform_upgrade(text: str) -> str:
    upgrade_anchor = '\tcase "$board" in\n'
    upgrade_start = text.index("platform_do_upgrade() {")
    upgrade_end = text.index("\n}", upgrade_start)
    upgrade = text[upgrade_start:upgrade_end]
    # The old branch followed a continued case pattern on some snapshots.
    # Restore the continuation so the other boards keep their original path.
    upgrade = re.sub(rf"^\t{BOARD}\)\n.*?^\t\t;;\n", "", upgrade, flags=re.M | re.S)
    index = upgrade.index(upgrade_anchor) + len(upgrade_anchor)
    upgrade = (
        upgrade[:index]
        + f"""\t{BOARD})
		# The TF kernel and DTB are installed by the factory flasher.
		# emmc_do_upgrade and emmc_copy_config share the TF rootdisk tail.
		[ -b /dev/mmcblk0p4 ] || return 1
		export EMMC_ROOT_DEV=/dev/mmcblk0p4
		emmc_do_upgrade "$1"
		;;
"""
        + upgrade[index:]
    )
    text = text[:upgrade_start] + upgrade + text[upgrade_end:]

    for function, anchor in (
        ("platform_check_image", "\tnradio,c8-668gl)"),
        ("platform_copy_config", "\tnradio,c8-668gl|\\\n"),
    ):
        start = text.index(f"{function}() {{")
        index = text.index(anchor, start)
        entry = f"\t{BOARD}|\\\n"
        if not text[:index].endswith(entry):
            text = text[:index] + entry + text[index:]

    return text
