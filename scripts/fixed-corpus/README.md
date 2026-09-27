# 固顶候选语料工具

该工具只建立候选证据空间，不自动修改神韵的二简、630 或单字固顶表。

## 使用

在 `scripts` 目录运行：

```powershell
npm run corpus:collect -- --input-method-root "D:\C2D\Desktop\Code\Lua\inputMethod"
```

常用参数：

- `--manifest <path>`：覆盖来源清单。
- `--cache <path>`：覆盖生成目录，默认是仓库的 `cache/fixed-corpus/`。
- `--summary <path>`：覆盖精简 Markdown 摘要位置。
- `--input-method-root <path>`：设置本机输入法源码根目录。
- `--inspect-word <词>`：向摘要追加关注词覆盖；默认检查“一些、冲着、下了”。
- `--offline`：只使用现有本地目录和缓存，不访问网络。

生成内容包括逐来源 JSONL、汇总 `corpus.jsonl`、`provenance.json` 和详细 JSON 统计。缓存目录整体被 Git 忽略，可随时删除并重新生成。

来源清单使用拒绝优先的隐私策略。`userdb`、同步目录、用户词典、私人短语、构建产物不会因为宽泛匹配而进入语料。

## 验证

```powershell
npm run test:corpus
npm run typecheck
```
