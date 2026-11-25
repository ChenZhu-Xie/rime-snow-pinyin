# 单字最短首选统计

## 本地 DLL 批处理实测

2026-11-25 使用四拼、兰拼、鹤拼、清韵各 1000 个输入对照 Actions 45575500771。Windows 常驻 DLL 在这 4000 个输入上与 CI 首选全部一致；清空后复用会话、逐条新建会话、前缀观测也一致。预热编译产物后，复用会话与前缀的 1／2／4 进程总耗时为 25.11／14.82／8.93 秒，进程合计工作集采样峰值约 366／677／1356 MiB，四进程时系统最低可用内存约 13.56 GiB。各档只测一次，工作集每半秒采样。

同机离线四方案各 8000 字重算共 29.67 秒，采样峰值约 798 MiB；本轮 3180 个预测目标中，3144 条与 CI 路径内最短首选一致，36 条有差异。两组计算范围不同，不能直接折算全量加速比。结果支持复用现有 DLL 查询器承担候选验证，离线逻辑负责路径枚举和预算安排；路径枚举完整性仍决定全局最短性。声笔小鹤、小鹤音形未参与本次性能比较。

实验入口为 `scripts/experiments/benchmark-character-oracle.ts` 与同名 `.ps1`，原始结果和详细报告位于 `output/oracle-comparison/`。调度器限制工作进程合计 4 GiB，要求系统可用内存至少 8 GiB，监测超限后终止实验进程。每进程独立临时目录、关闭学习、独立写缓存。实验编译产物由串行预热生成后供并行进程复制；冷启动和查询分别计时。该本地 benchmark 直接调用 DLL，Mira 功能测试继续按仓库约定运行于 Actions。

## 逐字证据与 CI 预算

限额采集由 `character-budgeted-probes.yml` 手动触发，输入为 `scripts/data/character-budgeted-probes.json`，启动时核对生产提交、每方案预算与前缀完整性。`bun scripts/merge-character-probes.ts <新输出目录> <采集根目录1> <采集根目录2> ...` 合并批次，逐批核对生产来源和运行时二进制 SHA-256，重叠编码的上屏和候选文本必须一致；每批的提交与观测哈希写入合并清单。合并后运行 `audit-character-conflict-probes.ts` 与规划器，更新逐字证据及同类风险。规划器也校验离线预测来源，并将预测文件哈希写入风险档案。

规划器同时保存 `risk-profiles.json`，按 `schema_id` 独立累计特征组合的实测成功数、差异数和失败字例，绑定生产提交及观测文件哈希。特征包括码长、数字或其他入口键、多读音、轻声读音、固顶前缀数量及当前固顶冲突。下一批未验证预测若命中本方案曾失败的组合，优先入队，组内仍按字频排列。特征相似只用于分配预算，不能解释为因果结论或已校准概率。每次基于当前预测和可复用观测重新计算档案，修正后的预测会重新接受检验。

`bun scripts/plan-character-verification.ts <离线目录> <观测目录> <输出目录> [每方案编码预算]` 为十二方案各 8000 字导出 `confidence.tsv`，并生成 `input.json` 和 `summary.json`。默认每个冰雪方案最多 1000 个独立输入，包含必需的全部前缀。已观测的路径直接核对，未观测的预测路径按字频优先入队。已知冲突与缺少预测路径单独标记，需要修复排序或扩展枚举后再验证。

证据状态区分同版本实测达到首选、实测冲突、未实测、缺少路径和外部资料。当前没有经过独立样本校准的百分比置信度。预测码可达首选与全局最短性分列记录，后者仍需覆盖其他更短路径。规划器检查生产提交及观测来源哈希，生产规则变化后会拒绝复用旧观测。队列可交给 `probe-character-first-choice.ts --cases <input.json> --default-only --no-trace` 在 Actions 中采集，关闭详细跟踪以减少日志开销，Mira 输出直接写文件。

## 当前重算结果

当前生产配置已按用户要求临时注释所有 `snow.simplified` 过滤器加载项，`lua/snow/simplified.lua` 源码保留。下述八千字报告采集于停用之前，尚不代表停用后的候选排序；下一轮须使用新引擎指纹重新采集受影响方案，不能直接沿用旧候选观测。

用户复核后，含选重报告已撤去 183 条未经验证的词典码路估算，改为 NA；涉及这些字的总体均键显示「待核实」。当前含选重输出位于 `output/character-full-local/verified-selection/`，已同步至 `reports/`，此前 `final/` 保留为历史稿。78,805 条首选与 1,012 条实测选重记录保持不变。排序目标固定为先最少选重、再最少按键：任何已找到的无选重路径均优先于选重路径；仅未找到首选时才采用实测候选兜底。这里的「未找到」仍限于已枚举路径。

