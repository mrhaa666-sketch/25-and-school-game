# 音效构建脚本

- `oga.py`：在 OpenGameArt 上按 CC0 搜索、查看作者 / 授权 / 文件。
- `build_audio.py`：把下载的原始素材剪辑成 `assets/audio/` 里的文件（循环音做首尾交叉淡化、统一音量）。

原始素材（不在仓库里）：Kenney 的 impact-sounds / rpg-audio / interface-sounds，
以及 `CREDITS.md` 里列出的 OpenGameArt 页面。下载到同一个目录后：

```
python3 tools/audio/build_audio.py <素材目录> assets/audio
```
