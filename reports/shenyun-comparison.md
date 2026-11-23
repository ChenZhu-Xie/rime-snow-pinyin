<!-- current-layout-benchmark:bcecc20e66965bb91632e286725bd1f9b4bcbe0fbdc625dd1e1041360b449310 -->

<a id="current-layout-bcecc20e6696"></a>

# 当前四布局／六生产双拼方案比较（CKT v5.2）

本报告仅列当前四份生产布局：冰雪兰道／冰雪兰拼共用 UED，冰雪鹤道／冰雪鹤拼共用 RC26，冰雪莲道与冰雪鹮道分别使用带调布局。S005 与 B04 仅为外部对照，不是本仓库生产方案。各列共用冻结语料及错误模型；S005 在 v5.2 使用页面归一化参考辅序。复算来源见 [current-layout-replay.json](current-layout-replay.json)。

来源为用户指定的 a7_CKT_R11.html，SHA-256：`d0d15d9969b504714a37c6c04a4e8ff0d21b0e8c82b20a963f0009205c00d36b`。机器可读当前快照保存在 [shenyun-comparison.json](shenyun-comparison.json)，包括输入摘要、定义、参考轨、辅序与各轨原始测值。

### 布局与生产合同

| 属性 | 冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26 | 冰雪莲道 CR-REF-7e650f7a4c 21×21 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | 原键道 S005 | 首道 B04 |
| --- | --- | --- | --- | --- | --- | --- |
| 声调与后置辅码 | 主码带调＋纯形辅[^zh-benchmark-toned-bcecc20e6696] | 主码带调＋纯形辅[^zh-benchmark-toned-bcecc20e6696] | 无调主码＋形／调辅系综 | 无调主码＋形／调辅系综 | 无调主码＋形／调辅系综 | 无调主码＋形／调辅系综 |
| 二／三／四字辅序（形；调） | 21/12/23 | 21/231/14 | 12/12/24；12/21/13 | 12/231/23；12/213/23 | 12/213/24；12/213/23 | 12/12/23；21/12/23 |

### Benchmark 总览

