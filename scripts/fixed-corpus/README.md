# 固顶候选语料工具

该工具先建立候选证据空间；选优阶段使用一份受控、可提交的精简证据快照，
不会让固顶编译或 CI 依赖本机的 GB 级缓存。

## 使用

在 `scripts` 目录运行：

```powershell
npm run corpus:collect -- --input-method-root "D:\C2D\Desktop\Code\Lua\inputMethod"
npm run corpus:collect -- --longma-root "D:\path\to\shuangpin-layout-benchmark-history"
npm run corpus:evidence
```

常用参数：

- `--manifest <path>`：覆盖来源清单。
- `--cache <path>`：覆盖生成目录，默认是仓库的 `cache/fixed-corpus/`。
- `--summary <path>`：覆盖精简 Markdown 摘要位置。
- `--input-method-root <path>`：设置本机输入法源码根目录。
- `--longma-root <path>`：设置龙码简码工作簿与两个发布压缩包所在目录。
- `--inspect-word <词>`：向摘要追加关注词覆盖；默认检查“一些、冲着、下了”。
- `--offline`：只使用现有本地目录和缓存，不访问网络。

生成内容包括逐来源 JSONL、汇总 `corpus.jsonl`、`provenance.json` 和详细 JSON 统计。缓存目录整体被 Git 忽略，可随时删除并重新生成。

`corpus:evidence` 从总库中只保留当前冰雪词典可用的 1～3 键公开简码证据，
排除当前固顶表自身与龙码无辅全码库存，写入
`config/shenyun-fixed-evidence.json`。后者体积小、可审计，是选优器的稳定输入。

生成新固顶并做确定性复核：

```powershell
npm run fixed:generate
npm run fixed:check
npm run fixed:verify
```

选优只在神韵已经确定的合法空间骨架中进行。二简继续占用 53 个天然空位和
11 个极冷音码；公开方案按独立家族计票，同源键道分支不会重复灌票；现有
码位另有肌肉记忆成本。完整原则、变更清单和证据见
`reports/shenyun-fixed-optimization.md`。

来源清单使用拒绝优先的隐私策略。`userdb`、同步目录、用户词典、私人短语、构建产物不会因为宽泛匹配而进入语料。

## 验证

```powershell
npm run test:corpus
npm run typecheck
```
