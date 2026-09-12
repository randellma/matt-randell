FROM alpine:3.22 AS download

ARG POCKETBASE_VERSION=0.40.4
ARG TARGETARCH

RUN apk add --no-cache ca-certificates curl unzip \
    && case "${TARGETARCH}" in amd64|arm64) ;; *) echo "Unsupported architecture: ${TARGETARCH}"; exit 1 ;; esac \
    && archive="pocketbase_${POCKETBASE_VERSION}_linux_${TARGETARCH}.zip" \
    && curl --fail --location --remote-name "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/${archive}" \
    && curl --fail --location --remote-name "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/checksums.txt" \
    && grep " ${archive}$" checksums.txt | sha256sum -c - \
    && unzip "${archive}" pocketbase

FROM alpine:3.22

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S pocketbase \
    && adduser -S -G pocketbase pocketbase \
    && mkdir -p /pb/pb_data \
    && chown -R pocketbase:pocketbase /pb

COPY --from=download --chmod=755 /pocketbase /pb/pocketbase
COPY --chown=pocketbase:pocketbase pb_hooks /pb/pb_hooks
COPY --chown=pocketbase:pocketbase pb_migrations /pb/pb_migrations
COPY --chown=pocketbase:pocketbase pb_seeds /pb/pb_seeds

USER pocketbase
WORKDIR /pb
EXPOSE 8090

ENTRYPOINT ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--hooksDir=/pb/pb_hooks", "--migrationsDir=/pb/pb_migrations"]
