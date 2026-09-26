# 기획 검수 요청 (1회차)

- 단계: 기획
- 기준: `ai-log/20260926/001_212957_pin-places/00-request/request.md` (사용자 확인 완료된 가정 A-1~A-3 포함)
- 대상:
  - `ai-log/20260926/001_212957_pin-places/01-planning/todo.md` (DEV-001~008, 수용 기준, 영향 문서, 하지 않을 일)
  - `tests/acceptance/pins.test.js` (AC-1~AC-6, 아직 `lib/pins.js`가 없어 실패하는 것이 정상)
- 함께 볼 코드: `app.js`(render, bindBoard, renderDetail), `shared.js`(state, rowsOf, visibleRows), `index.html`, `styles.css`, `CLAUDE.md`(정렬 계약·제품 잠금)
- 이전 지적: 없음

기획 루브릭 5개 항목(요구 대응, 범위 경계, 상태 계약, 검증 가능성, 영향 문서)을 판정하라. 특히 다음을 확인하라.
1. 요청의 R-1~R-9와 A-1~A-3이 TODO·수용 기준에 빠짐없이 대응하는가
2. 시간 모드(지금/과거/예측/평소/250m), warming 전환, `fresh`가 아닌 장소, 새로고침 중 다시 그리기 같은 상태에서 고정 구역의 동작이 정의돼 있는가
3. 행 버튼 옆 고정 버튼 구조와 기존 `#board` 클릭 처리·포커스 유지가 충돌하지 않게 계약이 충분한가
4. 수용 테스트가 기준을 실제로 검증하는가(항상 통과하거나 구현을 과하게 묶지 않는가)
