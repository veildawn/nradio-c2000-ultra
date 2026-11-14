# Shared MAC validation & factory base-MAC helpers for NRadio C2000 Ultra.
# Rejects empty, all-zero, broadcast, MediaTek Factory template (00:0c:43:* / 02:0c:43:*),
# and multicast/group-bit MACs (such as 0b:00:43:26:00:00 seen in Factory 0x04 on some units).

[ -f /lib/functions/system.sh ] && ! command -v macaddr_canonicalize >/dev/null 2>&1 && . /lib/functions/system.sh

c2000_canon_mac() {
	if command -v macaddr_canonicalize >/dev/null 2>&1; then
		macaddr_canonicalize "$1" 2>/dev/null
	else
		printf '%s\n' "$1" | tr 'A-F' 'a-f'
	fi
}

c2000_mac_is_valid_unicast() {
	local mac o1
	mac=$(c2000_canon_mac "$1")
	case "$mac" in
	[0-9a-f][0-9a-f]:[0-9a-f][0-9a-f]:[0-9a-f][0-9a-f]:[0-9a-f][0-9a-f]:[0-9a-f][0-9a-f]:[0-9a-f][0-9a-f]) ;;
	*) return 1 ;;
	esac
	case "$mac" in
	00:00:00:00:00:00|ff:ff:ff:ff:ff:ff|00:0c:43:*|02:0c:43:*)
		return 1
		;;
	esac
	o1="${mac%%:*}"
	[ "$(( 0x$o1 & 1 ))" -eq 0 ]
}

c2000_get_base_mac() {
	local mac
	mac=$(mtd_get_mac_ascii bdinfo "fac_mac" 2>/dev/null)
	if c2000_mac_is_valid_unicast "$mac"; then
		c2000_canon_mac "$mac"
		return 0
	fi

	mac=$(mtd_get_mac_binary Factory 0xffff4 2>/dev/null)
	if c2000_mac_is_valid_unicast "$mac"; then
		c2000_canon_mac "$mac"
		return 0
	fi

	mac=$(macaddr_generate_from_mmc_cid mmcblk0 2>/dev/null)
	if c2000_mac_is_valid_unicast "$mac"; then
		c2000_canon_mac "$mac"
		return 0
	fi

	return 1
}
