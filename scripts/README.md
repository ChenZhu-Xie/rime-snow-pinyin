# 开发脚本

文件名统一使用英文小写和连字符：`generate-*` 生成词典、码表或测试，`export-*` 导出已有数据，`annotate-words.ts` 给词表注音；`link.ts`、`test.ts`、`version.ts` 保留简短的日常命令名。`lib/` 存放公共逻辑，`data/` 存放源数据，`skin/` 存放皮肤布局和生成逻辑，`experiments/` 存放依赖外部语料的实验工具。

以下命令以仓库根目录为例。脚本自行定位仓库文件，不依赖当前工作目录；用户传入的相对路径以调用时的工作目录为准。先运行 `bun install --cwd scripts` 安装依赖。

## 日常命令

```sh
bun scripts/test.ts                     # 全部五个方案
bun scripts/test.ts yipin qingyun        # 指定方案
bun scripts/version.ts                  # 查看版本
bun scripts/version.ts 0.3.12            # 更新版本
bun scripts/link.ts link                # 建立本机软链
bun scripts/link.ts unlink              # 还原独立副本
bun scripts/link.ts sync                # 单向镜像到仓输入法的 iCloud 目录并打包
bun run --cwd scripts format            # 格式化 TypeScript 和 JSON
bun run --cwd scripts check:format      # 只检查格式
```

包内的 `test`、`version`、`link`、`unlink`、`sync` 也可通过 `bun run --cwd scripts <命令>` 调用。测试仍使用精简源目录、独立 TMPDIR 和独立缓存，不会使用本机词频。

`sync` 同步完成后，会在 `~/Library/Mobile Documents/iCloud~com~ihsiao~apps~Hamster3/Documents/sync/rime-snow-pinyin.zip` 生成包含全部同步文件的 ZIP 压缩包，包内保留相对路径（如 `lua/snow/`）。每次重新打包并替换旧包，避免保留已删除的文件；需要系统提供 `zip` 命令（macOS 自带）。

## 词典和辅助码生成

| 脚本与参数 | 输入 | 默认输出 |
| --- | --- | --- |
| `generate-pinyin-dict.ts [输出文件]` | `data/tygf-pinyin.tsv` 和固定版本的大字集拼音发布文件，需要联网下载 | `snow_pinyin.dict.yaml` |
| `generate-word-dicts.ts [base ext tencent] [--output-dir 目录]` | 雾凇子模块 `ice/cn_dicts/`、当前单字词典、两张读音修正表；省略词库名时生成全部三份 | 仓库根目录的三份 `snow_pinyin.*.dict.yaml`；未确定读音放在 `diff/`，指定输出目录时诊断也放在该目录的 `diff/` |
| `generate-english-dict.ts [输入文件] [输出文件]` | 默认 `rime-easy-en/easy_en.dict.yaml` | `snow_yingpin.dict.yaml` |
| `generate-stroke-dict.ts <输入文件> [输出文件]` | 外部三列笔画 TSV，格式见根目录 `AGENTS.md` | `snow_bihua.dict.yaml` |
| `generate-radical-codes.ts [输出目录]` | `data/radicals.tsv` 和冰雪四拼、冰雪三拼的拼写规则 | `lua/snow/radical_sipin.txt`、`lua/snow/radical_sanpin.txt` |

这些脚本默认会更新仓库产物。需要先审阅生成结果时传入临时输出路径，例如：

```sh
bun scripts/generate-word-dicts.ts base --output-dir /tmp/snow-word-dicts
bun scripts/generate-radical-codes.ts /tmp/snow-radicals
```

注音初始化位于 `lib/word-pinyin.ts`，仅在调用时执行，不写文件。`data/word-pinyin-overrides.tsv` 保存原先内嵌的词语读音修正；`data/complete-pinyin-overrides.tsv` 修正 pinyin-pro 的完整词库，二者作用层次不同。单字词典按 `...` 标记读取正文，排除字母、数字和多字记录。

## 导出、注音和皮肤

