# 神韵 R9：公平对比

数据取自 [双拼布局 Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark) 的 HTML payload。目标方案为 [R9-21X21-M40-02](https://github.com/more-14-different/shuangpin-layout-benchmark)；[S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 是同为 21×21 的原键道基线，[B04 首道](https://sspai.com/post/108949)是 26×26 的同环境基线。三者共用 [Common399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin)、冻结 20 合同、字词与形码资料及模型；[B04](https://sspai.com/post/108949) 不能被称为“同键域”比较。

完整原始字段保存在 [shenyun-r9-comparison.json](shenyun-r9-comparison.json)。报告没有把 [MX34](https://macroxue.github.io/shuangpin/eval.html) 当作端到端输入速度：它不含声调、形辅、空格和选重；v6-CW150 也排除抽象 S2，150ms 是工程情景而非实测校准。

## 总览

| 指标 | 神韵 R9（21×21） | [原键道 S005（21×21）](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04（26×26）](https://sspai.com/post/108949) | 何为好 |
| --- | --- | --- | --- | --- |
| [M-R2](https://github.com/more-14-different/shuangpin-layout-benchmark) 记忆项 | 40 | 44 | 51 | 越低越好 |
| 普通声母偏移 D | 0 | 0 | 0 | 越低规则越接近原键 |
| a/e/i/o/u 韵键偏移 V | 5 | 4 | 0 | 越低越接近字母原键 |
| [共同 399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin) 覆盖 | 399/399 | 399/399 | 399/399 | 必须完整覆盖 |
| 不同二键码 | 373 | 372 | 399 | 越高重码越少 |
| 裸 S2 [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing)（ms/项） | 70.1891 | 82.0288 | 79.8901 | 越低越好 |
| 规则补全 [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing)（ms/项） | 82.9727 | 90.2571 | 79.8901 | 越低越好；仅为固定五进制补全模型 |
| [系综当量 v5](https://github.com/more-14-different/shuangpin-layout-benchmark) | 10.3978 | 11.479 | 11.0912 | 越低越好 |
| [系综当量 v4](https://github.com/more-14-different/shuangpin-layout-benchmark) | 10.7422 | 10.8058 | 10.5833 | 越低越好 |
| [系综当量 v4-C](https://github.com/more-14-different/shuangpin-layout-benchmark) | 10.7422 | 10.8058 | 10.5833 | 越低越好；公开例外键表敏感性 |
| [系综当量 v6-CW150](https://github.com/more-14-different/shuangpin-layout-benchmark) | 9.4958 | 10 | 9.5896 | 越低越好；排除 S2 |
| [LU-v1r](https://github.com/more-14-different/shuangpin-layout-benchmark) | 75.0177 | 78.8976 | 83.1074 | 越高规则一致性越强 |
| S2 同指连击率 | 3.35% | 11.64% | 11.34% | 越低越好 |
| S2 同键率 | 2.87% | 5.06% | 4.56% | 越低越好 |
| S2 左右手交替率 | 56.22% | 53.84% | 56.33% | 越高通常越利于交替；非独立速度结论 |
| S2 主键区占比 | 51.93% | 49.00% | 36.60% | 越高越集中于主键区 |
| 日常纯汉字 [MX34](https://macroxue.github.io/shuangpin/eval.html) 得分 | 140.6807 | 134.609 | 138.6378 | 同文稿越高越好；不含消歧 |
| 默认说明兼容标点 [MX34](https://macroxue.github.io/shuangpin/eval.html) 得分 | 145.918 | 153.6883 | 156.1501 | 同文稿越高越好；敏感性对照 |

## 补充负载与键区指标

| 指标 | 神韵 R9（21×21） | [原键道 S005（21×21）](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04（26×26）](https://sspai.com/post/108949) | 何为好 |
| --- | --- | --- | --- | --- |
| S2 主键区 | 51.93% | 49.00% | 36.60% | 越高越集中 |
| C4-Snow 主键区 | 35.08% | 30.81% | 24.24% | 越高越集中 |
| WX-Snow-12 主键区 | 37.80% | 37.02% | 29.39% | 越高越集中 |
| 含辅主键区下限 | 35.08% | 30.81% | 24.24% | C4/WX 两合同取低值；越高越集中 |
| C4 上排 | 47.63% | 51.35% | 68.21% | 描述性 |
| C4 主行 | 35.08% | 30.81% | 24.24% | 描述性 |
| C4 下排 | 17.30% | 17.83% | 7.54% | 描述性 |
| WX 上排 | 41.08% | 40.48% | 55.68% | 描述性 |
| WX 主行 | 37.80% | 37.02% | 29.39% | 描述性 |
| WX 下排 | 21.13% | 22.50% | 14.93% | 描述性 |
| 含辅上下排差峰值 | 30.33% | 33.52% | 60.67% | 区间指标；越接近 0 越均衡 |
| 下/上排最低比 | 36.31% | 34.73% | 11.06% | 描述性；不是独立速度指标 |
| 14 远键单键峰值 | 6.87% | 8.01% | 7.70% | 越低表示指定键组的单键峰值更低 |
| W 单键 20 合同峰值 | 3.62% | 7.29% | 5.98% | 描述性 |
| Y 单键 20 合同峰值 | 6.87% | 8.01% | 7.70% | 描述性 |
| 右小指 20 合同峰值 | 5.10% | 2.77% | 1.89% | 越低峰值越小 |
| 右小指峰值合同 | W4-common | W4-Snow | W4-Snow | 定位峰值来源 |
| 左小指 20 合同峰值 | 17.46% | 17.16% | 16.66% | 越低峰值越小 |
| 左小指峰值合同 | W6-Snow | W6-Snow | W6-Snow | 定位峰值来源 |
| 最大单指 20 合同峰值 | 26.17% | 29.53% | 29.27% | 越低峰值越小 |

## 消歧、音形与选重敏感性

| 指标 | 神韵 R9（21×21） | [原键道 S005（21×21）](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04（26×26）](https://sspai.com/post/108949) | 何为好 |
| --- | --- | --- | --- | --- |
| [共同 399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin) 唯一码 | 373 | 372 | 399 | 越高越好 |
| [共同 399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin) 碰撞音节 | 26 | 27 | 0 | 越低越好 |
| 补全后平均键数 | 2.1074 | 2.0725 | 2 | 越低越好 |
| 补全额外键数 | 0.1074 | 0.0725 | 0 | 越低越好 |
| 补全最长后缀 | 1 | 1 | 0 | 越低越好 |
| S2 非首选权重 | 2.78% | 0.93% | 0.00% | 越低越好 |
| 单字含形辅非首选权重 | 1.47% | 1.35% | 1.30% | 越低越好 |
| 二字词含形辅非首选权重 | 3.19% | 3.00% | 2.96% | 越低越好 |
| v5-S(0ms) | 10.4044 | 11.4845 | 11.0962 | 同 τ、同合同越低越好 |
| v5-S(150ms) | 10.6 | 11.4768 | 11.0102 | 同 τ、同合同越低越好 |
| v5-S(300ms) | 10.8155 | 11.5023 | 10.9572 | 同 τ、同合同越低越好 |
| v5-S(600ms) | 11.3059 | 11.6006 | 10.893 | 同 τ、同合同越低越好 |

## [系综当量 v6-CW150](https://github.com/more-14-different/shuangpin-layout-benchmark) 及敏感性

| 指标 | 神韵 R9（21×21） | [原键道 S005（21×21）](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04（26×26）](https://sspai.com/post/108949) | 何为好 |
| --- | --- | --- | --- | --- |
| v6-CW150 | 9.4958 | 10 | 9.5896 | 越低越好 |
| v6 选重敏感性 0ms | 9.4348 | 10 | 9.592 | 排除 S2；同 τ 越低越好 |
| v6 选重敏感性 150ms | 9.4958 | 10 | 9.5896 | 排除 S2；同 τ 越低越好 |
| v6 选重敏感性 300ms | 9.5462 | 10 | 9.589 | 排除 S2；同 τ 越低越好 |
| v6 选重敏感性 600ms | 9.6258 | 10 | 9.5901 | 排除 S2；同 τ 越低越好 |
| v6 中心分 | 9.4909 | 10 | 9.5809 | 越低越好 |
| 保护项均值（ms/项） | 11.4304 | 11.4304 | 11.4304 | 越低越好 |
| 原生键覆盖 | 100.00% | 100.00% | 100.00% | 越高越好 |
| 长码占比 | 37.33% | 37.33% | 37.33% | 描述性 |

## 结论

- 对同键域 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)，神韵 R9 的核心优势集中在裸 S2 [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing)、同指连击、主键区覆盖和 [MX34](https://macroxue.github.io/shuangpin/eval.html) 文稿路径；代价是 26 个加权非首选音节、规则补全额外键、部分含形辅合同的峰值负载，以及规则一致性并非每项占优。
- 对 26×26 的 [B04 首道](https://sspai.com/post/108949)，神韵 R9 不能宣称全指标支配。它用更小的 21×21 键域换取较好的若干裸码路径指标，但 [B04](https://sspai.com/post/108949) 在 399 唯一码、零 S2 消歧、部分小指/行区负载及若干综合分上有明确优势。
- 补充指标把“快”拆成了不同边界：冻结合同 [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing)、v4/v5/v6、20 合同峰值、[MX34](https://macroxue.github.io/shuangpin/eval.html) 文稿移动手回放与选重敏感性必须分开读。神韵 R9 是综合折中前沿，不是每一列都最优。
- 日常八场景 [MX34](https://macroxue.github.io/shuangpin/eval.html) 曾参与来源报告的搜索目标；原站默认说明轨道是未用于该轮目标的敏感性对照。两者都仍是模型值而非真人测速。

## 冻结 20 合同逐项对比

每个方案依次列主键区、左小指、右小指、[CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing)（ms/项）与非首选权重。

| 合同 | 神韵 R9（21×21） 主键区 | 左小指 | 右小指 | [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing) | 非首选 | [原键道 S005（21×21）](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 主键区 | 左小指 | 右小指 | [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing) | 非首选 | [首道 B04（26×26）](https://sspai.com/post/108949) 主键区 | 左小指 | 右小指 | [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing) | 非首选 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S2 | 51.93% | 8.00% | 4.18% | 70.189 | 2.78% | 49.00% | 6.72% | 2.15% | 82.029 | 0.93% | 36.60% | 6.78% | 1.26% | 79.89 | 0.00% |
| C2 | 56.65% | 6.95% | 1.97% | 65.562 | 12.62% | 48.15% | 6.39% | 1.06% | 82.812 | 12.70% | 35.05% | 7.44% | 0.59% | 81.417 | 12.13% |
| C3 | 48.49% | 15.36% | 1.31% | 191.826 | 5.55% | 42.82% | 14.98% | 0.71% | 210.628 | 5.38% | 34.09% | 15.68% | 0.39% | 203.409 | 5.20% |
| C4-Snow | 35.08% | 10.14% | 0.99% | 332.479 | 1.47% | 30.81% | 9.86% | 0.53% | 342.151 | 1.35% | 24.24% | 10.39% | 0.29% | 328.392 | 1.30% |
| C4-SBxh | 37.02% | 12.18% | 0.98% | 338.38 | 2.32% | 32.78% | 11.90% | 0.53% | 348.322 | 2.22% | 26.23% | 12.42% | 0.29% | 328.6 | 2.15% |
| C4-SBzr | 37.02% | 12.18% | 0.98% | 338.38 | 2.32% | 32.78% | 11.90% | 0.53% | 348.322 | 2.22% | 26.23% | 12.42% | 0.29% | 328.6 | 2.15% |
| C5-TX2 | 34.49% | 14.56% | 0.79% | 457.158 | 0.39% | 31.09% | 14.33% | 0.43% | 479.32 | 0.35% | 25.83% | 14.76% | 0.24% | 458.582 | 0.32% |
| W4-Snow | 49.25% | 8.03% | 5.02% | 375.545 | 17.88% | 48.08% | 7.59% | 2.77% | 390.103 | 16.45% | 36.64% | 6.84% | 1.89% | 375.218 | 15.98% |
| W4-SBxh | 51.95% | 7.94% | 5.05% | 370.153 | 22.43% | 48.28% | 8.26% | 2.38% | 387.659 | 20.68% | 36.74% | 6.10% | 1.04% | 372.311 | 20.42% |
| W4-SBzr | 51.71% | 7.41% | 5.07% | 370.334 | 22.27% | 48.67% | 7.85% | 2.38% | 387.41 | 20.58% | 36.80% | 5.78% | 1.29% | 372.109 | 20.33% |
| W4-common | 52.11% | 7.47% | 5.10% | 368.03 | 22.10% | 48.73% | 8.00% | 2.40% | 385.62 | 20.30% | 36.12% | 5.76% | 1.00% | 370.704 | 20.10% |
| W4-union | 49.26% | 8.04% | 5.02% | 375.627 | 18.63% | 48.06% | 7.61% | 2.77% | 390.236 | 17.20% | 36.69% | 6.84% | 1.89% | 375.328 | 16.72% |
| W6-Snow | 44.93% | 17.46% | 3.35% | 676.001 | 4.27% | 44.15% | 17.16% | 1.85% | 689.547 | 3.84% | 36.53% | 16.66% | 1.26% | 652.086 | 3.78% |
| W6-21 | 44.93% | 17.46% | 3.35% | 674.105 | 4.27% | 44.15% | 17.16% | 1.85% | 690.068 | 3.84% | 36.53% | 16.66% | 1.26% | 650.247 | 3.78% |
| WX-Snow-12 | 37.80% | 10.32% | 3.35% | 665.167 | 3.19% | 37.02% | 10.03% | 1.85% | 678.664 | 3.00% | 29.39% | 9.53% | 1.26% | 643.221 | 2.96% |
| WX-Snow-21 | 37.80% | 10.32% | 3.35% | 665.093 | 3.19% | 37.02% | 10.03% | 1.85% | 677.922 | 3.00% | 29.39% | 9.53% | 1.26% | 642.94 | 2.96% |
| WX-SBxh-12 | 36.56% | 9.09% | 3.35% | 669.938 | 3.42% | 35.78% | 8.79% | 1.85% | 683.579 | 3.18% | 28.16% | 8.29% | 1.26% | 643.874 | 3.13% |
| WX-SBxh-21 | 36.56% | 9.09% | 3.35% | 669.637 | 3.42% | 35.78% | 8.79% | 1.85% | 683.104 | 3.18% | 28.16% | 8.29% | 1.26% | 643.038 | 3.13% |
| WX-SBzr-12 | 36.56% | 9.09% | 3.35% | 669.938 | 3.42% | 35.78% | 8.79% | 1.85% | 683.579 | 3.18% | 28.16% | 8.29% | 1.26% | 643.874 | 3.13% |
| WX-SBzr-21 | 36.56% | 9.09% | 3.35% | 669.637 | 3.42% | 35.78% | 8.79% | 1.85% | 683.104 | 3.18% | 28.16% | 8.29% | 1.26% | 643.038 | 3.13% |

## [MX34](https://macroxue.github.io/shuangpin/eval.html) 四轨完整指标

### 日常八场景＋兼容标点

| 指标 | 神韵 R9（21×21） | [原键道 S005（21×21）](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04（26×26）](https://sspai.com/post/108949) | 何为好 |
| --- | --- | --- | --- | --- |
| 速度得分 | 140.8423 | 138.6723 | 135.3105 | 越高越好 |
| hits/time×100 | 134.0434 | 131.9782 | 128.7786 | 越高越好 |
| 有效字符 | 1129 | 1129 | 1129 | 同轨应相同 |
| 击键数 | 2149 | 2149 | 2149 | 同轨应相同 |
| 相对总时间 | 1603.212 | 1628.2996 | 1668.7549 | 越低越好 |
| 平均时间/键 | 0.746 | 0.7577 | 0.7765 | 越低越好 |
| 总距离 | 2629.3437 | 2675.5295 | 2784.3186 | 路径量，越低通常越短 |
| 平均总距离/键 | 1.2235 | 1.245 | 1.2956 | 越低通常越短 |
| 有效距离 | 1427.375 | 1460.3638 | 1506.8186 | 越低通常越好 |
| 平均有效距离/键 | 0.6642 | 0.6796 | 0.7012 | 越低通常越好 |
| 重叠距离 | 1201.9687 | 1215.1656 | 1277.5 | 无独立单调方向 |
| 平均重叠距离/键 | 0.5593 | 0.5655 | 0.5945 | 无独立单调方向 |
| 同手连击占比 | 46.07% | 45.88% | 45.42% | 越低表示更多交替；非独立速度结论 |
| 左手负载 | 50.58% | 52.16% | 46.72% | 描述性 |
| 右手负载 | 49.42% | 47.84% | 53.28% | 描述性 |
| 上排负载 | 27.78% | 27.92% | 40.76% | 描述性 |
| 主排负载 | 47.42% | 46.07% | 34.81% | 描述性 |
| 下排负载 | 24.80% | 26.01% | 24.43% | 描述性 |
| 左小指 | 8.05% | 6.98% | 6.38% | 描述性 |
| 左无名指 | 12.19% | 10.75% | 8.66% | 描述性 |
| 左中指 | 12.98% | 16.89% | 15.68% | 描述性 |
| 左食指 | 17.36% | 17.54% | 16.01% | 描述性 |
| 右食指 | 24.66% | 24.48% | 23.96% | 描述性 |
| 右中指 | 12.61% | 12.61% | 17.40% | 描述性 |
| 右无名指 | 7.45% | 7.86% | 10.19% | 描述性 |
| 右小指 | 4.70% | 2.89% | 1.72% | 描述性 |
| 同指距离 0 | 3.12% | 4.47% | 3.21% | 越低通常越好 |
| 同手异指距离 0 | 10.24% | 6.65% | 6.65% | 路径分布；非独立分数 |
| 同指距离 1 | 5.63% | 9.63% | 8.75% | 越低通常越好 |
| 同手异指距离 1 | 18.80% | 17.50% | 16.94% | 路径分布；非独立分数 |
| 同指距离 2 | 1.63% | 1.77% | 2.61% | 越低通常越好 |
| 同手异指距离 2 | 6.65% | 5.86% | 7.26% | 路径分布；非独立分数 |
| 同指距离 ≥3 | 0.00% | 0.00% | 0.00% | 越低通常越好 |
| 同手异指距离 ≥3 | 0.00% | 0.00% | 0.00% | 路径分布；非独立分数 |
| 扩展键击数 | 0 | 0 | 0 | 越低表示越少使用 []\' |
| 相对全拼得分倍数 | 1.4743 | 1.4516 | 1.4164 | 同轨越高越好 |

### 日常八场景＋仅汉字

| 指标 | 神韵 R9（21×21） | [原键道 S005（21×21）](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04（26×26）](https://sspai.com/post/108949) | 何为好 |
| --- | --- | --- | --- | --- |
| 速度得分 | 140.6807 | 134.609 | 138.6378 | 越高越好 |
| hits/time×100 | 140.6807 | 134.609 | 138.6378 | 越高越好 |
| 有效字符 | 1020 | 1020 | 1020 | 同轨应相同 |
| 击键数 | 2040 | 2040 | 2040 | 同轨应相同 |
| 相对总时间 | 1450.092 | 1515.5004 | 1471.4603 | 越低越好 |
| 平均时间/键 | 0.7108 | 0.7429 | 0.7213 | 越低越好 |
| 总距离 | 2383.8122 | 2462.1248 | 2492.0197 | 路径量，越低通常越短 |
| 平均总距离/键 | 1.1685 | 1.2069 | 1.2216 | 越低通常越短 |
| 有效距离 | 1283.7534 | 1354.4903 | 1326.8505 | 越低通常越好 |
| 平均有效距离/键 | 0.6293 | 0.664 | 0.6504 | 越低通常越好 |
| 重叠距离 | 1100.0588 | 1107.6345 | 1165.1692 | 无独立单调方向 |
| 平均重叠距离/键 | 0.5392 | 0.543 | 0.5712 | 无独立单调方向 |
| 同手连击占比 | 45.20% | 45.39% | 44.51% | 越低表示更多交替；非独立速度结论 |
| 左手负载 | 53.28% | 54.95% | 49.22% | 描述性 |
| 右手负载 | 46.72% | 45.05% | 50.78% | 描述性 |
| 上排负载 | 29.26% | 29.41% | 42.94% | 描述性 |
| 主排负载 | 49.95% | 48.53% | 36.67% | 描述性 |
| 下排负载 | 20.78% | 22.06% | 20.39% | 描述性 |
| 左小指 | 8.48% | 7.35% | 6.72% | 描述性 |
| 左无名指 | 12.84% | 11.32% | 9.12% | 描述性 |
| 左中指 | 13.68% | 17.79% | 16.52% | 描述性 |
| 左食指 | 18.28% | 18.48% | 16.86% | 描述性 |
| 右食指 | 25.98% | 25.78% | 25.25% | 描述性 |
| 右中指 | 9.95% | 9.95% | 15.00% | 描述性 |
| 右无名指 | 5.83% | 6.27% | 8.73% | 描述性 |
| 右小指 | 4.95% | 3.04% | 1.81% | 描述性 |
| 同指距离 0 | 3.48% | 4.85% | 3.77% | 越低通常越好 |
| 同手异指距离 0 | 10.93% | 6.52% | 7.11% | 路径分布；非独立分数 |
| 同指距离 1 | 5.25% | 9.12% | 9.22% | 越低通常越好 |
| 同手异指距离 1 | 18.63% | 17.99% | 17.16% | 路径分布；非独立分数 |
| 同指距离 2 | 1.86% | 2.06% | 1.72% | 越低通常越好 |
| 同手异指距离 2 | 5.05% | 4.85% | 5.54% | 路径分布；非独立分数 |
| 同指距离 ≥3 | 0.00% | 0.00% | 0.00% | 越低通常越好 |
| 同手异指距离 ≥3 | 0.00% | 0.00% | 0.00% | 路径分布；非独立分数 |
| 扩展键击数 | 0 | 0 | 0 | 越低表示越少使用 []\' |
| 相对全拼得分倍数 | 1.4878 | 1.4236 | 1.4662 | 同轨越高越好 |

### 原站默认说明＋兼容标点

| 指标 | 神韵 R9（21×21） | [原键道 S005（21×21）](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04（26×26）](https://sspai.com/post/108949) | 何为好 |
| --- | --- | --- | --- | --- |
| 速度得分 | 145.918 | 153.6883 | 156.1501 | 越高越好 |
| hits/time×100 | 137.0745 | 144.3739 | 146.6865 | 越高越好 |
| 有效字符 | 198 | 198 | 198 | 同轨应相同 |
| 击键数 | 372 | 372 | 372 | 同轨应相同 |
| 相对总时间 | 271.3853 | 257.6643 | 253.6021 | 越低越好 |
| 平均时间/键 | 0.7295 | 0.6926 | 0.6817 | 越低越好 |
| 总距离 | 440.548 | 442.1223 | 465.4254 | 路径量，越低通常越短 |
| 平均总距离/键 | 1.1843 | 1.1885 | 1.2511 | 越低通常越短 |
| 有效距离 | 237.3104 | 236.135 | 234.7194 | 越低通常越好 |
| 平均有效距离/键 | 0.6379 | 0.6348 | 0.631 | 越低通常越好 |
| 重叠距离 | 203.2376 | 205.9874 | 230.706 | 无独立单调方向 |
| 平均重叠距离/键 | 0.5463 | 0.5537 | 0.6202 | 无独立单调方向 |
| 同手连击占比 | 45.43% | 45.43% | 41.67% | 越低表示更多交替；非独立速度结论 |
| 左手负载 | 46.51% | 51.08% | 44.89% | 描述性 |
| 右手负载 | 53.49% | 48.92% | 55.11% | 描述性 |
| 上排负载 | 26.88% | 27.42% | 40.05% | 描述性 |
| 主排负载 | 48.92% | 46.77% | 34.68% | 描述性 |
| 下排负载 | 24.19% | 25.81% | 25.27% | 描述性 |
| 左小指 | 7.53% | 6.18% | 6.45% | 描述性 |
| 左无名指 | 8.33% | 9.68% | 6.45% | 描述性 |
| 左中指 | 13.17% | 15.32% | 14.25% | 描述性 |
| 左食指 | 17.47% | 19.89% | 17.74% | 描述性 |
| 右食指 | 25.00% | 24.46% | 26.88% | 描述性 |
| 右中指 | 12.90% | 12.90% | 17.47% | 描述性 |
| 右无名指 | 10.48% | 8.87% | 8.87% | 描述性 |
| 右小指 | 5.11% | 2.69% | 1.88% | 描述性 |
| 同指距离 0 | 4.57% | 5.11% | 3.49% | 越低通常越好 |
| 同手异指距离 0 | 9.14% | 7.80% | 4.84% | 路径分布；非独立分数 |
| 同指距离 1 | 7.53% | 8.06% | 6.99% | 越低通常越好 |
| 同手异指距离 1 | 17.20% | 19.35% | 19.35% | 路径分布；非独立分数 |
| 同指距离 2 | 1.08% | 1.88% | 3.76% | 越低通常越好 |
| 同手异指距离 2 | 5.91% | 3.23% | 3.23% | 路径分布；非独立分数 |
| 同指距离 ≥3 | 0.00% | 0.00% | 0.00% | 越低通常越好 |
| 同手异指距离 ≥3 | 0.00% | 0.00% | 0.00% | 路径分布；非独立分数 |
| 扩展键击数 | 0 | 0 | 0 | 越低表示越少使用 []\' |
| 相对全拼得分倍数 | 1.4513 | 1.5286 | 1.5531 | 同轨越高越好 |

### 原站默认说明＋仅汉字

| 指标 | 神韵 R9（21×21） | [原键道 S005（21×21）](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04（26×26）](https://sspai.com/post/108949) | 何为好 |
| --- | --- | --- | --- | --- |
| 速度得分 | 134.1418 | 139.3326 | 150.358 | 越高越好 |
| hits/time×100 | 134.1418 | 139.3326 | 150.358 | 越高越好 |
| 有效字符 | 174 | 174 | 174 | 同轨应相同 |
| 击键数 | 348 | 348 | 348 | 同轨应相同 |
| 相对总时间 | 259.427 | 249.7621 | 231.4476 | 越低越好 |
| 平均时间/键 | 0.7455 | 0.7177 | 0.6651 | 越低越好 |
| 总距离 | 404.6907 | 408.1746 | 422.3581 | 路径量，越低通常越短 |
| 平均总距离/键 | 1.1629 | 1.1729 | 1.2137 | 越低通常越短 |
| 有效距离 | 225.7022 | 228.3639 | 214.2546 | 越低通常越好 |
| 平均有效距离/键 | 0.6486 | 0.6562 | 0.6157 | 越低通常越好 |
| 重叠距离 | 178.9886 | 179.8107 | 208.1035 | 无独立单调方向 |
| 平均重叠距离/键 | 0.5143 | 0.5167 | 0.598 | 无独立单调方向 |
| 同手连击占比 | 45.98% | 47.70% | 41.38% | 越低表示更多交替；非独立速度结论 |
| 左手负载 | 49.43% | 54.31% | 47.70% | 描述性 |
| 右手负载 | 50.57% | 45.69% | 52.30% | 描述性 |
| 上排负载 | 28.16% | 28.74% | 42.24% | 描述性 |
| 主排负载 | 52.01% | 49.71% | 36.78% | 描述性 |
| 下排负载 | 19.83% | 21.55% | 20.98% | 描述性 |
| 左小指 | 7.76% | 6.32% | 6.61% | 描述性 |
| 左无名指 | 8.91% | 10.34% | 6.90% | 描述性 |
| 左中指 | 14.08% | 16.38% | 15.23% | 描述性 |
| 左食指 | 18.68% | 21.26% | 18.97% | 描述性 |
| 右食指 | 26.44% | 25.86% | 28.45% | 描述性 |
| 右中指 | 11.78% | 11.78% | 16.67% | 描述性 |
| 右无名指 | 7.18% | 5.46% | 5.46% | 描述性 |
| 右小指 | 5.17% | 2.59% | 1.72% | 描述性 |
| 同指距离 0 | 4.02% | 5.17% | 2.59% | 越低通常越好 |
| 同手异指距离 0 | 10.06% | 9.20% | 5.75% | 路径分布；非独立分数 |
| 同指距离 1 | 7.18% | 8.62% | 7.76% | 越低通常越好 |
| 同手异指距离 1 | 16.95% | 18.68% | 19.54% | 路径分布；非独立分数 |
| 同指距离 2 | 1.15% | 2.59% | 3.74% | 越低通常越好 |
| 同手异指距离 2 | 6.61% | 3.45% | 2.01% | 路径分布；非独立分数 |
| 同指距离 ≥3 | 0.00% | 0.00% | 0.00% | 越低通常越好 |
| 同手异指距离 ≥3 | 0.00% | 0.00% | 0.00% | 路径分布；非独立分数 |
| 扩展键击数 | 0 | 0 | 0 | 越低表示越少使用 []\' |
| 相对全拼得分倍数 | 1.4358 | 1.4914 | 1.6094 | 同轨越高越好 |

## 键对模型逐合同明细

每格依次给出合同内键对成本、IID 键对成本、追加一次空格的 IID、含空格每字成本，以及被该模型原生支持的键对权重。不同模型量纲与支持范围不同，只能在同一合同、同一模型内横向比较。

| 合同 | 键对模型 | 神韵 R9（21×21） | [原键道 S005（21×21）](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04（26×26）](https://sspai.com/post/108949) |
| --- | --- | --- | --- | --- |
| S2 | chen | within=1.31129<br>iid=1.34696<br>space1IID=1.33796<br>space1CostPerChar=4.01389<br>supportedPairWeight=100.00% | within=1.32628<br>iid=1.35556<br>space1IID=1.34703<br>space1CostPerChar=4.0411<br>supportedPairWeight=100.00% | within=1.30419<br>iid=1.3365<br>space1IID=1.34572<br>space1CostPerChar=4.03716<br>supportedPairWeight=100.00% |
| S2 | macroxue | within=0.65523<br>iid=0.70498<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.70221<br>iid=0.74675<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.68067<br>iid=0.72959<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| S2 | legacy | within=1.31129<br>iid=1.34696<br>space1IID=1.30376<br>space1CostPerChar=3.91129<br>supportedPairWeight=100.00% | within=1.32628<br>iid=1.35556<br>space1IID=1.30876<br>space1CostPerChar=3.92628<br>supportedPairWeight=100.00% | within=1.30419<br>iid=1.3365<br>space1IID=1.3014<br>space1CostPerChar=3.90419<br>supportedPairWeight=100.00% |
| S2 | legacyGeometry | within=1.36588<br>iid=1.37381<br>space1IID=1.32196<br>space1CostPerChar=3.96588<br>supportedPairWeight=100.00% | within=1.37316<br>iid=1.37644<br>space1IID=1.32439<br>space1CostPerChar=3.97316<br>supportedPairWeight=100.00% | within=1.34967<br>iid=1.35696<br>space1IID=1.31656<br>space1CostPerChar=3.94967<br>supportedPairWeight=100.00% |
| C2 | chen | within=1.27516<br>iid=1.32213<br>space1IID=1.33489<br>space1CostPerChar=4.00468<br>supportedPairWeight=100.00% | within=1.28764<br>iid=1.33377<br>space1IID=1.33896<br>space1CostPerChar=4.01688<br>supportedPairWeight=100.00% | within=1.28027<br>iid=1.32255<br>space1IID=1.34413<br>space1CostPerChar=4.03239<br>supportedPairWeight=100.00% |
| C2 | macroxue | within=0.51031<br>iid=0.62329<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.66605<br>iid=0.71423<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.69061<br>iid=0.73356<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| C2 | legacy | within=1.27516<br>iid=1.32213<br>space1IID=1.29172<br>space1CostPerChar=3.87516<br>supportedPairWeight=100.00% | within=1.28764<br>iid=1.33377<br>space1IID=1.29588<br>space1CostPerChar=3.88764<br>supportedPairWeight=100.00% | within=1.28027<br>iid=1.32255<br>space1IID=1.29342<br>space1CostPerChar=3.88027<br>supportedPairWeight=100.00% |
| C2 | legacyGeometry | within=1.34931<br>iid=1.3586<br>space1IID=1.31644<br>space1CostPerChar=3.94931<br>supportedPairWeight=100.00% | within=1.37292<br>iid=1.369<br>space1IID=1.32431<br>space1CostPerChar=3.97292<br>supportedPairWeight=100.00% | within=1.3541<br>iid=1.35507<br>space1IID=1.31803<br>space1CostPerChar=3.9541<br>supportedPairWeight=100.00% |
| C3 | chen | within=1.27593<br>iid=1.30344<br>space1IID=1.31036<br>space1CostPerChar=5.24145<br>supportedPairWeight=100.00% | within=1.30257<br>iid=1.32301<br>space1IID=1.32621<br>space1CostPerChar=5.30486<br>supportedPairWeight=100.00% | within=1.25408<br>iid=1.28852<br>space1IID=1.31079<br>space1CostPerChar=5.24316<br>supportedPairWeight=100.00% |
| C3 | macroxue | within=0.55918<br>iid=0.63187<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.73257<br>iid=0.74793<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.57568<br>iid=0.63214<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| C3 | legacy | within=1.27593<br>iid=1.30344<br>space1IID=1.28796<br>space1CostPerChar=5.15185<br>supportedPairWeight=100.00% | within=1.30257<br>iid=1.32301<br>space1IID=1.30129<br>space1CostPerChar=5.20515<br>supportedPairWeight=100.00% | within=1.25408<br>iid=1.28852<br>space1IID=1.27704<br>space1CostPerChar=5.10816<br>supportedPairWeight=100.00% |
| C3 | legacyGeometry | within=1.35807<br>iid=1.37303<br>space1IID=1.32903<br>space1CostPerChar=5.31614<br>supportedPairWeight=100.00% | within=1.37917<br>iid=1.38406<br>space1IID=1.33958<br>space1CostPerChar=5.35833<br>supportedPairWeight=100.00% | within=1.33333<br>iid=1.34643<br>space1IID=1.31667<br>space1CostPerChar=5.26666<br>supportedPairWeight=100.00% |
| C4-Snow | chen | within=1.29946<br>iid=1.31516<br>space1IID=1.31529<br>space1CostPerChar=6.55856<br>supportedPairWeight=100.00% | within=1.31686<br>iid=1.32593<br>space1IID=1.32774<br>space1CostPerChar=6.62065<br>supportedPairWeight=100.00% | within=1.26557<br>iid=1.28562<br>space1IID=1.31116<br>space1CostPerChar=6.538<br>supportedPairWeight=100.00% |
| C4-Snow | macroxue | within=0.47027<br>iid=0.55922<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.59965<br>iid=0.65427<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.50933<br>iid=0.56893<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| C4-Snow | legacy | within=1.29946<br>iid=1.31516<br>space1IID=1.29968<br>space1CostPerChar=6.48071<br>supportedPairWeight=100.00% | within=1.31686<br>iid=1.32593<br>space1IID=1.3101<br>space1CostPerChar=6.53268<br>supportedPairWeight=100.00% | within=1.26557<br>iid=1.28562<br>space1IID=1.27938<br>space1CostPerChar=6.37952<br>supportedPairWeight=100.00% |
| C4-Snow | legacyGeometry | within=1.31263<br>iid=1.32914<br>space1IID=1.30757<br>space1CostPerChar=6.52005<br>supportedPairWeight=100.00% | within=1.32935<br>iid=1.34183<br>space1IID=1.31758<br>space1CostPerChar=6.56997<br>supportedPairWeight=100.00% | within=1.28677<br>iid=1.29879<br>space1IID=1.29208<br>space1CostPerChar=6.44281<br>supportedPairWeight=100.00% |
| C4-SBxh | chen | within=1.29453<br>iid=1.31202<br>space1IID=1.31243<br>space1CostPerChar=6.56217<br>supportedPairWeight=100.00% | within=1.31031<br>iid=1.32436<br>space1IID=1.32393<br>space1CostPerChar=6.61963<br>supportedPairWeight=100.00% | within=1.25995<br>iid=1.28436<br>space1IID=1.30738<br>space1CostPerChar=6.53688<br>supportedPairWeight=100.00% |
| C4-SBxh | macroxue | within=0.47808<br>iid=0.56197<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.60308<br>iid=0.65904<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.52461<br>iid=0.58329<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| C4-SBxh | legacy | within=1.29453<br>iid=1.31202<br>space1IID=1.29672<br>space1CostPerChar=6.4836<br>supportedPairWeight=100.00% | within=1.31031<br>iid=1.32436<br>space1IID=1.30619<br>space1CostPerChar=6.53094<br>supportedPairWeight=100.00% | within=1.25995<br>iid=1.28436<br>space1IID=1.27597<br>space1CostPerChar=6.37984<br>supportedPairWeight=100.00% |
| C4-SBxh | legacyGeometry | within=1.32653<br>iid=1.34196<br>space1IID=1.31592<br>space1CostPerChar=6.57959<br>supportedPairWeight=100.00% | within=1.34214<br>iid=1.35414<br>space1IID=1.32528<br>space1CostPerChar=6.62642<br>supportedPairWeight=100.00% | within=1.28968<br>iid=1.30409<br>space1IID=1.29381<br>space1CostPerChar=6.46904<br>supportedPairWeight=100.00% |
| C4-SBzr | chen | within=1.29453<br>iid=1.31202<br>space1IID=1.31243<br>space1CostPerChar=6.56217<br>supportedPairWeight=100.00% | within=1.31031<br>iid=1.32436<br>space1IID=1.32393<br>space1CostPerChar=6.61963<br>supportedPairWeight=100.00% | within=1.25995<br>iid=1.28436<br>space1IID=1.30738<br>space1CostPerChar=6.53688<br>supportedPairWeight=100.00% |
| C4-SBzr | macroxue | within=0.47808<br>iid=0.56197<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.60308<br>iid=0.65904<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.52461<br>iid=0.58329<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| C4-SBzr | legacy | within=1.29453<br>iid=1.31202<br>space1IID=1.29672<br>space1CostPerChar=6.4836<br>supportedPairWeight=100.00% | within=1.31031<br>iid=1.32436<br>space1IID=1.30619<br>space1CostPerChar=6.53094<br>supportedPairWeight=100.00% | within=1.25995<br>iid=1.28436<br>space1IID=1.27597<br>space1CostPerChar=6.37984<br>supportedPairWeight=100.00% |
| C4-SBzr | legacyGeometry | within=1.32653<br>iid=1.34196<br>space1IID=1.31592<br>space1CostPerChar=6.57959<br>supportedPairWeight=100.00% | within=1.34214<br>iid=1.35414<br>space1IID=1.32528<br>space1CostPerChar=6.62642<br>supportedPairWeight=100.00% | within=1.28968<br>iid=1.30409<br>space1IID=1.29381<br>space1CostPerChar=6.46904<br>supportedPairWeight=100.00% |
| C5-TX2 | chen | within=1.27847<br>iid=1.29523<br>space1IID=1.29867<br>space1CostPerChar=7.77437<br>supportedPairWeight=100.00% | within=1.29184<br>iid=1.30411<br>space1IID=1.30926<br>space1CostPerChar=7.83777<br>supportedPairWeight=100.00% | within=1.24948<br>iid=1.26874<br>space1IID=1.29283<br>space1CostPerChar=7.73943<br>supportedPairWeight=100.00% |
| C5-TX2 | macroxue | within=0.43552<br>iid=0.5136<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.52251<br>iid=0.58164<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.44575<br>iid=0.50614<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| C5-TX2 | legacy | within=1.27847<br>iid=1.29523<br>space1IID=1.28566<br>space1CostPerChar=7.69651<br>supportedPairWeight=100.00% | within=1.29184<br>iid=1.30411<br>space1IID=1.29457<br>space1CostPerChar=7.7498<br>supportedPairWeight=100.00% | within=1.24948<br>iid=1.26874<br>space1IID=1.26636<br>space1CostPerChar=7.58095<br>supportedPairWeight=100.00% |
| C5-TX2 | legacyGeometry | within=1.32084<br>iid=1.33239<br>space1IID=1.31388<br>space1CostPerChar=7.86542<br>supportedPairWeight=100.00% | within=1.33143<br>iid=1.34099<br>space1IID=1.32093<br>space1CostPerChar=7.90761<br>supportedPairWeight=100.00% | within=1.28481<br>iid=1.29481<br>space1IID=1.28988<br>space1CostPerChar=7.72177<br>supportedPairWeight=100.00% |
| W4-Snow | chen | within=1.33811<br>iid=1.34984<br>space1IID=1.34321<br>space1CostPerChar=3.35802<br>supportedPairWeight=100.00% | within=1.34966<br>iid=1.35981<br>space1IID=1.35149<br>space1CostPerChar=3.37873<br>supportedPairWeight=100.00% | within=1.32748<br>iid=1.33839<br>space1IID=1.34132<br>space1CostPerChar=3.35331<br>supportedPairWeight=100.00% |
| W4-Snow | macroxue | within=0.71327<br>iid=0.72824<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.72791<br>iid=0.74945<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.69651<br>iid=0.71819<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| W4-Snow | legacy | within=1.33811<br>iid=1.34984<br>space1IID=1.32286<br>space1CostPerChar=3.30716<br>supportedPairWeight=100.00% | within=1.34966<br>iid=1.35981<br>space1IID=1.3298<br>space1CostPerChar=3.32449<br>supportedPairWeight=100.00% | within=1.32748<br>iid=1.33839<br>space1IID=1.31649<br>space1CostPerChar=3.29123<br>supportedPairWeight=100.00% |
| W4-Snow | legacyGeometry | within=1.37445<br>iid=1.37752<br>space1IID=1.34467<br>space1CostPerChar=3.36168<br>supportedPairWeight=100.00% | within=1.37869<br>iid=1.38131<br>space1IID=1.34721<br>space1CostPerChar=3.36803<br>supportedPairWeight=100.00% | within=1.35775<br>iid=1.36063<br>space1IID=1.33465<br>space1CostPerChar=3.33663<br>supportedPairWeight=100.00% |
| W4-SBxh | chen | within=1.32297<br>iid=1.33716<br>space1IID=1.334<br>space1CostPerChar=3.33501<br>supportedPairWeight=100.00% | within=1.34391<br>iid=1.35468<br>space1IID=1.34872<br>space1CostPerChar=3.3718<br>supportedPairWeight=100.00% | within=1.31937<br>iid=1.33182<br>space1IID=1.33869<br>space1CostPerChar=3.34672<br>supportedPairWeight=100.00% |
| W4-SBxh | macroxue | within=0.67415<br>iid=0.69032<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.71131<br>iid=0.73208<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.66567<br>iid=0.69161<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| W4-SBxh | legacy | within=1.32297<br>iid=1.33716<br>space1IID=1.31378<br>space1CostPerChar=3.28446<br>supportedPairWeight=100.00% | within=1.34391<br>iid=1.35468<br>space1IID=1.32635<br>space1CostPerChar=3.31587<br>supportedPairWeight=100.00% | within=1.31937<br>iid=1.33182<br>space1IID=1.31162<br>space1CostPerChar=3.27906<br>supportedPairWeight=100.00% |
| W4-SBxh | legacyGeometry | within=1.37217<br>iid=1.37514<br>space1IID=1.3433<br>space1CostPerChar=3.35825<br>supportedPairWeight=100.00% | within=1.37298<br>iid=1.37592<br>space1IID=1.34379<br>space1CostPerChar=3.35948<br>supportedPairWeight=100.00% | within=1.35126<br>iid=1.35369<br>space1IID=1.33076<br>space1CostPerChar=3.3269<br>supportedPairWeight=100.00% |
| W4-SBzr | chen | within=1.32377<br>iid=1.33775<br>space1IID=1.33429<br>space1CostPerChar=3.33572<br>supportedPairWeight=100.00% | within=1.34316<br>iid=1.35386<br>space1IID=1.34835<br>space1CostPerChar=3.37089<br>supportedPairWeight=100.00% | within=1.31945<br>iid=1.33199<br>space1IID=1.33874<br>space1CostPerChar=3.34685<br>supportedPairWeight=100.00% |
| W4-SBzr | macroxue | within=0.67336<br>iid=0.69013<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.71056<br>iid=0.73178<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.66863<br>iid=0.69484<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| W4-SBzr | legacy | within=1.32377<br>iid=1.33775<br>space1IID=1.31426<br>space1CostPerChar=3.28565<br>supportedPairWeight=100.00% | within=1.34316<br>iid=1.35386<br>space1IID=1.3259<br>space1CostPerChar=3.31474<br>supportedPairWeight=100.00% | within=1.31945<br>iid=1.33199<br>space1IID=1.31167<br>space1CostPerChar=3.27917<br>supportedPairWeight=100.00% |
| W4-SBzr | legacyGeometry | within=1.37231<br>iid=1.37531<br>space1IID=1.34339<br>space1CostPerChar=3.35847<br>supportedPairWeight=100.00% | within=1.37301<br>iid=1.37599<br>space1IID=1.3438<br>space1CostPerChar=3.35951<br>supportedPairWeight=100.00% | within=1.35182<br>iid=1.3545<br>space1IID=1.33109<br>space1CostPerChar=3.32773<br>supportedPairWeight=100.00% |
| W4-common | chen | within=1.31862<br>iid=1.33339<br>space1IID=1.33141<br>space1CostPerChar=3.32854<br>supportedPairWeight=100.00% | within=1.33934<br>iid=1.35065<br>space1IID=1.34607<br>space1CostPerChar=3.36517<br>supportedPairWeight=100.00% | within=1.31696<br>iid=1.32947<br>space1IID=1.33769<br>space1CostPerChar=3.34423<br>supportedPairWeight=100.00% |
| W4-common | macroxue | within=0.65939<br>iid=0.67742<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.6974<br>iid=0.72009<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.66096<br>iid=0.68693<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| W4-common | legacy | within=1.31862<br>iid=1.33339<br>space1IID=1.31117<br>space1CostPerChar=3.27794<br>supportedPairWeight=100.00% | within=1.33934<br>iid=1.35065<br>space1IID=1.32361<br>space1CostPerChar=3.30902<br>supportedPairWeight=100.00% | within=1.31696<br>iid=1.32947<br>space1IID=1.31018<br>space1CostPerChar=3.27544<br>supportedPairWeight=100.00% |
| W4-common | legacyGeometry | within=1.36987<br>iid=1.37301<br>space1IID=1.34192<br>space1CostPerChar=3.35481<br>supportedPairWeight=100.00% | within=1.37049<br>iid=1.37364<br>space1IID=1.3423<br>space1CostPerChar=3.35574<br>supportedPairWeight=100.00% | within=1.34851<br>iid=1.35095<br>space1IID=1.32911<br>space1CostPerChar=3.32277<br>supportedPairWeight=100.00% |
| W4-union | chen | within=1.33817<br>iid=1.3499<br>space1IID=1.34323<br>space1CostPerChar=3.35807<br>supportedPairWeight=100.00% | within=1.34986<br>iid=1.35998<br>space1IID=1.35162<br>space1CostPerChar=3.37906<br>supportedPairWeight=100.00% | within=1.32758<br>iid=1.33848<br>space1IID=1.34139<br>space1CostPerChar=3.35348<br>supportedPairWeight=100.00% |
| W4-union | macroxue | within=0.71357<br>iid=0.72845<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.72849<br>iid=0.74995<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.69655<br>iid=0.71825<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| W4-union | legacy | within=1.33817<br>iid=1.3499<br>space1IID=1.3229<br>space1CostPerChar=3.30725<br>supportedPairWeight=100.00% | within=1.34986<br>iid=1.35998<br>space1IID=1.32991<br>space1CostPerChar=3.32479<br>supportedPairWeight=100.00% | within=1.32758<br>iid=1.33848<br>space1IID=1.31655<br>space1CostPerChar=3.29137<br>supportedPairWeight=100.00% |
| W4-union | legacyGeometry | within=1.37464<br>iid=1.37768<br>space1IID=1.34478<br>space1CostPerChar=3.36196<br>supportedPairWeight=100.00% | within=1.37875<br>iid=1.38137<br>space1IID=1.34725<br>space1CostPerChar=3.36812<br>supportedPairWeight=100.00% | within=1.35786<br>iid=1.36072<br>space1IID=1.33472<br>space1CostPerChar=3.33679<br>supportedPairWeight=100.00% |
| W6-Snow | chen | within=1.33299<br>iid=1.34428<br>space1IID=1.33748<br>space1CostPerChar=4.68118<br>supportedPairWeight=100.00% | within=1.33991<br>iid=1.35135<br>space1IID=1.34284<br>space1CostPerChar=4.69995<br>supportedPairWeight=100.00% | within=1.30812<br>iid=1.32159<br>space1IID=1.32992<br>space1CostPerChar=4.65472<br>supportedPairWeight=100.00% |
| W6-Snow | macroxue | within=0.68791<br>iid=0.70964<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.70935<br>iid=0.73271<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.65409<br>iid=0.68252<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| W6-Snow | legacy | within=1.33299<br>iid=1.34428<br>space1IID=1.32356<br>space1CostPerChar=4.63247<br>supportedPairWeight=100.00% | within=1.33991<br>iid=1.35135<br>space1IID=1.3285<br>space1CostPerChar=4.64976<br>supportedPairWeight=100.00% | within=1.30812<br>iid=1.32159<br>space1IID=1.3058<br>space1CostPerChar=4.57029<br>supportedPairWeight=100.00% |
| W6-Snow | legacyGeometry | within=1.36787<br>iid=1.37799<br>space1IID=1.34848<br>space1CostPerChar=4.71967<br>supportedPairWeight=100.00% | within=1.37095<br>iid=1.38055<br>space1IID=1.35068<br>space1CostPerChar=4.72738<br>supportedPairWeight=100.00% | within=1.32422<br>iid=1.33563<br>space1IID=1.3173<br>space1CostPerChar=4.61056<br>supportedPairWeight=100.00% |
| W6-21 | chen | within=1.33211<br>iid=1.34158<br>space1IID=1.33697<br>space1CostPerChar=4.67941<br>supportedPairWeight=100.00% | within=1.3408<br>iid=1.34976<br>space1IID=1.34361<br>space1CostPerChar=4.70263<br>supportedPairWeight=100.00% | within=1.30447<br>iid=1.31668<br>space1IID=1.32707<br>space1CostPerChar=4.64473<br>supportedPairWeight=100.00% |
| W6-21 | macroxue | within=0.68872<br>iid=0.7078<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.70952<br>iid=0.72922<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.64441<br>iid=0.67049<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| W6-21 | legacy | within=1.33211<br>iid=1.34158<br>space1IID=1.32293<br>space1CostPerChar=4.63027<br>supportedPairWeight=100.00% | within=1.3408<br>iid=1.34976<br>space1IID=1.32915<br>space1CostPerChar=4.65201<br>supportedPairWeight=100.00% | within=1.30447<br>iid=1.31668<br>space1IID=1.30319<br>space1CostPerChar=4.56117<br>supportedPairWeight=100.00% |
| W6-21 | legacyGeometry | within=1.37039<br>iid=1.37688<br>space1IID=1.35028<br>space1CostPerChar=4.72598<br>supportedPairWeight=100.00% | within=1.37379<br>iid=1.37977<br>space1IID=1.3527<br>space1CostPerChar=4.73446<br>supportedPairWeight=100.00% | within=1.32704<br>iid=1.33479<br>space1IID=1.31931<br>space1CostPerChar=4.6176<br>supportedPairWeight=100.00% |
| WX-Snow-12 | chen | within=1.3372<br>iid=1.34171<br>space1IID=1.34036<br>space1CostPerChar=4.69127<br>supportedPairWeight=100.00% | within=1.3436<br>iid=1.34732<br>space1IID=1.34536<br>space1CostPerChar=4.70876<br>supportedPairWeight=100.00% | within=1.3079<br>iid=1.31597<br>space1IID=1.33001<br>space1CostPerChar=4.65503<br>supportedPairWeight=100.00% |
| WX-Snow-12 | macroxue | within=0.65394<br>iid=0.67602<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.67382<br>iid=0.69478<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.6191<br>iid=0.6436<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| WX-Snow-12 | legacy | within=1.3372<br>iid=1.34171<br>space1IID=1.32657<br>space1CostPerChar=4.64299<br>supportedPairWeight=100.00% | within=1.3436<br>iid=1.34732<br>space1IID=1.33114<br>space1CostPerChar=4.659<br>supportedPairWeight=100.00% | within=1.3079<br>iid=1.31597<br>space1IID=1.30564<br>space1CostPerChar=4.56975<br>supportedPairWeight=100.00% |
| WX-Snow-12 | legacyGeometry | within=1.35697<br>iid=1.36283<br>space1IID=1.34069<br>space1CostPerChar=4.69242<br>supportedPairWeight=100.00% | within=1.35987<br>iid=1.3655<br>space1IID=1.34276<br>space1CostPerChar=4.69967<br>supportedPairWeight=100.00% | within=1.31727<br>iid=1.32293<br>space1IID=1.31234<br>space1CostPerChar=4.59318<br>supportedPairWeight=100.00% |
| WX-Snow-21 | chen | within=1.33781<br>iid=1.34298<br>space1IID=1.34047<br>space1CostPerChar=4.69164<br>supportedPairWeight=100.00% | within=1.3436<br>iid=1.34812<br>space1IID=1.34503<br>space1CostPerChar=4.70762<br>supportedPairWeight=100.00% | within=1.30904<br>iid=1.31746<br>space1IID=1.33149<br>space1CostPerChar=4.6602<br>supportedPairWeight=100.00% |
| WX-Snow-21 | macroxue | within=0.65643<br>iid=0.67985<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.67196<br>iid=0.6953<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.62019<br>iid=0.64635<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| WX-Snow-21 | legacy | within=1.33781<br>iid=1.34298<br>space1IID=1.327<br>space1CostPerChar=4.64451<br>supportedPairWeight=100.00% | within=1.3436<br>iid=1.34812<br>space1IID=1.33114<br>space1CostPerChar=4.65901<br>supportedPairWeight=100.00% | within=1.30904<br>iid=1.31746<br>space1IID=1.30646<br>space1CostPerChar=4.57261<br>supportedPairWeight=100.00% |
| WX-Snow-21 | legacyGeometry | within=1.35642<br>iid=1.36295<br>space1IID=1.3403<br>space1CostPerChar=4.69106<br>supportedPairWeight=100.00% | within=1.35838<br>iid=1.36488<br>space1IID=1.3417<br>space1CostPerChar=4.69596<br>supportedPairWeight=100.00% | within=1.31766<br>iid=1.3232<br>space1IID=1.31261<br>space1CostPerChar=4.59415<br>supportedPairWeight=100.00% |
| WX-SBxh-12 | chen | within=1.34035<br>iid=1.34493<br>space1IID=1.34193<br>space1CostPerChar=4.69675<br>supportedPairWeight=100.00% | within=1.34721<br>iid=1.35081<br>space1IID=1.34726<br>space1CostPerChar=4.7154<br>supportedPairWeight=100.00% | within=1.30563<br>iid=1.31431<br>space1IID=1.32975<br>space1CostPerChar=4.65414<br>supportedPairWeight=100.00% |
| WX-SBxh-12 | macroxue | within=0.6494<br>iid=0.67491<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.66871<br>iid=0.69336<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.61634<br>iid=0.64345<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| WX-SBxh-12 | legacy | within=1.34035<br>iid=1.34493<br>space1IID=1.32882<br>space1CostPerChar=4.65086<br>supportedPairWeight=100.00% | within=1.34721<br>iid=1.35081<br>space1IID=1.33372<br>space1CostPerChar=4.66803<br>supportedPairWeight=100.00% | within=1.30563<br>iid=1.31431<br>space1IID=1.30402<br>space1CostPerChar=4.56407<br>supportedPairWeight=100.00% |
| WX-SBxh-12 | legacyGeometry | within=1.35842<br>iid=1.36469<br>space1IID=1.34173<br>space1CostPerChar=4.69606<br>supportedPairWeight=100.00% | within=1.36117<br>iid=1.36729<br>space1IID=1.34369<br>space1CostPerChar=4.70293<br>supportedPairWeight=100.00% | within=1.31436<br>iid=1.31976<br>space1IID=1.31026<br>space1CostPerChar=4.58591<br>supportedPairWeight=100.00% |
| WX-SBxh-21 | chen | within=1.33903<br>iid=1.34516<br>space1IID=1.34029<br>space1CostPerChar=4.69103<br>supportedPairWeight=100.00% | within=1.3455<br>iid=1.35079<br>space1IID=1.34534<br>space1CostPerChar=4.70869<br>supportedPairWeight=100.00% | within=1.30669<br>iid=1.31614<br>space1IID=1.33191<br>space1CostPerChar=4.66167<br>supportedPairWeight=100.00% |
| WX-SBxh-21 | macroxue | within=0.64923<br>iid=0.6783<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.66551<br>iid=0.69484<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.61612<br>iid=0.64689<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| WX-SBxh-21 | legacy | within=1.33903<br>iid=1.34516<br>space1IID=1.32788<br>space1CostPerChar=4.64758<br>supportedPairWeight=100.00% | within=1.3455<br>iid=1.35079<br>space1IID=1.3325<br>space1CostPerChar=4.66376<br>supportedPairWeight=100.00% | within=1.30669<br>iid=1.31614<br>space1IID=1.30478<br>space1CostPerChar=4.56673<br>supportedPairWeight=100.00% |
| WX-SBxh-21 | legacyGeometry | within=1.35742<br>iid=1.36529<br>space1IID=1.34102<br>space1CostPerChar=4.69356<br>supportedPairWeight=100.00% | within=1.35993<br>iid=1.36776<br>space1IID=1.3428<br>space1CostPerChar=4.69982<br>supportedPairWeight=100.00% | within=1.31476<br>iid=1.32019<br>space1IID=1.31054<br>space1CostPerChar=4.58689<br>supportedPairWeight=100.00% |
| WX-SBzr-12 | chen | within=1.34035<br>iid=1.34493<br>space1IID=1.34193<br>space1CostPerChar=4.69675<br>supportedPairWeight=100.00% | within=1.34721<br>iid=1.35081<br>space1IID=1.34726<br>space1CostPerChar=4.7154<br>supportedPairWeight=100.00% | within=1.30563<br>iid=1.31431<br>space1IID=1.32975<br>space1CostPerChar=4.65414<br>supportedPairWeight=100.00% |
| WX-SBzr-12 | macroxue | within=0.6494<br>iid=0.67491<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.66871<br>iid=0.69336<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.61634<br>iid=0.64345<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| WX-SBzr-12 | legacy | within=1.34035<br>iid=1.34493<br>space1IID=1.32882<br>space1CostPerChar=4.65086<br>supportedPairWeight=100.00% | within=1.34721<br>iid=1.35081<br>space1IID=1.33372<br>space1CostPerChar=4.66803<br>supportedPairWeight=100.00% | within=1.30563<br>iid=1.31431<br>space1IID=1.30402<br>space1CostPerChar=4.56407<br>supportedPairWeight=100.00% |
| WX-SBzr-12 | legacyGeometry | within=1.35842<br>iid=1.36469<br>space1IID=1.34173<br>space1CostPerChar=4.69606<br>supportedPairWeight=100.00% | within=1.36117<br>iid=1.36729<br>space1IID=1.34369<br>space1CostPerChar=4.70293<br>supportedPairWeight=100.00% | within=1.31436<br>iid=1.31976<br>space1IID=1.31026<br>space1CostPerChar=4.58591<br>supportedPairWeight=100.00% |
| WX-SBzr-21 | chen | within=1.33903<br>iid=1.34516<br>space1IID=1.34029<br>space1CostPerChar=4.69103<br>supportedPairWeight=100.00% | within=1.3455<br>iid=1.35079<br>space1IID=1.34534<br>space1CostPerChar=4.70869<br>supportedPairWeight=100.00% | within=1.30669<br>iid=1.31614<br>space1IID=1.33191<br>space1CostPerChar=4.66167<br>supportedPairWeight=100.00% |
| WX-SBzr-21 | macroxue | within=0.64923<br>iid=0.6783<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.66551<br>iid=0.69484<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% | within=0.61612<br>iid=0.64689<br>space1IID=—<br>space1CostPerChar=—<br>supportedPairWeight=100.00% |
| WX-SBzr-21 | legacy | within=1.33903<br>iid=1.34516<br>space1IID=1.32788<br>space1CostPerChar=4.64758<br>supportedPairWeight=100.00% | within=1.3455<br>iid=1.35079<br>space1IID=1.3325<br>space1CostPerChar=4.66376<br>supportedPairWeight=100.00% | within=1.30669<br>iid=1.31614<br>space1IID=1.30478<br>space1CostPerChar=4.56673<br>supportedPairWeight=100.00% |
| WX-SBzr-21 | legacyGeometry | within=1.35742<br>iid=1.36529<br>space1IID=1.34102<br>space1CostPerChar=4.69356<br>supportedPairWeight=100.00% | within=1.35993<br>iid=1.36776<br>space1IID=1.3428<br>space1CostPerChar=4.69982<br>supportedPairWeight=100.00% | within=1.31476<br>iid=1.32019<br>space1IID=1.31054<br>space1CostPerChar=4.58689<br>supportedPairWeight=100.00% |
