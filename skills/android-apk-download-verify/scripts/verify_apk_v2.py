# -*- coding: utf-8 -*-
"""APK 完整性/身份核验：AXML 包名版本 + ZIP 完整性 + v2 内容摘要 + RSA 验签。

用法:
  python verify_apk_v2.py app.apk [--openssl <openssl路径>]

输出关键行: PACKAGE/VERSION/ZIP_BAD/DIGEST MATCH/SIGNATURE (Verified OK 或 SKIP:none)。
"""
import argparse
import hashlib
import os
import struct
import subprocess
import sys
import tempfile
import zipfile

U32 = lambda b, o: struct.unpack_from("<I", b, o)[0]
U64 = lambda b, o: struct.unpack_from("<Q", b, o)[0]
CHUNK = 1024 * 1024


def read_lp(buf, pos):
    n = U32(buf, pos)
    return buf[pos + 4: pos + 4 + n], pos + 4 + n


def parse_axml_manifest(manifest):
    def parse_pool(off):
        hsz = struct.unpack_from("<H", manifest, off + 2)[0]
        cnt, scnt, flags, s_start, s_styles = struct.unpack_from("<IIIII", manifest, off + 8)
        utf8 = bool(flags & 0x100)
        offs = struct.unpack_from("<%dI" % cnt, manifest, off + hsz)
        out = []
        for o in offs:
            p = off + s_start + o
            if utf8:
                n = manifest[p]; p += 1
                if n & 0x80:
                    p += 1
                n = manifest[p]; p += 1
                if n & 0x80:
                    n = ((n & 0x7F) << 8) | manifest[p]; p += 1
                out.append(manifest[p:p + n].decode("utf-8", "replace"))
            else:
                n = struct.unpack_from("<H", manifest, p)[0]; p += 2
                if n & 0x8000:
                    n = ((n & 0x7FFF) << 16) | struct.unpack_from("<H", manifest, p)[0]; p += 2
                out.append(manifest[p:p + n * 2].decode("utf-16-le", "replace"))
        return out

    typ, hsz, size = struct.unpack_from("<HHI", manifest, 0)
    strings = None
    off = hsz
    while off < size:
        ctype, chsz, csize = struct.unpack_from("<HHI", manifest, off)
        if ctype == 0x0001:
            strings = parse_pool(off)
        elif ctype == 0x0102:
            ns, name, a_start, a_size, a_count = struct.unpack_from("<IIHHH", manifest, off + 16)
            if strings[name] == "manifest":
                out = {}
                for i in range(a_count):
                    a = off + chsz + a_start + i * a_size
                    _ns, name_i, rawv, _sz, _res0, dt, dv = struct.unpack_from("<IIIHBBI", manifest, a)
                    key = strings[name_i]
                    if dt == 0x03 and rawv != 0xFFFFFFFF:
                        val = strings[rawv]
                    elif dt == 0x10:  # 布尔型；个别构建工具把 int 写成 0x10，按值判断
                        val = ("true" if dv else "false") if dv in (0, 1) else str(dv)
                    elif dt == 0x12:
                        val = str(dv)
                    elif dt == 0x01:
                        val = "ref:0x%08x" % dv
                    else:
                        val = strings[rawv] if rawv != 0xFFFFFFFF else "0x%08x" % dv
                    out[key] = val
                return out
        off += csize
    return {}


