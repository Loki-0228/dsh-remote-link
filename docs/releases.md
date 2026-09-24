# 发布移动端安装包

源码在 `apps/android` 和 `apps/ios`。本地发布文件输出到 `release/`，该目录不提交到 Git。GitHub Releases 保存供用户下载的 APK、IPA、插件安装包和校验值。

插件仍可从仓库根目录安装。`package.json.files` 只允许插件的 lib、bin、src、配置和说明文件。CI 检查实际 npm 打包清单，拒绝移动端源码、APK、IPA、构建目录及签名文件。

## 准备附件

1. 在 Windows 运行 Android 构建：

```powershell
pwsh -File apps/android/build.ps1 -Sdk D:/SDK -Java D:/Java/jdk-17
```

保留本地 Android 签名密钥，后续版本沿用同一密钥。可以通过 `-KeyStore` 指定已有密钥，或用 `-OutputDirectory` 指定仓库外的发布目录。不要上传密钥。

2. 在 Mac 构建 IPA，或从成功的「Build iPad IPA」Actions 运行下载附件：

```bash
bash apps/ios/scripts/build-unsigned.sh
bash apps/ios/scripts/test-ipad.sh
```

3. 将 APK 与 IPA 放到同一个发布目录，生成插件安装包：

```powershell
npm.cmd pack --pack-destination release --json > release/plugin-pack.json
node scripts/check-package.mjs release/plugin-pack.json
```

4. 核对 Android 签名及 IPA 测试结果，并将源码改动合并到 main。

## 发布 Release

准备具有该仓库 contents 写权限的 GitHub token，通过环境变量 `GH_TOKEN` 或 `GITHUB_TOKEN` 传入。不要把 token 写进脚本或提交到仓库。

标签必须等于 package.json 中版本号的 v 前缀形式，提交必须使用完整 SHA。先预览：

```powershell
node scripts/publish-release.mjs v0.4.1 <完整提交SHA> release --dry-run
```

确认文件清单后发布：

```powershell
node scripts/publish-release.mjs v0.4.1 <完整提交SHA> release
```

脚本先建立草稿，再上传并核对 GitHub 返回的 SHA-256，最后公开发布。网络中断后可用同一命令继续；已有附件必须与本地校验值相同，脚本不会覆盖或删除附件。Actions artifact 用于构建验收，正式下载入口为 GitHub Releases。
