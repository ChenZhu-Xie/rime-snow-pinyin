# 下一代双拼布局迁移设计

## 意图

将冰雪简道、冰雪散拼的现行 21×26 双拼替换为 benchmark 的 `SNOW-SHENYUN-21X26-D3V1-BALANCED`，将冰雪健道、冰雪弎拼的现行 21×21 双拼替换为 `QZ-e8f37a0998f9`。四个现有 `·初代` 方案继续完整保留迁移前布局，使用户能够在新布局投产后继续使用旧键位，并让报告能够直接比较两代布局。

## 目标

- 以机器可读映射为唯一活动布局源，更新四个原方案的声母、韵母、辅序、拼写代数、固顶词、辅助码、空槽、英数入口、键位图和测试。
- 冰雪简道与冰雪散拼采用 D3/V1 21×26 映射；冰雪健道与冰雪弎拼采用 QZ-e8f37a 21×21 映射。
- 保持 21×26 的 `shapeKeysByMeaning=AEUIO`、`toneKeysByTone=IEUAO`，保持 21×21 的 `shapeKeysByMeaning=AVUIO`、`toneKeysByTone=IVUAO`；两者继续通过 `42310` 往返检查。
- README 只把新布局作为四个原方案的现行布局，旧 Overall-17、U357 的映射、指标和图表由新布局内容直接替换。
- reports 保留旧布局并追加新布局：核心布局比较从原来的 Overall-17、U357、S005 三个排名对象扩为 D3/V1、QZ-e8f37a、Overall-17·初代、U357·初代、S005 五个排名对象；B04 继续作为独立外部参照，不参与这五者的星级排名。
- 500 字和 5000 字全量实测把四个 `·初代` 方案作为独立方案加入：冰雪内部八方案扩为十二方案，加入声笔小鹤后为十三方案，再加入小鹤音形后为十四方案。
- 保持冰雪系基于 `snow_pinyin` 的 Rime 上屏学习频次和用户词条全方案共享；只隔离依赖物理输入码的 Lua 固顶数据库。

## 非目标

- 不改四个 `·初代` 方案的双拼布局、fixed、子方案、形辅映射、键位图或测试快照；初代主 schema 唯一允许的兼容性改动是显式接管对应的迁移前固顶库名。
- 不改变冰雪四拼、冰雪一拼、冰雪清韵、冰雪键道、冰雪三拼及两个外部方案的编码合同。
- 不重新设计五辅键语义、公共 Lua 组件、Rime 用户词典格式或固顶数据库格式。
- 不把 benchmark 仓库的大型缓存或本地集成材料复制进本仓库；只固化复算所需的映射、来源元数据和最终报告数据。
- 不在本机运行 Mira；真实候选验证仍只通过 GitHub Actions 的 librime 1.13.1 与 1.17 矩阵执行。

## 约束与不可变边界

- 四个 `·初代` fixed 文件和四张键位图已有 SHA-256 回归测试，迁移前后哈希必须完全相同。
- 初代方案内部引用必须继续指向 `_first` 公共配置、子方案、棱镜和形辅映射，不能通过活动映射生成器间接更新。
- 原四方案保留 schema_id，现有用户配置无需改名。
- Rime 上屏学习频次与用户造词继续通过共同的 `dictionary: snow_pinyin` 落入 `snow_pinyin` 用户库；其键是规范拼音音节，不因双拼物理键迁移而拆库或重编码。
- Lua 固顶库保存物理输入码，必须一方案一库。迁移前四个活动方案的旧固顶库转交对应 `·初代` 方案；四个新布局使用新的版本化固顶库；冰雪键道、冰雪三拼使用各自 schema_id 对应的固顶库，不再借用冰雪健道、冰雪弎拼的库。
- 生成器、生成产物、README、reports 和测试必须同步迁移，不能只手改 YAML 或文档。
- README 的简体中文、英文、繁体中文三段同步替换；reports 中原布局数据不删除，新增布局与初代方案并列呈现。

## 来源与活动映射

### 21×26：D3/V1 综合旗舰

来源方案为 `SNOW-SHENYUN-21X26-D3V1-BALANCED`，完整映射来自 benchmark 的 `tools/integrate_shenyun_21x26_balanced_flagship.py`，稳健辅序与 CKT v5.1 数据来自 `research/notes/2026-11-09-d3v1-ckt-v51-soft-balance-aux-order-robustness.md`。

- 声母：`b=B, p=P, m=M, f=F, d=D, t=T, n=N, l=L, g=G, k=K, h=H, j=J, q=F, x=Y, zh=S, ch=X, sh=V, r=R, z=Z, c=C, s=Q, A/E/O=Y, W=J, Y/YU=W`。
- 韵母：`a=A, ai=F, an=L, ang=N, ao=K, e=H, ei=E, en=D, eng=J, er=E, i=I, ia=R, ian=S, iang=X, iao=Z, ie=C, in=B, ing=Q, iong=G, iu=V, o/uo=O, ong=R, ou=Y, u=U, ua=S, uai=W, uan=M, uang=C, ui=P, un=G, v=P, van=M, ve=T, vn=W`。
- 审计指标：21×26，M=40、D=3、V=1，Common399 为 399/399 唯一。
- 冰雪简道稳健辅序：`12/12/24`。
- 冰雪散拼稳健辅序：`12/21/13`。
- 柔性词长平衡合同保持 `soft-page-fill-v2`；CKT v5.1 双成员归一分为 `9.10299979136027`。

