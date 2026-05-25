FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies and add deadsnakes PPA
RUN apt-get update && apt-get install -y --no-install-recommends \
    software-properties-common \
    curl \
    ca-certificates \
    gcc \
    python3-dev \
    && add-apt-repository ppa:deadsnakes/ppa \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        python3.8 python3.8-distutils python3.8-dev \
        python3.9 python3.9-distutils python3.9-dev \
        python3.10 python3.10-distutils python3.10-dev \
        python3.11 python3.11-distutils python3.11-dev \
        python3.12 python3.12-dev \
        python3.13 python3.13-dev \
        python3-pip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set default python interpreter to 3.11
RUN ln -sf /usr/bin/python3.11 /usr/bin/python3 && \
    ln -sf /usr/bin/python3.11 /usr/bin/python

WORKDIR /app

COPY . .

# Ensure pip is installed for all python versions and install pyarmor
RUN curl -sS https://bootstrap.pypa.io/get-pip.py -o get_pip.py && \
    python3.8 get_pip.py && \
    python3.9 get_pip.py && \
    python3.10 get_pip.py && \
    python3.11 get_pip.py && \
    python3.12 get_pip.py && \
    python3.13 get_pip.py && \
    rm get_pip.py

# Install PyArmor in all Python environments
RUN python3.8 -m pip install --no-cache-dir pyarmor && \
    python3.9 -m pip install --no-cache-dir pyarmor && \
    python3.10 -m pip install --no-cache-dir pyarmor && \
    python3.11 -m pip install --no-cache-dir -r requirements.txt && \
    python3.12 -m pip install --no-cache-dir pyarmor && \
    python3.13 -m pip install --no-cache-dir pyarmor

EXPOSE 8000

CMD ["python3.11", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]