| 指标 | 冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26 | 冰雪莲道 CR-REF-7e650f7a4c 21×21 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | 原键道 S005 | 首道 B04 | 何为好 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M-R2 记忆项 | **18 / 21 (M-T1)**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **21 / 24 (M-T1)**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **40** ★★ | **41** ★ | 44 | 51 | 越低越好 |
| 全声母／字母声母／传统声母／韵母乱序度 A/I/D/V | 7 / 4 / 2 / 5[^zh-benchmark-toned-bcecc20e6696] | 5 / 2 / 2 / 5[^zh-benchmark-toned-bcecc20e6696] | **8 / 5 / 3 / 1** ★★ 🔷 | 5 / 2 / 2 / 5 | **3 / 0 / 0 / 4** ★★ 🔷 | 1 / 0 / 0 / 0 🥇 | A、I 为诊断；仍按 D+V 越低越好 |
| 飞键成分（声母／零声母组／韵母） | **0 / 0 / 0**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **0 / 0 / 0**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **0 / 0 / 0** ★★ 🔷 🥇 | **0 / 0 / 0** ★★ 🔷 🥇 | 2 / 0 / 1 | 0 / 1 / 7 | 越少越好 |
| FA-1 逻辑审计 | **100.000000**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **100.000000**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **98.999608** ★★ | **98.298315** ★ | 97.708694 | 99.763391 | 越高越一致 |
| LU-v1r 逻辑均匀度 | 76.196066[^zh-benchmark-toned-bcecc20e6696] | 73.671261[^zh-benchmark-toned-bcecc20e6696] | **83.470667** ★★ 🔷 🥇 | 74.087239 | **78.897555** ★ 🔹 | 83.107434 | 越高越统一 |
| Common399 唯一码／唯一率 | **526 / 37.385%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **433 / 30.775%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **399 / 100.000%** ★★ | 351 / 87.970% | **372 / 93.233%** ★ | 399 / 100.000% | 越高越好 |
| Common399 重码桶 | 420[^zh-benchmark-toned-bcecc20e6696] | 392[^zh-benchmark-toned-bcecc20e6696] | **0** ★★ 🔷 🥇 | 48 | **27** ★ 🔹 | 0 🥇 | 越低越好 |
| Common399 受影响音节／占比 | 1301 / 92.466%[^zh-benchmark-toned-bcecc20e6696] | 1366 / 97.086%[^zh-benchmark-toned-bcecc20e6696] | **0 / 0.000%** ★★ 🔷 🥇 | 96 / 24.060% | **54 / 13.534%** ★ 🔹 | 0 / 0.000% 🥇 | 越低越好 |
| 频率加权 S2 miss | 15.596%[^zh-benchmark-toned-bcecc20e6696] | 17.994%[^zh-benchmark-toned-bcecc20e6696] | **0.000%** ★★ 🔷 🥇 | 1.894% | **0.929%** ★ 🔹 | 0.000% 🥇 | 越低越好 |
| S2 补全平均码长 | 2.944921[^zh-benchmark-toned-bcecc20e6696] | 3.126652[^zh-benchmark-toned-bcecc20e6696] | **2.000000** ★★ 🔷 🥇 | 2.096813 | **2.072546** ★ 🔹 | 2.000000 🥇 | 越低越好 |
| S2 补全中心时间（ms） | 191.629[^zh-benchmark-toned-bcecc20e6696] | 218.245[^zh-benchmark-toned-bcecc20e6696] | **69.031** ★★ 🔷 🥇 | **84.118** ★ 🔹 | 90.257 | 79.890 | 越低越好 |
| S2 异键同指率 | 7.459%[^zh-benchmark-toned-bcecc20e6696] | **4.736%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **4.845%** ★ | **4.021%** ★★ 🔷 🥇 | 11.638% | 11.343% | 越低越好 |
| 综合补全 CKT v3 | **8.602473**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **8.874945**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **9.570690** ★★ | **9.668465** ★ | 10.000000 | 9.461105 | 越低越好 |
| 综合补全 CKT v4 | **8.679715**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 9.158204[^zh-benchmark-toned-bcecc20e6696] | **9.062885** ★★ 🔹 | **9.564204** ★ | 10.000000 | 9.184607 | 越低越好 |
| 综合补全 CKT v5 | **8.619628**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 9.127910[^zh-benchmark-toned-bcecc20e6696] | **9.072789** ★★ 🔹 | **9.562144** ★ | 10.000000 | 9.195422 | 越低越好 |
| 综合补全 CKT v5.1 | **8.628673**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 9.127012[^zh-benchmark-toned-bcecc20e6696] | **9.082777** ★★ 🔹 | **9.565504** ★ | 9.999357 | 9.202834 | 越低越好 |
| A7E-v3 系综当量 | 10.777219[^zh-benchmark-toned-bcecc20e6696] | 10.884939[^zh-benchmark-toned-bcecc20e6696] | **10.587565** ★★ 🔷 | **10.730903** ★ 🔹 | 10.740028 | 10.519452 🥇 | 越低越好 |
| A7E-v4 系综当量 | 10.823787[^zh-benchmark-toned-bcecc20e6696] | 10.944558[^zh-benchmark-toned-bcecc20e6696] | **10.651302** ★★ 🔷 | **10.795932** ★ 🔹 | 10.805830 | 10.583290 🥇 | 越低越好 |
| A7E-v5 系综当量 | **10.163691**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **10.143940**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **10.203925** ★★ | **10.607833** ★ | 11.478960 | 11.091225 | 越低越好 |
| A7E-v6-CW150 | **8.447277**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **8.646306**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **9.252817** ★★ | **9.647440** ★ | 10.000000 | 9.589632 | 越低越好 |
| 八轨综合选重率 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | **0.622%** ★★ 🔷 | **1.227%** ★ 🔹 | 1.532% | 0.572% 🥇 | 越低越好 |
| 八轨第一辅键率 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | **20.962%** ★★ 🔷 | **24.772%** ★ 🔹 | 26.413% | 19.746% 🥇 | 越低越好 |
| 八轨第二辅键率 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | **4.489%** ★★ 🔷 | **6.303%** ★ 🔹 | 7.201% | 4.158% 🥇 | 越低越好 |
| 日常左右手负载／左手占比 | **1095:1054 / 50.954%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 1199:950 / 55.793%[^zh-benchmark-toned-bcecc20e6696] | **997:1152 / 46.394%** ★ | 1200:949 / 55.840% | **1121:1028 / 52.164%** ★★ 🔹 | 1004:1145 / 46.719% | 越接近 50% 越平衡 |
| 日常同手率 | **42.531%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | 46.719%[^zh-benchmark-toned-bcecc20e6696] | **39.739%** ★★ 🔷 🥇 | 47.278% | **45.882%** ★ | 45.416% | 越低越好；非独立速度结论 |
| 日常平均有效距离 | **0.667001**[^zh-benchmark-toned-bcecc20e6696] 🔹 | 0.758448[^zh-benchmark-toned-bcecc20e6696] | **0.649234** ★★ 🔷 🥇 | 0.693857 | **0.679555** ★ | 0.701172 | 越低越好 |
| 20 合同 QAZ 左小指组峰值 | **11.808%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **10.923%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **16.967%** ★ | **16.717%** ★★ | 17.160% | 16.661% | 越低越好 |
| 20 合同 P 区右小指组峰值 | 7.125%[^zh-benchmark-toned-bcecc20e6696] | 5.524%[^zh-benchmark-toned-bcecc20e6696] | **3.150%** ★ 🔹 | 4.841% | **2.774%** ★★ 🔷 | 1.888% 🥇 | 越低越好 |
| 20 合同最大单指峰值 | **26.581%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 27.929%[^zh-benchmark-toned-bcecc20e6696] | 35.359% | **26.952%** ★★ 🔹 | **29.531%** ★ | 29.271% | 越低越好 |
| 日常纯双拼移动手分数（含标点） | 138.089[^zh-benchmark-toned-bcecc20e6696] | 121.658[^zh-benchmark-toned-bcecc20e6696] | **145.320** ★★ 🔷 🥇 | 134.318 | **138.672** ★ 🔹 | 135.310 | 越高越好 |
| S2 主键区占比 | 40.048%[^zh-benchmark-toned-bcecc20e6696] | 41.069%[^zh-benchmark-toned-bcecc20e6696] | 44.118% | **51.279%** ★★ 🔷 🥇 | **49.001%** ★ 🔹 | 36.600% | 越高越好 |
| 20 合同 TYB 双食指组峰值 | **10.828%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 15.484%[^zh-benchmark-toned-bcecc20e6696] | **12.012%** ★★ 🔹 | **14.281%** ★ | 14.733% | 12.358% | 越低越好 |
| 20 合同主键区下限 | 24.699%[^zh-benchmark-toned-bcecc20e6696] | 28.399%[^zh-benchmark-toned-bcecc20e6696] | **32.563%** ★ 🔹 | **36.536%** ★★ 🔷 🥇 | 30.815% | 24.243% | 越高越好 |
| 音节域大小（无调／带调） | 1407[^zh-benchmark-toned-bcecc20e6696] | 1407[^zh-benchmark-toned-bcecc20e6696] | 399 | 399 | 399 | 399 | 观察分布，不单独判优 |
| 静态空码（399／1407 音节域） | 20[^zh-benchmark-toned-bcecc20e6696] | 8[^zh-benchmark-toned-bcecc20e6696] | **147** ★★ 🔷 | **90** ★ 🔹 | 69 | 277 🥇 | 越高越好 |
| 综合补全 CKT v5.2[^zh-benchmark-v52-bcecc20e6696] | **8.640932**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 9.132009[^zh-benchmark-toned-bcecc20e6696] | **9.086538** ★★ 🔹 | **9.566359** ★ | 10.000000 | 9.208870 | 越低越好 |
| CKT v5.2 认知成本 ×2 | **8.234489**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **8.861456**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **9.043952** ★★ | **9.543307** ★ | 10.000000 | 9.120877 | 越低越好 |
| CKT v5.2 认知成本 ×3 | **7.961052**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **8.666715**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **9.039404** ★★ | **9.529308** ★ | 10.000000 | 9.082275 | 越低越好 |
| CKT v5.2 认知成本 ×5 | **7.598958**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **8.402959**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **9.051557** ★★ | **9.513962** ★ | 10.000000 | 9.048291 | 越低越好 |
| v5.2 加权运动耗时（ms） | **340.196**[^zh-benchmark-toned-bcecc20e6696] 🔹 | 343.661[^zh-benchmark-toned-bcecc20e6696] | **338.392** ★★ 🔷 🥇 | **347.023** ★ | 358.648 | 344.268 | 越低越好 |
| v5.2 加权认知耗时（ms） | **54.935**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 81.230[^zh-benchmark-toned-bcecc20e6696] | **80.377** ★★ 🔹 | **98.621** ★ | 107.694 | 75.256 | 越低越好 |
| v5.2 加权有效耗时（ms） | **395.130**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 424.891[^zh-benchmark-toned-bcecc20e6696] | **418.768** ★★ 🔹 | **445.644** ★ | 466.343 | 419.524 | 越低越好 |
| v5.2 第一辅键率 | **15.652%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 21.376%[^zh-benchmark-toned-bcecc20e6696] | **20.962%** ★★ 🔹 | **24.772%** ★ | 26.413% | 19.746% | 越低越好 |
| v5.2 第二辅键率 | **2.272%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 4.608%[^zh-benchmark-toned-bcecc20e6696] | **4.484%** ★★ 🔹 | **6.191%** ★ | 7.087% | 4.116% | 越低越好 |
| v5.2 第三辅键率 | **0.000%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 0.666%[^zh-benchmark-toned-bcecc20e6696] | **0.000%** ★★ 🔷 🥇 | **0.806%** ★ | 1.060% | 0.000% 🥇 | 越低越好 |
| v5.2 终局选重率 | **0.176%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **0.193%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | 0.607% | **0.500%** ★★ | **0.604%** ★ | 0.553% | 越低越好 |
| v5.2 平均扫描排除候选数 | **0.002036**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **0.002364**[^zh-benchmark-toned-bcecc20e6696] 🔹 | 0.007806 | **0.006292** ★★ | **0.007673** ★ | 0.007006 | 越低越好 |
| v5.2 平均翻页次数 | **0.000000**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 0.000007[^zh-benchmark-toned-bcecc20e6696] | 0.000019 | **0.000007** ★★ 🔹 | **0.000011** ★ | 0.000009 | 越低越好 |
| v5.2 平均编码按键数 | **3.761028**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **3.766503**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **3.841567** ★ | **3.817685** ★★ | 3.845605 | 3.816075 | 越低越好 |
| v5.2 单倍成本点最优（非生产辅序） | 未重选辅序[^zh-benchmark-missing-bcecc20e6696] | 未重选辅序[^zh-benchmark-missing-bcecc20e6696] | 未重选辅序[^zh-benchmark-missing-bcecc20e6696] | **9.566342** ★★ 🔷 🥇 | 未重选辅序[^zh-benchmark-missing-bcecc20e6696] | 未重选辅序[^zh-benchmark-missing-bcecc20e6696] | 越低越好 |
| v5.2 加倍成本点最优（非生产辅序） | 未重选辅序[^zh-benchmark-missing-bcecc20e6696] | 未重选辅序[^zh-benchmark-missing-bcecc20e6696] | 未重选辅序[^zh-benchmark-missing-bcecc20e6696] | **9.543307** ★★ 🔷 🥇 | 未重选辅序[^zh-benchmark-missing-bcecc20e6696] | 未重选辅序[^zh-benchmark-missing-bcecc20e6696] | 越低越好 |
| v5.2 终局主键区占比 | 39.923%[^zh-benchmark-toned-bcecc20e6696] | 40.747%[^zh-benchmark-toned-bcecc20e6696] | 42.817% | **44.534%** ★ 🔹 | **44.760%** ★★ 🔷 🥇 | 36.394% | 越高越好 |
| v5.2 终局上排占比 | 33.792%[^zh-benchmark-toned-bcecc20e6696] | 35.711%[^zh-benchmark-toned-bcecc20e6696] | 36.063% | **33.333%** ★ 🔹 | **32.858%** ★★ 🔷 🥇 | 40.950% | 观察分布，不单独判优 |
| v5.2 终局下排占比 | 26.285%[^zh-benchmark-toned-bcecc20e6696] | 23.542%[^zh-benchmark-toned-bcecc20e6696] | **21.120%** ★★ 🔷 🥇 | **22.133%** ★ 🔹 | 22.382% | 22.656% | 观察分布，不单独判优 |
| v5.2 终局左小指负载 | 8.758%[^zh-benchmark-toned-bcecc20e6696] | **7.670%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **7.968%** ★★ 🔹 | **8.484%** ★ | 9.785% | 8.520% | 越低越好 |
| v5.2 终局右小指负载 | 4.485%[^zh-benchmark-toned-bcecc20e6696] | 4.302%[^zh-benchmark-toned-bcecc20e6696] | **2.507%** ★ 🔹 | 3.897% | **2.004%** ★★ 🔷 | 1.539% 🥇 | 越低越好 |
| v5.2 终局最大单指负载 | **24.081%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **25.575%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | 27.997% | **25.783%** ★★ | **26.453%** ★ | 27.032% | 越低越好 |
| v5.2 终局左手占比 | **54.962%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | 55.914%[^zh-benchmark-toned-bcecc20e6696] | **53.711%** ★★ 🔷 🥇 | **56.630%** ★ | 57.638% | 53.750% | 越接近 50% 越平衡 |
| v5.2 终局异键同指率 | 9.439%[^zh-benchmark-toned-bcecc20e6696] | **9.305%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **9.326%** ★ | **8.796%** ★★ 🔷 🥇 | 10.536% | 10.581% | 越低越好 |
| v5.2 终局同指率 | 13.159%[^zh-benchmark-toned-bcecc20e6696] | 13.643%[^zh-benchmark-toned-bcecc20e6696] | **13.003%** ★ 🔹 | **12.914%** ★★ 🔷 🥇 | 16.442% | 15.933% | 越低越好 |
| v5.2 终局同手率 | **47.242%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | 48.524%[^zh-benchmark-toned-bcecc20e6696] | **43.199%** ★★ 🔷 🥇 | **47.893%** ★ | 49.134% | 47.045% | 越低越好 |
| v5.2 终局交替率 | **52.758%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | 51.476%[^zh-benchmark-toned-bcecc20e6696] | **56.801%** ★★ 🔷 🥇 | **52.107%** ★ | 50.866% | 52.955% | 越高越好 |
| 带调原生四轨主键区下限 | **35.185%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **38.229%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 不适用[^zh-benchmark-missing-bcecc20e6696] | 不适用[^zh-benchmark-missing-bcecc20e6696] | 不适用[^zh-benchmark-missing-bcecc20e6696] | 不适用[^zh-benchmark-missing-bcecc20e6696] | 越高越好 |
| 带调原生四轨左小指峰值 | **10.080%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **9.032%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 不适用[^zh-benchmark-missing-bcecc20e6696] | 不适用[^zh-benchmark-missing-bcecc20e6696] | 不适用[^zh-benchmark-missing-bcecc20e6696] | 不适用[^zh-benchmark-missing-bcecc20e6696] | 越低越好 |
| 带调原生四轨右小指峰值 | **5.095%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **5.331%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | 不适用[^zh-benchmark-missing-bcecc20e6696] | 不适用[^zh-benchmark-missing-bcecc20e6696] | 不适用[^zh-benchmark-missing-bcecc20e6696] | 不适用[^zh-benchmark-missing-bcecc20e6696] | 越低越好 |
| 带调原生四轨最大单指峰值 | **26.946%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **27.830%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | 不适用[^zh-benchmark-missing-bcecc20e6696] | 不适用[^zh-benchmark-missing-bcecc20e6696] | 不适用[^zh-benchmark-missing-bcecc20e6696] | 不适用[^zh-benchmark-missing-bcecc20e6696] | 越低越好 |
| 带调原生四轨 TYB 峰值 | **13.414%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **15.468%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | 不适用[^zh-benchmark-missing-bcecc20e6696] | 不适用[^zh-benchmark-missing-bcecc20e6696] | 不适用[^zh-benchmark-missing-bcecc20e6696] | 不适用[^zh-benchmark-missing-bcecc20e6696] | 越低越好 |
| 四码五截面平均跨词长受影响率 | **4.066%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 6.399%[^zh-benchmark-toned-bcecc20e6696] | **5.428%** ★★ 🔹 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | 越低越好 |
| 四码五截面平均跨词长首选损失率 | **1.244%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 2.002%[^zh-benchmark-toned-bcecc20e6696] | **1.884%** ★★ 🔹 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | 越低越好 |