### 21×21：QZ-e8f37a

来源方案为 `QZ-e8f37a0998f9`，完整状态来自 benchmark 的 `tools/integrate_a7_qz_empty_six.py` 及其 `stateKey`，稳健辅序与 CKT v5.1 数据来自 `research/notes/2026-11-09-e8f37a-ckt-v51-aux-order-robustness.md`。

- 声母：`b=B, p=P, m=M, f=F, d=D, t=T, n=N, l=E, g=G, k=P, h=H, j=J, q=Q, x=X, zh=K, ch=S, sh=L, r=R, z=Z, c=C, s=S, A/O=R, E=C, W=W, Y/YU=Y`。
- 韵母：`a=P, ai=N, an=M, ang=Y, ao=Z, e=S, ei=L, en=D, eng=T, er=J, i=F, ia=L, ian=J, iang=P, iao=Q, ie=C, in=R, ing=K, iong=H, iu=B, o=G, ong=L, ou=W, u=H, ua=Q, uai=X, uan=E, uang=C, ui=R, un=G, uo=K, v=D, van=T, ve=E, vn=G`。
- 审计指标：21×21，M=42、D=2、V=5，QZ 与 ZQ 为空桶，Common399 为 399/399 唯一。
- 冰雪健道稳健辅序：`12/213/24`。
- 冰雪弎拼稳健辅序：`12/213/23`。
- 保持传统 21×21 原生路由；CKT v5.1 双成员归一分为 `9.56789806405906`。

## 选定方案与备选方案

### 选定：生成器优先迁移

更新活动机器映射和生成器，让所有活动产物从新映射稳定复算；初代方案使用冻结文件单独进入报告。优点是单一真源、可重复生成、后续不会被旧生成器覆盖，且能用测试守住新旧边界。

### 未选：直接修改生成产物

只改 schema、fixed、README 和报告，短期文件较少，但下一次运行现有生成器会恢复旧布局，无法满足仓库的同步约定。

### 未选：把全部布局版本重构为通用参数

长期抽象更统一，但会把本次迁移扩大为生成系统重构，增加无关风险；当前仅需活动布局加冻结初代入口，不需要通用版本框架。

## 实现结构

### 映射与生成链

- `config/shenyun-21x26-mapping.json` 改为 D3/V1 的完整映射、来源、M/D/V、唯一性和 CKT 审计值。
- `config/shenyun-21x21-mapping.json` 改为 QZ-e8f37a 的完整映射、stateKey、来源、M/D/V、空桶和 CKT 审计值。
- `scripts/生成神韵映射.ts`、`scripts/验证神韵双拼.ts` 和对应固定语料测试改用新 ID 与新摘要，生成当前 21×21 映射快照。
- 两组活动 schema 的 algebra、prism、空桶规则、简拼/字母/数字规则及辅助码路径按新映射重算；初代 schema 继续读取冻结的 `_first` 资源。
- 固顶生成器和 `align-fixed-with-sipin.ts` 只更新六份活动/经典目标中的四份活动方案，不把四份 `_first.fixed.txt` 纳入写入目标。
- 形辅元素到物理键的语义仍由五辅语义转换；活动 `radical_jiandao.txt`、`radical_sanpin.txt` 随新声韵空间重算，`radical_*_first.txt` 不变。
- 键位图生成器改用新布局名称和映射生成活动 SVG；初代 SVG 不参与生成覆盖并继续受哈希测试保护。

### 用户数据边界

- `Memory`、原生翻译器和学习优先级层继续读取同一个 `snow_pinyin` 用户库，使各冰雪拼音方案共享已上屏词频与用户造词。共享的是规范拼音音节和词条，不是双拼键位。
- `lua/snow/user_dict.lua` 与 `lua/snow/fix.lua` 使用的固顶 LevelDB 按物理编码解释，必须隔离。四个 `·初代` 方案显式接管迁移前的 `snow_jiandao`、`snow_sanpin`、`snow_shenyun_shape`、`snow_shenyun_tone` 固顶库，使旧布局的已有固顶继续有效。
- 四个活动新布局改用 `snow_jiandao_qz_e8f37a`、`snow_sanpin_qz_e8f37a`、`snow_shenyun_shape_d3v1`、`snow_shenyun_tone_d3v1`，从空白固顶状态重新学习，避免把旧物理码误解释为新布局。
- 冰雪键道和冰雪三拼分别使用 `snow_jiandao_classic`、`snow_sanpin_classic` 固顶库，取消当前指向 `snow_jiandao`、`snow_sanpin` 的兼容别名。任何时刻不存在两个发布方案同时读写同一个固顶库。
- 本次只改变固顶库的配置归属，不复制、不改写 LevelDB 内容，也不触碰共享的 `snow_pinyin` 用户库；输入统计仍按各自 schema_id 记录，不与候选学习频次混为一类。

