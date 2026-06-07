FROM alpine:3.19.0

RUN apk add --no-cache \
    bash \
    coreutils \
    grep \
    sed \
    gawk \
    jq \
    curl

RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -h /home/appuser -D appuser

# Copy seccomp profile for security hardening
COPY seccomp-profile.json /etc/docker/seccomp-profile.json

WORKDIR /home/appuser
USER appuser

CMD ["tail", "-f", "/dev/null"]
