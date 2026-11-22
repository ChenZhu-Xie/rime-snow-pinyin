# 十个冰雪方案（除一拼）＋声笔小鹤＋小鹤音形（清风版）；各阶段串行、自动复用缓存。
benchmark-5500 *args:
    bun scripts/run-5500-benchmark.ts {{args}}

# 直接读取已验证的报告生成紫色全按键图；--check 校验图与文档。
benchmark-heatmaps *args:
    bun scripts/generate-5500-keyboard-heatmaps.ts {{args}}