本轮基于生产提交 `5423e381777dc5fae358e773205243468c047e15`，十个冰雪方案各 8000 字已完成本地空词典 DLL 逐键采集，共保存 158344 条前缀观测。78,805 条「方案×字」在枚举路径中获得首选，1,012 条获得首页选重候选证据，183 条仍只有离线词典码路，尚未证明候选可达。后者分布为兰道 17、清韵 130、莲道 18、键道 18。声笔小鹤和小鹤音形继续沿用原有资料，本轮未修改其安装或码表。

各前 500、1000、1500、2000、3000、4000、5000、6000、8000 字分别横评，均键按字等权，选重按约定增加一键。已核对全部 108 个方案与字频范围组合的字数、键数分布、均键和选重数，十二份逐字 TXT 与合并 TSV 逐行一致，末列均为冻结频次。当前横评见 [含选重键数报告](../reports/8000字_十二方案含选重键数.md)，首选口径保留 [首选键数报告与 TSV](../reports/8000字_十二方案最短首选键数.md)。这些结果只证明枚举路径内的最短首选；选重优先使用实测首页候选，未证明所有字的全局最短输入方式。

同字集 8 万条离线预测与 DLL 结果比较，4,378 条首选编码或可达状态不同，其中 2,620 条键数或可达状态不同；键数与可达状态一致率为 96.725%，不能把它解释为全部编码准确率。正式报告用引擎结果替换这十方案的离线排序预测，来源列继续区分观测和未验证资料。冻结字集先筛 `common=1`、按频次降序后取 8000；采集、汇总和导出均核对字集，避免直接截取原表前 8000 行导致分母相同而目标不同。

两进程主采集轮耗时 536.58 秒，合计工作集采样峰值 2.56 GiB，系统最低可用内存 12.68 GiB；该轮复用了早期试跑缓存，不是全冷启动。字集补测另耗时 25.92 秒；完整缓存复算耗时 24.45 秒，新增查询为零（仍独立复查各方案首尾缓存样本），峰值 2.02 GiB、最低可用内存 12.88 GiB。因此采用「离线枚举路径＋常驻 DLL 决定候选＋指纹缓存」；不宣称首次全量采集比纯离线更快，也未使用 GPU。资源上限为采样监测阈值，并非操作系统硬限额。

本轮目录为 `output/character-full-local/`：`run/` 保存逐方案观测与审计，`combined/` 保存合并审计，`observed/` 保存首选修订稿，`final/` 保存含选重稿，`previous-reports/` 保存原报告副本；逐字差异在 `offline-dll-differences.tsv`。原始历史 TSV 保留在既有输出目录和 Git 历史中。

复算入口（PowerShell，须预先设置可用 DLL／共享数据，编译缓存由实验入口预热；字集或规则变化须重新核对来源）：

```powershell
bun scripts/prepare-character-conflict-probes.ts output/character-full-local/input.json --all-characters
$schemas = @('snow_sipin','snow_jiandao','snow_sanpin','snow_qingyun','snow_shenyun_shape','snow_shenyun_tone','snow_jiandao_toned','snow_zhudao','snow_jiandao_classic','snow_sanpin_classic')
& ./scripts/experiments/benchmark-character-oracle.ps1 -Mode collect -Parallelism 2 -Schemas $schemas -InputPath output/character-full-local/input.json -OutputBase output/character-full-local/run
foreach ($schema in $schemas) { bun scripts/audit-character-conflict-probes.ts "output/character-full-local/run/$schema"; if ($LASTEXITCODE) { throw 'Audit failed' } }
bun scripts/merge-character-oracle.ts output/character-full-local
bun scripts/export-character-observed-corrections.ts output/character-full-local/combined/audit.json output/character-first-choice-current output/character-full-local/observed --current-baseline
$observations = $schemas | ForEach-Object { "output/character-full-local/run/$_/results/observations.jsonl" }
bun scripts/export-character-selection-report.ts output/character-full-local/observed output/character-full-local/final @observations
```

采集按物理键数从短到长查询；某字已找到首选后可跳过更长路径，但导出前必须证明没有遗漏更短的枚举前缀。每个输入保留逐键候选读取与字内后置，字间清空输入并关闭学习。同指纹的完整观测可断点续跑，恢复时只截断未写完的末行；重复前缀不一致即失败。生产来源或引擎指纹变化须使用新目录，不能悄悄混用旧缓存。


统计单位是独立单字输入：每个字从空输入和空白用户词典开始，字内仍按生产规则逐键后置。前一个字的上屏、学习或后置历史不会影响后一个字。纳入系统简码、固顶、英数竞争和直出键，不计确认空格、翻页与选重。前 500、1000、1500、2000、3000、4000、5000、6000、8000 字各自一张十二方案横评表；前 m 字只改变分母，不缩小竞争池。

