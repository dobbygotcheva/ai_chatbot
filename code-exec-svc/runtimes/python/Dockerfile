FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Create non-root user
RUN groupadd --gid 1000 appgroup && \
    useradd --uid 1000 --gid 1000 --create-home --shell /bin/bash appuser

# Install essential Python packages (NO NETWORK LIBS - containers are isolated)
RUN pip install --no-cache-dir \
    numpy==1.26.4 \
    pandas==2.2.1 \
    scipy==1.12.0 \
    matplotlib==3.8.3 \
    seaborn==0.13.2 \
    beautifulsoup4==4.12.3 \
    lxml==5.1.0 \
    openpyxl==3.1.2 \
    python-docx==1.1.0 \
    pyyaml==6.0.1 \
    python-dateutil==2.8.2 \
    pytz==2024.1 \
    sympy==1.12  # sympy for symbolic mathematics

# Copy seccomp profile for security hardening
COPY seccomp-profile.json /etc/docker/seccomp-profile.json

WORKDIR /home/appuser
USER appuser

# Matplotlib needs writable dirs for config/cache
ENV MPLCONFIGDIR=/tmp
ENV XDG_CACHE_HOME=/tmp

CMD ["tail", "-f", "/dev/null"]