★★／★：仅在本表全部无调方案中评价，首道 B04 除外，分别标记第一／第二名；🔷／🔹：比较本表除首道 B04 外的全部方案，分别标记第一／第二名，无调与带调均可获标；🥇：比较本表所有有效数值的方案（含首道与带调）。三个范围独立，可同时标记；并列采用竞赛排名，缺测／不适用不参评，分布说明项不判优。跨合同排名比较所列模型值，边界见脚注。

[^zh-benchmark-toned-bcecc20e6696]: 带调列为页面原列公式的带调适配：声调在双拼主码内贡献，后置只有纯形笔辅；无调列是形辅／调辅两个成员的八轨系综，带调 v5～v5.2 是形辅四轨，词长权重均为 1:3:1:1。数值可以观察任务成本与取舍，不能作为相同编码合同下的布局或辅码消融排名。记忆项为 M-T1 下限／守门，与 M-R2 定义不同；A/I/D/V 均按实际键集是否为同名字母单键统计：D 计 18 个传统单字母声母，I 再纳入 W/Y，A 再纳入 A/E/O；带调 V 计任一合法声调的普通元音偏移。A/I 仅诊断，仍按 D+V 排名。Common399 对应列在带调方案中改用实际 1407 带调音节，『唯一码』指占用码位而非无碰撞音节数，分母与碰撞数不能直接横比。FA/LU、S2、A7E 与 20 合同负载均使用页面的带调适配；主码已包含的声调不重复击键，S2 补全使用各自五键枚举后缀，时间列的带调值为页面 sound.upperMs。CKT v3/v4 使用页面 τ=600、首辅=300、次辅=300 ms 的适配八轨，v5 以后使用原生纯形四轨；20 合同负载与原生四轨终局负载分别列示。

