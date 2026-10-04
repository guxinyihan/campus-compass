FROM eclipse-temurin:21-jre-jammy
ARG GRAPHHOPPER_VERSION=10.2
ARG GRAPHHOPPER_SHA256=ead763749c395ea0cc45b3fd10092d6de84d62fb5cbaf7d416ba6cc142c5716c
WORKDIR /opt/graphhopper
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/* \
    && curl --fail --location --retry 3 "https://github.com/graphhopper/graphhopper/releases/download/${GRAPHHOPPER_VERSION}/graphhopper-web-${GRAPHHOPPER_VERSION}.jar" --output graphhopper.jar \
    && echo "${GRAPHHOPPER_SHA256}  graphhopper.jar" | sha256sum --check \
    && curl --fail --location "https://raw.githubusercontent.com/graphhopper/graphhopper/${GRAPHHOPPER_VERSION}/LICENSE.txt" --output LICENSE.txt \
    && useradd --uid 10001 --create-home graphhopper && mkdir /graph-cache && chown graphhopper:graphhopper /graph-cache
COPY routing-backend/graphhopper/config.yml /opt/graphhopper/config.yml
USER graphhopper
EXPOSE 8989
HEALTHCHECK --interval=10s --timeout=4s --start-period=90s --retries=18 CMD curl --fail --silent http://127.0.0.1:8989/health || exit 1
ENTRYPOINT ["java", "-Xms128m", "-Xmx768m", "-jar", "/opt/graphhopper/graphhopper.jar", "server", "/opt/graphhopper/config.yml"]
