"""문서를 바꾸지 않고 목차와 로컬 링크를 검사한다."""
import re
import sys
from html import unescape
from urllib.parse import unquote, urlsplit

from cg import core


def blank(text):
    return re.sub(r"[^\n]", " ", text)


def without_code(text, inline=True):
    # 줄 번호와 문자 위치를 보존한다. 닫히지 않은 울타리도 끝까지 코드다.
    lines = []
    fence = None
    for line in text.splitlines(keepends=True):
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", line.rstrip("\r\n"))
        if fence:
            lines.append(blank(line))
            if marker and marker[1][0] == fence[0] and len(marker[1]) >= len(fence) and not marker[2].strip():
                fence = None
        elif marker and (marker[1][0] != "`" or "`" not in marker[2]):
            fence = marker[1]
            lines.append(blank(line))
        elif line.startswith(("    ", "\t")):
            lines.append(blank(line))
        else:
            lines.append(line)
    text = "".join(lines)
    if inline:
        text = re.sub(r"(?<!`)(`+)(?!`)([\s\S]*?)(?<!`)\1(?!`)",
                      lambda m: blank(m[0]), text)
    return text


def links(text):
    # 링크 레이블과 경로의 괄호를 허용하고 참조형 링크는 읽지 않는다.
    opening = re.compile(r"!?\[(?:\\.|[^\[\]\\]|\[[^\]\n]*\])*\]\(")
    for match in opening.finditer(text):
        pos = match.end()
        while pos < len(text) and text[pos].isspace():
            pos += 1
        start = pos
        if pos < len(text) and text[pos] == "<":
            end = text.find(">", pos + 1)
            if end < 0:
                continue
            target = text[pos + 1:end]
            pos = end + 1
        else:
            depth = 0
            while pos < len(text):
                char = text[pos]
                if char == "\\" and pos + 1 < len(text):
                    pos += 2
                    continue
                if char.isspace() or (char == ")" and depth == 0):
                    break
                if char == "(":
                    depth += 1
                elif char == ")":
                    depth -= 1
                pos += 1
            target = text[start:pos]
        # 제목은 공백 뒤의 따옴표 또는 괄호로 감싼 문자열이다.
        if not re.match(r'''(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^\n]*?\)))?\s*\)''', text[pos:]):
            continue
        target = re.sub(r"\\([!\"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])", r"\1", target)
        yield text.count("\n", 0, match.start()) + 1, unescape(target)


def anchors(text):
    headings = without_code(text, inline=False).splitlines()
    found = set()
    used = set()
    for number, line in enumerate(headings):
        heading = re.match(r"^ {0,3}#{1,6}(?:\s+(.*?)\s*#*\s*|\s*)$", line)
        title = None
        if heading:
            title = heading[1] or ""
        elif number + 1 < len(headings) and line.strip() and re.fullmatch(r" {0,3}(?:=+|-+)\s*", headings[number + 1]):
            title = line.strip()
        if title is not None:
            title = unescape(re.sub(r"<[^>]*>", "", title)).lower()
            slug = "".join(c for c in title if c.isalnum() or c.isspace() or c in "-_")
            slug = re.sub(r"\s", "-", slug)
            value = slug
            suffix = 0
            while value in used:
                suffix += 1
                value = f"{slug}-{suffix}"
            used.add(value)
            found.add(value)
    for tag in re.finditer(r"<a\b[^>]*>", without_code(text), re.I):
        for attr in re.finditer(r'''\b(?:id|name)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))''', tag[0], re.I):
            found.add(unescape(next(value for value in attr.groups() if value is not None)))
    return found


def cmd_docs_check(a):
    base = core.root().resolve()
    cfg = core.config() if (base / ".crossgate/config.json").is_file() else {}
    folder = (base / (a.folder or core.config_value(cfg, "docs.root", "docs"))).resolve()
    problems = 0
    checked = 0

    def label(path):
        try:
            return path.relative_to(base).as_posix()
        except ValueError:
            return str(path)

    def report(path, line, kind, content):
        nonlocal problems
        problems += 1
        content = " ".join(str(content).splitlines())
        print(f"{label(path)}:{line}: {kind} → {content}")

    if not folder.is_dir():
        print(f"문서 폴더 없음: {label(folder)}")
        print("검사한 링크: 0개, 문제: 0개")
        return
    exclude = core.config_value(cfg, "docs.exclude", [])
    files = sorted(p for p in folder.rglob("*.md")
                   if p.is_file() and not core.match(p.relative_to(folder).as_posix(), exclude))
    index = (folder / core.config_value(cfg, "docs.index", "INDEX.md")).resolve()
    texts = {p.resolve(): p.read_text(encoding="utf-8") for p in files}
    anchor_cache = {}
    indexed = set()
    if not index.is_file():
        if a.require_index:
            report(index, 1, "목차 없음", "목차 검사를 건너뜁니다")
        else:
            print(f"목차 없음: {label(index)} (목차 검사를 건너뜁니다)")
    for path in files:
        clean = without_code(texts[path.resolve()])
        for wiki in re.finditer(r"\[\[[^\]\n]+\]\]", clean):
            report(path, clean.count("\n", 0, wiki.start()) + 1, "위키링크", wiki[0])
        for line, target in links(clean):
            # 네트워크 주소는 요청하지 않는다. 로컬 상대 경로만 센다.
            if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith("//"):
                continue
            parts = urlsplit(target)
            if parts.path.startswith("/"):
                continue
            checked += 1
            destination = (path.parent / unquote(parts.path)).resolve() if parts.path else path.resolve()
            if path.resolve() == index:
                indexed.add(destination)
            if not destination.exists():
                report(path, line, "깨진 링크", target)
                if path.resolve() == index:
                    report(path, line, "목차 불일치", target)
                continue
            if parts.fragment and (not parts.path or destination.suffix == ".md") and destination.is_file():
                if destination not in anchor_cache:
                    text = texts.get(destination)
                    if text is None:
                        text = destination.read_text(encoding="utf-8")
                    anchor_cache[destination] = anchors(text)
                if unquote(parts.fragment) not in anchor_cache[destination]:
                    report(path, line, "없는 앵커", target)
    if index in texts:
        for path in files:
            if path.resolve() != index and path.resolve() not in indexed:
                report(path, 1, "목차 불일치", f"{label(index)}에서 링크되지 않음")
    print(f"검사한 링크: {checked}개, 문제: {problems}개")
    if problems:
        sys.exit(1)


def register(subparsers):
    p = subparsers.add_parser("docs-check", description=(
        "문서의 목차·상대 링크·앵커·위키링크를 검사합니다. 참조형 링크([글][이름])는 검사하지 않습니다. "
        "제외 무늬는 문서 폴더 기준이며, 링크 수는 코드 밖의 로컬 상대 링크와 이미지 링크 수입니다."))
    p.add_argument("folder", nargs="?", metavar="문서폴더", help="설치 위치 기준 문서 폴더 (기본: 설정 docs.root 또는 docs)")
    p.add_argument("--require-index", action="store_true", help="목차 파일이 없으면 문제로 셉니다")
    p.set_defaults(fn=cmd_docs_check)
