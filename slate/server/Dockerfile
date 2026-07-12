FROM alpine:3.21

ARG PB_VERSION=0.39.5

RUN apk add --no-cache unzip ca-certificates

ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/ && rm /tmp/pb.zip

COPY pb_migrations /pb/pb_migrations
COPY pb_hooks /pb/pb_hooks

WORKDIR /pb
EXPOSE 8080

# pb_data lives on a Coolify-managed volume; migrations auto-apply on serve.
# WORKDIR must match where pb_migrations/pb_hooks were copied, since PocketBase
# resolves them relative to cwd, not the binary's location.
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080"]