### README

- `README_CN.md` 与 `README.md` 中现行 21×26 章节全部替换为 D3/V1：来源、声韵表、M/D/V、唯一性、稳健辅序、CKT、英数入口、数字码和新键位图/热力图数据同步更新。
- 现行 21×21 章节全部替换为 QZ-e8f37a，删除把 U357 当作现行布局的描述，更新映射、空桶、M/D/V、辅序、CKT、英数入口、数字码和图表。
- 初代方案只保留一段兼容性说明，表明它们冻结迁移前布局并可继续使用；README 不再展开旧 Overall-17/U357 的映射和 benchmark 表格。
- README 的比较表只展示新现行布局与当前基准数据；需要同时看两代的五方案比较统一链接到 reports。
- 同步更新 `scripts/更新神韵README.ts` 和 `scripts/lib/shenyun-markdown.ts`，保证重跑不会恢复旧名称或链接。

### reports 与实测流水线

- 核心比较报告保留 Overall-17、U357 的历史数据，追加 D3/V1 与 QZ-e8f37a；星级排名对象从三者扩为五者：D3/V1、QZ-e8f37a、Overall-17·初代、U357·初代、S005。B04 继续独立比较，总表实际为六列方案。
- `scripts/lib/benchmark-schemes.ts` 增加四个初代 benchmark scheme，分别读取 `_first` schema/fixed/形辅映射；活动四方案改名为 D3/V1/QZ-e8f37a，不能复用初代的活动映射对象。
- `scripts/生成神韵500字实战测评.ts` 与 `scripts/generate_full_benchmark_reports.ts` 生成十二方案结果、逐句回放、汇总 JSON 和纯文本对齐汇编。
- `scripts/benchmark-sbxh-5000.ts` 以十二方案结果为基线追加声笔小鹤，生成十三方案报告。
- `scripts/benchmark-flypy-5000.ts` 以十三方案结果为基线追加小鹤音形，生成十四方案报告。
- 新文件使用“十二方案／十三方案／十四方案”命名；现有八／九／十方案报告文件保留，作为迁移前历史数据，不删除、不覆盖。
- 十篇逐篇 500 字回放同时生成十二、十三、十四方案目录；5000 字汇总和独立第 10 篇赛文均含四个初代方案。
- `scripts/生成神韵5500字键频图.ts` 从新的十四方案回放复算活动 D3/V1、QZ-e8f37a 图；如报告需要展示初代差异，则在机器 JSON 中同时保留初代聚合，但 README 只嵌入活动布局图。

## 测试设计

- 先扩展布局测试，以 benchmark 中的完整声母、韵母、M/D/V、Common399 唯一性、QZ/ZQ 空桶及两组稳健辅序为预期；在修改映射前确认测试因仍是旧布局而失败。
- 先扩展初代冻结测试，覆盖四个主 schema、公共/子 schema、fixed、形辅映射和键位图哈希；迁移后确认这些哈希不变。
- 为生成器添加活动/初代输入分离测试：活动方案必须读取新映射，初代方案必须读取 `_first` 文件，任何活动配置引用 `_first` 或初代配置引用活动布局都失败。
- 为报告生成器添加方案数量、顺序、schema_id、显示名、fixed 来源和文件命名断言：12 个内部、13 个加声笔小鹤、14 个再加小鹤音形。
- 为 README 添加替换断言：现行章节出现 D3/V1、QZ-e8f37a 及新数据，不再把 Overall-17/U357 描述为现行布局；reports 则必须同时出现新旧两代。
- 为用户数据边界添加静态回归：十三个发布方案的固顶库名全部唯一；四个初代方案接管四个旧库名；四个活动新布局使用版本化新库；所有基于拼音的学习命名空间仍解析到 `snow_pinyin` 用户库。
- 本地运行格式、类型、固定语料、映射生成 `--check`、固顶生成 `--check`、词典编码、键位图 helper、移动皮肤和报告生成检查；不运行本地 Mira。
- 推送后等待 GitHub Actions 的 13 方案 × 2 librime 版本全部通过，再核对 GitHub、Gitee 与本地提交一致。

## 成功标准

- 四个原方案实际编码与指定 benchmark 映射、辅序一致，完整音节检查和候选回归通过。
- 四个 `·初代` 方案的全部冻结哈希与迁移前一致，且真实 Mira 用例继续通过。
- README 只把 D3/V1 和 QZ-e8f37a 作为现行双拼布局，三语内容与新图表一致。
- reports 中旧布局数据仍可见，并新增五方案核心比较及十二／十三／十四方案的 500 字、5000 字完整结果。
- 四个初代方案可继续使用迁移前固顶记录，四个活动新布局不会读取旧物理码；冰雪系的 `snow_pinyin` 上屏学习频次和用户词条仍跨方案共享。
- 所有生成命令可重复执行且 `--check` 无差异，工作区最终干净，双远端提交一致。