def content_digest(data, cd_off, block_start, eocd_off, eocd, hasher):
    """apksig 1MiB 扁平 chunk 算法：全段 chunk 摘要汇总到一个 0x5a 前缀。"""
    meocd = bytearray(eocd)
    struct.pack_into("<I", meocd, 16, block_start)  # CD offset 指向签名块起始
    segments = [data[:block_start], data[cd_off:eocd_off], bytes(meocd)]
    chunk_digests = []
    for seg in segments:
        for i in range(0, len(seg), CHUNK):
            c = seg[i: i + CHUNK]
            h = hasher()
            h.update(b"\xa5" + struct.pack("<I", len(c)) + c)
            chunk_digests.append(h.digest())
    h = hasher()
    h.update(b"\x5a" + struct.pack("<I", len(chunk_digests)))
    for cd in chunk_digests:
        h.update(cd)
    return h.digest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("apk")
    ap.add_argument("--openssl", default=None)
    args = ap.parse_args()
    path = args.apk
    data = open(path, "rb").read()
    total = len(data)
    print("FILE:", os.path.basename(path))
    print("SIZE:", total, "(%.2f MiB)" % (total / 1024 / 1024))
    print("MD5:", hashlib.md5(data).hexdigest())
    print("SHA256:", hashlib.sha256(data).hexdigest())

    with zipfile.ZipFile(path) as zf:
        bad = zf.testzip()
        print("ZIP_BAD:", bad)
        manifest = parse_axml_manifest(zf.read("AndroidManifest.xml"))
    print("PACKAGE:", manifest.get("package"))
    print("VERSION:", manifest.get("versionName"), "(versionCode %s)" % manifest.get("versionCode"))

    eocd_off = data.rfind(b"PK\x05\x06", max(0, total - 65557))
    if eocd_off < 0:
        print("DIGEST MATCH: False (no EOCD)")
        return 1
    cd_off = U32(data, eocd_off + 16)
    comment_len = struct.unpack_from("<H", data, eocd_off + 20)[0]
    eocd = bytearray(data[eocd_off: eocd_off + 22 + comment_len])
    if data[cd_off - 16: cd_off] != b"APK Sig Block 42":
        print("DIGEST MATCH: False (no APK Signing Block)")
        return 1
    block_total = U64(data, cd_off - 24) + 8
    block_start = cd_off - block_total

    pos = block_start + 8
    pairs = {}
    while pos < cd_off - 24:
        plen = U64(data, pos)
        pos += 8
        pairs[U32(data, pos)] = data[pos + 4: pos + plen]
        pos += plen
    v2 = pairs.get(0x7109871A)
    if not v2:
        print("DIGEST MATCH: False (no v2 block; only v1/v3 signed)")
        return 1

    signers, _ = read_lp(v2, 0)
    signer, _ = read_lp(signers, 0)
    signed_data, p = read_lp(signer, 0)
    signatures, p = read_lp(signer, p)
    digests_seq, _ = read_lp(signed_data, 0)
    rec, _ = read_lp(digests_seq, 0)
    alg = U32(rec, 0)
    expected, _ = read_lp(rec, 4)
    hasher = hashlib.sha256 if alg in (0x0103, 0x0101) else hashlib.sha512
    got = content_digest(data, cd_off, block_start, eocd_off, eocd, hasher)
    print("V2_ALG: 0x%04x" % alg)
    print("DIGEST MATCH:", got == expected)
    print("CONTENT_DIGEST:", got.hex())

    # 证书 + 签名
    cert_seq, q = read_lp(signed_data, len(read_lp(signed_data, 0)[0]) + 4)
    cert_der, _ = read_lp(cert_seq, 0)
    sig_alg = None
    sig_bytes = None
    spos = 0
    while spos < len(signatures):
        r, spos = read_lp(signatures, spos)
        sig_alg = U32(r, 0)
        sig_bytes, _ = read_lp(r, 4)
    print("SIGNATURE_ALG: 0x%04x" % sig_alg)

    if not args.openssl:
        print("SIGNATURE: SKIP (no --openssl)")
        return 0 if got == expected else 1
    dgst_alg = "sha256" if sig_alg in (0x0103, 0x0101) else "sha512"
    with tempfile.TemporaryDirectory() as td:
        cert_p = os.path.join(td, "cert.der")
        pub_p = os.path.join(td, "pub.pem")
        sd_p = os.path.join(td, "signed_data.bin")
        sig_p = os.path.join(td, "sig.bin")
        open(cert_p, "wb").write(cert_der)
        open(sd_p, "wb").write(signed_data)
        open(sig_p, "wb").write(sig_bytes)
        with open(pub_p, "wb") as f:
            r = subprocess.run([args.openssl, "x509", "-inform", "DER", "-in", cert_p,
                                "-pubkey", "-noout"], stdout=f)
        if r.returncode != 0:
            print("SIGNATURE: FAIL (cannot read cert)")
            return 1
        r = subprocess.run([args.openssl, "dgst", "-" + dgst_alg, "-verify", pub_p,
                            "-signature", sig_p, sd_p], capture_output=True)
        out = (r.stdout + r.stderr).decode("utf-8", "replace").strip()
        print("SIGNATURE:", "Verified OK" if r.returncode == 0 else "FAIL " + out)
        fp = subprocess.run([args.openssl, "x509", "-inform", "DER", "-in", cert_p,
                             "-noout", "-fingerprint", "-sha256"], capture_output=True)
        print("CERT_SHA256:", (fp.stdout).decode("utf-8", "replace").strip())
    return 0 if (got == expected and r.returncode == 0) else 1


if __name__ == "__main__":
    sys.exit(main())
