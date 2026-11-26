# 方案英文标识迁移

方案标识统一为「snow_ + 中文方案名的拼音」。布局和辅序不变，十一个方案继续发布，九份键位图继续包含冰雪键道和冰雪三拼。

| 方案 | 旧 schema_id | 新 schema_id |
| --- | --- | --- |
| 冰雪兰道 | snow_jiandao | snow_landao |
| 冰雪兰拼 | snow_sanpin | snow_lanpin |
| 冰雪键道 | snow_jiandao_classic | snow_jiandao |
| 冰雪三拼 | snow_sanpin_classic | snow_sanpin |
| 冰雪莲道 | snow_jiandao_toned | snow_liandao |
| 冰雪鹮道 | snow_zhudao | snow_huandao |
| 冰雪鹤道 | snow_shenyun_shape | snow_hedao |
| 冰雪鹤拼 | snow_shenyun_tone | snow_hepin |

冰雪四拼 `snow_sipin`、冰雪一拼 `snow_yipin`、冰雪清韵 `snow_qingyun` 不变。历史快照、实验编号和显式用户词典存储名称保留原值，不能对用户数据目录做全局字符串替换。

## 升级已有安装

先备份 Rime 用户目录，再退出输入法。使用新仓库中的 `bun scripts/migrate-schema-ids.ts "Rime 用户目录"` 迁移 `default.custom.yaml`、`user.yaml` 和方案补丁。脚本同时读取旧补丁后再写入，避免把旧兰道补丁错配给新键道；备份保存在 `schema-id-migration-backup/`，完成标记避免重复迁移。已有新旧同名目标补丁冲突时中止，不自动合并。

旧 `.userdb` 保留原位；各方案显式配置的 `translator/user_dict_name` 保持不变。输入统计按 schema_id 分组，旧统计仍保留在统计数据库中，新标识会开始新的统计分组。

移动端没有 Bun 时，在电脑上对导出的旧用户目录执行迁移，再导入配置。不要把旧 `snow_jiandao.custom.yaml` 或 `snow_sanpin.custom.yaml` 原样复制到新安装，因为这两个标识的方案含义已改变。

安装方案和皮肤时优先使用新的独立目录，不要把新包解压到旧包目录后直接重新打包。覆盖导入通常不会删除旧文件；新包已移除的旧 schema 仍可能出现在客户端的可选列表。确认新安装正常后，通过客户端管理入口移除旧安装，保留用户词典和备份。

元书的 `.cskin` 现在从全新临时目录打包，避免旧输出目录的键位图页面混入包中。客户端覆盖导入后的资源缓存及旧皮肤仍需在设备上确认；此修改不代表已经更新手机上的安装。
