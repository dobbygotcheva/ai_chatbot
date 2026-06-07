FROM docker.io/searxng/searxng:latest

# Overwrite the default settings template with our custom config.
# The upstream image declares /etc/searxng as a VOLUME, so files
# copied directly there are hidden at runtime. Instead, we overwrite
# the template at /usr/local/searxng/searx/settings.yml; the
# entrypoint copies this template into the volume if the config
# path doesn't already exist.
COPY --chown=searxng:searxng core-config/settings.yml /usr/local/searxng/searx/settings.yml
