# 冰雪鹤道与冰雪鹤拼的 RC26 布局

两个生产方案共用 `RC26-39a5bfdc045342cd`「冰雪神韵·21×26 综合候选 A」。本次从 UM40 替换提交 `ddab179` 的父提交 `7008a48` 恢复声韵映射，活动配置与该历史提交逐项一致；不回退之后的功能修复、冰雪兰道／冰雪兰拼的 UED 布局或其他方案。选择恢复旧布局，是为了沿用用户更熟悉的记忆路径。

活动映射见[生产配置](../config/shenyun-21x26-mapping.json)，替换前提交的 399 音节原码表及来源摘要见[冻结来源](shenyun-rc26-source.json)，扩展读音见[完整映射](shenyun-rc26-mapping.json)。来源摘要包含恢复提交、历史配置 SHA-256、历史映射摘要和原始码表摘要，CI 不需要访问本机 HTML。UM40 的来源、映射和图片保留为历史资料，不再作为当前生成输入。

声母 `q→F`、`x→Y`、`s→Q`，翘舌声母 `zh→S`、`ch→X`、`sh→V`；零声母载体为 `A/E/O→Y`、`W→J`、`Y/YU→W`。韵母使用完整 26 键，详见配置和[键位图](shenyun-rc26-keyboard.svg)。五辅保持形义序「折横撇竖点」`AEUIO`、声调序「一二三四轻」`IEUAO`，满足 `42310` 语义往返不变量。

冰雪鹤道继续使用键道形辅，二／三／四字词辅序为 `12/12/24`；冰雪鹤拼继续使用声调与笔画，词语调辅序为 `12/21/13`。声声空桶按二字词标准辅序的反序逐字取两辅至六码；单字最多四辅、四码顶、缓冲、学习、反查和快捷键沿用当前实现。两个固定编码用户词典恢复为 `snow_shenyun_shape_rc26`、`snow_shenyun_tone_rc26`；公共拼音学习仍使用 `snow_pinyin`。

## 恢复前后审计

| 口径 | 恢复前 UM40 | 恢复后 RC26 |
| --- | ---: | ---: |
| Common399 唯一码／重码桶 | 399／0 | 399／0 |
| Common399 静态空码 | 147 | 147 |
| 扩展 416 音节唯一码 | 411 | 413 |
| 扩展域重码桶／受影响音节 | 5／10 | 3／6 |
| 运行时 AU 空桶 | 144 | 142 |
| 运行时 AA／AB 空桶 | 134／10 | 129／13 |

静态映射与运行时空桶使用不同口径。运行时只看系统词典，忽略词频为 0 或 1 的大字集兜底读音，不计个人学习。RC26 的 `qz`、`zq` 均为空桶，新回归验证两者不被 UM40 的 `zen→zq` 残留占用。字母只借用占用桶，汉字仍为首选，大写／小写为第二／三选；共同尾键为 `n`，D/J/X 例外恢复为 `db/jm/xo`。两份固顶表各有 21 个一简、378 个二码单字、108 个二简词和 26 个字母入口，没有 630 区。

## 三级单字固顶

冰雪鹤道另有 1,648 个「两码主码＋第一形辅」的三级单字固顶，冰雪鹤拼沿用原有一／二码固顶。选字以单字独立成词使用的常用度为目标，参考冰雪四拼的单字固顶偏好；当前阶段不深究真正的一字词频，现有读音权重只作补充和兜底，不宣称其已排除多字词贡献。三级单字与已有短码固定单字不重复；例如 `bqo` 固顶「病」，继续补辅后的排序仍由当前码位和首选后置规则决定。范围、生成策略和验证要求见[单字固顶选字原则](fixed-candidates.md)。

## 生成与验证

```powershell
bun scripts/generate-layout-algebra.ts
bun scripts/生成神韵映射.ts
bun scripts/research/calculate_shenyun_21x26_letter_buckets.ts
bun scripts/align-fixed-with-sipin.ts
bun scripts/generate-shenyun-letters.ts
bun scripts/generate-shenyun-hints.ts
bun scripts/generate-keymaps.ts
bun scripts/导出神韵热力图.ts '<a7_CKT_R11.html 的路径>' --21x26
bun scripts/生成神韵对比.ts '<a7_CKT_R11.html 的路径>'
bun scripts/更新神韵README.ts
bun scripts/check-pinyin-dict.ts
bun run --cwd scripts test:corpus
bun run --cwd scripts typecheck
cargo test --manifest-path tools/keymap-helper/Cargo.toml
bun scripts/generate-skins.ts output/rc26-restore/skins
```

生成器核对历史码表摘要和全部 Common399 编码，回归再从两份实际 schema 展开代数，核对 399 个音节的全部五调。真实候选只在推送后的 GitHub Actions 中验证，同时覆盖 librime 1.13.1 和 1.17；本机不运行 Mira。功能与性能验证通过后重新部署即可生效，软链安装无需另外复制文件。
