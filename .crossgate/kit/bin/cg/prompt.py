import re

from cg.core import KIT, config, is_pm, root


ROLE_CHAPTERS = {
    "request-reviewer": ((1, 2, 3, 4, 10), "요청"),
    "plan-reviewer": ((1, 2, 3, 4, 5, 10), "기획"),
    "dev-reviewer": ((1, 2, 3, 4, 5, 6, 10, 11), "개발"),
    "wiki-reviewer": ((1, 2, 3, 4, 5), "Wiki"),
    "developer": ((1, 6, 10, 11), None),
    "qa": ((1, 2, 3, 6, 11), "QA"),
}
CHAPTER_TITLES = {
    1: "단계와 역할", 2: "판정 규칙", 3: "루브릭",
    4: "검수 응답 형식 (검수 AI 공통)", 5: "반복 상한과 조정 요청",
    6: "버전 고정과 기록", 10: "작업 등급", 11: "PM 모드 (작업공간)",
}


def excerpt_rules(rules, role, pm=False):
    """현재 장 제목과 루브릭 단계로 발췌한다. 필요한 절이 없으면 원문을 쓴다."""
    if role not in ROLE_CHAPTERS:
        return rules
    numbers, stage = ROLE_CHAPTERS[role]
    headings = list(re.finditer(r"^## .+$", rules, re.M))
    chapters = {}
    for i, heading in enumerate(headings):
        title = heading.group()
        if title in chapters:
            return rules
        end = headings[i + 1].start() if i + 1 < len(headings) else len(rules)
        chapters[title] = rules[heading.start():end]
    selected = []
    for number in numbers:
        if number == 11 and not pm:
            continue
        title = f"## {number}. {CHAPTER_TITLES[number]}"
        section = chapters.get(title)
        if section is None:
            return rules
        if number == 1:
            request = list(re.finditer(r"^### 요청 정리: 결정 목록$", section, re.M))
            if len(request) != 1:
                return rules
            if role not in ("request-reviewer", "plan-reviewer"):
                start = request[0].start()
                following = re.search(r"^### ", section[request[0].end():], re.M)
                end = request[0].end() + following.start() if following else len(section)
                section = section[:start] + section[end:]
        if number == 3:
            rows = [line for line in section.splitlines()
                    if line.startswith("|") and line.split("|")[1].strip() == stage]
            if len(rows) != 1 or "| 단계 | 항목 |" not in section or "|---|---|" not in section:
                return rules
            section = f"{title}\n\n| 단계 | 항목 |\n|---|---|\n{rows[0]}\n"
        selected.append(section.strip())
    preamble = rules[:headings[0].start()].strip()
    return "\n\n".join(([preamble] if preamble else []) + selected) + "\n"


def build_prompt(role, run, task, repo=None, writing=False):
    """역할 카드와 필요한 규칙, 이번 작업을 기존 순서로 조립한다."""
    r = root()
    prompt = "\n\n---\n\n".join([
        (KIT / "roles" / f"{role}.md").read_text(encoding="utf-8"),
        excerpt_rules((KIT / "CROSSGATE.md").read_text(encoding="utf-8"), role, is_pm(config())),
        f"# 이번 작업\n\n실행 기록 폴더: `{run.relative_to(r)}`\n\n{task}"])
    if repo and writing:
        prompt += (f"\n\n---\n\n작업 저장소: `{repo.relative_to(r)}`. 쓰기는 이 저장소 안에서만 된다. "
                   "실행 기록 폴더는 쓸 수 없으니 todo.md 체크 대신 항목별 완료 근거를 답변에 적는다.")
    return prompt
