# 평소보다 / thanusual

지금 121곳을 한눈에 비교합니다. 첫 도시 서울. 화면은 [thanusual.pages.dev](https://thanusual.pages.dev).

평소 대비 %는 같은 요일·같은 10분 슬롯이 3주 모이면 붙습니다. 그 전에는 지금 붐빔 순입니다. 「2시간 뒤」는 인원 예측만 쓰고, 혼잡 등급 문구는 쓰지 않습니다.

수집은 GitHub Actions가 `citydata_ppltn`을 10분마다 호출해 `data` 브랜치의 `current.json`만 갱신합니다. 페이지 빌드는 `main`을 올릴 때만 돕니다. 인증키는 Actions Secrets와 로컬 `secrets/seoul.env`에만 둡니다.

지도 레이어(동네 생활인구, 지하철 승하차, 따릉이·돌발, 오늘 행사)도 같은 서울 인증키로 `data` 브랜치에 올립니다. 실시간 칸 혼잡·50m 격자는 무료 공개가 아니라 넣지 않습니다.

Pages 출력 디렉터리는 저장소 루트입니다 (`wrangler.toml`의 `pages_build_output_dir = "."`).
