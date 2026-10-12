# Evolve the client and API through one reviewed wire contract

OpenAPI is the shared integration boundary. The backend may remain incomplete, but client work begins only from explicit operations and schemas added to the contract—not from undocumented implementation behavior.

## Decision status

- **Normative:** binding for contract additions.
- **Proposed:** recommended but not binding until accepted.
- **Open:** unresolved; affected operations must not silently choose a behavior.

## Ownership and change flow

**Normative**

1. `contracts/openapi.yaml` owns HTTP paths, methods, parameters, wire schemas, status codes, and media types.
2. Product behavior and domain meaning are agreed before an operation is added.
3. A contract change is reviewed by both client and API maintainers before either side depends on it.
4. Implementations may be incomplete; they must not redefine the accepted contract silently.

## Compatibility and versioning

**Normative**

- Additive optional fields and new operations are backward-compatible.
- Removing or renaming fields, changing types or meaning, making optional fields required, and narrowing accepted values are breaking changes.
- Clients ignore unknown response fields but still validate required known fields.
- Breaking changes require an explicit migration plan and a contract versioning decision.

**Open:** URL/header versioning strategy, support window, and deprecation signaling.

## Request and response conventions

**Normative**

- JSON payloads use `application/json` and camelCase property names unless an operation documents another media type.
- Dates and timestamps use explicit OpenAPI string formats; timezone-bearing timestamps use RFC 3339.
- Identifiers are opaque strings to clients. They are never parsed for meaning.
- Optional and nullable are distinct. A schema must express which one applies.
- Successful status codes and empty-body behavior are declared per operation.

## Validation boundary

**Normative:** network payloads enter the client as `unknown` and are parsed by contract-layer Zod schemas before use. Parsing failures become normalized client errors and retain safe diagnostic context; they do not leak raw sensitive payloads to users or logs.

OpenAPI describes the shared wire contract. Zod enforces it at runtime in the TypeScript client. Generated compile-time types may assist development but do not replace runtime validation.

## Errors

**Normative:** non-success problem responses use the RFC 9457 problem-details shape represented by `ProblemDetails` in the OpenAPI document and the `application/problem+json` media type. Each operation declares applicable error responses. Stable machine-readable extensions may be added when a concrete requirement exists.

The UI must branch on stable status/type semantics, not human-readable `title` or `detail` text.

**Open:** stable problem `type` URI registry, field-validation extension shape, localization ownership, and request-correlation field.

## Images

**Normative**

- The API returns an `ImageReference`; clients do not construct asset paths from identifiers.
- The returned URL is opaque to the client and is the only source for the remote asset.
- Bootstrap/catalog image files in the backend are data-seeding inputs, not client assets.
- Context-specific accessible text belongs to the UI; the image transport contract does not invent it.

**Open:** absolute versus API-relative URLs, authorization/signing, cache lifetime, transformation variants, and fallback behavior.

## Collections: pagination and filtering

**Normative:** paginated operations explicitly reference reusable metadata and define stable ordering. Filter names, types, combination rules, defaults, and invalid-value behavior are documented per operation. Clients do not infer them from query strings found in backend code.

`PaginationMetadata` is intentionally strategy-neutral while pagination style is unresolved.

**Open:** cursor versus page/offset pagination, default/max page size, total-count guarantees, filtering grammar, and sorting syntax.

## Idempotency

**Normative:** safe HTTP methods remain free of mutation side effects. Operations that support retry-safe mutation must declare their idempotency mechanism and replay behavior in the contract.

**Open:** whether mutation idempotency keys are required, their header name, retention window, and conflict response.

## Caching

**Normative:** HTTP cache behavior is owned by API response headers. Client query freshness is a UX policy and must not be mistaken for HTTP cache correctness. Mutations document which cached resources become stale.

**Open:** ETag/conditional request policy, cache-control defaults, image caching, and per-resource freshness targets.

## Contract review checklist

- [ ] Product meaning is agreed; no endpoint was copied blindly from implementation.
- [ ] Request, success, empty, and error responses are explicit.
- [ ] Required, optional, and nullable properties are intentional.
- [ ] Ordering, filtering, pagination, retry, and cache semantics are explicit where relevant.
- [ ] Images use `ImageReference` rather than client-constructed asset paths.
- [ ] No unresolved open decision is disguised as an implementation default.

## Related documents

- [Client foundation](../architecture/client-foundation.md)
- [OpenAPI draft](../../contracts/openapi.yaml)
