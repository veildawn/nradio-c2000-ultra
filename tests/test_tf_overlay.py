"""Check TF isolation before OpenWrt can mount the board's writable layer."""

from pathlib import Path
import subprocess
import tempfile
import unittest

from board.platform_upgrade import patch_platform_upgrade


ROOT = Path(__file__).resolve().parents[1]


class TFOverlayTests(unittest.TestCase):
    def test_preinit_requires_tf_root_and_isolated_mtd(self):
        guard = (ROOT / "board/files/lib/preinit/35_nradio_tf_overlay").read_text()
        cases = (
            ("179:4", "squashfs", '"factory-firmware"\n', False),
            ("179:4", "squashfs", '"factory-firmware"\n"rootfs_data"\n', True),
            ("179:4", "squashfs", '"firmware"\n"rootfs_data"\n', True),
            ("31:7", "squashfs", '"factory-firmware"\n', True),
            ("179:4", "f2fs", '"factory-firmware"\n', True),
        )
        with tempfile.TemporaryDirectory() as tmp:
            fixture = Path(tmp)
            for original, filename in (
                ("/sys/class/block/mmcblk0p4/dev", "dev"),
                ("/proc/self/mountinfo", "mountinfo"),
                ("/proc/mtd", "mtd"),
                ("/dev/console", "console"),
                ("/tmp/failsafe", "failsafe"),
            ):
                guard = guard.replace(original, str(fixture / filename))
            (fixture / "dev").write_text("179:4\n")
            for root_dev, fs, mtd, failsafe in cases:
                with self.subTest(root_dev=root_dev, fs=fs, mtd=mtd):
                    (fixture / "mountinfo").write_text(
                        f"17 0 {root_dev} / / ro - {fs} /dev/root ro\n"
                    )
                    (fixture / "mtd").write_text(mtd)
                    (fixture / "failsafe").unlink(missing_ok=True)
                    result = subprocess.check_output(
                        [
                            "sh", "-c",
                            "board_name() { echo nradio,c2000-ultra; }\n"
                            "boot_hook_add() { :; }\n"
                            + guard
                            + '\nnradio_tf_overlay_guard\nprintf "%s" "$FAILSAFE"',
                        ],
                        text=True,
                    )
                    self.assertEqual(result, "true" if failsafe else "")
                    self.assertEqual((fixture / "failsafe").exists(), failsafe)

    def test_tf_upgrade_patch_keeps_other_boards_and_is_idempotent(self):
        upstream_platform = """platform_do_upgrade() {
	local board=$(board_name)
	case "$board" in
	other,board|\\
	third,board)
		emmc_do_upgrade "$1"
		;;
	esac
}
platform_check_image() {
	case "$(board_name)" in
	nradio,c8-668gl)
		return 0
		;;
	esac
}
platform_copy_config() {
	case "$(board_name)" in
	nradio,c8-668gl|\\
	other,board)
		emmc_copy_config
		;;
	esac
}
"""
        patched = patch_platform_upgrade(upstream_platform)
        self.assertEqual(patched, patch_platform_upgrade(patched))
        self.assertIn("export EMMC_ROOT_DEV=/dev/mmcblk0p4", patched)
        self.assertNotIn("mtd erase", patched)
        self.assertIn("other,board|\\\n\tthird,board)", patched)
        self.assertEqual(patched.count("nradio,c2000-ultra"), 3)
        subprocess.run(["sh", "-n"], input=patched, text=True, check=True)