[^zh-benchmark-missing-bcecc20e6696]: 当前 v5.2 默认、×2／×3／×5、分轨耗时、前三辅率、选重及终局负载已覆盖全部六列：四个无调布局使用同一冻结语料和错误模型复算，两套带调布局使用其原生形辅四轨。S005 的 v5.2 行是页面参考辅序（形 12/213/24、调 12/213/23）。『不适用』表示不存在该生产合同（例如无调方案的带调原生四轨属性）；『未重选辅序』表示未另外搜索该方案的成本点最优值，不能用生产稳健辅序分数代填；其余『—』为来源未发布的审计量。以上均不等于 0，不参评。

[^zh-benchmark-v52-bcecc20e6696]: CKT v5.2 保留 v5.1 的主码、辅序、候选池及词长权重，对长码采用分块成功／错误成本；认知成本 ×2／×3／×5 时同时缩放候选与同模式 S005 参考的全部认知项，保留运动项及生产辅序，再逐轨取四次幂均值。S005 v5.2 归一化为 10；不是实际用户输入速度或 5000 字实测码长。

### v5.2 逐轨模型耗时与辅键贡献[^zh-benchmark-v52-bcecc20e6696]

同一行比较同词长和编码轨。带调方案没有生产调辅轨，其对应格明确标为不适用；不复制形辅轨来凑八轨。单元格为「运动 ms／有效 ms／平均编码按键」。

