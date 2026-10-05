# Downstream patch register

This fork follows `huangxd-/danmu_api:main` as its architectural baseline. Local changes are downstream patches, not an alternative upstream implementation.

## Maintenance rules

1. Integrate the complete upstream change set on a temporary `automation/upstream-<sha>` branch.
2. Prefer upstream behavior and structure when resolving overlaps.
3. Keep a downstream patch only while its regression test demonstrates behavior not yet provided upstream.
4. When upstream supersedes a patch, remove the local implementation and retain the regression test when it still protects production behavior.
5. Never merge an automated upstream proposal directly into production without reviewing the active patches below, automated checks, and Vercel Preview.

## Active downstream patches

| ID | Scope | Required invariant | Representative regression coverage | Retirement condition |
| --- | --- | --- | --- | --- |
| MATCH-001 | Episode matching and source-prefixed identifiers | Prefer the correct series/main episode, normalize source prefixes and direct-link offsets, and preserve valid platform candidates | Episode preference, S01E01 series matching, prefixed IDs, direct URL offset tests | Upstream provides equivalent matching and normalization behavior |
| AUTH-001 | Administrative and mutation routes | Sensitive mutations require explicit administrative authorization; masked endpoints must not expose or reuse secret material | Administrative-route, favorite authorization, masked endpoint and log-redaction tests | Upstream enforces equivalent authorization and redaction |
| CACHE-001 | Search, favorites and cache isolation | Fallback search runs only when needed; favorites survive cache maintenance and remain isolated from transient caches | Fallback search, cache eligibility, favorite persistence and clear-cache tests | Upstream passes the same cache-isolation and persistence cases |
| SOURCE-001 | Source registry reliability | Preserve upstream registry topology while isolating constructor/handler failures and validating dependencies and capabilities | Registry contract and synchronous handler failure-isolation tests | Upstream registry supplies equivalent validation and failure isolation |
| PERF-001 | Tencent and Youku bounded concurrency | Slow or failed shards/workers cannot stall healthy results, reorder output or create unbounded concurrency | Tencent deadline/completion and Youku worker-pool tests | Upstream provides equivalent bounded scheduling and partial-result behavior |
| SEARCH-001 | HTTP body deadlines and bounded server search | Body reads remain time-limited; stalled search/handler/season tasks cannot hold healthy results, start late requests or mutate shared anime caches; fallback retains a budget; incomplete results cannot replace complete search caches or favorites | `search-reliability.test.js`: body stalls, retry cancellation, source isolation, fallback reservation, late writes, complete ordering, episode 20, cross-season timeout and favorite preservation | Upstream supplies equivalent deadline, cancellation and cache-integrity guarantees; retain regressions when retiring this patch |
| COLOR-001 | Color and gradient conversion | Keep upstream color semantics while ensuring bounded, smooth gradients and preserving native `color_v2` values | Gradient smoothness, bounds and native-color preservation tests | Upstream implementation passes the same conversion invariants |
| HONGGUO-001 | Hongguo detail and fallback reliability | Preserve complete application details and use a bounded web fallback without discarding valid data | Hongguo complete-detail and bounded-fallback tests | Upstream covers the same completeness and fallback behavior |
| LOCAL-001 | Optional cloud local-danmu reads | A cloud deployment without Redis skips local lookups without issuing network requests | `worker.test.js`: cloud without Redis skips optional local lookup | Upstream applies equivalent storage-readiness guards |

## Upstream review checklist

For every upstream integration Draft PR:

- enumerate every upstream commit in the proposed range;
- review all automatically merged files, not only conflicts;
- classify each active downstream patch as retained, adapted, reduced or retired;
- run Node tests and the forward-widget build;
- require Docker validation and a Ready Vercel Preview;
- verify representative behavior without reading or exposing credentials;
- merge into `main` only after explicit owner confirmation.

## v1.21.1 integration review

Reviewed upstream range: `28673ac..ea88a15a7a1990cb62a2dbaf637061f6a4249679`. Full review and release gates: [UPSTREAM_REVIEW_v1.21.1.md](UPSTREAM_REVIEW_v1.21.1.md).

- MATCH-001: adapted. Preserve main-episode preference and offsets; incorporate sparse local episode numbers and the upstream FongMi season fix.
- AUTH-001: retained. New upload, DELETE and PATCH routes use the upstream administrator gate; PATCH denial is covered for both API prefixes.
- CACHE-001: retained. Local upload/edit/delete invalidate transient search/comment caches; existing favorite protection remains covered.
- SOURCE-001: adapted. Register `local` with lazy initialization and explicit direct-comment capability.
- PERF-001: adapted/reduced. Use upstream cna fallback and empty-result helper; retain worker pool, header compatibility, finite token requests and credential-safe logging.
- SEARCH-001: retained. Upstream does not replace request-budget isolation or incomplete-cache protection.
- COLOR-001: retained. Adopt upstream local XML parsing fix while retaining smooth gradients and native colors.
- HONGGUO-001: retained; no overlapping upstream changes.
- FORWARD-001 and LOCAL-001: added for demonstrated integration regressions.

## v1.21.2 integration review

Reviewed complete upstream range `ea88a15..280b232`. See [UPSTREAM_REVIEW_v1.21.2.md](UPSTREAM_REVIEW_v1.21.2.md).

- MATCH-001: adapted to upstream title normalization; normal and AI matching retain series preference across traditional/simplified titles.
- LOCAL-001: adapted to metadata-only indexing while retaining the no-Redis read guard.
- AUTH-001, CACHE-001, SOURCE-001, PERF-001, SEARCH-001, COLOR-001, HONGGUO-001 and FORWARD-001: retained; upstream does not replace their remaining invariants.

## v1.21.3 integration review

Reviewed complete upstream range `280b232..fc1b7ff`. See [UPSTREAM_REVIEW_v1.21.3.md](UPSTREAM_REVIEW_v1.21.3.md).

- AUTH-001: adapted. Require explicit administrator access for account verification; keep relay credentials on HTTPS without automatic redirects and escape remote verification messages.
- SOURCE-001: reduced overlap. Upstream now provides the custom isolated detail-store propagation already retained downstream; lazy initialization, capability validation and failure isolation remain.
- PERF-001: retained, including bounded Youku concurrency (default 16).
- MATCH-001, CACHE-001, SEARCH-001, COLOR-001, HONGGUO-001, FORWARD-001 and LOCAL-001: retained; no equivalent upstream replacement in this range.

## v1.21.4 integration review

Reviewed complete upstream range `fc1b7ff..afc8b81` (7 commits, 25 changed files). See [UPSTREAM_REVIEW_v1.21.4.md](UPSTREAM_REVIEW_v1.21.4.md).

- CACHE-001: reduced overlap. Adopt upstream independent cache backends, read-before-write protection, unified restoration, episode ID safeguards and selective persistence; retain favorite isolation regressions.
- SEARCH-001: adapted. Keep bounded pipelines and incomplete-result protection; propagate upstream allocation errors and enforce cancellation inside the new allocation helper.
- FORWARD-001: retired implementation. Upstream now supplies the equivalent server-storage build boundary; retain standalone regressions and remove the unused local build substitute.
- MATCH-001, AUTH-001, SOURCE-001, PERF-001, COLOR-001, HONGGUO-001 and LOCAL-001: retained; administrator enforcement, HTTPS relay restrictions and no-Redis cloud lookup guard remain.