旧版八千字统计已因码路和候选排序错误作废，证据见 [差异审计](../reports/单字首选算法差异审计.md)。`scripts/generate-character-first-choice.ts` 的 v2 默认只写 `output/character-first-choice-v2/` 实验稿，不自动覆盖正式报告。

## 本次修订

- 冰雪四拼执行生产 `speller/algebra`，区分三键音节补 `o` 与四键主码之后的笔画辅助码，覆盖 `souo`（锁）、`buao`（布）及部件入口。
- 普通竞争池纳入英数入口；所有系统固顶按实际 fixed 表读取，不凭「拼系／道系」猜测可保留的码长。范围外字继续参与竞争。
- 冰雪清韵分开读取形码字根与拼音的词典权重，补入普通词语竞争，限制实际码路长度。未完整复现原生翻译器质量、补全与组句，因此仍是近似模型。
- 八套双拼生产方案把原字简体排序移到固顶之前，再运行学习优先与首选后置。修正「后置器记下麽、下游又移走麽，展示首选重新变回魔」的问题；新增真实过滤器回归和冰雪兰拼独立部署的首选断言。
- 冰雪兰拼与冰雪三拼补全 `snow_bushou` 部件反查依赖；不再依赖冰雪四拼先部署后留下的缓存。
- 离线后置保留各前缀的独立历史，限制冰雪的前十候选检查窗口；没有新候选时优先返回最近出现的旧首选。

默认简体原字偏好使用冻结的 OpenCC 1.1.9 单字转换数据，见 `scripts/data/character-script-preference.json` 中的来源、许可与摘要。它不能代替真实部署使用的 OpenCC 版本和短语上下文。

## 内存与运行

```powershell
bun scripts/generate-character-first-choice.ts --max-memory-mib 1024
```

十二方案逐一启动独立子进程，每次只运行一个；码路较多的冰雪方案再按编码首键分批，清韵一次流式扫描普通词典。字典流式读取，每码仅保留足以决定首选的竞争前列，前缀历史使用不可变链共享。声笔扩展表也流式读取，不再构造百万条词记录的内存数组。每方案快照写入输出目录下的 `.workers/`，全部成功后才生成九张横评表及逐字 TSV。

1024 MiB 是单进程采样检查阈值：超过时尝试完整回收，回收后仍超过即停止。它不是操作系统硬限额，瞬时峰值及父进程内存另计。失败时不生成新的总报告；输入文件摘要不一致也会中止，以防另一个会话改动源码后混入不同时刻的数据。

本地可按用户授权运行独立 DLL benchmark；Mira 真实候选回归仍只在 GitHub Actions 运行。「单字首选隔离诊断」保存逐键候选证据。Mira 下载资产必须核对实际 SHA-256，不把不同文件名当成独立内核版本。

## 尚未解决的边界

多音字辅助码仍需对齐生产译文的实际读音；例如冰雪鹤拼的「倒」不能仅把全部声调无条件并入所有音码。冰雪清韵的双翻译器排序、冰雪四拼的补全与形辅刷新，以及声笔的完整 Lua 路由也未全部等价复现。已有赛文缓存可能包含不同的候选状态，其一致率只作诊断，不代表八千字准确率。

CKT 的理想化消重与本任务包含生产简码、英数入口和固顶的口径不同。不能要求每个非一简字都打满全码，也不能用旧首选在所有后续阶段永久退出的理想模型替代生产候选行为。

## 冲突字逐键实测（2026-11-25）

