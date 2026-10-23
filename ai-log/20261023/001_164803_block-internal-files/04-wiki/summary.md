# Wiki 요약

| 문서 | 바뀐 곳 | 이유 |
|---|---|---|
| `CLAUDE.md` | Product locks: `dist/` 허용 목록 빌드 한 줄 추가 | 새 사이트 파일은 목록·수용 테스트에 넣어야 나간다는 규칙 |
| `CLAUDE.md` | Map: 로컬 미리보기 `npm run dev`, 손 배포 금지 문구 | `wrangler pages dev .`는 이제 저장소 루트를 서빙하므로 틀림 |
| `CLAUDE.md` | Design: Geist Mono 「not published」 | C-2에서 제외 |
| `CLAUDE.md` | Deploy Configuration: `release` 기준 | C-15, Product locks와 일치 |
| `README.md` | 7행 `main` → `release`, 11행 출력 폴더 `dist` | C-15, R-6 |
| `docs/인수인계.md` | 마지막 작업·다음 할 일(대시보드 빌드 명령 → 배포 → 확인)·열린 문제(옛 배포 사본) | jelly-studio 규칙, C-10·C-12 |

갱신 불필요: `docs/plans/osm-leaflet-eng.md` 12행(과거 기획 기록), `docs/숫자-기록.md`(PostHog 동작 불변).
