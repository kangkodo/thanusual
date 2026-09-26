# 기획 검수 요청 (3회차)

- 단계: 기획
- 기준: `ai-log/20260926/002_233253_grid-squares/00-request/request.md`
- 대상: `ai-log/20260926/002_233253_grid-squares/01-planning/todo.md`, `tests/acceptance/grid-cells.test.js` (아직 `lib/grid-cells.js`가 없어 실패가 정상. 기획자가 저장소 밖 참조 구현으로 4개 모두 통과함을 확인함)
- 함께 볼 코드: `map.js`(`drawGrid`, `drawGroup`, `preferCanvas`, `PIN_ZOOM`), `lib/layers.js`(`quantileBreaks`, `bandIndex`), `vendor/seoul-grid.geojson`, `CLAUDE.md` 250m 단락
- 이전 지적: P-1 (해결 / 미해결 / 재발을 판정하라)

기획 루브릭 5개 항목을 판정하라. 특히 다음을 확인하라.
1. 국가지점번호 → UTM-K 모서리 규칙과 좌표계 상수가 맞는가
2. 가장자리·줌·시간 모드·자료 없음 상태 계약이 충분한가
3. 수용 테스트가 옳은 구현만 통과시키는가(예: 중심 ±125m 축 정렬 사각형 근사는 AC-2에서 떨어지는가)
4. QA-5 성능 기준(300ms)이 측정 가능하고 적절한가
