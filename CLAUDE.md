# 冰雪拼音开发约定

## 实际目录

Rime 实际读取的用户目录 `~/.local/share/fcitx5/rime` 里的 `snow_*.schema.yaml`、
`snow_*.dict.yaml`、`snow_*.fixed.txt`、`lua/snow` 都是软链，指回本仓库，因此**不存在
"同步"这一步**：在任一侧改动就是改同一份文件，`git pull` 之后在输入法里重新部署即可生效。

```sh
bun scripts/tasks.ts link      # 建立软链（幂等，仓库新增文件后重跑一次）
bun scripts/tasks.ts unlink    # 还原成独立副本
```

软链前若实际目录里的某份文件与仓库不一致，`link` 会列出冲突并中止；先把需要的改动
拷回仓库，或确认仓库版本正确后用 `link --force`。

实际目录里仍然独立的是本机私有、且已被 `.gitignore` 排除的那些：`*.custom.yaml`、
`*.userdb`、`build/`、`user.yaml`、`installation.yaml`。用户词典不进仓库，所以在仓库里
跑 mira 测试（会写 `snow_pinyin.userdb`）不会污染实际使用的词频。

## 测试

测试位于 `spec/*.test.yaml`，由 [mira](https://github.com/rimeinn/mira) 运行：

```sh
cp rime-stroke/stroke* .          # 笔画反查依赖
mira -C cache spec/snow_sipin.test.yaml
```

断言环境中可用的变量只有 `cand`（元素含 `.text` 和 `.comment`）、`preedit` 和 `commit`；
`assert` 的内容会被包进 `return (...)`，因此只能写表达式，不能写语句。

### 固定词（方案码固态词典）只测一类一例

各方案文档里常常把固顶词成批列出（如冰雪清韵列出了 7 个「韵」码、21 个「声空」码、
80 个「声韵」码、19 个词语「声韵」码、46 个词语「声声韵」码）。**测试中每一类只取一个
例子即可**，不要把文档里的清单逐条搬进测试。这些条目都来自 `snow_*.fixed.txt`，
逐条断言只是在重复词典文件的内容，既不增加覆盖率，又让测试文件难以阅读和维护。

需要验证整份固定词表时，应当直接比对 `snow_*.fixed.txt`，而不是写成测试用例。

### 按部署隔离会改变状态的用例

同一个 `deploy` 内各 `send` 共享用户词典，上屏会改变词频。由于存在动态码长，
一个词上屏后会迁移到更短的编码上，并因首选后置而从原编码的首选位置消失——例如
`bxouivrf` 上屏「冰雪」之后，`bxoui` 的首选就不再是「冰雪」。因此：

- 依赖原始词频的断言放在 `popping` 部署，且排在所有上屏类用例之前；
- 动态码长、自动造词、缓冲造词等会写用户词典的用例放进独立部署
  （`encoding` / `buffered` / `schema_userdb`）。

### 其他注意点

- `has()` 扫描的是全部候选（可达上百个），文档说「出现在首页」时要用 `page()`
  （`page_size` 为 6）。
- mira 会把音节码用户词典写回仓库根目录的 `snow_pinyin.userdb`（五个方案共用），
  本地连续运行会累积词频。CI 每个 job 都是全新 checkout，不受影响；本地复现 CI
  结果前先 `rm -rf *.userdb`。

## processors 顺序

五个顶功方案（sipin / sanpin / yipin / jiandao / qingyun）共用一套相对顺序，新增或移动
处理器时按下表对齐，不要各方案各排一套：

```yaml
  processors:
    - ascii_composer
    - chord_composer                        # 仅 yipin
    - lua_processor@*snow.shape_processor    # qingyun 无
    - lua_processor@*snow.abbreviation      # 仅 sipin
    - lua_processor@*snow.select_character  # yipin 无
    - lua_processor@*snow.popping           # yipin 用 combo_popping
    - recognizer
    - lua_processor@*snow.user_dict         # yipin 无
    - key_binder
    - lua_processor@*snow.editor            # 仅 sipin、qingyun
    - speller
    - punctuator
    - selector
    - navigator
    - express_editor
```

### 判定规则：先问「这个键会不会被顶功吃掉」

`popping` 只要通过了前置守卫（非 release / alt / ctrl / caps，当前段带 `abc` tag），
就**必定**会 `env.engine:process_key()` 重投递按键并返回 `kAccepted`（`lua/snow/popping.lua`
末尾）。重投递是从处理器链顶部重新走一遍，`env.processing` 只让 popping 自己空转。
因此排在 popping 之后不等于收不到键，只是晚一轮收到。判定某个处理器 P 该排哪边：

1. 把 P 想要的按键和本方案 `speller/popping` 各条规则的 `accept` 集合对一遍；
2. **落在里面** → popping 会先顶屏，P 必须排在 popping **之前**才抢得到；
3. **不落在里面** → popping 原样重投，P 排在后面也收得到 → **默认排后面**；
4. 特例：P 故意只认小写形式，靠 popping 的大写→小写转换来触发 → 必须排在 popping
   **之后**，否则大小写分工失效。

### 硬约束及其出处

- `shape_processor` < `popping`：辅助码键落在顶功的 accept 集合里。yipin 最明显——
  `combo_popping` 的规则是「完整音节之后任何小写字母都顶屏」，辅助码的 `v` 和后续
  字母全在其中。
- `abbreviation` < `popping`：略码用大写字母，命中「大写参与编码」和「标点大写顶」。
  排到 popping 之后还会收到被转成小写的键，大小写区分直接丢失。
- `select_character` < `popping`：`[` `]` 命中「标点大写顶」（`accept: "[^a-z0-9 ]"`）。
- `popping` < `recognizer`：jiandao 的 `recognizer/patterns/jianpin` 是**无前缀**的
  `^[bpmfdtnlgkhjqxzcsrywe]{3,}$`，会匹配普通编码；recognizer 作为 processor 会自己
  `PushInput` 并返回 `kAccepted`，排在 popping 前面会让 3 码以上的顶功静默失效
  （短码仍然正常，很容易漏测）。qingyun 把反查模式都加了 `` ` `` 前缀，所以没这个问题。
- `popping` < `editor`：回头补码在 qingyun 是靠大写元音触发的——大写键命中
  `strategy: append` 的规则，不顶屏，再被转成小写重投给 editor。editor 排到 popping
  前面会让小写元音直接去补码，顶功失效。sipin 的补码用小写元音，不在它的 accept
  集合里，两边都行，取交集即排在后面。
- `user_dict` < `key_binder`：`snow_pinyin` 里绑了 `Control+bracketleft → Escape`，
  排在后面会被抢走。另外 user_dict 的上移/下移分支落空时返回 `kAccepted` 而不是
  `kNoop`，否则 `Control+[` 会穿透成 Escape 清空整句。
- `shape_processor` < `key_binder`：sipin 的 `1` 既是辅助码触发键，又被绑成了「定位」。
- `recognizer` < `key_binder` 以及 `speller` 之后的五个组件：沿用 Rime 原生顺序。

### 两个教训

- **不要按「多数票」决定没想清楚的那一对。** `recognizer` 与 `shape_processor` 的次序
  曾按 3:1 的多数定成 `recognizer` 在前，jiandao 上手测也看不出差别，结果 yipin 的
  440 条用例里挂了 3 条辅助码用例——真正的约束是 `shape_processor` < `popping`，
  跟 recognizer 没关系。拿不准就跑 mira。
- **「某个功能完全不工作」不一定是 bug，可能是大写回投在撑着。** 直接测小写键会看到
  功能像是死的（qingyun 的 editor 就是这样），要连大写一起测。

### 验证方法

改动 processors 顺序后跑全部五份 spec，不要只跑改动的那一个：

```sh
for s in snow_sipin snow_sanpin snow_yipin snow_jiandao snow_qingyun; do
  mira -C cache spec/$s.test.yaml
done
```

需要手工探查单步行为时，用 librime 自带的 `rime_console`（本机 `~/Public/librime`
的 build 里带 librime-lua，能真正跑 `lua/snow` 的处理器）：把仓库 rsync 到临时目录，
补上 `default.yaml`／`essay.txt`，写一份只含待测方案的 `default.custom.yaml`，然后
`rime_console -i`。每行一个按键即可逐步观察，非字母键要写成 `{bracketleft}`、
`{Control+bracketleft}`；输出的 `comp. : [{abc,jianpin}dejx=>得奖]` 会显示当前段的
tag，正好用来判断 lua 处理器里 `segment:has_tag("abc")` 这类守卫会不会放行。