[显式逐键读取候选的采集](https://github.com/ChenZhu-Xie/rime-snow-pinyin/actions/runs/45448955404) 与 [原版 Mira 对照](https://github.com/ChenZhu-Xie/rime-snow-pinyin/actions/runs/45446637815) 均成功，对全部 1638 个「方案—字」组合的最短码审计结论一致。各输入使用独立会话，禁用用户词典；保留字内生产首选后置。1631 个组合在枚举路径中找到首选，7 个未找到；旧模型的 1046 个最短码实际非首选，合计 1198 条最短码记录变化（包括改为未找到）。这批目标专门来自冲突，不能将比例解释为全八千字准确率。

已核实：冰雪四拼「唤」的 `hioai` 为五键首选，部件路径 `hi1ko` 也为五键；冰雪兰道「脚」为 `jquv`，冰雪鹤道「什」为 `vdiuo`，冰雪鹤拼「难」为 `nle`，冰雪莲道「完」为 `wkoo`，冰雪键道「而」为 `xjvu`，冰雪三拼「招」为 `qzi`。

与用户本机观察仍有差异：当前仓库的冰雪兰拼 `sro` 首选「撑」，其词典确有 `cheng5`；冰雪清韵 `fp` 首选「🈚️」，`fpa` 首选「呆」；冰雪鹮道 `xsoe` 首选「壮」，本次找到的「章」最短为 `xxoeu`。两轮引擎观测相同，尚不能确定与本机的差异来源，不能按人工预期直接覆盖实测。

尚未找到首选的组合为：冰雪兰道「釐」、冰雪鹤拼「势」、冰雪莲道「掬／釐」、冰雪键道「月／欻／釐」。这里的未找到只针对已枚举码路，不证明实际无法首选。

用 `bun scripts/audit-character-conflict-probes.ts <采集目录>` 审计完整观测，再用 `bun scripts/export-character-observed-corrections.ts <audit.json>` 导出 `output/character-first-choice-v3/`。修订稿包含九张十二方案横评表、逐字 TSV 和十二份按字频排序的 TXT，TXT 末列为冻结频次，来源列区分真实引擎观测和未验证离线预测。原始 v2 TSV 保留，SHA-256 为 `2902203cf9dcc97a1e54baaa71386e00a0b629fc7bc9aa1792d1b78992efc707`。声笔小鹤、小鹤音形以及其余未采集的字仍未得到这轮真实引擎验证，v3 不能作为全量实测报告。

严格逐键采集耗时 40 分 6.59 秒，`time -v` 记录最大进程 RSS 为 707988 KiB（约 691 MiB），不代表整台 runner 的总占用。

## 无首选时加一键选重

按用户指定的统一计费假设，没有首选记录的字可以通过候选编码选重，编码长度之外再加一键；不计实际翻页或多次导航。已有首选记录继续使用首选码，不在这轮比较所有字是否有更短的选重路径。因此这是「优先首选、无首选则选重」的估算，不能称为所有输入方式的严格全局最短。

`bun scripts/export-character-selection-report.ts [v3目录] [输出目录]` 默认写入 `output/character-first-choice-v4/`，九张表统一采用「方案｜均键｜选重｜各键数分布」列序。均键按各前 m 字等权计算，包含选重额外的一键；选重显示字数与占 m 的比例，各键数分布也包含该额外按键。原有 v2、v3 的首选数据和 TSV 保留，新 TXT 与新 TSV 的末列均为冻结频次。

选重路径优先比较可见实测候选和离线词典码路，来源列区分证据。离线兜底使用至少两键的音码或形码，避免把词典读音直接当成一键固顶候选；声笔小鹤与小鹤音形使用各自发布码表。十二方案的 8000 字全部找到词典码路，但其中未实测的码路不证明实际候选可达或码长最优，尤其不能排除翻译器分段和过滤器的影响。纯离线算法尚未与真实引擎完全等价，v3 的冲突字更正也依赖真实引擎观测，不能宣称已经完全摆脱 librime 校验。

## 本轮验证

最后一次本地全套生成与语料检查通过 287 项，针对性回归通过 56 项，TypeScript 类型检查通过。十二方案离线复算已在独立子进程模式下完成；冰雪方案结束时 RSS 约 500–715 MiB，父进程另计。实验稿保留全部九种前 m 字口径、逐字最短编码、缺测字和缓存差异。

[Actions 首选诊断](https://github.com/ChenZhu-Xie/rime-snow-pinyin/actions/runs/45431843271) 已确认冰雪兰拼 `mjv → 摩`、`mjvo → 魔`、`mjvov → 磨`。[首轮完整回归](https://github.com/ChenZhu-Xie/rime-snow-pinyin/actions/runs/45431829870) 七套方案通过，冰雪兰拼 188 项中仅部件辅助码 `rzv1k` 失败，并报告缺少 `snow_bushou.reverse.bin`；据此补齐兰拼与三拼的显式部署依赖后再复核。该轮资源记录的单进程最大 RSS 为 653648 KiB（约 638 MiB），并非整台 runner 的总占用。

补齐依赖后的 [八方案完整候选回归](https://github.com/ChenZhu-Xie/rime-snow-pinyin/actions/runs/45433426968) 全部通过，最大单进程 RSS 653872 KiB（约 639 MiB）。[同提交总门禁](https://github.com/ChenZhu-Xie/rime-snow-pinyin/actions/runs/45433341992) 的延迟、词典、映射及已获得 runner 的键位图作业通过；macOS ARM 作业首次未启动即被取消，重试仍待分配 runner，不能据此声称整个总门禁已通过。

报告一致性核对已确认九张表各有十二方案、TSV 有 8000 个字、每个分布加缺测数等于对应 m、均值计算一致，且全部记录的输入 SHA-256 与生成后文件相符。缓存重合编码首选一致率为：冰雪四拼 2671/3266（81.78%）、冰雪清韵 2664/2691（99.00%）、声笔小鹤 1526/1526（100%）；各方案重合编码数与旧版不同，且缓存对应旧部署，不能作为同分母的精度提升或八千字准确率。清韵仍有 847 个字未找到模型首选，故不得把这份实验稿当作最终实测排名。
