"""只读导出 Rime::Table/4.0；解析文件，不加载 librime 或用户词典。

依赖 marisa-trie==1.4.1。结构来源：librime src/rime/dict/{table,mapped_file,string_table}.h。
仅支持本任务所用的单音节静态码表，遇到多音节索引立即拒绝，避免默默漏词。
"""
import argparse
import struct
import hashlib
import json
from pathlib import Path
import marisa_trie


def export_table(source: Path, destination: Path):
    data = source.read_bytes()
    assert data[:16] == b"Rime::Table/4.0\0", "只支持 Table/4.0"
    u32 = lambda pos: struct.unpack_from("<I", data, pos)[0]
    ptr = lambda pos: pos + struct.unpack_from("<i", data, pos)[0]
    strings_at = ptr(60)
    trie = marisa_trie.Trie().frombytes(data[strings_at:strings_at + u32(64)])
    syllabary = ptr(44)
    index = ptr(48)
    assert u32(syllabary) == u32(index) == u32(36)
    count = 0
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", encoding="utf-8", newline="\n") as output:
        for key in range(u32(index)):
            code = trie.restore_key(u32(syllabary + 4 + 4 * key))
            node = index + 4 + key * 12
            assert u32(node + 8) == 0, "多音节索引不在此导出器支持范围"
            entries = ptr(node + 4)
            for row in range(u32(node)):
                position = entries + row * 8
                text = trie.restore_key(u32(position))
                weight = struct.unpack_from("<f", data, position + 4)[0]
                output.write(f"{text}\t{code}\t{weight}\n")
                count += 1
    assert count == u32(40), (count, u32(40))
    destination.with_suffix(destination.suffix + ".json").write_text(json.dumps({
        "source": str(source.resolve()),
        "sourceSha256": hashlib.sha256(data).hexdigest(),
        "dumpSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "entries": count,
        "format": "Rime::Table/4.0 single-syllable",
        "decoder": "marisa-trie==1.4.1; scripts/export-rime-table.py",
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{source.name}: {count} entries -> {destination}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    export_table(args.source, args.destination)
