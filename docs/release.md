# 双端 Release 发布手册

本仓库的发布目标只有 GitHub `ChenZhu-Xie/rime-snow-pinyin` 和 Gitee `xie-chenzhu/rime-snow-pinyin`。`rimeinn/rime-snow-pinyin`、`input.tansongchen.com` 及 `tansongchen/input` 属于上游作者；除非用户明确把对应仓库纳入任务，不得向其推送、替其发布或修改其网站。

## 发布物与版本

每次发布前先获取并检查上游标签，使用上游最新标签作为本 fork 的发布标签，标签号必须完全一致，不自行递增。版本号只通过 `bun scripts/version.ts <版本>` 修改。

公开发布物固定为：

- `snow-pinyin.zip`：用户安装包，必须包含 `deps/rime-radical-pinyin` 中的 `radical_pinyin.schema.yaml` 和 `radical_pinyin.dict.yaml`。
- `snow-pinyin-build.zip`：从隔离目录编译出的预览包，不得使用正在运行的小狼毫用户目录。
- `snow-pinyin-skins-hamster.zip`：元书皮肤包。
- `snow-pinyin-skins-trime.zip`：同文皮肤包。

正常发布以 [`.github/workflows/release.yml`](../.github/workflows/release.yml) 为打包合同；手工重建时必须从目标 commit 的干净导出开始，并复现工作流中的依赖复制、皮肤生成、预览裁剪和编译步骤。

## Git 与远端边界

分支和标签通过 SSH 推送。每次 GitHub 或 Gitee Git 操作前运行：

```powershell
git swap auto
git remote get-url --push --all origin
```

预期的两个 push URL 为：

```text
git@git-swap-github-chenzhu-xie:ChenZhu-Xie/rime-snow-pinyin.git
git@git-swap-gitee-more-14-different:xie-chenzhu/rime-snow-pinyin.git
```

推送后分别以显式 SSH URL 执行 `git ls-remote`，确认目标分支或标签与本地 commit 一致。SSH 只能传输 Git 对象，不能创建 Release 页面或上传附件。

## 正常新标签发布

1. 完成本地静态、生成、语料和必要的方案测试，提交并推送分支，确认 GitHub Actions 通过。
2. 按上游最新标签准备带发布说明的 annotated tag，经 `git swap auto` 后将同一标签推送到两个 SSH 远端。
3. 标签 push 会触发 GitHub 的“发布”工作流；性能门禁通过后，工作流创建 GitHub Release 并上传四个压缩包。
4. 在 Gitee 使用下述 API 流程创建同标签 Release，并上传同一批附件。
5. 执行“发布后核验”。

## 同标签由 CI 重建并覆盖资产

当上游最新标签已用于本 fork、但需要用当前分支的新提交更新同标签附件时，不移动或重建标签。在 GitHub Actions 手动运行“发布”工作流，选择待构建分支并将 `release_tag` 设为既有标签；工作流仍先执行性能门禁，再从所选分支的提交构建四个压缩包，仅覆盖指定 GitHub Release 的同名附件。

GitHub 构建成功后，从该 Release 下载四个附件，将完全相同的文件通过 Gitee API 覆盖到同标签 Release。同步两端正文，在发布说明中记录附件构建 commit，并明确自动生成的源码归档仍对应未移动的标签 commit，最后执行“发布后核验”。

## 同标签只覆盖资产且不触发 CI

仅当用户明确要求“tag 不变、覆盖资产、不触发 CI”时使用本地重建流程。不得 push、删除、重建或移动标签，也不得手动 dispatch 工作流；从用户指定的 commit 干净重建四个发布物。

GitHub 必须显式指定 fork，避免 `gh` 根据上游关系解析到错误仓库：

```powershell
gh release upload <tag> --repo ChenZhu-Xie/rime-snow-pinyin <四个资产路径> --clobber
```

Gitee 按下一节替换附件。若资产来自比未变标签更新的 commit，发布报告必须记录资产构建 commit，并明确 GitHub/Gitee 自动生成的源码归档仍对应标签 commit。

## Gitee Release API

Gitee Release 的鉴权独立于 Git SSH 和 Git Credential Manager。专用 token 位于 `$HOME/.config/gitee/credentials.yml`，使用 `yq eval -r '.token'` 读取到内存，以 `Authorization: Bearer <token>` 请求 API；不得把 token 写入命令输出、日志、仓库或发布说明。

API 基址为 `https://gitee.com/api/v5/repos/xie-chenzhu/rime-snow-pinyin`：

- Release 不存在时：`POST /releases`，提交 tag、标题和 UTF-8 发布说明。
- Release 已存在时：取得 release ID；如需同步标题或正文，用 UTF-8 JSON 请求 `PATCH /releases/{release_id}`。
- 覆盖附件时：列出附件，针对同名旧附件执行 `DELETE /releases/{release_id}/attach_files/{attach_file_id}`，再将当前文件以 multipart 请求 `POST /releases/{release_id}/attach_files`。

不要为了替换附件删除整个 Release；这会破坏已有链接、时间和元数据。

## 发布后核验

1. 检查 GitHub 与 Gitee 的 peeled tag commit 完全一致，且等于预期 commit。
2. 检查两端 Release 的标签、标题、正文和四个附件名。
3. 从两个公开 Release 分别下载四个附件，与本地构建逐一比较 SHA-256；只看上传成功响应不算完成。
4. 检查 GitHub Actions 是否符合本次模式：正常新标签和 CI 重建同标签资产应有对应的发布工作流；明确要求不触发 CI 的本地重建不应产生新运行。
5. 报告发布链接、标签 commit、资产构建 commit、八次下载校验结果，以及任何“标签源码归档与新资产来自不同 commit”的例外。

## 文档边界

本 fork 的行为、安装说明、快捷键、词库、皮肤及统计变化，只同步到本仓库维护的 README、`docs/`、方案配置和 Release 说明，并检查下载链接指向本 fork。上游作者的网站不是本 fork 发布的前置条件，也不是默认发布目标。