| 编码轨 | 词长 | 冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26 | 冰雪莲道 CR-REF-7e650f7a4c 21×21 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | 原键道 S005 | 首道 B04 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 形辅 | character | 98.643 / 160.048 / 2.199483[^zh-benchmark-toned-bcecc20e6696] | 99.323 / 164.398 / 2.211661[^zh-benchmark-toned-bcecc20e6696] | 97.520 / 175.301 / 2.249483 | 102.066 / 184.023 / 2.262133 | 112.423 / 195.484 / 2.266274 | 103.095 / 180.876 / 2.249483 |
| 形辅 | word2 | 391.450 / 431.926 / 4.133220[^zh-benchmark-toned-bcecc20e6696] | 399.129 / 443.543 / 4.146303[^zh-benchmark-toned-bcecc20e6696] | 379.850 / 448.729 / 4.220869 | 402.313 / 472.035 / 4.224316 | 412.685 / 482.384 / 4.224026 | 395.772 / 464.807 / 4.221250 |
| 形辅 | word3 | 338.495 / 412.876 / 3.729793[^zh-benchmark-toned-bcecc20e6696] | 331.314 / 544.145 / 3.698323[^zh-benchmark-toned-bcecc20e6696] | 347.056 / 446.378 / 3.834270 | 331.314 / 544.145 / 3.698323 | 343.117 / 581.170 / 3.777280 | 335.162 / 420.282 / 3.733008 |
| 形辅 | word4 | 429.686 / 502.081 / 4.237235[^zh-benchmark-toned-bcecc20e6696] | 433.941 / 510.175 / 4.250127[^zh-benchmark-toned-bcecc20e6696] | 441.667 / 529.029 / 4.283394 | 432.713 / 506.049 / 4.240336 | 447.027 / 546.464 / 4.323045 | 435.092 / 507.318 / 4.234075 |
| 调辅 | character | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | 98.264 / 180.194 / 2.257494 | 104.575 / 190.388 / 2.269462 | 115.609 / 202.573 / 2.272698 | 105.590 / 187.520 / 2.257494 |
| 调辅 | word2 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | 381.100 / 452.357 / 4.224967 | 403.624 / 475.498 / 4.227984 | 413.679 / 485.566 / 4.227880 | 396.703 / 468.082 / 4.224898 |
| 调辅 | word3 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | 349.506 / 456.454 / 3.846888 | 340.716 / 569.432 / 3.738799 | 355.780 / 612.500 / 3.821899 | 337.143 / 426.791 / 3.739827 |
| 调辅 | word4 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | 443.839 / 534.611 / 4.289764 | 435.083 / 511.093 / 4.246266 | 450.733 / 554.069 / 4.330341 | 437.707 / 512.829 / 4.240569 |

### v5.2 逐级辅键率与终局选重

单元格为「第一辅／第二辅／第三辅／终局选重」，均为频率加权百分比。第三辅为零表示合同不存在第三辅或该语料无需第三辅，与缺测不同；不把第一辅键率当作裸码非首选率（21×26 还存在三键至四键补主码阶段）。

| 编码轨 | 词长 | 冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26 | 冰雪莲道 CR-REF-7e650f7a4c 21×21 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | 原键道 S005 | 首道 B04 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 形辅 | character | 17.103% / 2.845% / 0.000% / 0.237% | 18.041% / 3.125% / 0.000% / 0.240% | 20.851% / 4.097% / 0.000% / 0.443% | 21.728% / 4.485% / 0.000% / 0.500% | 22.061% / 4.567% / 0.000% / 0.480% | 20.851% / 4.097% / 0.000% / 0.443% |
| 形辅 | word2 | 11.916% / 1.406% / 0.000% / 0.078% | 13.108% / 1.522% / 0.000% / 0.080% | 18.536% / 3.551% / 0.000% / 0.396% | 18.988% / 3.444% / 0.000% / 0.368% | 18.927% / 3.476% / 0.000% / 0.378% | 18.533% / 3.592% / 0.000% / 0.403% |
| 形辅 | word3 | 20.080% / 3.830% / 0.000% / 0.402% | 48.416% / 17.419% / 3.998% / 0.504% | 24.869% / 6.294% / 0.000% / 0.878% | 48.416% / 17.419% / 3.998% / 0.504% | 51.729% / 20.701% / 5.298% / 0.735% | 21.566% / 5.261% / 0.000% / 0.701% |
| 形辅 | word4 | 20.983% / 2.740% / 0.000% / 0.186% | 22.473% / 2.539% / 0.000% / 0.176% | 24.366% / 3.973% / 0.000% / 0.356% | 21.450% / 2.583% / 0.000% / 0.188% | 27.835% / 4.469% / 0.000% / 0.383% | 20.385% / 3.023% / 0.000% / 0.303% |
| 调辅 | character | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | 21.001% / 4.748% / 0.000% / 0.702% | 21.876% / 5.070% / 0.000% / 0.746% | 22.208% / 5.062% / 0.000% / 0.774% | 21.001% / 4.748% / 0.000% / 0.702% |
| 调辅 | word2 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | 18.536% / 3.960% / 0.000% / 0.567% | 18.988% / 3.811% / 0.000% / 0.525% | 18.927% / 3.861% / 0.000% / 0.532% | 18.533% / 3.956% / 0.000% / 0.589% |
| 调辅 | word3 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | 24.869% / 7.556% / 0.000% / 1.439% | 48.416% / 19.790% / 5.674% / 1.059% | 51.729% / 23.041% / 7.420% / 1.512% | 21.566% / 5.943% / 0.000% / 1.065% |
| 调辅 | word4 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | 24.366% / 4.610% / 0.000% / 0.577% | 21.450% / 3.176% / 0.000% / 0.323% | 27.835% / 5.199% / 0.000% / 0.638% | 20.385% / 3.672% / 0.000% / 0.444% |

