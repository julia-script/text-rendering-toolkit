# CPU SDF timing observation

Reference date: 2026-07-21. These values are observations, not performance
budgets or release gates.

Environment: Node.js 24.2.0, macOS arm64. Each case generated a 64 × 64 bitmap,
ran five warmups, then recorded 50 synchronous calls through the public API.

| Input | Median | p95 |
| --- | ---: | ---: |
| Four-segment synthetic rectangle | 0.224 ms | 0.323 ms |
| Public Noto Sans `S` outline | 10.500 ms | 11.963 ms |

The difference reflects the accepted CPU algorithm's dependence on flattened
segment count. It supports keeping worker orchestration as a later composition
concern, to be considered when real renderer profiling shows main-thread
latency is material.
