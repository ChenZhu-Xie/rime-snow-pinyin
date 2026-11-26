# 冰雪兰道与冰雪兰拼的 UED 布局

两套方案在四主码阶段支持 `<` 选择四字词首选、`>` 优先选五字及以上词并以二字词兜底；补韵大写不计主码，完整规则见[四主码词长直选](word-length-selection.md)。

两个生产方案共用冻结的 `UED-3158ce08b5bc` 无调 21×21 声韵布局，替换原 `OC21-e1f155973380`。声母、韵母和辅序均来自用户指定的 `shuangpin-layout-benchmark/a7_CKT_R11.html` 内嵌 payload；不是只替换方案名称或键位图。

来源分支为 `research/untoned-cr7e-v52-20261119`，提交为 `da1441ed4ae37d5c8e0e93d2df33e5514b7af38e`。页面的生产报告是 `research/notes/2026-11-21-u7e-pinky-r11-scores-UED-3158ce08b5bc.json`，最终辅序审阅是 `research/notes/2026-11-21-u7e-pinky-aux-final-publication.json`。仓库保留 [421 音节原始码表与语义合同](shenyun-ued-source.json)、[生产配置](../config/shenyun-21x21-mapping.json)和[扩展映射](shenyun-ued-3158ce08b5bc-mapping.json)，后续生成与 CI 不依赖本机 HTML。

声母位移为 `k→P`、`s→C`，翘舌声母为 `zh→E`、`ch→S`、`sh→K`；`A/E/O` 共用 `R`，`W/Y` 使用原键。五辅保持形义序「折横撇竖点」`AVUIO`、声调序「一二三四轻」`IVUAO`，按形义序观察声调为 `42310`。

冰雪兰道采用纯形辅序 `12/231/23`，冰雪兰拼采用调辅序 `12/213/23`。这是页面 CKT v5.2 百万成本场景选择的各自稳健辅序；冰雪兰道的单倍成本点最优 `12/231/24` 不作为生产合同。二字词最多两辅，三字词最多三辅，四字词最多两辅；声声空桶仍按二字词标准辅序的反序逐字取两辅，最多六码。字位导航同步使用新辅序。

| 范围 | 原生产布局 | UED 布局 |
| --- | --- | --- |
| Common399 唯一码／重码桶／静态空码 | 345／54／96 | 351／48／90 |
| 416 扩展音节唯一码／重码桶／静态空码 | 351／61／90 | 360／55／81 |
| 当前系统单字词频大于 1 的运行时空桶 | 94 | 87 |
| 二码单字／二简词 | 351／90 | 360／81 |

Common399 与扩展域不同于运行时空桶：运行时忽略词频为 0 或 1 的大字集兜底读音。`qz`、`zq` 在新布局中继续为空。两套 630 固顶区各保留 105 个二码位和 525 个三码位，每码一个唯一词项；字母仍沿用共享 `c` 列及 `x` 载体，数字按对应汉字的新音码生成。部件提示、README、桌面 SVG 和移动端 PNG 与声韵配置同步。

固定编码用户词典分别改为 `snow_landao_ued_3158ce08b5bc` 和 `snow_lanpin_ued_3158ce08b5bc`，旧库保留在原位置，避免旧编码记录影响新布局。原生拼音词典学习仍共用 `snow_pinyin`。冰雪莲道的 630 按既有生成规则从冰雪兰道重映射，因此随新固顶表重新生成，莲道声韵布局不变。

所有支持 `;` 上屏当前文本并追加「的」的方案，一级简码 `d` 均首选「都」：冰雪四拼、冰雪兰道、冰雪兰拼、冰雪键道、冰雪三拼、冰雪莲道、冰雪鹤道、冰雪鹤拼和冰雪鹮道。

本地验证命令：

```powershell
bun scripts/generate-layout-algebra.ts --check
bun scripts/生成神韵映射.ts --check
bun scripts/生成神韵固顶词.ts --check
bun scripts/align-fixed-with-sipin.ts --check
bun scripts/generate-radical-codes.ts --check
bun scripts/生成三拼简词.ts --check
bun scripts/验证神韵双拼.ts
bun scripts/check-pinyin-dict.ts
bun run --cwd scripts test:corpus
```

真实候选与性能由推送后的 GitHub Actions 验证，功能用例同时覆盖 librime 1.13.1 和 1.17。本机不运行 Mira。确认验证通过后，小狼毫重新部署即可使用新布局；软链安装无需复制或同步仓库文件。