### CKT v4 成本分解（原列带调适配）

本表继续原报告的八轨观察面；带调的 sanpin 是页面移除已内含声调重复击键后的研究适配轨，不代表新增了带调调辅生产方案。单元格为「运动 ms／第一辅率／第二辅率／终局选重率」。

| 编码轨 | 词长 | 冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26 | 冰雪莲道 CR-REF-7e650f7a4c 21×21 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | 原键道 S005 | 首道 B04 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| keytao | character | 98.643 / 17.103% / 2.845% / 0.237%[^zh-benchmark-toned-bcecc20e6696] | 99.323 / 18.041% / 3.125% / 0.240%[^zh-benchmark-toned-bcecc20e6696] | 97.520 / 20.851% / 4.097% / 0.443% | 102.066 / 21.728% / 4.485% / 0.500% | 112.423 / 22.061% / 4.567% / 0.480% | 103.095 / 20.851% / 4.097% / 0.443% |
| keytao | word2 | 392.129 / 11.916% / 1.406% / 0.078%[^zh-benchmark-toned-bcecc20e6696] | 400.321 / 13.108% / 1.522% / 0.080%[^zh-benchmark-toned-bcecc20e6696] | 381.485 / 18.536% / 3.649% / 0.416% | 403.968 / 18.988% / 3.466% / 0.371% | 414.429 / 18.927% / 3.474% / 0.374% | 397.156 / 18.533% / 3.639% / 0.413% |
| keytao | word3 | 339.608 / 20.080% / 3.830% / 0.402%[^zh-benchmark-toned-bcecc20e6696] | 326.540 / 48.416% / 17.419% / 3.998%[^zh-benchmark-toned-bcecc20e6696] | 348.864 / 24.869% / 6.275% / 0.858% | 328.150 / 48.416% / 17.911% / 4.198% | 339.067 / 51.729% / 21.108% / 5.498% | 336.483 / 21.566% / 5.251% / 0.729% |
| keytao | word4 | 430.624 / 20.983% / 2.740% / 0.186%[^zh-benchmark-toned-bcecc20e6696] | 435.579 / 22.473% / 2.539% / 0.176%[^zh-benchmark-toned-bcecc20e6696] | 442.604 / 24.366% / 4.066% / 0.455% | 434.616 / 21.450% / 2.646% / 0.242% | 449.331 / 27.835% / 4.562% / 0.499% | 436.115 / 20.385% / 3.263% / 0.383% |
| sanpin | character | 94.900 / 17.268% / 0.000% / 2.915%[^zh-benchmark-toned-bcecc20e6696] | 95.071 / 18.216% / 0.000% / 3.466%[^zh-benchmark-toned-bcecc20e6696] | 98.264 / 21.001% / 4.748% / 0.702% | 104.575 / 21.876% / 5.070% / 0.746% | 115.609 / 22.208% / 5.062% / 0.774% | 105.590 / 21.001% / 4.748% / 0.702% |
| sanpin | word2 | 373.641 / 0.000% / 0.000% / 11.916%[^zh-benchmark-toned-bcecc20e6696] | 379.163 / 0.000% / 0.000% / 13.108%[^zh-benchmark-toned-bcecc20e6696] | 382.969 / 18.536% / 3.977% / 0.589% | 406.857 / 18.988% / 3.892% / 0.557% | 416.540 / 18.927% / 3.916% / 0.564% | 398.366 / 18.533% / 3.961% / 0.587% |
| sanpin | word3 | 338.702 / 20.080% / 3.153% / 0.326%[^zh-benchmark-toned-bcecc20e6696] | 326.540 / 48.416% / 17.419% / 3.998%[^zh-benchmark-toned-bcecc20e6696] | 351.791 / 24.869% / 7.185% / 1.372% | 334.576 / 48.416% / 20.076% / 5.908% | 347.158 / 51.729% / 23.400% / 7.610% | 339.175 / 21.566% / 5.996% / 1.090% |
| sanpin | word4 | 430.171 / 20.983% / 2.415% / 0.161%[^zh-benchmark-toned-bcecc20e6696] | 434.574 / 22.473% / 1.805% / 0.134%[^zh-benchmark-toned-bcecc20e6696] | 445.784 / 24.366% / 4.622% / 0.619% | 437.864 / 21.450% / 3.372% / 0.348% | 454.202 / 27.835% / 5.545% / 0.708% | 438.636 / 20.385% / 3.739% / 0.512% |

