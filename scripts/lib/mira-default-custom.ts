export function makeMiraDefaultCustomization(schema: string) {
	if (!/^snow_[a-z_]+$/u.test(schema))
		throw new Error(`Invalid schema: ${schema}`);
	return `patch:\n  "switcher/hotkeys": [Control+Shift+grave]\n  schema_list:\n    - schema: ${schema}\n`;
}