| 脚本与参数 | 用途 | 默认输出 |
| --- | --- | --- |
| `annotate-words.ts <词表> [输出文件]` | 输入每行一个词，可带后续 TSV 列；优先使用现有词典注音，缺词时调用注音库 | `output/annotated-words.tsv` |
| `export-user-dict.ts <用户词典快照> [输出文件]` | 读取 Rime 文本快照，按使用次数排序，输出词、编码、次数三列 | `output/user-dict.tsv` |
| `export-character-codes.ts [输出文件]` | 冰雪四拼的单字评测码表，需要联网下载大字集拼音 | `output/character-codes.tsv` |
| `export-word-codes.ts [输出目录]` | 模拟冰雪四拼动态码长，导出评测和大竹查询码表；属于离线模拟 | `output/word-codes/simulated.txt`、`output/word-codes/dazhu.txt` |
| `generate-yipin-tests.ts [输出文件]` | 从 `data/yipin-syllables.tsv` 的每组固定选择首条记录，生成 416 条可复现的音节测试 | `output/yipin-tests.yaml.snippet` |
| `generate-skins.ts [输出目录]` | 生成七组仓输入法皮肤文件夹及同名 `.cskin` 压缩包，含亮色、暗色和预览图 | 当前用户的 `~/Library/Mobile Documents/iCloud~com~ihsiao~apps~Hamster3/Documents/Skins/` |

`output/` 已被 Git 忽略。冰雪一拼测试生成的是 YAML 片段，需审阅后合入 `spec/snow_yipin.test.yaml`，不会覆盖已有的功能测试。皮肤布局放在 `skin/layouts.ts`，样式和键盘渲染放在 `skin/render.ts`，类型放在 `skin/types.ts`。预览皮肤生成结果可运行 `bun scripts/generate-skins.ts /tmp/snow-skins`。

皮肤打包需要系统提供 `zip` 命令（macOS 自带）。每个 `.cskin` 都是 ZIP 文件，根目录只有一个与皮肤同名的文件夹，`config.yaml`、`demo.png`、`dark/` 和 `light/` 等所有皮肤文件均放在该文件夹内，可分享给仓输入法导入。`demo.png` 由 `skin/preview.ts` 按拼音键盘配置生成浅色、暗色并排预览，系统图标使用文字或通用符号替代。

## 实验工具

这些工具不参与词典发布，也不会直接覆盖现有固定词表。语料和词频表需自行提供。

```sh
# 冰雪三拼简词候选：词频表为「词 + 制表符 + 权重」
bun scripts/experiments/generate-sanpin-shortcuts.ts /path/to/frequency.tsv [输出文件]

# 从万象字频、词频推导单字剩余词频，再按玲珑词表重新分词
bun scripts/experiments/frequency/derive-character-frequency.ts /path/to/corpus [输出文件]
bun scripts/experiments/frequency/resegment-word-frequency.ts /path/to/corpus /path/to/DictLinglong.txt [输出文件]
```

简词默认输出到 `output/sanpin-shortcuts.tsv`。第一步的语料目录需包含 `万象单字频.txt`（字、读音、频次三列）和 `万象多字词频.txt`（词、频次两列），默认输出同目录的 `万象一字词频（推导）.txt`；第二步读取该推导文件、`万象多字词频.txt`、`万象多字词频 2.txt`，默认输出同目录的 `万象词频玲珑二次分词.txt`。如为第一步指定了其他输出路径，第二步运行前需将结果放回约定的输入位置。

## 旧名称对照

| 旧名称 | 新名称 |
| --- | --- |
| `single.ts` | `generate-pinyin-dict.ts` |
| `multiple.ts` | `generate-word-dicts.ts` |
| `generateYingpinDict.ts` | `generate-english-dict.ts` |
| `bihua.ts` | `generate-stroke-dict.ts` |
| `生成四拼部首.ts` | `generate-radical-codes.ts` |
| `生成冰雪一拼测试.ts` | `generate-yipin-tests.ts` |
| `生成键盘皮肤.ts` | `generate-skins.ts` |
| `pronounce.ts` | `annotate-words.ts` |
| `解析用户词典.ts` | `export-user-dict.ts` |
| `yu.ts` | `export-character-codes.ts` |
| `export.ts` | `export-word-codes.ts` |
| `生成三拼简词.ts` | `experiments/generate-sanpin-shortcuts.ts` |
| `separation.ts` | `experiments/frequency/derive-character-frequency.ts` |
| `rmm.ts` | `experiments/frequency/resegment-word-frequency.ts` |
| `utils.ts` | 拆为 `lib/algebra.ts` 和 `lib/character-pinyin.ts` |

已移除历史转换或实验脚本 `addWords.ts`、`dictionary.ts`、`equivalence.ts`、`jiandao.ts`、`生成占位音节.ts`；需要查阅旧实现时使用 Git 历史。
