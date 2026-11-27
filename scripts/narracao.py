"""Gera a narração gravada das histórias da floresta (uma voz neural por idioma).

Lê os textos de frontend/src/features/home/components/stories.ts e cria, em frontend/public/narracao/:
  pt-01.mp3, pt-02.mp3 ... (um arquivo por parágrafo), e pt.json (duração de cada um), o mesmo para en e ja.

Usa o edge-tts (gratuito, vozes neurais do Edge; precisa de internet) e, para medir a duração, o mutagen:
  pip install edge-tts mutagen
Uso:
  python scripts/narracao.py                      # os três idiomas
  python scripts/narracao.py --only pt            # só um
  python scripts/narracao.py --list-voices pt     # vozes disponíveis para um idioma
  python scripts/narracao.py --voice pt=pt-BR-AntonioNeural --rate -15%
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STORIES = ROOT / "frontend" / "src" / "features" / "home" / "components" / "stories.ts"
OUT = ROOT / "frontend" / "public" / "narracao"

# Vozes neurais de contadora de histórias; troque com --voice ou veja as opções com --list-voices.
VOICES = {"pt": "pt-BR-FranciscaNeural", "en": "en-US-AriaNeural", "ja": "ja-JP-NanamiNeural"}
PAUSE = 1.1  # segundos de silêncio entre os parágrafos (o site cuida dessa pausa)


def read_paragraphs() -> dict[str, list[str]]:
    """Os parágrafos de cada idioma, tirados do stories.ts (strings entre aspas dentro de `paragraphs: [ ... ]`)."""
    source = STORIES.read_text(encoding="utf-8")
    result: dict[str, list[str]] = {}
    for lang in ("pt", "en", "ja"):
        block = re.search(rf"^  {lang}: \{{.*?paragraphs: \[(.*?)^    \],", source, re.S | re.M)
        if not block:
            raise SystemExit(f"Não achei a história '{lang}' em {STORIES}")
        strings = re.findall(r'"((?:[^"\\]|\\.)*)"', block.group(1))
        result[lang] = [json.loads(f'"{text}"') for text in strings]
    return result


def duration(path: Path) -> float:
    try:
        from mutagen.mp3 import MP3

        return round(MP3(str(path)).info.length, 2)
    except ImportError:
        return round(path.stat().st_size * 8 / 48000, 2)  # o edge-tts gera 48 kbps


async def synthesize(text: str, voice: str, rate: str, pitch: str, path: Path) -> None:
    import edge_tts

    last: Exception | None = None
    for attempt in range(4):
        try:
            tmp = path.with_suffix(".tmp")
            await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(str(tmp))
            if tmp.stat().st_size < 1000:
                raise RuntimeError("áudio vazio")
            tmp.replace(path)
            return
        except Exception as error:  # a rede às vezes falha: tenta de novo
            last = error
            await asyncio.sleep(1.5 * (attempt + 1))
    raise SystemExit(f"Falhou ao gerar {path.name}: {last}")


async def build(lang: str, paragraphs: list[str], voice: str, rate: str, pitch: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    clips = []
    for number, text in enumerate(paragraphs, start=1):
        path = OUT / f"{lang}-{number:02d}.mp3"
        print(f"  {path.name}: {text[:60]}…")
        await synthesize(text, voice, rate, pitch, path)
        clips.append({"file": path.name, "seconds": duration(path)})
    # arquivos de uma versão anterior mais longa da história
    for old in OUT.glob(f"{lang}-*.mp3"):
        if int(old.stem.split("-")[1]) > len(paragraphs):
            old.unlink()
    # "texts" deixa o site saber de que texto é a gravação: se a história mudar, ele não usa o áudio antigo
    manifest = {"voice": voice, "texts": paragraphs, "pause": PAUSE, "clips": clips}
    (OUT / f"{lang}.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total = sum(c["seconds"] for c in clips) + PAUSE * (len(clips) - 1)
    print(f"  {lang}.json: {len(clips)} trechos, {total:.0f} s no total\n")


async def list_voices(lang: str) -> None:
    import edge_tts

    for voice in await edge_tts.list_voices():
        if voice["Locale"].lower().startswith(lang):
            print(f'{voice["ShortName"]:32} {voice["Gender"]:7} {voice.get("VoiceTag", {}).get("VoicePersonalities", "")}')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", choices=["pt", "en", "ja"], help="gera só este idioma")
    parser.add_argument("--voice", action="append", default=[], metavar="IDIOMA=VOZ", help="troca a voz de um idioma")
    parser.add_argument("--rate", default="-12%", help="velocidade da fala (padrão -12%%: mais devagar, como quem conta uma história)")
    parser.add_argument("--pitch", default="-2Hz", help="tom da voz (padrão -2Hz: um pouco mais grave)")
    parser.add_argument("--list-voices", metavar="IDIOMA", help="mostra as vozes disponíveis (pt, en ou ja) e sai")
    args = parser.parse_args()

    if args.list_voices:
        asyncio.run(list_voices(args.list_voices))
        return
    voices = dict(VOICES)
    for item in args.voice:
        lang, _, name = item.partition("=")
        if lang not in voices or not name:
            sys.exit(f"--voice espera IDIOMA=VOZ (ex.: pt=pt-BR-AntonioNeural), recebi '{item}'")
        voices[lang] = name
    stories = read_paragraphs()
    for lang in ([args.only] if args.only else ["pt", "en", "ja"]):
        print(f"{lang}: {voices[lang]}")
        asyncio.run(build(lang, stories[lang], voices[lang], args.rate, args.pitch))
    print(f"Pronto: arquivos em {OUT}. Faça o commit da pasta frontend/public/narracao.")


if __name__ == "__main__":
    main()
