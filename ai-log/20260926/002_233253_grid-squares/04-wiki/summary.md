# Wiki 갱신 요약

| 문서 | 변경 | 누가·언제 | 이유 |
|---|---|---|---|
| `CLAUDE.md` 250m 단락 | "center points, not boundaries" → 중심점 파일 + `lib/grid-cells.js`가 CELL_ID(국가지점번호, EPSG:5179)로 경계 계산 | 개발 1회차(7842888)에서 선반영, 이번 단계에서 검수 대상으로 편입 | 기획 영향 문서 |
| `CLAUDE.md` 250m 단락 | 같은 농도 칸을 선 없는 단일 경로로 채우고 툴팁은 비가시 히트 폴리곤이라는 그리기 규칙, 칸별 테두리 방식으로 되돌리지 말 것 | Wiki 단계(Master) | QA 1회차 Q-1 원인 재발 방지 |
| `CLAUDE.md` Map 목록 | "Overlays (circles, HTML pins)" → "(circles, 250m cell polygons, HTML pins)" | Wiki 단계(Master) | 개발 검수 권고 |
| `index.html` 출처 문단 | "250m 칸은 서울시 격자 경계입니다." | 개발 2회차(DEV-007) | 사용자용 문구. 코드 변경으로 검수·QA 완료, 여기서는 기록만 |
| `README.md` | 변경 없음 | — | 250m 레이어의 출처·의미 불변 |
