#!/usr/bin/env bash
# One GitHub Actions run holds this loop for ~5h30m: fetch, publish to the data
# branch, sleep to the next 10-minute mark. A bare 10-minute cron gets throttled
# to a handful of runs a day; the loop is what makes 「지금」 actually 10 minutes old.
# Run from the repo root with the data branch checked out in $DATA_DIR.
set -u
INTERVAL=${INTERVAL:-600}
DEADLINE=${DEADLINE:-19800}          # seconds; the worst last cycle (~11 min) still ends under the 355-min job cap
DATA_DIR=${DATA_DIR:-data-branch}
CYCLE_TIMEOUT=${CYCLE_TIMEOUT:-8m}   # collect.py stops itself at 7 min; this is the backstop
STREET_EVERY=${STREET_EVERY:-3}      # street.json is 300KB and deltas badly; 30 minutes is plenty for bikes and road closures

git -C "$DATA_DIR" config user.name "thanusual-bot"
git -C "$DATA_DIR" config user.email "41898282+github-actions[bot]@users.noreply.github.com"

publish() (
  cd "$DATA_DIR" || return 1
  # collect-daily pushes living/metro/today to the same branch; start from its tip every time.
  git fetch -q origin data && git reset -q --hard FETCH_HEAD || return 1
  # Fold this sample into the 평소 baseline and stamp current.json with each place's usual value.
  python ../scripts/baseline.py --current ../current.json --baseline baseline.json || { echo "baseline failed"; touch ../baseline-failed; }
  cp ../current.json current.json
  [ -f ../street.json ] && cp ../street.json street.json
  git add -A .
  if git diff --staged --quiet; then
    echo "no change"
    return 0
  fi
  # [Skip CI]: Cloudflare Pages otherwise builds a preview for every data push (500 builds/month free cap).
  git commit -q -m "[Skip CI] data: refresh current.json" && git push -q origin HEAD:data || { echo "push failed, retry next cycle"; return 1; }
)

cycle=0
published=0
while (( SECONDS < DEADLINE )); do
  cycle=$((cycle + 1))
  echo "cycle $cycle $(date -u +%H:%MZ)"
  if timeout "$CYCLE_TIMEOUT" python scripts/collect.py --out current.json; then
    if (( (cycle - 1) % STREET_EVERY == 0 )); then
      timeout 3m python scripts/collect_street.py --out street.json || echo "street failed"
    fi
    publish && published=$((published + 1)) || echo "publish failed"
  else
    echo "collect failed (exit $?)"
  fi
  (( SECONDS < DEADLINE )) || break
  sleep $(( INTERVAL - $(date +%s) % INTERVAL ))
done
echo "published $published of $cycle cycles"
[ -f baseline-failed ] && echo "::warning::baseline.py failed in at least one cycle; 평소 samples were not recorded"
(( published > 0 ))   # a run that published nothing goes red so GitHub emails about it