### 冻结语料加权非首选率（v4 终局两辅观察面）

| 编码轨 | 词长 | 冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26 | 冰雪莲道 CR-REF-7e650f7a4c 21×21 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | 原键道 S005 | 首道 B04 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| keytao | character | **0.237%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **0.240%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **0.443%** ★★ | 0.500% | **0.480%** ★ | 0.443% |
| keytao | word2 | **0.078%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **0.080%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | 0.416% | **0.371%** ★★ | **0.374%** ★ | 0.413% |
| keytao | word3 | **0.402%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 3.998%[^zh-benchmark-toned-bcecc20e6696] | **0.858%** ★★ 🔹 | **4.198%** ★ | 5.498% | 0.729% |
| keytao | word4 | **0.186%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **0.176%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **0.455%** ★ | **0.242%** ★★ | 0.499% | 0.383% |
| sanpin | character | 2.915%[^zh-benchmark-toned-bcecc20e6696] | 3.466%[^zh-benchmark-toned-bcecc20e6696] | **0.702%** ★★ 🔷 🥇 | **0.746%** ★ 🔹 | 0.774% | 0.702% 🥇 |
| sanpin | word2 | 11.916%[^zh-benchmark-toned-bcecc20e6696] | 13.108%[^zh-benchmark-toned-bcecc20e6696] | 0.589% | **0.557%** ★★ 🔷 🥇 | **0.564%** ★ 🔹 | 0.587% |
| sanpin | word3 | **0.326%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 3.998%[^zh-benchmark-toned-bcecc20e6696] | **1.372%** ★★ 🔹 | **5.908%** ★ | 7.610% | 1.090% |
| sanpin | word4 | **0.161%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **0.134%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **0.619%** ★ | **0.348%** ★★ | 0.708% | 0.512% |

### 逐级辅键后的加权残余非首选率（v4）

使用零／一／二辅观察面；带调列取页面适配轨的第一辅率、第二辅率和终局选重率，声调已在主码内的阶段不重复追加。v5.2 的三辅行为以上方原生逐轨表为准。

| 编码轨 | 词长 | 阶段 | 冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26 | 冰雪莲道 CR-REF-7e650f7a4c 21×21 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | 原键道 S005 | 首道 B04 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| keytao | character | 零辅后 | **17.103%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **18.041%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **20.851%** ★★ | **21.728%** ★ | 22.061% | 20.851% |
| keytao | character | 一辅后 | **2.845%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **3.125%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **4.097%** ★★ | **4.485%** ★ | 4.567% | 4.097% |
| keytao | character | 二辅后 | **0.237%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **0.240%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **0.443%** ★★ | 0.500% | **0.480%** ★ | 0.443% |
| keytao | word2 | 零辅后 | **11.916%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **13.108%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **18.536%** ★★ | 18.988% | **18.927%** ★ | 18.533% |
| keytao | word2 | 一辅后 | **1.406%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **1.522%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | 3.649% | **3.466%** ★★ | **3.474%** ★ | 3.639% |
| keytao | word2 | 二辅后 | **0.078%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **0.080%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | 0.416% | **0.371%** ★★ | **0.374%** ★ | 0.413% |
| keytao | word3 | 零辅后 | **20.080%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 48.416%[^zh-benchmark-toned-bcecc20e6696] | **24.869%** ★★ 🔹 | **48.416%** ★ | 51.729% | 21.566% |
| keytao | word3 | 一辅后 | **3.830%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 17.419%[^zh-benchmark-toned-bcecc20e6696] | **6.275%** ★★ 🔹 | **17.911%** ★ | 21.108% | 5.251% |
| keytao | word3 | 二辅后 | **0.402%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 3.998%[^zh-benchmark-toned-bcecc20e6696] | **0.858%** ★★ 🔹 | **4.198%** ★ | 5.498% | 0.729% |
| keytao | word4 | 零辅后 | **20.983%**[^zh-benchmark-toned-bcecc20e6696] 🔷 | 22.473%[^zh-benchmark-toned-bcecc20e6696] | **24.366%** ★ | **21.450%** ★★ 🔹 | 27.835% | 20.385% 🥇 |
| keytao | word4 | 一辅后 | 2.740%[^zh-benchmark-toned-bcecc20e6696] | **2.539%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **4.066%** ★ | **2.646%** ★★ 🔹 | 4.562% | 3.263% |
| keytao | word4 | 二辅后 | **0.186%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **0.176%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **0.455%** ★ | **0.242%** ★★ | 0.499% | 0.383% |
| sanpin | character | 零辅后 | **17.268%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **18.216%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **21.001%** ★★ | **21.876%** ★ | 22.208% | 21.001% |
| sanpin | character | 一辅后 | **0.000%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **0.000%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **4.748%** ★★ | 5.070% | **5.062%** ★ | 4.748% |
| sanpin | character | 二辅后 | 2.915%[^zh-benchmark-toned-bcecc20e6696] | 3.466%[^zh-benchmark-toned-bcecc20e6696] | **0.702%** ★★ 🔷 🥇 | **0.746%** ★ 🔹 | 0.774% | 0.702% 🥇 |
| sanpin | word2 | 零辅后 | **0.000%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **0.000%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **18.536%** ★★ | 18.988% | **18.927%** ★ | 18.533% |
| sanpin | word2 | 一辅后 | **0.000%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **0.000%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 3.977% | **3.892%** ★★ | **3.916%** ★ | 3.961% |
| sanpin | word2 | 二辅后 | 11.916%[^zh-benchmark-toned-bcecc20e6696] | 13.108%[^zh-benchmark-toned-bcecc20e6696] | 0.589% | **0.557%** ★★ 🔷 🥇 | **0.564%** ★ 🔹 | 0.587% |
| sanpin | word3 | 零辅后 | **20.080%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 48.416%[^zh-benchmark-toned-bcecc20e6696] | **24.869%** ★★ 🔹 | **48.416%** ★ | 51.729% | 21.566% |
| sanpin | word3 | 一辅后 | **3.153%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 17.419%[^zh-benchmark-toned-bcecc20e6696] | **7.185%** ★★ 🔹 | **20.076%** ★ | 23.400% | 5.996% |
| sanpin | word3 | 二辅后 | **0.326%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | 3.998%[^zh-benchmark-toned-bcecc20e6696] | **1.372%** ★★ 🔹 | **5.908%** ★ | 7.610% | 1.090% |
| sanpin | word4 | 零辅后 | **20.983%**[^zh-benchmark-toned-bcecc20e6696] 🔷 | 22.473%[^zh-benchmark-toned-bcecc20e6696] | **24.366%** ★ | **21.450%** ★★ 🔹 | 27.835% | 20.385% 🥇 |
| sanpin | word4 | 一辅后 | **2.415%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **1.805%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **4.622%** ★ | **3.372%** ★★ | 5.545% | 3.739% |
| sanpin | word4 | 二辅后 | **0.161%**[^zh-benchmark-toned-bcecc20e6696] 🔹 | **0.134%**[^zh-benchmark-toned-bcecc20e6696] 🔷 🥇 | **0.619%** ★ | **0.348%** ★★ | 0.708% | 0.512% |

