"""Patch pinned Mira for ASCII probe codes: materialize candidates after EVERY key.

Used only in the Actions build directory; never changes installed input methods.
"""
import pathlib
import sys

path = pathlib.Path(sys.argv[1]) / "src/rime.cpp"
source = path.read_text(encoding="utf-8")
old = '''    if (!api->simulate_key_sequence(session, keys.c_str())) {
        std::cerr << "cannot simulate key sequence '" << keys << "'\\n";
        return std::nullopt;
    }'''
new = '''    // Probe inputs are literal ASCII encoding keys, never Mira brace syntax.
    // Read the menu after each event so lazy Lua filters observe each prefix.
    for (const char key : keys) {
        if (key == '{' || key == '}' || static_cast<unsigned char>(key) > 127) {
            std::cerr << "unsupported probe key syntax\\n";
            return std::nullopt;
        }
        const std::string event(1, key);
        if (!api->simulate_key_sequence(session, event.c_str())) {
            return std::nullopt;
        }
        RIME_STRUCT(RimeContext, intermediate);
        if (api->get_context(session, &intermediate)) {
            api->free_context(&intermediate);
        }
    }'''
assert source.count(old) == 1, "Pinned Mira send_keys implementation changed"
path.write_text(source.replace(old, new), encoding="utf-8")
print("Patched Mira: independent session, literal events, get_context after each key")
