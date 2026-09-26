# 개발 지시 (2회차, QA 실패 복구)

`ai-log/20260926/002_233253_grid-squares/01-planning/todo.md`의 "복구 TODO" 절 DEV-006, DEV-007을 구현하라. QA 보고서 `03-qa/report.md`의 Q-1, Q-2와 캡처(`03-qa/captures/Q-1-light-z15-enlarged.png`, `QA-1-*-detail.png`)를 먼저 본다.

- DEV-001~005의 기존 동작과 수용 테스트(AC-1~4)는 유지한다. 수용 테스트는 수정 금지.
- 체크·완료 근거 규칙은 1회차와 같다. DEV-006 근거에는 "측정 절차"로 잰 대략 수치를 적는다.
- `node --test tests/acceptance/*.test.js`와 `npm test`가 모두 통과해야 한다.
- 문서(`CLAUDE.md` 등) 수정은 이번 지시 범위가 아니다(Wiki 단계 몫). 금지 경로와 새 의존성 금지는 1회차와 같다.
- 끝나면 바꾼 파일, 항목별 상태, 테스트 결과, 대략 수치를 요약하라.