### 二／三／四字词终局碰撞桶（v4）

单元格为「碰撞桶／残余条目／跨词长桶／最大桶」。带调适配包未发布该组终局桶计数，不能用四码截面的桶数代填；下面另列已发布的四码截面，继续尝试对照跨词长贡献。

| 编码轨 | 词长 | 冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26 | 冰雪莲道 CR-REF-7e650f7a4c 21×21 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | 原键道 S005 | 首道 B04 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| keytao | word2 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | 3377 / 4033 / 760 / 9 | 2992 / 3621 / 266 / 9 | 3063 / 3671 / 411 / 8 | 3314 / 3965 / 714 / 9 |
| keytao | word3 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | 2227 / 2799 / 698 / 8 | 7383 / 11845 / 0 / 14 | 8806 / 15424 / 0 / 15 | 1873 / 2295 / 740 / 9 |
| keytao | word4 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | 1260 / 1531 / 425 / 9 | 666 / 816 / 185 / 9 | 1158 / 1473 / 340 / 8 | 962 / 1143 / 482 / 8 |
| sanpin | word2 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | 4882 / 6271 / 1113 / 11 | 4439 / 5778 / 466 / 8 | 4641 / 5968 / 746 / 9 | 4903 / 6278 / 1151 / 10 |
| sanpin | word3 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | 3202 / 4395 / 1079 / 11 | 9075 / 16820 / 0 / 20 | 9925 / 20476 / 0 / 21 | 2640 / 3491 / 1095 / 11 |
| sanpin | word4 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | 1692 / 2072 / 655 / 10 | 970 / 1169 / 327 / 10 | 1711 / 2096 / 547 / 10 | 1263 / 1466 / 683 / 11 |

### 四码五截面碰撞对照

按各词长 Top 500／1000／2000／5000／10000 的标准四码截面，单元格为「跨词长受影响率／首选损失率／碰撞桶／跨词长桶」。它衡量主码的跨词长贡献，不等于补辅后的终局选重率。

| 每类词条截面 | 冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26 | 冰雪莲道 CR-REF-7e650f7a4c 21×21 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | 原键道 S005 | 首道 B04 |
| --- | --- | --- | --- | --- | --- | --- |
| 500 | 0.380% / 0.180% / 38 / 3[^zh-benchmark-toned-bcecc20e6696] | 1.140% / 0.451% / 43 / 10[^zh-benchmark-toned-bcecc20e6696] | 1.229% / 0.483% / 49 / 8 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] |
| 1000 | 1.283% / 0.550% / 110 / 18[^zh-benchmark-toned-bcecc20e6696] | 2.344% / 0.995% / 119 / 33[^zh-benchmark-toned-bcecc20e6696] | 2.208% / 0.932% / 142 / 27 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] |
| 2000 | 2.738% / 0.924% / 314 / 78[^zh-benchmark-toned-bcecc20e6696] | 4.297% / 1.513% / 336 / 114[^zh-benchmark-toned-bcecc20e6696] | 3.954% / 1.544% / 388 / 94 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] |
| 5000 | 5.760% / 1.706% / 1319 / 394[^zh-benchmark-toned-bcecc20e6696] | 9.109% / 2.684% / 1463 / 572[^zh-benchmark-toned-bcecc20e6696] | 7.540% / 2.483% / 1653 / 459 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] |
| 10000 | 10.170% / 2.861% / 3662 / 1258[^zh-benchmark-toned-bcecc20e6696] | 15.106% / 4.367% / 4034 / 1770[^zh-benchmark-toned-bcecc20e6696] | 12.208% / 3.979% / 4385 / 1371 | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] | —[^zh-benchmark-missing-bcecc20e6696] |

### 当前结果的读法

日常纯双拼移动手分数可按同一 2149 击键文稿对照：RC26 145.320、UED 134.318、冰雪莲道 121.658、冰雪鹮道 138.089。冰雪鹮道的 v5.2 任务分数低于 RC26，冰雪莲道低于 UED，但这种差异同时包含主码声调信息、形辅合同和候选池贡献，不能单独归因于双拼键位更优。

模型分数不代表真人速度。当前规则的实际按键与逐场景回放见 [5500 字十二方案评测](十一场景_5500字_当前十二方案对比评测.md)；Rime 候选与性能门禁由 GitHub Actions 验证。
