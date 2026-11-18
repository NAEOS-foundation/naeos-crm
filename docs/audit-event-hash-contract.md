# AuditEvent hash contract

## Purpose

The CRM audit chain uses explicit hash metadata so that digest format is not inferred indefinitely from string length. `schemaVersion` describes the event payload schema; it is independent of `hashAlgorithm` and `hashVersion`.

## Supported contracts

| Algorithm | Version | Meaning | Verification |
|---|---:|---|---|
| MD5 | 0 | Historical digest: `id|sequence|previousId` | Digest formula is checked, but substantive event fields are not bound. Reported as `legacy`. |
| SHA256 | 1 | Existing SHA-256 preimage before metadata was bound | Full historical payload digest and predecessor link are checked. Reported as `legacy` with a metadata-binding warning. |
| SHA256 | 2 | Current writer contract | Full payload, algorithm, and version are included in canonical JSON before SHA-256. |

## SHA-256 v1 payload

The v1 canonical payload is preserved exactly for historical verification:

- `id`, `sequence`, `schemaVersion`, `previousEventHash`
- `actorId`, `actorType`, `action`, `entityType`, `entityId`
- `requestId`, `source`, `result`, `reason`, `policyVersion`
- `previousState`, `newState`, `authorization`, `createdAt` (ISO-8601)

Object keys are sorted recursively; JSON values must be finite primitives, arrays, or plain objects.

## SHA-256 v2 payload

SHA-256 v2 uses the same payload and adds:

- `hashAlgorithm: "SHA256"`
- `hashVersion: 2`

Both metadata fields are inside the canonical preimage, so changing either field invalidates the digest. New writes explicitly set both values.

## Migration and read-path behavior

The forward-only migration classifies existing rows from their digest length (32 hex characters = MD5 v0; 64 = SHA-256 v1), without rewriting any historical digest. It aborts if a digest is missing or has an unsupported format. New database defaults are SHA-256 v2, and a check constraint restricts supported algorithm/version pairs.

The audit read port verifies the complete, unfiltered sequence in a PostgreSQL `REPEATABLE READ` transaction before returning a filtered/paginated page. The API exposes the verification status and summary in `meta.integrity`; at most the first 100 issue details are included in one response, with counts and a `truncated` flag.

## Security boundary

A valid chain proves internal consistency against the stored hashes. It does not, by itself, prevent a privileged database operator from rewriting the entire chain and recomputing every digest. Stronger tamper evidence requires an independently controlled external checkpoint or signature/anchor.
