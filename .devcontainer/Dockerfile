FROM mcr.microsoft.com/devcontainers/base:ubuntu
ARG CLAUDE_VERSION=latest
ARG NODE_VERSION=26.13.1
ARG PNPM_VERSION=12.21.0

# Persist bash history
RUN mkdir /commandhistory \
    && touch /commandhistory/.bash_history

USER vscode

# Install Node.js (official tarball, SHA256 verified) and pnpm into ~/.local
RUN set -eu \
    && case "$(dpkg --print-architecture)" in \
         amd64) NODE_ARCH=x64 ;; \
         arm64) NODE_ARCH=arm64 ;; \
         *) echo "unsupported architecture" >&2; exit 1 ;; \
       esac \
    && NODE_TARBALL="node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz" \
    && cd /tmp \
    && curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}" \
    && curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" \
    && grep " ${NODE_TARBALL}\$" SHASUMS256.txt | sha256sum -c - \
    && mkdir -p /home/vscode/.local/node \
    && tar -xJf "${NODE_TARBALL}" -C /home/vscode/.local/node --strip-components=1 \
    && rm -f "${NODE_TARBALL}" SHASUMS256.txt \
    && PATH="/home/vscode/.local/node/bin:$PATH" /home/vscode/.local/node/bin/npm install -g "pnpm@${PNPM_VERSION}"

# Setup bash history, install Claude CLI, and create config directories
RUN echo 'export PROMPT_COMMAND="history -a" && export HISTFILE=/commandhistory/.bash_history' >> ~/.bashrc \
    && curl -fsSL https://claude.ai/install.sh | bash -s ${CLAUDE_VERSION} \
    && mkdir -p /home/vscode/.claude /home/vscode/.config/gh

# Environment variables
ENV DISABLE_AUTOUPDATER=1 \
    PATH="/home/vscode/.local/node/bin:/home/vscode/.local/bin:${PATH}"

WORKDIR /workspaces
