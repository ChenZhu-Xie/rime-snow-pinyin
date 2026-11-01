# CKT v5 来源前沿嵌套辅序搜索运行手册

## 目标

对 U357 来源提交中的 6 个 21×21 正式 Pareto 布局，以及 Overall-17 来源提交中的 50 个 21×26 正式 `D=1` frontier 布局，分别为两个成员穷举 144 种二／三／四字辅序。每个成员按其对归一 CKT v5 的真实贡献选优，再将两个成员按 `1:1` 合并，与重新选优后的 U357（21×21 来源第 4 名）和 Overall-17（21×26 来源第 17 名）比较。

每个成员的目标包含单字、二字词、三字词、四字词完整联合候选竞争，权重为 `1:3:1:1`，候选页为 6 项。参考 S005 固定使用冰雪键道 `12/21/24`、冰雪三拼 `12/21/23`，只负责维持 CKT v5 的 S005＝10 数轴。

## 工具

- `scripts/research/optimize_ckt5_candidate_aux_order.js`：单成员 worker。一次只处理一个来源布局的一个成员，穷举 144 种辅序并原子写出结果。
- `scripts/research/run_ckt5_nested_frontier.js`：可断点续跑的批处理器。默认按 21×21 的 6 个布局、21×26 的 50 个布局依次执行，每个布局的冰雪键道／冰雪神韵·形与冰雪三拼／冰雪神韵·调串行运行。

批处理器默认只启动一个 worker；每个 worker 退出后，操作系统会完整回收约 3.5～4.0 GiB 的内存。结果先写临时文件，再用同卷重命名替换目标文件，进程中断不会留下被误认成完成结果的半截 JSON。

## 准备

两份仓库需要同时存在：

1. 本仓库 `rime-snow-pinyin`；
2. `shuangpin-layout-benchmark`，且 Git 对象中仍可读取提交 `11713b652cd6a2350d8bf6d0a16d3383d8f0038f` 与 `7a7e154f3f7d0c86653ee15e755ccd72e866e5e2`。

在本仓库根目录运行。先确认 Node 可用，并为本仓库脚本安装依赖：

```powershell
node --version
bun install --cwd scripts
git -C "D:\path\to\shuangpin-layout-benchmark" cat-file -e 11713b652cd6a2350d8bf6d0a16d3383d8f0038f^{commit}
git -C "D:\path\to\shuangpin-layout-benchmark" cat-file -e 7a7e154f3f7d0c86653ee15e755ccd72e866e5e2^{commit}
```

长跑前关闭系统自动睡眠。不要让两个批处理器同时写同一个输出目录。

## 试跑

只规划、不计算：

```powershell
node scripts/research/run_ckt5_nested_frontier.js --benchmark "D:\path\to\shuangpin-layout-benchmark" --dry-run
```

只取 21×21 第 1 个布局，每成员计算前 2 种辅序，用于验证来源读取、worker 调用、检查点和布局对汇总：

```powershell
node scripts/research/run_ckt5_nested_frontier.js --benchmark "D:\path\to\shuangpin-layout-benchmark" --domain 21x21 --max-layouts 1 --policy-limit 2 --min-free-gib 4 --output-dir output/ckt5-nested-smoke
```

试跑生成的布局对会标记 `complete: false`，不能用于正式排名。

本机开发试跑还用指定辅序入口核对了旧分数：U357 的 `12/23/24 + 12/21/23` 得到 `9.715586951861038`，与已发布值只差 `3.55×10⁻¹⁵`；Overall-17 的 `12/21/14 + 12/21/13` 得到 `9.195082189845293`，与已发布值完全一致。若迁移后需要再次检查单个辅序，可直接运行 worker 并传入 `--policy 12/23/24`。

## 正式运行

```powershell
node scripts/research/run_ckt5_nested_frontier.js --benchmark "D:\path\to\shuangpin-layout-benchmark" --domain all --heap-mib 4096 --min-free-gib 8 --output-dir output/ckt5-nested-frontier
```

默认计划为 56 个布局、112 个成员级搜索、16,128 次完整辅序竞争。按本机容量探针，预计总耗时约 8～10 小时；另一台机器的实际时间以首个完整成员为准。

同一命令可以直接重跑。已有且完整的 144 结果会跳过；失败或中断的当前成员会重新计算，已经完成的成员不会丢失。一个成员预计 4～5 分钟，因此断电时最大重复量约为一个成员。

如需分段，可限定键域和来源名次：

```powershell
node scripts/research/run_ckt5_nested_frontier.js --benchmark "D:\path\to\shuangpin-layout-benchmark" --domain 21x26 --start-rank 1 --end-rank 10 --output-dir output/ckt5-nested-frontier
```

分段命令必须共用同一输出目录，最终再次执行完整命令即可补齐缺失项并生成总汇总。

## 监督规则

- 默认并发数固定为 1；不要同时启动第二个 worker，除非实测空闲物理内存和提交余量都足够容纳两个约 4 GiB 进程。
- 批处理器在每个成员启动前检查空闲物理内存。低于 `--min-free-gib` 时安全退出；释放资源后重跑相同命令即可恢复。
- worker 默认每完成 12 种辅序输出一次进度、当前 RSS；长时间没有进度时检查 `procs node`。
- `manifest.json` 记录完成成员和失败；`modes/` 保存成员原始结果；`pairs/` 保存布局对最优结果；`summary.json` 汇总相对 U357／Overall-17 的变化。
- 不要手工编辑检查点。若某个 JSON 损坏，删除该单个文件后重跑；批处理器会只补算缺失成员。
- 输出目录被 Git 忽略。正式结束后只提交精简结果列表、计算代码和研究结论，不提交约 60 MiB 的全部逐辅序结果。

## 完成验收

正式全量完成时应满足：

- `modes/` 有 112 个 JSON，全部 `resultCount=144` 且 `complete=true`；
- `pairs/` 有 56 个 JSON，全部 `complete=true`；
- `summary.json` 的 21×21 有 6 项、21×26 有 50 项；
- U357 为 21×21 来源第 4 名，Overall-17 为 21×26 来源第 17 名；
- 每个布局的 `bestPolicies` 分别来自两个成员自己的 144 种辅序，而不是沿用当前布局族的固定辅序。
