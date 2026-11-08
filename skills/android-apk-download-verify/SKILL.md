---
name: android-apk-download-verify
description: "下载安卓 APK（官网无直链时走应用商店/豌豆荚）并核验完整性：豌豆荚 /download/dot 302 拿 ucdl.25pp.com 直链，解析 AXML 得包名/版本，按 apksig 扁平 chunk 算法复核 v2 内容摘要 + openssl 验签。Triggers: 下载 APK, 安卓安装包, apk 直链, 应用商店下载, 豌豆荚, 校验 APK, v2 签名, 安装包完整性, apksig, apk 签名验证"
---

# 安卓 APK 下载与完整性核验

用户要「某 App 的安装包」时：拿到可信来源的真实 APK，并用可复核的证据证明「包没坏、没被改」。

<role>在官网无 APK 直链的情况下，从国内应用商店解析直链并交付经过签名核验的安装包</role>

## 一、先定身份，再找直链

1. **确认包名**：从应用商店详情页（豌豆荚/小米/vivo/应用宝）的 URL 或页面 `data-app-pname`、`pkgname` 参数取得，应用名只作辅助。
   注意商店**改名**：同一包名可能已换品牌名（如 `com.iapp.app` 商店名「测兆编程」，用户仍叫它 iApp）。以内里字符串（dex 中的官网域名、专有名词）与包名为准，别只信商店标题。
2. **官方站常只有企业介绍页**（如 i63.cn），找不到 APK；此时用商店镜像的「官方版本」通道。

## 二、豌豆荚直链解析（国内包最稳的公开直链）

```powershell
# 1) 详情页拿版本号/vcode（302 到带 appid 的 URL）
$r = Invoke-WebRequest 'https://www.wandoujia.com/apps/<包名或appid>' -UserAgent $ua -MaximumRedirection 5
$r.Content | Select-String 'data-app-vname="([^"]+)"'
# 2) 下载入口 302 到 CDN，Location 里的 md5= 参数就是官方 MD5
Invoke-WebRequest 'https://www.wandoujia.com/apps/<appid>/download/dot?ch=detail_ndownload&pos=detail-ndownload-<pkg>' `
  -MaximumRedirection 0 -ErrorAction SilentlyContinue
# $_.Exception.Response.Headers.Location -> https://ucdl.25pp.com/fs08/...apk?...&md5=<md5>
# 3) 下载（curl 带 referer 即可，实测 5 MB/s 量级）
curl.exe -L --fail --retry 3 -A "Mozilla/5.0" -e "https://www.wandoujia.com/" -o app.apk "<Location>"
```

- 交叉核对：豌豆荚/vivo/小米在版本号、大小上应一致（如 142.38 MB、v5.0.1015）。
- 应用宝 `sj.qq.com/appdetail/<pkg>` 的 `apk_url` 实测为空，走客户端下载，不适合脚本抓取。
- APKPure/APKMirror 在部分网络 403，时间优先给豌豆荚通道。

## 三、核验（4 项，脚本一次出证据）

```powershell
$py = <bundled python>
& $py scripts/verify_apk_v2.py app.apk --openssl "C:\Program Files\Git\usr\bin\openssl.exe"
```

| 检查 | 合格证据 |
|---|---|
| 下载完整 | 文件大小 == CDN `Content-Length`；`Get-FileHash -Algorithm MD5` == URL `md5=` 参数 |
| ZIP 完整 | `zipfile.testzip()` 返回 None；entries 数正常 |
| 身份正确 | AXML 解析出 `package`、`versionName`、`versionCode` 与商店页一致 |
| 未被篡改 | v2 内容摘要与签名块一致 **且** RSA 签名 `Verified OK`，打印签名证书 SHA-256 指纹 |

脚本输出应包含 `DIGEST MATCH: True` 与 `SIGNATURE: Verified OK`。两者都过才算「签名与内容完整」，可交付。

## 四、v2 内容摘要算法（踩过的坑）

- 段：`[entries] [central directory] [EOCD]`；**EOCD 的 CD offset 要改写为签名块起始偏移**（apksig：`beforeApkSigningBlock.size()`），EOCD 注释保留。
- 每段按 1 MiB 分块；块摘要 = `H(0xa5 || LE32(len) || chunk)`。
- **最终摘要是全段扁平的**：`H(0x5a || LE32(总块数) || 依次拼接所有块的摘要)`。
  早期网文常写成「每段各自 `0x5a` 段摘要再拼接」，那是错的，会得到 `MATCH False`，先改算法再怀疑包被改。
- 签名覆盖 `signed_data`（digest 列表+证书+附加属性），不是摘要本身。证书取 v2 块里第一张，`openssl x509 -inform DER -pubkey` 后 `openssl dgst -sha256 -verify`。

## 五、交付与说明

- 交付 APK 原文件，附：版本号、包名、大小、MD5/SHA-256、签名证书指纹、来源页。
- 安装提示：Android 5.0+；首次安装需允许「未知来源」；多数手机需给存储权限，否则项目存不上；老旧机型或系统过低可能打不开。
- 商店改名类应用要提前说明：「装好显示的名字可能是 XX，包名仍是 YY」，避免用户以为下错。

## 失败征兆与处理

- `MATCH False`：先按上面扁平算法自查（最常见是分块/段边界、EOCD offset 改写漏了），仍不符再判定包被改。
- `jarsigner -verify` 退出码非 0、报「signed in JarFile but not JarInputStream」是 APK 用 jarsigner 校验的固有噪声（v1 只覆盖部分条目），**不作为失败依据**；以 v2 摘要 + RSA 验签为准。
- `openssl dgst` 报 `Verification failure`：证书与签名块不配对，或摘取了错误的签名记录。
- 文件大小与 CDN 声明不一致：下载中断，`curl --retry` 重下后再核验。
